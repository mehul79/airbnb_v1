"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { IconHeart } from "@tabler/icons-react"
import { toast } from "sonner"

import { useSessionUser } from "@/components/auth/use-session"
import { useAppStore } from "@/components/providers/app-store-provider"
import { SectionError } from "@/components/rooms/lazy-section"
import { WishlistCard } from "@/components/favorites/wishlist-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { apiDelete, apiPut } from "@/lib/api"
import type { ListingPage, ListingSummary } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

const PAGE_SIZE = 12
const FADE_MS = 300
// One column on a phone; from 744px as many 260px-minimum columns as fit (2 on a tablet,
// 3 beside the profile rail on a desktop), growing to fill the width.
const grid = "grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"

// FAV-01: the signed-in user's saved homes. The heart here is the same saved-set as everywhere
// (shared store). Removing one fades the card out, updates the count and offers Undo, which
// simply saves it again through the same API.
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
  const [leaving, setLeaving] = useState<Set<string>>(new Set()) // fading out
  const [gone, setGone] = useState<Set<string>>(new Set()) // removed this visit
  const setFavorite = useAppStore((s) => s.setFavorite)
  const first = useQuery<ListingPage>(`/me/favorites?page=1&page_size=${PAGE_SIZE}`, { fresh: true })
  // Ids with a request in flight, so a double click cannot send two.
  const busy = useRef(new Set<string>())

  const mark = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, on: boolean) =>
    set((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  async function remove(listing: ListingSummary) {
    const { id } = listing
    if (busy.current.has(id)) return
    busy.current.add(id)
    setFavorite(id, false)
    mark(setLeaving, id, true)
    try {
      // The card finishes fading while the request runs; it is dropped once both are done.
      await Promise.all([apiDelete(`/me/favorites/${id}`), new Promise((r) => setTimeout(r, FADE_MS))])
      mark(setGone, id, true)
      toast("Removed from wishlist", { duration: 6000, action: { label: "Undo", onClick: () => undo(id) } })
    } catch {
      setFavorite(id, true) // the API refused: put the heart back
      toast("Couldn't remove it. Please try again.")
    } finally {
      mark(setLeaving, id, false)
      busy.current.delete(id)
    }
  }

  async function undo(id: string) {
    if (busy.current.has(id)) return
    busy.current.add(id)
    setFavorite(id, true)
    mark(setGone, id, false)
    try {
      await apiPut(`/me/favorites/${id}`)
    } catch {
      setFavorite(id, false)
      mark(setGone, id, true)
      toast("Couldn't restore it. Please try again.")
    } finally {
      busy.current.delete(id)
    }
  }

  if (first.error) return <SectionError label="your wishlist" onRetry={first.retry} />
  if (first.loading || !first.data) return <WishlistSkeleton />

  const remaining = first.data.total - gone.size

  if (remaining <= 0) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHeart />
          </EmptyMedia>
          <EmptyTitle>No saved homes yet</EmptyTitle>
          <EmptyDescription>As you browse, tap the heart on a home to save it here.</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Start exploring</Link>
        </Button>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {remaining} saved {remaining === 1 ? "home" : "homes"}
      </p>
      <ul className={grid}>
        {Array.from({ length: pages }, (_, i) => (
          <WishlistPage key={i} page={i + 1} leaving={leaving} gone={gone} onRemove={remove} />
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

function WishlistPage({
  page,
  leaving,
  gone,
  onRemove,
}: {
  page: number
  leaving: Set<string>
  gone: Set<string>
  onRemove: (listing: ListingSummary) => void
}) {
  const { data, error, retry } = useQuery<ListingPage>(`/me/favorites?page=${page}&page_size=${PAGE_SIZE}`, { fresh: true })

  if (error)
    return (
      <li className="col-span-full">
        <SectionError label="more saved homes" onRetry={retry} />
      </li>
    )
  if (!data)
    return Array.from({ length: 3 }, (_, i) => (
      <li key={i}>
        <CardSkeleton />
      </li>
    ))
  return data.items
    .filter((listing) => !gone.has(listing.id))
    .map((listing) => (
      <li key={listing.id}>
        <WishlistCard listing={listing} leaving={leaving.has(listing.id)} onRemove={onRemove} />
      </li>
    ))
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

function WishlistSkeleton() {
  return (
    <div className={grid} aria-busy aria-label="Loading wishlist">
      {Array.from({ length: 3 }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
