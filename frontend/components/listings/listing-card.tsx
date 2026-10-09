"use client"

import Image from "next/image"
import Link from "next/link"
import { IconHeart, IconStarFilled } from "@tabler/icons-react"

import { useFavorite } from "@/components/favorites/use-favorite"
import { Badge } from "@/components/ui/badge"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { formatRating, isGuestFavourite, TYPE_LABEL } from "@/lib/labels"
import type { ListingSummary } from "@/lib/listings-api"
import { cn } from "@/lib/utils"

// The small card on the home page shelves: photo, Guest favourite badge, heart, then
// "Villa in Anjuna" / "price for 1 night · rating". "Guest favourite" and ratings only show
// when the reviews back them up; a listing with none shows "New".
//
// The whole card is one link to the listing page. The title is the link and an ::after
// stretches it over the card, so the card shows the hand cursor and works from the keyboard.
// The heart is a separate button raised above it (a button cannot sit inside a link).
export function ListingCard({ listing }: { listing: ListingSummary }) {
  const { saved, toggle } = useFavorite(listing.id)

  return (
    <article className="relative flex w-[calc((100%-12px)/2)] shrink-0 snap-start flex-col gap-1 md:w-[calc((100%-24px)/3)] lg:w-[calc((100%-48px)/5)] xl:w-[calc((100%-72px)/7)]">
      <div className="relative aspect-[180/171] overflow-hidden rounded-xl bg-(image:--gradient-photo-placeholder)">
        {listing.photo_url && (
          <Image
            src={listingPhotoSrc(listing.photo_url, 640)}
            alt={listing.photo_alt ?? listing.title}
            fill
            sizes="(min-width: 1440px) 14vw, (min-width: 1128px) 20vw, (min-width: 744px) 33vw, 50vw"
            className="object-cover"
          />
        )}

        {isGuestFavourite(listing) && (
          <Badge className="absolute top-3 left-3 h-8 rounded-full bg-surface-hover/95 px-4 text-sm font-semibold text-ink">
            Guest favourite
          </Badge>
        )}

        <button
          type="button"
          aria-label={saved ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={saved}
          onClick={toggle}
          className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center text-white transition-transform hover:scale-110"
        >
          <IconHeart className={cn("size-7 drop-shadow-sm", saved ? "fill-rausch" : "fill-black/50")} stroke={2.2} />
        </button>
      </div>

      <div className="flex flex-col px-1 pt-1">
        <Link
          href={`/rooms/${listing.id}`}
          className="cursor-pointer truncate text-[13px] leading-4 font-medium text-ink outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink"
        >
          {TYPE_LABEL[listing.property_type] ?? "Stay"} in {listing.city}
        </Link>
        <p className="text-xs leading-4 text-muted-foreground">
          {formatPaise(listing.nightly_price_minor)} for 1 night &middot;{" "}
          {listing.rating !== null ? (
            <>
              <IconStarFilled className="mb-0.5 inline size-3 text-ink" /> {formatRating(listing.rating)}
            </>
          ) : (
            "New"
          )}
        </p>
      </div>
    </article>
  )
}
