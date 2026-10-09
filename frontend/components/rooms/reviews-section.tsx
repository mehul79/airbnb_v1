"use client"

import { useState } from "react"
import { IconStarFilled } from "@tabler/icons-react"

import { SectionError } from "@/components/rooms/lazy-section"
import { ReviewsSkeleton } from "@/components/rooms/section-skeletons"
import { UserAvatar } from "@/components/rooms/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RatingBreakdown } from "@/components/rooms/rating-breakdown"
import { formatRating, plural } from "@/lib/labels"
import type { Review, ReviewPage } from "@/lib/listings-api"
import { useQuery } from "@/lib/use-query"

const PAGE_SIZE = 6
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })

type Props = { listingId: string; rating: number | null; reviewCount: number; favourite: boolean; breakdown: Record<string, number> }

export default function ReviewsSection({ listingId, rating, reviewCount, favourite, breakdown }: Props) {
  const [pages, setPages] = useState(1)
  const first = useQuery<ReviewPage>(reviewCount > 0 ? `/listings/${listingId}/reviews?page=1&page_size=${PAGE_SIZE}` : null)
  const totalPages = first.data?.total_pages ?? 1

  return (
    <div className="flex flex-col gap-10 py-12">
      <RatingSummary rating={rating} reviewCount={reviewCount} favourite={favourite} />
      <RatingBreakdown breakdown={breakdown} total={reviewCount} />

      {reviewCount === 0 ? null : first.error ? (
        <SectionError label="reviews" onRetry={first.retry} />
      ) : first.loading ? (
        <ReviewsSkeleton count={reviewCount} />
      ) : (
        <>
          <ul className="grid gap-x-24 gap-y-10 md:grid-cols-2">
            {Array.from({ length: pages }, (_, i) => (
              <ReviewsPage key={i} listingId={listingId} page={i + 1} />
            ))}
          </ul>
          {pages < totalPages && (
            <Button variant="outline" size="lg" className="w-fit rounded-lg border-ink px-6 font-semibold" onClick={() => setPages((p) => p + 1)}>
              Show more reviews
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function RatingSummary({ rating, reviewCount, favourite }: { rating: number | null; reviewCount: number; favourite: boolean }) {
  if (rating === null) {
    return <h2 className="text-[22px] leading-7 font-semibold text-ink">No reviews (yet)</h2>
  }
  if (!favourite) {
    return (
      <h2 className="flex items-center gap-2 text-[22px] leading-7 font-semibold text-ink">
        <IconStarFilled className="size-5" />
        {formatRating(rating)} &middot; {plural(reviewCount, "review")}
      </h2>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-[64px] leading-[72px] font-bold text-ink">{formatRating(rating)}</span>
      <h2 className="text-[22px] leading-7 font-semibold text-ink">Guest favourite</h2>
      <p className="max-w-md text-base text-muted-foreground">
        One of the most loved homes on Airbnb, based on {plural(reviewCount, "review")} and ratings from guests.
      </p>
    </div>
  )
}

// One page of review cards, rendered into the parent's grid. Each page is its own query,
// so "Show more reviews" only fetches the next page and earlier pages stay cached.
function ReviewsPage({ listingId, page }: { listingId: string; page: number }) {
  const { data, error, retry } = useQuery<ReviewPage>(`/listings/${listingId}/reviews?page=${page}&page_size=${PAGE_SIZE}`)

  if (error)
    return (
      <li className="md:col-span-2">
        <SectionError label="more reviews" onRetry={retry} />
      </li>
    )
  if (!data)
    return Array.from({ length: PAGE_SIZE }, (_, i) => (
      <li key={i} className="flex flex-col gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </li>
    ))
  return data.items.map((review) => <ReviewCard key={review.id} review={review} />)
}

function ReviewCard({ review }: { review: Review }) {
  const [open, setOpen] = useState(false)
  const long = review.body.length > 180

  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <UserAvatar id={review.author.display_name} name={review.author.display_name} url={review.author.avatar_url} className="size-10" />
        <p className="text-base font-semibold text-ink">{review.author.display_name}</p>
      </div>
      <p className="flex items-center gap-1 text-sm text-ink">
        <span className="flex" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <IconStarFilled key={i} className={i < review.rating ? "size-2.5 text-ink" : "size-2.5 text-hairline"} />
          ))}
        </span>
        &middot; {monthYear.format(new Date(review.created_at * 1000))}
      </p>
      <p className={long && !open ? "line-clamp-3 text-base text-ink" : "text-base text-ink"}>{review.body}</p>
      {long && (
        <button type="button" className="w-fit text-base font-semibold text-ink underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </li>
  )
}
