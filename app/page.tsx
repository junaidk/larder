import Link from 'next/link'
import { listRecipes } from '@/lib/storage/index'
import { RecipeIndex } from '@/components/RecipeIndex'
import { ThemeToggle } from '@/components/ThemeToggle'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { recipes } = await listRecipes()
  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Larder</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/new"
            className="rounded bg-invert-surface px-4 py-2 text-sm text-invert-ink hover:bg-invert-surface-hover"
          >
            New recipe
          </Link>
        </div>
      </header>
      <RecipeIndex recipes={recipes} />
    </main>
  )
}
