<p align="center">
  <br/>
  <strong style="font-size:2em;">🔥 BACKYARD BBQ KING 🔥</strong>
  <br/><br/>
  <em>Premium Texas-Style Smokehouse & Catering</em>
  <br/><br/>
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  <br/><br/>
  <strong>OWNER'S WELCOME PACKET</strong>
  <br/>
  <em>Complete Guide to Your Website, Admin Dashboard & Business Operations</em>
  <br/><br/>
  <code>Version 1.0 — May 2026</code>
  <br/>
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
</p>

<br/>

---

<br/>

# 📋 Table of Contents

| # | Section | Page |
|---|---------|------|
| 1 | [Your Live Websites](#1--your-live-websites) | Quick-access links |
| 2 | [How Your Website Works — The Big Picture](#2--how-your-website-works--the-big-picture) | Overview |
| 3 | [Your Menu](#3--your-menu) | Full menu breakdown |
| 4 | [How Customers Order](#4--how-customers-order) | Step-by-step ordering flow |
| 5 | [Catering & Event Bookings](#5--catering--event-bookings) | Booking flow & pricing |
| 6 | [Payments, Tax & Tips](#6--payments-tax--tips) | How money moves |
| 7 | [Customer Accounts & Loyalty](#7--customer-accounts--loyalty) | Profiles, referrals, saved cards |
| 8 | [The Admin Dashboard — Your Control Center](#8--the-admin-dashboard--your-control-center) | Full admin guide |
| 9 | [Staff Roles & Permissions](#9--staff-roles--permissions) | Who can do what |
| 10 | [Managing Your Menu](#10--managing-your-menu) | Add, edit, remove items |
| 11 | [Handling Payments & Refunds](#11--handling-payments--refunds) | Processing & disputes |
| 12 | [Analytics & Reporting](#12--analytics--reporting) | Revenue, trends, insights |
| 13 | [Accounting & Reconciliation](#13--accounting--reconciliation) | Books & finalization |
| 14 | [Your Third-Party Accounts](#14--your-third-party-accounts) | Stripe, Vercel, Database |
| 15 | [Business Contact Info on Your Site](#15--business-contact-info-on-your-site) | Hours, phone, socials |
| 16 | [Locations](#16--locations) | Truck & Smokehouse |
| 17 | [Notifications & Alerts](#17--notifications--alerts) | System alerts |
| 18 | [Frequently Asked Questions](#18--frequently-asked-questions) | Common questions |
| 19 | [Glossary](#19--glossary) | Key terms explained |
| 20 | [Support & Contact](#20--support--contact) | Getting help |

<br/>

---

<br/>

# 1 · Your Live Websites

Your business has **three** live websites, each serving a different purpose:

<br/>

| Website | Link | What It's For |
|---------|------|---------------|
| **Customer Website** | **https://backyard-bbq.vercel.app** | Your public-facing site — customers browse the menu, place orders, book catering, and manage their accounts here. |
| **Admin Dashboard** | **https://backyard-bbq-admin.vercel.app** | Your private operations hub — manage orders, payments, menu items, bookings, analytics, and staff from here. |
| **API Backend** | https://backyard-bbq-backend.vercel.app | The behind-the-scenes engine that powers payments and webhooks. You don't need to visit this directly — it runs automatically. |

> **Bookmark the Customer Website and Admin Dashboard** — those are the two you'll use every day.

<br/>

---

<br/>

# 2 · How Your Website Works — The Big Picture

Here's a simple overview of how everything connects:

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR CUSTOMERS                       │
│          Browse Menu → Add to Cart → Pay                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              CUSTOMER WEBSITE                           │
│    backyard-bbq.vercel.app                              │
│                                                         │
│    • Menu with all items, photos & prices               │
│    • Shopping cart with tax calculation                  │
│    • Secure checkout (Stripe)                           │
│    • Catering request & deposit payment                 │
│    • Customer accounts, saved cards, order history       │
│    • Referral rewards program                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              STRIPE (Payment Processor)                 │
│                                                         │
│    • Securely processes all credit card payments         │
│    • Stores saved payment methods                       │
│    • Handles refunds                                    │
│    • Manages disputes & chargebacks                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ADMIN DASHBOARD                            │
│    backyard-bbq-admin.vercel.app                        │
│                                                         │
│    • View & manage incoming orders                      │
│    • Track payments & issue refunds                     │
│    • Manage catering bookings                           │
│    • Edit menu items & prices                           │
│    • View analytics & revenue reports                   │
│    • Handle disputes                                    │
│    • Manage staff access                                │
└─────────────────────────────────────────────────────────┘
```

**In plain English:** Customers visit your website, browse the menu, add items to their cart, and pay securely through Stripe. You see all of this in your Admin Dashboard, where you manage orders, update your menu, track revenue, and handle any issues.

<br/>

---

<br/>

# 3 · Your Menu

Your menu is organized into **7 categories** with **34 items** total. Every item has a name, description, price, photo, and optional add-ons.

<br/>

## 🥩 Mains / Platters

| Item | Price | Featured? |
|------|-------|-----------|
| Smoked Brisket | $24.00 | ⭐ Yes |
| BBQ Rib Plate | $22.00 | ⭐ Yes |
| Pulled Pork Platter | $18.00 | ⭐ Yes |
| Smoked Chicken Quarter | $14.00 | |
| Smoked Turkey Breast | $16.00 | |
| Sausage Link Plate | $13.00 | |
| BBQ Combo Platter | $28.00 | ⭐ Yes |

## 🥪 Sandwiches

| Item | Price | Available Add-Ons |
|------|-------|-------------------|
| Pulled Pork Sandwich | $16.00 | Add cheese (+$1.50), Extra meat (+$4.00) |
| Brisket Sandwich | $18.00 | Add cheese (+$1.50), Extra meat (+$5.00) |
| Chicken Sandwich | $14.00 | — |
| Sausage Po'Boy | $15.00 | — |
| Burnt Ends Sandwich | $19.00 | — |

## 🥗 Sides

| Item | Price | Featured? |
|------|-------|-----------|
| Loaded Mac & Cheese | $8.00 | ⭐ Yes |
| Classic Coleslaw | $5.00 | |
| Pit Beans | $6.00 | |
| Cornbread | $4.00 | |
| Collard Greens | $6.00 | |
| Potato Salad | $5.00 | |
| Fried Okra | $6.00 | |

## 🥤 Drinks

| Item | Price | Available Add-Ons |
|------|-------|-------------------|
| Sweet Tea | $3.00 | Unsweetened option, Extra lemon (+$0.50) |
| Fresh Lemonade | $3.50 | — |
| Craft Root Beer | $4.00 | — |
| Bottled Water | $2.00 | — |
| Arnold Palmer | $3.50 | — |

## 🍰 Desserts

| Item | Price |
|------|-------|
| Banana Pudding | $7.00 |
| Peach Cobbler | $8.00 |
| Pecan Pie Slice | $7.50 |
| Chocolate Brownie | $6.00 |

## 🎉 Combos / Specials

| Item | Price | Serves |
|------|-------|--------|
| 2-Meat Combo | $22.00 | 1 person |
| Family Pack | $55.00 | 4–6 people |
| Tailgate Pack | $75.00 | 6–8 people |

## 🧒 Kids Menu

| Item | Price |
|------|-------|
| Kids Pulled Pork | $9.00 |
| Kids Chicken Tenders | $8.50 |
| Kids Mac & Cheese Bowl | $8.00 |

<br/>

> **Featured items** (marked with ⭐) appear on the homepage to catch customer attention. You can change which items are featured at any time from the Admin Dashboard.

<br/>

---

<br/>

# 4 · How Customers Order

There are two ways customers can place an order on your site:

<br/>

## 🛒 Guest Checkout (No Account Required)

Customers don't need to create an account to order. Here's what they experience:

```
  Step 1                Step 2               Step 3               Step 4
┌──────────┐       ┌──────────────┐     ┌───────────────┐    ┌──────────────┐
│  Browse  │──────▶│  Add Items   │────▶│  View Cart    │───▶│   Checkout   │
│   Menu   │       │  to Cart     │     │  & Review     │    │  (Pay Now)   │
└──────────┘       └──────────────┘     └───────────────┘    └──────┬───────┘
                                                                    │
                                                                    ▼
                                                             ┌──────────────┐
                                                             │ Confirmation │
                                                             │    Page      │
                                                             └──────────────┘
```

1. **Browse the Menu** — Customers visit `/menu` and browse by category
2. **Add to Cart** — They tap an item, choose any add-ons, and add it to their cart
3. **Review Cart** — They see their items, subtotal, tax (8%), and total
4. **Checkout** — A secure Stripe payment form appears. They enter card info and pay
5. **Confirmation** — They see an order confirmation with their order number

<br/>

## 👤 Logged-In Checkout (With Account)

If a customer creates an account, they get extra perks:

- **Saved Payment Methods** — Pay with a card on file in one click
- **Order History** — See all past orders and reorder favorites
- **Referral Rewards** — Earn credit by referring friends
- **Catering Bookings** — Track booking status and payments
- **Profile & Preferences** — Save dietary preferences, addresses, and notification settings

The checkout flow is the same — but faster because their card is already saved.

<br/>

---

<br/>

# 5 · Catering & Event Bookings

Your website offers a full catering request and booking system for events.

<br/>

## How It Works for Customers

```
  Request               Review               Deposit              Event Day
┌───────────┐       ┌──────────────┐     ┌───────────────┐    ┌──────────────┐
│  Fill Out  │──────▶│  You Review  │────▶│  Customer     │───▶│   Final      │
│  Catering  │       │  & Approve   │     │  Pays 30%     │    │   Payment    │
│  Form      │       │  (Admin)     │     │  Deposit      │    │   Collected  │
└───────────┘       └──────────────┘     └───────────────┘    └──────────────┘
```

1. **Customer submits a request** at `/catering` with:
   - Event date
   - Party size (number of guests)
   - Package selection (Classic Smokehouse, Pitmaster Signature, or Premium)
   - Event address
   - Special notes or dietary requirements

2. **You review the request** in the Admin Dashboard under **Bookings**

3. **If approved**, the customer receives notification to pay a **30% deposit**

4. **After the event**, the remaining **70% balance** is collected

<br/>

## Catering Pricing

Your catering pricing automatically adjusts based on party size:

| Party Size | Price Per Guest | Example (100 guests) |
|------------|----------------|----------------------|
| 1 – 49 guests | $25.00 / person | — |
| 50 – 99 guests | $23.50 / person | — |
| 100 – 149 guests | $22.00 / person | $2,200.00 |
| 150+ guests | $21.00 / person | — |

> **Premium Package Pricing:** If a customer selects a Premium package, a **1.2× multiplier** is applied to the base price.
>
> *Example: 100 guests × $22.00 × 1.2 = $2,640.00 total, with a $792.00 deposit (30%).*

<br/>

## Catering Capacity

| Location | Maximum Catering Capacity |
|----------|--------------------------|
| BBQ Truck | Up to 250 guests |
| Smokehouse | Up to 500 guests |

<br/>

## Booking Status Flow

Every catering booking goes through these stages:

| Status | What It Means |
|--------|---------------|
| **Draft** | Customer started a request but hasn't submitted it |
| **Pending Approval** | Request submitted — waiting for you to review it in the Admin Dashboard |
| **Approved** | You approved it — customer can now pay the deposit |
| **Declined** | You declined the request |
| **Cancelled** | The booking was cancelled (by you or the customer) |

<br/>

---

<br/>

# 6 · Payments, Tax & Tips

<br/>

## 💳 How Payments Work

All payments are processed securely through **Stripe** — one of the world's most trusted payment processors (used by Amazon, Google, Shopify, and millions of businesses).

**What this means for you:**
- You never see or store customer credit card numbers — Stripe handles all sensitive data
- Payments are PCI-compliant (meets the highest security standards for card data)
- Funds are deposited directly into your connected bank account via Stripe
- You can view all transactions in both the Admin Dashboard and your Stripe account

<br/>

## 🧾 Sales Tax

**Your current tax rate: 8%**

Tax is automatically calculated on every order:

| Component | Example |
|-----------|---------|
| Subtotal (food items) | $50.00 |
| Sales Tax (8%) | $4.00 |
| Tip (optional) | $7.50 |
| **Total Charged** | **$61.50** |

- Tax is calculated server-side (not in the browser) so it's always accurate
- The tax rate can be updated if your local tax rate changes — contact your developer
- Tax is displayed to the customer before they pay, so there are no surprises

<br/>

## 💰 Tips

- Customers can add an optional tip at checkout
- Tips are captured separately from the food total
- Tip amounts are tracked on every order and visible in the Admin Dashboard
- Tips are included in the total charge to the customer's card

<br/>

## 💵 Where the Money Goes

```
Customer Pays $61.50
        │
        ▼
   ┌─────────┐
   │  Stripe  │ ──── Stripe takes a small processing fee (~2.9% + $0.30 per transaction)
   └────┬────┘
        │
        ▼
  Your Bank Account ──── Remaining balance deposited (typically next business day)
```

> **Stripe's standard fee:** 2.9% + $0.30 per successful card charge. This is industry standard and is automatically deducted before the funds reach your bank account. You can see the exact fees in your Stripe Dashboard.

<br/>

---

<br/>

# 7 · Customer Accounts & Loyalty

<br/>

## Customer Profiles

When customers create an account, they can manage:

| Feature | Description |
|---------|-------------|
| **Personal Info** | Name, email, phone number |
| **Dietary Preferences** | Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut Allergy, Shellfish Allergy, Low Sodium, Keto |
| **Saved Addresses** | Multiple addresses with labels (Home, Work, etc.) and a default address |
| **Saved Payment Methods** | Securely stored credit/debit cards for faster checkout |
| **Order History** | View all past orders with status and details |
| **Quick Reorder** | One-click reorder of favorite past orders |
| **Catering Bookings** | Track all catering requests, statuses, and payments |
| **Notification Preferences** | Choose to receive email and/or SMS for order updates, booking reminders, and promotions |

<br/>

## 🎁 Referral Rewards Program

Your website includes a built-in referral program to help grow your customer base:

**How it works:**

1. Every customer with an account gets a **unique referral code**
2. They share it with friends (via link or email)
3. When a friend **signs up** using that code and **places their first order**, both the referrer and the new customer earn a reward
4. Rewards are **automatically applied** to the referrer's account as credit

**Referral Statuses:**

| Status | Meaning |
|--------|---------|
| **Pending** | Friend hasn't signed up yet |
| **Signed Up** | Friend created an account but hasn't ordered |
| **Rewarded** | Friend placed an order — both parties received their reward! |
| **Expired** | The referral link expired before completion |

> You can view and manage all referrals from the Admin Dashboard under the **Referrals** section.

<br/>

---

<br/>

# 8 · The Admin Dashboard — Your Control Center

The Admin Dashboard is where you run your business. Log in at:

> **https://backyard-bbq-admin.vercel.app**

<br/>

## Logging In

1. Go to the Admin Dashboard URL
2. Enter your **email address** and **password**
3. Click **Sign In**
4. You'll be taken to your dashboard overview

> **Your admin session lasts 8 hours** — after that, you'll need to sign in again. This is a security feature to protect your business data.

<br/>

## Dashboard Overview

When you first log in, you'll see a summary of your business at a glance:

| Widget | What It Shows |
|--------|---------------|
| **Key Metrics** | Total revenue, number of orders, average order value |
| **Pending Orders** | Orders that need your attention |
| **Active Bookings** | Upcoming catering events |
| **Revenue Charts** | Visual graphs of your earnings over time |
| **Order Sources** | Where orders are coming from (website, DoorDash, Uber Eats, etc.) |

<br/>

## Dashboard Sections

Here is every section of your Admin Dashboard and what you can do in each:

<br/>

### 📦 Orders (`/dashboard/orders`)

| Action | How |
|--------|-----|
| **View all orders** | See a list of every order with customer name, total, status, and date |
| **Filter orders** | Filter by status (Pending, Confirmed, Preparing, Ready, Completed, Cancelled) or search by customer |
| **View order details** | Click any order to see the full breakdown — items, customizations, pricing, customer info |
| **Update order status** | Move an order through the workflow as you prepare it |

**Order Status Workflow:**

```
  Pending → Confirmed → Preparing → Ready → Completed
                                              ↘
                                           Cancelled
```

| Status | What It Means |
|--------|---------------|
| **Pending** | Order just came in — hasn't been acknowledged yet |
| **Confirmed** | You've seen it and confirmed it's being worked on |
| **Preparing** | Kitchen is actively preparing the order |
| **Ready** | Order is ready for pickup or delivery |
| **Completed** | Customer has received their order — done! |
| **Cancelled** | Order was cancelled |

<br/>

### 📅 Bookings (`/dashboard/bookings`)

| Action | How |
|--------|-----|
| **View all catering bookings** | See upcoming and past catering requests |
| **Filter by date or status** | Quickly find what you're looking for |
| **Review booking details** | See party size, package, event address, customer info, pricing |
| **Approve or decline requests** | Accept catering requests or decline them with a reason |
| **Track deposit & final payment** | See if the 30% deposit has been paid and if the final balance is collected |

<br/>

### 👥 Customers (`/dashboard/customers`)

| Action | How |
|--------|-----|
| **Search customers** | Search by name or email |
| **View customer profiles** | See their order count, booking count, contact info |
| **View customer order history** | See every order a specific customer has placed |
| **View payment history** | See all payments from a specific customer |

<br/>

### 💳 Payments (`/dashboard/payments`)

| Action | How |
|--------|-----|
| **View all transactions** | See every payment with amount, status, date, and customer |
| **Issue refunds** | Process full or partial refunds (see [Section 11](#11--handling-payments--refunds)) |
| **View payment analytics** | Charts showing payment trends, success rates, and volume |
| **Handle disputes** | Respond to chargebacks and upload evidence (see [Section 11](#11--handling-payments--refunds)) |

<br/>

### 🍖 Menu Management (`/dashboard/menu`)

| Action | How |
|--------|-----|
| **Add new menu items** | Create new dishes with name, description, price, category, and photo |
| **Edit existing items** | Update prices, descriptions, photos, or availability |
| **Remove items** | Delete menu items you no longer offer |
| **Manage add-ons** | Create, edit, or remove customization options (like "Add cheese +$1.50") |
| **Set featured items** | Choose which items appear on the homepage |
| **Toggle availability** | Temporarily mark items as unavailable without deleting them |
| **Change sort order** | Rearrange items within a category |
| **Assign to location** | Set whether an item is available at the Truck, Smokehouse, or both |

> See [Section 10](#10--managing-your-menu) for a detailed step-by-step guide.

<br/>

### 📊 Analytics (`/dashboard/analytics`)

| Feature | Description |
|---------|-------------|
| **Revenue Trends** | Daily and weekly revenue graphs |
| **Top-Selling Items** | Your best-performing menu items |
| **Order Sources** | Breakdown by source: Direct orders, DoorDash, Uber Eats, Grubhub, Catering |
| **Forecasting** | Predictive analytics to help you plan staffing and inventory |
| **Anomaly Detection** | Automatic alerts if something unusual happens (sudden spike or drop in orders) |

<br/>

### 🧮 Accounting (`/dashboard/accounting`)

| Feature | Description |
|---------|-------------|
| **Revenue Summary** | Gross revenue, refunds, and net revenue for any time period |
| **Source Breakdown** | Revenue by order source (Direct, DoorDash, Uber Eats, Grubhub, Catering) |
| **Period Reconciliation** | Match your records against Stripe payments |
| **Finalize Periods** | Lock accounting periods (Owner only) so numbers can't be changed retroactively |

> See [Section 13](#13--accounting--reconciliation) for more details.

<br/>

### 🎁 Referrals (`/dashboard/referrals`)

| Action | How |
|--------|-----|
| **View all referrals** | See every referral code usage with status |
| **Reward referrals** | Manually reward a referral if needed |
| **Expire referrals** | Expire old or invalid referral codes |

<br/>

### ⚙️ Integrations (`/dashboard/integrations`)

| Feature | Description |
|---------|-------------|
| **Service Health** | Monitor the health of connected services (Stripe, database, etc.) |
| **Alerts** | View and manage system alerts |
| **Failed Events** | See and retry any failed webhook events (payments that didn't process correctly) |
| **Webhook Status** | Monitor the status of payment notifications from Stripe |

<br/>

### 🔔 Notifications (`/dashboard/notifications`)

| Feature | Description |
|---------|-------------|
| **System Alerts** | Important notifications about your business operations |
| **Payment Alerts** | Notifications about failed payments, disputes, or unusual activity |

<br/>

---

<br/>

# 9 · Staff Roles & Permissions

You can create accounts for your staff with different levels of access. This keeps your business data secure — kitchen staff don't need to see financial reports, and your accountant doesn't need to manage the menu.

<br/>

## Role Overview

| Role | Best For | What They Can Access |
|------|----------|---------------------|
| **Owner** | You (the business owner) | **Everything** — full access to all features, including accounting finalization and location management |
| **Admin** | Trusted managers or partners | Almost everything — same as Owner except cannot finalize accounting periods or manage locations |
| **Manager** | Shift leads, senior staff | Orders, Bookings, Customers, Menu, and Analytics — no access to payments, accounting, or integrations |
| **Staff** | Kitchen staff, counter staff | Orders and Bookings only — just what they need to prepare and track food |
| **Accounting** | Your bookkeeper or accountant | Payments and Accounting views only — they can see financial data but nothing else |

<br/>

## Detailed Permission Breakdown

| Feature | Owner | Admin | Manager | Staff | Accounting |
|---------|:-----:|:-----:|:-------:|:-----:|:----------:|
| Dashboard Overview | ✅ | ✅ | ✅ | ✅ | ✅ |
| View & Manage Orders | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update Order Status | ✅ | ✅ | ✅ | ✅ | ❌ |
| View & Manage Bookings | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Customers | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Menu Items | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Payments | ✅ | ✅ | ❌ | ❌ | ✅ |
| Issue Refunds | ✅ | ✅ | ❌ | ❌ | ❌ |
| Handle Disputes | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Accounting | ✅ | ✅ | ❌ | ❌ | ✅ |
| Finalize Accounting | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Referrals | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Locations | ✅ | ❌ | ❌ | ❌ | ❌ |

<br/>

> **To add a new staff member:** Contact your developer to create a new admin account with the appropriate role. Staff accounts use a separate login from customer accounts for security.

<br/>

---

<br/>

# 10 · Managing Your Menu

Your menu is fully editable from the Admin Dashboard. Here's how to do common tasks:

<br/>

## Adding a New Menu Item

1. Go to **Menu Management** in the Admin Dashboard (`/dashboard/menu`)
2. Click **Add New Item**
3. Fill in the details:

| Field | What to Enter | Example |
|-------|--------------|---------|
| **Name** | Item name as customers will see it | "Smoked Brisket Tacos" |
| **Description** | Appetizing description | "Three soft tacos filled with our slow-smoked brisket, topped with pickled onions and house slaw" |
| **Price** | The price in dollars | $14.00 |
| **Category** | Which section of the menu | Mains / Platters |
| **Image** | Upload or link to a food photo | High-quality photo recommended |
| **Location** | Which location serves this item | Truck, Smokehouse, or Both |
| **Featured** | Show on the homepage? | Yes / No |
| **Available** | Currently available? | Yes / No |
| **Sort Order** | Position within its category | 1, 2, 3... |

4. Click **Save**

<br/>

## Adding Customizations (Add-Ons)

Some items let customers choose add-ons (like extra cheese or extra meat). To set these up:

1. Open the menu item you want to add customizations to
2. Under **Customizations**, click **Add Customization**
3. Enter the add-on name and price adjustment

| Example | Add-On Name | Price Change |
|---------|-------------|-------------|
| Extra cheese on a sandwich | "Add Cheese" | +$1.50 |
| Double portion of meat | "Extra Meat" | +$5.00 |
| Extra lemon for sweet tea | "Extra Lemon" | +$0.50 |

<br/>

## Editing Prices

1. Go to **Menu Management**
2. Click the item you want to update
3. Change the price
4. Click **Save**

> Price changes take effect immediately on the customer website.

<br/>

## Temporarily Hiding an Item

If you run out of an item for the day:

1. Go to **Menu Management**
2. Find the item
3. Toggle **Available** to **No**
4. The item will disappear from the customer-facing menu
5. Toggle it back to **Yes** when it's available again

> This is better than deleting items — you keep the item data and can bring it back instantly.

<br/>

---

<br/>

# 11 · Handling Payments & Refunds

<br/>

## Viewing Payments

1. Go to **Payments** in the Admin Dashboard
2. You'll see a list of all transactions with:
   - Customer name
   - Amount charged
   - Payment status (Succeeded, Failed, Refunded, etc.)
   - Date and time
3. Click any transaction to see full details

<br/>

## Payment Statuses Explained

| Status | What It Means | Action Needed? |
|--------|---------------|----------------|
| **Succeeded** | Payment went through successfully | ✅ No — all good |
| **Processing** | Payment is being processed | ⏳ Wait — usually resolves in seconds |
| **Failed** | Payment didn't go through | ❌ Customer needs to try again or use a different card |
| **Partially Refunded** | Part of the payment was refunded | ℹ️ Informational |
| **Refunded** | Full payment was refunded | ℹ️ Informational |
| **Cancelled** | Payment was cancelled before completion | ℹ️ Informational |

<br/>

## Issuing a Refund

If a customer needs a refund (wrong order, quality issue, etc.):

1. Go to **Payments** in the Admin Dashboard
2. Find the transaction
3. Click **Refund**
4. Choose:
   - **Full Refund** — returns the entire amount
   - **Partial Refund** — enter the specific amount to refund
5. Select a **reason** (Quality issue, Customer request, Wrong order, etc.)
6. Confirm the refund

> **Refunds typically take 5–10 business days** to appear on the customer's credit card statement. The refund is processed immediately on your end through Stripe.

<br/>

## Handling Disputes (Chargebacks)

A **dispute** (also called a chargeback) happens when a customer contacts their bank to reverse a charge. This is rare, but here's how to handle it:

1. You'll see the dispute in the **Payments** section of the Admin Dashboard
2. Click on the dispute to view details
3. You can **submit evidence** to fight the dispute:
   - Upload any proof of delivery, receipts, or communication
   - Evidence is sent to the customer's bank through Stripe
4. The bank makes a final decision (usually within 60–75 days)

> **Tip:** The best way to avoid disputes is to communicate with unhappy customers directly and offer a refund before they file a chargeback.

<br/>

---

<br/>

# 12 · Analytics & Reporting

Your Admin Dashboard includes powerful analytics to help you understand your business:

<br/>

## What You Can Track

| Metric | Where to Find It |
|--------|-------------------|
| **Total Revenue** | Dashboard overview & Analytics page |
| **Number of Orders** | Dashboard overview |
| **Average Order Value** | Dashboard overview |
| **Revenue Trends** | Analytics → Revenue Trends (daily/weekly charts) |
| **Top-Selling Items** | Analytics → Top Items |
| **Order Sources** | Analytics → Source Breakdown |
| **Revenue Forecast** | Analytics → Forecasting |
| **Unusual Activity** | Analytics → Anomaly Detection |

<br/>

## Order Sources

Your system tracks where orders come from:

| Source | Description |
|--------|-------------|
| **Direct** | Orders placed directly on your website |
| **DoorDash** | Orders from DoorDash |
| **Uber Eats** | Orders from Uber Eats |
| **Grubhub** | Orders from Grubhub |
| **Catering** | Catering bookings |

This helps you understand which channels drive the most business and revenue.

<br/>

---

<br/>

# 13 · Accounting & Reconciliation

The **Accounting** section helps you keep your books in order:

<br/>

## Available Reports

| Report | Description |
|--------|-------------|
| **Gross Revenue** | Total revenue before refunds |
| **Refunds** | Total refunds issued in the period |
| **Net Revenue** | Gross revenue minus refunds |
| **Source Breakdown** | Revenue broken down by order source |
| **Period Reconciliation** | Match your records against actual Stripe payments |

<br/>

## Finalizing Accounting Periods

As the **Owner**, you can "finalize" an accounting period. This locks the numbers for that time frame so they can't be changed retroactively — important for accurate bookkeeping and tax filing.

1. Go to **Accounting**
2. Select the time period
3. Review the numbers
4. Click **Finalize**

> Only the **Owner** role can finalize accounting periods. This is a safeguard to prevent unauthorized changes to financial records.

<br/>

---

<br/>

# 14 · Your Third-Party Accounts

Your website relies on a few trusted services to operate. Here's what they are and why they matter:

<br/>

## 💳 Stripe — Payment Processing

| Detail | Info |
|--------|------|
| **What it does** | Processes all credit card payments, stores customer cards securely, handles refunds and disputes |
| **Website** | https://dashboard.stripe.com |
| **Why you need it** | Without Stripe, your website cannot accept payments |
| **Cost** | 2.9% + $0.30 per successful transaction (industry standard) |
| **Your Dashboard** | Log in at https://dashboard.stripe.com to see all transactions, payouts to your bank, disputes, and more |

**What you can do in the Stripe Dashboard:**
- View all payments and payouts
- See when money will be deposited to your bank
- View Stripe's processing fees
- Manage your bank account connection
- Download financial reports for your accountant
- Respond to disputes (also accessible from your Admin Dashboard)

> **Important:** Your Stripe account is connected to your bank account. Payouts happen automatically (usually next business day). You can adjust the payout schedule in the Stripe Dashboard if needed.

<br/>

## ▲ Vercel — Website Hosting

| Detail | Info |
|--------|------|
| **What it does** | Hosts all three of your websites (Customer, Admin, API) |
| **Website** | https://vercel.com |
| **Why you need it** | This is where your websites live on the internet |
| **Cost** | Depends on your plan — free tier available for small usage, paid plans for production |

> You generally don't need to interact with Vercel directly. Your developer manages deployments and configuration. When code changes are made, the websites automatically update.

<br/>

## 🗄️ PostgreSQL Database

| Detail | Info |
|--------|------|
| **What it does** | Stores all your business data — orders, customers, menu items, bookings, payments |
| **Why you need it** | This is the brain of your operation — all information lives here |

> The database is managed by your developer. You interact with it indirectly through the Admin Dashboard.

<br/>

---

<br/>

# 15 · Business Contact Info on Your Site

The following information is displayed on your customer-facing website. If any of this needs to be updated, contact your developer:

<br/>

| Field | Current Value |
|-------|---------------|
| **Phone** | +1-555-BBQ-KING |
| **Email** | hello@backyardbbqking.com |
| **Location** | Syracuse, New York |
| **Hours (Smokehouse)** | Tue – Sat: 11am – 9pm · Sun: 12pm – 8pm |
| **Food Truck Schedule** | Thu – Sat evenings · Private events by request |
| **Catering Availability** | Available 7 days a week with 72-hour lead time |

<br/>

### Social Media Links

| Platform | Link |
|----------|------|
| **Instagram** | instagram.com/backyardbbqking |
| **Facebook** | facebook.com/backyardbbqking |
| **X (Twitter)** | x.com/backyardbbqking |

> All of these values can be updated without changing code — contact your developer to modify them.

<br/>

---

<br/>

# 16 · Locations

Your business currently operates from two locations:

<br/>

| Location | Type | Catering Capacity |
|----------|------|-------------------|
| **Backyard BBQ King Truck** | Food Truck | Up to 250 guests |
| **Backyard BBQ King Smokehouse** | Brick & Mortar | Up to 500 guests |

Both locations are in the **America/New_York** timezone.

- Menu items can be assigned to a specific location or both
- Catering requests are automatically validated against the location's maximum capacity
- Only the **Owner** role can manage location settings in the Admin Dashboard

<br/>

---

<br/>

# 17 · Notifications & Alerts

Your system sends automatic notifications to keep everyone informed:

<br/>

## Customer Notifications

| Notification | When It's Sent | Channels |
|-------------|----------------|----------|
| **Order Update** | When order status changes (confirmed, ready, etc.) | Email, SMS (if enabled) |
| **Booking Update** | When catering booking is approved/declined | Email, SMS (if enabled) |
| **Payment Confirmation** | When payment is processed | Email |
| **Referral Reward** | When a referral reward is earned | Email |
| **Promotions** | Marketing messages (if customer opted in) | Email |

> Customers can manage their notification preferences in their profile settings.

<br/>

## Admin/System Alerts

| Alert | What It Means |
|-------|---------------|
| **Payment Failure** | A payment failed to process |
| **High Dispute Rate** | More disputes than normal — investigate immediately |
| **High Refund Rate** | More refunds than normal — could indicate a quality issue |
| **Service Health** | A connected service (Stripe, database) may be having issues |
| **Failed Webhook** | A payment notification didn't process correctly (can be retried from Integrations) |

<br/>

---

<br/>

# 18 · Frequently Asked Questions

<br/>

### How do I change a menu item's price?
Go to **Menu Management** in the Admin Dashboard, click the item, update the price, and save. The change takes effect immediately.

<br/>

### Can I add new menu items myself?
Yes! Use the **Menu Management** section of the Admin Dashboard. You'll need the Owner, Admin, or Manager role.

<br/>

### How do I know when a new order comes in?
New orders appear in the **Orders** section of the Admin Dashboard with a "Pending" status. You can also check the Dashboard overview for pending order counts.

<br/>

### How long until I get paid for an order?
Stripe typically deposits funds to your bank account on the **next business day** after the payment. You can check your payout schedule at https://dashboard.stripe.com/payouts.

<br/>

### Can customers order without creating an account?
Yes! Guest checkout is fully supported. Customers can place orders without signing up. However, they won't have access to saved cards, order history, or referral rewards.

<br/>

### What happens if a customer's payment fails?
The order won't go through, and the customer will see an error. They can try again with a different payment method. Failed payments are logged in the Admin Dashboard under Payments.

<br/>

### How do I handle a customer complaint about a charge?
If a customer contacts you directly, you can issue a full or partial refund from the Admin Dashboard. If they file a chargeback with their bank instead, you'll see it as a Dispute in the Payments section, where you can submit evidence.

<br/>

### Can I temporarily remove an item from the menu?
Yes — toggle the item's **Availability** to "No" in Menu Management. It will disappear from the customer website but won't be deleted. Toggle it back when it's available again.

<br/>

### How do I add a new staff member to the Admin Dashboard?
Contact your developer. They will create a new admin account with the appropriate role (Staff, Manager, Admin, etc.).

<br/>

### How do I update my business hours or phone number on the website?
Contact your developer — these are configured as settings and can be changed without rebuilding the website.

<br/>

### Can I see how much revenue came from DoorDash vs. direct orders?
Yes! The **Analytics** section in the Admin Dashboard has an Order Source breakdown that shows revenue by channel.

<br/>

### What is the referral program and how does it work?
Every customer with an account gets a unique referral link. When they share it and a friend signs up and places their first order, both parties earn a reward. You can manage referrals from the Admin Dashboard.

<br/>

### Is the website secure?
Yes. All payments are processed through Stripe (PCI-compliant, the same security standard used by Fortune 500 companies). Customer passwords are encrypted. Admin sessions expire after 8 hours. All connections use HTTPS encryption.

<br/>

---

<br/>

# 19 · Glossary

| Term | Definition |
|------|------------|
| **Admin Dashboard** | Your private management website where you control everything about your business |
| **Chargeback** | When a customer disputes a charge through their bank (also called a "dispute") |
| **Checkout Session** | The secure payment form customers fill out to complete their order |
| **Deposit** | The 30% upfront payment required for catering bookings |
| **Dispute** | A formal complaint about a charge, filed by a customer through their bank |
| **Featured Item** | A menu item highlighted on the homepage to attract attention |
| **Guest Checkout** | Ordering without creating an account |
| **PCI Compliant** | Meets the Payment Card Industry's security standards for handling credit card data |
| **Payout** | When Stripe sends the money from customer payments to your bank account |
| **Referral Code** | A unique code a customer shares with friends to earn rewards |
| **Refund** | Returning money to a customer for a previous charge |
| **Stripe** | The third-party service that processes all credit card payments |
| **Vercel** | The hosting platform where your websites run |
| **Webhook** | An automatic notification that Stripe sends when a payment event happens |

<br/>

---

<br/>

# 20 · Support & Contact

If you need help with anything related to your website, reach out to your development team:

<br/>

| Need | Who to Contact |
|------|----------------|
| **Menu changes you can't do yourself** | Your developer |
| **Staff account creation** | Your developer |
| **Business info updates** (hours, phone, etc.) | Your developer |
| **Payment or Stripe issues** | Your developer + check Stripe Dashboard |
| **Website bugs or errors** | Your developer |
| **Questions about this document** | Your developer |

<br/>

> **For Stripe-specific questions** (payouts, fees, bank account changes), you can also contact Stripe Support directly at https://support.stripe.com or through the Stripe Dashboard.

<br/>

---

<br/>

<p align="center">
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  <br/><br/>
  <strong>BACKYARD BBQ KING</strong>
  <br/>
  <em>Premium Texas-Style Smokehouse & Catering</em>
  <br/><br/>
  This document is confidential and intended for the business owner and authorized staff only.
  <br/><br/>
  <code>Last updated: May 2026</code>
  <br/><br/>
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
</p>
