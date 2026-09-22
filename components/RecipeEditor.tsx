'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { EditorState } from '@/lib/view/build'
import { buildMarkdown } from '@/lib/view/build'
import type { Recipe, RecipeRef } from '@/lib/recipe/types'
import { parseIngredientLine } from '@/lib/recipe/ingredient'
import { saveRecipeAction } from '@/app/actions'

const GROUP_RE = /^###\s+/

/** The grey label below an ingredient box. */
function hint(line: string): string {
  const text = line.trim()
  if (text === '') return ''
  if (GROUP_RE.test(text)) return 'group heading'
  const parsed = parseIngredientLine(`- ${text}`)
  if (parsed.kind === 'text') return 'text only — will not scale'
  const parts = [
    parsed.quantity ? String(parsed.quantity.raw) : '',
    parsed.unitRaw ?? '',
    parsed.item ?? '',
  ].filter(Boolean)
  const tail = parsed.kind === 'counted' ? ' · counted, will not convert' : ''
  return parts.join(' · ') + tail
}

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
  const [pane, setPane] = useState<'form' | 'file'>('form')

  const markdown = useMemo(
    () => buildMarkdown(state, existing, today),
    [state, existing, today],
  )

  function edit(changes: Partial<EditorState>) {
    setState((previous) => ({ ...previous, ...changes }))
  }

  function editList(key: 'ingredientLines' | 'methodSteps', index: number, value: string) {
    setState((previous) => {
      const next = [...previous[key]]
      next[index] = value
      // Always keep one empty box at the end.
      if (index === next.length - 1 && value.trim() !== '') next.push('')
      return { ...previous, [key]: next }
    })
  }

  function addTo(key: 'ingredientLines' | 'methodSteps') {
    setState((previous) => ({ ...previous, [key]: [...previous[key], ''] }))
  }

  function removeFrom(key: 'ingredientLines' | 'methodSteps', index: number) {
    setState((previous) => {
      const next = previous[key].filter((_, i) => i !== index)
      return { ...previous, [key]: next.length > 0 ? next : [''] }
    })
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
            {(['form', 'file'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPane(value)}
                aria-pressed={pane === value}
                className={`rounded px-3 py-1 text-sm ${pane === value ? 'bg-surface shadow' : ''}`}
              >
                {value === 'form' ? 'Form' : 'File'}
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
            <legend className="text-sm font-medium">Ingredients</legend>
            <p className="mb-2 text-xs text-ink-muted">
              Write one ingredient on each line, as you would say it. Start a line
              with <code>### </code> to begin a group.
            </p>
            <ul className="space-y-2">
              {state.ingredientLines.map((line, i) => (
                <li key={i}>
                  <div className="flex gap-2">
                    <input
                      value={line}
                      onChange={(e) => editList('ingredientLines', i, e.target.value)}
                      placeholder="500 g strong white flour"
                      aria-label={`Ingredient ${i + 1}`}
                      className="flex-1 rounded border border-line-strong bg-surface px-3 py-2"
                    />
                    <button type="button" onClick={() => removeFrom('ingredientLines', i)} aria-label={`Remove ingredient ${i + 1}`} className="px-2 text-ink-faint hover:text-ink-soft">×</button>
                  </div>
                  <p className="mt-0.5 h-4 pl-1 text-xs leading-4 text-ink-muted">
                    {hint(line) || '\u00a0'}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addTo('ingredientLines')}
              className="mt-2 rounded border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-soft hover:border-line-hover"
            >
              + Add ingredient
            </button>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Method</legend>
            <ol className="mt-2 space-y-2">
              {state.methodSteps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 pt-2 text-right text-sm text-ink-faint">{i + 1}</span>
                  <textarea
                    value={step}
                    onChange={(e) => editList('methodSteps', i, e.target.value)}
                    rows={2}
                    aria-label={`Step ${i + 1}`}
                    className="flex-1 rounded border border-line-strong bg-surface px-3 py-2"
                  />
                  <button type="button" onClick={() => removeFrom('methodSteps', i)} aria-label={`Remove step ${i + 1}`} className="px-2 text-ink-faint hover:text-ink-soft">×</button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => addTo('methodSteps')}
              className="mt-2 rounded border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-soft hover:border-line-hover"
            >
              + Add step
            </button>
          </fieldset>

          <label className="block text-sm">Notes
            <textarea value={state.notes} onChange={(e) => edit({ notes: e.target.value })} rows={3} className={field} />
          </label>
        </section>

        <section className={`${pane === 'file' ? '' : 'hidden'} lg:block`}>
          <div className="sticky top-4">
            <p className="mb-2 text-xs text-ink-muted">
              {recipe ? `recipes/${group.trim() || recipe.group}/${recipe.slug}.md` : 'the new file'} — this is the exact text that the app writes
            </p>
            <pre className="max-h-[70vh] overflow-auto rounded border border-line bg-surface p-4 text-xs leading-relaxed">
              {markdown}
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
