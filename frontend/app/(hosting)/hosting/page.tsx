import { redirect } from "next/navigation"

import { profileHref } from "@/lib/profile-links"

export default function HostingPage() {
  redirect(profileHref("hosting"))
}
