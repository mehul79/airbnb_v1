"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { IconSearch } from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { MobileSearch } from "@/components/search/mobile-search"
import { NO_WHEN, WhenPanel, type WhenState } from "@/components/search/when-panel"
import { NO_GUESTS, WhoPanel, type Guests } from "@/components/search/who-panel"
import { WherePanel } from "@/components/search/where-panel"
import { isoDay, withParams, type SearchValues } from "@/lib/search-params"
import { cn } from "@/lib/utils"

// Visual + interaction shell matching airbnb.co.in's search (DESIGN.md "Search Surface").
// Destination, dates and guests start from the URL (`initial`) and Search writes them back
// to /search?... (SEARCH-01), keeping any filters already chosen (`baseParams`).
//
// States: idle (white pill) -> hover (a section turns grey) -> editing (click: the bar turns
// grey, the chosen section becomes a raised white pill and a floating panel opens beneath).
// One white highlight and one panel shell slide between sections; contents cross-fade.
//
// `compact` is the condensed pill the header swaps to once the page is scrolled.

const SECTIONS = ["where", "when", "who"] as const
type Section = (typeof SECTIONS)[number]

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function whenSummary({ range }: WhenState) {
  if (!range?.from) return "Add dates"
  return range.to
    ? `${shortDate.format(range.from)} – ${shortDate.format(range.to)}`
    : shortDate.format(range.from)
}

function whoSummary(g: Guests) {
  const guests = g.adults + g.children
  if (guests + g.infants + g.pets === 0) return "Add guests"
  return [
    guests && plural(guests, "guest"),
    g.infants && plural(g.infants, "infant"),
    g.pets && plural(g.pets, "pet"),
  ]
    .filter(Boolean)
    .join(", ")
}

export function SearchBar({
  compact = false,
  initial,
  baseParams = "",
  onCompactClick,
  onSubmit,
}: {
  compact?: boolean
  initial?: SearchValues
  baseParams?: string
  onCompactClick?: () => void
  onSubmit?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // The phone version of the search is a full-screen sheet instead of the floating panels.
  const [mobileOpen, setMobileOpen] = useState(false)
  // Panels mount on first open only: they use today's date, which must not run during prerender.
  const [everOpened, setEverOpened] = useState(false)
  const [section, setSection] = useState<Section>("where")
  // False for two frames when opening from closed, so the white pill and panel appear in
  // place instead of sliding in from wherever they were last.
  const [settled, setSettled] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const [panelHeight, setPanelHeight] = useState(0)

  const [query, setQuery] = useState(initial?.location ?? "")
  const [when, setWhen] = useState<WhenState>(
    initial?.from ? { ...NO_WHEN, range: { from: initial.from, to: initial.to } } : NO_WHEN
  )
  const [guests, setGuests] = useState<Guests>(initial?.guests ? { ...NO_GUESTS, adults: initial.guests } : NO_GUESTS)

  const containerRef = useRef<HTMLDivElement>(null)
  const whereInput = useRef<HTMLInputElement>(null)
  const whenButton = useRef<HTMLButtonElement>(null)
  const whoButton = useRef<HTMLButtonElement>(null)
  const panels = useRef<Record<Section, HTMLDivElement | null>>({ where: null, when: null, who: null })

  function openSection(next: Section) {
    if (!open) {
      setSettled(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)))
    }
    setSection(next)
    setOpen(true)
    setEverOpened(true)
  }

  // Close on outside click, Escape (returning focus to the section) and page scroll.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      ;(section === "where" ? whereInput.current : section === "when" ? whenButton.current : whoButton.current)?.focus()
    }
    const onScroll = () => setOpen(false)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", onScroll)
    }
  }, [open, section])

  // The shell animates to the height of whichever panel is showing, including when its own
  // content changes size.
  useEffect(() => {
    const el = panels.current[section]
    if (!el) return
    const observer = new ResizeObserver(() => setPanelHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [section, everOpened])

  function search() {
    const { from, to } = when.range ?? {}
    const total = guests.adults + guests.children
    // Dates only count as a pair; a lone check-in is dropped rather than half-sent.
    const params = withParams(baseParams, {
      location: query.trim(),
      check_in: from && to ? isoDay(from) : null,
      check_out: from && to ? isoDay(to) : null,
      guests: total > 0 ? total : null,
    })
    setOpen(false)
    setMobileOpen(false)
    onSubmit?.()
    router.push(`/search?${params}`)
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onCompactClick ?? (() => window.scrollTo({ top: 0, behavior: "smooth" }))}
        className="flex h-[46px] w-full max-w-full min-w-0 items-center rounded-full border border-hairline bg-background pr-2 pl-2 text-left text-body-sm font-medium text-ink shadow-float transition-shadow hover:shadow-md md:w-auto"
      >
        <Image src="/icons/house.png" alt="" width={48} height={48} className="size-12 shrink-0" unoptimized />
        <span className="min-w-0 flex-1 truncate px-4 md:flex-none">{query.trim() ? `Homes in ${query.trim()}` : "Anywhere"}</span>
        <span className="hidden h-6 w-px bg-hairline md:block" />
        <span className="hidden px-4 md:block">{when.range?.from ? whenSummary(when) : "Anytime"}</span>
        <span className="hidden h-6 w-px bg-hairline md:block" />
        <span className="hidden px-4 md:block">{whoSummary(guests)}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rausch text-white">
          <IconSearch className="size-4" stroke={3} />
        </span>
      </button>
    )
  }

  const isActive = (s: Section) => open && section === s
  const sectionIndex = SECTIONS.indexOf(section)

  // The divider on the left edge of section i hides next to a hovered or selected section.
  const dividerHidden = (i: number) =>
    hovered === i || hovered === i - 1 || (open && (sectionIndex === i || sectionIndex === i - 1))

  const cell = (s: Section) =>
    cn(
      "relative z-10 flex h-full min-w-0 items-center rounded-full text-left outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
      !isActive(s) && (open ? "hover:bg-surface-pressed" : "hover:bg-surface-hover")
    )

  const divider = (i: number) => (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 left-0 h-8 w-px -translate-y-1/2 bg-hairline transition-opacity duration-150",
        dividerHidden(i) && "opacity-0"
      )}
    />
  )

  const hover = (i: number) => ({
    onMouseEnter: () => setHovered(i),
    onMouseLeave: () => setHovered(null),
  })

  const labelClass = "text-xs font-medium text-ink"
  const valueClass = (filled: boolean) =>
    cn("truncate text-body-sm", filled ? "text-ink" : "text-muted-foreground")

  const panelShell = cn(
    "absolute top-[calc(100%+12px)] left-0 z-50 h-(--panel-h) w-[400px] overflow-hidden rounded-[32px] bg-background shadow-[0_8px_40px_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.04)]",
    "transition-[left,width,height,opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none",
    "data-[section=when]:w-[850px] data-[section=who]:left-[calc(100%-400px)]",
    !open && "pointer-events-none invisible -translate-y-2 opacity-0",
    !settled && "transition-none"
  )
  const panelContent = (s: Section) =>
    cn(
      "absolute top-0 left-0 transition-[opacity,visibility] duration-200 motion-reduce:transition-none",
      section === s && open
        ? "visible opacity-100 delay-100"
        : "pointer-events-none invisible opacity-0",
      !settled && "transition-none"
    )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex h-14 w-full items-center gap-3 rounded-full border border-hairline bg-background px-5 text-left shadow-float md:hidden"
      >
        <IconSearch className="size-5 shrink-0 text-ink" stroke={2.5} />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">{query.trim() ? `Homes in ${query.trim()}` : "Where to?"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {[query.trim() ? null : "Anywhere", when.range?.from ? whenSummary(when) : "Any week", whoSummary(guests)].filter(Boolean).join(" \u00b7 ")}
          </span>
        </span>
      </button>
      <MobileSearch
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        query={query}
        onQuery={setQuery}
        when={when}
        onWhen={setWhen}
        guests={guests}
        onGuests={setGuests}
        whenText={whenSummary(when)}
        whoText={whoSummary(guests)}
        onSearch={search}
      />
    <div ref={containerRef} className="relative mx-auto hidden w-full max-w-[850px] md:block">
      <div
        className={cn(
          "relative grid h-[66px] grid-cols-[1.2fr_1fr_1fr] rounded-full border border-hairline shadow-[0_0_18px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.1)] transition-colors duration-200 motion-reduce:transition-none",
          open ? "bg-surface-hover" : "bg-background"
        )}
      >
        {/* The raised white pill behind the selected section; left + width animate together. */}
        <span
          aria-hidden
          data-section={section}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-0 w-[37.5%] rounded-full bg-background shadow-[0_2px_12px_rgba(0,0,0,0.14)] transition-[left,width,opacity] duration-250 ease-out motion-reduce:transition-none",
            "data-[section=when]:left-[37.5%] data-[section=when]:w-[31.25%] data-[section=who]:left-[68.75%] data-[section=who]:w-[31.25%]",
            open ? "opacity-100" : "opacity-0",
            !settled && "transition-none"
          )}
        />

        <label className={cell("where")} {...hover(0)}>
          <div className="flex w-full min-w-0 flex-col px-8">
            <span className={labelClass}>Where</span>
            <input
              ref={whereInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => !isActive("where") && openSection("where")}
              placeholder="Search destinations"
              autoComplete="off"
              aria-label="Where"
              className="w-full truncate bg-transparent text-body-sm text-ink outline-none placeholder:text-muted-foreground"
            />
          </div>
        </label>

        <div className={cell("when")} {...hover(1)}>
          {divider(1)}
          <button
            ref={whenButton}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isActive("when")}
            onClick={() => openSection("when")}
            className="flex h-full w-full min-w-0 flex-col justify-center rounded-full px-8 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            <span className={labelClass}>When</span>
            <span className={valueClass(whenSummary(when) !== "Add dates")}>{whenSummary(when)}</span>
          </button>
        </div>

        <div className={cn(cell("who"), "pr-2")} {...hover(2)}>
          {divider(2)}
          <button
            ref={whoButton}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isActive("who")}
            onClick={() => openSection("who")}
            className="flex h-full min-w-0 flex-1 flex-col justify-center rounded-full pl-8 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            <span className={labelClass}>Who</span>
            <span className={valueClass(whoSummary(guests) !== "Add guests")}>{whoSummary(guests)}</span>
          </button>
          {/* Circle at rest; grows into a "Search" pill while editing. */}
          <button
            type="button"
            aria-label="Search"
            onClick={search}
            className={cn(
              "flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rausch text-white transition-[width,background-color] duration-250 ease-out hover:bg-rausch-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
              open ? "w-[108px]" : "w-12"
            )}
          >
            <IconSearch className="size-5 shrink-0" stroke={3} />
            <span
              className={cn(
                "overflow-hidden text-body-sm font-semibold whitespace-nowrap transition-[max-width,opacity,margin] duration-250 ease-out motion-reduce:transition-none",
                open ? "ml-2 max-w-16 opacity-100" : "ml-0 max-w-0 opacity-0"
              )}
            >
              Search
            </span>
          </button>
        </div>
      </div>

      {/* One shell: its position, width and height animate; the three panels cross-fade inside. */}
      <div
        data-section={section}
        role="dialog"
        aria-label="Search options"
        className={panelShell}
        style={{ "--panel-h": `${panelHeight}px` } as React.CSSProperties}
      >
        {everOpened && (
          <>
            <div ref={(el) => void (panels.current.where = el)} className={panelContent("where")}>
              <WherePanel
                query={query}
                onPick={(name) => {
                  setQuery(name)
                  openSection("when")
                }}
              />
            </div>
            <div ref={(el) => void (panels.current.when = el)} className={panelContent("when")}>
              <WhenPanel value={when} onChange={setWhen} />
            </div>
            <div ref={(el) => void (panels.current.who = el)} className={panelContent("who")}>
              <WhoPanel guests={guests} onChange={setGuests} />
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}
