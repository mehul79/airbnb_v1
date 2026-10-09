import { redirect } from "next/navigation"

import { profileHref } from "@/lib/profile-links"

export default function WishlistsPage() {
  redirect(profileHref("wishlists"))
}
