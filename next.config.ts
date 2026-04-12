import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "./"),
  serverExternalPackages: ["pg", "bcryptjs", "better-sqlite3"],
  transpilePackages: [
    "@blocknote/react",
    "@blocknote/core",
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/pm",
    "@tanstack/react-store",
  ],
};

export default nextConfig;
