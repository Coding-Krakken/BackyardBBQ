export type MarketingImage = {
  src: string;
  alt: string;
};

export const siteImages = {
  hero: {
    src: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=2400&q=80",
    alt: "Smoked brisket over a hot grill with fire and smoke"
  },
  story: {
    src: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=80",
    alt: "Pitmaster preparing smoked meats in a dimly lit kitchen"
  },
  imageBreak: {
    src: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=2200&q=80",
    alt: "Closeup sliced brisket with bark and smoke"
  },
  catering: {
    src: "https://images.pexels.com/photos/5779365/pexels-photo-5779365.jpeg?auto=compress&cs=tinysrgb&w=1800",
    alt: "Upscale catering table with barbecue platters and warm lighting"
  },
  whyUsLeft: {
    src: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80",
    alt: "BBQ platter with grilled meats and sides"
  },
  whyUsRight: {
    src: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
    alt: "Rustic restaurant interior with warm cinematic lighting"
  },
  finalCta: {
    src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2200&q=80",
    alt: "Restaurant dining ambiance with warm cinematic lighting"
  }
} satisfies Record<string, MarketingImage>;

export const menuImages = {
  brisket: {
    src: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80",
    alt: "Sliced smoked brisket on a wooden board"
  },
  ribs: {
    src: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    alt: "Barbecue ribs glazed with sauce"
  },
  pulledPork: {
    src: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=1200&q=80",
    alt: "Pulled pork sandwich with slaw"
  },
  loadedMac: {
    src: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
    alt: "Creamy mac bowl topped with smoked meat"
  },
  burntEnds: {
    src: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
    alt: "Burnt ends on a platter with smoke"
  },
  wings: {
    src: "https://images.pexels.com/photos/410648/pexels-photo-410648.jpeg?auto=compress&cs=tinysrgb&w=1200",
    alt: "Smoked chicken wings in a dark moody setting"
  }
} satisfies Record<string, MarketingImage>;

export const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
    alt: "Sliced brisket and sides on a platter"
  },
  {
    src: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80",
    alt: "Food truck kitchen lights and smoked meats"
  },
  {
    src: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
    alt: "Flames rising under grill grates"
  },
  {
    src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    alt: "Barbecue board with ribs and brisket"
  },
  {
    src: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1200&q=80",
    alt: "Catering trays arranged for a private event"
  },
  {
    src: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=80",
    alt: "Outdoor dining with premium rustic mood"
  }
] as const;
