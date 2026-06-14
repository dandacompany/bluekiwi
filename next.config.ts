import type { NextConfig } from "next";
import path from "path";

const WS_RELAY_URL = process.env.WS_RELAY_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "./"),
  serverExternalPackages: ["pg", "bcryptjs", "better-sqlite3"],
  transpilePackages: [
    "@blocknote/react",
    "@blocknote/core",
    "@blocknote/mantine",
    "@dnd-kit/accessibility",
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/pm",
    "@tanstack/react-store",
  ],
  async rewrites() {
    return [
      // Proxy /ws → WS relay (health + WebSocket upgrade)
      { source: "/ws/:path*", destination: `${WS_RELAY_URL}/:path*` },
      { source: "/ws", destination: WS_RELAY_URL },
    ];
  },
  async headers() {
    // Defense-in-depth security headers. A strict script/style CSP is omitted
    // intentionally (BlockNote/swagger-ui rely on inline styles and would need
    // browser-verified tuning); `frame-ancestors 'self'` is safe and mirrors
    // X-Frame-Options.
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
