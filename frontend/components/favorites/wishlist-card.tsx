"use client"

import Image from "next/image"
import Link from "next/link"
import { IconHeartFilled, IconStarFilled } from "@tabler/icons-react"

import { CardBadge } from "@/components/listings/card-badge"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { formatRating, TYPE_LABEL } from "@/lib/labels"
import type { ListingSummary } from "@/lib/listings-api"
import { cn } from "@/lib/utils"

// A saved home. Same click as every other card: the title is the link to the listing and its
// ::after stretches over the card, so the whole card is one real <a> (Tab + Enter, focus ring).
// The heart is a separate button above that layer and never navigates. The badge sits top-left
// and the heart top-right, and a card is always wide enough that they cannot touch.
export function WishlistCard({
  listing,
  leaving,
  onRemove,
}: {
  listing: ListingSummary
  leaving: boolean
  onRemove: (listing: ListingSummary) => void
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        leaving && "pointer-events-none scale-95 opacity-0"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-(image:--gradient-photo-placeholder)">
        {listing.photo_url && (
          <Image
            src={listingPhotoSrc(listing.photo_url, 800)}
            alt={listing.photo_alt ?? listing.title}
            fill
            sizes="(min-width: 744px) 300px, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        )}

        <CardBadge guestFavourite={listing.guest_favourite} superhost={listing.host_superhost} />

        <button
          type="button"
          aria-label="Remove from wishlist"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove(listing)
          }}
          className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/35 text-rausch backdrop-blur-sm transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-white"
        >
          <IconHeartFilled className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 text-base leading-5 font-semibold text-ink">
            <Link
              href={`/rooms/${listing.id}`}
              className="cursor-pointer outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink"
            >
              {TYPE_LABEL[listing.property_type] ?? "Stay"} in {listing.city}
            </Link>
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-sm leading-5 text-ink">
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
        <p className="truncate text-sm text-muted-foreground">{listing.title}</p>
        <p className="mt-1 text-sm text-ink">
          <span className="font-semibold">{formatPaise(listing.nightly_price_minor)}</span> / night
        </p>
      </div>
    </article>
  )
}
