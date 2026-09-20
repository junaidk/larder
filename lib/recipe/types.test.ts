import { describe, it, expect } from 'vitest'
import type { Recipe } from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'

describe('types module', () => {
  it('gives an empty frontmatter with the required title field', () => {
    const fm = emptyFrontmatter('Focaccia')
    expect(fm.title).toBe('Focaccia')
    expect(fm.tags).toEqual([])
    expect(fm.serves).toBeNull()
    expect(fm.extra).toEqual({})
  })

  it('builds a Recipe value that type checks', () => {
    const recipe: Recipe = {
      slug: 'focaccia',
      eol: '\n',
      endsWithNewline: true,
      frontmatter: emptyFrontmatter('Focaccia'),
      frontmatterRaw: null,
      blocks: [],
    }
    expect(recipe.slug).toBe('focaccia')
  })
})
