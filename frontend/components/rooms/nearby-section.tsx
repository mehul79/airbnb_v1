"use client"

import { useRef, useState } from "react"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

import { SectionError } from "@/components/rooms/lazy-section"
import { NearbySkeleton } from "@/components/rooms/section-skeletons"
import { SearchResultCard } from "@/components/search/search-result-card"
import { Button } from "@/components/ui/button"
import type { ListingPage } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

// "More stays nearby": other listings in the same region, as a scroller with "1 / 2" paging.
export default function NearbySection({ listingId, region }: { listingId: string; region: string }) {
  const { data, error, loading, retry } = useQuery<ListingPage>(`/listings?location=${encodeURIComponent(region)}&page_size=13`)
  const scroller = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  if (error) return <SectionError label="nearby stays" onRetry={retry} />
  if (loading || !data) return <NearbySkeleton />

  const items = data.items.filter((l) => l.id !== listingId).slice(0, 12)
  if (items.length === 0) return null

  const pageCount = Math.max(1, Math.ceil(items.length / 5))

  function move(dir: 1 | -1) {
    const el = scroller.current
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" })
  }
  function onScroll() {
    const el = scroller.current
    if (el) setPage(Math.min(pageCount - 1, Math.round(el.scrollLeft / el.clientWidth)))
  }

  return (
    <div className="flex flex-col gap-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] leading-7 font-semibold text-ink">More stays nearby</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink" aria-live="polite">
            {page + 1} / {pageCount}
          </span>
          <Button variant="outline" size="icon" className="size-8 rounded-full border-hairline disabled:opacity-30" aria-label="Previous stays" disabled={page === 0} onClick={() => move(-1)}>
            <IconChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8 rounded-full border-hairline disabled:opacity-30" aria-label="Next stays" disabled={page >= pageCount - 1} onClick={() => move(1)}>
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div ref={scroller} onScroll={onScroll} className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((listing) => (
          <div key={listing.id} className="w-[calc((100%-16px)/2)] shrink-0 snap-start lg:w-[calc((100%-64px)/5)]">
            <SearchResultCard listing={listing} />
          </div>
        ))}
      </div>
    </div>
  )
}
