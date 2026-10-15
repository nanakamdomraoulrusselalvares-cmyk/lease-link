import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: [
    "10.145.83.212",
    "10.145.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.1.142",
    "192.168.1.*",
    "192.168.*.*",
    "*.local",
  ],
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
