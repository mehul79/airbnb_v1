"use client"

import { IconStarFilled } from "@tabler/icons-react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/rooms/user-avatar"
import { Button } from "@/components/ui/button"
import type { Host } from "@/lib/listings-api"
import { formatRating } from "@/lib/labels"

// "Meet your host". The reviews and rating are the host's, over all of their homes, and the
// Superhost label comes from the API.
export default function HostSection({ host }: { host: Host }) {
  const memberYear = new Date(host.member_since * 1000).getFullYear()

  return (
    <div className="flex flex-col gap-6 py-12">
      <h2 className="text-[22px] leading-7 font-semibold text-ink">Meet your host</h2>
      <div className="flex flex-col gap-10 md:flex-row md:gap-16">
        <div className="flex w-full max-w-[380px] items-center justify-between gap-6 rounded-3xl bg-background p-8 shadow-[0_6px_20px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col items-center gap-2 text-center">
            <UserAvatar id={host.id} name={host.display_name} url={host.avatar_url} className="size-24 text-3xl" />
            <p className="text-[26px] leading-8 font-bold text-ink">{host.display_name}</p>
            <p className="text-sm font-medium text-ink">{host.superhost ? "Superhost" : "Host"}</p>
          </div>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="sr-only">Reviews</dt>
              <dd className="text-[22px] leading-6 font-bold text-ink">{host.review_count}</dd>
              <dd className="text-xs text-ink">{host.review_count === 1 ? "Review" : "Reviews"}</dd>
            </div>
            {host.rating !== null && (
              <div className="border-t border-hairline pt-3">
                <dt className="sr-only">Rating</dt>
                <dd className="flex items-center gap-1 text-[22px] leading-6 font-bold text-ink">
                  {formatRating(host.rating)}
                  <IconStarFilled className="size-3.5" />
                </dd>
                <dd className="text-xs text-ink">Rating</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-col items-start gap-4">
          <h3 className="text-base font-semibold text-ink">Host details</h3>
          <p className="text-base text-ink">
            On Airbnb since {memberYear}
          </p>
          <Button variant="secondary" size="lg" className="rounded-lg bg-surface-hover px-6 font-semibold text-ink hover:bg-surface-pressed" onClick={() => toast("Messaging: coming soon")}>
            Message host
          </Button>
        </div>
      </div>
    </div>
  )
}
