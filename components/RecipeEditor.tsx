'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { EditorState } from '@/lib/view/build'
import { buildMarkdown } from '@/lib/view/build'
import type { Recipe, RecipeRef } from '@/lib/recipe/types'
import { saveRecipeAction } from '@/app/actions'
import { EditorPreview } from '@/components/EditorPreview'
import {
  ingredientReadout,
  isMethodHeading,
  itemsToText,
  linesToText,
  textToItems,
  textToLines,
} from '@/lib/view/editor'

export function RecipeEditor({
  initial, existing, recipe, groups, today,
}: {
  initial: EditorState
  existing: Recipe | null
  recipe: RecipeRef | null
  groups: string[]
  today: string
}) {
  const router = useRouter()
  const [state, setState] = useState<EditorState>(initial)
  const [tagText, setTagText] = useState(initial.tags.join(', '))
  const [group, setGroup] = useState(recipe?.group ?? groups[0] ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pane, setPane] = useState<'form' | 'preview'>('form')
  const [preview, setPreview] = useState<'recipe' | 'file'>('file')

  // The two boxes keep their own text. Reading it back out of the arrays
  // would fight the writer: a blank line typed at the end of the method box
  // has no item to belong to yet, and would vanish under the cursor.
  const [ingredientsText, setIngredientsText] = useState(() => linesToText(initial.ingredientLines))
  const [methodBoxText, setMethodBoxText] = useState(() => itemsToText(initial.methodSteps))

  const markdown = useMemo(
    () => buildMarkdown(state, existing, today),
    [state, existing, today],
  )

  const readout = useMemo(
    () => ingredientReadout(state.ingredientLines),
    [state.ingredientLines],
  )

  const ingredientCount = countLine(readout)
  const methodCount = methodCountLine(state.methodSteps)

  function edit(changes: Partial<EditorState>) {
    setState((previous) => ({ ...previous, ...changes }))
  }

  function editIngredients(text: string) {
    setIngredientsText(text)
    edit({ ingredientLines: textToLines(text) })
  }

  function editMethod(text: string) {
    setMethodBoxText(text)
    edit({ methodSteps: textToItems(text) })
  }

  async function save() {
    setBusy(true)
    setError(null)
    const result = await saveRecipeAction(recipe, group, markdown, state.title)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      // The file may already have moved even though the save failed. Follow
      // it to its new edit page, so the user is not left on a dead URL.
      if (result.ref) {
        router.push(`/r/${result.ref.group}/${result.ref.slug}/edit`)
        router.refresh()
      }
      return
    }
    router.push(`/r/${result.ref!.group}/${result.ref!.slug}`)
    router.refresh()
  }

  const field = 'mt-1 block w-full rounded border border-line-strong bg-surface px-3 py-2'

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{recipe ? 'Edit recipe' : 'New recipe'}</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded bg-raised p-1 lg:hidden">
            {(['form', 'preview'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPane(value)}
                aria-pressed={pane === value}
                className={`rounded px-3 py-1 text-sm ${pane === value ? 'bg-surface shadow' : ''}`}
              >
                {value === 'form' ? 'Form' : 'Preview'}
              </button>
            ))}
          </div>
          <Link
            href={recipe ? `/r/${recipe.group}/${recipe.slug}` : '/'}
            className="rounded px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded bg-invert-surface px-4 py-2 text-sm text-invert-ink disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded bg-danger-surface px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`space-y-5 ${pane === 'form' ? '' : 'hidden'} lg:block`}>
          <label className="block text-sm">Title
            <input value={state.title} onChange={(e) => edit({ title: e.target.value })} className={field} />
          </label>

          <label className="block text-sm">Group
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              list="recipe-groups"
              placeholder="breads"
              required
              className={field}
            />
          </label>
          <datalist id="recipe-groups">
            {groups.map((g) => <option key={g} value={g} />)}
          </datalist>

          <label className="block text-sm">Tags, separated by a comma
            <input
              value={tagText}
              onChange={(e) => { setTagText(e.target.value); edit({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }) }}
              className={field}
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">Serves
              <input
                type="number" min={1}
                value={state.serves ?? ''}
                onChange={(e) => edit({ serves: e.target.value ? Number(e.target.value) : null })}
                className={field}
              />
            </label>
            <label className="block text-sm">Prep time
              <input value={state.prepTime} onChange={(e) => edit({ prepTime: e.target.value })} placeholder="20m" className={field} />
            </label>
            <label className="block text-sm">Cook time
              <input value={state.cookTime} onChange={(e) => edit({ cookTime: e.target.value })} placeholder="25m" className={field} />
            </label>
          </div>

          <label className="block text-sm">Source
            <input value={state.source} onChange={(e) => edit({ source: e.target.value })} className={field} />
          </label>

          <fieldset>
            <div className="flex items-baseline justify-between">
              <legend className="text-sm font-medium">Ingredients</legend>
              <span className="text-xs text-ink-muted tabular-nums">{ingredientCount}</span>
            </div>
            <p className="mt-1 mb-2 text-xs text-ink-muted">
              Write one ingredient on each line, as you would say it. Start a line
              with <code>### </code> to begin a group.
            </p>
            <textarea
              value={ingredientsText}
              onChange={(e) => editIngredients(e.target.value)}
              rows={10}
              spellCheck={false}
              aria-label="Ingredients"
              placeholder="500 g strong white flour"
              className={`${field} leading-7`}
            />

            {readout.attention.length > 0 && (
              <div className="mt-2 rounded-r border border-line border-l-2 border-l-accent bg-surface px-4 py-3">
                <p className="mb-2 font-sans text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Kept exactly as written — these will not scale
                </p>
                <ul>
                  {readout.attention.map((problem) => (
                    <li key={problem.line} className="flex items-baseline gap-3 py-0.5">
                      <span className="w-6 shrink-0 text-right text-xs text-ink-dim tabular-nums">
                        {problem.line}
                      </span>
                      <span className="text-sm text-ink">{problem.text}</span>
                      <span className="text-xs text-ink-muted">{problem.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {readout.total > 0 && readout.attention.length === 0 && (
              <p className="mt-2 text-xs text-ink-muted">Every line will scale and convert.</p>
            )}
          </fieldset>

          <fieldset>
            <div className="flex items-baseline justify-between">
              <legend className="text-sm font-medium">Method</legend>
              <span className="text-xs text-ink-muted tabular-nums">{methodCount}</span>
            </div>
            <p className="mt-1 mb-2 text-xs text-ink-muted">
              A blank line starts the next step, so one step can hold several
              lines. Start a line with <code>### </code> to begin a section. The
              numbers start again at 1 in each section.
            </p>
            <textarea
              value={methodBoxText}
              onChange={(e) => editMethod(e.target.value)}
              rows={14}
              spellCheck={false}
              aria-label="Method"
              placeholder={'Mix and knead until smooth.\n\nProve for an hour.'}
              className={`${field} leading-7`}
            />
          </fieldset>

          <label className="block text-sm">Notes
            <textarea value={state.notes} onChange={(e) => edit({ notes: e.target.value })} rows={3} className={field} />
          </label>
        </section>

        <section className={`${pane === 'preview' ? '' : 'hidden'} lg:block`}>
          <div className="sticky top-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex rounded bg-raised p-1">
                {(['recipe', 'file'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreview(value)}
                    aria-pressed={preview === value}
                    className={`rounded px-3 py-1 text-sm ${
                      preview === value ? 'bg-surface shadow' : 'text-ink-soft'
                    }`}
                  >
                    {value === 'recipe' ? 'Recipe' : 'File'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-muted">
                {preview === 'recipe'
                  ? 'how the recipe will read'
                  : `${recipe ? `recipes/${group.trim() || recipe.group}/${recipe.slug}.md` : 'the new file'} — the exact text the app writes`}
              </p>
            </div>

            {preview === 'recipe' ? (
              <div className="max-h-[70vh] overflow-auto rounded border border-line bg-surface p-5">
                <EditorPreview
                  title={state.title}
                  ingredientLines={state.ingredientLines}
                  methodItems={state.methodSteps}
                  notes={state.notes}
                />
              </div>
            ) : (
              <pre className="max-h-[70vh] overflow-auto rounded border border-line bg-surface p-4 text-xs leading-relaxed">
                {markdown}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/** A quiet line telling the writer that the box was understood. */
function countLine(readout: ReturnType<typeof ingredientReadout>): string {
  if (readout.total === 0) return ''
  const parts = [`${readout.total} ingredients`, `${readout.measured} scale and convert`]
  if (readout.counted > 0) parts.push(`${readout.counted} scale only`)
  if (readout.textOnly > 0) parts.push(`${readout.textOnly} as written`)
  return parts.join(' · ')
}

function methodCountLine(items: string[]): string {
  const steps = items.filter((i) => i.trim() !== '' && !isMethodHeading(i)).length
  const sections = items.filter((i) => isMethodHeading(i)).length
  if (steps === 0 && sections === 0) return ''
  const parts = [`${steps} ${steps === 1 ? 'step' : 'steps'}`]
  if (sections > 0) parts.push(`${sections} ${sections === 1 ? 'section' : 'sections'}`)
  return parts.join(' · ')
}
