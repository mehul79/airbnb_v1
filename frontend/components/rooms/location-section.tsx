"use client"

import { TileMap } from "@/components/rooms/tile-map"

// "Where you'll be". PRD: a static location map on the listing page (live maps are deferred),
// so the map is a fixed view of the home with zoom and full screen only. This module (and the
// map) is only downloaded once the section nears the viewport.
export default function LocationSection({ label, latitude, longitude }: { label: string; latitude: number | null; longitude: number | null }) {
  return (
    <div className="flex flex-col gap-1 py-12">
      <h2 className="text-[22px] leading-7 font-semibold text-ink">Where you&apos;ll be</h2>
      <p className="text-base text-ink">{label}</p>
      <div className="mt-5">
        {latitude !== null && longitude !== null ? (
          <TileMap lat={latitude} lng={longitude} label={label} />
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-xl bg-surface-soft text-sm text-muted-foreground">The host hasn&apos;t shared a map location.</div>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">The exact location is shared after you book.</p>
    </div>
  )
}
