export type MarketingImage = {
  src: string;
  alt: string;
};

export const siteImages = {
  hero: {
    src: "/images/marketing/hero.jpg",
    alt: "Smoked brisket over a hot grill with fire and smoke"
  },
  story: {
    src: "/images/marketing/story.jpg",
    alt: "Pitmaster preparing smoked meats in a dimly lit kitchen"
  },
  imageBreak: {
    src: "/images/marketing/image-break.jpg",
    alt: "Closeup sliced brisket with bark and smoke"
  },
  catering: {
    src: "/images/marketing/catering.jpg",
    alt: "Upscale catering table with barbecue trays and warm lighting"
  },
  whyUsLeft: {
    src: "/images/marketing/why-us-left.jpg",
    alt: "BBQ platter with grilled meats and sides"
  },
  whyUsRight: {
    src: "/images/marketing/why-us-right.jpg",
    alt: "Rustic restaurant interior with warm cinematic lighting"
  },
  finalCta: {
    src: "/images/marketing/final-cta.jpg",
    alt: "Restaurant dining ambiance with warm cinematic lighting"
  }
} satisfies Record<string, MarketingImage>;

export const menuImages = {
  brisket: {
    src: "/images/marketing/menu-brisket.jpg",
    alt: "Sliced smoked brisket on a wooden board"
  },
  ribs: {
    src: "/images/marketing/menu-ribs.jpg",
    alt: "Barbecue ribs glazed with sauce"
  },
  pulledPork: {
    src: "/images/marketing/menu-pulled-pork.jpg",
    alt: "Pulled pork sandwich with slaw"
  },
  loadedMac: {
    src: "/images/marketing/menu-loaded-mac.jpg",
    alt: "Creamy mac bowl topped with smoked meat"
  },
  burntEnds: {
    src: "/images/marketing/menu-burnt-ends.jpg",
    alt: "Burnt ends on a platter with smoke"
  },
  wings: {
    src: "/images/marketing/menu-wings.jpg",
    alt: "Smoked chicken wings in a dark moody setting"
  }
} satisfies Record<string, MarketingImage>;

export const galleryImages = [
  {
    src: "/images/marketing/gallery-1.jpg",
    alt: "Sliced brisket and sides on a platter"
  },
  {
    src: "/images/marketing/gallery-2.jpg",
    alt: "Food truck kitchen lights and smoked meats"
  },
  {
    src: "/images/marketing/gallery-3.jpg",
    alt: "Flames rising under grill grates"
  },
  {
    src: "/images/marketing/gallery-4.jpg",
    alt: "Barbecue board with ribs and brisket"
  },
  {
    src: "/images/marketing/gallery-5.jpg",
    alt: "Catering trays arranged for a private event"
  },
  {
    src: "/images/marketing/gallery-6.jpg",
    alt: "Outdoor dining with premium rustic mood"
  }
] as const;
