/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pre-existing lint issues in the ported codebase (unescaped entities,
  // missing `rel` on target="_blank", etc.) shouldn't block production
  // builds — `next lint` / editor integration still surface them.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig
