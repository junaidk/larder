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
