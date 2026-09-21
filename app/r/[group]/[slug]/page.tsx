import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readRecipe } from '@/lib/storage/index'
import { cookLog, ingredientGroups, methodText, notesText } from '@/lib/recipe/access'
import { displayIngredient, displayIngredientParts } from '@/lib/view/display'
import { convertMethodText } from '@/lib/units/convert'
import { splitMethodText } from '@/lib/view/method'
import { readViewParams } from '@/lib/view/params'
import { RecipeLayout } from '@/components/RecipeLayout'
import { CookLogForm } from '@/components/CookLogForm'
import { DeleteLogEntry } from '@/components/DeleteLogEntry'
import { IngredientList } from '@/components/IngredientList'
import { MethodSteps } from '@/components/MethodSteps'
import { Stars } from '@/components/Stars'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ group: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { group, slug } = await params
  const ref = { group, slug }
  const recipe = await readRecipe(ref)
  if (!recipe) notFound()

  const view = readViewParams(await searchParams, recipe.frontmatter.serves)
  const fm = recipe.frontmatter
  const log = cookLog(recipe)
  const notes = notesText(recipe)
  const lead = recipe.blocks.find((b) => b.kind === 'text')

  // The parts are built here, on the server, so the tickable lists stay
  // small client components holding plain strings.
  const groups = ingredientGroups(recipe).map((g) => ({
    name: g.name,
    ingredients: g.ingredients.map((i) => ({
      ...displayIngredientParts(i, view),
      line: displayIngredient(i, view),
    })),
  }))

  const method = splitMethodText(convertMethodText(methodText(recipe), view.system))

  // Everything after the "# Title" line, which the heading already shows.
  const description = lead && lead.kind === 'text'
    ? lead.lines.filter((l) => !l.startsWith('# ')).join('\n').trim()
    : ''

  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <nav className="no-print mb-8 flex items-center justify-between font-sans text-sm">
        <Link href="/" className="text-stone-500 hover:underline">All recipes</Link>
        <Link href={`/r/${group}/${slug}/edit`} className="text-stone-500 hover:underline">Edit</Link>
      </nav>

      <header className="max-w-2xl">
        <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-stone-900">
          {fm.title || slug}
        </h1>

        {description && (
          <p className="mt-4 font-serif text-lg leading-relaxed text-stone-600">{description}</p>
        )}

        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm text-stone-500">
          {fm.serves !== null && <div><dt className="inline">Serves </dt><dd className="inline text-stone-700">{fm.serves}</dd></div>}
          {fm.prep_time && <div><dt className="inline">Prep </dt><dd className="inline text-stone-700">{fm.prep_time}</dd></div>}
          {fm.cook_time && <div><dt className="inline">Cook </dt><dd className="inline text-stone-700">{fm.cook_time}</dd></div>}
          {fm.source && <div><dt className="inline">Source </dt><dd className="inline text-stone-700">{fm.source}</dd></div>}
        </dl>
      </header>

      <RecipeLayout
        ingredients={
          <section className="recipe-ingredients">
            <h2 className="mb-4 font-sans text-xs font-medium tracking-widest text-stone-400 uppercase">
              Ingredients
            </h2>
            <IngredientList groups={groups} />
          </section>
        }
        body={
          <div className="min-w-0">
            <section className="lg:min-h-80">
              <h2 className="mb-4 font-sans text-xs font-medium tracking-widest text-stone-400 uppercase">
                Method
              </h2>
              <MethodSteps lead={method.lead} steps={method.steps} />
            </section>

            {notes && (
              <section className="mt-10 rounded-lg border border-stone-200 bg-white p-5">
                <h2 className="mb-3 font-sans text-xs font-medium tracking-widest text-stone-400 uppercase">
                  Notes
                </h2>
                <div className="font-serif leading-relaxed whitespace-pre-wrap text-stone-700">
                  {notes}
                </div>
              </section>
            )}

            <section className="no-print mt-12">
              <CookLogForm recipe={ref} />
              {log.length === 0 && <p className="mt-3 font-sans text-sm text-stone-500">No entry yet.</p>}
              <ol className="mt-4 space-y-4">
                {log.map((entry, i) => (
                  <li key={`${entry.date}-${i}`} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex items-center gap-3 font-sans text-sm">
                      <time className="font-medium text-stone-700">{entry.date}</time>
                      <Stars rating={entry.rating} />
                      <span className="ml-auto">
                        <DeleteLogEntry recipe={ref} index={i} date={entry.date} />
                      </span>
                    </div>
                    <div className="mt-2 font-serif leading-relaxed whitespace-pre-wrap text-stone-700">
                      {entry.note}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        }
      />
    </main>
  )
}
