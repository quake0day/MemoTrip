import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
