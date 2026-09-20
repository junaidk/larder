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
