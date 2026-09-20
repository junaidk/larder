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

  // The form owns the title heading, so it rebuilds that line. It does not
  // own the free text below the heading, such as a short description. That
  // text passes through untouched, the same way the cook log does.
  const lead = existing?.blocks[0]
  if (lead && lead.kind === 'text') {
    const bodyLines = [...lead.lines]
    const titleIndex = bodyLines.findIndex((l) => /^#\s+/.test(l))
    if (titleIndex !== -1) bodyLines.splice(titleIndex, 1)
    const description = bodyLines.join('\n').trim()
    if (description) out.push(description, '')
  }

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
