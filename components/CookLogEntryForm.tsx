'use client'

import { useState } from 'react'
import type { LogEntryInput } from '@/app/actions'

export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * The fields of one cook log entry. The add form and the edit form both use
 * this, so the two cannot drift apart.
 *
 * `onSave` returns an error message, or null when the save worked.
 */
export function CookLogEntryForm({
  initial,
  label,
  onSave,
  onCancel,
}: {
  initial?: LogEntryInput
  label: string
  onSave: (values: LogEntryInput) => Promise<string | null>
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? today())
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const message = await onSave({ date, rating: rating > 0 ? rating : null, note })
      if (message) setError(message)
    } catch {
      // A rejected action must not leave the button on "Saving…" for ever.
      setError('The save did not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={label}
      className="mt-3 space-y-4 rounded-lg border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="text-sm">
          <label htmlFor="log-date" className="block">Date</label>
          <input
            id="log-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block rounded border border-line-strong px-3 py-2"
          />
        </div>

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
                className={`text-2xl leading-none ${rating >= n ? 'text-accent' : 'text-ink-dim'}`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 self-center text-ink-muted">
              {rating > 0 ? `${rating} of 5` : 'no rating'}
            </span>
          </div>
        </fieldset>
      </div>

      <div className="text-sm">
        <label htmlFor="log-note" className="block">Note, if you have one</label>
        <textarea
          id="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Too salty. Next time 1 tsp, not 2."
          className="mt-1 block w-full rounded border border-line-strong px-3 py-2"
        />
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-2 text-sm text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-invert-surface px-4 py-2 text-sm text-invert-ink disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </form>
  )
}
