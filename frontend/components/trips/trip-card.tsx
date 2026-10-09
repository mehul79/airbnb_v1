import Image from "next/image"
import Link from "next/link"
import { differenceInCalendarDays, format, isSameYear, parseISO } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { plural } from "@/lib/labels"
import type { Booking } from "@/lib/listings-api"

// "12 – 15 Oct 2026", "30 Oct – 2 Nov 2026", or with both years when the stay spans two.
function dateRange(checkIn: string, checkOut: string) {
  const a = parseISO(checkIn)
  const b = parseISO(checkOut)
  if (!isSameYear(a, b)) return `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`
  const start = a.getMonth() === b.getMonth() ? format(a, "d") : format(a, "d MMM")
  return `${start} – ${format(b, "d MMM yyyy")}`
}

// "Today" / "Tomorrow" / "In 5 days" for upcoming stays; "Happening now" once it has started.
function startsIn(checkIn: string) {
  const days = differenceInCalendarDays(parseISO(checkIn), new Date())
  if (days < 0) return "Happening now"
  if (days === 0) return "Starts today"
  if (days === 1) return "Starts tomorrow"
  return `In ${days} days`
}

// One trip, as a full-width block: photo on the left, details on the right (stacked on a phone).
// Title, place and photo come from the booking's own snapshot, so a trip stays readable after
// the host edits or archives the listing. The price shown is what was paid.
//
// Clicking works as before: the title is the link (to the listing) and its ::after stretches
// over the whole block, so the block is one real <a>: Tab + Enter work, with a visible focus ring.
export function TripCard({ booking }: { booking: Booking }) {
  const past = booking.phase === "past"

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-background transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-float sm:flex-row">
      <div className="relative h-[180px] w-full shrink-0 bg-(image:--gradient-photo-placeholder) sm:h-auto sm:min-h-[200px] sm:w-[240px]">
        {booking.cover_photo_url && (
          <Image
            src={listingPhotoSrc(booking.cover_photo_url)}
            alt={booking.listing_title}
            fill
            sizes="(min-width: 640px) 240px, 100vw"
            className={past ? "object-cover grayscale-[40%]" : "object-cover"}
          />
        )}
        <Badge className="absolute top-3 left-3 h-8 rounded-full bg-surface-hover/95 px-4 text-sm font-semibold text-ink">
          {past ? "Completed" : startsIn(booking.check_in)}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="line-clamp-2 text-lg leading-6 font-semibold text-ink">
            <Link
              href={`/rooms/${booking.listing_id}`}
              className="cursor-pointer outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink"
            >
              {booking.listing_title}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted-foreground">{booking.location}</p>
          <p className="mt-1 text-sm text-ink">
            {dateRange(booking.check_in, booking.check_out)} &middot; {plural(booking.nights, "night")} &middot; {plural(booking.guests, "guest")}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-hairline-soft pt-4">
          <p className="text-base text-ink">
            <span className="font-semibold">{formatPaise(booking.total_minor)}</span> <span className="text-sm text-muted-foreground">total</span>
          </p>
          <p className="text-right text-xs text-muted-foreground">
            Confirmation
            <span className="block font-mono text-sm tracking-wider text-ink">{booking.reference}</span>
          </p>
        </div>
      </div>
    </article>
  )
}
