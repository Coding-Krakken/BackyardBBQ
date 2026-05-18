import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { SessionProvider } from "./components/SessionProvider";
import { SmoothScrollProvider } from "./components/SmoothScrollProvider";
import { CartProvider } from "./components/cart/CartContext";
import { CartDrawer } from "./components/cart/CartDrawer";
import { MobileBottomBar } from "./components/MobileBottomBar";
import { MobileCartCTA } from "./components/MobileCartCTA";
import { JsonLd } from "./components/seo/JsonLd";
import { businessInfo } from "./config/content";

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
    default: "Backyard BBQ King | Premium Texas-Style Smokehouse and Catering",
    template: "%s | Backyard BBQ King"
  },
  description: "Premium smokehouse catering, food truck flavor, and modern online ordering in one cinematic brand experience.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Backyard BBQ King",
    description:
      "Cinematic Texas-style smokehouse flavor for online ordering, food truck events, and premium catering service.",
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
    description: "Slow-smoked Texas-style BBQ with premium catering and modern ordering.",
    images: [defaultOgImage]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const restaurantSchema = {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "LocalBusiness"],
    name: "Backyard BBQ King",
    image: `${siteUrl}${defaultOgImage}`,
    url: siteUrl,
    telephone: businessInfo.phone,
    email: businessInfo.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: businessInfo.location,
      addressRegion: "NY",
      addressCountry: "US"
    },
    servesCuisine: "BBQ",
    priceRange: "$$",
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", description: businessInfo.hours }]
  };

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <JsonLd data={restaurantSchema} />
        <SessionProvider>
          <SmoothScrollProvider>
            <CartProvider>
              <a className="skip-link" href="#main-content">
                Skip to content
              </a>
              {children}
              <CartDrawer />
              <MobileCartCTA />
              <MobileBottomBar />
            </CartProvider>
          </SmoothScrollProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
