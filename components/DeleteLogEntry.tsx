'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteLogEntryAction } from '@/app/actions'
import type { RecipeRef } from '@/lib/recipe/types'

export function DeleteLogEntry({
  recipe, index, date,
}: {
  recipe: RecipeRef
  index: number
  date: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    const result = await deleteLogEntryAction(recipe, index)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    router.refresh()
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Delete the entry for ${date}`}
        className="px-1 text-ink-faint hover:text-danger disabled:opacity-50"
      >
        ×
      </button>
    </span>
  )
}
