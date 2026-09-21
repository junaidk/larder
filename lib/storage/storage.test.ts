import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// `link` passes through to the real implementation by default. Individual
// tests force a single rejection to exercise a cleanup path.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, link: vi.fn(actual.link) }
})

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

  it('leaves no temporary file behind when the link fails for a reason other than EEXIST', async () => {
    vi.mocked(link).mockRejectedValueOnce(Object.assign(new Error('input/output error'), { code: 'EIO' }))
    await expect((await mod()).createRecipe('breads', 'Focaccia', SIMPLE)).rejects.toThrow()
    expect(readdirSync(join(dir, 'breads'))).toEqual([])
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
