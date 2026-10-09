import { createStore } from "zustand/vanilla"

import { NO_GUESTS, type Guests } from "@/components/search/who-panel"

// Client-side UI/session state only. Search lives in the URL; business data lives in FastAPI/SQLite.

export type SessionUser = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  age: number | null
  created_at: number
}

// The stay being planned on a listing page. The reservation card, calendar section and the
// mobile booking bar all read and write this, so they stay in sync. Initial values come from
// the page URL (?check_in&check_out&guests).
export type Stay = { checkIn: string | null; checkOut: string | null; guests: Guests }

export type AppState = {
  stay: Stay
  user: SessionUser | null
  favoriteIds: Set<string>
  authDialogOpen: boolean
}

export type AppActions = {
  setStay: (patch: Partial<Stay>) => void
  setUser: (user: SessionUser | null) => void
  setFavorites: (ids: Iterable<string>) => void
  setFavorite: (listingId: string, saved: boolean) => void
  openAuthDialog: () => void
  closeAuthDialog: () => void
  // Signout or account switch: drop everything private to the previous identity.
  clearSession: () => void
}

export type AppStore = AppState & AppActions

export const defaultAppState: AppState = {
  stay: { checkIn: null, checkOut: null, guests: { ...NO_GUESTS, adults: 1 } },
  user: null,
  favoriteIds: new Set(),
  authDialogOpen: false,
}

export const createAppStore = (initState: Partial<AppState> = {}) =>
  createStore<AppStore>()((set) => ({
    ...defaultAppState,
    ...initState,
    setStay: (patch) => set((state) => ({ stay: { ...state.stay, ...patch } })),
    setUser: (user) => set({ user }),
    setFavorites: (ids) => set({ favoriteIds: new Set(ids) }),
    setFavorite: (listingId, saved) =>
      set((state) => {
        const favoriteIds = new Set(state.favoriteIds)
        if (saved) favoriteIds.add(listingId)
        else favoriteIds.delete(listingId)
        return { favoriteIds }
      }),
    openAuthDialog: () => set({ authDialogOpen: true }),
    closeAuthDialog: () => set({ authDialogOpen: false }),
    clearSession: () => set({ user: null, favoriteIds: new Set(), authDialogOpen: false }),
  }))
