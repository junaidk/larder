import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { readRecipe } from '@/lib/storage/index'
import { cookLog, ingredientGroups, methodText, notesText } from '@/lib/recipe/access'
import { displayIngredient } from '@/lib/view/display'
import { convertMethodText } from '@/lib/units/convert'
import { readViewParams } from '@/lib/view/params'
import { ViewControls } from '@/components/ViewControls'
import { CookLogForm } from '@/components/CookLogForm'
import { DeleteLogEntry } from '@/components/DeleteLogEntry'
import { Stars } from '@/components/Stars'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { slug } = await params
  const recipe = await readRecipe(slug)
  if (!recipe) notFound()

  const view = readViewParams(await searchParams, recipe.frontmatter.serves)
  const groups = ingredientGroups(recipe)
  const log = cookLog(recipe)
  const notes = notesText(recipe)

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <nav className="mb-6 flex items-center justify-between text-sm">
        <Link href="/" className="text-stone-500 hover:underline">All recipes</Link>
        <Link href={`/r/${slug}/edit`} className="text-stone-500 hover:underline">Edit</Link>
      </nav>

      <h1 className="text-3xl font-semibold">{recipe.frontmatter.title || slug}</h1>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-600">
        {recipe.frontmatter.serves !== null && <div><dt className="inline">Serves </dt><dd className="inline">{recipe.frontmatter.serves}</dd></div>}
        {recipe.frontmatter.prep_time && <div><dt className="inline">Prep </dt><dd className="inline">{recipe.frontmatter.prep_time}</dd></div>}
        {recipe.frontmatter.cook_time && <div><dt className="inline">Cook </dt><dd className="inline">{recipe.frontmatter.cook_time}</dd></div>}
        {recipe.frontmatter.source && <div><dt className="inline">Source </dt><dd className="inline">{recipe.frontmatter.source}</dd></div>}
      </dl>

      <div className="my-6 border-y border-stone-200 py-4">
        <Suspense fallback={null}>
          <ViewControls serves={recipe.frontmatter.serves} />
        </Suspense>
      </div>

      <section>
        <h2 className="text-xl font-medium">Ingredients</h2>
        {groups.map((group, i) => (
          <div key={i} className="mt-3">
            {group.name && <h3 className="text-sm font-medium text-stone-600">{group.name}</h3>}
            <ul className="mt-1 space-y-1">
              {group.ingredients.map((ingredient, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-stone-300">·</span>
                  <span>{displayIngredient(ingredient, view)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">Method</h2>
        <pre className="mt-3 whitespace-pre-wrap font-sans">
          {convertMethodText(methodText(recipe), view.system)}
        </pre>
      </section>

      {notes && (
        <section className="mt-8">
          <h2 className="text-xl font-medium">Notes</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans">{notes}</pre>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Cook log</h2>
        </div>
        <CookLogForm slug={slug} />
        {log.length === 0 && <p className="mt-3 text-stone-500">No entry yet.</p>}
        <ol className="mt-3 space-y-4">
          {log.map((entry, i) => (
            <li key={`${entry.date}-${i}`} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex items-center gap-3 text-sm">
                <time className="font-medium">{entry.date}</time>
                <Stars rating={entry.rating} />
                <span className="ml-auto">
                  <DeleteLogEntry slug={slug} index={i} date={entry.date} />
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-stone-700">{entry.note}</pre>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
