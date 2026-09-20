'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { parseFactor } from '@/lib/units/scale'
import { resolveUnits } from '@/lib/view/units'

const STORAGE_KEY = 'recipe-register:units'
const COLUMNS_KEY = 'recipe-register:columns'

export function ViewControls({
  serves,
  columns,
  onColumns,
}: {
  serves: number | null
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
        <span className="text-sm text-stone-500">Units</span>
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
              units === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            {value === 'metric' ? 'Metric' : 'Imperial'}
          </button>
        ))}

        <span className="ml-4 text-sm text-stone-500">Scale</span>
        {[['1/2', '1/2'], ['2', '2x'], ['3', '3x']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => set({ scale: scale === value ? null : value, serves: null })}
            aria-pressed={scale === value}
            className={`rounded px-3 py-1 text-sm ${
              scale === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}

        <input
          type="text"
          inputMode="decimal"
          aria-label="Scale factor"
          placeholder="factor"
          value={factorText}
          onChange={(e) => handleFactorChange(e.target.value)}
          className="w-16 rounded border border-stone-300 px-2 py-1 text-sm"
        />

        {/* Only a wide screen has room for two columns. */}
        <span className="ml-4 hidden text-sm text-stone-500 lg:inline">Layout</span>
        <div className="hidden rounded bg-stone-100 p-1 lg:flex">
          {([['two', 'Two columns'], ['one', 'One column']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onColumns(value)}
              aria-pressed={columns === value}
              className={`rounded px-3 py-1 text-sm ${
                columns === value ? 'bg-white shadow' : 'text-stone-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {serves !== null && (
          <label className="ml-2 flex items-center gap-2 text-sm text-stone-500">
            Serves
            <input
              type="number"
              min={1}
              max={200}
              value={wantedServes || serves}
              onChange={(e) => set({ serves: e.target.value, scale: null })}
              className="w-20 rounded border border-stone-300 px-2 py-1"
            />
          </label>
        )}
      </div>

      {active && (
        <p className="flex items-center gap-3 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          This view is not the file. The file keeps the amounts as written.
          <button
            type="button"
            onClick={() => {
              try { localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
              set({ units: null, scale: null, serves: null })
            }}
            className="underline"
          >
            Reset
          </button>
        </p>
      )}
    </div>
  )
}
