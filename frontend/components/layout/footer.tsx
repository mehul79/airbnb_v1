"use client"

import {
  IconBrandFacebookFilled,
  IconBrandInstagram,
  IconBrandX,
  IconChevronDown,
  IconWorld,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Footer matching airbnb.co.in: a grey block with "Inspiration for future getaways", the
// Support / Hosting / Airbnb link columns, then the legal bar. Destinations and pages don't
// exist yet, so every link says "coming soon" instead of going nowhere.

type Place = [name: string, kind: string]

const INSPIRATION: Record<string, Place[]> = {
  Popular: [
    ["Tokyo", "Holiday rentals"], ["Barcelona", "Flat rentals"], ["St. Petersburg", "Holiday rentals"],
    ["Pocono Mountains", "House rentals"], ["Daytona Beach", "Villa rentals"], ["Broken Bow", "House rentals"],
    ["Raleigh", "House rentals"], ["Brooklyn", "Monthly Rentals"], ["Memphis", "House rentals"],
    ["Kauai", "Monthly Rentals"], ["Galveston", "Villa rentals"], ["Pittsburgh", "House rentals"],
    ["Nashville", "Monthly Rentals"], ["Outer Banks", "Flat rentals"], ["Destin", "Holiday rentals"],
    ["Montreal", "House rentals"], ["Chicago", "Flat rentals"],
  ],
  "Arts & culture": [
    ["Jaipur", "Holiday rentals"], ["Kolkata", "Flat rentals"], ["Udaipur", "Villa rentals"],
    ["Varanasi", "House rentals"], ["Hampi", "Holiday rentals"], ["Pondicherry", "Villa rentals"],
  ],
  Beach: [
    ["Goa", "Villa rentals"], ["Gokarna", "House rentals"], ["Alibag", "Villa rentals"],
    ["Varkala", "Holiday rentals"], ["Pondicherry", "Flat rentals"], ["Kovalam", "House rentals"],
  ],
  Mountains: [
    ["Manali", "Cabin rentals"], ["Kasauli", "House rentals"], ["Shimla", "Holiday rentals"],
    ["Mussoorie", "Villa rentals"], ["Dharamshala", "Flat rentals"], ["Munnar", "Cottage rentals"],
  ],
  Outdoors: [
    ["Rishikesh", "Holiday rentals"], ["Coorg", "Cottage rentals"], ["Jim Corbett", "House rentals"],
    ["Wayanad", "Villa rentals"], ["Spiti Valley", "Holiday rentals"], ["Ooty", "Cottage rentals"],
  ],
  "Things to do": [
    ["Goa", "Holiday rentals"], ["Jaipur", "Flat rentals"], ["Bengaluru", "Flat rentals"],
    ["Mumbai", "Flat rentals"], ["Delhi", "House rentals"], ["Chandigarh", "Flat rentals"],
  ],
}

const COLUMNS: { title: string; links: string[] }[] = [
  {
    title: "Support",
    links: [
      "Help Centre", "Get help with a safety issue", "AirCover", "Anti-discrimination",
      "Disability support", "Cancellation options", "Report neighbourhood concern",
    ],
  },
  {
    title: "Hosting",
    links: [
      "Airbnb your home", "Airbnb your experience", "Airbnb your service", "AirCover for Hosts",
      "Hosting resources", "Community forum", "Hosting responsibly", "Join a free hosting class",
      "Find a co-host", "Refer a host",
    ],
  },
  {
    title: "Airbnb",
    links: ["2026 Summer Release", "Newsroom", "Careers", "Investors", "Airbnb.org emergency stays"],
  },
]

const comingSoon = (label: string) => toast(`${label}: coming soon`)

function FooterLink({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => comingSoon(label)}
      className={cn("w-fit text-left text-sm leading-[18px] text-ink hover:underline", className)}
    >
      {label}
    </button>
  )
}

export function Footer() {
  return (
    <footer className="bg-surface-soft px-6 pt-12 pb-20 lg:px-12">
      <h2 className="text-[22px] leading-7 font-medium text-ink">Inspiration for future getaways</h2>

      <Tabs defaultValue="Popular" className="mt-6 gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-auto overflow-y-hidden rounded-none border-b border-hairline-soft p-0"
        >
          {Object.keys(INSPIRATION).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-12 flex-none rounded-none px-0 text-sm font-medium text-muted-foreground after:bottom-0 data-active:text-ink"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(INSPIRATION).map(([tab, places]) => (
          <TabsContent key={tab} value={tab} className="pt-10">
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-3 lg:grid-flow-col lg:grid-cols-6 lg:grid-rows-3">
              {places.map(([name, kind]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => comingSoon(name)}
                  className="flex w-fit flex-col items-start text-left text-sm leading-[18px]"
                >
                  <span className="font-medium text-ink">{name}</span>
                  <span className="text-muted-foreground">{kind}</span>
                </button>
              ))}
              {places.length > 12 && (
                <button
                  type="button"
                  onClick={() => comingSoon("More destinations")}
                  className="flex w-fit items-start gap-1 text-sm leading-[18px] font-medium text-ink"
                >
                  Show more
                  <IconChevronDown className="size-4" />
                </button>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-24 grid gap-10 md:grid-cols-3 md:gap-x-16">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-[18px]">
            <h3 className="text-sm font-medium text-ink">{col.title}</h3>
            {col.links.map((link) => (
              <FooterLink key={link} label={link} />
            ))}
          </nav>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-hairline-soft pt-6 text-sm text-ink">
        <p className="flex flex-wrap items-center gap-x-2">
          <span>© 2026 Airbnb, Inc.</span>
          {["Privacy", "Terms", "Company details"].map((item) => (
            <span key={item} className="flex items-center gap-2">
              <span aria-hidden>·</span>
              <FooterLink label={item} />
            </span>
          ))}
        </p>

        <div className="flex items-center gap-6">
          <button type="button" onClick={() => comingSoon("Language")} className="flex items-center gap-2 font-medium">
            <IconWorld className="size-4" />
            English (IN)
          </button>
          <button type="button" onClick={() => comingSoon("Currency")} className="flex items-center gap-1 font-medium">
            ₹ INR
          </button>
          <ThemeToggle />
          <div className="flex items-center gap-6">
            <button type="button" aria-label="Facebook" onClick={() => comingSoon("Facebook")}>
              <IconBrandFacebookFilled className="size-[18px]" />
            </button>
            <button type="button" aria-label="X" onClick={() => comingSoon("X")}>
              <IconBrandX className="size-[18px]" />
            </button>
            <button type="button" aria-label="Instagram" onClick={() => comingSoon("Instagram")}>
              <IconBrandInstagram className="size-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
