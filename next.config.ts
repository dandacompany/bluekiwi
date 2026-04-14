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
};

export default nextConfig;
