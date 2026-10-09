"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Mounts its children once the section is within ~400px of the viewport, and keeps them
// mounted afterwards. Until then it holds the section's space with a skeleton so nothing
// shifts when content arrives. The id is the anchor target (#reviews etc.): a hash jump
// puts the section in view, which loads it like any other scroll would.
//
// `children` is a JSX element for a next/dynamic component, so its code is only requested
// the first time it renders here, not when the page loads.
export function LazySection({
  id,
  skeleton,
  className,
  children,
}: {
  id: string
  skeleton: ReactNode
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return (
    <section id={id} ref={ref} className={cn("scroll-mt-28", className)}>
      {visible ? <div className="animate-in duration-500 fade-in-0">{children}</div> : skeleton}
    </section>
  )
}

// Shown inside a section while its own code or data is loading, and when it fails.
export function SectionError({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-hairline p-6">
      <p className="text-base text-ink">We couldn&apos;t load {label}.</p>
      <button type="button" onClick={onRetry} className="text-sm font-semibold text-ink underline">
        Try again
      </button>
    </div>
  )
}
