"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { IconHomePlus } from "@tabler/icons-react"
import { toast } from "sonner"

import { RequireUser } from "@/components/auth/require-user"
import { SectionError } from "@/components/rooms/lazy-section"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { apiDelete } from "@/lib/api"
import { formatPaise } from "@/lib/format"
import { listingPhotoSrc } from "@/lib/images"
import { plural } from "@/lib/labels"
import type { HostListingSummary } from "@/lib/host-types"
import { useQuery } from "@/lib/use-query"

// HOST-03: the host's own listings and what is booked on them. The API only ever returns
// listings owned by the signed-in user.
export function DashboardView() {
  return (
    <RequireUser title="Log in to host" description="Create a listing or manage the ones you have.">
      {(user) => <Dashboard key={user.id} />}
    </RequireUser>
  )
}

function Dashboard() {
  const [showArchived, setShowArchived] = useState(false)
  const [toArchive, setToArchive] = useState<HostListingSummary | null>(null)
  const [archiving, setArchiving] = useState(false)
  const { data, error, loading, retry } = useQuery<{ items: HostListingSummary[] }>(`/host/listings?include_archived=${showArchived}`, { fresh: true })

  async function archive() {
    if (!toArchive || archiving) return
    setArchiving(true)
    try {
      await apiDelete(`/host/listings/${toArchive.id}`)
      toast("Listing archived")
      setToArchive(null)
      retry() // reload the list
    } catch {
      toast("Couldn't archive the listing. Please try again.")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived listings" />
            Show archived
          </label>
        </div>
        <Button asChild size="lg" className="h-12 gap-2 px-5 font-semibold">
          <Link href="/hosting/listings/new">
            <IconHomePlus data-icon="inline-start" />
            Create listing
          </Link>
        </Button>
      </div>

      {error ? (
        <SectionError label="your listings" onRetry={retry} />
      ) : loading || !data ? (
        <ListSkeleton />
      ) : data.items.length === 0 ? (
        <Empty className="max-w-[560px] border border-hairline">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconHomePlus />
            </EmptyMedia>
            <EmptyTitle>{showArchived ? "Nothing here" : "You don't host anything yet"}</EmptyTitle>
            <EmptyDescription>
              {showArchived ? "You have no archived listings." : "List your place and it shows up in search straight away."}
            </EmptyDescription>
          </EmptyHeader>
          {!showArchived && (
            <Button asChild size="lg">
              <Link href="/hosting/listings/new">Create your first listing</Link>
            </Button>
          )}
        </Empty>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} onArchive={() => setToArchive(listing)} />
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!toArchive} onOpenChange={(open) => !open && !archiving && setToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{toArchive?.title}&rdquo; will disappear from search and can&apos;t be booked any more. Guests who already booked it keep their trips.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={(e) => {
                e.preventDefault() // stay open until the request finishes
                archive()
              }}
            >
              {archiving ? "Archiving…" : "Archive listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ListingCard({ listing, onArchive }: { listing: HostListingSummary; onArchive: () => void }) {
  const archived = listing.archived_at !== null
  return (
    <article className="flex flex-col gap-3">
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-(image:--gradient-photo-placeholder)">
        {listing.photo_url && (
          <Image
            src={listingPhotoSrc(listing.photo_url)}
            alt=""
            fill
            sizes="(min-width: 1128px) 33vw, (min-width: 744px) 50vw, 100vw"
            unoptimized={!listing.photo_url.startsWith("https://images.unsplash.com/")}
            className={archived ? "object-cover grayscale" : "object-cover"}
          />
        )}
        <Badge className="absolute top-3 left-3 h-8 rounded-full bg-surface-hover/95 px-4 text-sm font-semibold text-ink">
          {archived ? "Archived" : listing.upcoming_bookings > 0 ? `${plural(listing.upcoming_bookings, "upcoming booking")}` : "No upcoming bookings"}
        </Badge>
      </div>
      <div>
        <h3 className="truncate text-base font-semibold text-ink">{listing.title}</h3>
        <p className="text-sm text-muted-foreground">{listing.location_label}</p>
        <p className="text-sm text-ink">
          <span className="font-semibold">{formatPaise(listing.nightly_price_minor)}</span> night
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!archived && (
          <>
            <Button asChild variant="outline" className="h-9 rounded-lg border-ink px-4 text-sm font-semibold">
              <Link href={`/hosting/listings/${listing.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild variant="ghost" className="h-9 rounded-lg px-4 text-sm font-semibold underline">
              <Link href={`/rooms/${listing.id}`}>View</Link>
            </Button>
            <Button variant="ghost" className="h-9 rounded-lg px-4 text-sm font-semibold text-error hover:text-error" onClick={onArchive}>
              Archive
            </Button>
          </>
        )}
      </div>
    </article>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading your listings">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-[3/2] w-full rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}
