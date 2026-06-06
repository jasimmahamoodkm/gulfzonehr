/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/HRportal',

  // Redirect root of the app to dashboard
  async redirects() {
    return [
      {
        // Redirect /HRportal/ → /HRportal/dashboard
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
