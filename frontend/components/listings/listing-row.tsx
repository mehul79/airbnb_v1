"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { IconChevronLeft, IconChevronRight, IconArrowRight } from "@tabler/icons-react"

import { ListingCard } from "@/components/listings/listing-card"
import { Button } from "@/components/ui/button"
import type { ListingSummary } from "@/lib/listings-api"

// Horizontal scrolling shelf for one place. The heading links to the search for that place.
export function ListingRow({
  heading,
  subheading,
  href,
  listings,
}: {
  heading: string
  subheading?: string
  href: string
  listings: ListingSummary[]
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  // Arrows disable at either end, like Airbnb's. Updated on scroll; starts at the left edge.
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[21px] leading-6 font-semibold text-ink">
            <Link href={href} className="flex items-center gap-2 outline-none focus-visible:underline">
              {heading}
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-soft">
                <IconArrowRight className="size-3.5" />
              </span>
            </Link>
          </h2>
          {subheading && <p className="text-body-sm text-muted-foreground">{subheading}</p>}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full border-hairline"
            aria-label="Scroll left"
            disabled={atStart}
            onClick={() => scrollBy(-1)}
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full border-hairline"
            aria-label="Scroll right"
            disabled={atEnd}
            onClick={() => scrollBy(1)}
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  )
}
