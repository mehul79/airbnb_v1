import { Suspense } from "react"

import { ListingRow } from "@/components/listings/listing-row"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchListings, ListingsApiError } from "@/lib/listings-api"
import { ResultsError } from "@/components/search/results-error"

// One shelf per region we have homes in. The heading text is ours; the homes come from the API.
const SHELVES = [
  { place: "Goa", heading: "Stay in Goa", subheading: "Beach houses and pool villas" },
  { place: "Himachal Pradesh", heading: "Check out homes in Himachal Pradesh", subheading: "Cabins and chalets in the hills" },
  { place: "Rajasthan", heading: "Popular homes in Rajasthan" },
  { place: "Kerala", heading: "Places to stay in Kerala", subheading: "Backwaters, tea hills and beaches" },
]

// HOME-01: the explore page, API-backed. A place with no homes simply has no shelf.
async function Shelves() {
  let results
  try {
    results = await Promise.all(SHELVES.map((s) => fetchListings(new URLSearchParams({ location: s.place, page_size: "12" }))))
  } catch (e) {
    return <ResultsError message={e instanceof ListingsApiError ? e.message : "Something went wrong."} />
  }

  const shown = SHELVES.map((shelf, i) => ({ shelf, page: results[i] })).filter(({ page }) => page.items.length > 0)
  if (shown.length === 0) {
    return <p className="px-6 text-base text-muted-foreground lg:px-12">There are no homes to show yet.</p>
  }

  return (
    <div className="flex w-full flex-col gap-10 px-6 lg:px-12">
      {shown.map(({ shelf, page }) => (
        <ListingRow
          key={shelf.place}
          heading={shelf.heading}
          subheading={shelf.subheading}
          href={`/search?${new URLSearchParams({ location: shelf.place })}`}
          listings={page.items}
        />
      ))}
    </div>
  )
}

// Same-shaped placeholders, so the page doesn't jump when the shelves arrive.
function ShelvesSkeleton() {
  return (
    <div className="flex min-h-dvh w-full flex-col gap-10 px-6 lg:px-12" aria-busy aria-label="Loading homes">
      {[0, 1].map((row) => (
        <div key={row} className="flex flex-col gap-5">
          <Skeleton className="h-6 w-64" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex w-[calc((100%-12px)/2)] shrink-0 flex-col gap-2 md:w-[calc((100%-24px)/3)] lg:w-[calc((100%-48px)/5)] xl:w-[calc((100%-72px)/7)]">
                <Skeleton className="aspect-[180/171] w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-10 pt-8 pb-16">
      <Suspense fallback={<ShelvesSkeleton />}>
        <Shelves />
      </Suspense>
    </main>
  )
}
