// Money is stored/passed as integer paise (CLAUDE.md "Domain invariants"). Format for display only.
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}
