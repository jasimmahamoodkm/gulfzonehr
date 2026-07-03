/** @type {import('next').NextConfig} */
// Per-client branding (app name, basePath, colors) lives in branding.config.json.
const BRANDING = require('./branding.config.json');

const nextConfig = {
  reactStrictMode: true,
  basePath: BRANDING.basePath,

  // Redirect the true server root (outside the basePath) into the app.
  // `basePath: false` is required so this rule matches the literal "/" rather
  // than being auto-prefixed. Without it, http://host:3000/ returns 404
  // because the app is mounted entirely under the basePath.
  async redirects() {
    return [
      {
        source: '/',
        destination: `${BRANDING.basePath}/dashboard`,
        basePath: false,
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig
