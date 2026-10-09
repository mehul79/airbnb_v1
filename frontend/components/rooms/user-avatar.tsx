import { avatarGradient, initialOf } from "@/lib/avatar"
import { cn } from "@/lib/utils"

// The person's initial on a brand gradient picked by hashing their id.
export function UserAvatar({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white", avatarGradient(id), className)}>
      <span aria-hidden>{initialOf(name)}</span>
      <span className="sr-only">{name}</span>
    </span>
  )
}
