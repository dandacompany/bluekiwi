import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

const SITE_TITLE = "BlueKiwi — AI Agent Workflow Engine";
const SITE_DESC =
  "Design reusable workflows, run them from any AI coding agent, and watch every step in real time.";

export const metadata: Metadata = {
  title: {
    default: "BlueKiwi",
    template: "%s | BlueKiwi",
  },
  description: SITE_DESC,
  metadataBase: new URL(process.env.PUBLIC_URL || "http://localhost:3100"),
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
    title: SITE_TITLE,
    description: SITE_DESC,
    locale: "ko_KR",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: "BlueKiwi — AI Agent Workflow Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og-cover.png"],
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
