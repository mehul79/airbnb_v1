import { Suspense } from "react"

import { ProfileHub } from "@/components/profile/profile-hub"
import { Skeleton } from "@/components/ui/skeleton"
import { parseTab, parseView } from "@/lib/profile-links"

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// ?tab=about|trips|wishlists|hosting (and ?view=reservations inside hosting). Read inside
// <Suspense> because searchParams is a Promise in Next 16.
async function Profile({ searchParams }: Pick<PageProps<"/users/profile">, "searchParams">) {
  const query = await searchParams
  return <ProfileHub tab={parseTab(first(query.tab))} view={parseView(first(query.view))} />
}

export default function ProfilePage({ searchParams }: PageProps<"/users/profile">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-1 flex-col px-6 pt-10 pb-24 md:px-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" aria-busy aria-label="Loading profile" />}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
