import { IconBuildingSkyscraper, IconMapPin, IconMountain, IconSun } from "@tabler/icons-react"

// Static suggestions until the destinations API exists (SEARCH-01).
// `value` is what gets searched (the API matches city, region or country text).
const DESTINATIONS = [
  { value: "Goa", name: "Goa", note: "For sun-soaked beaches", icon: IconSun },
  { value: "Jaipur", name: "Jaipur, Rajasthan", note: "For its stunning architecture", icon: IconBuildingSkyscraper },
  { value: "Manali", name: "Manali, Himachal Pradesh", note: "For a trip to the mountains", icon: IconMountain },
  { value: "Munnar", name: "Munnar, Kerala", note: "For tea gardens and cool hills", icon: IconMountain },
  { value: "Alleppey", name: "Alleppey, Kerala", note: "For houseboats on the backwaters", icon: IconMapPin },
  { value: "Kochi", name: "Kochi, Kerala", note: "For its heritage and food", icon: IconMapPin },
  { value: "Kerala", name: "Kerala", note: "Beaches, hills and backwaters", icon: IconSun },
]

export function WherePanel({ query, onPick }: { query: string; onPick: (name: string) => void }) {
  const q = query.trim().toLowerCase()
  const matches = q ? DESTINATIONS.filter((d) => d.name.toLowerCase().includes(q)) : DESTINATIONS

  return (
    <div className="w-[400px] pt-8 pb-4">
      <h3 className="px-8 pb-2 text-xs font-semibold text-ink">{q ? "Destinations" : "Suggested destinations"}</h3>
      {matches.length === 0 ? (
        <p className="px-8 py-6 text-sm text-muted-foreground">No destinations match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto px-4">
          {matches.map(({ value, name, note, icon: Icon }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => onPick(value)}
                className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-soft">
                  <Icon className="size-6 text-ink" stroke={1.5} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-ink">{name}</span>
                  <span className="text-sm text-muted-foreground">{note}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
