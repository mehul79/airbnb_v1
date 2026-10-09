import { Skeleton } from "@/components/ui/skeleton"

// Neutral loading state with the same grid as the results, so nothing jumps when they arrive.
export function ResultsSkeleton() {
  return (
    <div className="min-h-dvh px-6 pt-8 pb-16 lg:px-12" aria-busy aria-label="Loading results">
      <Skeleton className="mb-6 h-7 w-64" />
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[500px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
