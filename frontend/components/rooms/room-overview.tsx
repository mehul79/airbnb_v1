import { IconAward, IconBeach, IconDeviceLaptop, IconMountain, IconParking, IconPool, IconStarFilled, type Icon } from "@tabler/icons-react"

import { AmenitiesBlock } from "@/components/rooms/amenities-block"
import { ExpandableText } from "@/components/rooms/expandable-text"
import { UserAvatar } from "@/components/rooms/user-avatar"
import type { ListingDetail } from "@/lib/listings-api"
import { formatRating, plural, TYPE_LABEL } from "@/lib/labels"

const divider = "border-t border-hairline"

// Highlights come only from facts we hold (rating, amenities, category) - never invented
// claims like "Top 10% of homes".
function highlightsFor(l: ListingDetail): { icon: Icon; title: string; text: string }[] {
  const has = (slug: string) => l.amenities.some((a) => a.slug === slug)
  const out: { icon: Icon; title: string; text: string }[] = []
  if (l.rating !== null && l.rating >= 4.5 && l.review_count >= 2)
    out.push({ icon: IconAward, title: "Highly rated", text: `Guests rate this home ${formatRating(l.rating)} out of 5 across ${plural(l.review_count, "review")}.` })
  if (l.category === "amazing_views" || l.category === "lakefront" || l.category === "beachfront")
    out.push({ icon: IconMountain, title: "Unbeatable setting", text: `Listed under ${l.category.replace("_", " ")} in ${l.city}.` })
  if (has("pool")) out.push({ icon: IconPool, title: "Dive right in", text: "This home has a pool." })
  if (has("beach_access")) out.push({ icon: IconBeach, title: "Beach access", text: "The beach is a short walk away." })
  if (has("parking")) out.push({ icon: IconParking, title: "Park for free", text: "Free parking is available on the property." })
  if (has("workspace")) out.push({ icon: IconDeviceLaptop, title: "Dedicated workspace", text: "A room with a desk and good wifi." })
  return out.slice(0, 3)
}

// Left column above the calendar: summary, guest-favourite banner, host row, highlights,
// description and amenities. Everything here ships with the page (above the fold).
export function RoomOverview({ listing }: { listing: ListingDetail }) {
  const highlights = highlightsFor(listing)
  const bathrooms = Number.isInteger(listing.bathrooms) ? listing.bathrooms : listing.bathrooms.toFixed(1)
  const memberYear = new Date(listing.host.member_since * 1000).getFullYear()

  return (
    <div className="flex flex-col">
      <section className="pt-6 pb-6">
        <h2 className="text-[22px] leading-7 font-semibold text-ink">
          {TYPE_LABEL[listing.property_type] ?? "Stay"} in {listing.city}, {listing.country}
        </h2>
        <p className="text-base text-ink">
          {[plural(listing.max_guests, "guest"), plural(listing.bedrooms, "bedroom"), plural(listing.beds, "bed"), `${bathrooms} ${listing.bathrooms === 1 ? "bathroom" : "bathrooms"}`].join(" · ")}
        </p>
      </section>

      {listing.guest_favourite && listing.rating !== null && (
        <section className="mb-6 flex items-center rounded-xl border border-hairline px-6 py-5">
          <div className="flex-1">
            <p className="text-base font-semibold text-ink">Guest favourite</p>
            <p className="text-sm text-muted-foreground">One of the most loved homes on Airbnb, according to guests</p>
          </div>
          <div className="flex flex-col items-center px-6">
            <span className="text-[22px] leading-6 font-semibold text-ink">{formatRating(listing.rating)}</span>
            <span className="flex" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <IconStarFilled key={i} className="size-2.5 text-ink" />
              ))}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-hairline pl-6">
            <span className="text-[22px] leading-6 font-semibold text-ink">{listing.review_count}</span>
            <span className="text-xs text-ink">{listing.review_count === 1 ? "Review" : "Reviews"}</span>
          </div>
        </section>
      )}

      <section className={`${divider} flex items-center gap-4 py-6`}>
        <UserAvatar id={listing.host.id} name={listing.host.display_name} url={listing.host.avatar_url} className="size-10" />
        <div>
          <p className="text-base font-semibold text-ink">Hosted by {listing.host.display_name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {listing.host.superhost && (
              <>
                <IconAward className="size-4 text-ink" stroke={1.5} aria-hidden />
                <span className="font-medium text-ink">Superhost</span>
                <span aria-hidden>&middot;</span>
              </>
            )}
            On Airbnb since {memberYear}
          </p>
        </div>
      </section>

      {highlights.length > 0 && (
        <section className={`${divider} flex flex-col gap-6 py-8`}>
          {highlights.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-0.5 size-6 shrink-0 text-ink" stroke={1.5} />
              <div>
                <p className="text-base font-semibold text-ink">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className={`${divider} py-8`}>
        <ExpandableText text={listing.description} />
      </section>

      <section className={`${divider} py-8`}>
        <AmenitiesBlock amenities={listing.amenities} />
      </section>
    </div>
  )
}
