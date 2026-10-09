"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useStore } from "zustand"

import { createAppStore, type AppState, type AppStore } from "@/lib/stores/app-store"

// One store per browser session, created inside React. A module-level store would be
// shared between users' requests on the server.
const AppStoreContext = createContext<ReturnType<typeof createAppStore> | null>(null)

export function AppStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: Partial<AppState>
}) {
  const [store] = useState(() => createAppStore(initialState))
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>
}

// Always pass a selector so components re-render only for the slice they read.
export function useAppStore<T>(selector: (store: AppStore) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider")
  return useStore(store, selector)
}
