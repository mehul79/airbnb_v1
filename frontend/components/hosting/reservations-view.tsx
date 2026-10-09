"use client"

import { useState } from "react"
import Link from "next/link"
import { IconCalendarEvent } from "@tabler/icons-react"
import { format, parseISO } from "date-fns"

import { RequireUser } from "@/components/auth/require-user"
import { SectionError } from "@/components/rooms/lazy-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPaise } from "@/lib/format"
import type { HostBookingPage, HostListingSummary } from "@/lib/host-types"
import { plural } from "@/lib/labels"
import { profileHref } from "@/lib/profile-links"
import { useQuery } from "@/lib/use-query"

type Phase = "upcoming" | "past"
const PAGE_SIZE = 10
const day = (iso: string) => format(parseISO(iso), "d MMM yyyy")
const ALL = "all"

// HOST-03: reservations on the host's own listings. Guests are shown by name only; the
// API never sends their email or id to a host.
export function ReservationsView() {
  return (
    <RequireUser title="Log in to see reservations" description="Reservations on your listings show up here.">
      {(user) => <Reservations key={user.id} />}
    </RequireUser>
  )
}

function Reservations() {
  const [phase, setPhase] = useState<Phase>("upcoming")
  const [listingId, setListingId] = useState(ALL)
  const listings = useQuery<{ items: HostListingSummary[] }>("/host/listings?include_archived=true", { fresh: true })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={phase} onValueChange={(p) => setPhase(p as Phase)} className="gap-0">
          <TabsList variant="line" className="h-auto gap-8 rounded-none p-0">
            {(["upcoming", "past"] as const).map((p) => (
              <TabsTrigger key={p} value={p} className="h-10 flex-none rounded-none px-0 text-base font-medium text-muted-foreground capitalize after:bottom-0 data-active:text-ink">
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select value={listingId} onValueChange={setListingId}>
          <SelectTrigger className="h-10 w-full min-w-56 sm:w-72" aria-label="Filter by listing">
            <SelectValue placeholder="All listings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All listings</SelectItem>
            {listings.data?.items.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* key: a different filter starts again from page 1 */}
      <ReservationList key={`${phase}-${listingId}`} phase={phase} listingId={listingId === ALL ? null : listingId} />
    </div>
  )
}

function ReservationList({ phase, listingId }: { phase: Phase; listingId: string | null }) {
  const [page, setPage] = useState(1)
  const query = `/host/bookings?phase=${phase}&page=${page}&page_size=${PAGE_SIZE}${listingId ? `&listing_id=${listingId}` : ""}`
  const { data, error, loading, retry } = useQuery<HostBookingPage>(query, { fresh: true })

  if (error) return <SectionError label="reservations" onRetry={retry} />
  if (loading || !data) return <Skeleton className="h-72 w-full rounded-xl" aria-busy aria-label="Loading reservations" />

  if (data.total === 0) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconCalendarEvent />
          </EmptyMedia>
          <EmptyTitle>No {phase} reservations</EmptyTitle>
          <EmptyDescription>When a guest books one of your listings, it appears here.</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline" size="lg">
          <Link href={profileHref("hosting")}>Back to your listings</Link>
        </Button>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-hairline">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Confirmation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-ink">{b.guest_name}</TableCell>
                <TableCell className="max-w-64 truncate">{b.listing_title}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {day(b.check_in)} &ndash; {day(b.check_out)}
                  <span className="block text-xs text-muted-foreground">{plural(b.nights, "night")}</span>
                </TableCell>
                <TableCell>{b.guests}</TableCell>
                <TableCell className="text-right font-medium text-ink">{formatPaise(b.total_minor)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono tracking-wide">
                    {b.reference}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p aria-live="polite">
          {data.total} {phase} {data.total === 1 ? "reservation" : "reservations"}
        </p>
        {data.total_pages > 1 && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              {page} / {data.total_pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
