"use client"

import { IconCalendarX, IconHome, IconShieldCheck, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { plural } from "@/lib/labels"

// "Things to know". Only what this product actually does: no cancellations yet, stays run
// [check-in, check-out), a guest cap, and no host-reported safety details.
export default function PoliciesSection({ maxGuests }: { maxGuests: number }) {
  const policies: { icon: Icon; title: string; summary: string[]; details: string[] }[] = [
    {
      icon: IconCalendarX,
      title: "Cancellation policy",
      summary: ["Bookings can't be cancelled or changed yet.", "Check your dates and guests before you reserve."],
      details: [
        "Cancellations and changes aren't available in this version. Once a booking is confirmed it stays as booked.",
        "You'll see the full price, including the cleaning and service fees, before you confirm. No payment is taken.",
      ],
    },
    {
      icon: IconHome,
      title: "House rules",
      summary: [`${plural(maxGuests, "guest")} maximum`, "You stay from your check-in day until your check-out day."],
      details: [
        `This home sleeps up to ${plural(maxGuests, "guest")}, not counting infants.`,
        "Your stay covers every night from your check-in day up to, but not including, your check-out day. The next guest can check in on your check-out day.",
      ],
    },
    {
      icon: IconShieldCheck,
      title: "Safety & property",
      summary: ["The host hasn't reported safety details for this home."],
      details: ["The host hasn't added information about safety devices or property hazards. Ask the host before booking if it matters to you."],
    },
  ]

  return (
    <div className="flex flex-col gap-8 py-12">
      <h2 className="text-[22px] leading-7 font-semibold text-ink">Things to know</h2>
      <div className="grid gap-10 md:grid-cols-3">
        {policies.map(({ icon: Icon, title, summary, details }) => (
          <div key={title} className="flex flex-col items-start gap-3">
            <Icon className="size-8 text-ink" stroke={1.5} />
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              {summary.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm font-semibold text-ink underline">
                  Learn more
                </Button>
              </DialogTrigger>
              <DialogContent className="gap-6 rounded-xl p-8 sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle className="text-[22px] leading-7 font-semibold">{title}</DialogTitle>
                  <DialogDescription className="sr-only">Details about {title.toLowerCase()}.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 text-base text-ink">
                  {details.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>
    </div>
  )
}
