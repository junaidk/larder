import { describe, it, expect } from 'vitest'
import { sourceLink } from '@/lib/view/source'

describe('sourceLink', () => {
  it.each([
    'https://example.com/focaccia',
    'http://example.com/a?b=c&d=e',
    'https://www.youtube.com/watch?v=HKe8af9xsiE',
  ])('reads %s as a link', (value) => {
    expect(sourceLink(value)).toBe(value)
  })

  it('adds a scheme to a bare host', () => {
    expect(sourceLink('www.example.com/recipe')).toBe('https://www.example.com/recipe')
  })

  // Several recipes name a person or a book rather than a page.
  it.each([
    'Derived from above two links.',
    'Mum',
    'Gordon Ramsay, page 42',
    '',
    '   ',
  ])('reads %s as plain text', (value) => {
    expect(sourceLink(value)).toBeNull()
  })

  it('does not treat a sentence holding a word with a dot as a link', () => {
    expect(sourceLink('See notes.md for the rest')).toBeNull()
  })
})
