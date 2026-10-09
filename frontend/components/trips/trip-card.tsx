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

// One trip. Title, place and photo come from the booking's own snapshot, so a trip stays
// readable after the host edits or archives the listing. The price shown is what was paid.
export function TripCard({ booking }: { booking: Booking }) {
  const past = booking.phase === "past"

  return (
    <article className="relative flex flex-col gap-3">
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-(image:--gradient-photo-placeholder)">
        {booking.cover_photo_url && (
          <Image
            src={listingPhotoSrc(booking.cover_photo_url)}
            alt={booking.listing_title}
            fill
            sizes="(min-width: 744px) 50vw, 100vw"
            className={past ? "object-cover grayscale-[40%]" : "object-cover"}
          />
        )}
        <Badge className="absolute top-3 left-3 h-8 rounded-full bg-surface-hover/95 px-4 text-sm font-semibold text-ink">
          {past ? "Completed" : startsIn(booking.check_in)}
        </Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base leading-6 font-semibold text-ink">
          <Link
            href={`/rooms/${booking.listing_id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ink"
          >
            {booking.listing_title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{booking.location}</p>
        <p className="text-sm text-ink">
          {dateRange(booking.check_in, booking.check_out)} &middot; {plural(booking.nights, "night")} &middot; {plural(booking.guests, "guest")}
        </p>
        <p className="text-sm text-ink">
          <span className="font-semibold">{formatPaise(booking.total_minor)}</span> total &middot; Confirmation{" "}
          <span className="font-medium tracking-wide">{booking.reference}</span>
        </p>
      </div>
    </article>
  )
}
