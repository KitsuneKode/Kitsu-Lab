import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // babel-plugin-react-compiler is installed; the flag actually turns the
  // compiler on — automatic memoization, no manual useMemo audits needed.
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      '@tabler/icons-react',
      '@react-three/drei',
      '@react-three/fiber',
    ],
  },
  async headers() {
    return [
      {
        // Baseline hardening on every route. The CSP ships report-only:
        // pdf.js workers, upload blob: URLs and analytics each need an
        // allowance, and a blind enforce would break the reader. Watch the
        // reports, tighten, then promote to Content-Security-Policy.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // unsafe-inline/eval: Next inline bootstraps and dev
              // Turbopack. blob: — pdf.js can run its worker from one.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Remote pdfUrl sources, Ask adapters and analytics.
              "connect-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        // Exhibition assets and sample documents are stable but unhashed —
        // a day fresh, a week stale-while-revalidate (not immutable, so a
        // replaced file still reaches users).
        source: '/key_press/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/sample-:name.pdf',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/specimens/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
}

export default nextConfig
