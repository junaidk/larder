import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '@/lib/recipe/frontmatter'
import { emptyFrontmatter } from '@/lib/recipe/types'

describe('parseFrontmatter', () => {
  it('reads every known field', () => {
    const fm = parseFrontmatter([
      'title: Focaccia',
      'tags: [bread, italian]',
      'serves: 8',
      'prep_time: 20m',
      'cook_time: 25m',
      'source: https://example.com/focaccia',
      'created: 2026-09-20',
      'updated: 2026-09-20',
    ].join('\n'))

    expect(fm.title).toBe('Focaccia')
    expect(fm.tags).toEqual(['bread', 'italian'])
    expect(fm.serves).toBe(8)
    expect(fm.prep_time).toBe('20m')
    expect(fm.cook_time).toBe('25m')
    expect(fm.source).toBe('https://example.com/focaccia')
    expect(fm.created).toBe('2026-09-20')
    expect(fm.extra).toEqual({})
  })

  it('keeps a key that the app does not know', () => {
    const fm = parseFrontmatter('title: X\ncuisine: thai\n')
    expect(fm.extra).toEqual({ cuisine: 'thai' })
  })

  it('reads a single tag written as a string', () => {
    expect(parseFrontmatter('title: X\ntags: bread\n').tags).toEqual(['bread'])
  })

  it('gives an empty title when the field is missing', () => {
    expect(parseFrontmatter('serves: 4\n').title).toBe('')
  })

  it('gives null for a missing optional field', () => {
    const fm = parseFrontmatter('title: X\n')
    expect(fm.serves).toBeNull()
    expect(fm.cook_time).toBeNull()
  })

  it('reads a date value as a string in the form YYYY-MM-DD', () => {
    expect(parseFrontmatter('title: X\ncreated: 2026-09-20\n').created).toBe('2026-09-20')
  })
})

describe('serializeFrontmatter', () => {
  it('writes the known fields in a fixed order and drops empty ones', () => {
    const fm = emptyFrontmatter('Focaccia')
    fm.tags = ['bread', 'italian']
    fm.serves = 8
    expect(serializeFrontmatter(fm)).toBe(
      'title: Focaccia\ntags: [bread, italian]\nserves: 8\n',
    )
  })

  it('writes an unknown key after the known keys', () => {
    const fm = emptyFrontmatter('X')
    fm.extra = { cuisine: 'thai' }
    expect(serializeFrontmatter(fm)).toBe('title: X\ncuisine: thai\n')
  })

  it('quotes a title that would confuse YAML', () => {
    const fm = emptyFrontmatter('Soup: the good kind')
    expect(serializeFrontmatter(fm)).toBe('title: "Soup: the good kind"\n')
  })

  it('makes a round trip for a full block', () => {
    const text = 'title: Focaccia\ntags: [bread, italian]\nserves: 8\nprep_time: 20m\n'
    expect(serializeFrontmatter(parseFrontmatter(text))).toBe(text)
  })
})
