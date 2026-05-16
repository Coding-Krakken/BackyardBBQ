// Shared configuration constants for the web app

export const TAX_RATE = 0.08; // 8% sales tax

export const CATEGORIES = [
  { value: 'mains', label: 'Mains / Platters' },
  { value: 'sandwiches', label: 'Sandwiches' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'combos', label: 'Combos / Specials' },
  { value: 'kids', label: 'Kids Menu' }
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];
