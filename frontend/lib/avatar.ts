// Users without a photo get one of three brand gradients, picked by hashing a stable id
// (DESIGN.md "Gradients & Illustration"), so the same person always has the same colour.
const GRADIENTS = [
  "bg-(image:--gradient-avatar-rausch)",
  "bg-(image:--gradient-avatar-berry)",
  "bg-(image:--gradient-avatar-plum)",
]

export function avatarGradient(seed: string) {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

export const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "?"
