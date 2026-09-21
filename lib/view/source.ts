const SCHEME = /^https?:\/\/\S+$/i
// A bare host such as www.example.com/recipe, with no spaces.
const BARE_HOST = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?$/i

/**
 * The address to link a source to, or null when the source names a person, a
 * book or a note rather than a page.
 */
export function sourceLink(source: string): string | null {
  const value = source.trim()
  if (!value || /\s/.test(value)) return null
  if (SCHEME.test(value)) return value
  if (BARE_HOST.test(value)) return `https://${value}`
  return null
}
