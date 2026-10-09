"use client"

import type { ReactNode } from "react"

import { useSessionUser } from "@/components/auth/use-session"
import { useAppStore } from "@/components/providers/app-store-provider"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { SessionUser } from "@/lib/stores/app-store"

// Page guard: a skeleton while we find out who is signed in, a login prompt if nobody is,
// otherwise the page. Real protection is the API (it answers 401), this is only the UI side.
export function RequireUser({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: (user: SessionUser) => ReactNode
}) {
  const { user, checked } = useSessionUser()
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)

  if (!checked) return <Skeleton className="h-64 w-full max-w-[720px] rounded-xl" aria-busy aria-label="Loading" />

  if (!user) {
    return (
      <Empty className="max-w-[560px] border border-hairline">
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <Button variant="auth" size="lg" onClick={openAuthDialog}>
          Log in or sign up
        </Button>
      </Empty>
    )
  }
  return <>{children(user)}</>
}
