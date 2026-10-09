"use client"

import dynamic from "next/dynamic"

import { LazySection } from "@/components/rooms/lazy-section"
import {
  CalendarSkeleton,
  HostSkeleton,
  LocationSkeleton,
  NearbySkeleton,
  PoliciesSkeleton,
  ReviewsSkeleton,
} from "@/components/rooms/section-skeletons"

// One wrapper per below-the-fold section. Each section's code is a dynamic import, so the
// JavaScript (calendar, reviews, map, ...) is requested only when LazySection first renders
// it, i.e. ~400px before the section scrolls into view.
const CalendarSection = dynamic(() => import("@/components/rooms/calendar-section"), { ssr: false, loading: () => <CalendarSkeleton /> })
const ReviewsSection = dynamic(() => import("@/components/rooms/reviews-section"), { ssr: false, loading: () => <ReviewsSkeleton /> })
const LocationSection = dynamic(() => import("@/components/rooms/location-section"), { ssr: false, loading: () => <LocationSkeleton /> })
const HostSection = dynamic(() => import("@/components/rooms/host-section"), { ssr: false, loading: () => <HostSkeleton /> })
const PoliciesSection = dynamic(() => import("@/components/rooms/policies-section"), { ssr: false, loading: () => <PoliciesSkeleton /> })
const NearbySection = dynamic(() => import("@/components/rooms/nearby-section"), { ssr: false, loading: () => <NearbySkeleton /> })

const rule = "border-t border-hairline"

export function LazyCalendar(props: React.ComponentProps<typeof CalendarSection>) {
  return (
    <LazySection id="calendar" skeleton={<CalendarSkeleton />} className={rule}>
      <CalendarSection {...props} />
    </LazySection>
  )
}

export function LazyReviews(props: React.ComponentProps<typeof ReviewsSection>) {
  return (
    <LazySection
      id="reviews"
      skeleton={<ReviewsSkeleton count={props.reviewCount} favourite={props.favourite} />}
      className={rule}
    >
      <ReviewsSection {...props} />
    </LazySection>
  )
}

export function LazyLocation(props: React.ComponentProps<typeof LocationSection>) {
  return (
    <LazySection id="location" skeleton={<LocationSkeleton />} className={rule}>
      <LocationSection {...props} />
    </LazySection>
  )
}

export function LazyHost(props: React.ComponentProps<typeof HostSection>) {
  return (
    <LazySection id="host" skeleton={<HostSkeleton />} className={rule}>
      <HostSection {...props} />
    </LazySection>
  )
}

export function LazyPolicies(props: React.ComponentProps<typeof PoliciesSection>) {
  return (
    <LazySection id="policies" skeleton={<PoliciesSkeleton />} className={rule}>
      <PoliciesSection {...props} />
    </LazySection>
  )
}

export function LazyNearby(props: React.ComponentProps<typeof NearbySection>) {
  return (
    <LazySection id="nearby" skeleton={<NearbySkeleton />} className={rule}>
      <NearbySection {...props} />
    </LazySection>
  )
}
