import { plural } from "@/lib/labels"

// "Overall rating": one thin bar per star level, sized by that level's share of the reviews.
// The counts come from the API (rating_breakdown), never from the page of reviews loaded so far.
export function RatingBreakdown({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  if (total === 0) return null
  return (
    <section aria-label="Rating breakdown" className="mx-auto w-full max-w-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">Overall rating</h3>
      <ul className="flex flex-col gap-2">
        {(["5", "4", "3", "2", "1"] as const).map((stars) => {
          const count = breakdown[stars] ?? 0
          return (
            <li key={stars} className="flex items-center gap-3 text-xs text-ink">
              <span className="w-3 text-right">{stars}</span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-hairline" role="img" aria-label={`${plural(count, "review")} gave ${stars} ${stars === "1" ? "star" : "stars"}`}>
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(count / total) * 100}%` }} />
              </span>
              <span className="w-5 text-muted-foreground">{count}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
