/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during builds
  eslint: {
    // Do not run ESLint during builds
    ignoreDuringBuilds: true,
  },
  // Disable type checking during builds for faster builds
  typescript: {
    // Do not run TypeScript type checking during builds
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig 