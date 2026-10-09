"use client"

import { IconMap } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

// PRD: the interactive results map is deferred (P2), and live maps show a clear "Coming
// soon" instead of a dead control. A static location map ships on the listing page.
export function MapButton() {
  return (
    <Button
      type="button"
      onClick={() => toast("Map view: coming soon")}
      className="fixed bottom-6 left-1/2 z-30 h-12 -translate-x-1/2 gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-background shadow-float hover:bg-ink/90 active:bg-ink"
    >
      Show map
      <IconMap className="size-4" />
    </Button>
  )
}
