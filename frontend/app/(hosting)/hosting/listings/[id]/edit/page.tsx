import { Suspense } from "react"

import { EditListingView } from "@/components/hosting/edit-listing-view"
import { Skeleton } from "@/components/ui/skeleton"

async function Edit({ params }: Pick<PageProps<"/hosting/listings/[id]/edit">, "params">) {
  const { id } = await params
  return <EditListingView id={id} />
}

export default function EditListingPage({ params }: PageProps<"/hosting/listings/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-6 pt-10 pb-24 lg:px-12">
      <h1 className="text-[32px] leading-10 font-semibold text-ink">Edit listing</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-[760px] rounded-xl" />}>
        <Edit params={params} />
      </Suspense>
    </main>
  )
}
