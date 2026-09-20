import Link from 'next/link'
import { listRecipes } from '@/lib/storage/index'
import { RecipeIndex } from '@/components/RecipeIndex'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const recipes = await listRecipes()
  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipe Register</h1>
        <Link
          href="/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          New recipe
        </Link>
      </header>
      <RecipeIndex recipes={recipes} />
    </main>
  )
}
