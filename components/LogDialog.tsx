'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { addLogEntryAction } from '@/app/actions'

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function LogDialog({ slug }: { slug: string }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
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
    dialog.current?.close()
    setRating(0)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700"
      >
        I cooked this
      </button>

      <dialog
        ref={dialog}
        aria-label="Add a cook log entry"
        className="w-[min(28rem,90vw)] rounded-lg p-0 backdrop:bg-stone-900/40"
      >
        <form action={submit} className="space-y-4 p-6">
          <h2 className="text-lg font-medium">Add a cook log entry</h2>

          <label className="block text-sm">
            Date
            <input
              type="date"
              name="date"
              defaultValue={today()}
              required
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>

          <fieldset className="text-sm">
            <legend>Rating</legend>
            <div className="mt-1 flex gap-1">
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

          <label className="block text-sm">
            Note
            <textarea
              name="note"
              rows={4}
              required
              placeholder="Too salty. Next time 1 tsp, not 2."
              className="mt-1 block w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded px-3 py-2 text-sm text-stone-600"
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
      </dialog>
    </>
  )
}
