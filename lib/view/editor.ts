import { parseIngredientLine } from '@/lib/recipe/ingredient'

const HEADING_RE = /^\s*###\s+\S/

/** What one line of the ingredients box will not do when the recipe scales. */
export interface IngredientProblem {
  /** The line number the writer sees in the box, counting from 1. */
  line: number
  text: string
  why: string
}

export interface IngredientReadout {
  /** Lines that name an ingredient. A group heading and a blank line do not. */
  total: number
  measured: number
  counted: number
  textOnly: number
  attention: IngredientProblem[]
}

/** The ingredients box holds one line for each entry. */
export function linesToText(lines: string[]): string {
  return lines.join('\n')
}

export function textToLines(text: string): string[] {
  return text === '' ? [] : text.split('\n')
}

/**
 * The method box holds one block for each item, and a blank line between two
 * blocks. A step therefore keeps its own line breaks: only an empty line
 * starts the next step.
 */
export function itemsToText(items: string[]): string {
  return items.join('\n\n')
}

export function textToItems(text: string): string[] {
  return text
    .split(/\n[ \t]*\n/)
    .map((block) => block.replace(/^[ \t]*\n+|\n+[ \t]*$/g, '').trim())
    .filter((block) => block !== '')
}

/** True when this method item is a section heading rather than a step. */
export function isMethodHeading(item: string): boolean {
  return HEADING_RE.test(item)
}

/**
 * Read every ingredient line and report the ones that will not scale.
 *
 * The count tells the writer that the box was understood. The list names
 * only the lines that need a decision, because those are the lines that a
 * change of scale or of units will leave exactly as they are.
 */
export function ingredientReadout(lines: string[]): IngredientReadout {
  const readout: IngredientReadout = {
    total: 0, measured: 0, counted: 0, textOnly: 0, attention: [],
  }

  lines.forEach((raw, i) => {
    const text = raw.trim()
    if (text === '' || HEADING_RE.test(text)) return

    readout.total += 1
    const parsed = parseIngredientLine(`- ${text}`)

    if (parsed.kind === 'measured') {
      readout.measured += 1
      return
    }

    if (parsed.kind === 'counted') {
      readout.counted += 1
      readout.attention.push({ line: i + 1, text, why: 'counted — no unit to convert' })
      return
    }

    readout.textOnly += 1
    readout.attention.push({ line: i + 1, text, why: 'text only' })
  })

  return readout
}
