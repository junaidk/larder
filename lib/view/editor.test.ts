import { describe, it, expect } from 'vitest'
import {
  ingredientReadout,
  isMethodHeading,
  itemsToText,
  linesToText,
  textToItems,
  textToLines,
} from '@/lib/view/editor'

describe('the ingredients box', () => {
  it('goes to text and back without a change', () => {
    const lines = ['### Dough', '250 g flour', 'a good pinch of salt']
    expect(linesToText(lines)).toBe('### Dough\n250 g flour\na good pinch of salt')
    expect(textToLines(linesToText(lines))).toEqual(lines)
  })

  it('keeps a blank line the writer left between two groups', () => {
    expect(textToLines('250 g flour\n\n### To finish\n1 tbsp salt')).toEqual([
      '250 g flour', '', '### To finish', '1 tbsp salt',
    ])
  })

  it('reads an empty box as no lines', () => {
    expect(textToLines('')).toEqual([])
  })
})

describe('the method box', () => {
  // A blank line separates steps, so one step can still hold several lines.
  it('reads a blank line as the start of the next step', () => {
    expect(textToItems('Mix it.\n\nBake it.')).toEqual(['Mix it.', 'Bake it.'])
  })

  it('keeps the line breaks inside one step', () => {
    expect(textToItems('Mix it.\nThen wait.\n\nBake it.')).toEqual([
      'Mix it.\nThen wait.', 'Bake it.',
    ])
  })

  it('treats a line of spaces as a blank line', () => {
    expect(textToItems('Mix it.\n   \nBake it.')).toEqual(['Mix it.', 'Bake it.'])
  })

  it('drops the empty blocks at either end', () => {
    expect(textToItems('\n\nMix it.\n\n\n\nBake it.\n\n')).toEqual(['Mix it.', 'Bake it.'])
  })

  it('reads an empty box as no items', () => {
    expect(textToItems('')).toEqual([])
    expect(textToItems('\n\n  \n')).toEqual([])
  })

  it('goes to text and back without a change', () => {
    const items = ['### Dough', 'Mix it.\nThen wait.', 'Bake it.']
    expect(textToItems(itemsToText(items))).toEqual(items)
  })

  it('knows a heading from a step', () => {
    expect(isMethodHeading('### Dough')).toBe(true)
    expect(isMethodHeading('  ### Dough')).toBe(true)
    expect(isMethodHeading('Mix it.')).toBe(false)
    // A step that merely mentions a hash is not a heading.
    expect(isMethodHeading('Set the oven to gas mark ###')).toBe(false)
    // Two hashes is a section of the file, not of the method.
    expect(isMethodHeading('## Method')).toBe(false)
  })
})

describe('ingredientReadout', () => {
  it('counts what will scale and convert', () => {
    const r = ingredientReadout(['250 g flour', '5 g salt'])
    expect(r.total).toBe(2)
    expect(r.measured).toBe(2)
    expect(r.attention).toEqual([])
  })

  it('leaves a group heading and a blank line out of the count', () => {
    const r = ingredientReadout(['### Dough', '', '250 g flour'])
    expect(r.total).toBe(1)
    expect(r.measured).toBe(1)
  })

  // These two are the whole point of the readout: they are the lines that
  // will not answer a change of scale or of units.
  it('names a line that has no unit', () => {
    const r = ingredientReadout(['250 g flour', '2 eggs'])
    expect(r.counted).toBe(1)
    expect(r.attention).toEqual([
      { line: 2, text: '2 eggs', why: 'counted — no unit to convert' },
    ])
  })

  it('names a line that has no amount', () => {
    const r = ingredientReadout(['250 g flour', 'a good pinch of sea salt'])
    expect(r.textOnly).toBe(1)
    expect(r.attention).toEqual([
      { line: 2, text: 'a good pinch of sea salt', why: 'text only' },
    ])
  })

  it('gives the line number the writer sees in the box', () => {
    const r = ingredientReadout(['### Dough', '250 g flour', '', 'a pinch of salt'])
    expect(r.attention[0].line).toBe(4)
  })

  it('reads an empty box as nothing to report', () => {
    expect(ingredientReadout([])).toEqual({
      total: 0, measured: 0, counted: 0, textOnly: 0, attention: [],
    })
  })
})
