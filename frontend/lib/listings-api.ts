// Read-side calls to FastAPI from Server Components (PRD SEARCH-01..03). Server-only: it
// uses API_BASE_URL directly, since there is no browser here to go through the /api relay.
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000"

export type ListingSummary = {
  id: string
  title: string
  city: string
  region: string
  location_label: string
  latitude: number | null
  longitude: number | null
  property_type: string
  category: string
  max_guests: number
  nightly_price_minor: number
  currency: string
  photo_url: string | null
  photo_alt: string | null
  rating: number | null
  review_count: number
  guest_favourite: boolean
  host_superhost: boolean
}

export type ListingPage = {
  items: ListingSummary[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

// GET /listings/map: every match with coordinates (up to a cap), not one page.
export type MapPage = { items: ListingSummary[]; total: number; truncated: boolean }

export type Amenity = { slug: string; name: string; icon_key: string }

export type Photo = { url: string; alt_text: string; source: string; position: number }
export type Host = {
  id: string
  display_name: string
  avatar_url: string | null
  member_since: number
  // Over every review of the host's listings, not just the one being viewed.
  rating: number | null
  review_count: number
  superhost: boolean
}

export type ListingDetail = {
  id: string
  title: string
  description: string
  city: string
  region: string
  country: string
  location_label: string
  latitude: number | null
  longitude: number | null
  property_type: string
  category: string
  max_guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  nightly_price_minor: number
  cleaning_fee_minor: number
  currency: string
  photos: Photo[]
  amenities: Amenity[]
  host: Host
  rating: number | null
  review_count: number
  guest_favourite: boolean
  rating_breakdown: Record<string, number> // "5".. "1" -> number of reviews
}

export type Review = {
  id: string
  rating: number
  body: string
  created_at: number
  author: { display_name: string; avatar_url: string | null }
}
export type ReviewPage = { items: Review[]; page: number; page_size: number; total: number; total_pages: number }
// A booking as GET /me/bookings returns it. Title, place and photo are copies taken at
// booking time, so they stay readable after the host edits or archives the listing.
export type Booking = {
  id: string
  reference: string
  listing_id: string
  status: string
  phase: "upcoming" | "past"
  check_in: string
  check_out: string
  guests: number
  nights: number
  nightly_price_minor: number
  subtotal_minor: number
  cleaning_fee_minor: number
  service_fee_minor: number
  total_minor: number
  currency: string
  listing_title: string
  location: string
  cover_photo_url: string
  created_at: number
}
export type BookingPage = { items: Booking[]; page: number; page_size: number; total: number; total_pages: number }
export type Occupied = { check_in: string; check_out: string }
export type Quote = {
  listing_id: string
  nights: number
  nightly_price_minor: number
  subtotal_minor: number
  cleaning_fee_minor: number
  service_fee_minor: number
  total_minor: number
  currency: string
  quote_fingerprint: string
}

// Carries the API's own message (e.g. "Check-in can't be in the past") to the error state.
export class ListingsApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message)
  }
}

async function get<T>(path: string, params?: URLSearchParams): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}${params ? `?${params}` : ""}`, { cache: "no-store" })
  } catch {
    throw new ListingsApiError("We couldn't reach the server.")
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ListingsApiError(body?.error?.message ?? "Something went wrong loading listings.", res.status)
  }
  return res.json() as Promise<T>
}

export const fetchListings = (params: URLSearchParams) => get<ListingPage>("/listings", params)
// null = not found (unknown or archived), so the page can render a 404 instead of an error.
export async function fetchListingDetail(id: string): Promise<ListingDetail | null> {
  try {
    return await get<ListingDetail>(`/listings/${encodeURIComponent(id)}`)
  } catch (e) {
    if (e instanceof ListingsApiError && e.status === 404) return null
    throw e
  }
}
export const fetchAmenities = () => get<Amenity[]>("/amenities")

