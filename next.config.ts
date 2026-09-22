import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // babel-plugin-react-compiler is installed; the flag actually turns the
  // compiler on — automatic memoization, no manual useMemo audits needed.
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "@react-three/drei", "@react-three/fiber"],
  },
  async headers() {
    return [
      {
        // Exhibition assets and sample documents are stable but unhashed —
        // a day fresh, a week stale-while-revalidate (not immutable, so a
        // replaced file still reaches users).
        source: "/key_press/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/sample-:name.pdf",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/specimens/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ]
  },
}

export default nextConfig
