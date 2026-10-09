"use client"

import { useEffect, useState } from "react"

import { useAppStore } from "@/components/providers/app-store-provider"
import { apiGet } from "@/lib/api"
import type { SessionUser } from "@/lib/stores/app-store"

// The signed-in user for pages that need one. It asks /me itself, so a refresh straight on
// a private page works before the header has restored the session; `checked` tells the
// page whether to show a loading state or the "log in" prompt.
export function useSessionUser() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    apiGet<SessionUser>("/me").then((me) => {
      if (me) setUser(me)
      setChecked(true)
    })
  }, [setUser])

  return { user, checked: checked || !!user }
}
