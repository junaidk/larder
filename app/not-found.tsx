import Link from 'next/link'

/**
 * Without this file Next.js serves its own error document for a missing
 * recipe. That document does not use the layout below `app/`, so the page
 * loses the fonts, the colours and the theme the reader chose.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <h1 className="font-serif text-3xl font-semibold text-ink">No such recipe</h1>
      <p className="mt-3 text-ink-soft">
        The address does not match a file in the recipe folder. A recipe that
        moved to another group has a new address.
      </p>
      <Link href="/" className="mt-6 inline-block text-ink-muted underline hover:text-ink">
        All recipes
      </Link>
    </main>
  )
}
