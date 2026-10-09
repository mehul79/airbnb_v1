"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { FloatingField } from "@/components/auth/floating-field"
import { useAppStore } from "@/components/providers/app-store-provider"
import { UserAvatar } from "@/components/rooms/user-avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"
import { ApiError, apiPatch } from "@/lib/api"
import type { BookingPage } from "@/lib/listings-api"
import type { HostListingSummary } from "@/lib/host-types"
import type { SessionUser } from "@/lib/stores/app-store"
import { useQuery } from "@/lib/use-query"

// "About me": the profile card, then the details you can edit. Only real data is shown:
// trips and hosted homes come from the API, saved homes from the shared favourites set.
export function AboutMe({ user }: { user: SessionUser }) {
  const savedCount = useAppStore((s) => s.favoriteIds.size)
  const trips = useQuery<BookingPage>("/me/bookings?page=1&page_size=1", { fresh: true })
  const hosting = useQuery<{ items: HostListingSummary[] }>("/host/listings", { fresh: true })

  const hosts = (hosting.data?.items.length ?? 0) > 0
  const stats: [label: string, value: string][] = [
    ["Trips", trips.data ? String(trips.data.total) : "-"],
    ["Saved homes", String(savedCount)],
    ["Joined", user.created_at ? String(new Date(user.created_at * 1000).getFullYear()) : "-"],
  ]

  return (
    <div className="flex flex-col gap-12">
      <section
        aria-label="Profile summary"
        className="flex flex-col gap-8 rounded-3xl border border-hairline-soft bg-background p-8 shadow-[0_6px_20px_rgba(0,0,0,0.1)] sm:flex-row sm:items-center sm:gap-12"
      >
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:w-56 sm:shrink-0">
          <UserAvatar id={user.id} name={user.display_name} url={user.avatar_url} className="size-32 text-5xl" />
          <p className="max-w-full truncate text-[32px] leading-10 font-bold text-ink">{user.display_name}</p>
          <p className="text-sm font-medium text-ink">{hosting.loading ? " " : hosts ? "Host" : "Guest"}</p>
        </div>

        <dl className="grid flex-1 grid-cols-3 gap-4 sm:grid-cols-1 sm:gap-0 sm:divide-y sm:divide-hairline">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 sm:py-4 sm:first:pt-0 sm:last:pb-0">
              <dd className="text-[22px] leading-7 font-bold text-ink">{value}</dd>
              <dt className="text-xs text-ink">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <DetailsForm key={user.id} user={user} />
    </div>
  )
}

// A signed-in user can change their display name. Email and age are shown but fixed: the API
// only accepts display_name.
function DetailsForm({ user }: { user: SessionUser }) {
  const setUser = useAppStore((s) => s.setUser)
  const [name, setName] = useState(user.display_name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  const unchanged = name.trim() === user.display_name

  async function save(e: FormEvent) {
    e.preventDefault()
    if (pending || unchanged) return
    setPending(true)
    setError(undefined)
    try {
      const updated = await apiPatch<SessionUser>("/me", { display_name: name })
      setUser(updated)
      setName(updated.display_name)
      toast("Profile updated")
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.display_name ?? err.message) : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex max-w-[560px] flex-col gap-6" aria-labelledby="details-heading">
      <h2 id="details-heading" className="text-[22px] leading-7 font-semibold text-ink">
        Your details
      </h2>
      <FieldGroup className="gap-3">
        <Field data-invalid={!!error}>
          <FloatingField label="Name" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} invalid={!!error} />
          <FieldError>{error}</FieldError>
        </Field>
        <Field>
          <FloatingField label="Email" value={user.email} readOnly className="bg-surface-soft" />
          <FieldDescription>Your email can&apos;t be changed.</FieldDescription>
        </Field>
        {user.age !== null && (
          <Field>
            <FloatingField label="Age" value={String(user.age)} readOnly className="bg-surface-soft" />
          </Field>
        )}
      </FieldGroup>

      <Button type="submit" size="lg" className="h-12 w-fit px-6 font-semibold" disabled={pending || unchanged || !name.trim()}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
