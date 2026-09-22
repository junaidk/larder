import { describe, it, expect } from 'vitest'
import { DEFAULT_THEME, THEME_KEY, resolveTheme, otherTheme, themeLabel } from '@/lib/view/theme'

describe('resolveTheme', () => {
  it('keeps a stored choice', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  // A first visit has nothing stored. The app opens dark.
  it('falls back to the default when nothing is stored', () => {
    expect(resolveTheme(null)).toBe(DEFAULT_THEME)
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME)
    expect(resolveTheme('')).toBe(DEFAULT_THEME)
  })

  // Storage is a string the user can edit. A value we do not know must not
  // reach the data-theme attribute, or the page loses every colour.
  it('falls back to the default for a value it does not know', () => {
    expect(resolveTheme('sepia')).toBe(DEFAULT_THEME)
    expect(resolveTheme('DARK')).toBe(DEFAULT_THEME)
    expect(resolveTheme('{}')).toBe(DEFAULT_THEME)
  })
})

describe('otherTheme', () => {
  it('gives the theme the control switches to', () => {
    expect(otherTheme('dark')).toBe('light')
    expect(otherTheme('light')).toBe('dark')
  })
})

describe('themeLabel', () => {
  // The control reads as the action it will take, as the collapse control does.
  it('names the theme the control switches to', () => {
    expect(themeLabel('dark')).toBe('Light')
    expect(themeLabel('light')).toBe('Dark')
  })
})

describe('the default and the key', () => {
  it('opens dark and stores the choice beside the other view preferences', () => {
    expect(DEFAULT_THEME).toBe('dark')
    expect(THEME_KEY).toBe('larder:theme')
  })
})
