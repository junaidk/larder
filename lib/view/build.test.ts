import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildMarkdown, emptyState, stateFromRecipe } from '@/lib/view/build'
import { parseRecipe } from '@/lib/recipe/parse'
import { serializeRecipe } from '@/lib/recipe/serialize'

describe('buildMarkdown', () => {
  it('writes a whole file from an empty state', () => {
    const state = emptyState()
    state.title = 'Focaccia'
    state.tags = ['bread']
    state.serves = 8
    state.ingredientLines = ['500 g strong white flour', 'a good pinch of sea salt']
    state.methodSteps = ['Mix the flour and water.', 'Bake at 220C.']

    expect(buildMarkdown(state, null, '2026-09-20')).toBe([
      '---',
      'title: Focaccia',
      'tags: [bread]',
      'serves: 8',
      'created: 2026-09-20',
      'updated: 2026-09-20',
      '---',
      '',
      '# Focaccia',
      '',
      '## Ingredients',
      '',
      '- 500 g strong white flour',
      '- a good pinch of sea salt',
      '',
      '## Method',
      '',
      '1. Mix the flour and water.',
      '2. Bake at 220C.',
      '',
    ].join('\n'))
  })

  it('adds a notes section only when there is a note', () => {
    const state = emptyState()
    state.title = 'X'
    state.notes = 'Use a metal tray.'
    expect(buildMarkdown(state, null, '2026-09-20')).toContain('## Notes\n\nUse a metal tray.\n')
  })

  it('drops an empty ingredient line and an empty step', () => {
    const state = emptyState()
    state.title = 'X'
    state.ingredientLines = ['2 eggs', '', '   ']
    state.methodSteps = ['Go.', '']
    const out = buildMarkdown(state, null, '2026-09-20')
    expect(out).toContain('- 2 eggs\n\n## Method')
    expect(out).toContain('1. Go.')
    expect(out).not.toContain('2. ')
  })

  it('keeps the cook log of the existing file', () => {
    const source = [
      '---', 'title: Old', '---', '', '# Old', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Method', '', '1. Go.', '',
      '## Cook Log', '', '### 2026-08-02 — ★★★★☆', '', 'Good.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'old')
    const state = stateFromRecipe(existing)
    state.title = 'New'

    const out = buildMarkdown(state, existing, '2026-09-21')
    expect(out).toContain('## Cook Log\n\n### 2026-08-02 — ★★★★☆\n\nGood.\n')
    expect(out).toContain('title: New')
  })

  it('keeps the created date and moves the updated date', () => {
    const source = '---\ntitle: X\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\n## Method\n\n1. Go.\n'
    const existing = parseRecipe(source, 'x')
    const out = buildMarkdown(stateFromRecipe(existing), existing, '2026-09-21')
    expect(out).toContain('created: 2026-01-01')
    expect(out).toContain('updated: 2026-09-21')
  })

  it('keeps the description text below the title of the existing file', () => {
    const source = [
      '---', 'title: Focaccia', '---', '',
      '# Focaccia', '',
      'Dimpled, oily, and best on the day.', '',
      '## Ingredients', '', '- 500 g flour', '',
    ].join('\n')
    const existing = parseRecipe(source, 'focaccia')
    const state = stateFromRecipe(existing)
    state.title = 'Focaccia Two'

    const out = buildMarkdown(state, existing, '2026-09-21')
    expect(out).toContain('# Focaccia Two\n\nDimpled, oily, and best on the day.\n\n## Ingredients')
  })

  it('keeps an ingredient group heading', () => {
    const state = emptyState()
    state.title = 'X'
    state.ingredientLines = ['500 g flour', '### For the topping', '3 tbsp olive oil']
    const out = buildMarkdown(state, null, '2026-09-20')
    expect(out).toContain('- 500 g flour\n\n### For the topping\n\n- 3 tbsp olive oil')
  })

  it('keeps an unmodelled section between Ingredients and Method in its original position', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Equipment', '', 'A stand mixer.', '',
      '## Method', '', '1. Go.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)

    const out = buildMarkdown(state, existing, '2026-09-21')

    expect(out).toContain('## Equipment\n\nA stand mixer.\n')
    const ingredientsAt = out.indexOf('## Ingredients')
    const equipmentAt = out.indexOf('## Equipment')
    const methodAt = out.indexOf('## Method')
    expect(ingredientsAt).toBeGreaterThan(-1)
    expect(equipmentAt).toBeGreaterThan(ingredientsAt)
    expect(methodAt).toBeGreaterThan(equipmentAt)
  })

  it('keeps two unmodelled sections, one before Ingredients and one after Cook Log', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Intro', '', 'Some background.', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Method', '', '1. Go.', '',
      '## Cook Log', '', '### 2026-08-02 — ★★★★☆', '', 'Good.', '',
      '## Wine pairing', '', 'A dry white wine.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)

    const out = buildMarkdown(state, existing, '2026-09-21')

    expect(out).toContain('## Intro\n\nSome background.\n')
    expect(out).toContain('## Wine pairing\n\nA dry white wine.\n')

    const introAt = out.indexOf('## Intro')
    const ingredientsAt = out.indexOf('## Ingredients')
    const cookLogAt = out.indexOf('## Cook Log')
    const winePairingAt = out.indexOf('## Wine pairing')
    expect(introAt).toBeGreaterThan(-1)
    expect(ingredientsAt).toBeGreaterThan(introAt)
    expect(winePairingAt).toBeGreaterThan(cookLogAt)
  })

  it('keeps the title of a file with no frontmatter on a load-then-save', () => {
    const source = readFileSync(join(process.cwd(), 'lib/recipe/fixtures/no-frontmatter.md'), 'utf8')
    const existing = parseRecipe(source, 'cheese-toast')
    const state = stateFromRecipe(existing)
    expect(state.title).toBe('Cheese Toast')

    const out = buildMarkdown(state, existing, '2026-09-21')
    expect(out).toContain('title: Cheese Toast')
    expect(out).toContain('# Cheese Toast\n')
  })

  it('builds a brand new recipe from the template, unchanged, when existing is null', () => {
    const state = emptyState()
    state.title = 'Focaccia'
    state.tags = ['bread']
    state.serves = 8
    state.ingredientLines = ['500 g strong white flour']
    state.methodSteps = ['Mix the flour and water.']
    state.notes = 'Use a metal tray.'

    expect(buildMarkdown(state, null, '2026-09-20')).toBe([
      '---',
      'title: Focaccia',
      'tags: [bread]',
      'serves: 8',
      'created: 2026-09-20',
      'updated: 2026-09-20',
      '---',
      '',
      '# Focaccia',
      '',
      '## Ingredients',
      '',
      '- 500 g strong white flour',
      '',
      '## Method',
      '',
      '1. Mix the flour and water.',
      '',
      '## Notes',
      '',
      'Use a metal tray.',
      '',
    ].join('\n'))
  })
})

describe('stateFromRecipe', () => {
  it('reads a file back into the form', () => {
    const source = [
      '---', 'title: Focaccia', 'tags: [bread, italian]', 'serves: 8', '---', '',
      '# Focaccia', '',
      '## Ingredients', '', '- 500 g flour', '', '### For the topping', '', '- 3 tbsp oil', '',
      '## Method', '', '1. Mix.', '2. Bake.', '',
      '## Notes', '', 'Use a metal tray.', '',
    ].join('\n')

    const state = stateFromRecipe(parseRecipe(source, 'focaccia'))
    expect(state.title).toBe('Focaccia')
    expect(state.tags).toEqual(['bread', 'italian'])
    expect(state.serves).toBe(8)
    expect(state.ingredientLines).toEqual(['500 g flour', '### For the topping', '3 tbsp oil'])
    expect(state.methodSteps).toEqual(['Mix.', 'Bake.'])
    expect(state.notes).toBe('Use a metal tray.')
  })

  it('keeps a line that the parser cannot read', () => {
    const source = '---\ntitle: X\n---\n\n## Ingredients\n\n- salt and pepper\n'
    expect(stateFromRecipe(parseRecipe(source, 'x')).ingredientLines).toEqual(['salt and pepper'])
  })
})

describe('buildMarkdown keeps what the form does not model', () => {
  const TODAY = '2026-09-20'

  it('keeps the prose between the Cook Log heading and the first entry', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Method', '', '1. Go.', '',
      '## Cook Log', '',
      'I keep the oven notes here.', '',
      '### 2026-08-02 — ★★★★☆', '', 'Good.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    state.title = 'Y'

    const out = buildMarkdown(state, existing, TODAY)
    expect(out).toContain('## Cook Log\n\nI keep the oven notes here.\n\n### 2026-08-02 — ★★★★☆\n\nGood.\n')
  })

  it('keeps a Cook Log that holds prose but no dated entry', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Method', '', '1. Go.', '',
      '## Cook Log', '', 'Not cooked yet.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')

    const out = buildMarkdown(stateFromRecipe(existing), existing, TODAY)
    expect(out).toContain('## Cook Log\n\nNot cooked yet.\n')
  })

  it('keeps a method sub-heading and a wrapped step, with no renumbering', () => {
    const method = [
      '## Method', '',
      '### For the sauce', '',
      '1. Sweat the onion',
      '   until soft.',
      '2. Add tomato.', '',
    ]
    const source = ['---', 'title: X', 'updated: 2026-09-20', '---', '', '# X', '', ...method].join('\n')
    const existing = parseRecipe(source, 'x')

    const state = stateFromRecipe(existing)
    expect(state.methodSteps).toEqual(['Sweat the onion\n   until soft.', 'Add tomato.'])
    expect(state.methodLead).toEqual(['### For the sauce'])

    expect(buildMarkdown(state, existing, TODAY)).toBe(source)
  })

  it('keeps Windows line endings', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Method', '', '1. Go.', '',
    ].join('\n').replace(/\n/g, '\r\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    state.methodSteps = ['Go.', 'Rest.']

    const out = buildMarkdown(state, existing, TODAY)
    expect(out).toContain('\r\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
    expect(out).toContain('## Method\r\n\r\n1. Go.\r\n2. Rest.\r\n')
  })

  it('does not put a list marker on a prose line inside Ingredients', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '',
      'All weights are for the dough.', '',
      '- 500 g flour', '',
      '## Method', '', '1. Go.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    state.ingredientLines = [...state.ingredientLines, '2 eggs']

    const out = buildMarkdown(state, existing, TODAY)
    expect(out).toContain('All weights are for the dough.')
    expect(out).not.toContain('- All weights are for the dough.')
    expect(out).toContain('- 2 eggs')
  })

  it('puts a new Method section before the Cook Log, with an empty line above it', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Cook Log', '', '### 2026-08-02 — ★★★★☆', '', 'Good.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    state.methodSteps = ['Mix it.']

    const out = buildMarkdown(state, existing, TODAY)
    expect(out.indexOf('## Method')).toBeGreaterThan(-1)
    expect(out.indexOf('## Method')).toBeLessThan(out.indexOf('## Cook Log'))
    expect(out).toContain('- 2 eggs\n\n## Method\n\n1. Mix it.\n\n## Cook Log\n')
    expect(out).not.toContain('Good.\n## Method')
  })
})

describe('the last three findings before merge', () => {
  const TODAY = '2026-09-20'

  it('does not re-space a tight method that has a lead block', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Method', '',
      '### Stage one', '',
      '1. A.', '2. B.', '3. C.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    expect(state.methodLead).toEqual(['### Stage one'])
    expect(state.methodSteps).toEqual(['A.', 'B.', 'C.'])

    // Edit one step only. The other steps must keep their original,
    // tight spacing: no blank line inserted between them.
    state.methodSteps = ['A.', 'B2.', 'C.']

    const out = buildMarkdown(state, existing, TODAY)
    expect(out).toContain('### Stage one\n\n1. A.\n2. B2.\n3. C.\n')
  })

  it('rebuilds only the first of two duplicate Ingredients sections', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '', '- 2 eggs', '',
      '## Ingredients', '', '- 1 onion', '',
      '## Method', '', '1. Go.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    expect(state.ingredientLines).toEqual(['2 eggs'])

    state.ingredientLines = ['3 eggs']
    const out = buildMarkdown(state, existing, TODAY)

    // The first section takes the edit. The second, untouched section
    // stays byte-identical to the source: `- 1 onion` is not destroyed.
    expect(out).toContain('## Ingredients\n\n- 3 eggs\n\n## Ingredients\n\n- 1 onion\n')
  })

  it('tells apart a prose line from a real ingredient that reads the same', () => {
    const source = [
      '---', 'title: X', '---', '',
      '# X', '',
      '## Ingredients', '',
      '2 eggs',
      '- 2 eggs',
      '- 1 onion', '',
      '## Method', '', '1. Go.', '',
    ].join('\n')
    const existing = parseRecipe(source, 'x')
    const state = stateFromRecipe(existing)
    expect(state.ingredientLines).toEqual(['2 eggs', '2 eggs', '1 onion'])

    // Edit a different ingredient to force a rebuild of the section.
    state.ingredientLines = ['2 eggs', '2 eggs', '2 onions']
    const out = buildMarkdown(state, existing, TODAY)

    // The prose line keeps no marker. The real ingredient, which reads
    // the same, keeps its `- ` marker and so stays a parsed ingredient.
    expect(out).toContain('## Ingredients\n\n2 eggs\n- 2 eggs\n- 2 onions\n')
  })
})

describe('a load-then-save with no edits', () => {
  const DIR = join(process.cwd(), 'lib/recipe/fixtures')
  const FILES = readdirSync(DIR).filter((f) => f.endsWith('.md'))

  /** The app owns `updated`. Every save writes it. Drop it from a compare. */
  function withoutUpdated(text: string): string {
    return text.replace(/^updated: \d{4}-\d{2}-\d{2}[ \t]*\r?\n/m, '')
  }

  it('covers all seven fixtures', () => {
    expect(FILES).toHaveLength(7)
  })

  it.each(FILES)('returns %s unchanged apart from the updated line', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8')
    const recipe = parseRecipe(source, 'fixture')
    const state = stateFromRecipe(recipe)
    const out = buildMarkdown(state, recipe, '2026-09-20')

    // A file with no frontmatter gains a frontmatter block, because the app
    // owns the title and the dates. Everything below the fence stays the same.
    const expected = recipe.frontmatterRaw === null
      ? `---\ntitle: ${state.title}\n---\n\n${source}`
      : source

    expect(withoutUpdated(out)).toBe(withoutUpdated(expected))
  })

  // The editor shows this text and `saveRecipeAction` parses the same text
  // before it writes. The two must give the same bytes.
  it.each(FILES)('writes back the preview of %s without a change', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8')
    const recipe = parseRecipe(source, 'fixture')
    const state = stateFromRecipe(recipe)
    state.title = 'A New Title'
    state.methodSteps = [...state.methodSteps, 'Rest for ten minutes.']

    const out = buildMarkdown(state, recipe, '2026-09-21')
    expect(serializeRecipe(parseRecipe(out, 'fixture'))).toBe(out)
  })
})
