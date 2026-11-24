import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  basePath: '/new',
  poweredByHeader: false,
  turbopack: { root: path.resolve(__dirname, '..') },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
      ],
    }];
  },
};

export default config;
