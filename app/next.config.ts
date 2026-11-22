import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The curriculum dataset is read from disk at run time (src/lib/curriculum/dataset.ts),
  // by the curriculum API, drafting, and the setup and settings pages (and their Server Functions).
  outputFileTracingIncludes: {
    "/api/curriculum": ["./src/data/curriculum/sk.json"],
    "/api/curriculum/**": ["./src/data/curriculum/sk.json"],
    "/api/teach": ["./src/data/curriculum/sk.json"],
    "/setup": ["./src/data/curriculum/sk.json"],
    "/settings": ["./src/data/curriculum/sk.json"],
  },
};

export default nextConfig;
