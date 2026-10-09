"use client"

import { useEffect } from "react"

import { useAppStore } from "@/components/providers/app-store-provider"

const DAY = /^\d{4}-\d{2}-\d{2}$/

// Seeds the shared stay (dates + guests) from the page URL, so a link from search, or one
// someone shared, opens with the same dates already chosen. Missing params leave the stay alone.
export function StaySync({ checkIn, checkOut, guests }: { checkIn?: string; checkOut?: string; guests?: string }) {
  const setStay = useAppStore((s) => s.setStay)

  useEffect(() => {
    if (checkIn && checkOut && DAY.test(checkIn) && DAY.test(checkOut)) setStay({ checkIn, checkOut })
    const n = Number(guests)
    if (Number.isInteger(n) && n > 0) setStay({ guests: { adults: n, children: 0, infants: 0, pets: 0 } })
  }, [checkIn, checkOut, guests, setStay])

  return null
}
