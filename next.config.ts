import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // CloudPanel: usar "npm start" (next start -p 3015), sem standalone
  outputFileTracingRoot: path.join(process.cwd()),
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
