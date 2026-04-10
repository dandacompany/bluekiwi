import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BlueKiwi",
    template: "%s | BlueKiwi",
  },
  description:
    "AI Agent Workflow Engine — Design, execute, and manage agent workflows step by step.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || "http://localhost:3100"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "BlueKiwi",
    title: "BlueKiwi — Agent Workflow Engine",
    description:
      "AI Agent Workflow Engine — Design, execute, and manage agent workflows step by step.",
    images: [
      { url: "/icon-512.png", width: 512, height: 512, alt: "BlueKiwi" },
    ],
  },
  twitter: {
    card: "summary",
    title: "BlueKiwi — Agent Workflow Engine",
    description:
      "AI Agent Workflow Engine — Design, execute, and manage agent workflows step by step.",
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="antialiased">
      <body className="min-h-screen">
        <I18nProvider>
          {children}
          <Toaster position="top-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
