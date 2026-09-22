import { describe, it, expect } from 'vitest'
import { splitMethodText, methodSteps } from '@/lib/view/method'

describe('splitMethodText', () => {
  it('returns nothing for empty text', () => {
    expect(splitMethodText('')).toEqual({ lead: [], items: [] })
  })

  it('reads numbered steps', () => {
    expect(splitMethodText('1. Mix it.\n2. Bake it.')).toEqual({
      lead: [],
      items: [
        { kind: 'step', text: 'Mix it.', number: 1 },
        { kind: 'step', text: 'Bake it.', number: 2 },
      ],
    })
  })

  it('keeps a wrapped line with the step above it', () => {
    expect(methodSteps(splitMethodText('1. Sweat the onion\n   until soft.\n2. Add tomato.'))).toEqual([
      'Sweat the onion\n   until soft.', 'Add tomato.',
    ])
  })

  it('treats a method with no numbered step as all lead', () => {
    expect(splitMethodText('Just cook it until done.')).toEqual({
      lead: ['Just cook it until done.'], items: [],
    })
  })

  it('accepts a closing bracket as the step marker', () => {
    expect(methodSteps(splitMethodText('1) Mix.\n2) Bake.'))).toEqual(['Mix.', 'Bake.'])
  })

  it('drops the blank lines that trail a step', () => {
    expect(methodSteps(splitMethodText('1. Mix.\n\n2. Bake.\n\n'))).toEqual(['Mix.', 'Bake.'])
  })
})

describe('splitMethodText with section headings', () => {
  // A heading above the first step is a section of the method, not a lead
  // line. The editor shows it, so the reader can change it.
  it('reads a heading above the first step as a section', () => {
    expect(splitMethodText('### For the sauce\n\n1. Sweat the onion.')).toEqual({
      lead: [],
      items: [
        { kind: 'heading', text: 'For the sauce' },
        { kind: 'step', text: 'Sweat the onion.', number: 1 },
      ],
    })
  })

  it('reads a heading between two steps', () => {
    const { items } = splitMethodText('1. Mix.\n\n### Bake\n\n1. Bake it.')
    expect(items).toEqual([
      { kind: 'step', text: 'Mix.', number: 1 },
      { kind: 'heading', text: 'Bake' },
      { kind: 'step', text: 'Bake it.', number: 1 },
    ])
  })

  // The number the reader sees comes from this function, not from the file.
  // A section starts again at 1, whatever numbers the file holds.
  it('starts the numbers again at each heading', () => {
    const { items } = splitMethodText(
      '### Dough\n\n1. Mix.\n2. Rest.\n\n### Bake\n\n5. Heat the oven.\n6. Bake it.',
    )
    expect(items.map((i) => (i.kind === 'step' ? i.number : i.text))).toEqual([
      'Dough', 1, 2, 'Bake', 1, 2,
    ])
  })

  it('does not let a heading take the wrapped lines of the step above it', () => {
    const { items } = splitMethodText('1. Sweat the onion\n   until soft.\n\n### Bake\n\n1. Bake it.')
    expect(items[0]).toEqual({ kind: 'step', text: 'Sweat the onion\n   until soft.', number: 1 })
    expect(items[1]).toEqual({ kind: 'heading', text: 'Bake' })
  })

  it('keeps a heading that holds no step at all', () => {
    expect(splitMethodText('### Nothing here').items).toEqual([
      { kind: 'heading', text: 'Nothing here' },
    ])
  })

  it('keeps prose above the first heading in the lead', () => {
    expect(splitMethodText('Read this first.\n\n### Dough\n\n1. Mix.')).toEqual({
      lead: ['Read this first.'],
      items: [
        { kind: 'heading', text: 'Dough' },
        { kind: 'step', text: 'Mix.', number: 1 },
      ],
    })
  })
})
