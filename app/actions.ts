'use server'

import { revalidatePath } from 'next/cache'
import { addLogEntry, createRecipe, isSafeSlug, readRecipe, saveRecipe } from '@/lib/storage/index'
import { parseRecipe } from '@/lib/recipe/parse'

export type ActionResult = { ok: true; slug?: string } | { ok: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function addLogEntryAction(slug: string, form: FormData): Promise<ActionResult> {
  if (!isSafeSlug(slug)) return { ok: false, error: 'That recipe name is not valid.' }

  const date = String(form.get('date') ?? '').trim()
  if (!DATE_RE.test(date)) return { ok: false, error: 'Give a date in the form YYYY-MM-DD.' }

  const note = String(form.get('note') ?? '').trim()
  if (!note) return { ok: false, error: 'Write a note before you save.' }

  const ratingRaw = String(form.get('rating') ?? '').trim()
  const rating = ratingRaw ? Number(ratingRaw) : null
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, error: 'A rating is a whole number from 1 to 5.' }
  }

  try {
    await addLogEntry(slug, { date, rating, note })
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }

  revalidatePath(`/r/${slug}`)
  revalidatePath('/')
  return { ok: true }
}

export async function saveRecipeAction(
  slug: string | null,
  markdown: string,
  title: string,
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: 'Give the recipe a title.' }
  if (markdown.length > 200_000) return { ok: false, error: 'That recipe is too large.' }

  if (slug === null) {
    const created = await createRecipe(title, markdown)
    revalidatePath('/')
    return { ok: true, slug: created }
  }

  if (!isSafeSlug(slug)) return { ok: false, error: 'That recipe name is not valid.' }
  if (!(await readRecipe(slug))) return { ok: false, error: 'That recipe no longer exists.' }

  await saveRecipe(parseRecipe(markdown, slug))
  revalidatePath('/')
  revalidatePath(`/r/${slug}`)
  return { ok: true, slug }
}
