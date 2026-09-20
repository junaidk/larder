'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addLogEntryAction } from '@/app/actions'

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function CookLogForm({ slug }: { slug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(form: FormData) {
    setBusy(true)
    setError(null)
    form.set('rating', rating > 0 ? String(rating) : '')
    const result = await addLogEntryAction(slug, form)
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setOpen(false)
    setRating(0)
    router.refresh()
  }

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-medium">Cook log</h2>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700"
        >
          I cooked this
        </button>
      )}
    </div>
  )

  if (!open) return header

  return (
    <>
      {header}
      <form
        action={submit}
        aria-label="Add a cook log entry"
        className="mt-3 space-y-4 rounded-lg border border-stone-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            Date
            <input
              type="date"
              name="date"
              defaultValue={today()}
              required
              className="mt-1 block rounded border border-stone-300 px-3 py-2"
            />
          </label>

          <fieldset className="text-sm">
            <legend>Rating</legend>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? 0 : n)}
                  aria-label={`${n} stars`}
                  aria-pressed={rating >= n}
                  className={`text-2xl leading-none ${rating >= n ? 'text-amber-600' : 'text-stone-300'}`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 self-center text-stone-500">
                {rating > 0 ? `${rating} of 5` : 'no rating'}
              </span>
            </div>
          </fieldset>
        </div>

        <label className="block text-sm">
          Note
          <textarea
            name="note"
            rows={3}
            required
            placeholder="Too salty. Next time 1 tsp, not 2."
            className="mt-1 block w-full rounded border border-stone-300 px-3 py-2"
          />
        </label>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null) }}
            className="rounded px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </form>
    </>
  )
}
