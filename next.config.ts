import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 需要
  experimental: {
    runtime: "edge",
  },
};

export default nextConfig;
