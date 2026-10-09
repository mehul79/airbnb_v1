"use client"

import { useState, type ReactNode } from "react"
import { IconSearch, IconX } from "@tabler/icons-react"

import { WherePanel } from "@/components/search/where-panel"
import { WhenPanel, type WhenState } from "@/components/search/when-panel"
import { NO_GUESTS, WhoPanel, type Guests } from "@/components/search/who-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Step = "where" | "when" | "who"

// Phone version of the search (below 744px): a full-screen sheet with three stacked cards that
// open one at a time. It reuses the same panels as the desktop bar; the wrapper stretches them
// (they are fixed-width on desktop) to the screen width.
export function MobileSearch({
  open,
  onOpenChange,
  query,
  onQuery,
  when,
  onWhen,
  guests,
  onGuests,
  whenText,
  whoText,
  onSearch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQuery: (q: string) => void
  when: WhenState
  onWhen: (w: WhenState) => void
  guests: Guests
  onGuests: (g: Guests) => void
  whenText: string
  whoText: string
  onSearch: () => void
}) {
  const [step, setStep] = useState<Step>("where")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-hidden rounded-none bg-surface-soft p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Search stays</DialogTitle>
        <DialogDescription className="sr-only">Choose where, when and how many guests, then search.</DialogDescription>

        <div className="flex h-16 shrink-0 items-center px-4">
          <DialogClose asChild>
            <Button variant="outline" size="icon" className="size-8 rounded-full border-hairline bg-background" aria-label="Close search">
              <IconX className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6">
          <Card title="Where" summary={query.trim() || "Anywhere"} open={step === "where"} onOpen={() => setStep("where")} heading="Where to?">
            <div className="px-6 pb-2">
              <Input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search destinations"
                aria-label="Search destinations"
                autoComplete="off"
                className="h-12 rounded-xl border-hairline px-4 text-base"
              />
            </div>
            <div className="[&>div]:w-full [&>div]:pt-4">
              <WherePanel
                query={query}
                onPick={(value) => {
                  onQuery(value)
                  setStep("when")
                }}
              />
            </div>
          </Card>

          <Card title="When" summary={whenText === "Add dates" ? "Any week" : whenText} open={step === "when"} onOpen={() => setStep("when")} heading="When's your trip?">
            <div className="[&>div]:w-full [&>div]:px-3 [&>div]:pt-2">
              <WhenPanel value={when} onChange={onWhen} />
            </div>
          </Card>

          <Card title="Who" summary={whoText} open={step === "who"} onOpen={() => setStep("who")} heading="Who's coming?">
            <div className="[&>div]:w-full">
              <WhoPanel guests={guests} onChange={onGuests} />
            </div>
          </Card>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-hairline bg-background px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            className="font-semibold underline"
            onClick={() => {
              onQuery("")
              onWhen({ ...when, range: undefined })
              onGuests(NO_GUESTS)
            }}
          >
            Clear all
          </Button>
          <Button type="button" size="lg" className="h-12 gap-2 px-6 font-semibold" onClick={onSearch}>
            <IconSearch className="size-4" stroke={3} />
            Search
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Card({ title, summary, heading, open, onOpen, children }: { title: string; summary: string; heading: string; open: boolean; onOpen: () => void; children: ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl bg-background shadow-[0_2px_10px_rgba(0,0,0,0.12)]", open && "shadow-[0_6px_20px_rgba(0,0,0,0.16)]")}>
      {open ? (
        <>
          <h2 className="px-6 pt-6 pb-4 text-[22px] leading-7 font-semibold text-ink">{heading}</h2>
          {children}
        </>
      ) : (
        <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm" aria-expanded={false}>
          <span className="text-muted-foreground">{title}</span>
          <span className="truncate font-medium text-ink">{summary}</span>
        </button>
      )}
    </section>
  )
}
