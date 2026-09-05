import "@fontsource-variable/manrope";
import "./globals.css";
import { Suspense } from "react";
import { AppProviders } from "@/components/AppProviders";
import { AppShell } from "@/components/layout/AppShell";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const SITE_URL = "https://kikpulsepro.vercel.app";
const SITE_NAME = "KickPulse Football Hub";
const SITE_DESCRIPTION =
  "KickPulse is an explainable football AI platform delivering match forecasts, transparent model-performance tracking, and personal decision analytics — built on Supabase and Next.js.";

export const metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${SITE_NAME} — Explainable Football AI Forecasting`,
    template: "%s · KickPulse",
  },

  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },

  keywords: [
    "football AI predictions",
    "explainable AI football",
    "football forecasting model",
    "soccer prediction analytics",
    "model performance tracking",
    "football decision tracking",
    "sports AI platform",
  ],

  authors: [{ name: "KickPulse Team" }],
  creator: "KickPulse",
  publisher: "KickPulse",

  // Canonical + i18n hints
  alternates: {
    canonical: "/",
  },

  // Search engine crawling directives
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  // Open Graph (Facebook, LinkedIn, WhatsApp, Slack previews)
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Explainable Football AI Forecasting`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/public/kispluslogo.png", // 1200x630 recommended
        width: 512,
        height: 512,
        alt: "KickPulse Football Hub — AI forecasting dashboard preview",
      },
    ],
  },

  // Twitter / X Card
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Explainable Football AI Forecasting`,
    description: SITE_DESCRIPTION,
    images: ["/public/kispluslogo.png"], // 1200x630 recommended
    site: "@kickpulse", // update or remove if no handle
    creator: "@kickpulse", // update or remove if no handle
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },

  // manifest: "/manifest.webmanifest",

  category: "sports analytics",

  // Optional: search console / bing verification
  verification: {
    google: "your-google-site-verification-code",
    // other: { bing: "your-bing-verification-code" },
  },
};

// Separate viewport export (Next.js 14+ convention — keeps metadata clean)
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// JSON-LD structured data — helps Google understand your product for rich results
function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GoogleAnalytics />
        <StructuredData />
        <AppProviders>
          <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
