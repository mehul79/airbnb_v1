"use client"

import { useState } from "react"
import Link from "next/link"
import { IconHistory, IconLuggage } from "@tabler/icons-react"

import { useSessionUser } from "@/components/auth/use-session"
import { useAppStore } from "@/components/providers/app-store-provider"
import { SectionError } from "@/components/rooms/lazy-section"
import { TripCard } from "@/components/trips/trip-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BookingPage } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

type Phase = "upcoming" | "past"
const PAGE_SIZE = 6

// BOOK-03: the signed-in user's own bookings, upcoming and past. The API filters by the
// session, so this page can only ever receive the current account's trips.
export function TripsView() {
  const { user, checked } = useSessionUser()
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)
  const [phase, setPhase] = useState<Phase>("upcoming")

  if (!checked) return <TripsSkeleton />

  if (!user) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconLuggage />
          </EmptyMedia>
          <EmptyTitle>Log in to see your trips</EmptyTitle>
          <EmptyDescription>Your reservations show up here once you&apos;re signed in.</EmptyDescription>
        </EmptyHeader>
        <Button variant="auth" size="lg" onClick={openAuthDialog}>
          Log in or sign up
        </Button>
      </Empty>
    )
  }

  return (
    <Tabs value={phase} onValueChange={(v) => setPhase(v as Phase)} className="gap-8">
      <TabsList variant="line" className="h-auto w-full justify-start gap-8 rounded-none border-b border-hairline p-0">
        {(["upcoming", "past"] as const).map((p) => (
          <TabsTrigger
            key={p}
            value={p}
            className="h-12 flex-none rounded-none px-0 text-base font-medium text-muted-foreground capitalize after:bottom-0 data-active:text-ink"
          >
            {p}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* key = user id: switching accounts remounts the list, so nothing carries over */}
      <TabsContent value="upcoming">
        <TripsList key={`${user.id}-upcoming`} phase="upcoming" />
      </TabsContent>
      <TabsContent value="past">
        <TripsList key={`${user.id}-past`} phase="past" />
      </TabsContent>
    </Tabs>
  )
}

// One phase's trips: page 1 on mount, "Show more" adds the next page. Private data is
// always fetched fresh, so a booking made a moment ago is already there.
function TripsList({ phase }: { phase: Phase }) {
  const [pages, setPages] = useState(1)
  const first = useQuery<BookingPage>(`/me/bookings?phase=${phase}&page=1&page_size=${PAGE_SIZE}`, { fresh: true })

  if (first.error) return <SectionError label="your trips" onRetry={first.retry} />
  if (first.loading || !first.data) return <TripsSkeleton />

  if (first.data.total === 0) return <NoTrips phase={phase} />

  return (
    <div className="flex flex-col gap-10">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {first.data.total} {phase} {first.data.total === 1 ? "trip" : "trips"}
      </p>
      <ul className="flex max-w-[900px] flex-col gap-4">
        {Array.from({ length: pages }, (_, i) => (
          <TripsPage key={i} phase={phase} page={i + 1} />
        ))}
      </ul>
      {pages < first.data.total_pages && (
        <Button variant="outline" size="lg" className="w-fit rounded-lg border-ink px-6 font-semibold" onClick={() => setPages((p) => p + 1)}>
          Show more trips
        </Button>
      )}
    </div>
  )
}

function TripsPage({ phase, page }: { phase: Phase; page: number }) {
  const { data, error, retry } = useQuery<BookingPage>(`/me/bookings?phase=${phase}&page=${page}&page_size=${PAGE_SIZE}`, { fresh: true })

  if (error)
    return (
      <li>
        <SectionError label="more trips" onRetry={retry} />
      </li>
    )
  if (!data)
    return Array.from({ length: PAGE_SIZE }, (_, i) => (
      <li key={i}>
        <TripCardSkeleton />
      </li>
    ))
  return data.items.map((booking) => (
    <li key={booking.id}>
      <TripCard booking={booking} />
    </li>
  ))
}

function NoTrips({ phase }: { phase: Phase }) {
  const upcoming = phase === "upcoming"
  return (
    <Empty className="max-w-[560px] border border-hairline">
      <EmptyHeader>
        <EmptyMedia variant="icon">{upcoming ? <IconLuggage /> : <IconHistory />}</EmptyMedia>
        <EmptyTitle>{upcoming ? "No trips booked... yet!" : "No past trips yet"}</EmptyTitle>
        <EmptyDescription>
          {upcoming ? "Time to dust off your bags and start planning your next adventure." : "Stays you've completed will show up here."}
        </EmptyDescription>
      </EmptyHeader>
      {upcoming && (
        <Button asChild variant="outline" size="lg">
          <Link href="/">Start searching</Link>
        </Button>
      )}
    </Empty>
  )
}

function TripCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-hairline sm:flex-row" aria-busy>
      <Skeleton className="h-[180px] w-full shrink-0 rounded-none sm:h-[200px] sm:w-[240px]" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-auto h-8 w-full" />
      </div>
    </div>
  )
}

function TripsSkeleton() {
  return (
    <div className="flex max-w-[900px] flex-col gap-4" aria-busy aria-label="Loading trips">
      {Array.from({ length: 2 }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  )
}
