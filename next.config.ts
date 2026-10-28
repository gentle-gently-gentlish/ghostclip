import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller Docker/Fly image
  output: "standalone",
  // Browsers open http://127.0.0.1:43123 while `next dev` treats localhost as
  // the origin — without this, /_next client/HMR resources are blocked and the
  // UI stays as non-interactive SSR HTML (buttons visible, clicks do nothing).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["canvas", "node:sqlite"],
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
