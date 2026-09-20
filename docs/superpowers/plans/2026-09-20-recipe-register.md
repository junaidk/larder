# Recipe Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that keeps cooking recipes as markdown files, adds dated cook notes, converts units and scales amounts.

**Architecture:** Next.js App Router serves the UI and the file operations in one process. The markdown files are the only store. One module, `lib/storage`, holds all filesystem access. Everything above that module works with `Recipe` objects. The parser keeps the raw text of each block, so a parse and a serialize returns the exact input bytes.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS 4, the `yaml` package, Vitest for unit tests, Playwright for one end-to-end test.

**Spec:** `docs/superpowers/specs/2026-09-20-recipe-register-design.md`

## Global Constraints

- Node 22 or later. The development machine has v22.12.0.
- Markdown files are the only store. Do not add a database.
- `lib/storage/index.ts` is the only module that reads or writes the filesystem. No other file imports `node:fs`.
- The environment variable `RECIPES_DIR` sets the recipe folder. The default is `./recipes`.
- Every write is atomic: write a temporary file in the target directory, then rename it over the target.
- A slug must match `^[a-z0-9-]+$`.
- Unit conversion and scale change the display only. They never write to a file.
- The app never converts mass to volume.
- Scale applies to the ingredient list only. It never changes the method text.
- The app has no authentication. Bind it to localhost.
- Prose in documents and comments uses ASD-STE100 Simplified Technical English.
- Never add an AI attribution line to a commit message.

## File Structure

| File | Responsibility |
|---|---|
| `lib/recipe/types.ts` | All shared types. No logic. |
| `lib/recipe/quantity.ts` | Text to number, and number to a tidy fraction. |
| `lib/units/table.ts` | The unit table: canonical ids, aliases, dimensions, systems. |
| `lib/recipe/ingredient.ts` | One ingredient line to an `Ingredient`, and back. |
| `lib/recipe/frontmatter.ts` | The YAML block to a `Frontmatter`, and back. |
| `lib/recipe/parse.ts` | Markdown text to a `Recipe` with ordered blocks. |
| `lib/recipe/serialize.ts` | A `Recipe` to markdown text. |
| `lib/recipe/access.ts` | Read helpers over the block list. |
| `lib/storage/index.ts` | List, read, save and create files. The only filesystem module. |
| `lib/units/convert.ts` | Metric and imperial conversion. Pure functions. |
| `lib/units/scale.ts` | Scale factors and unit promotion. Pure functions. |
| `lib/view/display.ts` | Join scale and conversion into one display string. |
| `app/page.tsx` | The recipe index: search and filters. |
| `app/r/[slug]/page.tsx` | The recipe view, with scale and unit controls. |
| `app/r/[slug]/edit/page.tsx` | The editor, with content. |
| `app/new/page.tsx` | The editor, with no content. |
| `app/actions.ts` | Server actions for save, create and log entry. |
| `components/*` | Form rows, preview pane, control bar, cook log dialog. |

---

### Task 1: Project scaffold and test runner

Build the project skeleton. The deliverable is a running dev server and a running test command.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `lib/recipe/types.ts`
- Test: `lib/recipe/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type in `lib/recipe/types.ts`. All later tasks import from `@/lib/recipe/types`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "recipe-reg",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "yaml": "^2.6.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
export default nextConfig
```

`postcss.config.mjs`:

```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
```

`.gitignore`:

```
node_modules/
.next/
next-env.d.ts
test-results/
playwright-report/
*.tsbuildinfo
```

- [ ] **Step 3: Create the app shell**

`app/globals.css`:

```css
@import "tailwindcss";
```

`app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Recipe Register' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  )
}
```

`app/page.tsx`:

```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl font-semibold">Recipe Register</h1></main>
}
```

- [ ] **Step 4: Write `lib/recipe/types.ts`**

Every later task imports these types. Do not change a name here without changing every user.

```ts
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
```

- [ ] **Step 5: Write the failing test**

`lib/recipe/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Recipe } from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'

describe('types module', () => {
  it('gives an empty frontmatter with the required title field', () => {
    const fm = emptyFrontmatter('Focaccia')
    expect(fm.title).toBe('Focaccia')
    expect(fm.tags).toEqual([])
    expect(fm.serves).toBeNull()
    expect(fm.extra).toEqual({})
  })

  it('builds a Recipe value that type checks', () => {
    const recipe: Recipe = {
      slug: 'focaccia',
      eol: '\n',
      endsWithNewline: true,
      frontmatter: emptyFrontmatter('Focaccia'),
      frontmatterRaw: null,
      blocks: [],
    }
    expect(recipe.slug).toBe('focaccia')
  })
})
```

- [ ] **Step 6: Run the test and confirm that it fails**

Run: `npm install && npx vitest run lib/recipe/types.test.ts`
Expected: FAIL. The message reports that `emptyFrontmatter` is not exported.

- [ ] **Step 7: Add `emptyFrontmatter` to `lib/recipe/types.ts`**

```ts
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
```

- [ ] **Step 8: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/types.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 9: Confirm that the dev server starts**

Run: `npm run dev`
Expected: the server listens on http://localhost:3000. The page shows the heading `Recipe Register`. Stop the server with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app, Vitest and shared types"
```

---

### Task 2: Quantity parse and fraction format

`1 1/2` and `½` must become the number 1.5. The number 1.5 must become `1 1/2`. These two functions carry every scale result, so they come before everything else.

**Files:**
- Create: `lib/recipe/quantity.ts`
- Test: `lib/recipe/quantity.test.ts`

**Interfaces:**
- Consumes: `Quantity` from `@/lib/recipe/types`.
- Produces:
  - `parseQuantity(text: string): { quantity: Quantity; rest: string } | null`
  - `formatNumber(value: number): string`
  - `formatQuantity(q: Quantity): string`

- [ ] **Step 1: Write the failing test**

`lib/recipe/quantity.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/recipe/quantity.test.ts`
Expected: FAIL. The module `lib/recipe/quantity` does not exist.

- [ ] **Step 3: Write `lib/recipe/quantity.ts`**

```ts
import type { Quantity } from '@/lib/recipe/types'

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

const FRACTION_GLYPHS = Object.keys(UNICODE_FRACTIONS).join('')

// whole + space + fraction | whole + glyph | glyph | fraction | decimal | whole
const NUMBER = String.raw`\d+\s+\d+\/\d+|\d+[${FRACTION_GLYPHS}]|[${FRACTION_GLYPHS}]|\d+\/\d+|\d+(?:\.\d+)?`
const QUANTITY_RE = new RegExp(String.raw`^\s*(${NUMBER})(?:\s*-\s*(${NUMBER}))?\s*`)

/** Turn one number token into a value. The token has no range part. */
function tokenValue(token: string): number {
  const glyph = token.slice(-1)
  if (glyph in UNICODE_FRACTIONS) {
    const whole = token.slice(0, -1)
    return (whole ? Number(whole) : 0) + UNICODE_FRACTIONS[glyph]
  }
  const parts = token.split(/\s+/)
  if (parts.length === 2) return Number(parts[0]) + fractionValue(parts[1])
  if (token.includes('/')) return fractionValue(token)
  return Number(token)
}

function fractionValue(token: string): number {
  const [top, bottom] = token.split('/')
  return Number(top) / Number(bottom)
}

/**
 * Read a quantity from the start of a line.
 * Return the quantity and the text that follows it, or null.
 */
export function parseQuantity(text: string): { quantity: Quantity; rest: string } | null {
  const match = QUANTITY_RE.exec(text)
  if (!match) return null
  const value = tokenValue(match[1])
  if (!Number.isFinite(value)) return null
  const quantity: Quantity = { value, raw: match[0].trim() }
  if (match[2] !== undefined) quantity.max = tokenValue(match[2])
  return { quantity, rest: text.slice(match[0].length) }
}

const DENOMINATORS = [2, 3, 4, 8]
const TOLERANCE = 0.012

/** Show a number as a tidy fraction, or as two significant figures. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const whole = Math.floor(abs)
  const part = abs - whole

  if (part < TOLERANCE) return sign + String(whole)

  for (const d of DENOMINATORS) {
    const top = Math.round(part * d)
    if (top > 0 && top < d && Math.abs(part - top / d) < TOLERANCE) {
      const fraction = `${top}/${d}`
      return whole === 0 ? sign + fraction : `${sign}${whole} ${fraction}`
    }
  }

  const rounded = abs >= 10 ? Math.round(abs) : Number(abs.toPrecision(2))
  return sign + String(rounded)
}

export function formatQuantity(q: Quantity): string {
  const low = formatNumber(q.value)
  return q.max === undefined ? low : `${low}-${formatNumber(q.max)}`
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/quantity.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/recipe/quantity.ts lib/recipe/quantity.test.ts
git commit -m "feat: parse quantities and format tidy fractions"
```

---

### Task 3: The unit table

The table decides which word is a unit. It also decides the dimension and the system of that unit. Task 4 and every conversion depend on it.

**Files:**
- Create: `lib/units/table.ts`
- Test: `lib/units/table.test.ts`

**Interfaces:**
- Consumes: `Dimension`, `System` from `@/lib/recipe/types`.
- Produces:
  - `interface UnitDef { id: string; dimension: Dimension; system: System; base: number; aliases: string[]; plural?: string }`
  - `UNITS: UnitDef[]`
  - `lookupUnit(word: string): UnitDef | null`
  - `unitById(id: string): UnitDef | null`
  - `displayUnit(id: string, value: number): string`

`base` is the size of one unit in the base unit of its dimension. The base units are gram, millilitre, degree Celsius and centimetre. A count unit has `base` 1.

- [ ] **Step 1: Write the failing test**

`lib/units/table.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lookupUnit, unitById, displayUnit } from '@/lib/units/table'

describe('lookupUnit', () => {
  it.each([
    ['g', 'g'], ['gram', 'g'], ['grams', 'g'], ['G', 'g'],
    ['kg', 'kg'], ['kilogram', 'kg'],
    ['ml', 'ml'], ['millilitre', 'ml'], ['milliliter', 'ml'],
    ['l', 'l'], ['litre', 'l'], ['liter', 'l'],
    ['tsp', 'tsp'], ['teaspoon', 'tsp'], ['teaspoons', 'tsp'],
    ['tbsp', 'tbsp'], ['tablespoon', 'tbsp'], ['T', 'tbsp'],
    ['oz', 'oz'], ['ounce', 'oz'], ['ounces', 'oz'],
    ['lb', 'lb'], ['pound', 'lb'], ['lbs', 'lb'],
    ['cup', 'cup'], ['cups', 'cup'],
    ['clove', 'clove'], ['cloves', 'clove'],
    ['sprig', 'sprig'], ['sprigs', 'sprig'],
  ])('reads %s as the unit %s', (word, id) => {
    expect(lookupUnit(word)?.id).toBe(id)
  })

  it.each([['eggs'], ['flour'], ['lemon'], ['good'], ['']])(
    'returns null for the word %s',
    (word) => {
      expect(lookupUnit(word)).toBeNull()
    },
  )
})

describe('the unit definitions', () => {
  it('gives mass units a size in grams', () => {
    expect(unitById('kg')!.base).toBe(1000)
    expect(unitById('oz')!.base).toBeCloseTo(28.3495, 3)
    expect(unitById('lb')!.base).toBeCloseTo(453.592, 2)
  })

  it('gives volume units a size in millilitres', () => {
    expect(unitById('l')!.base).toBe(1000)
    expect(unitById('tsp')!.base).toBe(5)
    expect(unitById('tbsp')!.base).toBe(15)
    expect(unitById('cup')!.base).toBe(240)
  })

  it('marks spoons as usable in both systems', () => {
    expect(unitById('tsp')!.system).toBe('both')
    expect(unitById('tbsp')!.system).toBe('both')
  })

  it('marks a count unit with the count dimension', () => {
    expect(unitById('clove')!.dimension).toBe('count')
  })
})

describe('displayUnit', () => {
  it('uses the plural form for a value above one', () => {
    expect(displayUnit('clove', 3)).toBe('cloves')
    expect(displayUnit('cup', 2)).toBe('cups')
  })

  it('uses the singular form for one', () => {
    expect(displayUnit('clove', 1)).toBe('clove')
  })

  it('never pluralises a symbol', () => {
    expect(displayUnit('g', 500)).toBe('g')
    expect(displayUnit('ml', 350)).toBe('ml')
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/units/table.test.ts`
Expected: FAIL. The module `lib/units/table` does not exist.

- [ ] **Step 3: Write `lib/units/table.ts`**

```ts
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
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/units/table.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/units/table.ts lib/units/table.test.ts
git commit -m "feat: add the unit table with aliases and dimensions"
```

---

### Task 4: The ingredient line parser

This task builds the contract in section 7 of the spec. Every line becomes one of three classes: measured, counted or text.

**Files:**
- Create: `lib/recipe/ingredient.ts`
- Test: `lib/recipe/ingredient.test.ts`

**Interfaces:**
- Consumes: `parseQuantity` from `@/lib/recipe/quantity`; `lookupUnit` from `@/lib/units/table`; `Ingredient` from `@/lib/recipe/types`.
- Produces:
  - `parseIngredientLine(rawLine: string): Ingredient`
  - `ingredientText(line: string): string` — the line with the list marker removed.

- [ ] **Step 1: Write the failing test**

`lib/recipe/ingredient.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseIngredientLine, ingredientText } from '@/lib/recipe/ingredient'

describe('ingredientText', () => {
  it.each([
    ['- 500 g flour', '500 g flour'],
    ['* 500 g flour', '500 g flour'],
    ['  - 500 g flour', '500 g flour'],
    ['500 g flour', '500 g flour'],
  ])('strips the list marker from %s', (line, expected) => {
    expect(ingredientText(line)).toBe(expected)
  })
})

describe('parseIngredientLine', () => {
  it('reads a measured line', () => {
    const got = parseIngredientLine('- 500 g strong white flour')
    expect(got.kind).toBe('measured')
    expect(got.quantity!.value).toBe(500)
    expect(got.unit).toBe('g')
    expect(got.unitRaw).toBe('g')
    expect(got.item).toBe('strong white flour')
    expect(got.prep).toBeUndefined()
    expect(got.rawLine).toBe('- 500 g strong white flour')
  })

  it('keeps the unit exactly as the user typed it', () => {
    const got = parseIngredientLine('- 350 millilitres warm water')
    expect(got.unit).toBe('ml')
    expect(got.unitRaw).toBe('millilitres')
  })

  it('reads a counted line that has a count unit', () => {
    const got = parseIngredientLine('- 3 cloves garlic, minced')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(3)
    expect(got.unit).toBe('clove')
    expect(got.item).toBe('garlic')
    expect(got.prep).toBe('minced')
  })

  it('reads a counted line that has no unit', () => {
    const got = parseIngredientLine('- 2 eggs')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(2)
    expect(got.unit).toBeUndefined()
    expect(got.item).toBe('eggs')
  })

  it('reads a mixed fraction with a unit', () => {
    const got = parseIngredientLine('- 1 1/2 tbsp olive oil')
    expect(got.kind).toBe('measured')
    expect(got.quantity!.value).toBeCloseTo(1.5, 6)
    expect(got.unit).toBe('tbsp')
    expect(got.item).toBe('olive oil')
  })

  it('reads a unicode fraction with no unit and a prep note', () => {
    const got = parseIngredientLine('- ½ lemon, juiced')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBeCloseTo(0.5, 6)
    expect(got.unit).toBeUndefined()
    expect(got.item).toBe('lemon')
    expect(got.prep).toBe('juiced')
  })

  it('reads a range as a counted line', () => {
    const got = parseIngredientLine('- 2-3 sprigs thyme')
    expect(got.kind).toBe('counted')
    expect(got.quantity!.value).toBe(2)
    expect(got.quantity!.max).toBe(3)
    expect(got.unit).toBe('sprig')
    expect(got.item).toBe('thyme')
  })

  it('reads a line with no quantity as text', () => {
    const got = parseIngredientLine('- a good pinch of sea salt')
    expect(got.kind).toBe('text')
    expect(got.quantity).toBeUndefined()
    expect(got.unit).toBeUndefined()
    expect(got.item).toBeUndefined()
    expect(got.rawLine).toBe('- a good pinch of sea salt')
  })

  it('keeps a quantity with no item as counted', () => {
    const got = parseIngredientLine('- 2')
    expect(got.kind).toBe('counted')
    expect(got.item).toBe('')
  })

  it('treats a temperature word as text, not a unit', () => {
    const got = parseIngredientLine('- 2 c plain flour')
    expect(got.unit).toBe('cup')
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/recipe/ingredient.test.ts`
Expected: FAIL. The module `lib/recipe/ingredient` does not exist.

- [ ] **Step 3: Add the alias `c` for the cup unit**

The last test needs `2 c plain flour` to read as cups. Open `lib/units/table.ts`. Change the `cup` line to:

```ts
  { id: 'cup', dimension: 'volume', system: 'imperial', base: 240, aliases: ['cup', 'cups', 'c'], plural: 'cups' },
```

The bare letter `c` is now the cup unit. Task 3 removed `c` from the Celsius unit for this reason.

- [ ] **Step 4: Write `lib/recipe/ingredient.ts`**

```ts
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
```

- [ ] **Step 5: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/ingredient.test.ts lib/units/table.test.ts`
Expected: PASS. Both files pass. The change in step 3 does not break the unit table tests.

- [ ] **Step 6: Commit**

```bash
git add lib/recipe/ingredient.ts lib/recipe/ingredient.test.ts lib/units/table.ts
git commit -m "feat: parse an ingredient line into measured, counted or text"
```

---

### Task 5: Frontmatter read and write

The YAML block holds the fields of section 4.2. The app must keep any key that it does not know.

**Files:**
- Create: `lib/recipe/frontmatter.ts`
- Test: `lib/recipe/frontmatter.test.ts`

**Interfaces:**
- Consumes: `Frontmatter`, `emptyFrontmatter` from `@/lib/recipe/types`; the `yaml` package.
- Produces:
  - `KNOWN_KEYS: string[]`
  - `parseFrontmatter(yamlText: string): Frontmatter`
  - `serializeFrontmatter(fm: Frontmatter): string` — the YAML body, with no `---` fences.

- [ ] **Step 1: Write the failing test**

`lib/recipe/frontmatter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseFrontmatter, serializeFrontmatter } from '@/lib/recipe/frontmatter'
import { emptyFrontmatter } from '@/lib/recipe/types'

describe('parseFrontmatter', () => {
  it('reads every known field', () => {
    const fm = parseFrontmatter([
      'title: Focaccia',
      'tags: [bread, italian]',
      'serves: 8',
      'prep_time: 20m',
      'cook_time: 25m',
      'source: https://example.com/focaccia',
      'created: 2026-09-20',
      'updated: 2026-09-20',
    ].join('\n'))

    expect(fm.title).toBe('Focaccia')
    expect(fm.tags).toEqual(['bread', 'italian'])
    expect(fm.serves).toBe(8)
    expect(fm.prep_time).toBe('20m')
    expect(fm.source).toBe('https://example.com/focaccia')
    expect(fm.created).toBe('2026-09-20')
    expect(fm.extra).toEqual({})
  })

  it('keeps a key that the app does not know', () => {
    const fm = parseFrontmatter('title: X\ncuisine: thai\n')
    expect(fm.extra).toEqual({ cuisine: 'thai' })
  })

  it('reads a single tag written as a string', () => {
    expect(parseFrontmatter('title: X\ntags: bread\n').tags).toEqual(['bread'])
  })

  it('gives an empty title when the field is missing', () => {
    expect(parseFrontmatter('serves: 4\n').title).toBe('')
  })

  it('gives null for a missing optional field', () => {
    const fm = parseFrontmatter('title: X\n')
    expect(fm.serves).toBeNull()
    expect(fm.cook_time).toBeNull()
  })

  it('reads a date value as a string in the form YYYY-MM-DD', () => {
    expect(parseFrontmatter('title: X\ncreated: 2026-09-20\n').created).toBe('2026-09-20')
  })
})

describe('serializeFrontmatter', () => {
  it('writes the known fields in a fixed order and drops empty ones', () => {
    const fm = emptyFrontmatter('Focaccia')
    fm.tags = ['bread', 'italian']
    fm.serves = 8
    expect(serializeFrontmatter(fm)).toBe(
      'title: Focaccia\ntags: [bread, italian]\nserves: 8\n',
    )
  })

  it('writes an unknown key after the known keys', () => {
    const fm = emptyFrontmatter('X')
    fm.extra = { cuisine: 'thai' }
    expect(serializeFrontmatter(fm)).toBe('title: X\ncuisine: thai\n')
  })

  it('quotes a title that would confuse YAML', () => {
    const fm = emptyFrontmatter('Soup: the good kind')
    expect(serializeFrontmatter(fm)).toBe('title: "Soup: the good kind"\n')
  })

  it('makes a round trip for a full block', () => {
    const text = 'title: Focaccia\ntags: [bread, italian]\nserves: 8\nprep_time: 20m\n'
    expect(serializeFrontmatter(parseFrontmatter(text))).toBe(text)
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/recipe/frontmatter.test.ts`
Expected: FAIL. The module `lib/recipe/frontmatter` does not exist.

- [ ] **Step 3: Write `lib/recipe/frontmatter.ts`**

```ts
import YAML from 'yaml'
import type { Frontmatter } from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'

export const KNOWN_KEYS = [
  'title', 'tags', 'serves', 'prep_time', 'cook_time', 'source', 'created', 'updated',
] as const

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export function parseFrontmatter(yamlText: string): Frontmatter {
  // `!!str` keeps a date such as 2026-09-20 as text, not as a Date.
  let data: Record<string, unknown> = {}
  try {
    const loaded = YAML.parse(yamlText)
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      data = loaded as Record<string, unknown>
    }
  } catch {
    data = {}
  }

  const fm = emptyFrontmatter(asString(data.title) ?? '')

  const tags = data.tags
  if (Array.isArray(tags)) fm.tags = tags.map((t) => String(t))
  else if (typeof tags === 'string' && tags.trim()) fm.tags = [tags.trim()]

  const serves = Number(data.serves)
  fm.serves = Number.isFinite(serves) && data.serves !== null && data.serves !== undefined ? serves : null

  fm.prep_time = asString(data.prep_time)
  fm.cook_time = asString(data.cook_time)
  fm.source = asString(data.source)
  fm.created = asString(data.created)
  fm.updated = asString(data.updated)

  const known = new Set<string>(KNOWN_KEYS)
  for (const [key, value] of Object.entries(data)) {
    if (!known.has(key)) fm.extra[key] = value
  }

  return fm
}

/** Quote a scalar when plain YAML would read it in the wrong way. */
function scalar(value: string): string {
  const risky = /^[\s>|&*!%@`{[]|:\s|#\s|[:#]$|^-\s|^(true|false|null|yes|no|on|off)$/i
  if (value === '' || risky.test(value)) return JSON.stringify(value)
  return value
}

export function serializeFrontmatter(fm: Frontmatter): string {
  const lines: string[] = []
  lines.push(`title: ${scalar(fm.title)}`)
  if (fm.tags.length > 0) lines.push(`tags: [${fm.tags.map(scalar).join(', ')}]`)
  if (fm.serves !== null) lines.push(`serves: ${fm.serves}`)
  if (fm.prep_time) lines.push(`prep_time: ${scalar(fm.prep_time)}`)
  if (fm.cook_time) lines.push(`cook_time: ${scalar(fm.cook_time)}`)
  if (fm.source) lines.push(`source: ${scalar(fm.source)}`)
  if (fm.created) lines.push(`created: ${scalar(fm.created)}`)
  if (fm.updated) lines.push(`updated: ${scalar(fm.updated)}`)

  for (const [key, value] of Object.entries(fm.extra)) {
    const dumped = YAML.stringify({ [key]: value }).trimEnd()
    lines.push(dumped)
  }

  return lines.join('\n') + '\n'
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/frontmatter.test.ts`
Expected: PASS, 10 tests.

If the test `reads a date value as a string` fails because the `yaml` package returns a `Date`, the `asString` helper already handles it. Confirm that the helper runs before any other conversion.

- [ ] **Step 5: Commit**

```bash
git add lib/recipe/frontmatter.ts lib/recipe/frontmatter.test.ts
git commit -m "feat: read and write recipe frontmatter, keeping unknown keys"
```

---

### Task 6: Parse a markdown file into a Recipe

The parser splits the file at `##` headings. It keeps the exact text of every line that it does not turn into structure. Task 7 tests the result with the round trip.

**Files:**
- Create: `lib/recipe/parse.ts`
- Create: `lib/recipe/access.ts`
- Test: `lib/recipe/parse.test.ts`

**Interfaces:**
- Consumes: `parseFrontmatter` from `@/lib/recipe/frontmatter`; `parseIngredientLine` from `@/lib/recipe/ingredient`; the types from `@/lib/recipe/types`.
- Produces:
  - `parseRecipe(text: string, slug: string): Recipe`
  - From `access.ts`: `ingredientGroups(recipe): IngredientGroup[]`, `methodText(recipe): string`, `notesText(recipe): string | null`, `cookLog(recipe): CookLogEntry[]`, `allIngredients(recipe): Ingredient[]`

- [ ] **Step 1: Write the failing test**

`lib/recipe/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseRecipe } from '@/lib/recipe/parse'
import { ingredientGroups, methodText, notesText, cookLog } from '@/lib/recipe/access'

const FULL = [
  '---',
  'title: Focaccia',
  'tags: [bread, italian]',
  'serves: 8',
  '---',
  '',
  '# Focaccia',
  '',
  'Dimpled and oily.',
  '',
  '## Ingredients',
  '',
  '- 500 g strong white flour',
  '- a good pinch of sea salt',
  '',
  '### For the topping',
  '',
  '- 3 tbsp olive oil',
  '',
  '## Method',
  '',
  '1. Mix the flour and water.',
  '2. Bake at 220C for 25 minutes.',
  '',
  '## Notes',
  '',
  'Use a metal tray.',
  '',
  '## Cook Log',
  '',
  '### 2026-09-14 — ★★★★☆',
  '',
  'Too salty.',
  '',
  '### 2026-08-02',
  '',
  'First attempt.',
  '',
].join('\n')

describe('parseRecipe', () => {
  it('reads the frontmatter', () => {
    const r = parseRecipe(FULL, 'focaccia')
    expect(r.frontmatter.title).toBe('Focaccia')
    expect(r.frontmatter.serves).toBe(8)
    expect(r.slug).toBe('focaccia')
    expect(r.eol).toBe('\n')
    expect(r.endsWithNewline).toBe(true)
  })

  it('keeps the text before the first section as a text block', () => {
    const r = parseRecipe(FULL, 'focaccia')
    expect(r.blocks[0].kind).toBe('text')
    const raw = (r.blocks[0] as { lines: string[] }).lines.join('\n')
    expect(raw).toContain('# Focaccia')
    expect(raw).toContain('Dimpled and oily.')
  })

  it('reads ingredient groups', () => {
    const groups = ingredientGroups(parseRecipe(FULL, 'focaccia'))
    expect(groups).toHaveLength(2)
    expect(groups[0].name).toBeNull()
    expect(groups[0].ingredients).toHaveLength(2)
    expect(groups[0].ingredients[0].item).toBe('strong white flour')
    expect(groups[0].ingredients[1].kind).toBe('text')
    expect(groups[1].name).toBe('For the topping')
    expect(groups[1].ingredients[0].unit).toBe('tbsp')
  })

  it('reads the method as raw text', () => {
    expect(methodText(parseRecipe(FULL, 'focaccia'))).toContain('Bake at 220C')
  })

  it('reads the notes as raw text', () => {
    expect(notesText(parseRecipe(FULL, 'focaccia'))).toContain('Use a metal tray.')
  })

  it('reads the cook log newest first with a rating', () => {
    const log = cookLog(parseRecipe(FULL, 'focaccia'))
    expect(log).toHaveLength(2)
    expect(log[0].date).toBe('2026-09-14')
    expect(log[0].rating).toBe(4)
    expect(log[0].note).toBe('Too salty.')
    expect(log[1].date).toBe('2026-08-02')
    expect(log[1].rating).toBeNull()
  })

  it('matches a heading name without regard to case', () => {
    const r = parseRecipe('## INGREDIENTS\n\n- 2 eggs\n', 'x')
    expect(ingredientGroups(r)[0].ingredients[0].item).toBe('eggs')
  })

  it('reads a file with no frontmatter', () => {
    const r = parseRecipe('# Toast\n\n## Method\n\n1. Toast it.\n', 'toast')
    expect(r.frontmatterRaw).toBeNull()
    expect(r.frontmatter.title).toBe('')
    expect(methodText(r)).toContain('Toast it.')
  })

  it('records Windows line endings', () => {
    const r = parseRecipe('# Toast\r\n\r\n## Method\r\n\r\n1. Toast it.\r\n', 'toast')
    expect(r.eol).toBe('\r\n')
  })

  it('records a file with no final line break', () => {
    expect(parseRecipe('# Toast', 'toast').endsWithNewline).toBe(false)
  })

  it('keeps an unknown section as a text block', () => {
    const r = parseRecipe('## Equipment\n\n- One tray\n', 'x')
    expect(r.blocks[0].kind).toBe('text')
  })

  it('gives null notes when the section is absent', () => {
    expect(notesText(parseRecipe('## Method\n\n1. Go.\n', 'x'))).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/recipe/parse.test.ts`
Expected: FAIL. The module `lib/recipe/parse` does not exist.

- [ ] **Step 3: Write `lib/recipe/parse.ts`**

```ts
import type {
  Block, CookLogEntry, IngredientLine, Recipe,
} from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'
import { parseFrontmatter } from '@/lib/recipe/frontmatter'
import { parseIngredientLine } from '@/lib/recipe/ingredient'

const SECTION_RE = /^##\s+(.*?)\s*$/
const GROUP_RE = /^###\s+(.*?)\s*$/
const ENTRY_RE = /^###\s+(\d{4}-\d{2}-\d{2})\s*(?:[—–-]\s*(.*?))?\s*$/
const LIST_RE = /^\s*[-*+]\s+\S/

/** Count the filled stars in a rating such as `★★★★☆`. */
function ratingOf(text: string | undefined): number | null {
  if (!text) return null
  const filled = (text.match(/★/g) ?? []).length
  return filled > 0 ? filled : null
}

function sectionName(line: string): string | null {
  const m = SECTION_RE.exec(line)
  return m ? m[1].toLowerCase() : null
}

export function parseRecipe(text: string, slug: string): Recipe {
  const eol: '\n' | '\r\n' = text.includes('\r\n') ? '\r\n' : '\n'
  const endsWithNewline = /\r?\n$/.test(text)

  let body = text
  let frontmatterRaw: string | null = null
  let frontmatter = emptyFrontmatter('')

  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text)
  if (fmMatch) {
    frontmatterRaw = fmMatch[1]
    frontmatter = parseFrontmatter(fmMatch[1].replace(/\r\n/g, '\n'))
    body = text.slice(fmMatch[0].length)
  }

  // Work in \n and restore the original break in the serializer.
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  if (endsWithNewline && lines[lines.length - 1] === '') lines.pop()

  const blocks: Block[] = []
  let cursor = 0

  // Everything before the first `##` heading is one text block.
  const firstSection = lines.findIndex((l) => SECTION_RE.test(l))
  const headStop = firstSection === -1 ? lines.length : firstSection
  if (headStop > 0) {
    blocks.push({ kind: 'text', lines: lines.slice(0, headStop) })
  }
  cursor = headStop

  while (cursor < lines.length) {
    const headingLine = lines[cursor]
    const name = sectionName(headingLine)
    let stop = cursor + 1
    while (stop < lines.length && !SECTION_RE.test(lines[stop])) stop += 1
    const bodyLines = lines.slice(cursor + 1, stop)

    if (name === 'ingredients') {
      blocks.push({ kind: 'ingredients', headingLine, lines: readIngredientLines(bodyLines) })
    } else if (name === 'method') {
      blocks.push({ kind: 'method', headingLine, lines: bodyLines })
    } else if (name === 'notes') {
      blocks.push({ kind: 'notes', headingLine, lines: bodyLines })
    } else if (name === 'cook log') {
      blocks.push({ kind: 'cooklog', headingLine, ...readCookLog(bodyLines) })
    } else {
      blocks.push({ kind: 'text', lines: [headingLine, ...bodyLines] })
    }
    cursor = stop
  }

  return { slug, eol, endsWithNewline, frontmatter, frontmatterRaw, blocks }
}

function readIngredientLines(bodyLines: string[]): IngredientLine[] {
  return bodyLines.map((raw): IngredientLine => {
    const group = GROUP_RE.exec(raw)
    if (group) return { type: 'group', raw, name: group[1] }
    if (LIST_RE.test(raw)) return { type: 'ingredient', ingredient: parseIngredientLine(raw) }
    return { type: 'other', raw }
  })
}

function readCookLog(bodyLines: string[]): { leading: string[]; entries: CookLogEntry[] } {
  const firstEntry = bodyLines.findIndex((l) => ENTRY_RE.test(l))
  if (firstEntry === -1) return { leading: bodyLines, entries: [] }

  const leading = bodyLines.slice(0, firstEntry)
  const entries: CookLogEntry[] = []

  let start = firstEntry
  while (start < bodyLines.length) {
    let stop = start + 1
    while (stop < bodyLines.length && !ENTRY_RE.test(bodyLines[stop])) stop += 1

    const block = bodyLines.slice(start, stop)
    const m = ENTRY_RE.exec(block[0])!
    entries.push({
      date: m[1],
      rating: ratingOf(m[2]),
      note: block.slice(1).join('\n').trim(),
      rawLines: block,
    })
    start = stop
  }

  return { leading, entries }
}
```

- [ ] **Step 4: Write `lib/recipe/access.ts`**

```ts
import type {
  CookLogEntry, Ingredient, IngredientGroup, Recipe,
} from '@/lib/recipe/types'

export function ingredientGroups(recipe: Recipe): IngredientGroup[] {
  const block = recipe.blocks.find((b) => b.kind === 'ingredients')
  if (!block || block.kind !== 'ingredients') return []

  const groups: IngredientGroup[] = [{ name: null, ingredients: [] }]
  for (const line of block.lines) {
    if (line.type === 'group') groups.push({ name: line.name, ingredients: [] })
    else if (line.type === 'ingredient') groups[groups.length - 1].ingredients.push(line.ingredient)
  }
  // Drop the leading group when the file starts with a `###` heading.
  return groups.filter((g, i) => i > 0 || g.ingredients.length > 0)
}

export function allIngredients(recipe: Recipe): Ingredient[] {
  return ingredientGroups(recipe).flatMap((g) => g.ingredients)
}

export function methodText(recipe: Recipe): string {
  const block = recipe.blocks.find((b) => b.kind === 'method')
  return block && block.kind === 'method' ? block.lines.join('\n').trim() : ''
}

export function notesText(recipe: Recipe): string | null {
  const block = recipe.blocks.find((b) => b.kind === 'notes')
  return block && block.kind === 'notes' ? block.lines.join('\n').trim() : null
}

export function cookLog(recipe: Recipe): CookLogEntry[] {
  const block = recipe.blocks.find((b) => b.kind === 'cooklog')
  return block && block.kind === 'cooklog' ? block.entries : []
}
```

- [ ] **Step 5: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/parse.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/recipe/parse.ts lib/recipe/access.ts lib/recipe/parse.test.ts
git commit -m "feat: parse a markdown recipe into ordered blocks"
```

---

### Task 7: Serialize, and the round trip guarantee

This is the most important task in the plan. A file must survive a parse and a serialize with no change to its bytes.

**Files:**
- Create: `lib/recipe/serialize.ts`
- Create: `lib/recipe/fixtures/*.md` (seven files)
- Test: `lib/recipe/serialize.test.ts`

**Interfaces:**
- Consumes: `serializeFrontmatter` from `@/lib/recipe/frontmatter`; the types from `@/lib/recipe/types`.
- Produces:
  - `serializeRecipe(recipe: Recipe): string`
  - `formatLogEntry(entry: CookLogEntry): string`
  - `formatStars(rating: number | null): string`

- [ ] **Step 1: Create the fixture files**

Create each file under `lib/recipe/fixtures/`. Copy the content exactly. A trailing blank line matters.

`fixtures/full.md`:

```markdown
---
title: Focaccia
tags: [bread, italian]
serves: 8
prep_time: 20m
cook_time: 25m
source: https://example.com/focaccia
created: 2026-09-20
updated: 2026-09-20
---

# Focaccia

Dimpled, oily, and best on the day.

## Ingredients

- 500 g strong white flour
- 350 ml warm water
- a good pinch of sea salt

### For the topping

- 3 tbsp olive oil
- 2 sprigs rosemary

## Method

1. Mix the flour, water, and yeast.
2. Bake at 220C for 25 minutes.

## Notes

Use a metal tray, not glass.

## Cook Log

### 2026-09-14 — ★★★★☆

Too salty. Next time 1 tsp salt.

### 2026-08-02 — ★★★☆☆

First attempt.
```

`fixtures/no-frontmatter.md`:

```markdown
# Cheese Toast

## Ingredients

- 2 slices bread
- 40 g cheddar

## Method

1. Toast the bread.
2. Melt the cheese on top.
```

`fixtures/unparsed-lines.md`:

```markdown
---
title: Odds and Ends
---

## Ingredients

- a good pinch of sea salt
- olive oil, to taste
- salt and pepper
- 2 eggs

## Method

1. Do the thing.
```

`fixtures/long-log.md`: a file with a `## Cook Log` section that holds six entries. Give each entry a different date from `2026-01-05` to `2026-06-05`, and give three of them a rating. Give one entry a note of three paragraphs.

`fixtures/unicode-fractions.md`:

```markdown
---
title: Fractions
---

## Ingredients

- ½ lemon, juiced
- 1½ cups milk
- 1 1/2 tbsp olive oil
- 2-3 sprigs thyme

## Method

1. Combine.
```

`fixtures/notes-subheadings.md`:

```markdown
---
title: Deep Notes
---

## Ingredients

- 1 tin chopped tomatoes

## Notes

### Storage

Keeps for three days.

### Substitutions

Passata also works.

## Cook Log

### 2026-03-01 — ★★★★★

Excellent.
```

`fixtures/crlf.md`: copy `fixtures/full.md` and change every line break to `\r\n`. Build it with this command, so that no editor changes it back:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('lib/recipe/fixtures/full.md','utf8');fs.writeFileSync('lib/recipe/fixtures/crlf.md',s.replace(/\r?\n/g,'\r\n'))"
```

Add `*.md text eol=lf` and `lib/recipe/fixtures/crlf.md -text` to a `.gitattributes` file, so that git never changes a fixture.

- [ ] **Step 2: Write the failing test**

`lib/recipe/serialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe, formatStars, formatLogEntry } from '@/lib/recipe/serialize'
import { emptyFrontmatter } from '@/lib/recipe/types'

const DIR = join(process.cwd(), 'lib/recipe/fixtures')
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.md'))

describe('the round trip', () => {
  it('finds all seven fixtures', () => {
    expect(FILES).toHaveLength(7)
  })

  it.each(FILES)('returns %s byte for byte', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8')
    const output = serializeRecipe(parseRecipe(source, 'fixture'))
    expect(output).toBe(source)
  })
})

describe('formatStars', () => {
  it.each([
    [5, '★★★★★'],
    [4, '★★★★☆'],
    [1, '★☆☆☆☆'],
    [null, ''],
  ])('shows %s as %s', (rating, expected) => {
    expect(formatStars(rating)).toBe(expected)
  })
})

describe('formatLogEntry', () => {
  it('writes a heading with a date and a rating', () => {
    const text = formatLogEntry({ date: '2026-09-14', rating: 4, note: 'Too salty.' })
    expect(text).toBe('### 2026-09-14 — ★★★★☆\n\nToo salty.')
  })

  it('writes a heading with no rating', () => {
    const text = formatLogEntry({ date: '2026-09-14', rating: null, note: 'Fine.' })
    expect(text).toBe('### 2026-09-14\n\nFine.')
  })
})

describe('serializeRecipe', () => {
  it('keeps the blank line that follows a heading', () => {
    const source = '## Method\n\n1. Go.\n'
    expect(serializeRecipe(parseRecipe(source, 'x'))).toBe(source)
  })

  it('keeps a heading that has an empty body', () => {
    const source = '## Notes\n'
    expect(serializeRecipe(parseRecipe(source, 'x'))).toBe(source)
  })

  it('writes a recipe that has no blocks', () => {
    const recipe = {
      slug: 'x',
      eol: '\n' as const,
      endsWithNewline: true,
      frontmatter: emptyFrontmatter('X'),
      frontmatterRaw: 'title: X',
      blocks: [],
    }
    expect(serializeRecipe(recipe)).toBe('---\ntitle: X\n---\n')
  })
})
```

- [ ] **Step 3: Run the test and confirm that it fails**

Run: `npx vitest run lib/recipe/serialize.test.ts`
Expected: FAIL. The module `lib/recipe/serialize` does not exist.

- [ ] **Step 4: Write `lib/recipe/serialize.ts`**

```ts
import type { Block, CookLogEntry, Recipe } from '@/lib/recipe/types'

export function formatStars(rating: number | null): string {
  if (rating === null) return ''
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/** Build the markdown for one cook log entry, with no trailing break. */
export function formatLogEntry(entry: CookLogEntry): string {
  const stars = formatStars(entry.rating)
  const heading = stars ? `### ${entry.date} — ${stars}` : `### ${entry.date}`
  return `${heading}\n\n${entry.note.trim()}`
}

function blockLines(block: Block): string[] {
  switch (block.kind) {
    case 'text':
      return block.lines
    case 'ingredients':
      return [
        block.headingLine,
        ...block.lines.map((l) => (l.type === 'ingredient' ? l.ingredient.rawLine : l.raw)),
      ]
    case 'method':
    case 'notes':
      return [block.headingLine, ...block.lines]
    case 'cooklog':
      return [
        block.headingLine,
        ...block.leading,
        ...block.entries.flatMap((e) => e.rawLines ?? formatLogEntry(e).split('\n')),
      ]
  }
}

export function serializeRecipe(recipe: Recipe): string {
  const parts: string[] = []

  if (recipe.frontmatterRaw !== null) {
    parts.push(`---\n${recipe.frontmatterRaw}\n---`)
  }

  for (const block of recipe.blocks) parts.push(blockLines(block).join('\n'))

  let text = parts.join('\n')
  if (recipe.endsWithNewline) text += '\n'
  if (recipe.eol === '\r\n') text = text.replace(/\n/g, '\r\n')
  return text
}
```

- [ ] **Step 5: Run the test and confirm that it passes**

Run: `npx vitest run lib/recipe/serialize.test.ts`
Expected: PASS, 11 tests. Every fixture returns byte for byte.

If a fixture fails, print the first difference before you change anything:

```bash
node -e "
const {parseRecipe}=require('./lib/recipe/parse');
const {serializeRecipe}=require('./lib/recipe/serialize');
const fs=require('fs');
const s=fs.readFileSync(process.argv[1],'utf8');
const o=serializeRecipe(parseRecipe(s,'x'));
for(let i=0;i<Math.max(s.length,o.length);i++){
  if(s[i]!==o[i]){console.log('differs at',i,JSON.stringify(s.slice(i-40,i+40)),JSON.stringify(o.slice(i-40,i+40)));break}
}" lib/recipe/fixtures/full.md
```

A difference is a fault in the serializer or in the parser. It is never a fault in the fixture. Do not edit a fixture to make a test pass.

- [ ] **Step 6: Run the whole test suite**

Run: `npm test`
Expected: PASS. Every test in `lib/` passes.

- [ ] **Step 7: Commit**

```bash
git add lib/recipe/serialize.ts lib/recipe/serialize.test.ts lib/recipe/fixtures .gitattributes
git commit -m "feat: serialize a recipe and prove the round trip with fixtures"
```

---

### Task 8: The storage module

This is the only module that reads or writes the filesystem. Every write is atomic.

**Files:**
- Create: `lib/storage/index.ts`
- Test: `lib/storage/storage.test.ts`

**Interfaces:**
- Consumes: `parseRecipe`, `serializeRecipe`, `formatLogEntry`, `cookLog`, `allIngredients`, and the types.
- Produces:
  - `recipesDir(): string`
  - `slugify(title: string): string`
  - `isSafeSlug(slug: string): boolean`
  - `listRecipes(): Promise<RecipeSummary[]>`
  - `readRecipe(slug: string): Promise<Recipe | null>`
  - `saveRecipe(recipe: Recipe): Promise<void>`
  - `createRecipe(title: string, markdown: string): Promise<string>` — returns the new slug
  - `addLogEntry(slug: string, entry: CookLogEntry): Promise<void>`

- [ ] **Step 1: Write the failing test**

`lib/storage/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'recipes-'))
  process.env.RECIPES_DIR = dir
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.RECIPES_DIR
})

async function mod() {
  return await import('@/lib/storage/index')
}

describe('slugify', () => {
  it.each([
    ['Focaccia', 'focaccia'],
    ['Spaghetti Carbonara', 'spaghetti-carbonara'],
    ['Mum’s Best Soup!', 'mums-best-soup'],
    ['  Extra   Spaces  ', 'extra-spaces'],
    ['Café Crème', 'cafe-creme'],
    ['2026 Loaf', '2026-loaf'],
  ])('turns %s into %s', async (title, slug) => {
    expect((await mod()).slugify(title)).toBe(slug)
  })

  it('gives a fallback for a title with no usable characters', async () => {
    expect((await mod()).slugify('!!!')).toBe('recipe')
  })
})

describe('isSafeSlug', () => {
  it.each([['focaccia', true], ['a-b-1', true], ['../escape', false], ['Upper', false], ['with space', false], ['', false]])(
    'reads %s as %s',
    async (slug, expected) => {
      expect((await mod()).isSafeSlug(slug as string)).toBe(expected)
    },
  )
})

describe('createRecipe', () => {
  it('writes a file and returns the slug', async () => {
    const { createRecipe } = await mod()
    const slug = await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(slug).toBe('focaccia')
    expect(readFileSync(join(dir, 'focaccia.md'), 'utf8')).toContain('title: Focaccia')
  })

  it('adds a numeric suffix when the slug already exists', async () => {
    const { createRecipe } = await mod()
    await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    const second = await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(second).toBe('focaccia-2')
  })

  it('leaves no temporary file behind', async () => {
    const { createRecipe } = await mod()
    await createRecipe('Focaccia', '---\ntitle: Focaccia\n---\n')
    expect(readdirSync(dir)).toEqual(['focaccia.md'])
  })
})

describe('readRecipe', () => {
  it('returns null for a slug with no file', async () => {
    expect(await (await mod()).readRecipe('missing')).toBeNull()
  })

  it('rejects a slug that tries to escape the folder', async () => {
    await expect((await mod()).readRecipe('../secret')).rejects.toThrow(/slug/i)
  })
})

describe('addLogEntry', () => {
  const base = [
    '---', 'title: Focaccia', '---', '', '## Cook Log', '',
    '### 2026-08-02 — ★★★☆☆', '', 'First attempt.', '',
  ].join('\n')

  it('puts a new entry at the top of the section', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), base)
    await addLogEntry('focaccia', { date: '2026-09-14', rating: 4, note: 'Too salty.' })

    const out = readFileSync(join(dir, 'focaccia.md'), 'utf8')
    expect(out.indexOf('2026-09-14')).toBeLessThan(out.indexOf('2026-08-02'))
    expect(out).toContain('### 2026-09-14 — ★★★★☆')
    expect(out).toContain('Too salty.')
  })

  it('keeps the older entry with no change', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), base)
    await addLogEntry('focaccia', { date: '2026-09-14', rating: 4, note: 'Too salty.' })
    expect(readFileSync(join(dir, 'focaccia.md'), 'utf8')).toContain('### 2026-08-02 — ★★★☆☆\n\nFirst attempt.')
  })

  it('adds the section when the file has none', async () => {
    const { addLogEntry } = await mod()
    writeFileSync(join(dir, 'toast.md'), '---\ntitle: Toast\n---\n\n## Method\n\n1. Toast it.\n')
    await addLogEntry('toast', { date: '2026-09-14', rating: 5, note: 'Good.' })

    const out = readFileSync(join(dir, 'toast.md'), 'utf8')
    expect(out).toContain('## Cook Log')
    expect(out).toContain('### 2026-09-14 — ★★★★★')
    expect(out).toContain('1. Toast it.')
  })
})

describe('listRecipes', () => {
  it('summarises every file in the folder', async () => {
    const { listRecipes } = await mod()
    writeFileSync(join(dir, 'focaccia.md'), [
      '---', 'title: Focaccia', 'tags: [bread]', 'serves: 8', '---', '',
      '## Ingredients', '', '- 500 g strong white flour', '',
      '## Cook Log', '', '### 2026-09-14 — ★★★★☆', '', 'Good.', '',
    ].join('\n'))
    writeFileSync(join(dir, 'toast.md'), '---\ntitle: Toast\n---\n')

    const list = await listRecipes()
    expect(list).toHaveLength(2)

    const focaccia = list.find((r) => r.slug === 'focaccia')!
    expect(focaccia.title).toBe('Focaccia')
    expect(focaccia.tags).toEqual(['bread'])
    expect(focaccia.serves).toBe(8)
    expect(focaccia.latestRating).toBe(4)
    expect(focaccia.lastCooked).toBe('2026-09-14')
    expect(focaccia.timesCooked).toBe(1)
    expect(focaccia.searchText).toContain('strong white flour')

    const toast = list.find((r) => r.slug === 'toast')!
    expect(toast.latestRating).toBeNull()
    expect(toast.timesCooked).toBe(0)
  })

  it('returns an empty list when the folder does not exist', async () => {
    process.env.RECIPES_DIR = join(dir, 'nope')
    expect(await (await mod()).listRecipes()).toEqual([])
  })

  it('ignores a file that is not markdown', async () => {
    const { listRecipes } = await mod()
    writeFileSync(join(dir, 'notes.txt'), 'hello')
    expect(await listRecipes()).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/storage/storage.test.ts`
Expected: FAIL. The module `lib/storage/index` does not exist.

- [ ] **Step 3: Write `lib/storage/index.ts`**

```ts
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { CookLogEntry, Recipe, RecipeSummary } from '@/lib/recipe/types'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe, formatLogEntry } from '@/lib/recipe/serialize'
import { allIngredients, cookLog } from '@/lib/recipe/access'

const SAFE_SLUG = /^[a-z0-9-]+$/

export function recipesDir(): string {
  return process.env.RECIPES_DIR || join(process.cwd(), 'recipes')
}

export function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG.test(slug)
}

function requireSafeSlug(slug: string): void {
  if (!isSafeSlug(slug)) throw new Error(`Unsafe recipe slug: ${slug}`)
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'recipe'
}

function pathFor(slug: string): string {
  requireSafeSlug(slug)
  return join(recipesDir(), `${slug}.md`)
}

/** Write a file with no risk of a part-written result. */
async function writeAtomic(target: string, content: string): Promise<void> {
  await mkdir(recipesDir(), { recursive: true })
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(temp, content, 'utf8')
    await rename(temp, target)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

async function listSlugs(): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(recipesDir())
  } catch {
    return []
  }
  return names
    .filter((n) => n.endsWith('.md'))
    .map((n) => n.slice(0, -3))
    .filter(isSafeSlug)
    .sort()
}

export async function readRecipe(slug: string): Promise<Recipe | null> {
  const path = pathFor(slug)
  try {
    return parseRecipe(await readFile(path, 'utf8'), slug)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await writeAtomic(pathFor(recipe.slug), serializeRecipe(recipe))
}

export async function createRecipe(title: string, markdown: string): Promise<string> {
  const base = slugify(title)
  const taken = new Set(await listSlugs())
  let slug = base
  let n = 2
  while (taken.has(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  await writeAtomic(pathFor(slug), markdown)
  return slug
}

export async function addLogEntry(slug: string, entry: CookLogEntry): Promise<void> {
  const recipe = await readRecipe(slug)
  if (!recipe) throw new Error(`No recipe with the slug ${slug}`)

  // A new entry carries an empty line at the end, so that it stays apart
  // from the entry below it.
  const rawLines = [...formatLogEntry(entry).split('\n'), '']
  const fresh: CookLogEntry = { ...entry, rawLines }

  const index = recipe.blocks.findIndex((b) => b.kind === 'cooklog')
  if (index === -1) {
    recipe.blocks.push({
      kind: 'cooklog',
      headingLine: '## Cook Log',
      leading: [''],
      entries: [fresh],
    })
    // Keep one empty line between the section above and the new heading.
    const previous = recipe.blocks[recipe.blocks.length - 2]
    if (previous) appendBlankLine(previous)
  } else {
    const block = recipe.blocks[index]
    if (block.kind === 'cooklog') block.entries = [fresh, ...block.entries]
  }

  recipe.endsWithNewline = true
  await saveRecipe(recipe)
}

/** Make sure a block ends with one empty line. */
function appendBlankLine(block: Recipe['blocks'][number]): void {
  if (block.kind === 'ingredients') return
  const lines = block.kind === 'cooklog' ? block.leading : block.lines
  if (lines[lines.length - 1] !== '') lines.push('')
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const slugs = await listSlugs()
  const summaries = await Promise.all(slugs.map(summarise))
  return summaries.filter((s): s is RecipeSummary => s !== null)
}

async function summarise(slug: string): Promise<RecipeSummary | null> {
  const recipe = await readRecipe(slug)
  if (!recipe) return null

  const log = cookLog(recipe)
  const items = allIngredients(recipe).map((i) => i.item ?? i.rawLine)

  return {
    slug,
    title: recipe.frontmatter.title || slug,
    tags: recipe.frontmatter.tags,
    serves: recipe.frontmatter.serves,
    latestRating: log[0]?.rating ?? null,
    lastCooked: log[0]?.date ?? null,
    timesCooked: log.length,
    searchText: [recipe.frontmatter.title, ...recipe.frontmatter.tags, ...items]
      .join(' ')
      .toLowerCase(),
  }
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/storage/storage.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Add a sample recipe folder**

Create `recipes/focaccia.md` with the content of `lib/recipe/fixtures/full.md`. The index page then has one recipe to show.

- [ ] **Step 6: Commit**

```bash
git add lib/storage recipes
git commit -m "feat: add the storage module with atomic writes and slug guards"
```

---

### Task 9: Unit conversion

Conversion changes the display only. This task also reads oven temperatures out of the method text.

**Files:**
- Create: `lib/units/convert.ts`
- Test: `lib/units/convert.test.ts`

**Interfaces:**
- Consumes: `unitById`, `displayUnit` from `@/lib/units/table`; `formatNumber` from `@/lib/recipe/quantity`.
- Produces:
  - `type UnitSystem = 'metric' | 'imperial'`
  - `convertAmount(value: number, unitId: string, target: UnitSystem): { value: number; unit: string }`
  - `roundForUnit(value: number, unitId: string): number`
  - `convertMethodText(text: string, target: UnitSystem): string`

- [ ] **Step 1: Write the failing test**

`lib/units/convert.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/units/convert.test.ts`
Expected: FAIL. The module `lib/units/convert` does not exist.

- [ ] **Step 3: Write `lib/units/convert.ts`**

```ts
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
  if (unit.system === target) return { value, unit: unitId }

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
    const wanted = target === 'imperial' ? 'F' : 'C'
    if (source === wanted) return whole
    const raw = source === 'C'
      ? celsiusToFahrenheit(Number(digits))
      : fahrenheitToCelsius(Number(digits))
    return `${roundForUnit(raw, wanted)}${wanted}`
  })
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/units/convert.test.ts`
Expected: PASS, all cases.

The oven rounding is deliberate. Celsius to Fahrenheit rounds to 25 degrees, so 220C shows as 425F. Fahrenheit to Celsius rounds to 10 degrees, so 425F shows as 220C. These are the numbers on a real oven dial.

- [ ] **Step 5: Commit**

```bash
git add lib/units/convert.ts lib/units/convert.test.ts
git commit -m "feat: convert amounts and oven temperatures between systems"
```

---

### Task 10: Scale

**Files:**
- Create: `lib/units/scale.ts`
- Test: `lib/units/scale.test.ts`

**Interfaces:**
- Consumes: `unitById` from `@/lib/units/table`; `roundForUnit` from `@/lib/units/convert`.
- Produces:
  - `scaleAmount(value: number, unitId: string | undefined, factor: number): { value: number; unit: string | undefined }`
  - `factorForServings(base: number | null, wanted: number): number`
  - `parseFactor(text: string): number | null`

- [ ] **Step 1: Write the failing test**

`lib/units/scale.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scaleAmount, factorForServings, parseFactor } from '@/lib/units/scale'

describe('scaleAmount', () => {
  it('multiplies a measured amount', () => {
    expect(scaleAmount(500, 'g', 2)).toEqual({ value: 1, unit: 'kg' })
  })

  it('promotes grams to kilograms at one thousand', () => {
    expect(scaleAmount(500, 'g', 3)).toEqual({ value: 1.5, unit: 'kg' })
  })

  it('promotes millilitres to litres at one thousand', () => {
    expect(scaleAmount(350, 'ml', 4)).toEqual({ value: 1.4, unit: 'l' })
  })

  it('keeps a small amount in the small unit', () => {
    expect(scaleAmount(500, 'g', 1.5)).toEqual({ value: 750, unit: 'g' })
  })

  it('halves a spoon amount', () => {
    expect(scaleAmount(1, 'tsp', 0.5)).toEqual({ value: 0.5, unit: 'tsp' })
  })

  it('scales a count with no unit', () => {
    expect(scaleAmount(3, undefined, 0.5)).toEqual({ value: 1.5, unit: undefined })
  })

  it('scales a count unit and never converts it', () => {
    expect(scaleAmount(3, 'clove', 2)).toEqual({ value: 6, unit: 'clove' })
  })

  it('returns the input for a factor of one', () => {
    expect(scaleAmount(500, 'g', 1)).toEqual({ value: 500, unit: 'g' })
  })
})

describe('factorForServings', () => {
  it('divides the wanted count by the base count', () => {
    expect(factorForServings(8, 4)).toBe(0.5)
    expect(factorForServings(4, 6)).toBe(1.5)
  })

  it('returns one when the recipe has no serves field', () => {
    expect(factorForServings(null, 4)).toBe(1)
  })

  it('returns one for a base of zero', () => {
    expect(factorForServings(0, 4)).toBe(1)
  })
})

describe('parseFactor', () => {
  it.each([
    ['2', 2], ['0.5', 0.5], ['1/2', 0.5], ['1 1/2', 1.5],
    ['2x', 2], ['x2', 2], ['½', 0.5],
  ])('reads %s as %s', (text, expected) => {
    expect(parseFactor(text)).toBeCloseTo(expected, 6)
  })

  it.each([['0'], ['-1'], ['abc'], ['']])('returns null for %s', (text) => {
    expect(parseFactor(text)).toBeNull()
  })

  it('refuses a factor above one hundred', () => {
    expect(parseFactor('1000')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/units/scale.test.ts`
Expected: FAIL. The module `lib/units/scale` does not exist.

- [ ] **Step 3: Write `lib/units/scale.ts`**

```ts
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
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/units/scale.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/units/scale.ts lib/units/scale.test.ts
git commit -m "feat: scale amounts with unit promotion"
```

---

### Task 11: Join scale and conversion into one display string

The pages need one function that turns an `Ingredient` into the text on the screen. This task keeps that rule in one place.

**Files:**
- Create: `lib/view/display.ts`
- Test: `lib/view/display.test.ts`

**Interfaces:**
- Consumes: `scaleAmount` from `@/lib/units/scale`; `convertAmount` from `@/lib/units/convert`; `formatNumber` from `@/lib/recipe/quantity`; `displayUnit` from `@/lib/units/table`; `ingredientText` from `@/lib/recipe/ingredient`.
- Produces:
  - `interface ViewOptions { system: UnitSystem; factor: number }`
  - `displayIngredient(ingredient: Ingredient, options: ViewOptions): string`
  - `DEFAULT_VIEW: ViewOptions`

**Note for the vitest config:** the `include` pattern in `vitest.config.ts` is `lib/**/*.test.ts`, so this file is already covered.

- [ ] **Step 1: Write the failing test**

`lib/view/display.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { displayIngredient, DEFAULT_VIEW } from '@/lib/view/display'
import { parseIngredientLine } from '@/lib/recipe/ingredient'

const view = (system: 'metric' | 'imperial', factor: number) => ({ system, factor })

describe('displayIngredient', () => {
  it('shows a measured line with no change at the default view', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, DEFAULT_VIEW)).toBe('500 g strong white flour')
  })

  it('never changes a text line', () => {
    const line = parseIngredientLine('- a good pinch of sea salt')
    expect(displayIngredient(line, view('imperial', 2))).toBe('a good pinch of sea salt')
  })

  it('scales a measured line', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, view('metric', 2))).toBe('1 kg strong white flour')
  })

  it('converts a measured line', () => {
    const line = parseIngredientLine('- 500 g strong white flour')
    expect(displayIngredient(line, view('imperial', 1))).toBe('17.6 oz strong white flour')
  })

  it('scales and then converts', () => {
    const line = parseIngredientLine('- 500 g flour')
    expect(displayIngredient(line, view('imperial', 2))).toBe('2.2 lb flour')
  })

  it('shows a halved spoon as a fraction', () => {
    const line = parseIngredientLine('- 1 tsp fine salt')
    expect(displayIngredient(line, view('metric', 0.5))).toBe('1/2 tsp fine salt')
  })

  it('keeps a count as a fraction', () => {
    const line = parseIngredientLine('- 3 eggs')
    expect(displayIngredient(line, view('metric', 0.5))).toBe('1 1/2 eggs')
  })

  it('uses the plural form of a count unit', () => {
    const line = parseIngredientLine('- 1 clove garlic')
    expect(displayIngredient(line, view('metric', 3))).toBe('3 cloves garlic')
  })

  it('keeps the prep note', () => {
    const line = parseIngredientLine('- 3 cloves garlic, minced')
    expect(displayIngredient(line, view('metric', 2))).toBe('6 cloves garlic, minced')
  })

  it('scales both ends of a range', () => {
    const line = parseIngredientLine('- 2-3 sprigs thyme')
    expect(displayIngredient(line, view('metric', 2))).toBe('4-6 sprigs thyme')
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/view/display.test.ts`
Expected: FAIL. The module `lib/view/display` does not exist.

- [ ] **Step 3: Write `lib/view/display.ts`**

```ts
import type { Ingredient } from '@/lib/recipe/types'
import type { UnitSystem } from '@/lib/units/convert'
import { convertAmount } from '@/lib/units/convert'
import { scaleAmount } from '@/lib/units/scale'
import { formatNumber } from '@/lib/recipe/quantity'
import { displayUnit } from '@/lib/units/table'
import { ingredientText } from '@/lib/recipe/ingredient'

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

  let amount = formatNumber(low.value)
  if (ingredient.quantity.max !== undefined) {
    const high = transform(ingredient.quantity.max, ingredient.unit, options)
    amount = `${amount}-${formatNumber(high.value)}`
  }

  const unitWord = low.unit ? displayUnit(low.unit, low.value) : ''
  const parts = [amount, unitWord, ingredient.item].filter(Boolean)
  const head = parts.join(' ')
  return ingredient.prep ? `${head}, ${ingredient.prep}` : head
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/view/display.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. Every test file passes.

- [ ] **Step 6: Commit**

```bash
git add lib/view
git commit -m "feat: build the display text for a scaled and converted ingredient"
```

---

### Task 12: The recipe index page

The index shows every recipe. A search box filters on the title, the tags and the ingredient items. Two selects filter on a tag and on a rating.

**Files:**
- Modify: `app/page.tsx`
- Create: `components/RecipeIndex.tsx`
- Create: `components/Stars.tsx`

**Interfaces:**
- Consumes: `listRecipes` from `@/lib/storage/index`; `RecipeSummary` from `@/lib/recipe/types`.
- Produces: `<RecipeIndex recipes={...} />`, `<Stars rating={...} />`

- [ ] **Step 1: Write `components/Stars.tsx`**

```tsx
export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-stone-400">—</span>
  return (
    <span className="text-amber-600" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="text-stone-300">{'☆'.repeat(5 - rating)}</span>
    </span>
  )
}
```

- [ ] **Step 2: Write `components/RecipeIndex.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { RecipeSummary } from '@/lib/recipe/types'
import { Stars } from '@/components/Stars'

export function RecipeIndex({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [minRating, setMinRating] = useState(0)

  const tags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags))].sort(),
    [recipes],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (needle && !r.searchText.includes(needle)) return false
      if (tag && !r.tags.includes(tag)) return false
      if (minRating > 0 && (r.latestRating ?? 0) < minRating) return false
      return true
    })
  }, [recipes, query, tag, minRating])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or ingredient"
          aria-label="Search recipes"
          className="min-w-64 flex-1 rounded border border-stone-300 bg-white px-3 py-2"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filter by tag"
          className="rounded border border-stone-300 bg-white px-3 py-2"
        >
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          aria-label="Filter by rating"
          className="rounded border border-stone-300 bg-white px-3 py-2"
        >
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars and up</option>)}
        </select>
      </div>

      <p className="text-sm text-stone-500">
        {shown.length} of {recipes.length} recipes
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/r/${r.slug}`}
              className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400"
            >
              <h2 className="font-medium">{r.title}</h2>
              <div className="mt-2 flex items-center justify-between text-sm">
                <Stars rating={r.latestRating} />
                <span className="text-stone-500">
                  {r.timesCooked > 0 ? `cooked ${r.timesCooked}×` : 'not cooked yet'}
                </span>
              </div>
              {r.tags.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {t}
                    </span>
                  ))}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="rounded border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No recipe matches the filters.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import Link from 'next/link'
import { listRecipes } from '@/lib/storage/index'
import { RecipeIndex } from '@/components/RecipeIndex'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const recipes = await listRecipes()
  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipe Register</h1>
        <Link
          href="/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          New recipe
        </Link>
      </header>
      <RecipeIndex recipes={recipes} />
    </main>
  )
}
```

`export const dynamic = 'force-dynamic'` is important. Without it Next.js caches the page at build time, and an edit made in a text editor never appears. This setting delivers criterion 2 of the spec.

- [ ] **Step 4: Check the page by hand**

Run: `npm run dev` and open http://localhost:3000.
Expected: the card for the sample recipe `Focaccia` appears. The search box, the tag select and the rating select all filter the list. A search for `flour` keeps the card. A search for `zzz` shows the empty message.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/RecipeIndex.tsx components/Stars.tsx
git commit -m "feat: add the recipe index with search and filters"
```

---

### Task 13: The recipe view with scale and unit controls

**Files:**
- Create: `app/r/[slug]/page.tsx`
- Create: `components/ViewControls.tsx`
- Create: `lib/view/params.ts`
- Test: `lib/view/params.test.ts`

**Interfaces:**
- Consumes: `readRecipe` from `@/lib/storage/index`; `ingredientGroups`, `methodText`, `notesText`, `cookLog` from `@/lib/recipe/access`; `displayIngredient` from `@/lib/view/display`; `convertMethodText` from `@/lib/units/convert`.
- Produces: `readViewParams(params: Record<string, string | string[] | undefined>, serves: number | null): ViewOptions` from `lib/view/params.ts`.

- [ ] **Step 1: Write the failing test**

`lib/view/params.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readViewParams } from '@/lib/view/params'

describe('readViewParams', () => {
  it('gives the default view for no parameters', () => {
    expect(readViewParams({}, 8)).toEqual({ system: 'metric', factor: 1 })
  })

  it('reads the imperial system', () => {
    expect(readViewParams({ units: 'imperial' }, 8).system).toBe('imperial')
  })

  it('ignores an unknown system', () => {
    expect(readViewParams({ units: 'martian' }, 8).system).toBe('metric')
  })

  it('reads a scale factor', () => {
    expect(readViewParams({ scale: '0.5' }, 8).factor).toBe(0.5)
  })

  it('reads a fraction factor', () => {
    expect(readViewParams({ scale: '1/2' }, 8).factor).toBe(0.5)
  })

  it('ignores a factor that is not valid', () => {
    expect(readViewParams({ scale: 'abc' }, 8).factor).toBe(1)
    expect(readViewParams({ scale: '0' }, 8).factor).toBe(1)
  })

  it('reads a servings target and turns it into a factor', () => {
    expect(readViewParams({ serves: '4' }, 8).factor).toBe(0.5)
  })

  it('ignores a servings target when the recipe has no serves field', () => {
    expect(readViewParams({ serves: '4' }, null).factor).toBe(1)
  })

  it('lets an explicit scale win over a servings target', () => {
    expect(readViewParams({ scale: '2', serves: '4' }, 8).factor).toBe(2)
  })

  it('reads the first value of a repeated parameter', () => {
    expect(readViewParams({ units: ['imperial', 'metric'] }, 8).system).toBe('imperial')
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/view/params.test.ts`
Expected: FAIL. The module `lib/view/params` does not exist.

- [ ] **Step 3: Write `lib/view/params.ts`**

```ts
import type { ViewOptions } from '@/lib/view/display'
import { DEFAULT_VIEW } from '@/lib/view/display'
import { factorForServings, parseFactor } from '@/lib/units/scale'

type Params = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Read the view state out of the URL query. */
export function readViewParams(params: Params, serves: number | null): ViewOptions {
  const units = first(params.units)
  const system = units === 'imperial' ? 'imperial' : DEFAULT_VIEW.system

  const scale = first(params.scale)
  const explicit = scale ? parseFactor(scale) : null
  if (explicit !== null) return { system, factor: explicit }

  const wanted = Number(first(params.serves))
  if (serves !== null && Number.isFinite(wanted) && wanted > 0) {
    return { system, factor: factorForServings(serves, wanted) }
  }

  return { system, factor: DEFAULT_VIEW.factor }
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/view/params.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Write `components/ViewControls.tsx`**

```tsx
'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const STORAGE_KEY = 'recipe-register:units'

export function ViewControls({ serves }: { serves: number | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const units = params.get('units') === 'imperial' ? 'imperial' : 'metric'
  const scale = params.get('scale') ?? ''
  const wantedServes = params.get('serves') ?? ''
  const active = scale !== '' || wantedServes !== '' || units !== 'metric'

  // Remember the unit choice between visits.
  useEffect(() => {
    if (params.get('units')) {
      try { localStorage.setItem(STORAGE_KEY, units) } catch { /* private mode */ }
      return
    }
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
    if (saved === 'imperial') set({ units: 'imperial' })
  // The effect must run on a change of the query only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-500">Units</span>
        {(['metric', 'imperial'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => set({ units: value === 'metric' ? null : value })}
            aria-pressed={units === value}
            className={`rounded px-3 py-1 text-sm ${
              units === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            {value === 'metric' ? 'Metric' : 'Imperial'}
          </button>
        ))}

        <span className="ml-4 text-sm text-stone-500">Scale</span>
        {[['1/2', '1/2'], ['2', '2x'], ['3', '3x']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => set({ scale: scale === value ? null : value, serves: null })}
            aria-pressed={scale === value}
            className={`rounded px-3 py-1 text-sm ${
              scale === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}

        {serves !== null && (
          <label className="ml-2 flex items-center gap-2 text-sm text-stone-500">
            Serves
            <input
              type="number"
              min={1}
              max={200}
              defaultValue={wantedServes || serves}
              onChange={(e) => set({ serves: e.target.value, scale: null })}
              className="w-20 rounded border border-stone-300 px-2 py-1"
            />
          </label>
        )}
      </div>

      {active && (
        <p className="flex items-center gap-3 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          This view is not the file. The file keeps the amounts as written.
          <button
            type="button"
            onClick={() => set({ units: null, scale: null, serves: null })}
            className="underline"
          >
            Reset
          </button>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write `app/r/[slug]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { readRecipe } from '@/lib/storage/index'
import { cookLog, ingredientGroups, methodText, notesText } from '@/lib/recipe/access'
import { displayIngredient } from '@/lib/view/display'
import { convertMethodText } from '@/lib/units/convert'
import { readViewParams } from '@/lib/view/params'
import { ViewControls } from '@/components/ViewControls'
import { LogDialog } from '@/components/LogDialog'
import { Stars } from '@/components/Stars'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { slug } = await params
  const recipe = await readRecipe(slug)
  if (!recipe) notFound()

  const view = readViewParams(await searchParams, recipe.frontmatter.serves)
  const groups = ingredientGroups(recipe)
  const log = cookLog(recipe)
  const notes = notesText(recipe)

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-stone-500 hover:underline">All recipes</Link>
        <Link href={`/r/${slug}/edit`} className="text-stone-500 hover:underline">Edit</Link>
      </nav>

      <h1 className="text-3xl font-semibold">{recipe.frontmatter.title || slug}</h1>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-600">
        {recipe.frontmatter.serves !== null && <div><dt className="inline">Serves </dt><dd className="inline">{recipe.frontmatter.serves}</dd></div>}
        {recipe.frontmatter.prep_time && <div><dt className="inline">Prep </dt><dd className="inline">{recipe.frontmatter.prep_time}</dd></div>}
        {recipe.frontmatter.cook_time && <div><dt className="inline">Cook </dt><dd className="inline">{recipe.frontmatter.cook_time}</dd></div>}
        {recipe.frontmatter.source && <div><dt className="inline">Source </dt><dd className="inline">{recipe.frontmatter.source}</dd></div>}
      </dl>

      <div className="my-6 border-y border-stone-200 py-4">
        <Suspense fallback={null}>
          <ViewControls serves={recipe.frontmatter.serves} />
        </Suspense>
      </div>

      <section>
        <h2 className="text-xl font-medium">Ingredients</h2>
        {groups.map((group, i) => (
          <div key={i} className="mt-3">
            {group.name && <h3 className="text-sm font-medium text-stone-600">{group.name}</h3>}
            <ul className="mt-1 space-y-1">
              {group.ingredients.map((ingredient, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-stone-300">·</span>
                  <span>{displayIngredient(ingredient, view)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">Method</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans">
          {convertMethodText(methodText(recipe), view.system)}
        </pre>
      </section>

      {notes && (
        <section className="mt-8">
          <h2 className="text-xl font-medium">Notes</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans">{notes}</pre>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Cook log</h2>
          <LogDialog slug={slug} />
        </div>
        {log.length === 0 && <p className="mt-3 text-stone-500">No entry yet.</p>}
        <ol className="mt-3 space-y-4">
          {log.map((entry, i) => (
            <li key={i} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex items-center gap-3 text-sm">
                <time className="font-medium">{entry.date}</time>
                <Stars rating={entry.rating} />
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-stone-700">{entry.note}</pre>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
```

The `Suspense` wrapper around `ViewControls` is required. `useSearchParams` needs it during a static render.

`LogDialog` arrives in task 14. Until then, add a placeholder file `components/LogDialog.tsx` that exports a button with no action, so that the page compiles.

- [ ] **Step 7: Check the page by hand**

Run: `npm run dev` and open http://localhost:3000/r/focaccia.
Expected:
- The ingredients show as written.
- The Imperial button changes `500 g` to `17.6 oz` and changes `220C` in the method to `425F`.
- The `1/2` button halves every amount. The method text does not change its times.
- The banner appears. The Reset control clears the view.
- The URL holds `?units=imperial&scale=1/2`. A reload keeps the view.

- [ ] **Step 8: Commit**

```bash
git add app/r components/ViewControls.tsx lib/view/params.ts lib/view/params.test.ts components/LogDialog.tsx
git commit -m "feat: add the recipe view with scale and unit controls"
```

---

### Task 14: The cook log dialog

The button opens a small dialog. The dialog writes one entry at the top of the cook log. It changes nothing else in the file.

**Files:**
- Create: `app/actions.ts`
- Replace: `components/LogDialog.tsx`

**Interfaces:**
- Consumes: `addLogEntry`, `createRecipe`, `readRecipe`, `saveRecipe` from `@/lib/storage/index`.
- Produces:
  - `addLogEntryAction(slug: string, form: FormData): Promise<{ ok: true } | { ok: false; error: string }>`
  - `<LogDialog slug={...} />`

- [ ] **Step 1: Write `app/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { addLogEntry, isSafeSlug } from '@/lib/storage/index'

export type ActionResult = { ok: true; slug?: string } | { ok: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function addLogEntryAction(slug: string, form: FormData): Promise<ActionResult> {
  if (!isSafeSlug(slug)) return { ok: false, error: 'That recipe name is not valid.' }

  const date = String(form.get('date') ?? '').trim()
  if (!DATE_RE.test(date)) return { ok: false, error: 'Give a date in the form YYYY-MM-DD.' }

  const note = String(form.get('note') ?? '').trim()
  if (!note) return { ok: false, error: 'Write a note before you save.' }

  const ratingRaw = String(form.get('rating') ?? '').trim()
  const rating = ratingRaw ? Number(ratingRaw) : null
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { ok: false, error: 'A rating is a whole number from 1 to 5.' }
  }

  try {
    await addLogEntry(slug, { date, rating, note })
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }

  revalidatePath(`/r/${slug}`)
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Replace `components/LogDialog.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { addLogEntryAction } from '@/app/actions'

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function LogDialog({ slug }: { slug: string }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [rating, setRating] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)
    form.set('rating', rating > 0 ? String(rating) : '')
    const result = await addLogEntryAction(slug, form)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    dialog.current?.close()
    setRating(0)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700"
      >
        I cooked this
      </button>

      <dialog
        ref={dialog}
        aria-label="Add a cook log entry"
        className="w-[min(28rem,90vw)] rounded-lg p-0 backdrop:bg-stone-900/40"
      >
        <form action={submit} className="space-y-4 p-6">
          <h2 className="text-lg font-medium">Add a cook log entry</h2>

          <label className="block text-sm">
            Date
            <input
              type="date"
              name="date"
              defaultValue={today()}
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>

          <fieldset className="text-sm">
            <legend>Rating</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? 0 : n)}
                  aria-label={`${n} stars`}
                  aria-pressed={rating >= n}
                  className={`text-2xl leading-none ${rating >= n ? 'text-amber-600' : 'text-stone-300'}`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 self-center text-stone-500">
                {rating > 0 ? `${rating} of 5` : 'no rating'}
              </span>
            </div>
          </fieldset>

          <label className="block text-sm">
            Note
            <textarea
              name="note"
              rows={4}
              required
              placeholder="Too salty. Next time 1 tsp, not 2."
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded px-3 py-2 text-sm text-stone-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
```

- [ ] **Step 3: Check the dialog by hand**

Run: `npm run dev` and open http://localhost:3000/r/focaccia.
Steps:
1. Press `I cooked this`. The dialog opens with today's date.
2. Choose 4 stars. Write a note. Press `Save entry`.
3. The dialog closes. The new entry appears at the top of the cook log.
4. Open `recipes/focaccia.md` in a text editor.

Expected in the file: the new `### <date> — ★★★★☆` heading sits directly below `## Cook Log`. The older entries, the ingredients, the method and the notes hold no change.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts components/LogDialog.tsx
git commit -m "feat: add a cook log entry from the recipe page"
```

---

### Task 15: The two-pane editor

The form is on the left. The markdown file is on the right. The right pane shows the exact text that the app writes.

**Files:**
- Create: `components/RecipeEditor.tsx`
- Create: `lib/view/build.ts`
- Create: `app/new/page.tsx`
- Create: `app/r/[slug]/edit/page.tsx`
- Modify: `app/actions.ts`
- Test: `lib/view/build.test.ts`

**Interfaces:**
- Consumes: `parseIngredientLine` from `@/lib/recipe/ingredient`; `serializeFrontmatter` from `@/lib/recipe/frontmatter`; `parseRecipe` from `@/lib/recipe/parse`; the storage module.
- Produces:
  - `interface EditorState { title, tags, serves, prepTime, cookTime, source, ingredientLines: string[], methodSteps: string[], notes: string }`
  - `buildMarkdown(state: EditorState, existing: Recipe | null, today: string): string`
  - `stateFromRecipe(recipe: Recipe): EditorState`
  - `emptyState(): EditorState`
  - `saveRecipeAction(slug: string | null, markdown: string, title: string): Promise<ActionResult>`

The editor works on markdown text, not on a `Recipe` object. The form builds the file, the preview shows the file, and the action writes the file. This keeps one path to disk.

- [ ] **Step 1: Write the failing test**

`lib/view/build.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMarkdown, emptyState, stateFromRecipe } from '@/lib/view/build'
import { parseRecipe } from '@/lib/recipe/parse'

describe('buildMarkdown', () => {
  it('writes a whole file from an empty state', () => {
    const state = emptyState()
    state.title = 'Focaccia'
    state.tags = ['bread']
    state.serves = 8
    state.ingredientLines = ['500 g strong white flour', 'a good pinch of sea salt']
    state.methodSteps = ['Mix the flour and water.', 'Bake at 220C.']

    expect(buildMarkdown(state, null, '2026-09-20')).toBe([
      '---',
      'title: Focaccia',
      'tags: [bread]',
      'serves: 8',
      'created: 2026-09-20',
      'updated: 2026-09-20',
      '---',
      '',
      '# Focaccia',
      '',
      '## Ingredients',
      '',
      '- 500 g strong white flour',
      '- a good pinch of sea salt',
      '',
      '## Method',
      '',
      '1. Mix the flour and water.',
      '2. Bake at 220C.',
      '',
    ].join('\n'))
  })

  it('adds a notes section only when there is a note', () => {
    const state = emptyState()
    state.title = 'X'
    state.notes = 'Use a metal tray.'
    expect(buildMarkdown(state, null, '2026-09-20')).toContain('## Notes\n\nUse a metal tray.\n')
  })

  it('drops an empty ingredient line and an empty step', () => {
    const state = emptyState()
    state.title = 'X'
    state.ingredientLines = ['2 eggs', '', '   ']
    state.methodSteps = ['Go.', '']
    const out = buildMarkdown(state, null, '2026-09-20')
    expect(out).toContain('- 2 eggs\n\n## Method')
    expect(out).toContain('1. Go.')
    expect(out).not.toContain('2. ')
  })

  it('keeps the cook log of the existing file', () => {
    const source = [
      '---', 'title: Old', '---', '', '# Old', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Method', '', '1. Go.', '',
      '## Cook Log', '', '### 2026-08-02 — ★★★★☆', '', 'Good.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'old')
    const state = stateFromRecipe(existing)
    state.title = 'New'

    const out = buildMarkdown(state, existing, '2026-09-21')
    expect(out).toContain('## Cook Log\n\n### 2026-08-02 — ★★★★☆\n\nGood.\n')
    expect(out).toContain('title: New')
  })

  it('keeps the created date and moves the updated date', () => {
    const source = '---\ntitle: X\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\n## Method\n\n1. Go.\n'
    const existing = parseRecipe(source, 'x')
    const out = buildMarkdown(stateFromRecipe(existing), existing, '2026-09-21')
    expect(out).toContain('created: 2026-01-01')
    expect(out).toContain('updated: 2026-09-21')
  })

  it('keeps an ingredient group heading', () => {
    const state = emptyState()
    state.title = 'X'
    state.ingredientLines = ['500 g flour', '### For the topping', '3 tbsp olive oil']
    const out = buildMarkdown(state, null, '2026-09-20')
    expect(out).toContain('- 500 g flour\n\n### For the topping\n\n- 3 tbsp olive oil')
  })
})

describe('stateFromRecipe', () => {
  it('reads a file back into the form', () => {
    const source = [
      '---', 'title: Focaccia', 'tags: [bread, italian]', 'serves: 8', '---', '',
      '# Focaccia', '',
      '## Ingredients', '', '- 500 g flour', '', '### For the topping', '', '- 3 tbsp oil', '',
      '## Method', '', '1. Mix.', '2. Bake.', '',
      '## Notes', '', 'Use a metal tray.', '',
    ].join('\n')

    const state = stateFromRecipe(parseRecipe(source, 'focaccia'))
    expect(state.title).toBe('Focaccia')
    expect(state.tags).toEqual(['bread', 'italian'])
    expect(state.serves).toBe(8)
    expect(state.ingredientLines).toEqual(['500 g flour', '### For the topping', '3 tbsp oil'])
    expect(state.methodSteps).toEqual(['Mix.', 'Bake.'])
    expect(state.notes).toBe('Use a metal tray.')
  })

  it('keeps a line that the parser cannot read', () => {
    const source = '---\ntitle: X\n---\n\n## Ingredients\n\n- salt and pepper\n'
    expect(stateFromRecipe(parseRecipe(source, 'x')).ingredientLines).toEqual(['salt and pepper'])
  })
})
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `npx vitest run lib/view/build.test.ts`
Expected: FAIL. The module `lib/view/build` does not exist.

- [ ] **Step 3: Write `lib/view/build.ts`**

```ts
import type { Recipe } from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'
import { serializeFrontmatter } from '@/lib/recipe/frontmatter'
import { ingredientText } from '@/lib/recipe/ingredient'
import { methodText, notesText } from '@/lib/recipe/access'
import { formatLogEntry } from '@/lib/recipe/serialize'

export interface EditorState {
  title: string
  tags: string[]
  serves: number | null
  prepTime: string
  cookTime: string
  source: string
  /** One entry per line. A `###` line starts an ingredient group. */
  ingredientLines: string[]
  methodSteps: string[]
  notes: string
}

export function emptyState(): EditorState {
  return {
    title: '', tags: [], serves: null,
    prepTime: '', cookTime: '', source: '',
    ingredientLines: [''], methodSteps: [''], notes: '',
  }
}

export function stateFromRecipe(recipe: Recipe): EditorState {
  const block = recipe.blocks.find((b) => b.kind === 'ingredients')
  const ingredientLines: string[] = []
  if (block && block.kind === 'ingredients') {
    for (const line of block.lines) {
      if (line.type === 'group') ingredientLines.push(line.raw.trim())
      else if (line.type === 'ingredient') ingredientLines.push(ingredientText(line.ingredient.rawLine))
      else if (line.raw.trim() !== '') ingredientLines.push(line.raw.trim())
    }
  }

  const steps = methodText(recipe)
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((l) => l !== '')

  const fm = recipe.frontmatter
  return {
    title: fm.title,
    tags: fm.tags,
    serves: fm.serves,
    prepTime: fm.prep_time ?? '',
    cookTime: fm.cook_time ?? '',
    source: fm.source ?? '',
    ingredientLines: ingredientLines.length > 0 ? ingredientLines : [''],
    methodSteps: steps.length > 0 ? steps : [''],
    notes: notesText(recipe) ?? '',
  }
}

const GROUP_RE = /^###\s+/

/**
 * Build the whole file.
 * The cook log of `existing` passes through with no change.
 */
export function buildMarkdown(state: EditorState, existing: Recipe | null, today: string): string {
  const fm = emptyFrontmatter(state.title.trim())
  fm.tags = state.tags.map((t) => t.trim()).filter(Boolean)
  fm.serves = state.serves
  fm.prep_time = state.prepTime.trim() || null
  fm.cook_time = state.cookTime.trim() || null
  fm.source = state.source.trim() || null
  fm.created = existing?.frontmatter.created ?? today
  fm.updated = today
  if (existing) fm.extra = existing.frontmatter.extra

  const out: string[] = ['---', serializeFrontmatter(fm).trimEnd(), '---', '']
  out.push(`# ${fm.title}`, '')

  const ingredients = state.ingredientLines.map((l) => l.trim()).filter(Boolean)
  if (ingredients.length > 0) {
    out.push('## Ingredients', '')
    for (const line of ingredients) {
      if (GROUP_RE.test(line)) out.push('', line, '')
      else out.push(`- ${line}`)
    }
    out.push('')
  }

  const steps = state.methodSteps.map((s) => s.trim()).filter(Boolean)
  if (steps.length > 0) {
    out.push('## Method', '')
    steps.forEach((step, i) => out.push(`${i + 1}. ${step}`))
    out.push('')
  }

  const notes = state.notes.trim()
  if (notes) out.push('## Notes', '', notes, '')

  const log = existing?.blocks.find((b) => b.kind === 'cooklog')
  if (log && log.kind === 'cooklog' && log.entries.length > 0) {
    out.push('## Cook Log', '')
    for (const entry of log.entries) {
      out.push(...(entry.rawLines ?? [...formatLogEntry(entry).split('\n'), '']))
    }
  }

  // Collapse a run of empty lines and finish with exactly one line break.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n')
}
```

- [ ] **Step 4: Run the test and confirm that it passes**

Run: `npx vitest run lib/view/build.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the save action to `app/actions.ts`**

Put the two `import` lines with the imports at the top of the file. Add
`createRecipe`, `readRecipe` and `saveRecipe` to the existing import from
`@/lib/storage/index`. Then append the function.

```ts
import { createRecipe, readRecipe, saveRecipe } from '@/lib/storage/index'
import { parseRecipe } from '@/lib/recipe/parse'

export async function saveRecipeAction(
  slug: string | null,
  markdown: string,
  title: string,
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: 'Give the recipe a title.' }
  if (markdown.length > 200_000) return { ok: false, error: 'That recipe is too large.' }

  if (slug === null) {
    const created = await createRecipe(title, markdown)
    revalidatePath('/')
    return { ok: true, slug: created }
  }

  if (!isSafeSlug(slug)) return { ok: false, error: 'That recipe name is not valid.' }
  if (!(await readRecipe(slug))) return { ok: false, error: 'That recipe no longer exists.' }

  await saveRecipe(parseRecipe(markdown, slug))
  revalidatePath('/')
  revalidatePath(`/r/${slug}`)
  return { ok: true, slug }
}
```

- [ ] **Step 6: Write `components/RecipeEditor.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { EditorState } from '@/lib/view/build'
import { buildMarkdown } from '@/lib/view/build'
import type { Recipe } from '@/lib/recipe/types'
import { parseIngredientLine } from '@/lib/recipe/ingredient'
import { saveRecipeAction } from '@/app/actions'

const GROUP_RE = /^###\s+/

/** The grey label below an ingredient box. */
function hint(line: string): string {
  const text = line.trim()
  if (text === '') return ''
  if (GROUP_RE.test(text)) return 'group heading'
  const parsed = parseIngredientLine(`- ${text}`)
  if (parsed.kind === 'text') return 'text only — will not scale'
  const parts = [
    parsed.quantity ? String(parsed.quantity.raw) : '',
    parsed.unitRaw ?? '',
    parsed.item ?? '',
  ].filter(Boolean)
  const tail = parsed.kind === 'counted' ? ' · counted, will not convert' : ''
  return parts.join(' · ') + tail
}

export function RecipeEditor({
  initial, existing, slug, today,
}: {
  initial: EditorState
  existing: Recipe | null
  slug: string | null
  today: string
}) {
  const router = useRouter()
  const [state, setState] = useState<EditorState>(initial)
  const [tagText, setTagText] = useState(initial.tags.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pane, setPane] = useState<'form' | 'file'>('form')

  const markdown = useMemo(
    () => buildMarkdown(state, existing, today),
    [state, existing, today],
  )

  function edit(changes: Partial<EditorState>) {
    setState((previous) => ({ ...previous, ...changes }))
  }

  function editList(key: 'ingredientLines' | 'methodSteps', index: number, value: string) {
    setState((previous) => {
      const next = [...previous[key]]
      next[index] = value
      // Always keep one empty box at the end.
      if (index === next.length - 1 && value.trim() !== '') next.push('')
      return { ...previous, [key]: next }
    })
  }

  function removeFrom(key: 'ingredientLines' | 'methodSteps', index: number) {
    setState((previous) => {
      const next = previous[key].filter((_, i) => i !== index)
      return { ...previous, [key]: next.length > 0 ? next : [''] }
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecipeAction(slug, markdown, state.title)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    router.push(`/r/${result.slug}`)
    router.refresh()
  }

  const field = 'mt-1 block w-full rounded border border-stone-300 bg-white px-3 py-2'

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{slug ? 'Edit recipe' : 'New recipe'}</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded bg-stone-100 p-1 lg:hidden">
            {(['form', 'file'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPane(value)}
                aria-pressed={pane === value}
                className={`rounded px-3 py-1 text-sm ${pane === value ? 'bg-white shadow' : ''}`}
              >
                {value === 'form' ? 'Form' : 'File'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`space-y-5 ${pane === 'form' ? '' : 'hidden'} lg:block`}>
          <label className="block text-sm">Title
            <input value={state.title} onChange={(e) => edit({ title: e.target.value })} className={field} />
          </label>

          <label className="block text-sm">Tags, separated by a comma
            <input
              value={tagText}
              onChange={(e) => { setTagText(e.target.value); edit({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }) }}
              className={field}
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">Serves
              <input
                type="number" min={1}
                value={state.serves ?? ''}
                onChange={(e) => edit({ serves: e.target.value ? Number(e.target.value) : null })}
                className={field}
              />
            </label>
            <label className="block text-sm">Prep time
              <input value={state.prepTime} onChange={(e) => edit({ prepTime: e.target.value })} placeholder="20m" className={field} />
            </label>
            <label className="block text-sm">Cook time
              <input value={state.cookTime} onChange={(e) => edit({ cookTime: e.target.value })} placeholder="25m" className={field} />
            </label>
          </div>

          <label className="block text-sm">Source
            <input value={state.source} onChange={(e) => edit({ source: e.target.value })} className={field} />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">Ingredients</legend>
            <p className="mb-2 text-xs text-stone-500">
              Write one ingredient on each line, as you would say it. Start a line
              with <code>### </code> to begin a group.
            </p>
            <ul className="space-y-2">
              {state.ingredientLines.map((line, i) => (
                <li key={i}>
                  <div className="flex gap-2">
                    <input
                      value={line}
                      onChange={(e) => editList('ingredientLines', i, e.target.value)}
                      placeholder="500 g strong white flour"
                      aria-label={`Ingredient ${i + 1}`}
                      className="flex-1 rounded border border-stone-300 bg-white px-3 py-2"
                    />
                    <button type="button" onClick={() => removeFrom('ingredientLines', i)} aria-label={`Remove ingredient ${i + 1}`} className="px-2 text-stone-400 hover:text-stone-700">×</button>
                  </div>
                  {hint(line) && <p className="mt-0.5 pl-1 text-xs text-stone-500">{hint(line)}</p>}
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Method</legend>
            <ol className="mt-2 space-y-2">
              {state.methodSteps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 pt-2 text-right text-sm text-stone-400">{i + 1}</span>
                  <textarea
                    value={step}
                    onChange={(e) => editList('methodSteps', i, e.target.value)}
                    rows={2}
                    aria-label={`Step ${i + 1}`}
                    className="flex-1 rounded border border-stone-300 bg-white px-3 py-2"
                  />
                  <button type="button" onClick={() => removeFrom('methodSteps', i)} aria-label={`Remove step ${i + 1}`} className="px-2 text-stone-400 hover:text-stone-700">×</button>
                </li>
              ))}
            </ol>
          </fieldset>

          <label className="block text-sm">Notes
            <textarea value={state.notes} onChange={(e) => edit({ notes: e.target.value })} rows={3} className={field} />
          </label>
        </section>

        <section className={`${pane === 'file' ? '' : 'hidden'} lg:block`}>
          <div className="sticky top-4">
            <p className="mb-2 text-xs text-stone-500">
              {slug ? `recipes/${slug}.md` : 'the new file'} — this is the exact text that the app writes
            </p>
            <pre className="max-h-[70vh] overflow-auto rounded border border-stone-200 bg-white p-4 text-xs leading-relaxed">
              {markdown}
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write the two pages**

`app/new/page.tsx`:

```tsx
import { RecipeEditor } from '@/components/RecipeEditor'
import { emptyState } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default function NewRecipePage() {
  return (
    <main>
      <RecipeEditor
        initial={emptyState()}
        existing={null}
        slug={null}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
```

`app/r/[slug]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { RecipeEditor } from '@/components/RecipeEditor'
import { readRecipe } from '@/lib/storage/index'
import { stateFromRecipe } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const recipe = await readRecipe(slug)
  if (!recipe) notFound()

  return (
    <main>
      <RecipeEditor
        initial={stateFromRecipe(recipe)}
        existing={recipe}
        slug={slug}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
```

- [ ] **Step 8: Check the editor by hand**

Run: `npm run dev` and open http://localhost:3000/new.
Expected:
- The right pane changes as you type in the left pane.
- The line `500 g flour` shows the label `500 · g · flour`.
- The line `a good pinch of salt` shows the label `text only — will not scale`.
- The line `3 cloves garlic` shows `counted, will not convert`.
- `Save recipe` writes the file and opens the recipe page.

Then open http://localhost:3000/r/focaccia/edit. Press `Save recipe` with no change. Run `git diff recipes/focaccia.md`. Expected: the cook log, the notes and every ingredient hold their text. Only the `updated` date changes.

Then check section 4.5 of the spec. Open the same editor, change the title to
`Focaccia Two`, and save. Run `ls recipes/`. Expected: the file is still
`recipes/focaccia.md`. The app never renames a file after it creates it. The
URL `/r/focaccia` still works.

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add components/RecipeEditor.tsx lib/view/build.ts lib/view/build.test.ts app/new app/r/[slug]/edit app/actions.ts
git commit -m "feat: add the two-pane recipe editor with a live file preview"
```

---

### Task 16: The end-to-end test and the run instructions

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/recipe.spec.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: the whole app.
- Produces: `npm run e2e`, and a README that explains how to run the app on a Mac and on a VPS.

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

const PORT = 3100
const DIR = 'e2e/.recipes'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `RECIPES_DIR=${DIR} npx next dev --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: Write `e2e/recipe.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'e2e/.recipes')
const FILE = join(DIR, 'test-loaf.md')

test.beforeAll(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
})

test('create a recipe, then add a cook log entry', async ({ page }) => {
  // 1. Create a recipe in the editor and save it.
  await page.goto('/new')
  await page.getByLabel('Title').fill('Test Loaf')
  await page.getByLabel('Serves').fill('4')
  await page.getByLabel('Ingredient 1').fill('500 g strong white flour')
  await page.getByLabel('Ingredient 2').fill('a good pinch of sea salt')
  await page.getByLabel('Step 1').fill('Mix and bake at 220C.')

  // The preview shows the exact file.
  await expect(page.locator('pre')).toContainText('- 500 g strong white flour')
  await expect(page.getByText('text only — will not scale')).toBeVisible()

  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/test-loaf$/)

  // 2. Read the new file from disk.
  expect(existsSync(FILE)).toBe(true)
  const created = readFileSync(FILE, 'utf8')
  expect(created).toContain('title: Test Loaf')
  expect(created).toContain('- a good pinch of sea salt')

  // The scale and unit controls work on the view only.
  await page.getByRole('button', { name: 'Imperial' }).click()
  await expect(page.getByText('17.6 oz strong white flour')).toBeVisible()
  await expect(page.getByText('425F')).toBeVisible()
  expect(readFileSync(FILE, 'utf8')).toBe(created)

  await page.getByRole('button', { name: 'Reset' }).click()

  // 3. Open the recipe and add a cook log entry.
  await page.getByRole('button', { name: 'I cooked this' }).click()
  await page.getByLabel('Date').fill('2026-09-20')
  await page.getByRole('button', { name: '4 stars' }).click()
  await page.getByLabel('Note').fill('Too salty. Next time 1 tsp.')
  await page.getByRole('button', { name: 'Save entry' }).click()

  // 4. The app adds the entry at the top of the cook log.
  await expect(page.getByText('Too salty. Next time 1 tsp.')).toBeVisible()
  const after = readFileSync(FILE, 'utf8')
  expect(after).toContain('## Cook Log\n\n### 2026-09-20 — ★★★★☆')

  // 5. The rest of the file has no change.
  const bodyBefore = created.slice(created.indexOf('# Test Loaf'))
  expect(after).toContain(bodyBefore.trimEnd())
})

test('an edit made outside the app appears on the next load', async ({ page }) => {
  await page.goto('/r/test-loaf')
  await expect(page.getByRole('heading', { name: 'Test Loaf' })).toBeVisible()

  const text = readFileSync(FILE, 'utf8').replace('title: Test Loaf', 'title: Renamed Loaf')
  require('node:fs').writeFileSync(FILE, text)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Renamed Loaf' })).toBeVisible()
})
```

- [ ] **Step 3: Install the browser and run the test**

Run: `npx playwright install chromium && npm run e2e`
Expected: PASS, 2 tests.

The second test proves criterion 2 of the spec. An edit in a text editor appears in the app.

- [ ] **Step 4: Add `e2e/.recipes/` to `.gitignore`**

```
e2e/.recipes/
```

- [ ] **Step 5: Write `README.md`**

```markdown
# Recipe Register

A web app that keeps cooking recipes as markdown files. It adds dated cook
notes, converts amounts between metric and imperial units, and scales a recipe.

## Requirements

Node 22 or later.

## Run it on a Mac

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where the recipes live

The app reads and writes `./recipes`. To use another folder, set `RECIPES_DIR`:

```bash
RECIPES_DIR=~/Documents/recipes npm run dev
```

Keep that folder in git. You then have a history of every change, and a way
back if a file becomes wrong.

## Run it on a VPS

```bash
npm install
npm run build
RECIPES_DIR=/srv/recipes npm start -- --hostname 127.0.0.1
```

The app has no authentication. Do not give it a public address. Bind it to
127.0.0.1 and reach it through an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 user@your-vps
```

## The file format

See `docs/superpowers/specs/2026-09-20-recipe-register-design.md`, section 4.
A recipe file stays readable and editable in any text editor. The app keeps
every part of a file that you did not change.

## Tests

```bash
npm test     # unit tests
npm run e2e  # one end-to-end test
```

The most important tests are the round trip tests in
`lib/recipe/serialize.test.ts`. They prove that a file survives a parse and a
serialize with no change to its bytes.
```

- [ ] **Step 6: Run every check**

```bash
npm test
npx tsc --noEmit
npm run build
npm run e2e
```

Expected: all four commands finish with no error.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e README.md .gitignore
git commit -m "test: add an end-to-end test and write the run instructions"
```

---

## Acceptance

Check each criterion of section 1 of the spec against the built app.

| # | Criterion | Where it is proved |
|---|---|---|
| 1 | Create a recipe in the UI. The app writes a file. | Task 15, and the first e2e test. |
| 2 | Edit a file in a text editor. The app shows the change. | `dynamic = 'force-dynamic'` in tasks 12 and 13, and the second e2e test. |
| 3 | The app keeps every part of a file that the user did not change. | The round trip tests of task 7. The by-hand check of task 15, step 8. |
| 4 | Find a recipe by text, by tag or by rating. | Task 12. |
| 5 | Read amounts in metric or imperial units. | Tasks 9 and 11, shown in task 13. |
| 6 | Scale a recipe to a different number of servings. | Tasks 10 and 13. |
| 7 | Add a dated note with a rating. | Task 14. |
