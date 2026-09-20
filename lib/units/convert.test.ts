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

  it('keeps a temperature that is already in the target system', () => {
    // The rounding step for C is 10. A round here would show 215C as 220C.
    expect(convertAmount(215, 'C', 'metric')).toEqual({ value: 215, unit: 'C' })
    expect(convertAmount(415, 'F', 'imperial')).toEqual({ value: 415, unit: 'F' })
  })
})

describe('convertAmount promotes within a system that already matches the target', () => {
  it('promotes ounces to pounds when already viewed in imperial', () => {
    // 16 oz x 3 = 48 oz. It must promote to lb even though oz was already
    // the imperial unit, because convertAmount used to return it early.
    expect(convertAmount(48, 'oz', 'imperial')).toEqual({ value: 3, unit: 'lb' })
  })

  it('promotes fluid ounces to cups when already viewed in imperial', () => {
    // 6 floz x 2 = 12 floz, which is 1.5 cup.
    expect(convertAmount(12, 'floz', 'imperial')).toEqual({ value: 1.5, unit: 'cup' })
  })

  it('promotes cups to pints when already viewed in imperial', () => {
    // 2 cups x 2 = 4 cups, which is 2 pints.
    expect(convertAmount(4, 'cup', 'imperial')).toEqual({ value: 2, unit: 'pint' })
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

  it('leaves a number outside the oven range alone, converting to metric', () => {
    // 30 is far below a plausible oven temperature in Fahrenheit. It is
    // ordinary prose, not a temperature.
    expect(convertMethodText('Add 30 F flour', 'metric')).toBe('Add 30 F flour')
  })

  it('leaves a number outside the oven range alone, converting to imperial', () => {
    // 25 is far below a plausible oven temperature in Celsius.
    expect(convertMethodText('Cut into 25 C shapes', 'imperial')).toBe('Cut into 25 C shapes')
  })

  it('still converts a bare form inside the oven range with a space before the letter', () => {
    expect(convertMethodText('Bake at 200 C.', 'imperial')).toBe('Bake at 400F.')
  })

  it('still converts the bare form with no space', () => {
    expect(convertMethodText('Bake at 220C.', 'imperial')).toBe('Bake at 425F.')
  })

  it('still converts the degree sign form', () => {
    expect(convertMethodText('Bake at 180°C.', 'imperial')).toBe('Bake at 350F.')
  })

  it('still converts the word degrees form', () => {
    expect(convertMethodText('Preheat the oven to 180 degrees C.', 'imperial'))
      .toBe('Preheat the oven to 350F.')
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
