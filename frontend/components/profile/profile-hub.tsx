"use client"

import Link from "next/link"
import { IconHeart, IconHome2, IconLuggage, IconUserCircle, type Icon } from "@tabler/icons-react"

import { RequireUser } from "@/components/auth/require-user"
import { DashboardView } from "@/components/hosting/dashboard-view"
import { ReservationsView } from "@/components/hosting/reservations-view"
import { WishlistView } from "@/components/favorites/wishlist-view"
import { AboutMe } from "@/components/profile/about-me"
import { TripsView } from "@/components/trips/trips-view"
import { HOSTING_VIEWS, profileHref, type HostingView, type ProfileTab } from "@/lib/profile-links"
import { cn } from "@/lib/utils"

const NAV: { tab: ProfileTab; label: string; icon: Icon }[] = [
  { tab: "about", label: "About me", icon: IconUserCircle },
  { tab: "trips", label: "Trips", icon: IconLuggage },
  { tab: "wishlists", label: "Wishlists", icon: IconHeart },
  { tab: "hosting", label: "Hosting", icon: IconHome2 },
]

const HOSTING_LABEL: Record<HostingView, string> = { listings: "Listings", reservations: "Reservations" }

// The profile page. Like Airbnb's, it has a rail on the left (a row of pills on a phone) and
// the chosen section on the right. Trips, wishlists and hosting used to be pages of their own;
// they are sections here now, each reachable by URL (?tab=trips).
export function ProfileHub({ tab, view }: { tab: ProfileTab; view: HostingView }) {
  return (
    <RequireUser title="Log in to see your profile" description="Your trips, wishlists and listings are all here once you're signed in.">
      {(user) => (
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-x-20">
          <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <h1 className="text-[32px] leading-10 font-semibold text-ink">Profile</h1>

            <nav aria-label="Profile sections" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {NAV.map(({ tab: id, label, icon: ItemIcon }) => {
                const active = id === tab
                return (
                  <Link
                    key={id}
                    href={profileHref(id)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-3 rounded-full border px-4 text-sm font-medium whitespace-nowrap text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink lg:h-14 lg:rounded-xl lg:border-transparent lg:px-4 lg:text-base",
                      active ? "border-ink bg-surface-soft font-semibold lg:border-transparent" : "border-hairline hover:bg-surface-soft lg:border-transparent"
                    )}
                  >
                    <ItemIcon className="size-5 shrink-0 lg:size-6" stroke={active ? 2 : 1.5} />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          <section aria-label={NAV.find((n) => n.tab === tab)?.label} className="min-w-0">
            {tab === "about" && (
              <>
                <SectionTitle>About me</SectionTitle>
                <AboutMe user={user} />
              </>
            )}

            {tab === "trips" && (
              <>
                <SectionTitle>Trips</SectionTitle>
                <TripsView />
              </>
            )}

            {tab === "wishlists" && (
              <>
                <SectionTitle>Wishlists</SectionTitle>
                <WishlistView />
              </>
            )}

            {tab === "hosting" && (
              <>
                <SectionTitle>Hosting</SectionTitle>
                <nav aria-label="Hosting sections" className="mb-8 flex gap-8 border-b border-hairline">
                  {HOSTING_VIEWS.map((id) => (
                    <Link
                      key={id}
                      href={profileHref("hosting", id)}
                      scroll={false}
                      aria-current={id === view ? "page" : undefined}
                      className={cn(
                        "-mb-px flex h-12 items-center border-b-2 text-base font-medium outline-none transition-colors focus-visible:text-ink",
                        id === view ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink"
                      )}
                    >
                      {HOSTING_LABEL[id]}
                    </Link>
                  ))}
                </nav>
                {view === "listings" ? <DashboardView /> : <ReservationsView />}
              </>
            )}
          </section>
        </div>
      )}
    </RequireUser>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-8 text-[32px] leading-10 font-semibold text-ink">{children}</h2>
}
