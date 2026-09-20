import { describe, it, expect } from 'vitest'
import { displayIngredient, displayIngredientParts, DEFAULT_VIEW } from '@/lib/view/display'
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
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, view('imperial', 1))).toBe('17.6 oz strong white flour')
  })

  it('keeps one decimal place for a converted ounce amount of 10 or more', () => {
    // 300 g converts to 10.6 oz. The display must not round this to a
    // whole number, and 0.6 is not close to a tidy fraction either.
    const line = parseIngredientLine('- 300 g strong white flour')
    expect(displayIngredient(line, view('imperial', 1))).toBe('10.6 oz strong white flour')
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

describe('displayIngredient reconciles a range onto one unit', () => {
  it('keeps both ends in the same unit when neither end promotes', () => {
    const line = parseIngredientLine('- 2-3 sprigs thyme')
    expect(displayIngredient(line, view('metric', 2))).toBe('4-6 sprigs thyme')
  })

  it('reports a metric range in the high end unit when it crosses the kg boundary', () => {
    // The low end (900 g) stays in grams on its own; the high end (1100 g)
    // promotes to kilograms. Both ends must read in kilograms.
    const line = parseIngredientLine('- 900-1100 g flour')
    expect(displayIngredient(line, view('metric', 1))).toBe('0.9-1.1 kg flour')
  })

  it('reports an imperial range in the high end unit after conversion crosses the lb boundary', () => {
    // 850 g converts to 30 oz on its own. 970 g converts to 2.1 lb.
    // The low end must be re-expressed in pounds, not left in ounces.
    const line = parseIngredientLine('- 850-970 g flour')
    expect(displayIngredient(line, view('imperial', 1))).toBe('1.9-2.1 lb flour')
  })
})

describe('displayIngredientParts', () => {
  it('splits a measured line into its parts', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredientParts(line, DEFAULT_VIEW)).toEqual({
      amount: '500', unit: 'g', item: 'strong white flour', prep: '', text: '',
    })
  })

  it('keeps the prep apart', () => {
    const line = parseIngredientLine('- 3 cloves garlic, minced')
    expect(displayIngredientParts(line, view('metric', 2))).toEqual({
      amount: '6', unit: 'cloves', item: 'garlic', prep: 'minced', text: '',
    })
  })

  it('gives a counted line an empty unit', () => {
    const line = parseIngredientLine('- 2 eggs')
    expect(displayIngredientParts(line, DEFAULT_VIEW)).toEqual({
      amount: '2', unit: '', item: 'eggs', prep: '', text: '',
    })
  })

  it('returns a text line whole, in text', () => {
    const line = parseIngredientLine('- a good pinch of sea salt')
    expect(displayIngredientParts(line, view('imperial', 2))).toEqual({
      amount: '', unit: '', item: '', prep: '', text: 'a good pinch of sea salt',
    })
  })

  it('scales and converts the amount, as the joined form does', () => {
    const line = parseIngredientLine('- 500 g flour')
    const parts = displayIngredientParts(line, view('imperial', 2))
    expect(parts.amount).toBe('2.2')
    expect(parts.unit).toBe('lb')
  })

  it('agrees with displayIngredient on every shape', () => {
    const lines = [
      '- 500 g strong white flour', '- 3 cloves garlic, minced', '- 2 eggs',
      '- a good pinch of sea salt', '- 2-3 sprigs thyme', '- 1 tsp fine salt',
      '- ½ lemon, juiced',
    ]
    const views = [DEFAULT_VIEW, view('imperial', 1), view('metric', 0.5), view('imperial', 3)]
    for (const raw of lines) {
      for (const v of views) {
        const ing = parseIngredientLine(raw)
        const p = displayIngredientParts(ing, v)
        const joined = p.text
          ? p.text
          : [[p.amount, p.unit, p.item].filter(Boolean).join(' '), p.prep]
              .filter(Boolean).join(', ')
        expect(joined).toBe(displayIngredient(ing, v))
      }
    }
  })
})
