# Dine-In Feature Flag Implementation Summary

## Overview
Implemented `NEXT_PUBLIC_ENABLE_DINE_IN` environment variable to gate all brick-and-mortar restaurant features while preserving the code for future re-enable. Default is OFF (food truck + catering only).

## Changes Made

### 1. Feature Flag Configuration
**File**: `apps/web/app/config/content.ts`
- Added `featureFlags` export with `isDineInEnabled` flag
- Conditionally includes `tertiaryCta` (Reserve A Table) in `heroContent` only when enabled

### 2. Navigation Components
**Files**:
- `apps/web/app/components/SiteNavbar.tsx` - Filters reserve links from desktop and mobile nav
- `apps/web/app/components/MobileBottomBar.tsx` - Hides reserve tab, adjusts grid columns
- `apps/web/app/components/HomeSections.tsx` - Gates reserve CTAs and updates "How It Works" section

### 3. Route Protection
**Files**:
- `apps/web/app/reserve/page.tsx` - Redirects to `/` when flag is OFF
- `apps/web/app/api/reservations/route.ts` - Returns 403 error when flag is OFF

### 4. Content Updates
**Files**:
- `apps/web/app/menu/page.tsx` - Conditional text: "dine-in, takeout, and catering" vs "takeout and catering"
- `apps/web/app/dashboard/support/page.tsx` - Shows food truck schedule + catering availability instead of restaurant hours
- `apps/web/app/components/HomeSections.tsx` - Hides FinalCtaSection entirely when OFF, filters reserve step from HowItWorksSection

### 5. SEO & Schema
**File**: `apps/web/app/layout.tsx`
- Conditional `@type`: `["Restaurant", "LocalBusiness"]` when ON, `["LocalBusiness"]` when OFF
- Omits `openingHoursSpecification` when OFF

### 6. Testing
**File**: `e2e/reservation.web.spec.ts`
- Test skips automatically when `NEXT_PUBLIC_ENABLE_DINE_IN !== "true"`

## Environment Variable

Add to your `.env.local` or deployment environment:

```bash
# Default (food truck + catering only)
NEXT_PUBLIC_ENABLE_DINE_IN=false

# Enable dine-in features
NEXT_PUBLIC_ENABLE_DINE_IN=true
```

## Verification Checklist

### With Flag OFF (default):
- [ ] No reserve links in header, mobile nav, mobile bottom bar, footer
- [ ] Homepage hero shows only 2 CTAs (Order, Catering)
- [ ] "How It Works" section shows 2 steps instead of 3
- [ ] FinalCtaSection (Reserve Your Table) is completely hidden
- [ ] Menu page says "takeout and catering" only
- [ ] `/reserve` redirects to `/`
- [ ] POST to `/api/reservations` returns 403 forbidden
- [ ] Support page shows food truck schedule instead of restaurant hours
- [ ] JSON-LD schema uses `LocalBusiness` type without opening hours

### With Flag ON:
- [ ] Reserve links appear in all navigation areas
- [ ] Homepage hero shows 3 CTAs
- [ ] "How It Works" shows 3 steps including Reserve
- [ ] FinalCtaSection renders
- [ ] Menu page says "dine-in, takeout, and catering"
- [ ] `/reserve` page loads normally
- [ ] POST to `/api/reservations` accepts submissions
- [ ] Support page shows restaurant hours
- [ ] JSON-LD schema uses `Restaurant` type with opening hours
- [ ] Reservation e2e test runs

## Files Modified
1. `apps/web/app/config/content.ts`
2. `apps/web/app/components/SiteNavbar.tsx`
3. `apps/web/app/components/MobileBottomBar.tsx`
4. `apps/web/app/components/HomeSections.tsx`
5. `apps/web/app/reserve/page.tsx`
6. `apps/web/app/api/reservations/route.ts`
7. `apps/web/app/menu/page.tsx`
8. `apps/web/app/layout.tsx`
9. `apps/web/app/dashboard/support/page.tsx`
10. `e2e/reservation.web.spec.ts`

## Notes
- This is a **build-time** flag. Changing it requires a rebuild/redeploy.
- All reservation code remains intact for future re-enable.
- Catering functionality is completely unaffected.
- Default behavior is OFF to prevent accidental exposure of dine-in features.
