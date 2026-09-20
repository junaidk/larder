import { describe, it, expect } from 'vitest'
import { convertAmount, roundForUnit, convertMethodText } from '@/lib/units/convert'

describe('convertAmount to imperial', () => {
  it.each([
    [500, 'g', 17.6, 'oz'],
    [1, 'kg', 2.2, 'lb'],
    [350, 'ml', 1.5, 'cup'],
    [1, 'l', 2.1, 'pint'],
    [20, 'cm', 8, 'inch'],
    [220, 'C', 425, 'F'],
  ])('turns %s %s into %s %s', (value, unit, expectedValue, expectedUnit) => {
    const got = convertAmount(value, unit, 'imperial')
    expect(got.unit).toBe(expectedUnit)
    expect(got.value).toBeCloseTo(expectedValue, 1)
  })

  it('promotes ounces to pounds above two pounds', () => {
    // 500 g is 17.6 oz and stays in ounces. 1 kg is 35.3 oz and becomes pounds.
    expect(convertAmount(500, 'g', 'imperial').unit).toBe('oz')
    expect(convertAmount(1000, 'g', 'imperial').unit).toBe('lb')
  })
})

describe('convertAmount to metric', () => {
  it.each([
    [8, 'oz', 227, 'g'],
    [1, 'lb', 454, 'g'],
    [1, 'cup', 240, 'ml'],
    [1, 'pint', 473, 'ml'],
    [8, 'inch', 20.5, 'cm'],
    [425, 'F', 220, 'C'],
    [350, 'F', 180, 'C'],
  ])('turns %s %s into %s %s', (value, unit, expectedValue, expectedUnit) => {
    const got = convertAmount(value, unit, 'metric')
    expect(got.unit).toBe(expectedUnit)
    expect(got.value).toBeCloseTo(expectedValue, 0)
  })

  it('promotes grams to kilograms above one thousand', () => {
    expect(convertAmount(3, 'lb', 'metric').unit).toBe('kg')
  })
})

describe('convertAmount leaves a unit alone', () => {
  it.each([
    [1, 'tsp'], [2, 'tbsp'], [3, 'clove'], [2, 'sprig'],
  ])('keeps %s %s in both systems', (value, unit) => {
    expect(convertAmount(value, unit, 'imperial')).toEqual({ value, unit })
    expect(convertAmount(value, unit, 'metric')).toEqual({ value, unit })
  })

  it('keeps a unit that is already in the target system', () => {
    expect(convertAmount(500, 'g', 'metric')).toEqual({ value: 500, unit: 'g' })
  })

  it('returns the input for a unit that it does not know', () => {
    expect(convertAmount(2, 'glug', 'imperial')).toEqual({ value: 2, unit: 'glug' })
  })
})

describe('convertMethodText', () => {
  it('turns a Celsius oven temperature into Fahrenheit', () => {
    expect(convertMethodText('Bake at 220C for 25 minutes.', 'imperial'))
      .toBe('Bake at 425F for 25 minutes.')
  })

  it('reads the degree sign', () => {
    expect(convertMethodText('Bake at 180°C.', 'imperial')).toBe('Bake at 350F.')
  })

  it('reads the word degrees', () => {
    expect(convertMethodText('Heat to 200 degrees C.', 'imperial')).toBe('Heat to 400F.')
  })

  it('turns Fahrenheit into Celsius', () => {
    expect(convertMethodText('Bake at 425F.', 'metric')).toBe('Bake at 220C.')
  })

  it('reads a gas mark as an input', () => {
    expect(convertMethodText('Bake at gas mark 7.', 'metric')).toBe('Bake at 220C.')
  })

  it('never writes a gas mark as an output', () => {
    expect(convertMethodText('Bake at 220C.', 'imperial')).not.toContain('gas')
  })

  it('leaves a time with no change', () => {
    expect(convertMethodText('Bake for 25 minutes.', 'imperial')).toBe('Bake for 25 minutes.')
  })

  it('leaves a temperature that is already in the target system', () => {
    expect(convertMethodText('Bake at 220C.', 'metric')).toBe('Bake at 220C.')
  })
})

describe('roundForUnit', () => {
  it.each([
    [17.63698, 'oz', 17.6],
    [453.59, 'g', 454],
    [4.7, 'g', 4.5],
    [1.4789, 'kg', 1.48],
    [0.26, 'cup', 0.25],
    [8.03, 'inch', 8],
  ])('rounds %s %s to %s', (value, unit, expected) => {
    expect(roundForUnit(value, unit)).toBeCloseTo(expected, 3)
  })
})
