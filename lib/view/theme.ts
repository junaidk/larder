export type Theme = 'light' | 'dark'

/** The choice sits beside the other view preferences in browser storage. */
export const THEME_KEY = 'larder:theme'

/** A first visit opens dark. */
export const DEFAULT_THEME: Theme = 'dark'

/**
 * Turn a stored value into a theme.
 *
 * Browser storage holds a string that anyone can edit, and it is empty on a
 * first visit. A value we do not know must never reach the data-theme
 * attribute: the stylesheet gives colours to "light" and "dark" only, so any
 * other value leaves the page with no colours at all.
 */
export function resolveTheme(stored: string | null | undefined): Theme {
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME
}

/** The theme the control switches to. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

/**
 * The control reads as the action it will take, as the collapse control does.
 * In the dark theme the control says "Light", because that is where it goes.
 */
export function themeLabel(theme: Theme): string {
  return otherTheme(theme) === 'dark' ? 'Dark' : 'Light'
}
