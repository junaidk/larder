import { describe, it, expect } from 'vitest'
import { buildMarkdown, emptyState, stateFromRecipe } from '@/lib/view/build'
import { parseRecipe } from '@/lib/recipe/parse'

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
