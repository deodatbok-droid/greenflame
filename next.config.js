/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['qrcode', 'pdfkit'],
  async headers() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type',  value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/GreenFlame.apk',
        headers: [
          { key: 'Content-Type',           value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition',    value: 'attachment; filename="GreenFlame.apk"' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control',          value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
}

module.exports = nextConfig
