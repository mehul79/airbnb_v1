import { Suspense } from "react"

import { ResultsSkeleton } from "@/components/search/results-skeleton"
import { SearchResults } from "@/components/search/search-results"

// searchParams is a Promise in Next 16; it's read inside <Suspense> so the shell streams
// first and the skeleton shows while FastAPI answers.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
