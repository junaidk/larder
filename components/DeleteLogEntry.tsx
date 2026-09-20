'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteLogEntryAction } from '@/app/actions'

export function DeleteLogEntry({ slug, index, date }: { slug: string; index: number; date: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    const result = await deleteLogEntryAction(slug, index)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    router.refresh()
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Delete the entry for ${date}`}
        className="px-1 text-stone-400 hover:text-red-700 disabled:opacity-50"
      >
        ×
      </button>
    </span>
  )
}
