'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { RecipeSummary } from '@/lib/recipe/types'
import { Stars } from '@/components/Stars'
import { collapseAllLabel, isGroupOpen, toggled } from '@/lib/view/collapse'

const VIEW_KEY = 'larder:view'
const COLLAPSED_KEY = 'larder:collapsed'

function cookedLabel(times: number): string {
  return times > 0 ? `cooked ${times}\u00d7` : 'not cooked yet'
}

export function RecipeIndex({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [collapsed, setCollapsed] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY)
      if (saved) setCollapsed(JSON.parse(saved) as string[])
    } catch { /* storage is not available, or holds something else */ }
  }, [])

  function remember(next: string[]) {
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)) } catch { /* storage is not available */ }
  }

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

  // Recipes under a heading for each folder, in alphabetical order.
  // Any of the three narrowing controls counts as filtering.
  const filtering = query.trim() !== '' || tag !== '' || minRating > 0

  const grouped = useMemo(() => {
    const byGroup = new Map<string, RecipeSummary[]>()
    for (const recipe of shown) {
      const list = byGroup.get(recipe.group)
      if (list) list.push(recipe)
      else byGroup.set(recipe.group, [recipe])
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [shown])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or ingredient"
          aria-label="Search recipes"
          className="min-w-64 flex-1 rounded border border-line-strong bg-surface px-3 py-2"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filter by tag"
          className="rounded border border-line-strong bg-surface px-3 py-2"
        >
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          aria-label="Filter by rating"
          className="rounded border border-line-strong bg-surface px-3 py-2"
        >
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars and up</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {shown.length} of {recipes.length} recipes
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const names = grouped.map(([group]) => group)
              const allClosed = collapseAllLabel(names, collapsed, filtering) === 'Expand all'
              remember(allClosed ? [] : names)
            }}
            className="rounded px-3 py-1 text-sm text-ink-soft hover:text-ink"
          >
            {collapseAllLabel(grouped.map(([group]) => group), collapsed, filtering)}
          </button>

          <div className="flex rounded bg-raised p-1">
          {(['grid', 'list'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseView(value)}
              aria-pressed={view === value}
              className={`rounded px-3 py-1 text-sm capitalize ${
                view === value ? 'bg-surface shadow' : 'text-ink-soft'
              }`}
            >
              {value}
            </button>
          ))}
          </div>
        </div>
      </div>

      {grouped.map(([group, items]) => {
        const open = isGroupOpen(group, collapsed, filtering)
        return (
        <section key={group}>
          <h2 className="mb-3">
            <button
              type="button"
              onClick={() => remember(toggled(collapsed, group))}
              aria-expanded={open}
              className="flex items-center gap-2 font-sans text-xs font-medium tracking-widest text-ink-faint uppercase hover:text-ink-soft"
            >
              <span
                aria-hidden
                className={`transition-transform ${open ? 'rotate-90' : ''}`}
              >
                ›
              </span>
              {group} <span className="text-ink-dim">({items.length})</span>
            </button>
          </h2>

          {open && (view === 'grid' ? (
            <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <li key={`${r.group}/${r.slug}`} className="h-full">
                  <Link
                    href={`/r/${r.group}/${r.slug}`}
                    className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 hover:border-line-hover"
                  >
                    <h3 className="font-medium">{r.title}</h3>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <Stars rating={r.latestRating} />
                      <span className="text-ink-muted">{cookedLabel(r.timesCooked)}</span>
                    </div>
                    <p className="mt-auto flex flex-wrap gap-1 pt-2">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded bg-raised px-2 py-0.5 text-xs text-ink-soft">
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
              {items.map((r) => (
                <li key={`${r.group}/${r.slug}`}>
                  <Link
                    href={`/r/${r.group}/${r.slug}`}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 hover:border-line-hover sm:flex-row sm:items-center sm:gap-4"
                  >
                    <h3 className="font-medium sm:w-64 sm:shrink-0">{r.title}</h3>
                    <p className="flex flex-1 flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded bg-raised px-2 py-0.5 text-xs text-ink-soft">
                          {t}
                        </span>
                      ))}
                    </p>
                    <div className="flex items-center gap-4 text-sm sm:shrink-0">
                      <Stars rating={r.latestRating} />
                      <span className="text-ink-muted sm:w-28 sm:text-right">
                        {cookedLabel(r.timesCooked)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </section>
        )
      })}

      {shown.length === 0 && (
        <p className="rounded border border-dashed border-line-strong p-8 text-center text-ink-muted">
          No recipe matches the filters.
        </p>
      )}
    </div>
  )
}
