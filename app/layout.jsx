import "@fontsource-variable/manrope";
import "./globals.css";
import { Suspense } from "react";
import { AppProviders } from "@/components/AppProviders";
import { AppShell } from "@/components/layout/AppShell";

export const metadata = {
  title: {
    default: "KickPulse Football Hub",
    template: "%s · KickPulse",
  },
  description:
    "A responsive football intelligence dashboard powered by API-Football, Supabase and Next.js.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
