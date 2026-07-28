import type { Metadata } from "next";
import { Barlow, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Two voices (art direction round 2, HD-refresh benchmark): wide-tracked
// Barlow caps carry the brand/utility layer — wordmark, mastheads, eyebrows —
// small against big space, never condensed. Source Serif 4 (with true
// italics) carries the editorial voice where the curation speaks: blurbs,
// invitations, empty states. Barlow's letterforms descend from California
// public signage; the UI body stays in it.
const barlow = Barlow({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wayborne",
  description:
    "Curated roads and stops for touring riders. Plan the days, export the GPX, ride it with the nav app you already love.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark-first by decision (2026-07-27): the app lives on asphalt. Light
    // tokens remain defined for a future mode toggle.
    <html
      lang="en"
      className={`${barlow.variable} ${sourceSerif.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
