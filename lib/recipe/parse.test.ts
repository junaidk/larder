import { describe, it, expect } from 'vitest'
import { parseRecipe } from '@/lib/recipe/parse'
import { ingredientGroups, methodText, notesText, cookLog } from '@/lib/recipe/access'

const FULL = [
  '---',
  'title: Focaccia',
  'tags: [bread, italian]',
  'serves: 8',
  '---',
  '',
  '# Focaccia',
  '',
  'Dimpled and oily.',
  '',
  '## Ingredients',
  '',
  '- 500 g strong white flour',
  '- a good pinch of sea salt',
  '',
  '### For the topping',
  '',
  '- 3 tbsp olive oil',
  '',
  '## Method',
  '',
  '1. Mix the flour and water.',
  '2. Bake at 220C for 25 minutes.',
  '',
  '## Notes',
  '',
  'Use a metal tray.',
  '',
  '## Cook Log',
  '',
  '### 2026-09-14 — ★★★★☆',
  '',
  'Too salty.',
  '',
  '### 2026-08-02',
  '',
  'First attempt.',
  '',
].join('\n')

describe('parseRecipe', () => {
  it('reads the frontmatter', () => {
    const r = parseRecipe(FULL, 'focaccia')
    expect(r.frontmatter.title).toBe('Focaccia')
    expect(r.frontmatter.serves).toBe(8)
    expect(r.slug).toBe('focaccia')
    expect(r.eol).toBe('\n')
    expect(r.endsWithNewline).toBe(true)
  })

  it('keeps the text before the first section as a text block', () => {
    const r = parseRecipe(FULL, 'focaccia')
    expect(r.blocks[0].kind).toBe('text')
    const raw = (r.blocks[0] as { lines: string[] }).lines.join('\n')
    expect(raw).toContain('# Focaccia')
    expect(raw).toContain('Dimpled and oily.')
  })

  it('reads ingredient groups', () => {
    const groups = ingredientGroups(parseRecipe(FULL, 'focaccia'))
    expect(groups).toHaveLength(2)
    expect(groups[0].name).toBeNull()
    expect(groups[0].ingredients).toHaveLength(2)
    expect(groups[0].ingredients[0].item).toBe('strong white flour')
    expect(groups[0].ingredients[1].kind).toBe('text')
    expect(groups[1].name).toBe('For the topping')
    expect(groups[1].ingredients[0].unit).toBe('tbsp')
  })

  it('reads the method as raw text', () => {
    expect(methodText(parseRecipe(FULL, 'focaccia'))).toContain('Bake at 220C')
  })

  it('reads the notes as raw text', () => {
    expect(notesText(parseRecipe(FULL, 'focaccia'))).toContain('Use a metal tray.')
  })

  it('reads the cook log newest first with a rating', () => {
    const log = cookLog(parseRecipe(FULL, 'focaccia'))
    expect(log).toHaveLength(2)
    expect(log[0].date).toBe('2026-09-14')
    expect(log[0].rating).toBe(4)
    expect(log[0].note).toBe('Too salty.')
    expect(log[1].date).toBe('2026-08-02')
    expect(log[1].rating).toBeNull()
  })

  it('matches a heading name without regard to case', () => {
    const r = parseRecipe('## INGREDIENTS\n\n- 2 eggs\n', 'x')
    expect(ingredientGroups(r)[0].ingredients[0].item).toBe('eggs')
  })

  it('reads a file with no frontmatter', () => {
    const r = parseRecipe('# Toast\n\n## Method\n\n1. Toast it.\n', 'toast')
    expect(r.frontmatterRaw).toBeNull()
    expect(r.frontmatter.title).toBe('')
    expect(methodText(r)).toContain('Toast it.')
  })

  it('records Windows line endings', () => {
    const r = parseRecipe('# Toast\r\n\r\n## Method\r\n\r\n1. Toast it.\r\n', 'toast')
    expect(r.eol).toBe('\r\n')
  })

  it('records a file with no final line break', () => {
    expect(parseRecipe('# Toast', 'toast').endsWithNewline).toBe(false)
  })

  it('keeps an unknown section as a text block', () => {
    const r = parseRecipe('## Equipment\n\n- One tray\n', 'x')
    expect(r.blocks[0].kind).toBe('text')
  })

  it('gives null notes when the section is absent', () => {
    expect(notesText(parseRecipe('## Method\n\n1. Go.\n', 'x'))).toBeNull()
  })
})
