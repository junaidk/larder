import { describe, it, expect } from 'vitest'
import { displayIngredient, DEFAULT_VIEW } from '@/lib/view/display'
import { parseIngredientLine } from '@/lib/recipe/ingredient'

const view = (system: 'metric' | 'imperial', factor: number) => ({ system, factor })

describe('displayIngredient', () => {
  it('shows a measured line with no change at the default view', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, DEFAULT_VIEW)).toBe('500 g strong white flour')
  })

  it('never changes a text line', () => {
    const line = parseIngredientLine('- a good pinch of sea salt')
    expect(displayIngredient(line, view('imperial', 2))).toBe('a good pinch of sea salt')
  })

  it('scales a measured line', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, view('metric', 2))).toBe('1 kg strong white flour')
  })

  it('converts a measured line', () => {
    // 500 g converts to 17.6 oz (see convert.test.ts). formatNumber shows a
    // value of 10 or more as a whole number, so the display rounds to 18.
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, view('imperial', 1))).toBe('18 oz strong white flour')
  })

  it('scales and then converts', () => {
    const line = parseIngredientLine('- 500 g flour')
    expect(displayIngredient(line, view('imperial', 2))).toBe('2.2 lb flour')
  })

  it('shows a halved spoon as a fraction', () => {
    const line = parseIngredientLine('- 1 tsp fine salt')
    expect(displayIngredient(line, view('metric', 0.5))).toBe('1/2 tsp fine salt')
  })

  it('keeps a count as a fraction', () => {
    const line = parseIngredientLine('- 3 eggs')
    expect(displayIngredient(line, view('metric', 0.5))).toBe('1 1/2 eggs')
  })

  it('uses the plural form of a count unit', () => {
    const line = parseIngredientLine('- 1 clove garlic')
    expect(displayIngredient(line, view('metric', 3))).toBe('3 cloves garlic')
  })

  it('keeps the prep note', () => {
    const line = parseIngredientLine('- 3 cloves garlic, minced')
    expect(displayIngredient(line, view('metric', 2))).toBe('6 cloves garlic, minced')
  })

  it('scales both ends of a range', () => {
    const line = parseIngredientLine('- 2-3 sprigs thyme')
    expect(displayIngredient(line, view('metric', 2))).toBe('4-6 sprigs thyme')
  })
})
