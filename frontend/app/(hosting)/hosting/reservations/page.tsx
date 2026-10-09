import { redirect } from "next/navigation"

import { profileHref } from "@/lib/profile-links"

export default function ReservationsPage() {
  redirect(profileHref("hosting", "reservations"))
}
