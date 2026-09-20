import { describe, it, expect } from 'vitest'
import { parseQuantity, formatNumber, formatQuantity } from '@/lib/recipe/quantity'

describe('parseQuantity', () => {
  const cases: [string, number, number | undefined, string, string][] = [
    // input,        value, max,       raw,     rest
    ['500 g flour',   500,  undefined, '500',   'g flour'],
    ['1.5 tbsp oil',  1.5,  undefined, '1.5',   'tbsp oil'],
    ['1/2 lemon',     0.5,  undefined, '1/2',   'lemon'],
    ['1 1/2 tbsp x',  1.5,  undefined, '1 1/2', 'tbsp x'],
    ['½ lemon',       0.5,  undefined, '½',     'lemon'],
    ['1½ cups milk',  1.5,  undefined, '1½',    'cups milk'],
    ['2-3 sprigs',    2,    3,         '2-3',   'sprigs'],
    ['2 eggs',        2,    undefined, '2',     'eggs'],
  ]

  it.each(cases)('reads %s', (input, value, max, raw, rest) => {
    const got = parseQuantity(input)
    expect(got).not.toBeNull()
    expect(got!.quantity.value).toBeCloseTo(value, 6)
    expect(got!.quantity.max).toBe(max)
    expect(got!.quantity.raw).toBe(raw)
    expect(got!.rest).toBe(rest)
  })

  it.each([
    ['a good pinch of sea salt'],
    ['salt to taste'],
    [''],
    ['-'],
  ])('returns null for %s', (input) => {
    expect(parseQuantity(input)).toBeNull()
  })
})

describe('formatNumber', () => {
  const cases: [number, string][] = [
    [1, '1'],
    [0.5, '1/2'],
    [1.5, '1 1/2'],
    [0.25, '1/4'],
    [0.75, '3/4'],
    [0.125, '1/8'],
    [2.375, '2 3/8'],
    [1 / 3, '1/3'],
    [2 / 3, '2/3'],
    [500, '500'],
    [1.5789, '1.6'],
    [0.07, '0.07'],
  ]

  it.each(cases)('formats %s as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})

describe('formatQuantity', () => {
  it('joins a range with a hyphen', () => {
    expect(formatQuantity({ value: 2, max: 3, raw: '2-3' })).toBe('2-3')
  })

  it('formats a single value as a fraction', () => {
    expect(formatQuantity({ value: 1.5, raw: '1.5' })).toBe('1 1/2')
  })
})
