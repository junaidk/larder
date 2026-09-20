import { describe, it, expect } from 'vitest'
import { scaleAmount, factorForServings, parseFactor } from '@/lib/units/scale'

describe('scaleAmount', () => {
  it('multiplies a measured amount', () => {
    expect(scaleAmount(500, 'g', 2)).toEqual({ value: 1, unit: 'kg' })
  })

  it('promotes grams to kilograms at one thousand', () => {
    expect(scaleAmount(500, 'g', 3)).toEqual({ value: 1.5, unit: 'kg' })
  })

  it('promotes millilitres to litres at one thousand', () => {
    expect(scaleAmount(350, 'ml', 4)).toEqual({ value: 1.4, unit: 'l' })
  })

  it('keeps a small amount in the small unit', () => {
    expect(scaleAmount(500, 'g', 1.5)).toEqual({ value: 750, unit: 'g' })
  })

  it('halves a spoon amount', () => {
    expect(scaleAmount(1, 'tsp', 0.5)).toEqual({ value: 0.5, unit: 'tsp' })
  })

  it('scales a count with no unit', () => {
    expect(scaleAmount(3, undefined, 0.5)).toEqual({ value: 1.5, unit: undefined })
  })

  it('scales a count unit and never converts it', () => {
    expect(scaleAmount(3, 'clove', 2)).toEqual({ value: 6, unit: 'clove' })
  })

  it('returns the input for a factor of one', () => {
    expect(scaleAmount(500, 'g', 1)).toEqual({ value: 500, unit: 'g' })
  })
})

describe('factorForServings', () => {
  it('divides the wanted count by the base count', () => {
    expect(factorForServings(8, 4)).toBe(0.5)
    expect(factorForServings(4, 6)).toBe(1.5)
  })

  it('returns one when the recipe has no serves field', () => {
    expect(factorForServings(null, 4)).toBe(1)
  })

  it('returns one for a base of zero', () => {
    expect(factorForServings(0, 4)).toBe(1)
  })
})

describe('parseFactor', () => {
  it.each([
    ['2', 2], ['0.5', 0.5], ['1/2', 0.5], ['1 1/2', 1.5],
    ['2x', 2], ['x2', 2], ['½', 0.5],
  ])('reads %s as %s', (text, expected) => {
    expect(parseFactor(text)).toBeCloseTo(expected, 6)
  })

  it.each([['0'], ['-1'], ['abc'], ['']])('returns null for %s', (text) => {
    expect(parseFactor(text)).toBeNull()
  })

  it('refuses a factor above one hundred', () => {
    expect(parseFactor('1000')).toBeNull()
  })
})
