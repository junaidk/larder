import { unitById } from '@/lib/units/table'

export type UnitSystem = 'metric' | 'imperial'

/** The unit that each dimension uses as its first choice, per system. */
const PREFERRED: Record<string, Record<UnitSystem, string>> = {
  mass: { metric: 'g', imperial: 'oz' },
  volume: { metric: 'ml', imperial: 'floz' },
  length: { metric: 'cm', imperial: 'inch' },
  temperature: { metric: 'C', imperial: 'F' },
}

/** Move to a larger unit when the number grows. */
const PROMOTIONS: { from: string; to: string; at: number }[] = [
  { from: 'g', to: 'kg', at: 1000 },
  { from: 'ml', to: 'l', at: 1000 },
  { from: 'oz', to: 'lb', at: 32 },
  { from: 'floz', to: 'cup', at: 8 },
  { from: 'cup', to: 'pint', at: 2 },
]

/** Round to a step that a cook can act on. */
const STEPS: Record<string, number> = {
  g: 1, kg: 0.01, ml: 1, l: 0.01,
  oz: 0.1, lb: 0.1, floz: 0.1,
  cup: 0.125, pint: 0.125, tsp: 0.125, tbsp: 0.125,
  cm: 0.5, inch: 0.5,
  C: 10, F: 25,
}

export function roundForUnit(value: number, unitId: string): number {
  let step = STEPS[unitId] ?? 0.1
  // Below ten grams or millilitres a whole number is too coarse.
  if ((unitId === 'g' || unitId === 'ml') && Math.abs(value) < 10) step = 0.5
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(6))
}

function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32
}

function fahrenheitToCelsius(f: number): number {
  return (f - 32) * 5 / 9
}

/**
 * Convert an amount into the target system.
 * A unit of the `both` system, a count unit and an unknown unit come
 * back with no change.
 */
export function convertAmount(
  value: number,
  unitId: string,
  target: UnitSystem,
): { value: number; unit: string } {
  const unit = unitById(unitId)
  if (!unit) return { value, unit: unitId }
  if (unit.system === 'both' || unit.dimension === 'count') return { value, unit: unitId }

  if (unit.system === target) {
    // Already the right system. Still promote to a larger unit when the
    // number has grown past a threshold, so an imperial recipe promotes
    // oz to lb, floz to cup and cup to pint even with no system change.
    const inBase = value * unit.base
    let id = unitId
    let out = value
    for (const promotion of PROMOTIONS) {
      if (promotion.from === id && out >= promotion.at) {
        id = promotion.to
        out = inBase / unitById(id)!.base
      }
    }
    return { value: roundForUnit(out, id), unit: id }
  }

  if (unit.dimension === 'temperature') {
    const raw = target === 'imperial' ? celsiusToFahrenheit(value) : fahrenheitToCelsius(value)
    const id = target === 'imperial' ? 'F' : 'C'
    return { value: roundForUnit(raw, id), unit: id }
  }

  const preferred = PREFERRED[unit.dimension]?.[target]
  if (!preferred) return { value, unit: unitId }

  const inBase = value * unit.base
  let id = preferred
  let out = inBase / unitById(id)!.base

  for (const promotion of PROMOTIONS) {
    if (promotion.from === id && out >= promotion.at) {
      id = promotion.to
      out = inBase / unitById(id)!.base
    }
  }

  return { value: roundForUnit(out, id), unit: id }
}

const GAS_MARKS: Record<string, number> = {
  '1': 140, '2': 150, '3': 170, '4': 180,
  '5': 190, '6': 200, '7': 220, '8': 230, '9': 240,
}

const TEMPERATURE_RE = /(\d{2,3})\s*(?:°\s*([CF])\b|°(?![CF])|\s*degrees?\s*([CF])?\b|([CF])\b)/gi
const GAS_RE = /gas\s*mark\s*([1-9])/gi

// A plausible oven range. A number outside it is prose, not a temperature.
const OVEN_RANGE_C: [number, number] = [50, 300]
const OVEN_RANGE_F: [number, number] = [120, 600]

/**
 * Rewrite oven temperatures in the method text.
 * The function reads C, F and a gas mark. It writes C or F only.
 */
export function convertMethodText(text: string, target: UnitSystem): string {
  const withGas = text.replace(GAS_RE, (whole, mark: string) => {
    const celsius = GAS_MARKS[mark]
    if (celsius === undefined) return whole
    return target === 'metric'
      ? `${celsius}C`
      : `${roundForUnit(celsiusToFahrenheit(celsius), 'F')}F`
  })

  return withGas.replace(TEMPERATURE_RE, (whole, digits: string, a?: string, b?: string, c?: string) => {
    const letter = (a ?? b ?? c ?? '').toUpperCase()
    // A number with no C or F is not a temperature. Leave it alone.
    if (letter !== 'C' && letter !== 'F') return whole
    const source = letter as 'C' | 'F'
    const value = Number(digits)
    const [min, max] = source === 'C' ? OVEN_RANGE_C : OVEN_RANGE_F
    // A number outside the plausible oven range is ordinary prose, not a
    // temperature. Example: "Add 30 F flour" or "Cut into 25 C shapes".
    if (value < min || value > max) return whole
    const wanted = target === 'imperial' ? 'F' : 'C'
    if (source === wanted) return whole
    const raw = source === 'C'
      ? celsiusToFahrenheit(Number(digits))
      : fahrenheitToCelsius(Number(digits))
    return `${roundForUnit(raw, wanted)}${wanted}`
  })
}
