'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { RecipeSummary } from '@/lib/recipe/types'
import { Stars } from '@/components/Stars'

const VIEW_KEY = 'recipe-register:view'

function cookedLabel(times: number): string {
  return times > 0 ? `cooked ${times}\u00d7` : 'not cooked yet'
}

export function RecipeIndex({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // Remember the chosen view. Storage can throw in a private window.
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'list') setView('list')
    } catch { /* storage is not available */ }
  }, [])

  function chooseView(next: 'grid' | 'list') {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* storage is not available */ }
  }

  const tags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags))].sort(),
    [recipes],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (needle && !r.searchText.includes(needle)) return false
      if (tag && !r.tags.includes(tag)) return false
      if (minRating > 0 && (r.latestRating ?? 0) < minRating) return false
      return true
    })
  }, [recipes, query, tag, minRating])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or ingredient"
          aria-label="Search recipes"
          className="min-w-64 flex-1 rounded border border-stone-300 bg-white px-3 py-2"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filter by tag"
          className="rounded border border-stone-300 bg-white px-3 py-2"
        >
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          aria-label="Filter by rating"
          className="rounded border border-stone-300 bg-white px-3 py-2"
        >
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars and up</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {shown.length} of {recipes.length} recipes
        </p>
        <div className="flex rounded bg-stone-100 p-1">
          {(['grid', 'list'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseView(value)}
              aria-pressed={view === value}
              className={`rounded px-3 py-1 text-sm capitalize ${
                view === value ? 'bg-white shadow' : 'text-stone-600'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <li key={r.slug} className="h-full">
              <Link
                href={`/r/${r.slug}`}
                className="flex h-full flex-col rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400"
              >
                <h2 className="font-medium">{r.title}</h2>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <Stars rating={r.latestRating} />
                  <span className="text-stone-500">{cookedLabel(r.timesCooked)}</span>
                </div>
                {/* mt-auto holds the tags at the foot, so every card matches. */}
                <p className="mt-auto flex flex-wrap gap-1 pt-2">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {t}
                    </span>
                  ))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/r/${r.slug}`}
                className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 hover:border-stone-400 sm:flex-row sm:items-center sm:gap-4"
              >
                <h2 className="font-medium sm:w-64 sm:shrink-0">{r.title}</h2>
                <p className="flex flex-1 flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {t}
                    </span>
                  ))}
                </p>
                <div className="flex items-center gap-4 text-sm sm:shrink-0">
                  <Stars rating={r.latestRating} />
                  <span className="text-stone-500 sm:w-28 sm:text-right">
                    {cookedLabel(r.timesCooked)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {shown.length === 0 && (
        <p className="rounded border border-dashed border-stone-300 p-8 text-center text-stone-500">
          No recipe matches the filters.
        </p>
      )}
    </div>
  )
}
