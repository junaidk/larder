import { describe, it, expect } from 'vitest'
import { splitMethodText } from '@/lib/view/method'

describe('splitMethodText', () => {
  it('returns nothing for empty text', () => {
    expect(splitMethodText('')).toEqual({ lead: [], steps: [] })
  })

  it('reads numbered steps', () => {
    expect(splitMethodText('1. Mix it.\n2. Bake it.')).toEqual({
      lead: [], steps: ['Mix it.', 'Bake it.'],
    })
  })

  it('keeps a wrapped line with the step above it', () => {
    expect(splitMethodText('1. Sweat the onion\n   until soft.\n2. Add tomato.').steps).toEqual([
      'Sweat the onion\n   until soft.', 'Add tomato.',
    ])
  })

  it('puts the text before the first step in the lead', () => {
    expect(splitMethodText('### For the sauce\n\n1. Sweat the onion.')).toEqual({
      lead: ['### For the sauce'], steps: ['Sweat the onion.'],
    })
  })

  it('treats a method with no numbered step as all lead', () => {
    expect(splitMethodText('Just cook it until done.')).toEqual({
      lead: ['Just cook it until done.'], steps: [],
    })
  })

  it('accepts a closing bracket as the step marker', () => {
    expect(splitMethodText('1) Mix.\n2) Bake.').steps).toEqual(['Mix.', 'Bake.'])
  })

  it('drops the blank lines that trail a step', () => {
    expect(splitMethodText('1. Mix.\n\n2. Bake.\n\n').steps).toEqual(['Mix.', 'Bake.'])
  })
})
