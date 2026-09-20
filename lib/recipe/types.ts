export type IngredientClass = 'measured' | 'counted' | 'text'

export type Dimension = 'mass' | 'volume' | 'temperature' | 'length' | 'count'

export type System = 'metric' | 'imperial' | 'both'

/** A parsed amount. `raw` keeps the text exactly as the user typed it. */
export interface Quantity {
  value: number
  /** Set only for a range such as `2-3`. `value` holds the low end. */
  max?: number
  raw: string
}

export interface Ingredient {
  /** The whole source line, with the list marker. Example: `- 500 g flour`. */
  rawLine: string
  kind: IngredientClass
  quantity?: Quantity
  /** The canonical unit id from the unit table. Example: `g`. */
  unit?: string
  /** The unit exactly as the user typed it. Example: `grams`. */
  unitRaw?: string
  item?: string
  prep?: string
}

/**
 * One source line inside the `## Ingredients` section.
 * The section keeps every line, including blank lines. This is what
 * makes an exact round trip possible.
 */
export type IngredientLine =
  | { type: 'ingredient'; ingredient: Ingredient }
  | { type: 'group'; raw: string; name: string }
  | { type: 'other'; raw: string }

/** A display view over `IngredientLine[]`. `access.ts` builds it. */
export interface IngredientGroup {
  /** `null` for the lines before the first `###` heading. */
  name: string | null
  ingredients: Ingredient[]
}

export interface CookLogEntry {
  /** The form `YYYY-MM-DD`. */
  date: string
  /** 1 to 5, or `null` for no rating. */
  rating: number | null
  /** The note body markdown, with no leading or trailing blank line. */
  note: string
  /** The exact source lines. The serializer emits these when they are set. */
  rawLines?: string[]
}

export interface Frontmatter {
  title: string
  tags: string[]
  serves: number | null
  prep_time: string | null
  cook_time: string | null
  source: string | null
  created: string | null
  updated: string | null
  /** Any key that this app does not know. The serializer keeps it. */
  extra: Record<string, unknown>
}

/**
 * Every block keeps its source lines. A line array has no ambiguity
 * between "no body" and "one empty line", so the round trip is exact.
 */
export type Block =
  | { kind: 'text'; lines: string[] }
  | { kind: 'ingredients'; headingLine: string; lines: IngredientLine[] }
  | { kind: 'method'; headingLine: string; lines: string[] }
  | { kind: 'notes'; headingLine: string; lines: string[] }
  /** `leading` holds the lines between the heading and the first entry. */
  | { kind: 'cooklog'; headingLine: string; leading: string[]; entries: CookLogEntry[] }

export interface Recipe {
  slug: string
  eol: '\n' | '\r\n'
  /** True when the source file ends with a line break. */
  endsWithNewline: boolean
  frontmatter: Frontmatter
  /** The exact frontmatter body, without the `---` fences. `null` when the file has none. */
  frontmatterRaw: string | null
  blocks: Block[]
}

export interface RecipeSummary {
  slug: string
  title: string
  tags: string[]
  serves: number | null
  /** The rating of the newest cook log entry, or `null`. */
  latestRating: number | null
  /** The date of the newest cook log entry, or `null`. */
  lastCooked: string | null
  timesCooked: number
  /** Lowercase title and item names, for the search box. */
  searchText: string
}

export function emptyFrontmatter(title: string): Frontmatter {
  return {
    title,
    tags: [],
    serves: null,
    prep_time: null,
    cook_time: null,
    source: null,
    created: null,
    updated: null,
    extra: {},
  }
}
