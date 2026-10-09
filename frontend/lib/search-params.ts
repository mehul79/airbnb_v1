// The search lives in the URL (CLAUDE.md "State has 4 homes"). Frontend URL params are named
// exactly like GET /listings params, so the page can pass them straight through.
import { format, parseISO } from "date-fns"

export type SearchValues = {
  location: string
  from: Date | undefined
  to: Date | undefined
  guests: number
}

type Params = Pick<URLSearchParams, "get">

// Reads the search-bar fields out of a URL (used to prefill the bar and its summary).
export function searchValuesFrom(params: Params): SearchValues {
  const day = (key: string) => {
    const v = params.get(key)
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseISO(v) : undefined
  }
  const guests = Number(params.get("guests"))
  return {
    location: params.get("location") ?? "",
    from: day("check_in"),
    to: day("check_out"),
    guests: Number.isInteger(guests) && guests > 0 ? guests : 0,
  }
}

// New URL params: keeps what's in `current`, applies `patch` (null/empty removes a key,
// arrays repeat it), and drops back to page 1 unless the patch sets the page.
export function withParams(
  current: URLSearchParams | string,
  patch: Record<string, string | number | string[] | null | undefined>
) {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    next.delete(key)
    if (Array.isArray(value)) value.forEach((v) => next.append(key, v))
    else if (value !== null && value !== undefined && value !== "") next.set(key, String(value))
  }
  if (!("page" in patch)) next.delete("page")
  return next
}

export const isoDay = (d: Date) => format(d, "yyyy-MM-dd")
