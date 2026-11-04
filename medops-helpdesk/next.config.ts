import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep dev memory use lower; this app does not currently use Cache Components.
  cacheComponents: false,
  partialPrefetching: false,
  reactStrictMode: false,
  experimental: {
    // Defer loading route modules until a request needs them to lower startup RAM.
    preloadEntriesOnStart: false,
  },
  typescript: {
    // Type checking is validated directly with standalone tsc with custom heap
    ignoreBuildErrors: true,
  },
  
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
