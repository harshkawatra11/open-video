// The Studio talks to the daemon. In production the daemon serves the built app (same origin,
// relative paths just work). In dev (`next dev` on its own port), the browser talks to the daemon
// directly via NEXT_PUBLIC_OPENVIDEO_DAEMON (see lib/daemon.ts) rather than through Next's
// rewrites() proxy — confirmed in practice that the rewrite proxy does not stream a long-lived SSE
// response incrementally to the browser (it reads fine via curl straight to the daemon, and the
// events land in the daemon's own buffer in real time, but the browser's fetch reader only ever
// sees one chunk once the whole response ends), which silently breaks the live "alive terminal"
// feed for exactly the multi-minute streaming sessions this product is built around. Direct calls
// need CORS on the daemon side (see apps/daemon/src/server.ts) since the ports differ in dev.
const DAEMON = process.env.OPENVIDEO_DAEMON ?? "http://localhost:7777";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_OPENVIDEO_DAEMON: process.env.NODE_ENV === "development" ? DAEMON : "",
  },
};

export default config;
