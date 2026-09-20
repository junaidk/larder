import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// `link` is wrapped so a single test can force a non-EEXIST failure. Every
// other call falls through to the real implementation.
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

describe('slugify', () => {
  it.each([
    ['Focaccia', 'focaccia'],
    ['Spaghetti Carbonara', 'spaghetti-carbonara'],
    ['Mum’s Best Soup!', 'mums-best-soup'],
    ['  Extra   Spaces  ', 'extra-spaces'],
    ['Café Crème', 'cafe-creme'],
    ['2026 Loaf', '2026-loaf'],
  ])('turns %s into %s', async (title, slug) => {
    expect((await mod()).slugify(title)).toBe(slug)
  })

  it('gives a fallback for a title with no usable characters', async () => {
    expect((await mod()).slugify('!!!')).toBe('recipe')
  })
})

describe('isSafeSlug', () => {
  it.each([['focaccia', true], ['a-b-1', true], ['../escape', false], ['Upper', false], ['with space', false], ['', false]])(
    'reads %s as %s',
    async (slug, expected) => {
      expect((await mod()).isSafeSlug(slug as string)).toBe(expected)
    },
  )
})

describe('createRecipe', () => {
  it('writes a file and returns the slug', async () => {
    const { createRecipe } = await mod()
    const slug = await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(slug).toBe('focaccia')
    expect(readFileSync(join(dir, 'focaccia.md'), 'utf8')).toContain('title: Focaccia')
  })

  it('adds a numeric suffix when the slug already exists', async () => {
    const { createRecipe } = await mod()
    await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    const second = await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(second).toBe('focaccia-2')
  })

  it('leaves no temporary file behind', async () => {
    const { createRecipe } = await mod()
    await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(readdirSync(dir)).toEqual(['focaccia.md'])
  })

  it('never overwrites a file that already exists at the target path', async () => {
    // A double-submitted form, or two concurrent requests for the same
    // title, must not race past the numeric-suffix guard. The target file
    // is written directly, with no snapshot of `listSlugs()` in between,
    // so this proves the guard holds even when the check-then-act window
    // that a listSlugs()-then-write approach would have is closed.
    const { createRecipe } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), 'original content')

    const slug = await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')

    expect(slug).toBe('focaccia-2')
    expect(readFileSync(join(dir, 'focaccia.md'), 'utf8')).toBe('original content')
    expect(readFileSync(join(dir, 'focaccia-2.md'), 'utf8')).toContain('title: Focaccia')
  })

  it('leaves no temp file behind when a create fails', async () => {
    const { createRecipe } = await mod()
    const linkMock = vi.mocked(fsp.link)
    linkMock.mockRejectedValueOnce(Object.assign(new Error('disk gone'), { code: 'EIO' }))

    await expect(createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')).rejects.toThrow('disk gone')
    expect(readdirSync(dir)).toEqual([])
  })
})

describe('readRecipe', () => {
  it('returns null for a slug with no file', async () => {
    expect(await (await mod()).readRecipe('missing')).toBeNull()
  })

  it('rejects a slug that tries to escape the folder', async () => {
    await expect((await mod()).readRecipe('../secret')).rejects.toThrow(/slug/i)
  })
})

describe('addLogEntry', () => {
  const base = [
    '---', 'title: Focaccia', '---', '', '## Cook Log', '',
    '### 2026-08-02 — ★★★☆☆', '', 'First attempt.', '',
  ].join('\n')

  it('puts a new entry at the top of the section', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), base)
    await addLogEntry('focaccia', { date: '2026-09-14', rating: 4, note: 'Too salty.' })

    const out = readFileSync(join(dir, 'focaccia.md'), 'utf8')
    expect(out.indexOf('2026-09-14')).toBeLessThan(out.indexOf('2026-08-02'))
    expect(out).toContain('### 2026-09-14 — ★★★★☆')
    expect(out).toContain('Too salty.')
  })

  it('keeps the older entry with no change', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), base)
    await addLogEntry('focaccia', { date: '2026-09-14', rating: 4, note: 'Too salty.' })
    expect(readFileSync(join(dir, 'focaccia.md'), 'utf8')).toContain('### 2026-08-02 — ★★★☆☆\n\nFirst attempt.')
  })

  it('adds the section when the file has none', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'toast.md'), '---\ntitle: Toast\n---\n\n## Method\n\n1. Toast it.\n')
    await addLogEntry('toast', { date: '2026-09-14', rating: 5, note: 'Good.' })

    const out = readFileSync(join(dir, 'toast.md'), 'utf8')
    expect(out).toContain('## Cook Log')
    expect(out).toContain('### 2026-09-14 — ★★★★★')
    expect(out).toContain('1. Toast it.')
  })

  it('adds a blank separator line when the section above is Ingredients', async () => {
    const { addLogEntry } = await mod()
    const fixture = [
      '---', 'title: Focaccia', '---', '',
      '## Ingredients', '',
      '- 500 g strong white flour',
      '- 350 ml warm water',
      '- 7 g instant yeast',
      '',
    ].join('\n')
    writeFileSync(join(dir, 'focaccia.md'), fixture)

    await addLogEntry('focaccia', { date: '2026-09-14', rating: 4, note: 'Nice bread.' })
    const out = readFileSync(join(dir, 'focaccia.md'), 'utf8')

    // The new section and entry are present.
    expect(out).toContain('## Cook Log')
    expect(out.indexOf('## Cook Log')).toBeGreaterThan(out.indexOf('## Ingredients'))
    expect(out.indexOf('### 2026-09-14 — ★★★★☆')).toBeGreaterThan(out.indexOf('## Cook Log'))
    expect(out).toContain('Nice bread.')

    // Every ingredient line survives, unchanged.
    expect(out).toContain('- 500 g strong white flour')
    expect(out).toContain('- 350 ml warm water')
    expect(out).toContain('- 7 g instant yeast')

    // Exactly one blank line joins the ingredients to the new heading.
    expect(out).toContain('- 7 g instant yeast\n\n## Cook Log')
    expect(out).not.toContain('- 7 g instant yeast\n\n\n## Cook Log')
  })
})

describe('listRecipes', () => {
  it('summarises every file in the folder', async () => {
    const { listRecipes } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), [
      '---', 'title: Focaccia', 'tags: [bread]', 'serves: 8', '---', '',
      '## Ingredients', '', '- 500 g strong white flour', '',
      '## Cook Log', '', '### 2026-09-14 — ★★★★☆', '', 'Good.', '',
    ].join('\n'))
    writeFileSync(join(dir, 'toast.md'), '---\ntitle: Toast\n---\n')

    const list = await listRecipes()
    expect(list).toHaveLength(2)

    const focaccia = list.find((r) => r.slug === 'focaccia')!
    expect(focaccia.title).toBe('Focaccia')
    expect(focaccia.tags).toEqual(['bread'])
    expect(focaccia.serves).toBe(8)
    expect(focaccia.latestRating).toBe(4)
    expect(focaccia.lastCooked).toBe('2026-09-14')
    expect(focaccia.timesCooked).toBe(1)
    expect(focaccia.searchText).toContain('strong white flour')

    const toast = list.find((r) => r.slug === 'toast')!
    expect(toast.latestRating).toBeNull()
    expect(toast.timesCooked).toBe(0)
  })

  it('returns an empty list when the folder does not exist', async () => {
    process.env.RECIPES_DIR = join(dir, 'nope')
    expect(await (await mod()).listRecipes()).toEqual([])
  })

  it('ignores a file that is not markdown', async () => {
    const { listRecipes } = await mod()
    writeFileSync(join(dir, 'notes.txt'), 'hello')
    expect(await listRecipes()).toEqual([])
  })
})
