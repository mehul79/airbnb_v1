import { Suspense } from "react"

import { ConfirmationView } from "@/components/booking/confirmation-view"
import { Skeleton } from "@/components/ui/skeleton"

async function Confirmation({ params }: Pick<PageProps<"/bookings/[id]/confirmation">, "params">) {
  const { id } = await params
  return <ConfirmationView bookingId={id} />
}

export default function ConfirmationPage({ params }: PageProps<"/bookings/[id]/confirmation">) {
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-6 pt-10 pb-24 md:px-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Confirmation params={params} />
      </Suspense>
    </main>
  )
}
