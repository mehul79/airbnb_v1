import { Badge } from "@/components/ui/badge"

// The one badge slot on a photo. Guest favourite (a listing's own reviews) outranks Superhost
// (the host's reputation). Both are decided by the API; nothing here works them out.
export function CardBadge({ guestFavourite, superhost }: { guestFavourite: boolean; superhost: boolean }) {
  const text = guestFavourite ? "Guest favourite" : superhost ? "Superhost" : null
  if (!text) return null
  return (
    <Badge className="absolute top-3 left-3 h-8 rounded-full bg-surface-hover/95 px-3 text-[13px] font-semibold text-ink">{text}</Badge>
  )
}
