import { describe, it, expect } from 'vitest'
import { isGroupOpen, collapseAllLabel, toggled } from '@/lib/view/collapse'

describe('isGroupOpen', () => {
  it('opens a group that is not collapsed', () => {
    expect(isGroupOpen('breads', [], false)).toBe(true)
    expect(isGroupOpen('breads', ['desserts'], false)).toBe(true)
  })

  it('closes a collapsed group', () => {
    expect(isGroupOpen('breads', ['breads'], false)).toBe(false)
  })

  // A collapsed group would otherwise hide its own search hits, which reads
  // as though the search found nothing.
  it('opens every group while a filter is active', () => {
    expect(isGroupOpen('breads', ['breads'], true)).toBe(true)
    expect(isGroupOpen('breads', ['breads', 'desserts'], true)).toBe(true)
  })

  it('keeps the collapsed set, so clearing a filter restores it', () => {
    const collapsed = ['breads']
    expect(isGroupOpen('breads', collapsed, true)).toBe(true)
    expect(isGroupOpen('breads', collapsed, false)).toBe(false)
    expect(collapsed).toEqual(['breads'])
  })
})

describe('collapseAllLabel', () => {
  it('offers to collapse while anything is open', () => {
    expect(collapseAllLabel(['breads', 'desserts'], [], false)).toBe('Collapse all')
    expect(collapseAllLabel(['breads', 'desserts'], ['breads'], false)).toBe('Collapse all')
  })

  it('offers to expand once everything is closed', () => {
    expect(collapseAllLabel(['breads', 'desserts'], ['breads', 'desserts'], false)).toBe('Expand all')
  })

  it('offers to collapse when there are no groups at all', () => {
    expect(collapseAllLabel([], [], false)).toBe('Collapse all')
  })

  it('ignores a collapsed name that is no longer a group', () => {
    expect(collapseAllLabel(['breads'], ['breads', 'gone'], false)).toBe('Expand all')
  })

  // A filter opens every group, so the button must not offer to expand what
  // the reader can already see.
  it('offers to collapse while a filter is active, whatever is collapsed', () => {
    expect(collapseAllLabel(['breads'], ['breads'], true)).toBe('Collapse all')
    expect(collapseAllLabel(['breads', 'desserts'], ['breads', 'desserts'], true)).toBe('Collapse all')
  })
})

describe('toggled', () => {
  it('collapses an open group', () => {
    expect(toggled(['desserts'], 'breads')).toEqual(['desserts', 'breads'])
  })

  it('opens a collapsed group', () => {
    expect(toggled(['breads', 'desserts'], 'breads')).toEqual(['desserts'])
  })

  it('does not change the array it is given', () => {
    const before = ['breads']
    toggled(before, 'desserts')
    expect(before).toEqual(['breads'])
  })
})
