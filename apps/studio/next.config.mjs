// The Studio talks to the daemon. In dev, rewrite /api and /health to it so the browser stays
// same-origin (no CORS). In production the daemon serves the built app.
const DAEMON = process.env.OPENVIDEO_DAEMON ?? "http://localhost:7777";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${DAEMON}/api/:path*` },
      { source: "/health", destination: `${DAEMON}/health` },
    ];
  },
};

export default config;
