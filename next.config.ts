import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parent kiro folder has its own lockfile; pin the root so Turbopack
  // doesn't infer the wrong workspace.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
