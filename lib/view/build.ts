import type { Block, Recipe } from '@/lib/recipe/types'
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
  let title = fm.title
  if (!title) {
    const first = recipe.blocks[0]
    if (first && first.kind === 'text') {
      const h1 = first.lines.find((l) => /^#\s+/.test(l))
      if (h1) title = h1.replace(/^#\s+/, '').trim()
    }
  }

  return {
    title,
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

  const ingredients = state.ingredientLines.map((l) => l.trim()).filter(Boolean)
  const emitIngredients = (): void => {
    if (ingredients.length === 0) return
    out.push('## Ingredients', '')
    for (const line of ingredients) {
      if (GROUP_RE.test(line)) out.push('', line, '')
      else out.push(`- ${line}`)
    }
    out.push('')
  }

  const steps = state.methodSteps.map((s) => s.trim()).filter(Boolean)
  const emitMethod = (): void => {
    if (steps.length === 0) return
    out.push('## Method', '')
    steps.forEach((step, i) => out.push(`${i + 1}. ${step}`))
    out.push('')
  }

  const notes = state.notes.trim()
  const emitNotes = (): void => {
    if (!notes) return
    out.push('## Notes', '', notes, '')
  }

  const emitCookLog = (log: Extract<Block, { kind: 'cooklog' }> | undefined): void => {
    if (!log || log.entries.length === 0) return
    out.push('## Cook Log', '')
    for (const entry of log.entries) {
      out.push(...(entry.rawLines ?? [...formatLogEntry(entry).split('\n'), '']))
    }
  }

  if (!existing) {
    // A brand new recipe: build the file from the template, in canonical order.
    out.push(`# ${fm.title}`, '')
    emitIngredients()
    emitMethod()
    emitNotes()
    return finish(out)
  }

  // An existing recipe: walk its blocks in their original order and emit
  // each one. The form owns Ingredients, Method, Notes and Cook Log, so it
  // rebuilds those from the form state. Every other block, including the
  // lead block that holds the title and the description, passes through
  // untouched apart from the regenerated title line. This is what keeps an
  // unmodelled section, such as `## Equipment`, in its original position.
  let sawIngredients = false
  let sawMethod = false
  let sawNotes = false

  let start = 0
  const firstBlock = existing.blocks[0]
  if (firstBlock && firstBlock.kind === 'text') {
    const bodyLines = [...firstBlock.lines]
    const titleIndex = bodyLines.findIndex((l) => /^#\s+/.test(l))
    if (titleIndex !== -1) bodyLines.splice(titleIndex, 1)
    out.push(`# ${fm.title}`, '')
    const description = bodyLines.join('\n').trim()
    if (description) out.push(description, '')
    start = 1
  } else {
    out.push(`# ${fm.title}`, '')
  }

  for (let i = start; i < existing.blocks.length; i += 1) {
    const block = existing.blocks[i]
    if (block.kind === 'text') {
      out.push(...block.lines)
    } else if (block.kind === 'ingredients') {
      sawIngredients = true
      emitIngredients()
    } else if (block.kind === 'method') {
      sawMethod = true
      emitMethod()
    } else if (block.kind === 'notes') {
      sawNotes = true
      emitNotes()
    } else if (block.kind === 'cooklog') {
      emitCookLog(block)
    }
  }

  if (!sawIngredients) emitIngredients()
  if (!sawMethod) emitMethod()
  if (!sawNotes) emitNotes()

  return finish(out)
}

// Collapse a run of empty lines and finish with exactly one line break.
function finish(out: string[]): string {
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n')
}
