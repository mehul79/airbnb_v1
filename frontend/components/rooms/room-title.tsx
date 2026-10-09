"use client"

import { IconHeart, IconShare } from "@tabler/icons-react"
import { toast } from "sonner"

import { useFavorite } from "@/components/favorites/use-favorite"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Title + Share / Save. Share uses the native share sheet where there is one, else copies
// the link. Save is the shared favourites heart (needs a login).
export function RoomTitle({ id, title }: { id: string; title: string }) {
  const { saved, toggle } = useFavorite(id)

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // The user closed the share sheet; nothing to report.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast("Link copied")
    } catch {
      toast("Couldn't copy the link")
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 pt-6 pb-4">
      <h1 className="text-[22px] leading-7 font-semibold text-ink md:text-[26px] md:leading-8">{title}</h1>
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" className="h-9 gap-2 rounded-lg px-3 text-sm font-medium underline" onClick={share}>
          <IconShare className="size-4" />
          Share
        </Button>
        <Button variant="ghost" className="h-9 gap-2 rounded-lg px-3 text-sm font-medium underline" onClick={toggle} aria-pressed={saved}>
          <IconHeart className={cn("size-4", saved && "fill-rausch text-rausch")} />
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  )
}
