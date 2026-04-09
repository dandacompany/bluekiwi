import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import {
  BookOpen,
  FileCode,
  KeyRound,
  ListTodo,
  Workflow,
} from "@/components/icons/lucide";

export const metadata: Metadata = {
  title: "OmegaRod",
  description: "Agent Workflow Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--accent-light)] text-[var(--accent-dark)]">
                <Workflow className="h-4 w-4" />
              </span>
              <span className="font-semibold tracking-tight">OmegaRod</span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/chains"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <Workflow className="h-4 w-4" />
                <span className="hidden sm:inline">워크플로</span>
              </Link>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">태스크</span>
              </Link>
              <Link
                href="/credentials"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <KeyRound className="h-4 w-4" />
                <span className="hidden sm:inline">Credentials</span>
              </Link>
              <Link
                href="/tutorial"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">튜토리얼</span>
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <FileCode className="h-4 w-4" />
                <span className="hidden sm:inline">API</span>
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
