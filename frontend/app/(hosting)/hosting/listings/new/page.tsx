import { NewListingView } from "@/components/hosting/new-listing-view"

export default function NewListingPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-6 pt-10 pb-24 lg:px-12">
      <h1 className="text-[32px] leading-10 font-semibold text-ink">Create a listing</h1>
      <NewListingView />
    </main>
  )
}
