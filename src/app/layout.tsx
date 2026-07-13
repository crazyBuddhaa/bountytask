import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BountyTask — Earn ₦ Completing Tasks",
    template: "%s | BountyTask",
  },
  description:
    "Complete verified tasks and earn Naira credits. Withdraw earnings through secure manual bank transfers. Nigeria's #1 task-to-earn platform.",
  keywords: ["earn money online", "task to earn", "Nigeria", "make money", "gig work"],
  authors: [{ name: "BountyTask" }],
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "BountyTask",
    title: "BountyTask — Earn ₦ Completing Tasks",
    description: "Complete tasks, earn Naira. Nigeria's #1 task-to-earn platform.",
  },
  other: {
    "google-adsense-account": "ca-pub-3580627557521419",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a21caf",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3580627557521419"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <PageViewTracker />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
