"use client"

import { useEffect, useState } from "react"

import { ApiError, apiPost } from "@/lib/api"
import type { Quote } from "@/lib/listings-api"

// POST /listings/{id}/quote for the chosen dates + guests. Results are cached per request
// key, so flipping dates back and forth doesn't refetch. The price always comes from the
// API (CLAUDE.md: the frontend only formats numbers it is given).
const cache = new Map<string, Quote>()
// In-flight requests, so the reservation card and the mobile bar share one call.
const pending = new Map<string, Promise<Quote>>()

type Result = { key: string; quote?: Quote; error?: string }

export function useQuote(listingId: string, checkIn: string | null, checkOut: string | null, guests: number) {
  const key = checkIn && checkOut ? `${listingId}|${checkIn}|${checkOut}|${guests}` : null
  const [result, setResult] = useState<Result>()

  useEffect(() => {
    if (!key || cache.has(key)) return
    let cancelled = false
    let request = pending.get(key)
    if (!request) {
      request = apiPost<Quote>(`/listings/${listingId}/quote`, { check_in: checkIn, check_out: checkOut, guests })
      pending.set(key, request)
    }
    request
      .then((quote) => {
        cache.set(key, quote)
        if (!cancelled) setResult({ key, quote })
      })
      .catch((e) => {
        pending.delete(key)
        if (!cancelled) setResult({ key, error: e instanceof ApiError ? e.message : "Couldn't get a price. Try again." })
      })
    return () => {
      cancelled = true
    }
  }, [key, listingId, checkIn, checkOut, guests])

  if (!key) return { quote: undefined, error: undefined, loading: false }
  const cached = cache.get(key)
  if (cached) return { quote: cached, error: undefined, loading: false }
  const mine = result?.key === key ? result : undefined
  return { quote: mine?.quote, error: mine?.error, loading: !mine }
}
