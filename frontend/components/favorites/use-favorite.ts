"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { useAppStore } from "@/components/providers/app-store-provider"
import { apiDelete, apiPut } from "@/lib/api"

// FAV-01: the heart for one listing. The store's favoriteIds is the single source for every
// heart on the page (cards, listing page, wishlist), so they always agree. Toggling updates
// the heart at once and rolls it back, with a message, if the API refuses.
export function useFavorite(listingId: string) {
  const user = useAppStore((s) => s.user)
  const saved = useAppStore((s) => s.favoriteIds.has(listingId))
  const setFavorite = useAppStore((s) => s.setFavorite)
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)

  const toggle = useCallback(async () => {
    if (!user) return openAuthDialog()
    const next = !saved
    setFavorite(listingId, next)
    try {
      await (next ? apiPut(`/me/favorites/${listingId}`) : apiDelete(`/me/favorites/${listingId}`))
      toast(next ? "Saved to your wishlist" : "Removed from your wishlist")
    } catch {
      setFavorite(listingId, !next)
      toast("Couldn't update your wishlist. Please try again.")
    }
  }, [user, saved, listingId, setFavorite, openAuthDialog])

  return { saved, toggle }
}
