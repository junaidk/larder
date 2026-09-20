import type { Ingredient } from '@/lib/recipe/types'
import type { UnitSystem } from '@/lib/units/convert'
import { convertAmount, roundForUnit } from '@/lib/units/convert'
import { scaleAmount } from '@/lib/units/scale'
import { displayUnit, unitById } from '@/lib/units/table'
import { ingredientText } from '@/lib/recipe/ingredient'

const DENOMINATORS = [2, 3, 4, 8]
const TOLERANCE = 0.012

/**
 * Show a number whose precision `roundForUnit` or `scaleAmount` already
 * fixed. A part close to a half, third, quarter or eighth becomes a tidy
 * mixed fraction. Anything else prints as-is, with a trailing zero trimmed.
 * This is a display-only concern: it does not change or re-round the value.
 */
function formatDisplayAmount(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const whole = Math.floor(abs)
  const part = abs - whole

  for (const d of DENOMINATORS) {
    const top = Math.round(part * d)
    if (top > 0 && top < d && Math.abs(part - top / d) < TOLERANCE) {
      const fraction = `${top}/${d}`
      return whole === 0 ? sign + fraction : `${sign}${whole} ${fraction}`
    }
  }

  const trimmed = abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return sign + trimmed
}

export interface ViewOptions {
  system: UnitSystem
  factor: number
}

export const DEFAULT_VIEW: ViewOptions = { system: 'metric', factor: 1 }

/** Scale one number, then convert it. The order matters for promotion. */
function transform(
  value: number,
  unitId: string | undefined,
  options: ViewOptions,
): { value: number; unit: string | undefined } {
  const scaled = scaleAmount(value, unitId, options.factor)
  if (!scaled.unit) return scaled
  const converted = convertAmount(scaled.value, scaled.unit, options.system)
  return { value: converted.value, unit: converted.unit }
}

/**
 * Re-express a value in another unit of the same dimension, through the
 * unit table's base factors, then round it for that unit.
 */
function reexpress(value: number, fromUnit: string, toUnit: string): number {
  const from = unitById(fromUnit)
  const to = unitById(toUnit)
  if (!from || !to) return value
  return roundForUnit((value * from.base) / to.base, toUnit)
}

/** The parts of one ingredient, ready to style each on its own. */
export interface IngredientParts {
  amount: string
  unit: string
  item: string
  prep: string
  /** Set only for a line the parser could not read. The other parts are then empty. */
  text: string
}

const EMPTY: IngredientParts = { amount: '', unit: '', item: '', prep: '', text: '' }

/**
 * Split one ingredient into its display parts.
 * A line the parser could not read comes back whole, in `text`, with no change.
 */
export function displayIngredientParts(
  ingredient: Ingredient,
  options: ViewOptions,
): IngredientParts {
  const source = ingredientText(ingredient.rawLine)
  if (ingredient.kind === 'text' || !ingredient.quantity) return { ...EMPTY, text: source }

  const low = transform(ingredient.quantity.value, ingredient.unit, options)

  let amount: string
  let unitId = low.unit
  let pluralValue = low.value

  if (ingredient.quantity.max !== undefined) {
    const high = transform(ingredient.quantity.max, ingredient.unit, options)
    // Each end is scaled and converted on its own, so a promotion can move
    // one end but not the other. Report both ends in the HIGH end's unit -
    // the more promoted of the two - so the range never mixes units.
    unitId = high.unit
    pluralValue = high.value
    const lowValue =
      low.unit && high.unit && low.unit !== high.unit
        ? reexpress(low.value, low.unit, high.unit)
        : low.value
    amount = `${formatDisplayAmount(lowValue)}-${formatDisplayAmount(high.value)}`
  } else {
    amount = formatDisplayAmount(low.value)
  }

  return {
    amount,
    unit: unitId ? displayUnit(unitId, pluralValue) : '',
    item: ingredient.item ?? '',
    prep: ingredient.prep ?? '',
    text: '',
  }
}

/**
 * Build the text for one ingredient on the screen.
 * A text line always comes back with no change.
 */
export function displayIngredient(ingredient: Ingredient, options: ViewOptions): string {
  const p = displayIngredientParts(ingredient, options)
  if (p.text) return p.text
  const head = [p.amount, p.unit, p.item].filter(Boolean).join(' ')
  return p.prep ? `${head}, ${p.prep}` : head
}
