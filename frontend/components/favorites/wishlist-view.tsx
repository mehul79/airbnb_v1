"use client"

import { useState } from "react"
import Link from "next/link"
import { IconHeart } from "@tabler/icons-react"

import { useSessionUser } from "@/components/auth/use-session"
import { useAppStore } from "@/components/providers/app-store-provider"
import { SectionError } from "@/components/rooms/lazy-section"
import { SearchResultCard } from "@/components/search/search-result-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { ListingPage } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

const PAGE_SIZE = 12
const grid = "grid grid-cols-1 gap-x-6 gap-y-10 min-[500px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"

// FAV-01: the signed-in user's saved homes. Hearts here are the same ones as everywhere
// (shared store), so un-saving one here keeps the card until the page is reopened, which
// lets you undo a slip.
export function WishlistView() {
  const { user, checked } = useSessionUser()
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)

  if (!checked) return <WishlistSkeleton />

  if (!user) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHeart />
          </EmptyMedia>
          <EmptyTitle>Log in to see your wishlist</EmptyTitle>
          <EmptyDescription>Homes you save with the heart show up here.</EmptyDescription>
        </EmptyHeader>
        <Button variant="auth" size="lg" onClick={openAuthDialog}>
          Log in or sign up
        </Button>
      </Empty>
    )
  }

  // key = user id: switching accounts remounts it, so nothing carries over
  return <WishlistList key={user.id} />
}

function WishlistList() {
  const [pages, setPages] = useState(1)
  const first = useQuery<ListingPage>(`/me/favorites?page=1&page_size=${PAGE_SIZE}`, { fresh: true })

  if (first.error) return <SectionError label="your wishlist" onRetry={first.retry} />
  if (first.loading || !first.data) return <WishlistSkeleton />

  if (first.data.total === 0) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHeart />
          </EmptyMedia>
          <EmptyTitle>No saved homes yet</EmptyTitle>
          <EmptyDescription>As you search, tap the heart on a home to save it here.</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline" size="lg">
          <Link href="/search">Start exploring</Link>
        </Button>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {first.data.total} saved {first.data.total === 1 ? "home" : "homes"}
      </p>
      <ul className={grid}>
        {Array.from({ length: pages }, (_, i) => (
          <WishlistPage key={i} page={i + 1} />
        ))}
      </ul>
      {pages < first.data.total_pages && (
        <Button variant="outline" size="lg" className="w-fit rounded-lg border-ink px-6 font-semibold" onClick={() => setPages((p) => p + 1)}>
          Show more
        </Button>
      )}
    </div>
  )
}

function WishlistPage({ page }: { page: number }) {
  const { data, error, retry } = useQuery<ListingPage>(`/me/favorites?page=${page}&page_size=${PAGE_SIZE}`, { fresh: true })

  if (error)
    return (
      <li className="col-span-full">
        <SectionError label="more saved homes" onRetry={retry} />
      </li>
    )
  if (!data)
    return Array.from({ length: 4 }, (_, i) => (
      <li key={i}>
        <CardSkeleton />
      </li>
    ))
  return data.items.map((listing) => (
    <li key={listing.id}>
      <SearchResultCard listing={listing} />
    </li>
  ))
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

function WishlistSkeleton() {
  return (
    <div className={grid} aria-busy aria-label="Loading wishlist">
      {Array.from({ length: 5 }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
