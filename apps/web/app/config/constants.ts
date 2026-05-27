// Shared configuration constants for the web app

export const TAX_RATE = 0.08; // 8% sales tax

export const CATEGORIES = [
  { value: 'combos', label: 'Combos' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'meats', label: 'Meats' },
  { value: 'sides', label: 'Sides' }
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

export const MENU_BADGES = {
  spicy: 'Spicy',
  glutenConscious: 'Gluten-Conscious',
  popular: 'Popular',
  pitmasterFavorite: 'Pitmaster Favorite'
} as const;

export type MenuBadge = (typeof MENU_BADGES)[keyof typeof MENU_BADGES];
