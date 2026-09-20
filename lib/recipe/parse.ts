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
