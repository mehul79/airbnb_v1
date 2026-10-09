import { IconMinus, IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export type Guests = { adults: number; children: number; infants: number; pets: number }
export const NO_GUESTS: Guests = { adults: 0, children: 0, infants: 0, pets: 0 }

// Airbnb's limits: 16 guests (adults + children), 5 infants, 5 pets.
const ROWS: { key: keyof Guests; title: string; note: string }[] = [
  { key: "adults", title: "Adults", note: "Ages 13 or above" },
  { key: "children", title: "Children", note: "Ages 2–12" },
  { key: "infants", title: "Infants", note: "Under 2" },
  { key: "pets", title: "Pets", note: "Bringing a service animal?" },
]

export function WhoPanel({ guests, onChange }: { guests: Guests; onChange: (g: Guests) => void }) {
  const guestCount = guests.adults + guests.children

  function step(key: keyof Guests, delta: 1 | -1) {
    const next = { ...guests, [key]: guests[key] + delta }
    // Children, infants or pets need an adult, so adding one also adds the first adult.
    if (delta === 1 && key !== "adults" && next.adults === 0) next.adults = 1
    // Don't remove the last adult while others remain.
    if (key === "adults" && next.adults === 0 && (next.children || next.infants || next.pets)) return
    onChange(next)
  }

  const atMax = (key: keyof Guests) =>
    key === "adults" || key === "children" ? guestCount >= 16 : guests[key] >= 5

  return (
    <div className="w-[400px] px-8 py-4">
      {ROWS.map(({ key, title, note }, i) => (
        <div
          key={key}
          className={`flex items-center justify-between py-4 ${i > 0 ? "border-t border-hairline" : ""}`}
        >
          <div className="flex flex-col">
            <span className="text-base font-medium text-ink">{title}</span>
            <span className="text-sm text-muted-foreground">{note}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-hairline disabled:opacity-30"
              aria-label={`Decrease ${title.toLowerCase()}`}
              disabled={guests[key] === 0}
              onClick={() => step(key, -1)}
            >
              <IconMinus className="size-4" />
            </Button>
            <span className="w-5 text-center text-base text-ink" aria-live="polite">
              {guests[key]}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-hairline disabled:opacity-30"
              aria-label={`Increase ${title.toLowerCase()}`}
              disabled={atMax(key)}
              onClick={() => step(key, 1)}
            >
              <IconPlus className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
