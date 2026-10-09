"use client"

import Link from "next/link"
import { IconArchive, IconFileOff } from "@tabler/icons-react"

import { RequireUser } from "@/components/auth/require-user"
import { ListingForm } from "@/components/hosting/listing-form"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { HostListing } from "@/lib/host-types"
import { profileHref } from "@/lib/profile-links"
import { useQuery } from "@/lib/use-query"

// HOST-02: loads the owner's listing for editing. The API answers 404 for a missing listing
// and for someone else's alike, so both land on the same "can't find it" state.
export function EditListingView({ id }: { id: string }) {
  return (
    <RequireUser title="Log in to edit your listing" description="Only the host can edit a listing.">
      {(user) => <Loader key={user.id} id={id} />}
    </RequireUser>
  )
}

function Loader({ id }: { id: string }) {
  const { data, error, loading, retry } = useQuery<HostListing>(`/host/listings/${id}`, { fresh: true })

  if (loading) return <Skeleton className="h-96 w-full max-w-[760px] rounded-xl" aria-busy aria-label="Loading listing" />

  if (error || !data) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFileOff />
          </EmptyMedia>
          <EmptyTitle>We couldn&apos;t open that listing</EmptyTitle>
          <EmptyDescription>It may not exist, or it may belong to another account.</EmptyDescription>
        </EmptyHeader>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={retry}>
            Try again
          </Button>
          <Button asChild size="lg">
            <Link href={profileHref("hosting")}>Your listings</Link>
          </Button>
        </div>
      </Empty>
    )
  }

  if (data.archived_at !== null) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconArchive />
          </EmptyMedia>
          <EmptyTitle>This listing is archived</EmptyTitle>
          <EmptyDescription>Archived listings can&apos;t be edited. Create a new listing to host this place again.</EmptyDescription>
        </EmptyHeader>
        <Button asChild size="lg">
          <Link href="/hosting/listings/new">Create listing</Link>
        </Button>
      </Empty>
    )
  }

  return <ListingForm initial={data} />
}
