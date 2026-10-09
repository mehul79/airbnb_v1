export const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  house: "Home",
  villa: "Villa",
  cottage: "Cottage",
  cabin: "Cabin",
  guesthouse: "Guesthouse",
  farmhouse: "Farmhouse",
  houseboat: "Houseboat",
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// "Guest favourite" only when the reviews back it up (CLAUDE.md: don't invent badges).
export const isGuestFavourite = (l: { rating: number | null; review_count: number }) =>
  l.rating !== null && l.rating >= 4.8 && l.review_count >= 3

export const formatRating = (r: number) => r.toFixed(2).replace(/0$/, "")
