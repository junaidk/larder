'use client'

import { useEffect } from 'react'
import { THEME_KEY, resolveTheme } from '@/lib/view/theme'

/**
 * Apply the stored theme once the page is running.
 *
 * The inline script in the layout already does this before the first paint,
 * and it handles every page the server renders as HTML. It cannot handle one
 * case: a page that Next.js streams after it has flushed its shell, such as
 * the not-found page of a dynamic route. React renders that content on the
 * client, and React does not run a script that arrives that way.
 *
 * This effect closes that gap. On every other page it finds the attribute
 * already correct and changes nothing.
 */
export function ThemeSync() {
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(THEME_KEY)
    } catch {
      /* private mode */
    }
    document.documentElement.dataset.theme = resolveTheme(stored)
  }, [])

  return null
}
