import { describe, it, expect } from 'vitest'
import { lookupUnit, unitById, displayUnit } from '@/lib/units/table'

describe('lookupUnit', () => {
  it.each([
    ['g', 'g'], ['gram', 'g'], ['grams', 'g'], ['G', 'g'],
    ['kg', 'kg'], ['kilogram', 'kg'],
    ['ml', 'ml'], ['millilitre', 'ml'], ['milliliter', 'ml'],
    ['l', 'l'], ['litre', 'l'], ['liter', 'l'],
    ['tsp', 'tsp'], ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
    ['tbsp', 'tbsp'], ['tablespoon', 'tbsp'], ['T', 'tbsp'],
    ['oz', 'oz'], ['ounce', 'oz'], ['ounces', 'oz'],
    ['lb', 'lb'], ['pound', 'lb'], ['lbs', 'lb'],
    ['cup', 'cup'], ['cups', 'cup'],
    ['clove', 'clove'], ['cloves', 'clove'],
    ['sprig', 'sprig'], ['sprigs', 'sprig'],
  ])('reads %s as the unit %s', (word, id) => {
    expect(lookupUnit(word)?.id).toBe(id)
  })

  it.each([['eggs'], ['flour'], ['lemon'], ['good'], ['']])(
    'returns null for the word %s',
    (word) => {
      expect(lookupUnit(word)).toBeNull()
    },
  )
})

describe('the unit definitions', () => {
  it('gives mass units a size in grams', () => {
    expect(unitById('kg')!.base).toBe(1000)
    expect(unitById('oz')!.base).toBeCloseTo(28.3495, 3)
    expect(unitById('lb')!.base).toBeCloseTo(453.592, 2)
  })

  it('gives volume units a size in millilitres', () => {
    expect(unitById('l')!.base).toBe(1000)
    expect(unitById('tsp')!.base).toBe(5)
    expect(unitById('tbsp')!.base).toBe(15)
    expect(unitById('cup')!.base).toBe(240)
  })

  it('marks spoons as usable in both systems', () => {
    expect(unitById('tsp')!.system).toBe('both')
    expect(unitById('tbsp')!.system).toBe('both')
  })

  it('marks a count unit with the count dimension', () => {
    expect(unitById('clove')!.dimension).toBe('count')
  })
})

describe('displayUnit', () => {
  it('uses the plural form for a value above one', () => {
    expect(displayUnit('clove', 3)).toBe('cloves')
    expect(displayUnit('cup', 2)).toBe('cups')
  })

  it('uses the singular form for one', () => {
    expect(displayUnit('clove', 1)).toBe('clove')
  })

  it('never pluralises a symbol', () => {
    expect(displayUnit('g', 500)).toBe('g')
    expect(displayUnit('ml', 350)).toBe('ml')
  })
})
