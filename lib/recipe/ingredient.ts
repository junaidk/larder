import type { Ingredient } from '@/lib/recipe/types'
import { parseQuantity } from '@/lib/recipe/quantity'
import { lookupUnit } from '@/lib/units/table'

const MARKER = /^\s*[-*+]\s+/

/** Remove a markdown list marker from the start of a line. */
export function ingredientText(line: string): string {
  return line.replace(MARKER, '').trim()
}

/**
 * Read one ingredient line.
 * The result always keeps `rawLine`, so the serializer can write the
 * line back without a change.
 */
export function parseIngredientLine(rawLine: string): Ingredient {
  const text = ingredientText(rawLine)
  const head = parseQuantity(text)

  if (!head) return { rawLine, kind: 'text' }

  // Split the prep off first. Only the text before the first comma
  // can hold a unit or an item.
  const commaAt = head.rest.indexOf(',')
  const body = commaAt === -1 ? head.rest : head.rest.slice(0, commaAt)
  const prep = commaAt === -1 ? undefined : head.rest.slice(commaAt + 1).trim()

  const words = body.trim().split(/\s+/).filter(Boolean)
  const unitDef = words.length > 0 ? lookupUnit(words[0]) : null

  const unitRaw = unitDef ? words[0] : undefined
  const item = (unitDef ? words.slice(1) : words).join(' ')

  const measured = unitDef !== null && unitDef.dimension !== 'count'

  const result: Ingredient = {
    rawLine,
    kind: measured ? 'measured' : 'counted',
    quantity: head.quantity,
    item,
  }
  if (unitDef) {
    result.unit = unitDef.id
    result.unitRaw = unitRaw
  }
  if (prep) result.prep = prep
  return result
}
