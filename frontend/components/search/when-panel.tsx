import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type WhenState = {
  range: DateRange | undefined
  tolerance: string // days either side: "0" | "1" | "2" | "3" | "7" | "14"
}
export const NO_WHEN: WhenState = { range: undefined, tolerance: "0" }

const TOLERANCES = [
  ["0", "Exact dates"],
  ["1", "± 1 day"],
  ["2", "± 2 days"],
  ["3", "± 3 days"],
  ["7", "± 7 days"],
  ["14", "± 14 days"],
]

const chip =
  "h-10 rounded-full border border-hairline bg-transparent px-4 text-sm font-medium text-ink hover:bg-surface-soft data-[state=on]:border-ink data-[state=on]:bg-surface-soft"

export function WhenPanel({ value, onChange }: { value: WhenState; onChange: (v: WhenState) => void }) {
  return (
    <div className="flex w-[850px] flex-col items-center gap-6 px-8 pt-8 pb-8">
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={value.range}
        onSelect={(range) => onChange({ ...value, range })}
        disabled={{ before: new Date() }}
        className="p-0 [--cell-size:--spacing(11)]"
      />
      <ToggleGroup
        type="single"
        value={value.tolerance}
        onValueChange={(tolerance) => tolerance && onChange({ ...value, tolerance })}
        className="flex-wrap justify-center"
        aria-label="Date flexibility"
      >
        {TOLERANCES.map(([v, label]) => (
          <ToggleGroupItem key={v} value={v} className={chip}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
