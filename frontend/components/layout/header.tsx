"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { IconUserCircle } from "@tabler/icons-react"
import { toast } from "sonner"

import { useAppStore } from "@/components/providers/app-store-provider"
import { LogoWordmark } from "@/components/icons/logo"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { SearchBar } from "@/components/search/search-bar"
import { searchValuesFrom } from "@/lib/search-params"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiGet, apiPost } from "@/lib/api"
import { profileHref } from "@/lib/profile-links"
import type { SessionUser } from "@/lib/stores/app-store"
import { cn } from "@/lib/utils"

// Each tab has two real Airbnb icons: a plain one and the glowing "selected" one.
const TABS: { label: string; href: string; icon: string; comingSoon?: boolean }[] = [
  { label: "All", href: "/", icon: "globe" },
  { label: "Homes", href: "/", icon: "house" },
  { label: "Experiences", href: "#", icon: "balloon", comingSoon: true },
  { label: "Services", href: "#", icon: "bell", comingSoon: true },
]

const SCROLL_THRESHOLD = 24

// Independent of the nav: it sits in its own grid column, so hover padding growth on
// "Become a host" can't shift the centred tabs or search pill.
function HeaderActions({ hosting }: { hosting: boolean }) {
  const user = useAppStore((s) => s.user)
  const openAuthDialog = useAppStore((s) => s.openAuthDialog)
  const clearSession = useAppStore((s) => s.clearSession)

  async function signOut() {
    await apiPost("/auth/signout", {}).catch(() => null)
    clearSession()
    toast("Logged out")
  }

  return (
    <div className="flex items-center gap-1 justify-self-end">
      {/* The guest/hosting switch is only a change of view; the API enforces who owns what. */}
      {hosting || user ? (
        <Button
          asChild
          variant="ghost"
          className="hidden h-10 rounded-full px-4 text-[15px] font-medium transition-colors duration-150 hover:bg-foreground/5 lg:inline-flex"
        >
          <Link href={hosting ? "/" : profileHref("hosting")}>{hosting ? "Switch to travelling" : "Switch to hosting"}</Link>
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="hidden h-10 rounded-full px-4 text-[15px] font-medium transition-colors duration-150 hover:bg-foreground/5 lg:inline-flex"
          onClick={openAuthDialog}
        >
          Become a host
        </Button>
      )}
      <ThemeToggle />

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-lg"
              className="size-10 rounded-full bg-rausch text-base font-semibold text-white hover:bg-rausch-active"
              aria-label={`Account menu for ${user.display_name}`}
            >
              {user.display_name.trim().charAt(0).toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-semibold text-ink">{user.display_name}</span>
              <span className="truncate font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={profileHref("trips")}>Trips</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={profileHref("hosting")}>Hosting</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={profileHref("wishlists")}>Wishlists</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={profileHref("about")}>Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-10 rounded-full bg-foreground/5 text-ink hover:bg-foreground/10"
          aria-label="Log in or sign up"
          onClick={openAuthDialog}
        >
          <IconUserCircle className="size-6" />
        </Button>
      )}
    </div>
  )
}

// The search bar, prefilled from the URL so the place/dates/guests survive a refresh. It is
// re-created whenever the URL changes, which also resets any open editing state.
function SearchSlot({
  compact,
  onCompactClick,
  onSubmit,
}: {
  compact?: boolean
  onCompactClick?: () => void
  onSubmit?: () => void
}) {
  const params = useSearchParams()
  const query = params.toString()
  return (
    <SearchBar
      key={query}
      compact={compact}
      initial={searchValuesFrom(params)}
      baseParams={query}
      onCompactClick={onCompactClick}
      onSubmit={onSubmit}
    />
  )
}

// The header is `fixed` and a spacer holds its expanded height, so collapsing it on scroll
// never moves the page content (that shift was the scroll jitter).
// `landing`: the tall header (tabs + full search bar) that collapses on scroll.
// `compact`: the one-row header used on search, listing and account pages.
export function Header({ variant, mode = "guest" }: { variant: "landing" | "compact"; mode?: "guest" | "hosting" }) {
  const setUser = useAppStore((s) => s.setUser)
  const setFavorites = useAppStore((s) => s.setFavorites)
  const userId = useAppStore((s) => s.user?.id)
  const [scrolled, setScrolled] = useState(false)
  // In the compact variant the header rests in its compact form (with the search summary) and the user
  // expands it to edit the search, like Airbnb. Elsewhere it collapses on scroll.
  const onSearchPage = variant === "compact"
  const [expanded, setExpanded] = useState(false)
  const collapsed = onSearchPage ? !expanded : scrolled
  const headerRef = useRef<HTMLElement>(null)

  // Restore the signed-in user from the session cookie after a refresh.
  useEffect(() => {
    apiGet<SessionUser>("/me").then((user) => user && setUser(user))
  }, [setUser])

  // Fill in the hearts for whoever is signed in (after a refresh, login or signup).
  useEffect(() => {
    if (!userId) return
    apiGet<{ ids: string[] }>("/me/favorites/ids").then((res) => res && setFavorites(res.ids))
  }, [userId, setFavorites])

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > SCROLL_THRESHOLD
      setScrolled(past)
      if (past) setExpanded(false)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Click outside the header folds an expanded search back up.
  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [expanded])

  return (
    <>
      <div aria-hidden className={cn("shrink-0", onSearchPage ? "h-[97px]" : "h-[208px]")} />
      <header
        ref={headerRef}
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b border-hairline transition-colors duration-200",
          collapsed ? "bg-background" : "bg-surface-soft"
        )}
      >
        {/* Row 1: logo, tabs, actions. Collapses once scrolled. */}
        <div
          className={cn(
            "w-full overflow-hidden px-6 transition-[height,opacity] duration-200 lg:px-12",
            collapsed ? "h-0 opacity-0" : "h-24 opacity-100"
          )}
        >
          <div className="grid h-24 grid-cols-[1fr_auto_1fr] items-center">
            <Link href="/" aria-label="Airbnb home" className="justify-self-start">
              <LogoWordmark />
            </Link>

            <nav className="hidden items-center gap-12 lg:flex" aria-label="Product">
              {TABS.map((tab, i) => {
                const active = i === 0
                return (
                  <Link
                    key={tab.label}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => {
                      if (tab.comingSoon) {
                        e.preventDefault()
                        toast(`${tab.label}: coming soon`)
                      }
                    }}
                    className={cn(
                      "group relative flex h-9 items-center gap-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-ink",
                      active && "text-ink"
                    )}
                  >
                    {/* Scale the wrapper, not the two stacked images, so they pop together. */}
                    <span
                      className={cn(
                        "relative size-9 shrink-0 transition-transform duration-300 ease-in-out will-change-transform group-hover:scale-110",
                        // The house art is wider than the others and crowds its label.
                        tab.icon === "house" && "mr-2"
                      )}
                    >
                      <Image
                        src={`/icons/${tab.icon}.png`}
                        alt=""
                        width={240}
                        height={216}
                        unoptimized
                        className={cn(
                          "absolute top-1/2 left-1/2 w-[72px] max-w-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ease-in-out",
                          active && "opacity-0"
                        )}
                      />
                      <Image
                        src={`/icons/${tab.icon}-on.png`}
                        alt=""
                        width={180}
                        height={162}
                        unoptimized
                        className={cn(
                          "absolute top-1/2 left-1/2 w-[72px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-300 ease-in-out",
                          active && "opacity-100"
                        )}
                      />
                    </span>
                    {tab.label}
                    {active && <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-ink" />}
                  </Link>
                )
              })}
            </nav>

            <HeaderActions hosting={mode === "hosting"} />
          </div>
        </div>

        {/* Row 2: full search pill. */}
        <div
          className={cn(
            "grid w-full px-6 transition-[grid-template-rows,opacity,padding] duration-200 lg:px-12",
            collapsed ? "grid-rows-[0fr] pt-0 pb-0 opacity-0" : "grid-rows-[1fr] pt-3 pb-8 opacity-100"
          )}
        >
          {/* Clip only while collapsing, or the pill's outer shadow gets cut off. */}
          <div className={cn("min-h-0", collapsed ? "overflow-hidden" : "overflow-visible")}>
            <Suspense fallback={<SearchBar />}>
              <SearchSlot onSubmit={() => setExpanded(false)} />
            </Suspense>
          </div>
        </div>

        {/* Scrolled: single row. */}
        <div
          className={cn(
            "w-full overflow-hidden px-6 transition-[height,opacity] duration-200 lg:px-12",
            collapsed ? "h-24 opacity-100" : "h-0 opacity-0"
          )}
        >
          <div className="grid h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4">
            <Link href="/" aria-label="Airbnb home" className="hidden shrink-0 justify-self-start md:block">
              <LogoWordmark />
            </Link>
            <Suspense fallback={<SearchBar compact />}>
              <SearchSlot compact onCompactClick={onSearchPage ? () => setExpanded(true) : undefined} />
            </Suspense>
            <HeaderActions hosting={mode === "hosting"} />
          </div>
        </div>
      </header>
    </>
  )
}
