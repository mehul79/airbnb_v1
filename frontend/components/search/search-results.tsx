import Link from "next/link"
import { IconHomeSearch } from "@tabler/icons-react"

import { FilterBar } from "@/components/search/filter-bar"
import { MapButton } from "@/components/search/map-button"
import { ResultsError } from "@/components/search/results-error"
import { ResultsPagination } from "@/components/search/results-pagination"
import { SearchResultCard } from "@/components/search/search-result-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fetchAmenities, fetchListings, ListingsApiError } from "@/lib/listings-api"

// The only query params the API understands; anything else in the URL is ignored.
const API_KEYS = ["location", "check_in", "check_out", "guests", "category", "property_type", "min_price_minor", "max_price_minor", "amenity", "page"]

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>

// SEARCH-01..03: reads the URL, asks FastAPI for one page (12 listings), renders loading
// (via the page's Suspense fallback), empty, error and success.
export async function SearchResults({ searchParams }: { searchParams: SearchParamsPromise }) {
  const raw = await searchParams
  const params = new URLSearchParams()
  for (const key of API_KEYS) {
    const value = raw[key]
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v)
  }

  let result
  try {
    result = await Promise.all([fetchListings(params), fetchAmenities()])
  } catch (e) {
    return <ResultsError message={e instanceof ListingsApiError ? e.message : "Something went wrong."} />
  }
  const [{ items, total, page, total_pages }, amenities] = result

  const location = params.get("location")
  const heading = `${total.toLocaleString("en-IN")} ${total === 1 ? "home" : "homes"}${location ? ` in ${location}` : ""}`
  const filtered = ["category", "property_type", "min_price_minor", "max_price_minor", "amenity"].some((k) => params.has(k))

  // Clearing keeps the place, dates and guests; only the filters go.
  const cleared = new URLSearchParams(params)
  for (const k of ["category", "property_type", "min_price_minor", "max_price_minor", "amenity", "page"]) cleared.delete(k)

  return (
    <>
      <div className="sticky top-[97px] z-30 bg-background">
        <FilterBar amenities={amenities} params={params.toString()} />
      </div>

      <div className="px-6 pt-8 pb-32 lg:px-12">
        <h1 className="mb-6 text-[22px] leading-7 font-semibold text-ink">{heading}</h1>

        {items.length === 0 ? (
          <Empty className="my-8 border border-hairline">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconHomeSearch />
              </EmptyMedia>
              <EmptyTitle>No exact matches</EmptyTitle>
              <EmptyDescription>
                {filtered ? "Try removing some filters or changing your dates." : "Try a different place, dates or guest count."}
              </EmptyDescription>
            </EmptyHeader>
            {filtered && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/search?${cleared}`}>Clear filters</Link>
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[500px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((listing) => (
                <SearchResultCard key={listing.id} listing={listing} />
              ))}
            </div>
            <div className="mt-12 flex flex-col items-center gap-3">
              <ResultsPagination page={page} totalPages={total_pages} params={params} />
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 12 + 1}–{(page - 1) * 12 + items.length} of {total.toLocaleString("en-IN")}
              </p>
            </div>
          </>
        )}
      </div>

      <MapButton />
    </>
  )
}
