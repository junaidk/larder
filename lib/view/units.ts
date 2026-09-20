import type { UnitSystem } from '@/lib/units/convert'

const KNOWN: UnitSystem[] = ['metric', 'imperial']

function known(value: string | null | undefined): UnitSystem | null {
  return KNOWN.includes(value as UnitSystem) ? (value as UnitSystem) : null
}

/**
 * Decide which unit system the controls should show.
 *
 * The URL always wins. The saved choice applies only when the URL names no
 * system, and `restore` then asks the caller to write it into the URL.
 *
 * Both systems must appear in the URL by name. An earlier version left the
 * parameter out for metric, so a click on Metric looked the same as "never
 * chosen" and the saved imperial went straight back.
 */
export function resolveUnits(
  param: string | null | undefined,
  saved: string | null,
): { system: UnitSystem; restore: boolean } {
  const fromUrl = known(param)
  if (fromUrl) return { system: fromUrl, restore: false }

  const fromStore = known(saved)
  if (fromStore) return { system: fromStore, restore: true }

  return { system: 'metric', restore: false }
}
