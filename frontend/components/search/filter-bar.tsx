"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconAdjustmentsHorizontal } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { amenityIcon } from "@/lib/amenity-icons"
import type { Amenity } from "@/lib/listings-api"
import { withParams } from "@/lib/search-params"
import { cn } from "@/lib/utils"

const PROPERTY_TYPES = ["apartment", "house", "villa", "cottage", "cabin", "guesthouse", "farmhouse", "houseboat"]
const CATEGORIES: [string, string][] = [
  ["beachfront", "Beachfront"], ["pools", "Amazing pools"], ["cabins", "Cabins"], ["amazing_views", "Amazing views"],
  ["countryside", "Countryside"], ["lakefront", "Lakefront"], ["design", "Design"], ["mansions", "Mansions"],
  ["tiny_homes", "Tiny homes"], ["trending", "Trending"],
]

const label = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ")
const option =
  "h-10 rounded-full border border-hairline bg-transparent px-4 text-sm font-medium text-ink hover:bg-surface-soft data-[state=on]:border-ink data-[state=on]:bg-surface-soft"

const rupees = (paise: string | null) => (paise ? String(Math.round(Number(paise) / 100)) : "")

// The strip under the header: a Filters button (type, category, price, amenities) plus
// one-tap amenity chips (SEARCH-02). Every change rewrites the URL and resets to page 1.
export function FilterBar({ amenities, params }: { amenities: Amenity[]; params: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const current = new URLSearchParams(params)
  const selected = current.getAll("amenity")

  const activeCount =
    (current.get("category") ? 1 : 0) +
    (current.get("property_type") ? 1 : 0) +
    (current.get("min_price_minor") || current.get("max_price_minor") ? 1 : 0) +
    selected.length

  const go = (patch: Parameters<typeof withParams>[1]) => router.push(`/search?${withParams(params, patch)}`)

  return (
    <div className="flex items-center gap-3 border-b border-hairline px-6 py-3 lg:px-12">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-9 shrink-0 gap-2 rounded-full border-hairline px-4 text-sm font-medium">
            <IconAdjustmentsHorizontal className="size-4" />
            Filters
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-ink text-xs text-background">
                {activeCount}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[640px]">
          <FiltersForm amenities={amenities} current={current} onApply={(patch) => {
              go(patch)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <span aria-hidden className="h-6 w-px shrink-0 bg-hairline" />

      <ToggleGroup
        type="multiple"
        value={selected}
        onValueChange={(slugs) => go({ amenity: slugs })}
        spacing={3}
        aria-label="Amenities"
        className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {amenities.map((a) => {
          const Icon = amenityIcon(a.icon_key)
          return (
            <ToggleGroupItem key={a.slug} value={a.slug} className={cn(option, "h-9 gap-2 px-3 font-normal data-[state=on]:font-medium")}>
              <Icon className="size-4" stroke={1.5} />
              {a.name}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}

function FiltersForm({
  amenities,
  current,
  onApply,
}: {
  amenities: Amenity[]
  current: URLSearchParams
  onApply: (patch: Record<string, string | string[] | null>) => void
}) {
  // Edits stay local until "Show results", so half-typed prices don't refetch.
  const [propertyType, setPropertyType] = useState(current.get("property_type") ?? "")
  const [category, setCategory] = useState(current.get("category") ?? "")
  const [min, setMin] = useState(rupees(current.get("min_price_minor")))
  const [max, setMax] = useState(rupees(current.get("max_price_minor")))
  const [chosen, setChosen] = useState<string[]>(current.getAll("amenity"))

  const priceError = min && max && Number(min) > Number(max) ? "Minimum price is above the maximum." : undefined
  const toPaise = (v: string) => (v ? String(Math.round(Number(v) * 100)) : null)

  const clear = () => {
    setPropertyType("")
    setCategory("")
    setMin("")
    setMax("")
    setChosen([])
  }

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (priceError) return
        onApply({
          property_type: propertyType || null,
          category: category || null,
          min_price_minor: toPaise(min),
          max_price_minor: toPaise(max),
          amenity: chosen,
        })
      }}
    >
      <DialogHeader className="border-b border-hairline px-6 py-4 text-center">
        <DialogTitle className="text-base font-semibold">Filters</DialogTitle>
        <DialogDescription className="sr-only">Narrow results by type, price and amenities.</DialogDescription>
      </DialogHeader>

      <FieldGroup className="min-h-0 gap-8 overflow-y-auto px-6 py-6">
        <FieldSet>
          <FieldLegend>Type of place</FieldLegend>
          <ToggleGroup type="single" value={propertyType} onValueChange={setPropertyType} spacing={2} className="flex-wrap" aria-label="Type of place">
            {PROPERTY_TYPES.map((t) => (
              <ToggleGroupItem key={t} value={t} className={option}>
                {label(t)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Category</FieldLegend>
          <ToggleGroup type="single" value={category} onValueChange={setCategory} spacing={2} className="flex-wrap" aria-label="Category">
            {CATEGORIES.map(([v, text]) => (
              <ToggleGroupItem key={v} value={v} className={option}>
                {text}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Price range</FieldLegend>
          <FieldDescription>Nightly price in ₹, before fees.</FieldDescription>
          <div className="flex items-center gap-4">
            <Field data-invalid={!!priceError}>
              <FieldLabel htmlFor="min-price">Minimum</FieldLabel>
              <Input id="min-price" type="number" inputMode="numeric" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="₹ 0" className="h-12 rounded-lg" aria-invalid={!!priceError} />
            </Field>
            <span aria-hidden className="pt-6 text-muted-foreground">–</span>
            <Field data-invalid={!!priceError}>
              <FieldLabel htmlFor="max-price">Maximum</FieldLabel>
              <Input id="max-price" type="number" inputMode="numeric" min={0} value={max} onChange={(e) => setMax(e.target.value)} placeholder="₹ Any" className="h-12 rounded-lg" aria-invalid={!!priceError} />
            </Field>
          </div>
          <FieldError>{priceError}</FieldError>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Amenities</FieldLegend>
          <FieldDescription>Homes must have every amenity you pick.</FieldDescription>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {amenities.map((a) => (
              <Field key={a.slug} orientation="horizontal">
                <Checkbox
                  id={`amenity-${a.slug}`}
                  checked={chosen.includes(a.slug)}
                  onCheckedChange={(on) => setChosen((prev) => (on ? [...prev, a.slug] : prev.filter((s) => s !== a.slug)))}
                />
                <FieldLabel htmlFor={`amenity-${a.slug}`} className="font-normal">
                  {a.name}
                </FieldLabel>
              </Field>
            ))}
          </div>
        </FieldSet>
      </FieldGroup>

      <DialogFooter className="flex-row items-center justify-between border-t border-hairline px-6 py-4 sm:justify-between">
        <Button type="button" variant="ghost" className="font-semibold underline" onClick={clear}>
          Clear all
        </Button>
        <Button type="submit" size="lg" disabled={!!priceError} className="bg-ink px-6 text-background hover:bg-ink/90 active:bg-ink">
          Show results
        </Button>
      </DialogFooter>
    </form>
  )
}
