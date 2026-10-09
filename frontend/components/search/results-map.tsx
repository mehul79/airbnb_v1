"use client"

import "leaflet/dist/leaflet.css"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { IconArrowsMaximize, IconArrowsMinimize, IconMinus, IconPlus, IconStarFilled, IconX } from "@tabler/icons-react"
import * as L from "leaflet"

import { Button } from "@/components/ui/button"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { formatRating, TYPE_LABEL } from "@/lib/labels"
import type { ListingSummary, MapPage } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"
import { cn } from "@/lib/utils"

// The results map: Leaflet over OpenStreetMap tiles (no API key), one price bubble per home.
// It asks the API for every match of the current search (not just this page of cards), hovering
// a card or a bubble highlights the other, and clicking a bubble opens a small card with a link.
// Leaflet touches `window`, so this module is only ever loaded in the browser (see results-layout).

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

// A price pill. The map is always light, so the pill is fixed white/ink and not theme tokens.
// Highlighted (hovered or selected) pills turn dark and grow a little. The text is only a
// formatted number, never user text, so building HTML from it is safe.
function bubble(item: ListingSummary, active: boolean) {
  const tone = active ? "scale-110 bg-neutral-900 text-white" : "bg-white text-neutral-900"
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-150 ${tone}">${formatPaise(item.nightly_price_minor)}</span>`,
  })
}

export default function ResultsMap({
  params,
  hoveredId,
  onHover,
  className,
}: {
  params: string
  hoveredId: string | null
  onHover: (id: string | null) => void
  className?: string
}) {
  const { data, error, loading, retry } = useQuery<MapPage>(`/listings/map?${params}`, { fresh: true })
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<string, { marker: L.Marker; item: ListingSummary }>())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [full, setFull] = useState(false)

  // Create the map once; keep it sized to its box, however that box changes.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const m = L.map(el, { zoomControl: false, worldCopyJump: true }).setView([22.5, 79], 5)
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(m)
    m.on("click", () => setSelectedId(null))
    map.current = m
    const resize = new ResizeObserver(() => m.invalidateSize())
    resize.observe(el)
    return () => {
      resize.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // One marker per home; when the results change, replace them and fit the view around them.
  useEffect(() => {
    const m = map.current
    if (!m || !data) return
    const group = L.layerGroup().addTo(m)
    const found = markers.current
    found.clear()
    for (const item of data.items) {
      if (item.latitude === null || item.longitude === null) continue
      const marker = L.marker([item.latitude, item.longitude], { icon: bubble(item, false), title: `${formatPaise(item.nightly_price_minor)}, ${item.title}` })
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e)
        setSelectedId(item.id)
      })
      marker.on("mouseover", () => onHover(item.id))
      marker.on("mouseout", () => onHover(null))
      group.addLayer(marker)
      found.set(item.id, { marker, item })
    }
    const points = [...found.values()].map(({ item }) => [item.latitude!, item.longitude!] as [number, number])
    if (points.length === 1) m.setView(points[0], 12)
    else if (points.length > 1) m.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 })
    return () => {
      group.remove()
      found.clear()
    }
  }, [data, onHover])

  // Highlight the hovered or selected home's bubble and bring it to the front.
  useEffect(() => {
    for (const [id, { marker, item }] of markers.current) {
      const active = id === hoveredId || id === selectedId
      marker.setIcon(bubble(item, active))
      marker.setZIndexOffset(active ? 1000 : 0)
    }
  }, [hoveredId, selectedId, data])

  const selected = data?.items.find((i) => i.id === selectedId)
  const placed = data ? data.items.filter((i) => i.latitude !== null).length : 0

  return (
    <div className={cn("relative overflow-hidden bg-[#e5e3df]", full ? "fixed inset-0 z-[70] rounded-none" : "rounded-xl", className)}>
      <div ref={box} className="size-full" role="application" aria-label="Map of the homes in these results" />

      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <Button type="button" variant="outline" size="icon" className="size-10 rounded-full border-hairline bg-white text-neutral-900 shadow-float hover:bg-neutral-100" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)}>
          {full ? <IconArrowsMinimize className="size-5" /> : <IconArrowsMaximize className="size-5" />}
        </Button>
        <div className="flex flex-col overflow-hidden rounded-full border border-hairline bg-white shadow-float">
          <Button type="button" variant="ghost" size="icon" className="size-10 rounded-none text-neutral-900 hover:bg-neutral-100" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
            <IconPlus className="size-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-10 rounded-none border-t border-neutral-200 text-neutral-900 hover:bg-neutral-100" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
            <IconMinus className="size-5" />
          </Button>
        </div>
      </div>

      {loading && <div className="absolute inset-0 z-[900] animate-pulse bg-neutral-300/50" aria-busy aria-label="Loading map" />}

      {error && (
        <div role="alert" className="absolute top-1/2 left-1/2 z-[1000] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-xl bg-white p-6 text-center text-neutral-900 shadow-float">
          <p className="text-sm">We couldn&apos;t load the map.</p>
          <Button size="sm" variant="outline" className="border-neutral-900 text-neutral-900" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {data && placed === 0 && (
        <p className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm text-neutral-900 shadow-float">No homes to show on the map</p>
      )}

      {data?.truncated && (
        <p className="absolute bottom-8 left-4 z-[1000] rounded-md bg-white/90 px-2 py-1 text-xs text-neutral-900">
          Showing {placed} of {data.total} homes. Zoom in with filters to narrow it down.
        </p>
      )}

      {selected && <MapCard listing={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

// What opens when you click a price bubble: photo, name, rating, price and a link to the home.
function MapCard({ listing, onClose }: { listing: ListingSummary; onClose: () => void }) {
  return (
    <article className="absolute bottom-6 left-1/2 z-[1100] w-[min(320px,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-xl bg-white text-neutral-900 shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
      <div className="relative aspect-[16/9] bg-neutral-200">
        {listing.photo_url && <Image src={listingPhotoSrc(listing.photo_url, 640)} alt={listing.photo_alt ?? listing.title} fill sizes="320px" className="object-cover" />}
        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 size-8 rounded-full bg-white/90 text-neutral-900 hover:bg-white" aria-label="Close" onClick={onClose}>
          <IconX className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm leading-5 font-semibold">
            <Link href={`/rooms/${listing.id}`} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-neutral-900">
              {TYPE_LABEL[listing.property_type] ?? "Stay"} in {listing.city}
            </Link>
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-sm">
            {listing.rating !== null ? (
              <>
                <IconStarFilled className="size-3" />
                {formatRating(listing.rating)}
              </>
            ) : (
              "New"
            )}
          </span>
        </div>
        <p className="truncate text-xs text-neutral-600">{listing.title}</p>
        <p className="text-sm">
          <span className="font-semibold">{formatPaise(listing.nightly_price_minor)}</span> night
        </p>
      </div>
    </article>
  )
}
