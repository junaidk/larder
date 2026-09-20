'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const STORAGE_KEY = 'recipe-register:units'

export function ViewControls({ serves }: { serves: number | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const units = params.get('units') === 'imperial' ? 'imperial' : 'metric'
  const scale = params.get('scale') ?? ''
  const wantedServes = params.get('serves') ?? ''
  const active = scale !== '' || wantedServes !== '' || units !== 'metric'

  // Remember the unit choice between visits.
  useEffect(() => {
    if (params.get('units')) {
      try { localStorage.setItem(STORAGE_KEY, units) } catch { /* private mode */ }
      return
    }
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
    if (saved === 'imperial') set({ units: 'imperial' })
  // The effect must run on a change of the query only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

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
            onClick={() => set({ units: value === 'metric' ? null : value })}
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

        {serves !== null && (
          <label className="ml-2 flex items-center gap-2 text-sm text-stone-500">
            Serves
            <input
              type="number"
              min={1}
              max={200}
              defaultValue={wantedServes || serves}
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
            onClick={() => set({ units: null, scale: null, serves: null })}
            className="underline"
          >
            Reset
          </button>
        </p>
      )}
    </div>
  )
}
