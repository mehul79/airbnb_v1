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

export const formatRating = (r: number) => r.toFixed(2).replace(/0$/, "")
