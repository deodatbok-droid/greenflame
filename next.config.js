/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['qrcode', 'pdfkit'],
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
