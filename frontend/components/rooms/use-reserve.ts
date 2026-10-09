"use client"

import { useRouter } from "next/navigation"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { toast } from "sonner"

import { useAppStore } from "@/components/providers/app-store-provider"
import { useQuote } from "@/lib/use-quote"

// Everything the reservation card and the mobile booking bar share: the stay in the store,
// its quote, and what "Reserve" does.
export function useReserve(listingId: string) {
  const router = useRouter()
  const stay = useAppStore((s) => s.stay)
  const partyCount = Math.max(1, stay.guests.adults + stay.guests.children)
  const nights = stay.checkIn && stay.checkOut ? differenceInCalendarDays(parseISO(stay.checkOut), parseISO(stay.checkIn)) : 0
  const { quote, error, loading } = useQuote(listingId, stay.checkIn, stay.checkOut, partyCount)

  function reserve() {
    if (!stay.checkIn || !stay.checkOut) {
      toast("Choose your dates first")
      document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    const params = new URLSearchParams({ check_in: stay.checkIn, check_out: stay.checkOut, guests: String(partyCount) })
    router.push(`/book/${listingId}?${params}`)
  }

  return { stay, partyCount, nights, quote, quoteError: error, quoteLoading: loading, reserve }
}
