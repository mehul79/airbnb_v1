"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconAlertCircle, IconCalendarOff, IconStarFilled } from "@tabler/icons-react"
import { format, parseISO } from "date-fns"

import { useSessionUser } from "@/components/auth/use-session"
import { PriceBreakdown } from "@/components/booking/price-breakdown"
import { useAppStore } from "@/components/providers/app-store-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, apiPost } from "@/lib/api"
import { listingPhotoSrc } from "@/lib/images"
import { formatRating, plural } from "@/lib/labels"
import type { Booking, Quote } from "@/lib/listings-api"
import { useQuote } from "@/lib/use-quote"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const longDate = (iso: string) => format(parseISO(iso), "EEE, d MMM yyyy")

export type CheckoutListing = {
  id: string
  title: string
  location: string
  photo_url: string | null
  rating: number | null
  review_count: number
}

type Problem = { message: string; unavailable?: boolean }

// BOOK-02: review the stay and the exact total, then explicitly confirm. No payment is taken
// and no card is asked for. Retry safety: one Idempotency-Key per quote, reused for every
// retry or double-click, so the API returns the same booking instead of creating another.
export function CheckoutForm({ listing, checkIn, checkOut, guests }: { listing: CheckoutListing; checkIn?: string; checkOut?: string; guests: number }) {
  const router = useRouter()
  const { user, checked } = useSessionUser()
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)

  const valid = !!checkIn && !!checkOut && DAY.test(checkIn) && DAY.test(checkOut)
  const { quote: fetched, error: quoteError, loading } = useQuote(listing.id, valid ? checkIn! : null, valid ? checkOut! : null, guests)
  const [changed, setChanged] = useState<Quote>() // the fresh quote after PRICE_CHANGED
  const quote = changed ?? fetched

  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<Problem>()
  const key = useRef<{ fingerprint: string; value: string }>(undefined)

  const roomUrl = `/rooms/${listing.id}${valid ? `?${new URLSearchParams({ check_in: checkIn!, check_out: checkOut!, guests: String(guests) })}` : ""}`

  async function confirm() {
    if (!quote || pending) return
    // A new quote gets a new key; the same quote always reuses its key.
    if (key.current?.fingerprint !== quote.quote_fingerprint) {
      key.current = { fingerprint: quote.quote_fingerprint, value: crypto.randomUUID() }
    }
    setPending(true)
    setProblem(undefined)
    try {
      const booking = await apiPost<Booking>(
        "/bookings",
        { listing_id: listing.id, check_in: checkIn, check_out: checkOut, guests, quote_fingerprint: quote.quote_fingerprint },
        { "Idempotency-Key": key.current.value }
      )
      router.push(`/bookings/${booking.id}/confirmation`)
      return // stay "pending" while the confirmation page loads, so it can't be pressed twice
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuthDialog()
      else if (e instanceof ApiError && e.code === "PRICE_CHANGED") {
        setChanged(e.extra.quote as Quote)
        setProblem({ message: e.message })
      } else if (e instanceof ApiError && e.code === "DATES_UNAVAILABLE") {
        setProblem({ message: e.message, unavailable: true })
      } else {
        setProblem({ message: e instanceof ApiError ? e.message : "Something went wrong. Please try again." })
      }
    }
    setPending(false)
  }

  if (!valid) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCalendarOff />
          </EmptyMedia>
          <EmptyTitle>Choose your dates first</EmptyTitle>
          <EmptyDescription>Pick check-in and check-out on the listing to see your price.</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline" size="lg">
          <Link href={roomUrl}>Back to the listing</Link>
        </Button>
      </Empty>
    )
  }

  if (!checked) return <CheckoutSkeleton />

  if (!user) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyTitle>Log in to book this stay</EmptyTitle>
          <EmptyDescription>You need an account to confirm a booking.</EmptyDescription>
        </EmptyHeader>
        <Button variant="auth" size="lg" onClick={openAuthDialog}>
          Log in or sign up
        </Button>
      </Empty>
    )
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-24">
      <div className="order-2 flex flex-col gap-8 lg:order-1">
        {problem && (
          <Alert variant="destructive" role="alert">
            <IconAlertCircle />
            <AlertTitle>{problem.unavailable ? "Those dates are no longer available" : changed ? "The price changed" : "We couldn't confirm your booking"}</AlertTitle>
            <AlertDescription>
              {problem.message}
              {problem.unavailable && (
                <>
                  {" "}
                  <Link href={roomUrl} className="font-semibold underline">
                    Choose other dates
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <section className="flex flex-col gap-4 border-b border-hairline pb-8">
          <h2 className="text-[22px] leading-7 font-semibold text-ink">Your trip</h2>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-ink">Dates</p>
              <p className="text-base text-ink">
                {longDate(checkIn!)} &ndash; {longDate(checkOut!)}
              </p>
            </div>
            <Link href={roomUrl} className="text-base font-semibold text-ink underline">
              Edit
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-ink">Guests</p>
              <p className="text-base text-ink">{plural(guests, "guest")}</p>
            </div>
            <Link href={roomUrl} className="text-base font-semibold text-ink underline">
              Edit
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-b border-hairline pb-8">
          <h2 className="text-[22px] leading-7 font-semibold text-ink">Payment</h2>
          <p className="text-base text-ink">
            This is a demo, so <strong>you won&apos;t be charged</strong> and we won&apos;t ask for card details. Confirming just reserves the dates.
          </p>
        </section>

        <div className="flex flex-col items-start gap-3">
          <Button size="lg" className="h-14 w-full px-8 text-base font-semibold sm:w-auto" onClick={confirm} disabled={!quote || pending}>
            {pending ? "Confirming…" : changed ? "Confirm at the new price" : "Confirm booking"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Pressing it again, or retrying after a lost connection, never makes a second booking.
          </p>
        </div>
      </div>

      <aside className="order-1 lg:order-2" aria-label="Booking summary">
        <div className="flex flex-col gap-6 rounded-xl border border-hairline p-6 lg:sticky lg:top-28">
          <div className="flex gap-4">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-lg bg-(image:--gradient-photo-placeholder)">
              {listing.photo_url && <Image src={listingPhotoSrc(listing.photo_url, 400)} alt="" fill sizes="112px" className="object-cover" />}
            </div>
            <div className="flex min-w-0 flex-col justify-between">
              <div>
                <p className="text-base leading-5 font-semibold text-ink">{listing.title}</p>
                <p className="text-sm text-muted-foreground">{listing.location}</p>
              </div>
              <p className="flex items-center gap-1 text-sm text-ink">
                {listing.rating !== null ? (
                  <>
                    <IconStarFilled className="size-3" />
                    {formatRating(listing.rating)} <span className="text-muted-foreground">({listing.review_count})</span>
                  </>
                ) : (
                  "New"
                )}
              </p>
            </div>
          </div>

          <div className="border-t border-hairline pt-6">
            {quote ? (
              <PriceBreakdown lines={quote} />
            ) : quoteError ? (
              <p role="alert" className="text-base text-error">
                {quoteError}{" "}
                <Link href={roomUrl} className="font-semibold underline">
                  Change your dates
                </Link>
              </p>
            ) : loading ? (
              <div className="flex flex-col gap-3" aria-busy>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]" aria-busy aria-label="Loading checkout">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-48" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
