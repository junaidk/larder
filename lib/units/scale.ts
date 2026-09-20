import { unitById } from '@/lib/units/table'
import { roundForUnit } from '@/lib/units/convert'
import { parseQuantity } from '@/lib/recipe/quantity'

/** Move to a larger unit when a scaled number grows. */
const PROMOTIONS: { from: string; to: string; at: number }[] = [
  { from: 'g', to: 'kg', at: 1000 },
  { from: 'ml', to: 'l', at: 1000 },
]

/**
 * Multiply an amount by a factor.
 * The unit stays in its own system. Scale never converts.
 */
export function scaleAmount(
  value: number,
  unitId: string | undefined,
  factor: number,
): { value: number; unit: string | undefined } {
  const scaled = value * factor
  if (!unitId) return { value: round(scaled), unit: undefined }

  const unit = unitById(unitId)
  if (!unit || unit.dimension === 'count') return { value: round(scaled), unit: unitId }

  const promotion = PROMOTIONS.find((p) => p.from === unitId && scaled >= p.at)
  if (promotion) {
    const target = unitById(promotion.to)!
    const converted = (scaled * unit.base) / target.base
    return { value: roundForUnit(converted, promotion.to), unit: promotion.to }
  }

  return { value: roundForUnit(scaled, unitId), unit: unitId }
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

export function factorForServings(base: number | null, wanted: number): number {
  if (!base || base <= 0 || !wanted || wanted <= 0) return 1
  return wanted / base
}

const MAX_FACTOR = 100

/** Read a factor from a text box. Accept `2`, `2x`, `x2`, `1/2` and `1 1/2`. */
export function parseFactor(text: string): number | null {
  const cleaned = text.trim().replace(/^x/i, '').replace(/x$/i, '').trim()
  const parsed = parseQuantity(cleaned)
  if (!parsed || parsed.rest.trim() !== '') return null
  const value = parsed.quantity.value
  if (!Number.isFinite(value) || value <= 0 || value > MAX_FACTOR) return null
  return value
}
