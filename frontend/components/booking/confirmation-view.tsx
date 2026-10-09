"use client"

import Image from "next/image"
import Link from "next/link"
import { IconCircleCheckFilled, IconFileOff } from "@tabler/icons-react"
import { format, parseISO } from "date-fns"

import { useSessionUser } from "@/components/auth/use-session"
import { PriceBreakdown } from "@/components/booking/price-breakdown"
import { useAppStore } from "@/components/providers/app-store-provider"
import { SectionError } from "@/components/rooms/lazy-section"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { listingPhotoSrc } from "@/lib/images"
import { plural } from "@/lib/labels"
import { profileHref } from "@/lib/profile-links"
import type { Booking } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

const longDate = (iso: string) => format(parseISO(iso), "EEE, d MMM yyyy")

// BOOK-02 confirmation: reads the saved booking, so refreshing this page, or opening it
// later, shows the same thing. Only its guest can load it (the API answers 404 otherwise).
export function ConfirmationView({ bookingId }: { bookingId: string }) {
  const { user, checked } = useSessionUser()
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)

  if (!checked) return <ConfirmationSkeleton />

  if (!user) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyTitle>Log in to see this booking</EmptyTitle>
          <EmptyDescription>Bookings are private to the guest who made them.</EmptyDescription>
        </EmptyHeader>
        <Button variant="auth" size="lg" onClick={openAuthDialog}>
          Log in or sign up
        </Button>
      </Empty>
    )
  }
  return <BookingDetails key={user.id} bookingId={bookingId} />
}

function BookingDetails({ bookingId }: { bookingId: string }) {
  const { data: booking, error, loading, retry } = useQuery<Booking>(`/bookings/${bookingId}`, { fresh: true })

  if (loading) return <ConfirmationSkeleton />
  if (error || !booking) {
    // The API says 404 for both "doesn't exist" and "isn't yours"; either way, nothing to show.
    return (
      <div className="flex flex-col gap-6">
        <SectionError label="this booking" onRetry={retry} />
        <Empty className="max-w-[560px] border border-hairline">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFileOff />
            </EmptyMedia>
            <EmptyTitle>Can&apos;t find that booking?</EmptyTitle>
            <EmptyDescription>It may belong to another account. Your own bookings are under Trips.</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline" size="lg">
            <Link href={profileHref("trips")}>Go to Trips</Link>
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-24">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <IconCircleCheckFilled className="size-10 shrink-0 text-ink" aria-hidden />
          <div>
            <p className="text-[22px] leading-7 font-semibold text-ink">Your stay is booked</p>
            <p className="text-base text-muted-foreground">
              Confirmation code <span className="font-semibold tracking-wide text-ink">{booking.reference}</span>
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-4 border-y border-hairline py-8">
          <h2 className="text-[22px] leading-7 font-semibold text-ink">Your trip</h2>
          <div>
            <p className="text-base font-semibold text-ink">Check-in</p>
            <p className="text-base text-ink">{longDate(booking.check_in)}</p>
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Check-out</p>
            <p className="text-base text-ink">{longDate(booking.check_out)}</p>
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Guests</p>
            <p className="text-base text-ink">
              {plural(booking.guests, "guest")} &middot; {plural(booking.nights, "night")}
            </p>
          </div>
        </section>

        <PriceBreakdown lines={booking} heading="Price paid" />
        <p className="text-sm text-muted-foreground">This is a demo booking: no payment was taken.</p>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 px-6 font-semibold">
            <Link href={profileHref("trips")}>View my trips</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6 font-semibold">
            <Link href="/">Keep exploring</Link>
          </Button>
        </div>
      </div>

      <aside aria-label="Listing" className="flex flex-col gap-3 self-start rounded-xl border border-hairline p-4">
        <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-(image:--gradient-photo-placeholder)">
          {booking.cover_photo_url && <Image src={listingPhotoSrc(booking.cover_photo_url)} alt={booking.listing_title} fill sizes="420px" className="object-cover" />}
        </div>
        <div>
          <p className="text-base font-semibold text-ink">{booking.listing_title}</p>
          <p className="text-sm text-muted-foreground">{booking.location}</p>
        </div>
        <Link href={`/rooms/${booking.listing_id}`} className="w-fit text-sm font-semibold text-ink underline">
          View listing
        </Link>
      </aside>
    </div>
  )
}

function ConfirmationSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]" aria-busy aria-label="Loading booking">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
