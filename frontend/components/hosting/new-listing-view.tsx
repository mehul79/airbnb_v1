"use client"

import { RequireUser } from "@/components/auth/require-user"
import { ListingForm } from "@/components/hosting/listing-form"

// HOST-01: any signed-in account can create a listing; creating one is what makes it a host.
export function NewListingView() {
  return (
    <RequireUser title="Log in to create a listing" description="Any account can host.">
      {(user) => <ListingForm key={user.id} />}
    </RequireUser>
  )
}
