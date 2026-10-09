import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Seed/default listing photos (Unsplash CDN) and future host-uploaded photos (Cloudinary).
  // See CLAUDE.md "Images" / system_architecture.md §8.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
