"use client"

import { useRouter } from "next/navigation"
import { IconAlertCircle } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

// Error state for the results list: the API's own message plus a retry (re-runs the fetch).
export function ResultsError({ message }: { message: string }) {
  const router = useRouter()
  return (
    <Empty className="mx-6 my-16 border border-hairline lg:mx-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconAlertCircle />
        </EmptyMedia>
        <EmptyTitle>We couldn&apos;t load results</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="lg" onClick={() => router.refresh()}>
        Try again
      </Button>
    </Empty>
  )
}
