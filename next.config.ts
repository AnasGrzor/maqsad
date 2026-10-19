import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const dev = process.env.NODE_ENV === "development";

// A static policy, not a nonce one: nonces need every page rendered per request, which would turn off
// partial prerendering. 'unsafe-inline' scripts are therefore allowed (Next inlines its bootstrap scripts),
// but scripts, connections, frames, plugins, <base> and form posts are limited to this origin.
// The browser never talks to Supabase or the AI providers directly; the server does.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // Browsers ignore HSTS over plain http, so this is harmless for `next start` on localhost.
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/:locale(en|ur)/agents/:path*", destination: "/:locale/consultants/:path*", permanent: true },
      { source: "/agents/:path*", destination: "/consultants/:path*", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Credential uploads are up to 4 MB plus multipart overhead; Vercel caps request bodies at 4.5 MB anyway.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
