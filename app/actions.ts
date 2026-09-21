'use server'

import { revalidatePath } from 'next/cache'
import type { RecipeRef } from '@/lib/recipe/types'
import {
  addLogEntry, createRecipe, deleteLogEntry, isSafeName, moveRecipe,
  readRecipe, saveRecipe, slugify,
} from '@/lib/storage/index'
import { parseRecipe } from '@/lib/recipe/parse'

export type ActionResult =
  | { ok: true; ref?: RecipeRef }
  | { ok: false; error: string; ref?: RecipeRef }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function badRef(ref: RecipeRef): boolean {
  return !isSafeName(ref.group) || !isSafeName(ref.slug)
}

function urlFor(ref: RecipeRef): string {
  return `/r/${ref.group}/${ref.slug}`
}

export async function addLogEntryAction(ref: RecipeRef, form: FormData): Promise<ActionResult> {
  if (badRef(ref)) return { ok: false, error: 'That recipe name is not valid.' }

  const date = String(form.get('date') ?? '').trim()
  if (!DATE_RE.test(date)) return { ok: false, error: 'Give a date in the form YYYY-MM-DD.' }

  const note = String(form.get('note') ?? '').trim()
  if (!note) return { ok: false, error: 'Write a note before you save.' }
  // A line that starts with # reads as a heading. Such a line splits the
  // cook log on the next parse, so the page then shows fewer entries.
  if (note.split(/\r?\n/).some((line) => line.startsWith('#'))) {
    return {
      ok: false,
      error: 'A note cannot have a line that starts with #. Start the line with a word instead.',
    }
  }

  const ratingRaw = String(form.get('rating') ?? '').trim()
  const rating = ratingRaw ? Number(ratingRaw) : null
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, error: 'A rating is a whole number from 1 to 5.' }
  }

  try {
    await addLogEntry(ref, { date, rating, note })
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }

  revalidatePath(urlFor(ref))
  revalidatePath('/')
  return { ok: true }
}

export async function deleteLogEntryAction(ref: RecipeRef, index: number): Promise<ActionResult> {
  if (badRef(ref)) return { ok: false, error: 'That recipe name is not valid.' }

  try {
    await deleteLogEntry(ref, index)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }

  revalidatePath(urlFor(ref))
  revalidatePath('/')
  return { ok: true }
}

/**
 * Save a recipe.
 *
 * `ref` is null for a new recipe. For an existing recipe, a `group` that
 * differs from `ref.group` moves the file. The slug never changes, because
 * section 4.5 of the main design names a file once and keeps that name.
 */
export async function saveRecipeAction(
  ref: RecipeRef | null,
  group: string,
  markdown: string,
  title: string,
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: 'Give the recipe a title.' }
  if (markdown.length > 200_000) return { ok: false, error: 'That recipe is too large.' }

  const target = slugify(group)
  if (!group.trim()) return { ok: false, error: 'Give the recipe a group.' }
  if (!isSafeName(target)) return { ok: false, error: 'That group name is not valid.' }

  if (ref === null) {
    try {
      const created = await createRecipe(target, title, markdown)
      revalidatePath('/')
      return { ok: true, ref: created }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  if (badRef(ref)) return { ok: false, error: 'That recipe name is not valid.' }
  if (!(await readRecipe(ref))) return { ok: false, error: 'That recipe no longer exists.' }

  const moved: RecipeRef = { group: target, slug: ref.slug }

  if (target !== ref.group) {
    try {
      await moveRecipe(ref, moved)
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  try {
    await saveRecipe(moved, parseRecipe(markdown, moved.slug))
  } catch (error) {
    // The move above may already have run. The file then sits at `moved`,
    // not at `ref`, so the caller needs `moved` to keep the user on a live
    // URL rather than the now-dead one for `ref`.
    return { ok: false, error: (error as Error).message, ref: moved }
  }

  revalidatePath('/')
  revalidatePath(urlFor(ref))
  revalidatePath(urlFor(moved))
  return { ok: true, ref: moved }
}
