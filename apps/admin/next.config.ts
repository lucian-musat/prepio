import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@prepio/shared'],
  // Card images go through a server action; allow the 5 MB image limit plus form overhead.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default nextConfig;
