import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropManager - Property Management",
  description: "Modern property management application with multilingual support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The root layout must NOT render <html> or <body> since [locale]/layout.tsx does that.
  // This is because the locale layout needs to set lang and dir attributes on <html>.
  return children;
}
