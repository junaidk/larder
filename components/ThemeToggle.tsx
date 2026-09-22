'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_THEME,
  THEME_KEY,
  otherTheme,
  resolveTheme,
  themeLabel,
  type Theme,
} from '@/lib/view/theme'

/**
 * Switch the page between the two themes.
 *
 * The button names the theme it switches to, as the collapse control names
 * the action it will take.
 */
export function ThemeToggle() {
  // The server renders the default theme. Reading storage while the first
  // render happens would disagree with the HTML the server sent, so the
  // stored choice arrives after the component mounts. The inline script in
  // the layout has already corrected the page itself by then.
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(THEME_KEY)
    } catch {
      /* private mode */
    }
    setTheme(resolveTheme(stored))
  }, [])

  function switchTo(next: Theme) {
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode */
    }
  }

  const next = otherTheme(theme)
  return (
    <button
      type="button"
      onClick={() => switchTo(next)}
      aria-label={`Switch to the ${next} theme`}
      title={`Switch to the ${next} theme`}
      className="no-print flex items-center gap-1.5 rounded border border-line px-3 py-1 text-sm text-ink-soft hover:text-ink"
    >
      <ThemeIcon theme={next} />
      {themeLabel(theme)}
    </button>
  )
}

/** A sun for the light theme, a moon for the dark one. */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}
