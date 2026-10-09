"use client"

import { useState, useSyncExternalStore, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { IconList, IconMap } from "@tabler/icons-react"

import { SearchResultCard } from "@/components/search/search-result-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ListingSummary } from "@/lib/listings-api"
import { cn } from "@/lib/utils"

// Leaflet needs `window`, and the map is only wanted once the page is in the browser anyway.
const ResultsMap = dynamic(() => import("@/components/search/results-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-xl" aria-busy aria-label="Loading map" />,
})

// True from the desktop breakpoint (1128px) up. Always false while rendering on the server.
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 1128px)")
      query.addEventListener("change", notify)
      return () => query.removeEventListener("change", notify)
    },
    () => window.matchMedia("(min-width: 1128px)").matches,
    () => false
  )
}

// The results list with the map beside it (desktop) or over it (phone and tablet). The list
// stays on the left and the map is sticky on the right, as on Airbnb. "Hide map" gives the list
// the full width back. The search it shows is the URL's search; nothing here changes it.
export function ResultsLayout({ items, params, children }: { items: ListingSummary[]; params: string; children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const [desktopMap, setDesktopMap] = useState(true)
  const [phoneMap, setPhoneMap] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const mapVisible = isDesktop ? desktopMap : phoneMap
  const toggle = () => (isDesktop ? setDesktopMap((v) => !v) : setPhoneMap((v) => !v))

  return (
    <>
      <div className={cn("grid gap-8", desktopMap && "lg:grid-cols-[minmax(0,1fr)_minmax(420px,44%)]")}>
        <div className="min-w-0">
          <div
            className={cn(
              "grid grid-cols-1 gap-x-6 gap-y-10 min-[500px]:grid-cols-2 md:grid-cols-3",
              desktopMap ? "lg:grid-cols-2" : "lg:grid-cols-4 xl:grid-cols-5"
            )}
          >
            {items.map((listing) => (
              <SearchResultCard key={listing.id} listing={listing} onHover={setHovered} highlighted={hovered === listing.id} />
            ))}
          </div>
          {children}
        </div>

        {/* One map element for both layouts: a sticky column on desktop, a full-screen sheet on a phone. */}
        <div
          className={cn(
            mapVisible ? "fixed inset-0 z-[60]" : "hidden",
            "lg:sticky lg:inset-auto lg:top-[170px] lg:z-0 lg:h-[calc(100dvh-190px)] lg:self-start",
            desktopMap ? "lg:block" : "lg:hidden"
          )}
        >
          {mapVisible && <ResultsMap params={params} hoveredId={hovered} onHover={setHovered} className="size-full lg:rounded-xl" />}
        </div>
      </div>

      <Button
        type="button"
        onClick={toggle}
        aria-pressed={mapVisible}
        className="fixed bottom-6 left-1/2 z-[80] h-12 -translate-x-1/2 gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-background shadow-float hover:bg-ink/90 active:bg-ink"
      >
        {/* Desktop shows list and map together, so it hides/shows the map; a phone swaps between them. */}
        {isDesktop ? (desktopMap ? "Hide map" : "Show map") : phoneMap ? "Show list" : "Show map"}
        {mapVisible && !isDesktop ? <IconList className="size-4" /> : <IconMap className="size-4" />}
      </Button>
    </>
  )
}
