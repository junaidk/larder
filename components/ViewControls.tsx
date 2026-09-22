'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { parseFactor } from '@/lib/units/scale'
import { resolveUnits } from '@/lib/view/units'
import { ThemeToggle } from '@/components/ThemeToggle'

const STORAGE_KEY = 'larder:units'
const COLUMNS_KEY = 'larder:columns'

export function ViewControls({
  columns,
  onColumns,
}: {
  columns: 'one' | 'two'
  onColumns: (next: 'one' | 'two') => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const units = resolveUnits(params.get('units'), null).system
  const scale = params.get('scale') ?? ''
  const wantedServes = params.get('serves') ?? ''
  const active = scale !== '' || wantedServes !== '' || units !== 'metric'

  // A free text buffer for the scale factor box. It follows the URL, but
  // keeps its own text while the user types a value `parseFactor` cannot
  // read yet, such as the "1/" in "1/2".
  const [factorText, setFactorText] = useState(scale)
  useEffect(() => {
    setFactorText(scale)
  }, [scale])

  function handleFactorChange(text: string) {
    setFactorText(text)
    if (text.trim() === '') {
      set({ scale: null })
      return
    }
    const parsed = parseFactor(text)
    if (parsed !== null) set({ scale: String(parsed), serves: null })
  }

  // Put the saved unit choice back, once, when the URL names no system.
  // This runs on mount only. Running it on every change of the query is what
  // made a click on Metric bounce straight back to imperial.
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
    const resolved = resolveUnits(params.get('units'), saved)
    if (resolved.restore) set({ units: resolved.system })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Units</span>
        {(['metric', 'imperial'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              try { localStorage.setItem(STORAGE_KEY, value) } catch { /* private mode */ }
              set({ units: value })
            }}
            aria-pressed={units === value}
            className={`rounded px-3 py-1 text-sm ${
              units === value ? 'bg-invert-surface text-invert-ink' : 'bg-raised text-ink-soft'
            }`}
          >
            {value === 'metric' ? 'Metric' : 'Imperial'}
          </button>
        ))}

        <span className="ml-4 text-sm text-ink-muted">Scale</span>
        <input
          type="text"
          inputMode="decimal"
          list="scale-presets"
          aria-label="Scale factor"
          placeholder="1"
          value={factorText}
          onChange={(e) => handleFactorChange(e.target.value)}
          className="w-24 rounded border border-line-strong px-2 py-1 text-sm"
        />
        <datalist id="scale-presets">
          <option value="1/2" />
          <option value="2" />
          <option value="3" />
        </datalist>

        {/* Only a wide screen has room for two columns. */}
        <span className="ml-4 hidden text-sm text-ink-muted lg:inline">Layout</span>
        <div className="hidden rounded bg-raised p-1 lg:flex">
          {([['two', 'Two columns'], ['one', 'One column']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onColumns(value)}
              aria-pressed={columns === value}
              className={`rounded px-3 py-1 text-sm ${
                columns === value ? 'bg-surface shadow' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {active && (
          <button
            type="button"
            onClick={() => {
              try { localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
              set({ units: null, scale: null, serves: null })
            }}
            className="ml-2 rounded px-3 py-1 text-sm text-ink-muted underline hover:text-ink"
          >
            Reset
          </button>
        )}

        <span className="ml-auto">
          <ThemeToggle />
        </span>

      </div>

    </div>
  )
}
