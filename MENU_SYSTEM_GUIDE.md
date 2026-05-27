# Full Menu System - Implementation Guide

## 🎯 Overview

Complete database-driven menu system with shopping cart, admin management, and dynamic checkout integration for Backyard BBQ King.

---

## 📊 System Components

### 1. Database Schema
**Location:** `packages/database/prisma/schema.prisma`

**MenuItem Model Fields:**
- `id` - Unique identifier
- `name` - Item name (e.g., "Smoked Brisket")
- `description` - Full item description
- `basePriceCents` - Base price in cents (e.g., 2400 = $24.00)
- `imageUrl` - URL to item image (Unsplash or custom)
- `category` - One of: mains, sandwiches, sides, drinks, desserts, combos, kids
- `sortOrder` - Display order within category (0-999)
- `customizations` - JSON array: `[{name: "Extra Sauce", priceCents: 100}]`
- `notes` - Admin notes/internal description
- `isFeatured` - Boolean flag for homepage display
- `isAvailable` - Boolean flag for visibility
- `locationId` - Associated location

### 2. Admin Dashboard
**Route:** `/dashboard/menu`

**Features:**
- Create, edit, delete menu items
- Image URL input with live preview
- Category dropdown (7 categories)
- Sort order controls
- Dynamic customizations editor
- Featured flag checkbox
- Availability toggle
- Category filtering in table view

**API Endpoints:**
- `GET /api/admin/menu/items` - List all items
- `POST /api/admin/menu/items` - Create new item
- `PUT /api/admin/menu/items/[id]` - Update item
- `DELETE /api/admin/menu/items/[id]` - Delete item
- `PATCH /api/admin/menu/items/[id]` - Toggle availability

### 3. Customer Menu Page
**Route:** `/menu`

**Features:**
- Server-side rendered menu from database
- Category navigation with sticky positioning
- Responsive grid layout (desktop) / single column (mobile)
- Click any item to open detail modal
- Modal includes:
  - Large image display
  - Full description
  - Customization options (checkboxes with price additions)
  - Special instructions textarea
  - Quantity selector
  - Dynamic price calculation
  - Add to cart button

**Components:**
- `apps/web/app/menu/page.tsx` - Server component
- `apps/web/app/menu/MenuClient.tsx` - Client interactivity
- `apps/web/app/components/menu/MenuItemCard.tsx` - Item card
- `apps/web/app/components/menu/MenuItemModal.tsx` - Detail modal
- `apps/web/app/components/menu/CategoryNav.tsx` - Category navigation

### 4. Shopping Cart System
**Routes:** 
- Cart drawer (slide-out panel)
- `/cart` - Full cart page

**Features:**
- Add items with customizations and notes
- Persistent storage in localStorage
- Quantity controls (+/-)
- Remove items
- Real-time totals:
  - Subtotal
  - Estimated tax (8% configurable)
  - Estimated total
- Cart icon in navbar with item count badge
- "View Cart" and "Checkout" buttons

**Components:**
- `apps/web/app/components/cart/CartContext.tsx` - State management
- `apps/web/app/components/cart/CartProvider.tsx` - Provider wrapper
- `apps/web/app/components/cart/CartDrawer.tsx` - Slide-out panel
- `apps/web/app/components/cart/CartIcon.tsx` - Navbar icon
- `apps/web/app/components/cart/CartItem.tsx` - Individual item display
- `apps/web/app/cart/page.tsx` - Full cart page

**State Management:**
- React Context API + useReducer
- Actions: ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, CLEAR_CART, TOGGLE_CART
- Computed values: subtotalCents, estimatedTaxCents, estimatedTotalCents, itemCount

### 5. Checkout Integration
**Route:** `/checkout`

**Features:**
- Dynamic pricing from cart
- Order summary with all items, customizations, notes
- Finalized totals (subtotal, tax, total)
- Stripe payment integration
- Empty cart redirect to /menu
- Cart metadata passed to PaymentIntent

**Updates:**
- Replaced hardcoded $32.00 with cart total
- Shows complete order breakdown
- Tax calculated server-side for security
- "Edit Cart" and "Keep Shopping" links

### 6. Homepage Featured Section
**Route:** `/` (homepage)
**Component:** `FeaturedMenuSection`

**Features:**
- Pulls items with `isFeatured: true` from database
- Displays up to 4 featured items
- Maintains existing animation pattern
- "View Full Menu" button links to `/menu`
- Click item for detail modal

### 7. Navigation Updates
**Component:** `SiteNavbar`

**Changes:**
- "Menu" link changed from `/#menu` to `/menu`
- Cart icon added with live item count badge
- Responsive mobile menu

---

## 🗂️ Categories

The system supports 7 menu categories:

1. **mains** - Mains/Platters (brisket, ribs, pulled pork, etc.)
2. **drinks** - Drinks (tea, water, soda options)
3. **meats** - Smoked meats and protein plates
4. **sides** - Sides (mac & cheese, coleslaw, beans, etc.)

---

## 🌱 Database Seeding

**Seed Script:** `packages/database/prisma/seed-menu.ts`

**Seeded Data:**
- 37 menu items total
- 3 combos (all featured)
- 16 meats (featured: Brisket, Beef Ribs, Pork Ribs)
- 10 sides (featured: Mac & Cheese, Baked Beans)
- 8 drinks

**Run Seed:**
```bash
npx tsx packages/database/prisma/seed-menu.ts
```

**What It Does:**
1. Creates a default location if none exists
2. Clears existing menu items for that location
3. Creates all 37 items with:
   - Proper categorization
   - Sort ordering
   - High-quality Unsplash image URLs
   - Customization options where applicable
   - Featured flags where applicable

---

## ⚙️ Configuration

**Tax Rate:** `apps/web/app/config/constants.ts`
```typescript
export const TAX_RATE = 0.08; // 8%
```

**Categories:** `apps/web/app/config/constants.ts`
```typescript
export const CATEGORIES = [
  { value: 'combos', label: 'Combos' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'meats', label: 'Meats' },
  { value: 'sides', label: 'Sides' }
];
```

---

## 🧪 Testing Checklist

### Admin Dashboard
- [ ] Create a new menu item
- [ ] Upload/enter image URL and verify preview
- [ ] Select category from dropdown
- [ ] Set sort order
- [ ] Add customizations (multiple entries)
- [ ] Toggle featured flag
- [ ] Save and verify in table
- [ ] Edit existing item
- [ ] Delete item
- [ ] Filter by category

### Menu Page
- [ ] Visit `/menu`
- [ ] Verify all 34 items display
- [ ] Click category navigation
- [ ] Scroll and verify sticky nav
- [ ] Click an item to open modal
- [ ] Select customizations
- [ ] Add special instructions
- [ ] Adjust quantity
- [ ] Verify price calculation
- [ ] Add to cart
- [ ] Verify cart icon updates

### Cart System
- [ ] Add multiple items to cart
- [ ] Open cart drawer
- [ ] Adjust quantities in drawer
- [ ] Remove item from drawer
- [ ] Navigate to `/cart` page
- [ ] Edit quantities on cart page
- [ ] Verify subtotal calculation
- [ ] Verify tax calculation (8%)
- [ ] Verify total calculation
- [ ] Click "Proceed to Checkout"

### Checkout
- [ ] Verify order summary shows all items
- [ ] Verify customizations display
- [ ] Verify notes display
- [ ] Check subtotal matches cart
- [ ] Check tax is correctly calculated
- [ ] Check total is correct
- [ ] Verify Stripe amount matches total
- [ ] Test "Edit Cart" link
- [ ] Test empty cart redirect

### Homepage
- [ ] Verify featured items display
- [ ] Check that only items with `isFeatured: true` show
- [ ] Click featured item for modal
- [ ] Click "View Full Menu" button
- [ ] Verify it links to `/menu`

### Navigation
- [ ] Click "Menu" in navbar
- [ ] Verify it goes to `/menu` (not `/#menu`)
- [ ] Verify cart icon shows correct count
- [ ] Add/remove items and watch count update
- [ ] Click cart icon to open drawer
- [ ] Test on mobile (hamburger menu)

---

## 🚀 Deployment

### Prerequisites
- Database with MenuItem table migrated
- Run seed script to populate menu
- Environment variables configured:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`

### Steps
1. **Push to GitHub:**
   ```bash
   git push origin main
   ```
   ✅ Already done!

2. **Vercel Auto-Deploy:**
   - Vercel watches `main` branch
   - Deployment triggers automatically
   - Monitor at: https://vercel.com/dashboard

3. **Verify Production:**
   - Visit production `/menu` page
   - Test cart flow end-to-end
   - Verify Stripe checkout works
   - Test admin dashboard CRUD

---

## 📈 Future Enhancements

### Potential Additions (Out of Current Scope)
- [ ] File upload for images (vs URL entry)
- [ ] User accounts and order history
- [ ] Real-time inventory tracking
- [ ] Kitchen display system (KDS)
- [ ] Advanced customization types (radio groups, required vs optional)
- [ ] Menu item analytics (most popular, etc.)
- [ ] Seasonal/limited-time item scheduling
- [ ] Bulk pricing for catering
- [ ] Nutrition information
- [ ] Allergen tags

---

## 🐛 Troubleshooting

### Cart Not Persisting
- Check browser localStorage is enabled
- Key used: `bbq-cart`
- Clear localStorage if corrupted

### Images Not Loading
- Verify imageUrl is valid
- Check Unsplash URLs are accessible
- Consider adding placeholder image fallback

### Checkout Amount Mismatch
- Verify TAX_RATE constant is same in client and server
- Check cart items have valid basePriceCents
- Ensure customizations priceCents are numeric

### Menu Items Not Showing
- Run seed script: `npx tsx packages/database/prisma/seed-menu.ts`
- Check `isAvailable: true` in database
- Verify locationId matches

---

## 📞 Support

For questions or issues:
- Review this guide
- Check `/docs` folder for additional documentation
- Review commit: `feat: implement complete database-driven menu system`
- Contact: david@backyardbbqking.com

---

**Created:** May 15, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
