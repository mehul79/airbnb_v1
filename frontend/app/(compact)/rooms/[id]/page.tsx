import { Suspense } from "react"

import { RoomPage } from "@/components/rooms/room-page"
import { Skeleton } from "@/components/ui/skeleton"

// Reserves the title + gallery space while the listing loads.
function RoomSkeleton() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1120px] px-6 md:px-10" aria-busy aria-label="Loading listing">
      <Skeleton className="mt-6 mb-4 h-8 w-2/3" />
      <Skeleton className="aspect-[4/3] w-full rounded-xl md:aspect-[1120/504]" />
    </div>
  )
}

export default function RoomRoute({ params, searchParams }: PageProps<"/rooms/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<RoomSkeleton />}>
        <RoomPage params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
