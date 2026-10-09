"use client"

import { addDays, differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from "date-fns"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"

import { useAppStore } from "@/components/providers/app-store-provider"
import { SectionError } from "@/components/rooms/lazy-section"
import { CalendarSkeleton } from "@/components/rooms/section-skeletons"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import type { Occupied } from "@/lib/listings-api"
import { plural } from "@/lib/labels"
import { isoDay } from "@/lib/search-params"
import { useQuery } from "@/lib/use-query"

const longDate = (d: Date) => format(d, "d MMM yyyy")

// Availability calendar bound to the shared stay. A stay occupies [check_in, check_out), so
// a guest may check in on the previous guest's checkout day; only nights inside a booked
// range are disabled (and shown struck through by the calendar).
export default function CalendarSection({ listingId, city }: { listingId: string; city: string }) {
  const { data, error, loading, retry } = useQuery<{ occupied: Occupied[] }>(`/listings/${listingId}/availability`)
  const stay = useAppStore((s) => s.stay)
  const setStay = useAppStore((s) => s.setStay)

  if (error) return <SectionError label="availability" onRetry={retry} />
  if (loading || !data) return <CalendarSkeleton />

  const booked = data.occupied.map((r) => ({ from: parseISO(r.check_in), to: addDays(parseISO(r.check_out), -1) }))
  const isBooked = (day: Date) => booked.some((r) => day >= r.from && day <= r.to)
  const today = startOfDay(new Date())

  const from = stay.checkIn ? parseISO(stay.checkIn) : undefined
  const to = stay.checkOut ? parseISO(stay.checkOut) : undefined
  const nights = from && to ? differenceInCalendarDays(to, from) : 0

  // A range is only valid if none of its nights is booked.
  const blocked = (a: Date, b: Date) => {
    for (let d = a; d < b; d = addDays(d, 1)) if (isBooked(d)) return true
    return false
  }

  function onSelect(range: DateRange | undefined, picked: Date) {
    if (!range?.from) return setStay({ checkIn: null, checkOut: null })
    // First click, or a click that would give zero nights: start a new range from the click.
    if (!range.to || range.from.getTime() === range.to.getTime()) {
      return setStay({ checkIn: isoDay(picked), checkOut: null })
    }
    if (blocked(range.from, range.to)) {
      toast("Those dates include nights that are already booked")
      return setStay({ checkIn: isoDay(picked), checkOut: null })
    }
    setStay({ checkIn: isoDay(range.from), checkOut: isoDay(range.to) })
  }

  return (
    <div className="flex flex-col gap-1 py-8">
      <h2 className="text-[22px] leading-7 font-semibold text-ink">
        {nights > 0 ? `${plural(nights, "night")} in ${city}` : "Select check-in date"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {from && to ? `${longDate(from)} – ${longDate(to)}` : "Add your travel dates for exact pricing"}
      </p>

      <div className="mt-6 -ml-2">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={from ? { from, to } : undefined}
          onSelect={onSelect}
          defaultMonth={from ?? today}
          disabled={(day) => isBefore(day, today) || isBooked(day)}
          className="p-0 [--cell-size:--spacing(10)]"
        />
      </div>

      <div className="mt-2 flex justify-end">
        <Button variant="link" className="h-auto p-0 text-sm font-semibold text-ink underline" onClick={() => setStay({ checkIn: null, checkOut: null })} disabled={!from}>
          Clear dates
        </Button>
      </div>
    </div>
  )
}
