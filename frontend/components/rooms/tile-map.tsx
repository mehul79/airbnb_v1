"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { IconArrowsMaximize, IconArrowsMinimize, IconHome, IconMinus, IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TILE = 256
const MIN_ZOOM = 8
const MAX_ZOOM = 17

// Web-mercator: lat/lng to fractional tile coordinates at a zoom level.
function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const rad = (lat * Math.PI) / 180
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  }
}

// A small map built from OpenStreetMap raster tiles: no API key and no map library. The home
// stays centred; the buttons zoom and go full screen. Tile positions are per-render numbers,
// so they are the one place inline styles are used.
export function TileMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [zoom, setZoom] = useState(12)
  const [full, setFull] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [full])

  const center = project(lat, lng, zoom)
  const originX = center.x * TILE - size.w / 2
  const originY = center.y * TILE - size.h / 2
  const maxIndex = 2 ** zoom
  const tiles: { raw: number; x: number; y: number }[] = []
  if (size.w > 0) {
    for (let y = Math.floor(originY / TILE); y <= Math.floor((originY + size.h) / TILE); y++) {
      for (let x = Math.floor(originX / TILE); x <= Math.floor((originX + size.w) / TILE); x++) {
        if (y >= 0 && y < maxIndex) tiles.push({ raw: x, x: ((x % maxIndex) + maxIndex) % maxIndex, y })
      }
    }
  }

  return (
    <div
      ref={box}
      role="application"
      aria-label={`Map of ${label}`}
      className={cn("relative overflow-hidden bg-[#e5e3df]", full ? "fixed inset-0 z-50 rounded-none" : "h-[480px] rounded-xl")}
    >
      {tiles.map(({ raw, x, y }) => (
        <Image
          key={`${zoom}/${raw}/${y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
          alt=""
          width={TILE}
          height={TILE}
          unoptimized
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: raw * TILE - originX, top: y * TILE - originY }}
        />
      ))}

      <div className="pointer-events-none absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-background shadow-float">
        <IconHome className="size-6" />
      </div>

      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button type="button" variant="outline" size="icon" className="size-10 rounded-full bg-background shadow-float" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)}>
          {full ? <IconArrowsMinimize className="size-5" /> : <IconArrowsMaximize className="size-5" />}
        </Button>
        <div className="flex flex-col overflow-hidden rounded-full border border-hairline bg-background shadow-float">
          <Button type="button" variant="ghost" size="icon" className="size-10 rounded-none" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => z + 1)}>
            <IconPlus className="size-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-10 rounded-none border-t border-hairline" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => z - 1)}>
            <IconMinus className="size-5" />
          </Button>
        </div>
      </div>

      <p className="absolute right-0 bottom-0 bg-background/80 px-2 py-0.5 text-[10px] text-ink">
        &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors
      </p>
    </div>
  )
}
