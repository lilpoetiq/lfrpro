const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Native module: let Node load it at runtime (helps Vercel/Linux builds). */
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  output: 'standalone',
  compress: true,
  // Disable the dev indicator badge completely
  devIndicators: false,
  async redirects() {
    return [{ source: '/login', destination: '/dashboard', permanent: false }]
  },
  experimental: {
    // Increase body size limit for App Router API routes (FormData uploads)
    // This is required for large CSV file uploads and beat pack uploads
    proxyClientMaxBodySize: '10gb', // For App Router API routes
    serverActions: {
      bodySizeLimit: '10gb', // For Server Actions
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
