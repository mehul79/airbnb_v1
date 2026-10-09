// Trips, wishlists and hosting all live inside the profile page now. These build the URLs
// (the tab is a query param, so each one can be linked, shared and reached with Back).
export type ProfileTab = "about" | "trips" | "wishlists" | "hosting"
export type HostingView = "listings" | "reservations"

export const PROFILE_TABS: ProfileTab[] = ["about", "trips", "wishlists", "hosting"]
export const HOSTING_VIEWS: HostingView[] = ["listings", "reservations"]

export function profileHref(tab: ProfileTab = "about", view?: HostingView) {
  const params = new URLSearchParams()
  if (tab !== "about") params.set("tab", tab)
  if (tab === "hosting" && view && view !== "listings") params.set("view", view)
  const query = params.toString()
  return `/users/profile${query ? `?${query}` : ""}`
}

export const parseTab = (value: string | undefined): ProfileTab =>
  PROFILE_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : "about"

export const parseView = (value: string | undefined): HostingView =>
  HOSTING_VIEWS.includes(value as HostingView) ? (value as HostingView) : "listings"
