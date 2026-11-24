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
    // Make and the course pages approve materials, which rechecks the outcomes on the server.
    "/": ["./src/data/curriculum/sk.json"],
    "/make/**": ["./src/data/curriculum/sk.json"],
    "/courses/**": ["./src/data/curriculum/sk.json"],
    // Live setup shows outcome codes, and starting a session saves new questions as an approved quiz.
    "/live/**": ["./src/data/curriculum/sk.json"],
    "/api/live/start": ["./src/data/curriculum/sk.json"],
  },
};

export default nextConfig;
