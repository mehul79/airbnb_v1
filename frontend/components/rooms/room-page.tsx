import { notFound } from "next/navigation"

import { BookingBar } from "@/components/rooms/booking-bar"
import { PhotoGallery } from "@/components/rooms/photo-gallery"
import { ReservationCard } from "@/components/rooms/reservation-card"
import { LazyCalendar, LazyHost, LazyLocation, LazyNearby, LazyPolicies, LazyReviews } from "@/components/rooms/room-lazy"
import { RoomOverview } from "@/components/rooms/room-overview"
import { RoomTitle } from "@/components/rooms/room-title"
import { StaySync } from "@/components/rooms/stay-sync"
import { fetchListingDetail } from "@/lib/listings-api"

type Search = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// Above the fold (title, gallery, overview, description, amenities, reservation card) comes
// with the page from one request. Everything below is a LazySection that loads on approach.
export async function RoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const listing = await fetchListingDetail(id)
  if (!listing) notFound()

  const bookable = { id: listing.id, nightly_price_minor: listing.nightly_price_minor, max_guests: listing.max_guests }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-24 md:px-10 lg:pb-0">
      <StaySync checkIn={first(query.check_in)} checkOut={first(query.check_out)} guests={first(query.guests)} />

      <RoomTitle id={listing.id} title={listing.title} />
      <PhotoGallery photos={listing.photos} title={listing.title} />

      {/* The reservation card is sticky inside this section only; reviews onward run full width. */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_372px] lg:gap-x-[88px]">
        <div className="min-w-0">
          <RoomOverview listing={listing} />
          <LazyCalendar listingId={listing.id} city={listing.city} />
        </div>
        <aside className="hidden lg:block" aria-label="Reservation">
          <div className="sticky top-28 pt-8">
            <ReservationCard listing={bookable} />
          </div>
        </aside>
      </div>

      <LazyReviews listingId={listing.id} rating={listing.rating} reviewCount={listing.review_count} />
      <LazyLocation label={`${listing.location_label}, ${listing.country}`} latitude={listing.latitude} longitude={listing.longitude} />
      <LazyHost host={listing.host} rating={listing.rating} reviewCount={listing.review_count} />
      <LazyPolicies maxGuests={listing.max_guests} />
      <LazyNearby listingId={listing.id} region={listing.region} />

      <BookingBar listing={bookable} />
    </div>
  )
}
