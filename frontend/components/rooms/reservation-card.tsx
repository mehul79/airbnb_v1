"use client"

import { IconChevronDown, IconFlag, IconMinus, IconPlus } from "@tabler/icons-react"
import { parseISO } from "date-fns"
import { toast } from "sonner"

import { useAppStore } from "@/components/providers/app-store-provider"
import { useReserve } from "@/components/rooms/use-reserve"
import type { Guests } from "@/components/search/who-panel"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPaise } from "@/lib/format"
import { plural } from "@/lib/labels"

const dateText = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US").format(parseISO(iso)) : "Add date")

export type Bookable = { id: string; nightly_price_minor: number; max_guests: number }

// Sticky card on the right of the listing (>= lg). Dates and guests live in the shared
// store, so picking dates in the calendar section updates this card and vice versa.
export function ReservationCard({ listing }: { listing: Bookable }) {
  const { stay, nights, quote, quoteError, quoteLoading, reserve } = useReserve(listing.id)

  const goToCalendar = () => document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth", block: "center" })

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-background p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
        <p className="text-[22px] leading-7 font-semibold text-ink">
          {formatPaise(listing.nightly_price_minor)} <span className="text-base font-normal text-ink">night</span>
        </p>

        <div className="mt-5 overflow-hidden rounded-lg border border-field">
          <div className="grid grid-cols-2">
            <button type="button" onClick={goToCalendar} className="flex flex-col items-start border-r border-b border-field p-3 text-left outline-none focus-visible:bg-surface-soft">
              <span className="text-[10px] leading-3 font-semibold tracking-wide text-ink uppercase">Check-in</span>
              <span className="text-sm text-ink">{dateText(stay.checkIn)}</span>
            </button>
            <button type="button" onClick={goToCalendar} className="flex flex-col items-start border-b border-field p-3 text-left outline-none focus-visible:bg-surface-soft">
              <span className="text-[10px] leading-3 font-semibold tracking-wide text-ink uppercase">Checkout</span>
              <span className="text-sm text-ink">{dateText(stay.checkOut)}</span>
            </button>
          </div>
          <GuestsPicker maxGuests={listing.max_guests} />
        </div>

        <Button size="lg" className="mt-4 h-12 w-full text-base font-semibold" onClick={reserve} disabled={!!quoteError}>
          {stay.checkIn && stay.checkOut ? "Reserve" : "Check availability"}
        </Button>
        <p className="mt-3 text-center text-sm text-ink">You won&apos;t be charged yet</p>

        {quoteError && (
          <p role="alert" className="mt-4 text-sm text-error">
            {quoteError}
          </p>
        )}
        {quoteLoading && (
          <div className="mt-6 flex flex-col gap-3" aria-busy>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
        {quote && (
          <dl className="mt-6 flex flex-col gap-3 text-base text-ink">
            <div className="flex justify-between">
              <dt className="underline">
                {formatPaise(quote.nightly_price_minor)} &times; {plural(nights, "night")}
              </dt>
              <dd>{formatPaise(quote.subtotal_minor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="underline">Cleaning fee</dt>
              <dd>{formatPaise(quote.cleaning_fee_minor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="underline">Service fee</dt>
              <dd>{formatPaise(quote.service_fee_minor)}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-4 font-semibold">
              <dt>Total</dt>
              <dd>{formatPaise(quote.total_minor)}</dd>
            </div>
          </dl>
        )}
      </div>

      <Button variant="ghost" className="mx-auto h-auto gap-2 text-sm text-muted-foreground underline" onClick={() => toast("Reporting: coming soon")}>
        <IconFlag className="size-4" />
        Report this listing
      </Button>
    </div>
  )
}

// Guests dropdown: adults + children are capped by the listing's capacity; infants aren't
// counted (matches the API's `guests`).
function GuestsPicker({ maxGuests }: { maxGuests: number }) {
  const guests = useAppStore((s) => s.stay.guests)
  const setStay = useAppStore((s) => s.setStay)
  const party = guests.adults + guests.children

  const change = (key: keyof Guests, delta: 1 | -1) => {
    const next = { ...guests, [key]: guests[key] + delta }
    if (key === "children" && delta === 1 && next.adults === 0) next.adults = 1
    setStay({ guests: next })
  }

  const rows: { key: keyof Guests; title: string; note: string; min: number; atMax: boolean }[] = [
    { key: "adults", title: "Adults", note: "Age 13+", min: 1, atMax: party >= maxGuests },
    { key: "children", title: "Children", note: "Ages 2–12", min: 0, atMax: party >= maxGuests },
    { key: "infants", title: "Infants", note: "Under 2", min: 0, atMax: guests.infants >= 5 },
  ]

  const summary = [plural(party, "guest"), guests.infants > 0 ? plural(guests.infants, "infant") : null].filter(Boolean).join(", ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between p-3 text-left outline-none focus-visible:bg-surface-soft">
          <span className="flex flex-col">
            <span className="text-[10px] leading-3 font-semibold tracking-wide text-ink uppercase">Guests</span>
            <span className="text-sm text-ink">{summary}</span>
          </span>
          <IconChevronDown className="size-5 text-ink" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl p-5">
        {rows.map(({ key, title, note, min, atMax }) => (
          <div key={key} className="flex items-center justify-between py-3">
            <div className="flex flex-col">
              <span className="text-base font-medium text-ink">{title}</span>
              <span className="text-sm text-muted-foreground">{note}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-full border-hairline disabled:opacity-30" aria-label={`Decrease ${title.toLowerCase()}`} disabled={guests[key] <= min} onClick={() => change(key, -1)}>
                <IconMinus className="size-4" />
              </Button>
              <span className="w-4 text-center text-base text-ink" aria-live="polite">
                {guests[key]}
              </span>
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-full border-hairline disabled:opacity-30" aria-label={`Increase ${title.toLowerCase()}`} disabled={atMax} onClick={() => change(key, 1)}>
                <IconPlus className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">This place has a maximum of {plural(maxGuests, "guest")}, not including infants.</p>
      </PopoverContent>
    </Popover>
  )
}
