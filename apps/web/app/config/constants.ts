// Shared configuration constants for the web app

export const TAX_RATE = 0.08; // 8% sales tax

export const CATEGORIES = [
  { value: 'brisket', label: 'Brisket' },
  { value: 'ribs', label: 'Ribs' },
  { value: 'pulled-pork', label: 'Pulled Pork' },
  { value: 'chicken', label: 'Chicken' },
  { value: 'sides', label: 'Sides' },
  { value: 'platters', label: 'Platters' },
  { value: 'family-meals', label: 'Family Meals' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'catering-friendly', label: 'Catering-Friendly' }
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

export const MENU_BADGES = {
  spicy: 'Spicy',
  glutenConscious: 'Gluten-Conscious',
  popular: 'Popular',
  pitmasterFavorite: 'Pitmaster Favorite'
} as const;

export type MenuBadge = (typeof MENU_BADGES)[keyof typeof MENU_BADGES];
