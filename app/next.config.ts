import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The curriculum dataset is read from disk at run time (src/lib/curriculum/dataset.ts).
  outputFileTracingIncludes: {
    "/api/curriculum": ["./src/data/curriculum/sk.json"],
    "/api/curriculum/**": ["./src/data/curriculum/sk.json"],
    "/api/teach": ["./src/data/curriculum/sk.json"],
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
