"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { IconChevronLeft, IconChevronRight, IconGridDots, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { listingPhotoSrc } from "@/lib/images"
import type { Photo } from "@/lib/listings-api"
import { cn } from "@/lib/utils"

// Grid cells for 1-5+ photos. Airbnb always shows a big photo plus four small ones; seed
// listings have 3-4 photos, so fewer photos get bigger cells instead of leaving gaps.
const CELLS: Record<number, string[]> = {
  1: ["col-span-4 row-span-2"],
  2: ["col-span-2 row-span-2", "col-span-2 row-span-2"],
  3: ["col-span-2 row-span-2", "col-span-2", "col-span-2"],
  4: ["col-span-2 row-span-2", "col-span-2", "col-span-1", "col-span-1"],
  5: ["col-span-2 row-span-2", "col-span-1", "col-span-1", "col-span-1", "col-span-1"],
}

export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  const shown = photos.slice(0, 5)

  if (photos.length === 0) {
    return <div className="aspect-[1120/504] rounded-xl bg-(image:--gradient-photo-placeholder)" role="img" aria-label="No photos yet" />
  }

  return (
    <>
      {/* Desktop/tablet: 1 big + up to 4 small. The big photo is the page's LCP image. */}
      <div className="relative hidden aspect-[1120/504] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl md:grid">
        {shown.map((photo, i) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
            className={cn("group relative overflow-hidden bg-(image:--gradient-photo-placeholder) outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset", CELLS[shown.length][i])}
          >
            <Image
              src={listingPhotoSrc(photo.url, i === 0 ? 1200 : 640)}
              alt={photo.alt_text || title}
              fill
              priority={i === 0}
              loading="eager"
              sizes={i === 0 ? "(min-width: 1128px) 560px, 50vw" : "(min-width: 1128px) 280px, 25vw"}
              className="object-cover transition-opacity duration-200 group-hover:opacity-90"
            />
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpenAt(0)}
          className="absolute right-5 bottom-5 h-8 gap-2 rounded-lg border-ink bg-background px-3 text-sm font-medium"
        >
          <IconGridDots className="size-4" />
          Show all photos
        </Button>
      </div>

      <MobileCarousel photos={photos} title={title} onOpen={setOpenAt} />

      <Dialog open={openAt !== null} onOpenChange={(o) => !o && setOpenAt(null)}>
        <DialogContent showCloseButton={false} className="h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          <DialogDescription className="sr-only">All photos of this home. Press Escape to close.</DialogDescription>
          {openAt !== null && <PhotoModal photos={photos} title={title} start={openAt} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function MobileCarousel({ photos, title, onOpen }: { photos: Photo[]; title: string; onOpen: (i: number) => void }) {
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setIndex(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  return (
    <Carousel setApi={setApi} className="relative -mx-6 md:hidden" aria-label="Photos">
      <CarouselContent className="ml-0">
        {photos.map((photo, i) => (
          <CarouselItem key={photo.url} className="pl-0">
            <button type="button" onClick={() => onOpen(i)} className="relative block aspect-[4/3] w-full bg-(image:--gradient-photo-placeholder)" aria-label={`Open photo ${i + 1} of ${photos.length}`}>
              <Image src={listingPhotoSrc(photo.url, 900)} alt={photo.alt_text || title} fill sizes="100vw" className="object-cover" />
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <span className="pointer-events-none absolute right-4 bottom-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-background">
        {index + 1} / {photos.length}
      </span>
    </Carousel>
  )
}

// Full-screen viewer (DETAIL-01): one photo at a time with previous/next, the arrow keys,
// a counter and a thumbnail strip. Opens at the photo that was clicked.
function PhotoModal({ photos, title, start }: { photos: Photo[]; title: string; start: number }) {
  const [index, setIndex] = useState(start)
  const last = photos.length - 1
  const go = useCallback((delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))), [last])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1)
      if (e.key === "ArrowRight") go(1)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [go])

  const photo = photos[index]

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-4">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Close photos">
            <IconX className="size-5" />
          </Button>
        </DialogClose>
        <span className="text-sm font-medium text-ink" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <span className="size-10" />
      </div>

      <div className="relative min-h-0 flex-1">
        <Image
          key={photo.url}
          src={listingPhotoSrc(photo.url, 1600)}
          alt={photo.alt_text || `${title}, photo ${index + 1}`}
          fill
          sizes="100vw"
          priority
          className="object-contain p-4 md:px-24"
        />
        <Button
          variant="outline"
          size="icon"
          className="absolute top-1/2 left-4 size-10 -translate-y-1/2 rounded-full border-hairline bg-background shadow-float disabled:opacity-30"
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          <IconChevronLeft className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute top-1/2 right-4 size-10 -translate-y-1/2 rounded-full border-hairline bg-background shadow-float disabled:opacity-30"
          aria-label="Next photo"
          disabled={index === last}
          onClick={() => go(1)}
        >
          <IconChevronRight className="size-5" />
        </Button>
      </div>

      <div className="flex shrink-0 justify-center gap-2 overflow-x-auto border-t border-hairline p-3">
        {photos.map((p, i) => (
          <button
            key={p.url}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index}
            className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-(image:--gradient-photo-placeholder) outline-none focus-visible:ring-2 focus-visible:ring-ink", i === index ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100")}
          >
            <Image src={listingPhotoSrc(p.url, 200)} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
