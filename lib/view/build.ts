import type { Block, Frontmatter, IngredientLine, Recipe } from '@/lib/recipe/types'
import { emptyFrontmatter } from '@/lib/recipe/types'
import { serializeFrontmatter } from '@/lib/recipe/frontmatter'
import { ingredientText, parseIngredientLine } from '@/lib/recipe/ingredient'
import { methodText, notesText } from '@/lib/recipe/access'
import { serializeRecipe } from '@/lib/recipe/serialize'

export interface EditorState {
  title: string
  tags: string[]
  serves: number | null
  prepTime: string
  cookTime: string
  source: string
  /** One entry per line. A `###` line starts an ingredient group. */
  ingredientLines: string[]
  /**
   * One entry per numbered step. A step keeps its wrapped continuation
   * lines, so the text of a step can hold a line break.
   */
  methodSteps: string[]
  /**
   * The method lines that come before the first numbered step, such as a
   * `###` sub-heading. The form does not show these lines. The build keeps
   * them at the top of the method.
   */
  methodLead: string[]
  notes: string
}

export function emptyState(): EditorState {
  return {
    title: '', tags: [], serves: null,
    prepTime: '', cookTime: '', source: '',
    ingredientLines: [''], methodSteps: [''], methodLead: [], notes: '',
  }
}

const GROUP_RE = /^###\s+/
const LIST_RE = /^\s*[-*+]\s+\S/
const TITLE_RE = /^#\s+/
/** A numbered step starts here. Every other line belongs to the step above. */
const STEP_RE = /^\s*\d+[.)]\s/

/** Read the method as a lead block and a list of steps. */
function readMethod(recipe: Recipe): { lead: string[]; steps: string[] } {
  const text = methodText(recipe)
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

function dropTrailingBlanks(step: string): string {
  const lines = step.split('\n')
  while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
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

  const { lead, steps } = readMethod(recipe)

  const fm = recipe.frontmatter
  let title = fm.title
  if (!title) {
    const first = recipe.blocks[0]
    if (first && first.kind === 'text') {
      const h1 = first.lines.find((l) => TITLE_RE.test(l))
      if (h1) title = h1.replace(TITLE_RE, '').trim()
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
    methodLead: lead,
    notes: notesText(recipe) ?? '',
  }
}

/**
 * Build the whole file.
 *
 * For an existing recipe the function edits the parsed `Recipe` in place
 * and then calls `serializeRecipe`. It rebuilds one of the four modelled
 * blocks only when the form value differs from the value that
 * `stateFromRecipe` read out of that same recipe. Every other block, the
 * cook log and the line endings therefore pass through without a change.
 */
export function buildMarkdown(state: EditorState, existing: Recipe | null, today: string): string {
  const fm = frontmatterFor(state, existing, today)
  return serializeRecipe(existing ? editRecipe(state, existing, fm) : newRecipe(state, fm))
}

function frontmatterFor(state: EditorState, existing: Recipe | null, today: string): Frontmatter {
  const fm = emptyFrontmatter(state.title.trim())
  fm.tags = state.tags.map((t) => t.trim()).filter(Boolean)
  fm.serves = state.serves
  fm.prep_time = state.prepTime.trim() || null
  fm.cook_time = state.cookTime.trim() || null
  fm.source = state.source.trim() || null
  // The app never invents a creation date for a file that it did not create.
  fm.created = existing ? existing.frontmatter.created : today
  fm.updated = today
  if (existing) fm.extra = existing.frontmatter.extra
  return fm
}

function newRecipe(state: EditorState, fm: Frontmatter): Recipe {
  const blocks: Block[] = [{ kind: 'text', lines: ['', `# ${fm.title}`, ''] }]

  const ingredients = cleanLines(state.ingredientLines)
  if (ingredients.length > 0) blocks.push(ingredientsBlock('## Ingredients', ingredients, new Map()))

  const steps = cleanSteps(state.methodSteps)
  const lead = state.methodLead ?? []
  if (steps.length > 0 || lead.length > 0) blocks.push(methodBlock('## Method', lead, steps, false))

  const notes = state.notes.trim()
  if (notes) blocks.push(notesBlock('## Notes', notes))

  trimTail(blocks[blocks.length - 1])

  return {
    slug: '',
    eol: '\n',
    endsWithNewline: true,
    frontmatter: fm,
    frontmatterRaw: serializeFrontmatter(fm).trimEnd(),
    blocks,
  }
}

function editRecipe(state: EditorState, existing: Recipe, fm: Frontmatter): Recipe {
  const base = stateFromRecipe(existing)

  const ingredients = cleanLines(state.ingredientLines)
  const ingredientsChanged = !same(ingredients, cleanLines(base.ingredientLines))

  const steps = cleanSteps(state.methodSteps)
  const lead = state.methodLead ?? []
  const methodChanged = !same(steps, cleanSteps(base.methodSteps)) || !same(lead, base.methodLead)

  const notes = state.notes.trim()
  const notesChanged = notes !== base.notes.trim()

  // The blocks that this function builds. Only these may be trimmed at the
  // end of the file. Every other block keeps the shape that the parser read.
  const fresh = new Set<Block>()
  const blocks: Block[] = []
  let sawIngredients = false
  let sawMethod = false
  let sawNotes = false

  for (const block of existing.blocks) {
    if (block.kind === 'ingredients') {
      sawIngredients = true
      if (!ingredientsChanged) { blocks.push(block); continue }
      if (ingredients.length === 0) continue
      keep(blocks, fresh, ingredientsBlock(block.headingLine, ingredients, proseOf(block)))
    } else if (block.kind === 'method') {
      sawMethod = true
      if (!methodChanged) { blocks.push(block); continue }
      if (steps.length === 0 && lead.length === 0) continue
      keep(blocks, fresh, methodBlock(block.headingLine, lead, steps, looseMethod(existing)))
    } else if (block.kind === 'notes') {
      sawNotes = true
      if (!notesChanged) { blocks.push(block); continue }
      if (notes === '') continue
      keep(blocks, fresh, notesBlock(block.headingLine, notes))
    } else {
      // A text block and the cook log pass through with no change.
      blocks.push(block)
    }
  }

  if (!sawIngredients && ingredients.length > 0) {
    insertSection(blocks, fresh, ingredientsBlock('## Ingredients', ingredients, new Map()))
  }
  if (!sawMethod && (steps.length > 0 || lead.length > 0)) {
    insertSection(blocks, fresh, methodBlock('## Method', lead, steps, false))
  }
  if (!sawNotes && notes) {
    insertSection(blocks, fresh, notesBlock('## Notes', notes))
  }

  if (fm.title !== base.title.trim()) retitle(blocks, fm.title)

  let frontmatterRaw = existing.frontmatterRaw
  if (frontmatterRaw === null || frontmatterChanged(fm, existing.frontmatter)) {
    frontmatterRaw = serializeFrontmatter(fm).trimEnd()
    // A file that had no frontmatter needs an empty line below the new fence.
    if (existing.frontmatterRaw === null) openWithBlankLine(blocks)
  }

  const last = blocks[blocks.length - 1]
  if (last && fresh.has(last)) trimTail(last)

  return {
    slug: existing.slug,
    eol: existing.eol,
    endsWithNewline: true,
    frontmatter: fm,
    frontmatterRaw,
    blocks,
  }
}

function keep(blocks: Block[], fresh: Set<Block>, block: Block): void {
  fresh.add(block)
  blocks.push(block)
}

/** The canonical order of the modelled sections. */
const RANK: Record<string, number> = { ingredients: 1, method: 2, notes: 3, cooklog: 4 }

/** Put a section that the file does not hold in its canonical place. */
function insertSection(blocks: Block[], fresh: Set<Block>, block: Block): void {
  const rank = RANK[block.kind]
  let at = blocks.length
  for (let i = 0; i < blocks.length; i += 1) {
    const other = RANK[blocks[i].kind]
    if (other !== undefined && other > rank) { at = i; break }
  }
  if (at > 0) blocks[at - 1] = withTrailingBlank(blocks[at - 1])
  fresh.add(block)
  blocks.splice(at, 0, block)
}

/** Return a copy of the block that ends with one empty line. */
function withTrailingBlank(block: Block): Block {
  if (block.kind === 'ingredients') {
    const last = block.lines[block.lines.length - 1]
    if (last && last.type === 'other' && last.raw.trim() === '') return block
    return { ...block, lines: [...block.lines, { type: 'other', raw: '' }] }
  }
  if (block.kind === 'cooklog') return block
  if (block.lines[block.lines.length - 1] === '') return block
  return { ...block, lines: [...block.lines, ''] }
}

/** Write the new title into the `# ` heading of the lead text block. */
function retitle(blocks: Block[], title: string): void {
  const first = blocks[0]
  if (!first || first.kind !== 'text') return
  const at = first.lines.findIndex((l) => TITLE_RE.test(l))
  if (at === -1) return
  const lines = [...first.lines]
  lines[at] = `# ${title}`
  blocks[0] = { kind: 'text', lines }
}

function openWithBlankLine(blocks: Block[]): void {
  const first = blocks[0]
  if (first && first.kind === 'text') blocks[0] = { kind: 'text', lines: ['', ...first.lines] }
  else blocks.unshift({ kind: 'text', lines: [''] })
}

function frontmatterChanged(next: Frontmatter, previous: Frontmatter): boolean {
  return next.title !== previous.title
    || next.tags.length !== previous.tags.length
    || next.tags.some((t, i) => t !== previous.tags[i])
    || next.serves !== previous.serves
    || next.prep_time !== previous.prep_time
    || next.cook_time !== previous.cook_time
    || next.source !== previous.source
    || next.created !== previous.created
    || next.updated !== previous.updated
}

/**
 * The lines of the `## Ingredients` section that the parser could not read
 * as a list item. The map goes from the trimmed text, which is what the
 * form holds, to the exact source line. The build writes such a line back
 * as the user typed it, with no `- ` marker.
 */
function proseOf(block: Extract<Block, { kind: 'ingredients' }>): Map<string, string> {
  const prose = new Map<string, string>()
  for (const line of block.lines) {
    if (line.type === 'other' && line.raw.trim() !== '') prose.set(line.raw.trim(), line.raw)
  }
  return prose
}

function ingredientsBlock(
  headingLine: string,
  lines: string[],
  prose: Map<string, string>,
): Block {
  const body: string[] = ['']
  for (const line of lines) {
    if (GROUP_RE.test(line)) body.push('', line, '')
    else body.push(prose.get(line) ?? `- ${line}`)
  }
  body.push('')
  return { kind: 'ingredients', headingLine, lines: collapse(body).map(toIngredientLine) }
}

function toIngredientLine(raw: string): IngredientLine {
  if (GROUP_RE.test(raw)) return { type: 'group', raw, name: raw.replace(GROUP_RE, '').trim() }
  if (LIST_RE.test(raw)) return { type: 'ingredient', ingredient: parseIngredientLine(raw) }
  return { type: 'other', raw }
}

/** True when the source method puts an empty line between two steps. */
function looseMethod(recipe: Recipe): boolean {
  return /\n[ \t]*\n[ \t]*\d+[.)]\s/.test(methodText(recipe))
}

function methodBlock(headingLine: string, lead: string[], steps: string[], loose: boolean): Block {
  const body: string[] = ['']
  if (lead.length > 0) body.push(...lead, '')
  steps.forEach((step, i) => {
    if (i > 0 && loose) body.push('')
    body.push(...`${i + 1}. ${step}`.split('\n'))
  })
  body.push('')
  return { kind: 'method', headingLine, lines: collapse(body) }
}

function notesBlock(headingLine: string, notes: string): Block {
  return { kind: 'notes', headingLine, lines: collapse(['', ...notes.split('\n'), '']) }
}

function cleanLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean)
}

/** Drop an empty step box. A step keeps its own line breaks and spacing. */
function cleanSteps(steps: string[]): string[] {
  return steps.filter((s) => s.trim() !== '')
}

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function collapse(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (line === '' && out[out.length - 1] === '') continue
    out.push(line)
  }
  return out
}

/** Remove the empty lines at the end of the last block of the file. */
function trimTail(block: Block | undefined): void {
  if (!block) return
  if (block.kind === 'cooklog') return
  if (block.kind === 'ingredients') {
    while (block.lines.length > 0) {
      const last = block.lines[block.lines.length - 1]
      if (last.type !== 'other' || last.raw.trim() !== '') break
      block.lines.pop()
    }
    return
  }
  while (block.lines.length > 0 && block.lines[block.lines.length - 1].trim() === '') block.lines.pop()
}
