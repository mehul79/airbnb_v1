import { Suspense } from "react"
import { notFound } from "next/navigation"

import { CheckoutForm } from "@/components/booking/checkout-form"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchListingDetail } from "@/lib/listings-api"

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

async function Checkout({ params, searchParams }: Pick<PageProps<"/book/[listingId]">, "params" | "searchParams">) {
  const [{ listingId }, query] = await Promise.all([params, searchParams])
  const listing = await fetchListingDetail(listingId)
  if (!listing) notFound()

  const guests = Number(first(query.guests))
  return (
    <CheckoutForm
      listing={{
        id: listing.id,
        title: listing.title,
        location: `${listing.location_label}, ${listing.country}`,
        photo_url: listing.photos[0]?.url ?? null,
        rating: listing.rating,
        review_count: listing.review_count,
      }}
      checkIn={first(query.check_in)}
      checkOut={first(query.check_out)}
      guests={Number.isInteger(guests) && guests > 0 ? guests : 1}
    />
  )
}

export default function BookPage({ params, searchParams }: PageProps<"/book/[listingId]">) {
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-6 pt-10 pb-24 md:px-10">
      <h1 className="text-[32px] leading-10 font-semibold text-ink">Confirm your booking</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Checkout params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
