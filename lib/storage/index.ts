import { randomBytes } from 'node:crypto'
import { link, mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CookLogEntry, Recipe, RecipeRef, RecipeSummary } from '@/lib/recipe/types'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe, formatLogEntry } from '@/lib/recipe/serialize'
import { allIngredients, cookLog } from '@/lib/recipe/access'

const SAFE_NAME = /^[a-z0-9-]+$/

export function recipesDir(): string {
  return process.env.RECIPES_DIR || join(process.cwd(), 'recipes')
}

/** A group name and a slug obey the same rule. */
export function isSafeName(name: string): boolean {
  return SAFE_NAME.test(name)
}

function requireSafeGroup(group: string): void {
  if (!isSafeName(group)) throw new Error(`Unsafe group name: ${group}`)
}

function requireSafeRef(ref: RecipeRef): void {
  requireSafeGroup(ref.group)
  if (!isSafeName(ref.slug)) throw new Error(`Unsafe recipe slug: ${ref.slug}`)
}

function groupDir(group: string): string {
  requireSafeGroup(group)
  return join(recipesDir(), group)
}

function pathFor(ref: RecipeRef): string {
  requireSafeRef(ref)
  return join(recipesDir(), ref.group, `${ref.slug}.md`)
}

/** Write a file with no risk of a part-written result. */
async function writeAtomic(target: string, content: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(temp, content, 'utf8')
    await rename(temp, target)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

async function readdirSafe(path: string) {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch {
    return []
  }
}

export async function listGroups(): Promise<string[]> {
  const entries = await readdirSafe(recipesDir())
  return entries
    .filter((e) => e.isDirectory() && isSafeName(e.name))
    .map((e) => e.name)
    .sort()
}

/** Markdown files sitting outside a group. The index names these. */
async function listLooseFiles(): Promise<string[]> {
  const entries = await readdirSafe(recipesDir())
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort()
}

async function listRefs(): Promise<RecipeRef[]> {
  const refs: RecipeRef[] = []
  for (const group of await listGroups()) {
    const entries = await readdirSafe(join(recipesDir(), group))
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const slug = entry.name.slice(0, -3)
      if (isSafeName(slug)) refs.push({ group, slug })
    }
  }
  return refs.sort((a, b) => a.group.localeCompare(b.group) || a.slug.localeCompare(b.slug))
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Drop an apostrophe rather than treat it as a word break, so that
    // "Mum's" becomes "mums", not "mum-s".
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'recipe'
}

export async function readRecipe(ref: RecipeRef): Promise<Recipe | null> {
  const path = pathFor(ref)
  try {
    const recipe = parseRecipe(await readFile(path, 'utf8'), ref.slug)
    recipe.group = ref.group
    return recipe
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveRecipe(ref: RecipeRef, recipe: Recipe): Promise<void> {
  await writeAtomic(pathFor(ref), serializeRecipe(recipe))
}

const MAX_SLUG_ATTEMPTS = 1000

/**
 * Create a new recipe file inside a group, with a slug that no other file in
 * that group holds.
 *
 * The content is written to a temp file first, under a throwaway name, in the
 * same directory as the target. Only then does the function try to claim a
 * filename, with `link()` from the temp file to the target path. `link()`
 * fails with `EEXIST` when another writer already holds the path, so the
 * suffix-advance loop keeps its shape.
 *
 * Because the content is complete on disk before the `link` call runs, the
 * target path can only ever be absent or complete. A crash between the two
 * steps leaves the temp file behind, never a truncated recipe at a clean
 * slug. The temp file is removed on every exit, success or failure.
 */
export async function createRecipe(
  group: string,
  title: string,
  markdown: string,
): Promise<RecipeRef> {
  const base = slugify(title)
  const dir = groupDir(group)
  await mkdir(dir, { recursive: true })

  const temp = join(dir, `.${base}.${randomBytes(6).toString('hex')}.tmp`)
  await writeFile(temp, markdown, 'utf8')

  try {
    let slug = base
    for (let n = 2; n <= MAX_SLUG_ATTEMPTS; n += 1) {
      try {
        await link(temp, pathFor({ group, slug }))
        return { group, slug }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        slug = `${base}-${n}`
      }
    }
    throw new Error(`Could not find a free slug for ${title} after ${MAX_SLUG_ATTEMPTS} attempts`)
  } finally {
    await unlink(temp).catch(() => {})
  }
}

/**
 * Move a recipe between groups.
 *
 * The function links the new path before it unlinks the old one, so the
 * content exists at one path or at both, never at neither. `link` fails with
 * `EEXIST` when a file already holds the target, so a move never overwrites
 * another recipe.
 */
export async function moveRecipe(from: RecipeRef, to: RecipeRef): Promise<void> {
  const fromPath = pathFor(from)
  const toPath = pathFor(to)
  if (fromPath === toPath) return

  await mkdir(groupDir(to.group), { recursive: true })

  try {
    await link(fromPath, toPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`A recipe already exists at ${to.group}/${to.slug}`)
    }
    throw error
  }

  await unlink(fromPath)
}

export async function addLogEntry(ref: RecipeRef, entry: CookLogEntry): Promise<void> {
  const recipe = await readRecipe(ref)
  if (!recipe) throw new Error(`No recipe at ${ref.group}/${ref.slug}`)

  // A new entry carries an empty line at the end, so that it stays apart
  // from the entry below it.
  const rawLines = [...formatLogEntry(entry).split('\n'), '']
  const fresh: CookLogEntry = { ...entry, rawLines }

  const index = recipe.blocks.findIndex((b) => b.kind === 'cooklog')
  if (index === -1) {
    recipe.blocks.push({
      kind: 'cooklog',
      headingLine: '## Cook Log',
      leading: [''],
      entries: [fresh],
    })
    // Keep one empty line between the section above and the new heading.
    const previous = recipe.blocks[recipe.blocks.length - 2]
    if (previous) appendBlankLine(previous)
  } else {
    const block = recipe.blocks[index]
    if (block.kind === 'cooklog') block.entries = [fresh, ...block.entries]
  }

  recipe.endsWithNewline = true
  await saveRecipe(ref, recipe)
}

/**
 * Remove one cook log entry. `index` counts from the newest entry, in the
 * same order that `cookLog` returns.
 */
export async function deleteLogEntry(ref: RecipeRef, index: number): Promise<void> {
  const recipe = await readRecipe(ref)
  if (!recipe) throw new Error(`No recipe at ${ref.group}/${ref.slug}`)

  const block = recipe.blocks.find((b) => b.kind === 'cooklog')
  if (!block || block.kind !== 'cooklog') {
    throw new Error(`No cook log entry at position ${index}`)
  }
  if (!Number.isInteger(index) || index < 0 || index >= block.entries.length) {
    throw new Error(`No cook log entry at position ${index}`)
  }

  block.entries = block.entries.filter((_, i) => i !== index)
  await saveRecipe(ref, recipe)
}

/** Make sure a block ends with one empty line. */
function appendBlankLine(block: Recipe['blocks'][number]): void {
  if (block.kind === 'ingredients') {
    const lines = block.lines
    const last = lines[lines.length - 1]
    if (!last || last.type !== 'other' || last.raw !== '') lines.push({ type: 'other', raw: '' })
    return
  }
  const lines = block.kind === 'cooklog' ? block.leading : block.lines
  if (lines[lines.length - 1] !== '') lines.push('')
}

export async function listRecipes(): Promise<{
  recipes: RecipeSummary[]
  looseFiles: string[]
}> {
  const refs = await listRefs()
  const summaries = await Promise.all(refs.map(summarise))
  return {
    recipes: summaries.filter((s): s is RecipeSummary => s !== null),
    looseFiles: await listLooseFiles(),
  }
}

async function summarise(ref: RecipeRef): Promise<RecipeSummary | null> {
  const recipe = await readRecipe(ref)
  if (!recipe) return null

  const log = cookLog(recipe)
  const items = allIngredients(recipe).map((i) => i.item ?? i.rawLine)

  return {
    group: ref.group,
    slug: ref.slug,
    title: recipe.frontmatter.title || ref.slug,
    tags: recipe.frontmatter.tags,
    serves: recipe.frontmatter.serves,
    latestRating: log[0]?.rating ?? null,
    lastCooked: log[0]?.date ?? null,
    timesCooked: log.length,
    searchText: [recipe.frontmatter.title, ...recipe.frontmatter.tags, ...items]
      .join(' ')
      .toLowerCase(),
  }
}
