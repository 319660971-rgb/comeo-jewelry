import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "*": ["./outputs/QIFU-2026-08-13/images/**/*"],
  },
};

export default nextConfig;
