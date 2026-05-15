import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://backyard-bbq.vercel.app";
const defaultOgImage = "/images/marketing/hero.jpg";

export const metadata: Metadata = {
  title: {
    default: "Backyard BBQ King | Premium Texas Smokehouse and Catering",
    template: "%s | Backyard BBQ King"
  },
  description: "Premium smokehouse catering, food truck flavor, and modern online ordering in one cinematic brand experience.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Backyard BBQ King",
    description:
      "Cinematic Texas smokehouse flavor for online ordering, food truck events, and premium catering service.",
    url: siteUrl,
    siteName: "Backyard BBQ King",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "Smoked brisket on a grill"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Backyard BBQ King",
    description: "Slow-smoked Texas BBQ with premium catering and modern ordering.",
    images: [defaultOgImage]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
