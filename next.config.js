/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/HRportal',

  // Redirect the true server root (outside the basePath) into the app.
  // `basePath: false` is required so this rule matches the literal "/" rather
  // than being auto-prefixed to "/HRportal/". Without it, http://host:3000/
  // returns 404 because the app is mounted entirely under /HRportal.
  async redirects() {
    return [
      {
        source: '/',
        destination: '/HRportal/dashboard',
        basePath: false,
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
