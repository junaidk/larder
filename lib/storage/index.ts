import { randomBytes } from 'node:crypto'
import { link, mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { CookLogEntry, Recipe, RecipeSummary } from '@/lib/recipe/types'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe, formatLogEntry } from '@/lib/recipe/serialize'
import { allIngredients, cookLog } from '@/lib/recipe/access'

const SAFE_SLUG = /^[a-z0-9-]+$/

export function recipesDir(): string {
  return process.env.RECIPES_DIR || join(process.cwd(), 'recipes')
}

export function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG.test(slug)
}

function requireSafeSlug(slug: string): void {
  if (!isSafeSlug(slug)) throw new Error(`Unsafe recipe slug: ${slug}`)
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

function pathFor(slug: string): string {
  requireSafeSlug(slug)
  return join(recipesDir(), `${slug}.md`)
}

/** Write a file with no risk of a part-written result. */
async function writeAtomic(target: string, content: string): Promise<void> {
  await mkdir(recipesDir(), { recursive: true })
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(temp, content, 'utf8')
    await rename(temp, target)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

async function listSlugs(): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(recipesDir())
  } catch {
    return []
  }
  return names
    .filter((n) => n.endsWith('.md'))
    .map((n) => n.slice(0, -3))
    .filter(isSafeSlug)
    .sort()
}

export async function readRecipe(slug: string): Promise<Recipe | null> {
  const path = pathFor(slug)
  try {
    return parseRecipe(await readFile(path, 'utf8'), slug)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await writeAtomic(pathFor(recipe.slug), serializeRecipe(recipe))
}

const MAX_SLUG_ATTEMPTS = 1000

/**
 * Create a new recipe file with a slug that no other file holds.
 *
 * The content is written to a temp file first, under a throwaway name, in
 * the same directory as the target. Only then does the function try to
 * claim a filename, with `link()` from the temp file to the target path.
 * `link()` fails with `EEXIST` when another writer already holds the
 * path, exactly as the earlier `wx` flag did, so the suffix-advance loop
 * keeps its shape.
 *
 * Because the content is complete on disk before the `link` call runs,
 * the target path can only ever be absent or complete. A crash between
 * the two steps leaves the temp file behind, never a truncated recipe at
 * a clean slug. The temp file is removed on every exit, success or
 * failure, so a failed create leaves no rubbish behind.
 */
export async function createRecipe(title: string, markdown: string): Promise<string> {
  const base = slugify(title)
  await mkdir(recipesDir(), { recursive: true })

  const temp = join(recipesDir(), `.${base}.${randomBytes(6).toString('hex')}.tmp`)
  await writeFile(temp, markdown, 'utf8')

  try {
    let slug = base
    for (let n = 2; n <= MAX_SLUG_ATTEMPTS; n += 1) {
      try {
        await link(temp, pathFor(slug))
        return slug
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

export async function addLogEntry(slug: string, entry: CookLogEntry): Promise<void> {
  const recipe = await readRecipe(slug)
  if (!recipe) throw new Error(`No recipe with the slug ${slug}`)

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
  await saveRecipe(recipe)
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

export async function listRecipes(): Promise<RecipeSummary[]> {
  const slugs = await listSlugs()
  const summaries = await Promise.all(slugs.map(summarise))
  return summaries.filter((s): s is RecipeSummary => s !== null)
}

async function summarise(slug: string): Promise<RecipeSummary | null> {
  const recipe = await readRecipe(slug)
  if (!recipe) return null

  const log = cookLog(recipe)
  const items = allIngredients(recipe).map((i) => i.item ?? i.rawLine)

  return {
    slug,
    title: recipe.frontmatter.title || slug,
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
