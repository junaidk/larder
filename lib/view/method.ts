const STEP_RE = /^\s*\d+[.)]\s/
const HEADING_RE = /^\s*###\s+/

/** One thing in the method: a section heading, or a numbered step. */
export type MethodItem =
  | { kind: 'heading'; text: string }
  | { kind: 'step'; text: string; number: number }

function dropTrailingBlanks(step: string): string {
  const lines = step.split('\n')
  while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

/**
 * Read method text as a lead block and a list of items.
 *
 * A `###` line starts a section. A numbered line starts a step. Every other
 * line belongs to the step above it, so a wrapped line never becomes a step
 * of its own, and a heading never takes the wrapped lines of the step above.
 *
 * The number on each step comes from here, not from the file. The count
 * starts again at every heading, so each section reads from 1 whatever
 * numbers the file holds.
 *
 * A line that is neither a heading nor a step, and that arrives before the
 * first step, goes to the lead. Prose written under a heading but above that
 * section's first step therefore moves above the heading when the file is
 * rebuilt. No recipe is written that way, and the editor cannot produce it.
 */
export function splitMethodText(text: string): { lead: string[]; items: MethodItem[] } {
  if (text === '') return { lead: [], items: [] }

  const lead: string[] = []
  const items: MethodItem[] = []
  let number = 0

  for (const line of text.split('\n')) {
    if (HEADING_RE.test(line)) {
      number = 0
      items.push({ kind: 'heading', text: line.replace(HEADING_RE, '').trim() })
    } else if (STEP_RE.test(line)) {
      number += 1
      items.push({ kind: 'step', text: line.replace(STEP_RE, ''), number })
    } else {
      const last = items[items.length - 1]
      if (last && last.kind === 'step') last.text += `\n${line}`
      else if (items.length === 0) lead.push(line)
      // A blank line below a heading is spacing in the file. It carries
      // nothing, and the rebuild writes its own spacing.
    }
  }

  while (lead.length > 0 && lead[lead.length - 1].trim() === '') lead.pop()

  return {
    lead,
    items: items.map((i) => (i.kind === 'step' ? { ...i, text: dropTrailingBlanks(i.text) } : i)),
  }
}

/** The step text only, in order. Headings are left out. */
export function methodSteps(split: { items: MethodItem[] }): string[] {
  return split.items.filter((i) => i.kind === 'step').map((i) => i.text)
}
