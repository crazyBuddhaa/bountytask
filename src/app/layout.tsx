import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { getMonetagSettings, parseMonetagSnippet } from "@/lib/monetag";
import { MonetagScript } from "@/components/ads/MonetagScript";

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
  icons: {
    icon: [
      { url: "/icon.png",     sizes: "32x32",  type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/favicon.ico",
  },
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
    "monetag": "689126602663cc000bc9537926f3b8bf",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a21caf",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const monetag = await getMonetagSettings();

  // Parse the admin-pasted snippet into a typed structure.
  // MonetagScript (client component) will suppress it on /admin and /dashboard.
  const multitag = monetag.enabled
    ? parseMonetagSnippet(monetag.multitag_script)
    : { kind: "empty" as const };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Google AdSense — public pages only; AdSense's own placement rules
            handle suppression, but Monetag is gated client-side below. */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3580627557521419"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />

        {/* Monetag Multitag — public pages only.
            MonetagScript is a client component that reads usePathname() and
            returns null on /admin/* and /dashboard/*, so pop-unders, in-page
            push, and vignette ads never fire while a user is inside the app
            or navigating the dashboard sidebar. */}
        <MonetagScript multitag={multitag} />

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
