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
