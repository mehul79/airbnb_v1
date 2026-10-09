import { formatPaise } from "@/lib/format"
import { plural } from "@/lib/labels"

type Lines = {
  nights: number
  nightly_price_minor: number
  subtotal_minor: number
  cleaning_fee_minor: number
  service_fee_minor: number
  total_minor: number
}

// Itemised price, used by checkout and the confirmation. Every number comes from the API
// (a quote or a saved booking); this only formats them.
export function PriceBreakdown({ lines, heading = "Price details" }: { lines: Lines; heading?: string }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-4">
      <h3 className="text-[22px] leading-7 font-semibold text-ink">{heading}</h3>
      <dl className="flex flex-col gap-3 text-base text-ink">
        <div className="flex justify-between gap-4">
          <dt>
            {formatPaise(lines.nightly_price_minor)} &times; {plural(lines.nights, "night")}
          </dt>
          <dd>{formatPaise(lines.subtotal_minor)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Cleaning fee</dt>
          <dd>{formatPaise(lines.cleaning_fee_minor)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Service fee</dt>
          <dd>{formatPaise(lines.service_fee_minor)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-hairline pt-4 font-semibold">
          <dt>Total (INR)</dt>
          <dd>{formatPaise(lines.total_minor)}</dd>
        </div>
      </dl>
    </section>
  )
}
