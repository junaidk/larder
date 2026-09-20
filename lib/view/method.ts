const STEP_RE = /^\s*\d+[.)]\s/

function dropTrailingBlanks(step: string): string {
  const lines = step.split('\n')
  while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

/**
 * Read method text as a lead block and a list of steps.
 * A step starts at a numbered line. Every line that follows belongs to the
 * step above it, so a wrapped line never becomes a step of its own.
 */
export function splitMethodText(text: string): { lead: string[]; steps: string[] } {
  if (text === '') return { lead: [], steps: [] }

  const lead: string[] = []
  const steps: string[] = []
  for (const line of text.split('\n')) {
    if (STEP_RE.test(line)) steps.push(line.replace(STEP_RE, ''))
    else if (steps.length === 0) lead.push(line)
    else steps[steps.length - 1] += `\n${line}`
  }

  while (lead.length > 0 && lead[lead.length - 1].trim() === '') lead.pop()
  return { lead, steps: steps.map(dropTrailingBlanks) }
}
