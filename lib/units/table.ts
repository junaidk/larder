import type { Dimension, System } from '@/lib/recipe/types'

export interface UnitDef {
  id: string
  dimension: Dimension
  system: System
  /** The size of one unit in the base unit: g, ml, C or cm. */
  base: number
  aliases: string[]
  /** The plural display form. A symbol has no plural. */
  plural?: string
}

export const UNITS: UnitDef[] = [
  // mass
  { id: 'g', dimension: 'mass', system: 'metric', base: 1, aliases: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'] },
  { id: 'kg', dimension: 'mass', system: 'metric', base: 1000, aliases: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'] },
  { id: 'oz', dimension: 'mass', system: 'imperial', base: 28.349523125, aliases: ['oz', 'ounce', 'ounces'] },
  { id: 'lb', dimension: 'mass', system: 'imperial', base: 453.59237, aliases: ['lb', 'lbs', 'pound', 'pounds'] },

  // volume
  { id: 'ml', dimension: 'volume', system: 'metric', base: 1, aliases: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'] },
  { id: 'l', dimension: 'volume', system: 'metric', base: 1000, aliases: ['l', 'litre', 'litres', 'liter', 'liters'] },
  { id: 'tsp', dimension: 'volume', system: 'both', base: 5, aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'], plural: 'tsp' },
  { id: 'tbsp', dimension: 'volume', system: 'both', base: 15, aliases: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'T'], plural: 'tbsp' },
  { id: 'floz', dimension: 'volume', system: 'imperial', base: 29.5735295625, aliases: ['floz', 'fl oz', 'fluid ounce', 'fluid ounces'] },
  { id: 'cup', dimension: 'volume', system: 'imperial', base: 240, aliases: ['cup', 'cups'], plural: 'cups' },
  { id: 'pint', dimension: 'volume', system: 'imperial', base: 473.176473, aliases: ['pint', 'pints', 'pt'], plural: 'pints' },

  // temperature. `base` has no meaning here. convert.ts holds the formula.
  // The bare letters `c` and `f` are NOT aliases. In a recipe `2 c flour`
  // means cups, not degrees. convert.ts reads oven temperatures from the
  // method text with its own pattern.
  { id: 'C', dimension: 'temperature', system: 'metric', base: 1, aliases: ['celsius', 'centigrade', '°c'] },
  { id: 'F', dimension: 'temperature', system: 'imperial', base: 1, aliases: ['fahrenheit', '°f'] },

  // length
  { id: 'cm', dimension: 'length', system: 'metric', base: 1, aliases: ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'] },
  { id: 'inch', dimension: 'length', system: 'imperial', base: 2.54, aliases: ['inch', 'inches', 'in'], plural: 'inches' },

  // count. these scale but never convert.
  { id: 'clove', dimension: 'count', system: 'both', base: 1, aliases: ['clove', 'cloves'], plural: 'cloves' },
  { id: 'sprig', dimension: 'count', system: 'both', base: 1, aliases: ['sprig', 'sprigs'], plural: 'sprigs' },
  { id: 'slice', dimension: 'count', system: 'both', base: 1, aliases: ['slice', 'slices'], plural: 'slices' },
  { id: 'tin', dimension: 'count', system: 'both', base: 1, aliases: ['tin', 'tins', 'can', 'cans'], plural: 'tins' },
  { id: 'stick', dimension: 'count', system: 'both', base: 1, aliases: ['stick', 'sticks'], plural: 'sticks' },
  { id: 'bunch', dimension: 'count', system: 'both', base: 1, aliases: ['bunch', 'bunches'], plural: 'bunches' },
  { id: 'head', dimension: 'count', system: 'both', base: 1, aliases: ['head', 'heads'], plural: 'heads' },
  { id: 'leaf', dimension: 'count', system: 'both', base: 1, aliases: ['leaf', 'leaves'], plural: 'leaves' },
  { id: 'sheet', dimension: 'count', system: 'both', base: 1, aliases: ['sheet', 'sheets'], plural: 'sheets' },
  { id: 'pinch', dimension: 'count', system: 'both', base: 1, aliases: ['pinch', 'pinches'], plural: 'pinches' },
  { id: 'handful', dimension: 'count', system: 'both', base: 1, aliases: ['handful', 'handfuls'], plural: 'handfuls' },
]

// `T` means tablespoon and `t` means teaspoon. The lookup is therefore
// case sensitive for those two aliases and case insensitive for the rest.
const CASE_SENSITIVE: Record<string, string> = { T: 'tbsp', t: 'tsp' }

const BY_ALIAS = new Map<string, UnitDef>()
for (const unit of UNITS) {
  for (const alias of unit.aliases) {
    const key = alias.toLowerCase()
    if (!BY_ALIAS.has(key)) BY_ALIAS.set(key, unit)
  }
}

const BY_ID = new Map(UNITS.map((u) => [u.id, u]))

export function lookupUnit(word: string): UnitDef | null {
  if (!word) return null
  const exact = CASE_SENSITIVE[word]
  if (exact) return BY_ID.get(exact) ?? null
  return BY_ALIAS.get(word.toLowerCase().replace(/\.$/, '')) ?? null
}

export function unitById(id: string): UnitDef | null {
  return BY_ID.get(id) ?? null
}

/** The display form of a unit for a given value. */
export function displayUnit(id: string, value: number): string {
  const unit = BY_ID.get(id)
  if (!unit) return id
  if (!unit.plural) return unit.id
  return Math.abs(value) === 1 ? unit.id : unit.plural
}
