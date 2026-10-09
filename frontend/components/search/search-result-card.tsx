"use client"

import Image from "next/image"
import Link from "next/link"
import { IconHeart, IconStarFilled } from "@tabler/icons-react"

import { useFavorite } from "@/components/favorites/use-favorite"
import { CardBadge } from "@/components/listings/card-badge"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { formatRating, TYPE_LABEL } from "@/lib/labels"
import type { ListingSummary } from "@/lib/listings-api"
import { cn } from "@/lib/utils"

// Search-result card: square photo, heart, "Villa in Anjuna" + rating, title, price.
// The title link is stretched over the card (same pattern as the home rows); the heart sits
// above it as its own button (saving needs a login; see useFavorite).
export function SearchResultCard({ listing }: { listing: ListingSummary }) {
  const { saved: favourite, toggle } = useFavorite(listing.id)

  return (
    <article className="relative flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-(image:--gradient-photo-placeholder)">
        {listing.photo_url && (
          <Image
            src={listingPhotoSrc(listing.photo_url)}
            alt={listing.photo_alt ?? listing.title}
            fill
            sizes="(min-width: 1440px) 20vw, (min-width: 1128px) 25vw, (min-width: 744px) 33vw, 50vw"
            className="object-cover"
          />
        )}

        <CardBadge guestFavourite={listing.guest_favourite} superhost={listing.host_superhost} />

        <button
          type="button"
          aria-label={favourite ? "Remove from favourites" : "Save to favourites"}
          onClick={toggle}
          aria-pressed={favourite}
          className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center text-white transition-transform hover:scale-110"
        >
          <IconHeart className={cn("size-7 drop-shadow-sm", favourite ? "fill-rausch" : "fill-black/50")} stroke={2.2} />
        </button>
      </div>

      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/rooms/${listing.id}`}
            className="truncate text-[15px] leading-5 font-medium text-ink outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink"
          >
            {TYPE_LABEL[listing.property_type] ?? "Stay"} in {listing.city}
          </Link>
          <span className="flex shrink-0 items-center gap-1 text-[15px] leading-5 text-ink">
            {listing.rating !== null ? (
              <>
                <IconStarFilled className="size-3" />
                {formatRating(listing.rating)}
                <span className="text-muted-foreground">({listing.review_count})</span>
              </>
            ) : (
              "New"
            )}
          </span>
        </div>
        <p className="truncate text-[15px] leading-5 text-muted-foreground">{listing.title}</p>
        <p className="text-[15px] leading-5 text-ink">
          <span className="font-semibold">{formatPaise(listing.nightly_price_minor)}</span> night
        </p>
      </div>
    </article>
  )
}
