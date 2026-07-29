import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { getMonetagSettings } from "@/lib/monetag";

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

  // Strip <script> wrapper tags if the admin pasted the full HTML snippet.
  const multitag_js =
    monetag.enabled && monetag.multitag_script.trim()
      ? monetag.multitag_script
          .trim()
          .replace(/^<script[^>]*>/i, "")
          .replace(/<\/script>$/i, "")
          .trim()
      : "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3580627557521419"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        {/* Monetag Multitag — sitewide passive ads (OnClick, In-Page Push, Vignette).
            Only injected when admin has enabled Monetag and pasted their zone script. */}
        {multitag_js && (
          <Script
            id="monetag-multitag"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: multitag_js }}
          />
        )}
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
