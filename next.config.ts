import type { NextConfig } from 'next';

/** Sent with every response. */
const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/**
 * Pages with account actions (Studio, sign-in, account) must not be framed by
 * other sites (clickjacking). The public Viewer (/v/…) stays embeddable.
 */
const noFramingHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: baseHeaders },
      { source: '/', headers: noFramingHeaders },
      { source: '/studio/:path*', headers: noFramingHeaders },
      { source: '/login', headers: noFramingHeaders },
      { source: '/auth/:path*', headers: noFramingHeaders },
    ];
  },
};

export default nextConfig;
