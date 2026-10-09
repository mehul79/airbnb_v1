"use client"

import { useReserve } from "@/components/rooms/use-reserve"
import type { Bookable } from "@/components/rooms/reservation-card"
import { Button } from "@/components/ui/button"
import { formatPaise } from "@/lib/format"
import { plural } from "@/lib/labels"

// Below lg the sticky card is replaced by this bar pinned to the bottom of the screen.
export function BookingBar({ listing }: { listing: Bookable }) {
  const { stay, nights, quote, quoteError, reserve } = useReserve(listing.id)
  const dated = stay.checkIn && stay.checkOut

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-hairline bg-background px-6 py-3 lg:hidden">
      <div className="flex min-w-0 flex-col">
        <p className="text-base font-semibold text-ink">
          {quote ? formatPaise(quote.total_minor) : formatPaise(listing.nightly_price_minor)}{" "}
          <span className="font-normal">{quote ? "total" : "night"}</span>
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {quoteError ?? (dated ? plural(nights, "night") : "Add dates for exact pricing")}
        </p>
      </div>
      <Button size="lg" className="h-12 shrink-0 px-8 text-base font-semibold" onClick={reserve} disabled={!!quoteError}>
        {dated ? "Reserve" : "Check availability"}
      </Button>
    </div>
  )
}
