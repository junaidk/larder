# Recipe Groups by Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every recipe into `recipes/<group>/<slug>.md`, and group the index under a heading for each folder.

**Architecture:** The identity of a recipe becomes the pair of `group` and `slug`, carried by a new `RecipeRef` type. The storage module reads one folder deep and gains `listGroups` and `moveRecipe`. The routes become `/r/<group>/<slug>`. The editor gains a Group box, and a change of group moves the file. The parser and the serializer are not touched, so the round trip guarantee is unaffected.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-recipe-groups-design.md`

## Global Constraints

- Node 22 or later.
- Markdown files stay the only store. Do not add a database.
- `lib/storage/index.ts` stays the only non-test module that imports `node:fs`.
- Do NOT change `lib/recipe/parse.ts` or `lib/recipe/serialize.ts`. Their seven-fixture round trip is the core guarantee of the project.
- This change moves files. It never edits the content of a recipe.
- Every write stays atomic: write the content first, then claim the path with `link`.
- A group name and a slug must each match `^[a-z0-9-]+$`, checked before any path join.
- The folder structure is exactly one level deep.
- Never add an AI attribution line to a commit message.
- Prose in documents and comments uses short, plain sentences in the active voice.

## Expected intermediate state

Tasks 1 to 4 change one layer at a time. `npx tsc --noEmit` reports errors in
the layers not yet converted, and that is expected. Each task states the check
that must pass at that point. From Task 5 onward, `npx tsc --noEmit` and
`npm run build` must both be clean again.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/recipe/types.ts` | Add `RecipeRef`, `Recipe.group?`, `RecipeSummary.group`. | 1 |
| `lib/storage/index.ts` | Read one folder deep. Add `listGroups`, `moveRecipe`. | 1 |
| `lib/storage/storage.test.ts` | Cover the new paths, the move, and the guards. | 1 |
| `app/actions.ts` | Take a `RecipeRef`. Add the group to the save action. | 2 |
| `app/r/[group]/[slug]/page.tsx` | The recipe view. Replaces `app/r/[slug]/page.tsx`. | 3 |
| `app/r/[group]/[slug]/edit/page.tsx` | The editor page. | 3 |
| `components/RecipeIndex.tsx` | Group the list under folder headings. Name loose files. | 4 |
| `app/page.tsx` | Pass the loose file names through. | 4 |
| `components/RecipeEditor.tsx` | The Group box. Send the group on save. | 5 |
| `e2e/recipe.spec.ts` | Drive create into a group, and a move. | 6 |

---

### Task 1: Storage reads one folder deep

**Files:**
- Modify: `lib/recipe/types.ts`
- Modify: `lib/storage/index.ts`
- Test: `lib/storage/storage.test.ts`

**Interfaces:**
- Consumes: `parseRecipe`, `serializeRecipe`, `formatLogEntry`, `cookLog`, `allIngredients`.
- Produces:
  - `interface RecipeRef { group: string; slug: string }`
  - `isSafeName(name: string): boolean`
  - `listGroups(): Promise<string[]>`
  - `listRecipes(): Promise<{ recipes: RecipeSummary[]; looseFiles: string[] }>`
  - `readRecipe(ref: RecipeRef): Promise<Recipe | null>`
  - `saveRecipe(ref: RecipeRef, recipe: Recipe): Promise<void>`
  - `createRecipe(group: string, title: string, markdown: string): Promise<RecipeRef>`
  - `moveRecipe(from: RecipeRef, to: RecipeRef): Promise<void>`
  - `addLogEntry(ref: RecipeRef, entry: CookLogEntry): Promise<void>`
  - `deleteLogEntry(ref: RecipeRef, index: number): Promise<void>`

- [ ] **Step 1: Add the types**

In `lib/recipe/types.ts`, add `RecipeRef` beside the other exported types:

```ts
/** The identity of a recipe. A slug alone is not unique across groups. */
export interface RecipeRef {
  group: string
  slug: string
}
```

Add one field to `Recipe`:

```ts
  /**
   * The folder that holds this recipe. The storage module sets it after the
   * parse. `parseRecipe` leaves it unset, so the field is optional.
   */
  group?: string
```

Add one field to `RecipeSummary`:

```ts
  /** The folder that holds this recipe. */
  group: string
```

- [ ] **Step 2: Write the failing tests**

Replace the whole body of `lib/storage/storage.test.ts` with this file. It
keeps every guarantee the old tests covered and adds the group cases.

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'recipes-'))
  process.env.RECIPES_DIR = dir
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.RECIPES_DIR
})

async function mod() {
  return await import('@/lib/storage/index')
}

function seed(group: string, slug: string, body: string) {
  mkdirSync(join(dir, group), { recursive: true })
  writeFileSync(join(dir, group, `${slug}.md`), body)
}

const SIMPLE = ['---', 'title: Focaccia', '---', '', '# Focaccia', '',
  '## Ingredients', '', '- 500 g flour', '',
  '## Method', '', '1. Bake it.', ''].join('\n')

describe('isSafeName', () => {
  it.each([
    ['breads', true], ['main-courses', true], ['a1', true],
    ['../escape', false], ['Breads', false], ['with space', false],
    ['', false], ['a/b', false], ['.', false],
  ])('reads %s as %s', async (name, expected) => {
    expect((await mod()).isSafeName(name as string)).toBe(expected)
  })
})

describe('slugify', () => {
  it.each([
    ['Focaccia', 'focaccia'],
    ['Main Courses', 'main-courses'],
    ['Mum’s Best Soup!', 'mums-best-soup'],
    ['Café Crème', 'cafe-creme'],
  ])('turns %s into %s', async (title, slug) => {
    expect((await mod()).slugify(title)).toBe(slug)
  })

  it('gives a fallback for a title with no usable characters', async () => {
    expect((await mod()).slugify('!!!')).toBe('recipe')
  })
})

describe('listGroups', () => {
  it('returns the folder names in order', async () => {
    seed('desserts', 'tart', SIMPLE)
    seed('breads', 'focaccia', SIMPLE)
    expect(await (await mod()).listGroups()).toEqual(['breads', 'desserts'])
  })

  it('ignores a folder with an unsafe name', async () => {
    mkdirSync(join(dir, 'Not Safe'), { recursive: true })
    seed('breads', 'focaccia', SIMPLE)
    expect(await (await mod()).listGroups()).toEqual(['breads'])
  })

  it('returns an empty list when the folder does not exist', async () => {
    process.env.RECIPES_DIR = join(dir, 'nope')
    expect(await (await mod()).listGroups()).toEqual([])
  })
})

describe('readRecipe', () => {
  it('reads a recipe inside a group and records the group', async () => {
    seed('breads', 'focaccia', SIMPLE)
    const recipe = await (await mod()).readRecipe({ group: 'breads', slug: 'focaccia' })
    expect(recipe).not.toBeNull()
    expect(recipe!.group).toBe('breads')
    expect(recipe!.slug).toBe('focaccia')
    expect(recipe!.frontmatter.title).toBe('Focaccia')
  })

  it('returns null when the recipe is absent', async () => {
    expect(await (await mod()).readRecipe({ group: 'breads', slug: 'nope' })).toBeNull()
  })

  it('rejects a group that tries to escape the folder', async () => {
    await expect((await mod()).readRecipe({ group: '../etc', slug: 'passwd' }))
      .rejects.toThrow(/group/i)
  })

  it('rejects a slug that tries to escape the folder', async () => {
    await expect((await mod()).readRecipe({ group: 'breads', slug: '../secret' }))
      .rejects.toThrow(/slug/i)
  })
})

describe('createRecipe', () => {
  it('writes into the group and returns the reference', async () => {
    const ref = await (await mod()).createRecipe('breads', 'Focaccia', SIMPLE)
    expect(ref).toEqual({ group: 'breads', slug: 'focaccia' })
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toContain('title: Focaccia')
  })

  it('makes the group folder when it is absent', async () => {
    await (await mod()).createRecipe('desserts', 'Tart', SIMPLE)
    expect(readdirSync(join(dir, 'desserts'))).toEqual(['tart.md'])
  })

  it('lets two groups hold the same slug', async () => {
    const m = await mod()
    const a = await m.createRecipe('breads', 'Focaccia', SIMPLE)
    const b = await m.createRecipe('mains', 'Focaccia', SIMPLE)
    expect(a.slug).toBe('focaccia')
    expect(b.slug).toBe('focaccia')
    expect(a.group).toBe('breads')
    expect(b.group).toBe('mains')
  })

  it('adds a numeric suffix for a repeat inside one group', async () => {
    const m = await mod()
    await m.createRecipe('breads', 'Focaccia', SIMPLE)
    const second = await m.createRecipe('breads', 'Focaccia', SIMPLE)
    expect(second).toEqual({ group: 'breads', slug: 'focaccia-2' })
  })

  it('never overwrites a file already at the target path', async () => {
    seed('breads', 'focaccia', 'ORIGINAL')
    const ref = await (await mod()).createRecipe('breads', 'Focaccia', SIMPLE)
    expect(ref.slug).toBe('focaccia-2')
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toBe('ORIGINAL')
  })

  it('leaves no temporary file behind', async () => {
    await (await mod()).createRecipe('breads', 'Focaccia', SIMPLE)
    expect(readdirSync(join(dir, 'breads'))).toEqual(['focaccia.md'])
  })

  it('rejects an unsafe group name', async () => {
    await expect((await mod()).createRecipe('../etc', 'Focaccia', SIMPLE))
      .rejects.toThrow(/group/i)
  })
})

describe('moveRecipe', () => {
  it('moves the file and keeps the content', async () => {
    seed('breads', 'focaccia', SIMPLE)
    await (await mod()).moveRecipe(
      { group: 'breads', slug: 'focaccia' },
      { group: 'mains', slug: 'focaccia' },
    )
    expect(readFileSync(join(dir, 'mains', 'focaccia.md'), 'utf8')).toBe(SIMPLE)
    expect(readdirSync(join(dir, 'breads'))).toEqual([])
  })

  it('makes the target folder when it is absent', async () => {
    seed('breads', 'focaccia', SIMPLE)
    await (await mod()).moveRecipe(
      { group: 'breads', slug: 'focaccia' },
      { group: 'brand-new', slug: 'focaccia' },
    )
    expect(readdirSync(join(dir, 'brand-new'))).toEqual(['focaccia.md'])
  })

  it('refuses to overwrite a recipe at the target path', async () => {
    seed('breads', 'focaccia', SIMPLE)
    seed('mains', 'focaccia', 'OTHER')
    await expect((await mod()).moveRecipe(
      { group: 'breads', slug: 'focaccia' },
      { group: 'mains', slug: 'focaccia' },
    )).rejects.toThrow(/already exists/i)

    // Both files survive the refusal.
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toBe(SIMPLE)
    expect(readFileSync(join(dir, 'mains', 'focaccia.md'), 'utf8')).toBe('OTHER')
  })

  it('does nothing when the reference does not change', async () => {
    seed('breads', 'focaccia', SIMPLE)
    const ref = { group: 'breads', slug: 'focaccia' }
    await (await mod()).moveRecipe(ref, ref)
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toBe(SIMPLE)
  })

  it('rejects an unsafe target group', async () => {
    seed('breads', 'focaccia', SIMPLE)
    await expect((await mod()).moveRecipe(
      { group: 'breads', slug: 'focaccia' },
      { group: '../etc', slug: 'focaccia' },
    )).rejects.toThrow(/group/i)
  })
})

describe('listRecipes', () => {
  it('summarises every recipe and records its group', async () => {
    seed('breads', 'focaccia', [
      '---', 'title: Focaccia', 'tags: [bread]', 'serves: 8', '---', '',
      '## Ingredients', '', '- 500 g strong white flour', '',
      '## Cook Log', '', '### 2026-09-14 — ★★★★☆', '', 'Good.', '',
    ].join('\n'))
    seed('desserts', 'tart', SIMPLE)

    const { recipes } = await (await mod()).listRecipes()
    expect(recipes).toHaveLength(2)

    const focaccia = recipes.find((r) => r.slug === 'focaccia')!
    expect(focaccia.group).toBe('breads')
    expect(focaccia.title).toBe('Focaccia')
    expect(focaccia.tags).toEqual(['bread'])
    expect(focaccia.latestRating).toBe(4)
    expect(focaccia.timesCooked).toBe(1)
    expect(focaccia.searchText).toContain('strong white flour')

    expect(recipes.find((r) => r.slug === 'tart')!.group).toBe('desserts')
  })

  it('reports a file that sits outside a folder and leaves it out', async () => {
    seed('breads', 'focaccia', SIMPLE)
    writeFileSync(join(dir, 'loose.md'), SIMPLE)

    const { recipes, looseFiles } = await (await mod()).listRecipes()
    expect(recipes.map((r) => r.slug)).toEqual(['focaccia'])
    expect(looseFiles).toEqual(['loose.md'])
  })

  it('returns empty lists when the folder does not exist', async () => {
    process.env.RECIPES_DIR = join(dir, 'nope')
    expect(await (await mod()).listRecipes()).toEqual({ recipes: [], looseFiles: [] })
  })

  it('ignores a file that is not markdown', async () => {
    seed('breads', 'focaccia', SIMPLE)
    writeFileSync(join(dir, 'breads', 'notes.txt'), 'hello')
    const { recipes } = await (await mod()).listRecipes()
    expect(recipes).toHaveLength(1)
  })
})

describe('addLogEntry', () => {
  const base = ['---', 'title: Focaccia', '---', '',
    '# Focaccia', '', '## Cook Log', '',
    '### 2026-08-02 — ★★★☆☆', '', 'First attempt.', ''].join('\n')

  it('puts a new entry at the top and keeps the older one', async () => {
    seed('breads', 'focaccia', base)
    await (await mod()).addLogEntry(
      { group: 'breads', slug: 'focaccia' },
      { date: '2026-09-14', rating: 4, note: 'Too salty.' },
    )
    const out = readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')
    expect(out.indexOf('2026-09-14')).toBeLessThan(out.indexOf('2026-08-02'))
    expect(out).toContain('### 2026-08-02 — ★★★☆☆\n\nFirst attempt.')
  })

  it('adds the section when the file has none', async () => {
    seed('breads', 'toast', '---\ntitle: Toast\n---\n\n## Method\n\n1. Toast it.\n')
    await (await mod()).addLogEntry(
      { group: 'breads', slug: 'toast' },
      { date: '2026-09-14', rating: 5, note: 'Good.' },
    )
    const out = readFileSync(join(dir, 'breads', 'toast.md'), 'utf8')
    expect(out).toContain('## Cook Log')
    expect(out).toContain('1. Toast it.')
  })
})

describe('deleteLogEntry', () => {
  const base = ['---', 'title: Focaccia', '---', '', '# Focaccia', '',
    '## Cook Log', '',
    '### 2026-09-14 — ★★★★☆', '', 'Too salty.', '',
    '### 2026-08-02 — ★★★☆☆', '', 'First attempt.', ''].join('\n')

  it('removes the entry at the position and keeps the rest', async () => {
    seed('breads', 'focaccia', base)
    await (await mod()).deleteLogEntry({ group: 'breads', slug: 'focaccia' }, 0)
    const out = readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')
    expect(out).not.toContain('Too salty.')
    expect(out).toContain('### 2026-08-02 — ★★★☆☆\n\nFirst attempt.')
    expect(out).toContain('# Focaccia')
  })

  it('rejects an index that is out of range', async () => {
    seed('breads', 'focaccia', base)
    await expect((await mod()).deleteLogEntry({ group: 'breads', slug: 'focaccia' }, 9))
      .rejects.toThrow(/entry/i)
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toBe(base)
  })
})

describe('saveRecipe', () => {
  it('writes the recipe back into its group', async () => {
    seed('breads', 'focaccia', SIMPLE)
    const m = await mod()
    const ref = { group: 'breads', slug: 'focaccia' }
    const recipe = (await m.readRecipe(ref))!
    await m.saveRecipe(ref, recipe)
    expect(readFileSync(join(dir, 'breads', 'focaccia.md'), 'utf8')).toBe(SIMPLE)
  })

  it('leaves no temporary file behind', async () => {
    seed('breads', 'focaccia', SIMPLE)
    const m = await mod()
    const ref = { group: 'breads', slug: 'focaccia' }
    await m.saveRecipe(ref, (await m.readRecipe(ref))!)
    expect(readdirSync(join(dir, 'breads'))).toEqual(['focaccia.md'])
  })
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run lib/storage/storage.test.ts`
Expected: FAIL. The message reports that `isSafeName` is not a function, and
that `listGroups` and `moveRecipe` are not functions.

- [ ] **Step 4: Rewrite `lib/storage/index.ts`**

Replace the top of the file, from the imports down to and including
`listSlugs`, with this. Keep the `slugify` function exactly as it is.

```ts
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
```

- [ ] **Step 5: Rewrite the read and write functions**

Replace `readRecipe`, `saveRecipe` and `createRecipe` with these. The comment
above `createRecipe` explains why the order of the calls matters. Keep it.

```ts
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
```

- [ ] **Step 6: Rewrite the log functions and the listing**

Replace `addLogEntry`, `deleteLogEntry`, `listRecipes` and `summarise` with
these. Leave `appendBlankLine` exactly as it is.

```ts
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
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx vitest run lib/storage/storage.test.ts`
Expected: PASS, all cases.

Then run the whole unit suite: `npx vitest run`
Expected: PASS. The parser and serializer tests are untouched and must stay
green. If a fixture round trip fails, stop: something reached the parser or
the serializer, which this plan forbids.

`npx tsc --noEmit` reports errors under `app/` at this point. That is expected
and Tasks 2 to 5 clear them.

- [ ] **Step 8: Commit**

```bash
git add lib/recipe/types.ts lib/storage/index.ts lib/storage/storage.test.ts
git commit -m "feat: read and write recipes one folder deep"
```

---

### Task 2: The server actions take a reference

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: `RecipeRef` from `@/lib/recipe/types`; `addLogEntry`, `createRecipe`, `deleteLogEntry`, `isSafeName`, `moveRecipe`, `readRecipe`, `saveRecipe`, `slugify` from `@/lib/storage/index`.
- Produces:
  - `type ActionResult = { ok: true; ref?: RecipeRef } | { ok: false; error: string }`
  - `addLogEntryAction(ref: RecipeRef, form: FormData): Promise<ActionResult>`
  - `deleteLogEntryAction(ref: RecipeRef, index: number): Promise<ActionResult>`
  - `saveRecipeAction(ref: RecipeRef | null, group: string, markdown: string, title: string): Promise<ActionResult>`

- [ ] **Step 1: Replace `app/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import type { RecipeRef } from '@/lib/recipe/types'
import {
  addLogEntry, createRecipe, deleteLogEntry, isSafeName, moveRecipe,
  readRecipe, saveRecipe, slugify,
} from '@/lib/storage/index'
import { parseRecipe } from '@/lib/recipe/parse'

export type ActionResult = { ok: true; ref?: RecipeRef } | { ok: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function badRef(ref: RecipeRef): boolean {
  return !isSafeName(ref.group) || !isSafeName(ref.slug)
}

function paths(ref: RecipeRef): string {
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

  revalidatePath(paths(ref))
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

  revalidatePath(paths(ref))
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
    const created = await createRecipe(target, title, markdown)
    revalidatePath('/')
    return { ok: true, ref: created }
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

  await saveRecipe(moved, parseRecipe(markdown, moved.slug))

  revalidatePath('/')
  revalidatePath(paths(ref))
  revalidatePath(paths(moved))
  return { ok: true, ref: moved }
}
```

- [ ] **Step 2: Check the file on its own**

Run: `npx tsc --noEmit 2>&1 | grep "app/actions.ts" || echo "actions.ts clean"`
Expected: `actions.ts clean`. Errors under `app/r/` and `components/` remain
until Tasks 3 to 5.

- [ ] **Step 3: Run the unit suite**

Run: `npx vitest run`
Expected: PASS, unchanged from Task 1.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts
git commit -m "feat: take a recipe reference in the server actions"
```

---

### Task 3: The routes carry the group

**Files:**
- Create: `app/r/[group]/[slug]/page.tsx`
- Create: `app/r/[group]/[slug]/edit/page.tsx`
- Delete: `app/r/[slug]/page.tsx`, `app/r/[slug]/edit/page.tsx`
- Modify: `components/CookLogForm.tsx`, `components/DeleteLogEntry.tsx`

**Interfaces:**
- Consumes: `readRecipe` from `@/lib/storage/index`; `addLogEntryAction`, `deleteLogEntryAction` from `@/app/actions`; `RecipeRef` from `@/lib/recipe/types`.
- Produces: routes `/r/<group>/<slug>` and `/r/<group>/<slug>/edit`. `CookLogForm` and `DeleteLogEntry` now take `refProp: RecipeRef` instead of `slug: string`.

- [ ] **Step 1: Move the two pages**

```bash
mkdir -p "app/r/[group]/[slug]/edit"
git mv "app/r/[slug]/page.tsx" "app/r/[group]/[slug]/page.tsx"
git mv "app/r/[slug]/edit/page.tsx" "app/r/[group]/[slug]/edit/page.tsx"
rmdir "app/r/[slug]/edit" "app/r/[slug]"
```

- [ ] **Step 2: Update the view page**

In `app/r/[group]/[slug]/page.tsx`, change the props type and the top of the
component:

```tsx
type Props = {
  params: Promise<{ group: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { group, slug } = await params
  const ref = { group, slug }
  const recipe = await readRecipe(ref)
  if (!recipe) notFound()
```

Change the Edit link in the nav:

```tsx
        <Link href={`/r/${group}/${slug}/edit`} className="text-stone-500 hover:underline">Edit</Link>
```

Change the two components that take a slug:

```tsx
              <CookLogForm recipe={ref} />
```

```tsx
                        <DeleteLogEntry recipe={ref} index={i} date={entry.date} />
```

- [ ] **Step 3: Update the edit page**

Replace `app/r/[group]/[slug]/edit/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { RecipeEditor } from '@/components/RecipeEditor'
import { listGroups, readRecipe } from '@/lib/storage/index'
import { stateFromRecipe } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>
}) {
  const { group, slug } = await params
  const recipe = await readRecipe({ group, slug })
  if (!recipe) notFound()

  return (
    <main>
      <RecipeEditor
        initial={stateFromRecipe(recipe)}
        existing={recipe}
        recipe={{ group, slug }}
        groups={await listGroups()}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
```

- [ ] **Step 4: Update the two client components**

In `components/CookLogForm.tsx`, change the signature and the action call:

```tsx
import type { RecipeRef } from '@/lib/recipe/types'

export function CookLogForm({ recipe }: { recipe: RecipeRef }) {
```

```tsx
    const result = await addLogEntryAction(recipe, form)
```

In `components/DeleteLogEntry.tsx`:

```tsx
import type { RecipeRef } from '@/lib/recipe/types'

export function DeleteLogEntry({
  recipe, index, date,
}: {
  recipe: RecipeRef
  index: number
  date: string
}) {
```

```tsx
    const result = await deleteLogEntryAction(recipe, index)
```

- [ ] **Step 5: Update the new-recipe page**

Replace `app/new/page.tsx` with:

```tsx
import { RecipeEditor } from '@/components/RecipeEditor'
import { listGroups } from '@/lib/storage/index'
import { emptyState } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function NewRecipePage() {
  return (
    <main>
      <RecipeEditor
        initial={emptyState()}
        existing={null}
        recipe={null}
        groups={await listGroups()}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
```

- [ ] **Step 6: Check what remains**

Run: `npx tsc --noEmit 2>&1 | grep -c "error" || echo 0`
Expected: errors remain only in `components/RecipeEditor.tsx` and
`components/RecipeIndex.tsx` and `app/page.tsx`. Tasks 4 and 5 clear them.

- [ ] **Step 7: Commit**

```bash
git add app components
git commit -m "feat: put the group in the recipe routes"
```

---

### Task 4: The index groups by folder

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/RecipeIndex.tsx`

**Interfaces:**
- Consumes: `listRecipes()` returning `{ recipes, looseFiles }`; `RecipeSummary` with a `group` field.
- Produces: `<RecipeIndex recipes={...} looseFiles={...} />`

- [ ] **Step 1: Update `app/page.tsx`**

```tsx
import Link from 'next/link'
import { listRecipes } from '@/lib/storage/index'
import { RecipeIndex } from '@/components/RecipeIndex'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { recipes, looseFiles } = await listRecipes()
  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipe Register</h1>
        <Link
          href="/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          New recipe
        </Link>
      </header>
      <RecipeIndex recipes={recipes} looseFiles={looseFiles} />
    </main>
  )
}
```

- [ ] **Step 2: Take the loose files and group the list**

In `components/RecipeIndex.tsx`, change the signature:

```tsx
export function RecipeIndex({
  recipes,
  looseFiles,
}: {
  recipes: RecipeSummary[]
  looseFiles: string[]
}) {
```

Add the grouping just after the `shown` memo:

```tsx
  // Recipes under a heading for each folder, in alphabetical order.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, RecipeSummary[]>()
    for (const recipe of shown) {
      const list = byGroup.get(recipe.group)
      if (list) list.push(recipe)
      else byGroup.set(recipe.group, [recipe])
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [shown])
```

- [ ] **Step 3: Add the notice for a loose file**

Put this directly above the `<div className="flex items-center justify-between">`
that holds the recipe count:

```tsx
      {looseFiles.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {looseFiles.length === 1 ? '1 file sits' : `${looseFiles.length} files sit`} outside a
          folder and {looseFiles.length === 1 ? 'does' : 'do'} not appear below:{' '}
          <span className="font-medium">{looseFiles.join(', ')}</span>. Move{' '}
          {looseFiles.length === 1 ? 'it' : 'them'} into a folder inside your recipes directory.
        </p>
      )}
```

- [ ] **Step 4: Render the groups**

Replace the whole `{view === 'grid' ? ( ... ) : ( ... )}` block with this. It
keeps both views and wraps each in a heading per group.

```tsx
      {grouped.map(([group, items]) => (
        <section key={group}>
          <h2 className="mb-3 font-sans text-xs font-medium tracking-widest text-stone-400 uppercase">
            {group} <span className="text-stone-300">({items.length})</span>
          </h2>

          {view === 'grid' ? (
            <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <li key={`${r.group}/${r.slug}`} className="h-full">
                  <Link
                    href={`/r/${r.group}/${r.slug}`}
                    className="flex h-full flex-col rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400"
                  >
                    <h3 className="font-medium">{r.title}</h3>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <Stars rating={r.latestRating} />
                      <span className="text-stone-500">{cookedLabel(r.timesCooked)}</span>
                    </div>
                    <p className="mt-auto flex flex-wrap gap-1 pt-2">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          {t}
                        </span>
                      ))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {items.map((r) => (
                <li key={`${r.group}/${r.slug}`}>
                  <Link
                    href={`/r/${r.group}/${r.slug}`}
                    className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 hover:border-stone-400 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <h3 className="font-medium sm:w-64 sm:shrink-0">{r.title}</h3>
                    <p className="flex flex-1 flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          {t}
                        </span>
                      ))}
                    </p>
                    <div className="flex items-center gap-4 text-sm sm:shrink-0">
                      <Stars rating={r.latestRating} />
                      <span className="text-stone-500 sm:w-28 sm:text-right">
                        {cookedLabel(r.timesCooked)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
```

Wrap the list of sections so the groups keep their spacing. The outer element
of the component already carries `space-y-6`, so no change is needed there.

- [ ] **Step 5: Check the page compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "app/page|RecipeIndex" || echo "index clean"`
Expected: `index clean`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/RecipeIndex.tsx
git commit -m "feat: group the recipe index under a heading for each folder"
```

---

### Task 5: The editor sets the group

**Files:**
- Modify: `components/RecipeEditor.tsx`

**Interfaces:**
- Consumes: `saveRecipeAction(ref, group, markdown, title)`; `RecipeRef`.
- Produces: `<RecipeEditor initial existing recipe groups today />` where `recipe: RecipeRef | null` and `groups: string[]`.

- [ ] **Step 1: Change the props**

Replace the `slug` prop with `recipe` and `groups`:

```tsx
import type { Recipe, RecipeRef } from '@/lib/recipe/types'

export function RecipeEditor({
  initial, existing, recipe, groups, today,
}: {
  initial: EditorState
  existing: Recipe | null
  recipe: RecipeRef | null
  groups: string[]
  today: string
}) {
```

- [ ] **Step 2: Hold the group in state**

Add this beside the other `useState` calls:

```tsx
  const [group, setGroup] = useState(recipe?.group ?? groups[0] ?? '')
```

- [ ] **Step 3: Send the group on save**

Replace the body of `save`:

```tsx
  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecipeAction(recipe, group, markdown, state.title)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    router.push(`/r/${result.ref!.group}/${result.ref!.slug}`)
    router.refresh()
  }
```

- [ ] **Step 4: Add the Group box**

Put this directly below the Title field:

```tsx
          <label className="block text-sm">Group
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              list="recipe-groups"
              placeholder="breads"
              required
              className={field}
            />
          </label>
          <datalist id="recipe-groups">
            {groups.map((g) => <option key={g} value={g} />)}
          </datalist>
```

- [ ] **Step 5: Point Cancel at the group route**

```tsx
          <Link
            href={recipe ? `/r/${recipe.group}/${recipe.slug}` : '/'}
            className="rounded px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            Cancel
          </Link>
```

- [ ] **Step 6: Point the preview label at the real path**

```tsx
              {recipe ? `recipes/${recipe.group}/${recipe.slug}.md` : 'the new file'} — this is the exact text that the app writes
```

- [ ] **Step 7: Run every check**

Run: `npx vitest run`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors. Every layer is converted at this point.

Run: `npm run build`
Expected: compiled successfully.

- [ ] **Step 8: Commit**

```bash
git add components/RecipeEditor.tsx
git commit -m "feat: choose the group of a recipe in the editor"
```

---

### Task 6: Migration, the end-to-end test, and the documents

**Files:**
- Move: `recipes/focaccia.md` to `recipes/breads/focaccia.md`
- Modify: `e2e/recipe.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the whole app.
- Produces: a passing `npm run e2e`.

- [ ] **Step 1: Move the sample recipe**

```bash
mkdir -p recipes/breads
git mv recipes/focaccia.md recipes/breads/focaccia.md
```

Leave `recipes/x.md` where it is. The user asked for that file to stay put.
The index names it in the notice from Task 4.

- [ ] **Step 2: Update the end-to-end test**

In `e2e/recipe.spec.ts`, change the file path constant and the create flow:

```ts
const DIR = join(process.cwd(), 'e2e/.recipes')
const FILE = join(DIR, 'breads', 'test-loaf.md')
```

In the first test, fill the Group box after the Title, and expect the grouped
URL:

```ts
  await page.getByLabel('Title').fill('Test Loaf')
  await page.getByLabel('Group').fill('breads')
  await page.getByLabel('Serves').fill('4')
```

```ts
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/breads\/test-loaf$/)
```

Change the two later `page.goto` calls in the other tests:

```ts
  await page.goto('/r/breads/test-loaf')
```

- [ ] **Step 3: Add an end-to-end test for the move**

Add this test at the END of the file, after every other test. A failed move
would otherwise leave the recipe in the wrong group, and every test after it
would fail for that reason rather than its own. Playwright also starts a fresh
worker after a failure, which re-runs `beforeAll` and empties the directory.

```ts
test('changing the group moves the file and the URL', async ({ page }) => {
  const before = readFileSync(FILE, 'utf8')

  await page.goto('/r/breads/test-loaf/edit')
  await page.getByLabel('Group').fill('mains')
  await page.getByRole('button', { name: 'Save recipe' }).click()

  await expect(page).toHaveURL(/\/r\/mains\/test-loaf$/)

  const moved = join(DIR, 'mains', 'test-loaf.md')
  expect(existsSync(moved)).toBe(true)
  expect(existsSync(FILE)).toBe(false)

  // The move must not edit the content. Only the updated date may differ.
  const after = readFileSync(moved, 'utf8')
  const body = (t: string) => t.slice(t.indexOf('# Test Loaf'))
  expect(body(after)).toBe(body(before))
})
```

- [ ] **Step 4: Update the README**

In `README.md`, replace the section on where the recipes live:

```markdown
## Where the recipes live

The app reads and writes `./recipes`. Every recipe sits inside a folder, and
the folder name is the group:

```
recipes/
  breads/
    focaccia.md
  desserts/
    lemon-tart.md
```

The index shows a heading for each folder. To regroup a recipe, change the
Group box in the editor, or move the file yourself.

A markdown file directly inside `recipes/` is not a recipe location. The index
names such a file so that it is never hidden.

To use another folder, set `RECIPES_DIR`:

```bash
RECIPES_DIR=~/Documents/recipes npm run dev
```
```

- [ ] **Step 5: Run every check**

```bash
npx vitest run
npx tsc --noEmit
npm run build
npm run e2e
```

Expected: all four finish with no error.

- [ ] **Step 6: Check the app by hand**

Run `npm run dev` and open http://localhost:3000.

Expected:
- The index shows a `breads` heading with Focaccia below it.
- A notice names `x.md` as a file outside a folder.
- Focaccia opens at `/r/breads/focaccia`.
- The editor shows `breads` in the Group box.
- Changing the group to `mains` and saving moves the file and lands on
  `/r/mains/focaccia`. Move it back to `breads` afterwards.

- [ ] **Step 7: Commit**

```bash
git add recipes e2e README.md
git commit -m "feat: move the sample recipe into a group and cover the move end to end"
```

---

## Acceptance

| # | Criterion | Where it is proved |
|---|---|---|
| 1 | A recipe lives at `recipes/<group>/<slug>.md`. | Task 1 storage tests. |
| 2 | The index groups under a heading for each folder. | Task 4, checked by hand in Task 6. |
| 3 | The user creates a recipe into a group. | Task 5, and the first e2e test. |
| 4 | The user changes the group. The app moves the file. | Task 1 `moveRecipe` tests, Task 5, and the move e2e test. |
| 5 | The app names a file outside a folder. | Task 1 `listRecipes` test, Task 4 notice. |
| 6 | A group or a slug cannot reach outside the recipe folder. | Task 1 tests for `../` in each part. |
