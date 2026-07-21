import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The browser must be allowed to reach the backend API for auth/cultivation
// fetches; everything else is same-origin. next/font self-hosts the Google
// fonts at build time, so font-src stays 'self'.
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";

// 'unsafe-inline' is required for Next's inline bootstrap scripts and this
// app's inline style props; 'unsafe-eval' is only needed by React Fast Refresh
// in dev. The high-value directives here are frame-ancestors/object-src/base-uri.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${apiBase}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .concat(";");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` without the full node_modules tree.
  output: "standalone",
  // Pin the file-tracing root to this app. Otherwise Next walks up and infers a
  // higher workspace root (node_modules/lockfiles exist above `frontend`),
  // which nests standalone output under working/tu-tien-chi-lo/frontend/ and
  // breaks the Docker COPY paths. This keeps server.js at .next/standalone/.
  outputFileTracingRoot: path.join(__dirname),
  reactCompiler: true,
  // Don't advertise the framework/version in every response.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
