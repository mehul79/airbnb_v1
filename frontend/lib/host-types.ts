// Shapes returned by the /host endpoints (private to the signed-in host).

export type HostPhoto = { url: string; alt_text: string; source: string; position: number }

// What the edit form loads and saves.
export type HostListing = {
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
  photos: HostPhoto[]
  amenities: string[] // slugs
  archived_at: number | null
  created_at: number
}

// One row of the dashboard.
export type HostListingSummary = {
  id: string
  title: string
  location_label: string
  nightly_price_minor: number
  photo_url: string | null
  archived_at: number | null
  upcoming_bookings: number
}

export type HostBooking = {
  id: string
  reference: string
  listing_id: string
  listing_title: string
  guest_name: string
  guests: number
  check_in: string
  check_out: string
  nights: number
  total_minor: number
  currency: string
  phase: "upcoming" | "past"
  created_at: number
}

export type HostBookingPage = { items: HostBooking[]; page: number; page_size: number; total: number; total_pages: number }
