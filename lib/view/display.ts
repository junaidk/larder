import type { Ingredient } from '@/lib/recipe/types'
import type { UnitSystem } from '@/lib/units/convert'
import { convertAmount } from '@/lib/units/convert'
import { scaleAmount } from '@/lib/units/scale'
import { displayUnit } from '@/lib/units/table'
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
 * Build the text for one ingredient on the screen.
 * A text line always comes back with no change.
 */
export function displayIngredient(ingredient: Ingredient, options: ViewOptions): string {
  const source = ingredientText(ingredient.rawLine)
  if (ingredient.kind === 'text' || !ingredient.quantity) return source

  const low = transform(ingredient.quantity.value, ingredient.unit, options)

  let amount = formatDisplayAmount(low.value)
  if (ingredient.quantity.max !== undefined) {
    const high = transform(ingredient.quantity.max, ingredient.unit, options)
    amount = `${amount}-${formatDisplayAmount(high.value)}`
  }

  const unitWord = low.unit ? displayUnit(low.unit, low.value) : ''
  const parts = [amount, unitWord, ingredient.item].filter(Boolean)
  const head = parts.join(' ')
  return ingredient.prep ? `${head}, ${ingredient.prep}` : head
}
