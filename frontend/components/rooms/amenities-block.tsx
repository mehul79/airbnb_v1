"use client"

import { createElement } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { amenityIcon } from "@/lib/amenity-icons"
import type { Amenity } from "@/lib/listings-api"

const PREVIEW = 10

function AmenityRow({ amenity, large }: { amenity: Amenity; large?: boolean }) {
  return (
    <li className={large ? "flex items-center gap-4 border-b border-hairline py-5" : "flex items-center gap-4 py-2"}>
      {createElement(amenityIcon(amenity.icon_key), { className: "size-6 shrink-0 text-ink", stroke: 1.5 })}
      <span className="text-base text-ink">{amenity.name}</span>
    </li>
  )
}

export function AmenitiesBlock({ amenities }: { amenities: Amenity[] }) {
  if (amenities.length === 0) return null
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[22px] leading-7 font-semibold text-ink">What this place offers</h2>
      <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {amenities.slice(0, PREVIEW).map((a) => (
          <AmenityRow key={a.slug} amenity={a} />
        ))}
      </ul>
      {amenities.length > PREVIEW && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" className="w-fit rounded-lg border-ink px-6 font-semibold">
              Show all {amenities.length} amenities
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[640px]">
            <DialogHeader className="border-b border-hairline px-8 py-6">
              <DialogTitle className="text-[22px] leading-7 font-semibold">What this place offers</DialogTitle>
              <DialogDescription className="sr-only">Every amenity this home lists.</DialogDescription>
            </DialogHeader>
            <ul className="overflow-y-auto px-8 py-2">
              {amenities.map((a) => (
                <AmenityRow key={a.slug} amenity={a} large />
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
