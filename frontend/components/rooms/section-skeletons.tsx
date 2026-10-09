import { Skeleton } from "@/components/ui/skeleton"

// Each skeleton is sized like the loaded section (min-h) so the page below it doesn't jump.

export function CalendarSkeleton() {
  return (
    <div className="flex min-h-[494px] flex-col gap-4 py-8" aria-busy aria-label="Loading calendar">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-4 h-[300px] w-full max-w-[620px] rounded-xl" />
    </div>
  )
}

// Height depends on how many reviews will show (2 per row), so it is computed from the count
// the page already knows; an inline min-height because the value is dynamic.
export function ReviewsSkeleton({ count = 4, favourite = false }: { count?: number; favourite?: boolean }) {
  const shown = Math.max(1, Math.min(count, 6))
  const rows = Math.ceil(shown / 2)
  const minHeight = 96 + (favourite ? 210 : 28) + 40 + (count > 0 ? 130 + 40 : 0) + rows * 132 + (rows - 1) * 40 + (count > 6 ? 88 : 0)
  return (
    <div className="flex flex-col gap-8 py-12" style={{ minHeight }} aria-busy aria-label="Loading reviews">
      <Skeleton className="mx-auto h-8 w-48" />
      <div className="grid gap-x-24 gap-y-10 md:grid-cols-2">
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function LocationSkeleton() {
  return (
    <div className="flex min-h-[693px] flex-col gap-4 py-12" aria-busy aria-label="Loading map">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-4 h-[480px] w-full rounded-xl" />
    </div>
  )
}

export function HostSkeleton() {
  return (
    <div className="flex min-h-[377px] flex-col gap-6 py-12" aria-busy aria-label="Loading host">
      <Skeleton className="h-7 w-40" />
      <div className="flex gap-12">
        <Skeleton className="h-[200px] w-full max-w-[380px] rounded-3xl" />
        <Skeleton className="hidden h-[200px] flex-1 rounded-xl md:block" />
      </div>
    </div>
  )
}

export function PoliciesSkeleton() {
  return (
    <div className="flex min-h-[335px] flex-col gap-6 py-12" aria-busy aria-label="Loading things to know">
      <Skeleton className="h-7 w-44" />
      <div className="grid gap-8 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  )
}

export function NearbySkeleton() {
  return (
    <div className="flex min-h-[460px] flex-col gap-6 py-12" aria-busy aria-label="Loading nearby stays">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={i > 1 ? "hidden flex-col gap-3 lg:flex" : "flex flex-col gap-3"}>
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
