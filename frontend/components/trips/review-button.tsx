"use client"

import { useState } from "react"
import { IconStar, IconStarFilled } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiPost } from "@/lib/api"
import { forgetCached } from "@/lib/use-query"
import { cn } from "@/lib/utils"

const MIN = 10
const WORDS = ["", "Terrible", "Poor", "Okay", "Good", "Excellent"]

// "Leave a review" on a finished stay. The API decides whether the guest may review (a stay that
// has ended, once per home); this form only collects a rating and some words and shows its answer.
// It sits above the card's stretched link (relative z-10), so opening it never navigates.
export function ReviewButton({ listingId, title, reviewed }: { listingId: string; title: string; reviewed: boolean }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(reviewed)
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<{ rating?: string; body?: string; form?: string }>({})

  if (done) return <span className="relative z-10 text-sm font-semibold text-muted-foreground">Reviewed</span>

  async function submit() {
    const next: typeof errors = {}
    if (rating === 0) next.rating = "Choose a star rating."
    if (body.trim().length < MIN) next.body = `Write at least ${MIN} characters.`
    setErrors(next)
    if (next.rating || next.body) return

    setPending(true)
    try {
      await apiPost(`/listings/${listingId}/reviews`, { rating, body })
      forgetCached(`/listings/${listingId}`)
      setDone(true)
      setOpen(false)
      toast.success("Thanks, your review is posted.")
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_REVIEWED") setDone(true)
      setErrors({ form: e instanceof ApiError ? e.message : "Something went wrong. Try again." })
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="relative z-10 rounded-lg border-ink font-semibold" onClick={() => setOpen(true)}>
        Leave a review
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How was your stay?</DialogTitle>
            <DialogDescription className="line-clamp-2">{title}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.rating}>
              <FieldLabel id="rating-label">Rating</FieldLabel>
              <div role="radiogroup" aria-labelledby="rating-label" className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                    onClick={() => {
                      setRating(n)
                      setErrors((e) => ({ ...e, rating: undefined }))
                    }}
                    className="flex size-10 items-center justify-center rounded-full text-ink outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    {n <= rating ? <IconStarFilled className="size-7" /> : <IconStar className="size-7 text-muted-foreground" />}
                  </button>
                ))}
                <span className={cn("ml-2 text-sm text-muted-foreground", rating === 0 && "invisible")}>{WORDS[rating] || "-"}</span>
              </div>
              {errors.rating && <FieldError>{errors.rating}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.body}>
              <FieldLabel htmlFor="review-body">Your review</FieldLabel>
              <Textarea
                id="review-body"
                rows={5}
                maxLength={2000}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  setErrors((prev) => ({ ...prev, body: undefined }))
                }}
                placeholder="What did you like? Anything future guests should know?"
                aria-invalid={!!errors.body}
              />
              {errors.body && <FieldError>{errors.body}</FieldError>}
            </Field>
            {errors.form && <FieldError>{errors.form}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={submit}>
              {pending && <Spinner data-icon="inline-start" />}
              Post review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
