// Seed photos are bare Unsplash links (full-size originals, several MB). Ask Unsplash's CDN
// for a sized copy so Next's image optimizer doesn't time out fetching the original.
// Host uploads live on Cloudinary, which resizes on the fly the same way.
export function listingPhotoSrc(url: string, width = 800) {
  if (url.startsWith("https://images.unsplash.com/") && !url.includes("?")) {
    return `${url}?w=${width}&q=80&auto=format&fit=crop`
  }
  if (url.startsWith("https://res.cloudinary.com/") && url.includes("/image/upload/v")) {
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width}/`)
  }
  return url
}
