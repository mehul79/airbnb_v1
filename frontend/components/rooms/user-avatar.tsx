import Image from "next/image"

import { avatarGradient, initialOf } from "@/lib/avatar"
import { cn } from "@/lib/utils"

// Photo if there is one, otherwise the person's initial on a hashed brand gradient.
export function UserAvatar({ id, name, url, className }: { id: string; name: string; url: string | null; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white", url ? "bg-surface-soft" : avatarGradient(id), className)}>
      {url ? <Image src={url} alt={name} fill sizes="96px" className="object-cover" /> : <span aria-hidden>{initialOf(name)}</span>}
      {!url && <span className="sr-only">{name}</span>}
    </span>
  )
}
