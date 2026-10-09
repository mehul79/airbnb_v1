"use client"

import { useState } from "react"
import { IconChevronRight } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

const LIMIT = 320

// Description that shows its first ~320 characters and expands in place.
export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > LIMIT
  const shown = long && !expanded ? `${text.slice(0, LIMIT).trimEnd()}…` : text

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-base leading-6 whitespace-pre-line text-ink">{shown}</p>
      {long && (
        <Button variant="link" className="h-auto gap-1 p-0 text-base font-semibold text-ink underline" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "Show less" : "Show more"}
          {!expanded && <IconChevronRight className="size-4" />}
        </Button>
      )}
    </div>
  )
}
