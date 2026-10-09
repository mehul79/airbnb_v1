"use client"

import { useRef, useState, type FormEvent, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { IconAlertCircle, IconArrowDown, IconArrowUp, IconPhotoPlus, IconTrash, IconUpload } from "@tabler/icons-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ApiError, apiPatch, apiPost } from "@/lib/api"
import type { HostListing } from "@/lib/host-types"
import type { Amenity } from "@/lib/listings-api"
import { profileHref } from "@/lib/profile-links"
import { useQuery } from "@/lib/use-query"

const PROPERTY_TYPES = ["apartment", "house", "villa", "cottage", "cabin", "guesthouse", "farmhouse", "houseboat"]
const CATEGORIES: [string, string][] = [
  ["beachfront", "Beachfront"], ["pools", "Amazing pools"], ["cabins", "Cabins"], ["amazing_views", "Amazing views"],
  ["countryside", "Countryside"], ["lakefront", "Lakefront"], ["design", "Design"], ["mansions", "Mansions"],
  ["tiny_homes", "Tiny homes"], ["trending", "Trending"],
]
const MAX_PHOTOS = 20
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"]

// What POST /host/uploads/sign returns: everything Cloudinary needs to accept one upload.
type UploadSignature = {
  cloud_name: string
  api_key: string
  signature: string
  timestamp: string
  folder: string
  allowed_formats: string
}

const label = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1)
const chip =
  "h-10 rounded-full border border-hairline bg-transparent px-4 text-sm font-medium text-ink hover:bg-surface-soft data-[state=on]:border-ink data-[state=on]:bg-surface-soft"

type PhotoRow = { url: string; alt_text: string }
type Values = {
  title: string
  description: string
  city: string
  region: string
  country: string
  location_label: string
  latitude: string
  longitude: string
  property_type: string
  category: string
  max_guests: string
  bedrooms: string
  beds: string
  bathrooms: string
  nightly: string // rupees in the form, paise on the wire
  cleaning: string
  photos: PhotoRow[]
  amenities: string[]
}

const rupees = (minor: number) => String(minor / 100)

function initialValues(l?: HostListing): Values {
  if (!l) {
    return {
      title: "", description: "", city: "", region: "", country: "India", location_label: "", latitude: "", longitude: "",
      property_type: "apartment", category: "trending", max_guests: "2", bedrooms: "1", beds: "1", bathrooms: "1",
      nightly: "", cleaning: "0", photos: [{ url: "", alt_text: "" }], amenities: [],
    }
  }
  return {
    title: l.title, description: l.description, city: l.city, region: l.region, country: l.country,
    location_label: l.location_label, latitude: l.latitude === null ? "" : String(l.latitude),
    longitude: l.longitude === null ? "" : String(l.longitude), property_type: l.property_type, category: l.category,
    max_guests: String(l.max_guests), bedrooms: String(l.bedrooms), beds: String(l.beds), bathrooms: String(l.bathrooms),
    nightly: rupees(l.nightly_price_minor), cleaning: rupees(l.cleaning_fee_minor),
    photos: l.photos.map((p) => ({ url: p.url, alt_text: p.alt_text })), amenities: l.amenities,
  }
}

// The API names fields like the payload; the form shows prices in rupees, so map those two.
const ALIAS: Record<string, string> = { nightly_price_minor: "nightly", cleaning_fee_minor: "cleaning" }

// HOST-01/02: create or edit a listing. Checks the obvious things here for quick feedback;
// the API validates everything again and its messages are shown beside the fields.
export function ListingForm({ initial }: { initial?: HostListing }) {
  const router = useRouter()
  const [v, setV] = useState<Values>(() => initialValues(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const amenities = useQuery<Amenity[]>("/amenities")
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((prev) => ({ ...prev, [key]: value }))
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s))

  function check(): Record<string, string> {
    const e: Record<string, string> = {}
    for (const key of ["title", "description", "city", "region", "country", "location_label"] as const) {
      if (!v[key].trim()) e[key] = "Required."
    }
    if (!(num(v.nightly) > 0)) e.nightly = "Enter a price above 0."
    if (!(num(v.cleaning) >= 0)) e.cleaning = "Enter 0 or more."
    if (!(num(v.max_guests) >= 1)) e.max_guests = "At least 1 guest."
    if (!(num(v.bedrooms) >= 0)) e.bedrooms = "0 or more."
    if (!(num(v.beds) >= 0)) e.beds = "0 or more."
    if (!(num(v.bathrooms) >= 0)) e.bathrooms = "0 or more."
    if (v.photos.every((p) => !p.url.trim())) e.photos = "Add at least one photo link."
    return e
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    const problems = check()
    setErrors(problems)
    if (Object.keys(problems).length) return

    const body = {
      title: v.title, description: v.description, city: v.city, region: v.region, country: v.country,
      location_label: v.location_label,
      latitude: v.latitude.trim() ? Number(v.latitude) : null,
      longitude: v.longitude.trim() ? Number(v.longitude) : null,
      property_type: v.property_type, category: v.category,
      max_guests: Number(v.max_guests), bedrooms: Number(v.bedrooms), beds: Number(v.beds), bathrooms: Number(v.bathrooms),
      nightly_price_minor: Math.round(Number(v.nightly) * 100),
      cleaning_fee_minor: Math.round(Number(v.cleaning) * 100),
      photos: v.photos.filter((p) => p.url.trim()).map((p) => ({ url: p.url.trim(), alt_text: p.alt_text })),
      amenities: v.amenities,
    }

    setPending(true)
    try {
      if (initial) await apiPatch(`/host/listings/${initial.id}`, body)
      else await apiPost("/host/listings", body)
      toast(initial ? "Listing saved" : "Listing created")
      router.push(profileHref("hosting"))
      return // stay pending while we navigate, so it can't be submitted twice
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = Object.fromEntries(Object.entries(err.fields).map(([k, msg]) => [ALIAS[k] ?? k, msg]))
        setErrors(Object.keys(mapped).length ? mapped : { form: err.message })
        if (err.status === 401) toast("Please log in again.")
      } else setErrors({ form: "Something went wrong. Please try again." })
    }
    setPending(false)
  }

  // Host photo upload: the API signs the request (the secret stays there) and the browser
  // sends the file straight to Cloudinary. The returned link is added like a pasted one.
  async function upload(files: FileList | null) {
    if (!files?.length) return
    const room = MAX_PHOTOS - v.photos.filter((p) => p.url.trim()).length
    if (room <= 0) return toast(`You can add up to ${MAX_PHOTOS} photos.`)

    for (const file of Array.from(files).slice(0, room)) {
      if (!UPLOAD_TYPES.includes(file.type)) {
        toast(`${file.name}: use a JPG, PNG or WebP image.`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast(`${file.name} is over 10 MB.`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const sig = await apiPost<UploadSignature>("/host/uploads/sign", {})
        const form = new FormData()
        form.append("file", file)
        form.append("api_key", sig.api_key)
        form.append("timestamp", sig.timestamp)
        form.append("signature", sig.signature)
        form.append("folder", sig.folder)
        form.append("allowed_formats", sig.allowed_formats)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok || !data.secure_url) throw new Error(data?.error?.message ?? "Upload failed")
        setV((prev) => ({
          ...prev,
          // an empty starter row is replaced by the first upload instead of left behind
          photos: [...prev.photos.filter((p) => p.url.trim()), { url: data.secure_url as string, alt_text: "" }],
        }))
      } catch (err) {
        toast(err instanceof ApiError ? err.message : `Couldn't upload ${file.name}. Please try again.`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileInput.current) fileInput.current.value = "" // allow choosing the same file again
  }

  const photoError = errors.photos
  const movePhoto = (i: number, dir: -1 | 1) =>
    setV((prev) => {
      const photos = [...prev.photos]
      ;[photos[i], photos[i + dir]] = [photos[i + dir], photos[i]]
      return { ...prev, photos }
    })
  const editPhoto = (i: number, patch: Partial<PhotoRow>) =>
    setV((prev) => ({ ...prev, photos: prev.photos.map((p, j) => (j === i ? { ...p, ...patch } : p)) }))

  const text = (key: keyof Values, name: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Field data-invalid={!!errors[key]}>
      <FieldLabel htmlFor={`f-${key}`}>{name}</FieldLabel>
      <Input
        id={`f-${key}`}
        value={v[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!errors[key]}
        className="h-12 rounded-lg"
        {...props}
      />
      <FieldError>{errors[key]}</FieldError>
    </Field>
  )

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[760px] flex-col gap-10">
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive" role="alert">
          <IconAlertCircle />
          <AlertTitle>{errors.form ?? "Please fix the highlighted fields"}</AlertTitle>
          {!errors.form && <AlertDescription>Nothing was saved yet.</AlertDescription>}
        </Alert>
      )}

      <FieldSet>
        <FieldLegend>The basics</FieldLegend>
        <FieldGroup className="gap-5">
          {text("title", "Title", { maxLength: 120, placeholder: "Cosy hilltop cottage near the river" })}
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="f-description">Description</FieldLabel>
            <Textarea id="f-description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} rows={6} aria-invalid={!!errors.description} className="rounded-lg" />
            <FieldError>{errors.description}</FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Type</FieldLegend>
        <Field>
          <FieldLabel>Type of place</FieldLabel>
          <ToggleGroup type="single" value={v.property_type} onValueChange={(t) => t && set("property_type", t)} spacing={2} className="flex-wrap" aria-label="Type of place">
            {PROPERTY_TYPES.map((t) => (
              <ToggleGroupItem key={t} value={t} className={chip}>
                {label(t)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <FieldDescription>Where it shows up when guests browse.</FieldDescription>
          <ToggleGroup type="single" value={v.category} onValueChange={(c) => c && set("category", c)} spacing={2} className="flex-wrap" aria-label="Category">
            {CATEGORIES.map(([value, text]) => (
              <ToggleGroupItem key={value} value={value} className={chip}>
                {text}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Location</FieldLegend>
        <FieldGroup className="gap-5">
          <div className="grid gap-5 sm:grid-cols-3">
            {text("city", "City")}
            {text("region", "State / region")}
            {text("country", "Country")}
          </div>
          {text("location_label", "Shown on the listing", { placeholder: "Kasol, Himachal Pradesh" })}
          <div className="grid gap-5 sm:grid-cols-2">
            {text("latitude", "Latitude (optional)", { inputMode: "decimal", placeholder: "32.0098" })}
            {text("longitude", "Longitude (optional)", { inputMode: "decimal", placeholder: "77.3145" })}
          </div>
          <FieldDescription>Latitude and longitude place the map on your listing page.</FieldDescription>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Space</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-4">
          {text("max_guests", "Guests", { type: "number", min: 1, inputMode: "numeric" })}
          {text("bedrooms", "Bedrooms", { type: "number", min: 0, inputMode: "numeric" })}
          {text("beds", "Beds", { type: "number", min: 0, inputMode: "numeric" })}
          {text("bathrooms", "Bathrooms", { type: "number", min: 0, step: 0.5, inputMode: "decimal" })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Pricing</FieldLegend>
        <FieldDescription>In rupees. Guests also pay a service fee on top, shown before they book.</FieldDescription>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("nightly", "Price per night (₹)", { type: "number", min: 1, inputMode: "decimal" })}
          {text("cleaning", "Cleaning fee (₹)", { type: "number", min: 0, inputMode: "decimal" })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Amenities</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(amenities.data ?? []).map((a) => (
            <Field key={a.slug} orientation="horizontal">
              <Checkbox
                id={`a-${a.slug}`}
                checked={v.amenities.includes(a.slug)}
                onCheckedChange={(on) => set("amenities", on ? [...v.amenities, a.slug] : v.amenities.filter((s) => s !== a.slug))}
              />
              <FieldLabel htmlFor={`a-${a.slug}`} className="font-normal">
                {a.name}
              </FieldLabel>
            </Field>
          ))}
        </div>
        {amenities.error && (
          <p role="alert" className="text-sm text-error">
            Couldn&apos;t load the amenities list.{" "}
            <button type="button" className="font-semibold underline" onClick={amenities.retry}>
              Try again
            </button>
          </p>
        )}
        <FieldError>{errors.amenities}</FieldError>
      </FieldSet>

      <FieldSet data-invalid={!!photoError}>
        <FieldLegend>Photos</FieldLegend>
        <FieldDescription>Upload photos or paste links (https only). The first one is the cover.</FieldDescription>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInput} type="file" accept={UPLOAD_TYPES.join(",")} multiple className="sr-only" aria-label="Choose photos to upload" onChange={(e) => upload(e.target.files)} />
          <Button type="button" variant="outline" className="gap-2 rounded-lg border-ink font-semibold" disabled={uploading > 0 || v.photos.length >= MAX_PHOTOS} onClick={() => fileInput.current?.click()}>
            <IconUpload data-icon="inline-start" />
            {uploading > 0 ? `Uploading ${uploading}\u2026` : "Upload photos"}
          </Button>
          <span className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 10 MB each.</span>
        </div>
        <ul className="flex flex-col gap-4">
          {v.photos.map((photo, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-xl border border-hairline p-4 sm:flex-row sm:items-start">
              <PhotoPreview url={photo.url} />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Input value={photo.url} onChange={(e) => editPhoto(i, { url: e.target.value })} placeholder="https://…" aria-label={`Photo ${i + 1} link`} className="h-11 rounded-lg" />
                <Input value={photo.alt_text} onChange={(e) => editPhoto(i, { alt_text: e.target.value })} placeholder="Describe the photo (optional)" aria-label={`Photo ${i + 1} description`} className="h-11 rounded-lg" maxLength={200} />
              </div>
              <div className="flex shrink-0 gap-1 sm:flex-col">
                <IconButton label="Move up" disabled={i === 0} onClick={() => movePhoto(i, -1)}>
                  <IconArrowUp className="size-4" />
                </IconButton>
                <IconButton label="Move down" disabled={i === v.photos.length - 1} onClick={() => movePhoto(i, 1)}>
                  <IconArrowDown className="size-4" />
                </IconButton>
                <IconButton label="Remove photo" disabled={v.photos.length === 1} onClick={() => set("photos", v.photos.filter((_, j) => j !== i))}>
                  <IconTrash className="size-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
        <FieldError>{photoError}</FieldError>
        <Button type="button" variant="outline" className="w-fit gap-2 rounded-lg border-ink font-semibold" disabled={v.photos.length >= MAX_PHOTOS} onClick={() => set("photos", [...v.photos, { url: "", alt_text: "" }])}>
          <IconPhotoPlus data-icon="inline-start" />
          Add another photo
        </Button>
      </FieldSet>

      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
        <Button type="submit" size="lg" className="h-12 px-8 text-base font-semibold" disabled={pending || uploading > 0}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create listing"}
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-12 px-6 font-semibold underline">
          <Link href={profileHref("hosting")}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="outline" size="icon" className="size-9 rounded-full border-hairline disabled:opacity-30" aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

// A small preview so a wrong link is obvious. Hidden when the link isn't a valid https URL.
function PhotoPreview({ url }: { url: string }) {
  const ok = /^https:\/\/\S+$/.test(url.trim())
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-(image:--gradient-photo-placeholder)">
      {ok && <Image src={url.trim()} alt="" fill sizes="80px" unoptimized className="object-cover" />}
    </div>
  )
}
