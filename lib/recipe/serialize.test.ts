import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe, formatStars, formatLogEntry } from '@/lib/recipe/serialize'
import { emptyFrontmatter } from '@/lib/recipe/types'

const DIR = join(process.cwd(), 'lib/recipe/fixtures')
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.md'))

describe('the round trip', () => {
  it('finds all seven fixtures', () => {
    expect(FILES).toHaveLength(7)
  })

  it.each(FILES)('returns %s byte for byte', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8')
    const output = serializeRecipe(parseRecipe(source, 'fixture'))
    expect(output).toBe(source)
  })
})

describe('formatStars', () => {
  it.each([
    [5, '★★★★★'],
    [4, '★★★★☆'],
    [1, '★☆☆☆☆'],
    [null, ''],
  ])('shows %s as %s', (rating, expected) => {
    expect(formatStars(rating)).toBe(expected)
  })
})

describe('formatLogEntry', () => {
  it('writes a heading with a date and a rating', () => {
    const text = formatLogEntry({ date: '2026-09-14', rating: 4, note: 'Too salty.' })
    expect(text).toBe('### 2026-09-14 — ★★★★☆\n\nToo salty.')
  })

  it('writes a heading with no rating', () => {
    const text = formatLogEntry({ date: '2026-09-14', rating: null, note: 'Fine.' })
    expect(text).toBe('### 2026-09-14\n\nFine.')
  })
})

describe('serializeRecipe', () => {
  it('keeps the blank line that follows a heading', () => {
    const source = '## Method\n\n1. Go.\n'
    expect(serializeRecipe(parseRecipe(source, 'x'))).toBe(source)
  })

  it('keeps a heading that has an empty body', () => {
    const source = '## Notes\n'
    expect(serializeRecipe(parseRecipe(source, 'x'))).toBe(source)
  })

  it('writes a recipe that has no blocks', () => {
    const recipe = {
      slug: 'x',
      eol: '\n' as const,
      endsWithNewline: true,
      frontmatter: emptyFrontmatter('X'),
      frontmatterRaw: 'title: X',
      blocks: [],
    }
    expect(serializeRecipe(recipe)).toBe('---\ntitle: X\n---\n')
  })
})
