'use client'

import { useState } from 'react'
import type { IngredientParts } from '@/lib/view/display'

/** The parts, plus the whole line. Screen readers read the whole line. */
export type DisplayIngredient = IngredientParts & { line: string }

export interface DisplayGroup {
  name: string | null
  ingredients: DisplayIngredient[]
}

/**
 * The ingredient list. A click strikes a line through, to help you keep
 * your place while you cook. The mark lives in this page only. It never
 * reaches the recipe file and it clears on a reload.
 */
export function IngredientList({ groups }: { groups: DisplayGroup[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({})

  // The amount and its unit sit together in one column, sized to the widest
  // pair in the list. One gap then separates them from the names, which all
  // start at the same place.
  const rows = groups.flatMap((g) => g.ingredients)
  const measureWidth = `${Math.max(
    1,
    ...rows.map((r) => `${r.amount} ${r.unit}`.trim().length),
  )}ch`

  function toggle(key: string) {
    setDone((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  return (
    <div className="space-y-5">
      {groups.map((group, g) => (
        <div key={g}>
          {group.name && (
            <h3 className="mb-2 font-sans text-xs font-medium tracking-wide text-stone-500 uppercase">
              {group.name}
            </h3>
          )}
          <ul className="space-y-1">
            {group.ingredients.map((p, i) => {
              const key = `${g}-${i}`
              const struck = done[key]
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={struck}
                    aria-label={p.line}
                    className={`flex w-full gap-2.5 rounded px-1 py-1 text-left hover:bg-stone-100 ${
                      struck ? 'opacity-40' : ''
                    }`}
                  >
                    {p.text ? (
                      // A line the parser could not read has no amount, so it
                      // uses the whole width instead of an empty column.
                      <span
                        className={`font-serif text-stone-800 ${struck ? 'line-through' : ''}`}
                      >
                        {p.text}
                      </span>
                    ) : (
                      <>
                        <span
                          style={{ width: measureWidth }}
                          className={`shrink-0 font-sans text-sm ${struck ? 'line-through' : ''}`}
                        >
                          <span className="font-medium tabular-nums text-stone-900">{p.amount}</span>
                          {p.unit && <span className="text-stone-400"> {p.unit}</span>}
                        </span>
                        <span
                          className={`min-w-0 font-serif text-stone-800 ${struck ? 'line-through' : ''}`}
                        >
                          {p.item}
                          {p.prep && <span className="text-stone-500 italic">, {p.prep}</span>}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
