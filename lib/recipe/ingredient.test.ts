import { describe, it, expect } from 'vitest'
import { parseIngredientLine, ingredientText } from '@/lib/recipe/ingredient'

describe('ingredientText', () => {
  it.each([
    ['- 500 g flour', '500 g flour'],
    ['* 500 g flour', '500 g flour'],
    ['  - 500 g flour', '500 g flour'],
    ['500 g flour', '500 g flour'],
  ])('strips the list marker from %s', (line, expected) => {
    expect(ingredientText(line)).toBe(expected)
  })
})

describe('parseIngredientLine', () => {
  it('reads a measured line', () => {
    const got = parseIngredientLine('- 500 g strong white flour')
    expect(got.kind).toBe('measured')
    expect(got.quantity!.value).toBe(500)
    expect(got.unit).toBe('g')
    expect(got.unitRaw).toBe('g')
    expect(got.item).toBe('strong white flour')
    expect(got.prep).toBeUndefined()
    expect(got.rawLine).toBe('- 500 g strong white flour')
  })

  it('keeps the unit exactly as the user typed it', () => {
    const got = parseIngredientLine('- 350 millilitres warm water')
    expect(got.unit).toBe('ml')
    expect(got.unitRaw).toBe('millilitres')
  })

  it('reads a counted line that has a count unit', () => {
    const got = parseIngredientLine('- 3 cloves garlic, minced')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(3)
    expect(got.unit).toBe('clove')
    expect(got.item).toBe('garlic')
    expect(got.prep).toBe('minced')
  })

  it('reads a counted line that has no unit', () => {
    const got = parseIngredientLine('- 2 eggs')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(2)
    expect(got.unit).toBeUndefined()
    expect(got.item).toBe('eggs')
  })

  it('reads a mixed fraction with a unit', () => {
    const got = parseIngredientLine('- 1 1/2 tbsp olive oil')
    expect(got.kind).toBe('measured')
    expect(got.quantity!.value).toBeCloseTo(1.5, 6)
    expect(got.unit).toBe('tbsp')
    expect(got.item).toBe('olive oil')
  })

  it('reads a unicode fraction with no unit and a prep note', () => {
    const got = parseIngredientLine('- ½ lemon, juiced')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBeCloseTo(0.5, 6)
    expect(got.unit).toBeUndefined()
    expect(got.item).toBe('lemon')
    expect(got.prep).toBe('juiced')
  })

  it('reads a range as a counted line', () => {
    const got = parseIngredientLine('- 2-3 sprigs thyme')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(2)
    expect(got.quantity!.max).toBe(3)
    expect(got.unit).toBe('sprig')
    expect(got.item).toBe('thyme')
  })

  it('reads a line with no quantity as text', () => {
    const got = parseIngredientLine('- a good pinch of sea salt')
    expect(got.kind).toBe('text')
    expect(got.quantity).toBeUndefined()
    expect(got.unit).toBeUndefined()
    expect(got.item).toBeUndefined()
    expect(got.rawLine).toBe('- a good pinch of sea salt')
  })

  it('keeps a quantity with no item as counted', () => {
    const got = parseIngredientLine('- 2')
    expect(got.kind).toBe('counted')
    expect(got.item).toBe('')
  })

  it('reads the bare letter c as cups, not Celsius', () => {
    const got = parseIngredientLine('- 2 c plain flour')
    expect(got.unit).toBe('cup')
  })
})
