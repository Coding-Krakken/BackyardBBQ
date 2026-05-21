import { galleryImages, menuImages } from "./images";

// Feature flags
export const featureFlags = {
  isDineInEnabled: process.env.NEXT_PUBLIC_ENABLE_DINE_IN === "true"
} as const;

const orderOnlineUrl = process.env.NEXT_PUBLIC_ORDER_ONLINE_URL ?? "/menu";
const doordashUrl = process.env.NEXT_PUBLIC_DOORDASH_URL ?? "https://www.doordash.com";
const uberEatsUrl =
  process.env.NEXT_PUBLIC_UBER_EATS_URL ??
  process.env.NEXT_PUBLIC_UBEREATS_URL ??
  "https://www.ubereats.com";
const grubhubUrl = process.env.NEXT_PUBLIC_GRUBHUB_URL ?? "https://www.grubhub.com";
const cateringInquiryUrl = process.env.NEXT_PUBLIC_CATERING_INQUIRY_URL ?? "/catering";

export const businessInfo = {
  phone: process.env.NEXT_PUBLIC_PHONE ?? "+1-555-BBQ-KING",
  email: process.env.NEXT_PUBLIC_EMAIL ?? "hello@backyardbbqking.com",
  location: process.env.NEXT_PUBLIC_LOCATION ?? "Syracuse, New York",
  hours: process.env.NEXT_PUBLIC_HOURS ?? "Tue-Sat 11am-9pm, Sun 12pm-8pm",
  truckSchedule:
    process.env.NEXT_PUBLIC_FOOD_TRUCK_SCHEDULE ?? "Food Truck: Thu-Sat evenings, private events by request",
  cateringAvailability:
    process.env.NEXT_PUBLIC_CATERING_AVAILABILITY ?? "Catering available 7 days with 72-hour lead time"
};

export const orderingLinks = {
  orderOnlineUrl,
  doordashUrl,
  uberEatsUrl,
  grubhubUrl,
  cateringInquiryUrl
};

export const heroContent = {
  eyebrow: "Texas-Style Smokehouse + Premium Catering + Food Truck",
  headline: "Welcome To Backyard BBQ",
  description:
    "Where we serve mouthwatering smoked meats, premium sides, and warm hospitality in a cinematic atmosphere.",
  primaryCta: {
    label: "Order Online",
    href: orderOnlineUrl
  },
  secondaryCta: {
    label: "Book Catering",
    href: cateringInquiryUrl
  },
  ...(featureFlags.isDineInEnabled && {
    tertiaryCta: {
      label: "Reserve A Table",
      href: "/reserve"
    }
  })
};

export const menuItems = [
  {
    name: "Smoked Brisket",
    description: "16-hour oak-smoked prime brisket with black pepper bark.",
    price: "$24",
    image: menuImages.brisket
  },
  {
    name: "BBQ Rib Plate",
    description: "Sticky lacquered ribs with charred corn and pit beans.",
    price: "$22",
    image: menuImages.ribs
  },
  {
    name: "Pulled Pork Sandwich",
    description: "Hand-pulled pork shoulder, slaw, and ember aioli brioche.",
    price: "$16",
    image: menuImages.pulledPork
  },
  {
    name: "Loaded Mac Bowl",
    description: "Smoked gouda mac with burnt ends and crispy onions.",
    price: "$18",
    image: menuImages.loadedMac
  },
  {
    name: "Burnt Ends",
    description: "Caramelized brisket cubes kissed by hickory smoke.",
    price: "$19",
    image: menuImages.burntEnds
  },
  {
    name: "Smoked Wings",
    description: "Crisp smoked wings tossed in chili-honey glaze.",
    price: "$15",
    image: menuImages.wings
  }
] as const;

export const testimonials = [
  {
    quote:
      "Best brisket I've ever had. Tender, smoky, and served with concierge-level hospitality for our corporate retreat.",
    name: "Alyssa M.",
    role: "Operations Director"
  },
  {
    quote:
      "They catered our wedding for 220 guests and every tray looked premium. Guests still talk about the burnt ends.",
    name: "Jordan and Reese",
    role: "Wedding Clients"
  },
  {
    quote:
      "Food truck service was fast, polished, and wildly good. Perfect for festival traffic and late-night cravings.",
    name: "Marco V.",
    role: "Event Producer"
  }
] as const;

export { galleryImages };

export const featureHighlights = [
  "Smoked fresh every day in small batches",
  "Prime meats and handcrafted house sauces",
  "Authentic oak and hickory wood-fired flavor",
  "Wedding, corporate, and private event specialists"
] as const;

export const cateringHighlights = [
  "Wedding receptions and rehearsal dinners",
  "Corporate lunches, launches, and retreats",
  "Private celebrations and backyard festivals",
  "Full-service food truck and on-site pit experience"
] as const;

export const whyUsContent = {
  eyebrow: "Why Us",
  headline: "We Offer The Best BBQ In Syracuse",
  description:
    "We offer the best BBQ in Syracuse, serving tender, smoky meats and flavorful sides in a welcoming atmosphere.",
  highlights: [
    "High Quality Meat",
    "Organic Meat and Ingredients",
    "Exceptional Service"
  ] as const
};

export const socialLinks = {
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://instagram.com/backyardbbqking",
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "https://facebook.com/backyardbbqking",
  x: process.env.NEXT_PUBLIC_X_URL ?? "https://x.com/backyardbbqking"
};
