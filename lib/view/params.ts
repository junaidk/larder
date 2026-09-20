import type { ViewOptions } from '@/lib/view/display'
import { DEFAULT_VIEW } from '@/lib/view/display'
import { factorForServings, parseFactor } from '@/lib/units/scale'

type Params = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Read the view state out of the URL query. */
export function readViewParams(params: Params, serves: number | null): ViewOptions {
  const units = first(params.units)
  const system = units === 'imperial' ? 'imperial' : DEFAULT_VIEW.system

  const scale = first(params.scale)
  const explicit = scale ? parseFactor(scale) : null
  if (explicit !== null) return { system, factor: explicit }

  const wanted = Number(first(params.serves))
  if (serves !== null && Number.isFinite(wanted) && wanted > 0) {
    return { system, factor: factorForServings(serves, wanted) }
  }

  return { system, factor: DEFAULT_VIEW.factor }
}
