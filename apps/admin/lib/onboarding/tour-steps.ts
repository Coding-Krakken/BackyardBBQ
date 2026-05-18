import { getFeatureBadgeHTML, buildFeatureDescription, buildRoadmapHTML } from './dynamic-content';

export interface TourStep {
  id: string;
  element?: string;
  page?: string;
  group: string;
  featureKey?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
}

export type TourGroup = {
  id: string;
  label: string;
  icon: string;
  stepCount: number;
};

function badge(featureKey: string): string {
  return getFeatureBadgeHTML(featureKey);
}

function featureDetail(featureKey: string): string {
  return buildFeatureDescription(featureKey);
}

export function getTourSteps(): TourStep[] {
  return [
    // ═══════════════════════════════════════════════════════════
    // GROUP 1: Welcome & Dashboard Overview
    // ═══════════════════════════════════════════════════════════
    {
      id: 'welcome-dashboard',
      page: '/dashboard',
      group: 'welcome',
      featureKey: 'dashboard-overview',
      popover: {
        title: '🔥 Welcome to Your Command Center',
        description: `
          <p>This is your <strong>admin dashboard</strong> — the nerve center of Backyard BBQ King. From here you can monitor everything happening across your business in real time.</p>
          <p>We'll walk you through every section so you know exactly where to find what you need.</p>
          <p class="onboarding-hint">This tour takes about 5 minutes. You can skip or restart anytime.</p>
        `,
      },
    },
    {
      id: 'dashboard-stats',
      element: '.stats-grid, .dashboard-stats',
      page: '/dashboard',
      group: 'welcome',
      featureKey: 'dashboard-overview',
      popover: {
        title: '📊 Key Metrics at a Glance',
        description: `
          <p>These stat cards show your most important numbers in real time:</p>
          <ul>
            <li><strong>Total Revenue</strong> — All-time earnings across orders and catering</li>
            <li><strong>Orders Today</strong> — Current day order count</li>
            <li><strong>Active Bookings</strong> — Upcoming catering events</li>
            <li><strong>Customers</strong> — Total registered customer base</li>
          </ul>
          <p>Numbers animate on load and update when you revisit the page.</p>
          ${badge('dashboard-overview')}
        `,
        side: 'bottom',
      },
    },
    {
      id: 'dashboard-charts',
      element: '.chart-grid, .dashboard-charts',
      page: '/dashboard',
      group: 'welcome',
      featureKey: 'analytics',
      popover: {
        title: '📈 Revenue & Order Trends',
        description: `
          <p>Interactive charts show your business trajectory:</p>
          <ul>
            <li><strong>Revenue over time</strong> — Daily/weekly/monthly revenue trends</li>
            <li><strong>Order volume</strong> — Track busy periods and seasonal patterns</li>
          </ul>
          <p>Hover over data points for exact values. Charts use <strong>Recharts</strong> for smooth, responsive visualizations.</p>
        `,
        side: 'top',
      },
    },
    {
      id: 'dashboard-recent',
      element: '.recent-orders, .dashboard-recent',
      page: '/dashboard',
      group: 'welcome',
      featureKey: 'order-management',
      popover: {
        title: '🕐 Recent Activity',
        description: `
          <p>Quick-view panels show the latest orders and bookings without navigating away. Click any item to see full details.</p>
          <p>Color-coded status badges let you spot items that need attention at a glance.</p>
        `,
        side: 'top',
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 2: Navigation & Layout
    // ═══════════════════════════════════════════════════════════
    {
      id: 'sidebar-overview',
      element: '.sidebar',
      page: '/dashboard',
      group: 'navigation',
      popover: {
        title: '🧭 Sidebar Navigation',
        description: `
          <p>The sidebar is organized into <strong>four sections</strong>:</p>
          <ul>
            <li><strong>Main</strong> — Dashboard, Orders, Bookings, Customers</li>
            <li><strong>Manage</strong> — Menu items, Analytics</li>
            <li><strong>Finance</strong> — Accounting, Payments</li>
            <li><strong>System</strong> — Integrations, Notifications, Referrals</li>
          </ul>
          <p>Items you see depend on your role. As <strong>owner</strong>, you have access to everything.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'sidebar-collapse',
      element: '.sidebar-collapse-btn',
      page: '/dashboard',
      group: 'navigation',
      popover: {
        title: '↔ Collapse / Expand',
        description: `
          <p>Click this button to collapse the sidebar to icon-only mode, giving you more screen space for data-heavy pages.</p>
          <p>Navigation labels hide, but icons and tooltips remain for quick access.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'role-system',
      element: '.sidebar-user-role',
      page: '/dashboard',
      group: 'navigation',
      featureKey: 'role-based-access',
      popover: {
        title: '🔐 Role-Based Access Control',
        description: `
          <p>Your system supports <strong>five distinct roles</strong>:</p>
          <table class="onboarding-role-table">
            <tr><td><strong>Owner</strong></td><td>Full access to everything</td></tr>
            <tr><td><strong>Admin</strong></td><td>Full access (same as owner)</td></tr>
            <tr><td><strong>Manager</strong></td><td>Orders, bookings, customers, analytics, menu</td></tr>
            <tr><td><strong>Staff</strong></td><td>Orders and bookings only</td></tr>
            <tr><td><strong>Accounting</strong></td><td>Payments and accounting only</td></tr>
          </table>
          <p>Each role sees only their permitted sections. Staff can't access finances; accounting can't modify orders.</p>
          ${badge('role-based-access')}
        `,
        side: 'right',
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 3: Order Management
    // ═══════════════════════════════════════════════════════════
    {
      id: 'orders-nav',
      element: 'a[href="/dashboard/orders"]',
      page: '/dashboard',
      group: 'orders',
      featureKey: 'order-management',
      popover: {
        title: '📦 Order Management',
        description: `
          <p>Click <strong>Orders</strong> to manage all incoming orders. Let's go there now to see how the order lifecycle works.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'orders-list',
      page: '/dashboard/orders',
      group: 'orders',
      featureKey: 'order-management',
      popover: {
        title: '📋 Orders Dashboard',
        description: `
          <p>This is your <strong>order management center</strong>. Every order flows through a defined lifecycle:</p>
          <div class="onboarding-flow">
            <span class="onboarding-flow-step">Pending</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Confirmed</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Preparing</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Ready</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Completed</span>
          </div>
          <p>Filter by status, search by ID, and paginate through history. Each order shows the source (Direct, DoorDash, UberEats, etc.).</p>
          ${badge('order-management')}
        `,
      },
    },
    {
      id: 'orders-sources',
      element: '.data-table, table',
      page: '/dashboard/orders',
      group: 'orders',
      featureKey: 'order-management',
      popover: {
        title: '🏷 Order Sources',
        description: `
          <p>Orders come from multiple channels:</p>
          <ul>
            <li><strong>Direct</strong> — Placed through your website</li>
            <li><strong>DoorDash / UberEats / Grubhub</strong> — Delivery platform orders</li>
            <li><strong>Catering</strong> — From catering booking deposits</li>
          </ul>
          <p>Source badges are color-coded so you can instantly tell where an order originated.</p>
        `,
        side: 'top',
      },
    },
    {
      id: 'orders-actions',
      element: '.data-table, table',
      page: '/dashboard/orders',
      group: 'orders',
      featureKey: 'order-management',
      popover: {
        title: '⚡ Order Actions',
        description: `
          <p>Click any order to open its detail page. From there you can:</p>
          <ul>
            <li><strong>Update status</strong> — Move through the order lifecycle</li>
            <li><strong>View items</strong> — See exactly what was ordered</li>
            <li><strong>Track payment</strong> — Link to the Stripe payment record</li>
            <li><strong>Issue refund</strong> — Full or partial refund with reason</li>
          </ul>
          <p>Status changes are confirmed with a dialog to prevent accidental updates.</p>
        `,
        side: 'top',
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 4: Catering & Bookings
    // ═══════════════════════════════════════════════════════════
    {
      id: 'bookings-nav',
      element: 'a[href="/dashboard/bookings"]',
      page: '/dashboard/orders',
      group: 'catering',
      featureKey: 'catering-bookings',
      popover: {
        title: '🎪 Catering Bookings',
        description: `
          <p>Your catering system handles party and event orders. Let's explore how bookings work.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'bookings-list',
      page: '/dashboard/bookings',
      group: 'catering',
      featureKey: 'catering-bookings',
      popover: {
        title: '📅 Booking Management',
        description: `
          <p>Catering bookings flow through their own lifecycle:</p>
          <div class="onboarding-flow">
            <span class="onboarding-flow-step">Draft</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Pending Approval</span>
            <span class="onboarding-flow-arrow">→</span>
            <span class="onboarding-flow-step">Approved</span>
          </div>
          <p>Customers choose from three catering packages:</p>
          <ul>
            <li><strong>Classic Smokehouse</strong> — Essential BBQ favorites</li>
            <li><strong>Pitmaster Signature</strong> — Premium selection</li>
            <li><strong>Premium</strong> — Full-service catering experience</li>
          </ul>
          <p>A <strong>deposit payment</strong> via Stripe is collected when booking. You approve or decline based on capacity and date availability.</p>
          ${badge('catering-bookings')}
        `,
      },
    },
    {
      id: 'bookings-actions',
      element: '.data-table, table',
      page: '/dashboard/bookings',
      group: 'catering',
      featureKey: 'catering-bookings',
      popover: {
        title: '✅ Approve or Decline',
        description: `
          <p>For each pending booking, you'll see:</p>
          <ul>
            <li><strong>Event date & party size</strong></li>
            <li><strong>Package selected</strong> and estimated total</li>
            <li><strong>Deposit amount</strong> already collected</li>
            <li><strong>Customer contact info</strong></li>
          </ul>
          <p>Use the <strong>Approve</strong> or <strong>Decline</strong> buttons. Approved bookings appear in your calendar; declined ones notify the customer.</p>
        `,
        side: 'top',
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 5: Customer Management
    // ═══════════════════════════════════════════════════════════
    {
      id: 'customers-nav',
      element: 'a[href="/dashboard/customers"]',
      page: '/dashboard/bookings',
      group: 'customers',
      featureKey: 'customer-management',
      popover: {
        title: '👥 Customer Management',
        description: `
          <p>Let's look at how you manage your customer base.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'customers-list',
      page: '/dashboard/customers',
      group: 'customers',
      featureKey: 'customer-management',
      popover: {
        title: '👤 Customer Profiles',
        description: `
          <p>Every registered customer has a profile with:</p>
          <ul>
            <li><strong>Contact info</strong> — Name, email, phone</li>
            <li><strong>Order history</strong> — All past orders with totals</li>
            <li><strong>Payment history</strong> — Stripe transactions and saved cards</li>
            <li><strong>Referral activity</strong> — Referrals sent and rewards earned</li>
            <li><strong>Dietary preferences</strong> — Stored for personalization</li>
          </ul>
          <p>Click any customer to see their full profile and relationship history with your business.</p>
          ${badge('customer-management')}
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 6: Menu Management
    // ═══════════════════════════════════════════════════════════
    {
      id: 'menu-nav',
      element: 'a[href="/dashboard/menu"]',
      page: '/dashboard/customers',
      group: 'menu',
      featureKey: 'menu-management',
      popover: {
        title: '🍖 Menu Management',
        description: `
          <p>Time to see how your menu is managed. This is where you control what customers see and order.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'menu-items',
      page: '/dashboard/menu',
      group: 'menu',
      featureKey: 'menu-management',
      popover: {
        title: '☰ Your Menu',
        description: `
          <p>Manage your entire menu from here:</p>
          <ul>
            <li><strong>Add items</strong> — Name, description, price, category, image</li>
            <li><strong>Organize</strong> — Group items by category with sort ordering</li>
            <li><strong>Customizations</strong> — JSON-based modifier options (sizes, add-ons, etc.)</li>
            <li><strong>Availability</strong> — Toggle items on/off without deleting</li>
            <li><strong>Featured items</strong> — Flag items for homepage spotlight</li>
          </ul>
          <p class="onboarding-hint">💡 All prices are stored in <strong>cents</strong> internally. Enter 1299 for $12.99.</p>
          ${badge('menu-management')}
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 7: Payments & Finance
    // ═══════════════════════════════════════════════════════════
    {
      id: 'payments-nav',
      element: 'a[href="/dashboard/payments"]',
      page: '/dashboard/menu',
      group: 'payments',
      featureKey: 'stripe-payments',
      popover: {
        title: '💳 Payments & Finance',
        description: `
          <p>Now let's explore your financial operations — powered entirely by <strong>Stripe</strong>.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'payments-overview',
      page: '/dashboard/payments',
      group: 'payments',
      featureKey: 'stripe-payments',
      popover: {
        title: '💰 Payment Transactions',
        description: `
          <p>Every payment flows through <strong>Stripe</strong>:</p>
          <ul>
            <li><strong>Checkout Sessions</strong> — Embedded payment form on your website</li>
            <li><strong>Payment Element</strong> — Cards, Apple Pay, Google Pay</li>
            <li><strong>Saved cards</strong> — Customers can save payment methods for faster checkout</li>
          </ul>
          <p>This page shows all transactions with:</p>
          <ul>
            <li>Status tracking (processing → succeeded → refunded)</li>
            <li>Amount breakdown (subtotal, tax, tip, total)</li>
            <li>Direct links to Stripe Dashboard</li>
          </ul>
          ${badge('stripe-payments')}
        `,
      },
    },
    {
      id: 'payments-refunds',
      element: '.data-table, table',
      page: '/dashboard/payments',
      group: 'payments',
      featureKey: 'stripe-payments',
      popover: {
        title: '↩ Refunds',
        description: `
          <p>To issue a refund, click into any payment transaction. You can issue:</p>
          <ul>
            <li><strong>Full refund</strong> — Returns the entire amount</li>
            <li><strong>Partial refund</strong> — Enter a specific amount in cents</li>
          </ul>
          <p>Refunds require a <strong>reason</strong> and are confirmed with a modal dialog. Stripe processes refunds to the original payment method.</p>
        `,
        side: 'top',
      },
    },
    {
      id: 'disputes-intro',
      page: '/dashboard/payments',
      group: 'payments',
      featureKey: 'payment-disputes',
      popover: {
        title: '⚖ Disputes & Chargebacks',
        description: `
          <p>The <strong>Disputes</strong> sub-page monitors Stripe chargebacks:</p>
          <ul>
            <li>Automatic detection via webhooks (<code>charge.dispute.*</code> events)</li>
            <li>Status tracking: needs response → under review → won/lost</li>
            <li>Evidence submission timeline</li>
          </ul>
          <p>Navigate to <strong>Payments → Disputes</strong> to see active disputes.</p>
          ${badge('payment-disputes')}
        `,
      },
    },
    {
      id: 'accounting-nav',
      element: 'a[href="/dashboard/accounting"]',
      page: '/dashboard/payments',
      group: 'payments',
      featureKey: 'accounting',
      popover: {
        title: '📒 Accounting',
        description: `
          <p>Let's check out the accounting system for daily reconciliation.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'accounting-overview',
      page: '/dashboard/accounting',
      group: 'payments',
      featureKey: 'accounting',
      popover: {
        title: '◇ Daily Close & Finalization',
        description: `
          <p>The accounting module handles end-of-day reconciliation:</p>
          <ul>
            <li><strong>Daily close</strong> — Summarize all transactions for the day</li>
            <li><strong>Finalization</strong> — Lock the day's records (no more edits)</li>
            <li><strong>Reports</strong> — Revenue, refunds, and net totals</li>
          </ul>
          <p>Run the daily close process at the end of each business day to keep your books accurate.</p>
          ${badge('accounting')}
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 8: Analytics
    // ═══════════════════════════════════════════════════════════
    {
      id: 'analytics-nav',
      element: 'a[href="/dashboard/analytics"]',
      page: '/dashboard/accounting',
      group: 'analytics',
      featureKey: 'analytics',
      popover: {
        title: '📊 Analytics & Insights',
        description: `
          <p>Now let's look at your data analytics capabilities.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'analytics-overview',
      page: '/dashboard/analytics',
      group: 'analytics',
      featureKey: 'analytics',
      popover: {
        title: '◑ Sales Analytics',
        description: `
          <p>Your analytics suite provides deep business insights:</p>
          <ul>
            <li><strong>Sales trends</strong> — Revenue and order volume over time</li>
            <li><strong>Forecasting</strong> — Predictive models for future revenue</li>
            <li><strong>Anomaly detection</strong> — Automatic alerts for unusual patterns</li>
            <li><strong>Category breakdown</strong> — Which menu items drive the most revenue</li>
          </ul>
          <p>Interactive charts let you zoom, filter by date range, and export data.</p>
          ${badge('analytics')}
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 9: Delivery Integrations (DYNAMIC - In Progress)
    // ═══════════════════════════════════════════════════════════
    {
      id: 'integrations-nav',
      element: 'a[href="/dashboard/integrations"]',
      page: '/dashboard/analytics',
      group: 'integrations',
      featureKey: 'delivery-integrations',
      popover: {
        title: '🔌 Delivery Integrations',
        description: `
          <p>This is where the multi-platform delivery system lives. Let's see what's built and what's coming.</p>
          ${badge('delivery-integrations')}
        `,
        side: 'right',
      },
    },
    {
      id: 'integrations-overview',
      page: '/dashboard/integrations',
      group: 'integrations',
      featureKey: 'delivery-integrations',
      popover: {
        title: '⊕ Delivery Platform Hub',
        description: `
          <p>Your restaurant connects to <strong>three major delivery platforms</strong>:</p>
          <div class="onboarding-platforms">
            <div class="onboarding-platform">🟠 <strong>DoorDash</strong></div>
            <div class="onboarding-platform">🟢 <strong>UberEats</strong></div>
            <div class="onboarding-platform">🔴 <strong>Grubhub</strong></div>
          </div>
          ${featureDetail('delivery-integrations')}
        `,
      },
    },
    {
      id: 'integrations-health',
      element: '.data-table, table, .panel',
      page: '/dashboard/integrations',
      group: 'integrations',
      featureKey: 'delivery-integrations',
      popover: {
        title: '💚 Health Monitoring',
        description: `
          <p>The health dashboard tracks each delivery channel's operational status:</p>
          <ul>
            <li><strong>Events processed</strong> — Successful webhook/sync operations</li>
            <li><strong>Failures</strong> — Errors that need attention</li>
            <li><strong>Dead letters</strong> — Events that failed after max retries</li>
            <li><strong>Queue depth</strong> — Pending events awaiting processing</li>
          </ul>
          <p>Background workers run continuously: ingest sync (30s), status sync (15s), dispatch queue (10s), settlement processing (10s).</p>
        `,
        side: 'bottom',
      },
    },
    {
      id: 'integrations-settlements',
      page: '/dashboard/integrations',
      group: 'integrations',
      featureKey: 'delivery-settlements',
      popover: {
        title: '💵 Settlement Reconciliation',
        description: `
          <p>When delivery platforms pay you, the settlement system reconciles every penny:</p>
          <ul>
            <li><strong>Batch tracking</strong> — Each payout period is a batch</li>
            <li><strong>Line items</strong> — Gross, fees, adjustments, net per order</li>
            <li><strong>Trend analytics</strong> — Daily gross/fees/net visualization</li>
            <li><strong>CSV export</strong> — Download for your bookkeeper</li>
          </ul>
          ${featureDetail('delivery-settlements')}
        `,
      },
    },
    {
      id: 'integrations-correlation',
      page: '/dashboard/integrations',
      group: 'integrations',
      featureKey: 'delivery-integrations',
      popover: {
        title: '🔗 Correlation & Contracts',
        description: `
          <p>Advanced debugging tools for delivery operations:</p>
          <ul>
            <li><strong>Correlation tracing</strong> — Follow an event through the entire pipeline</li>
            <li><strong>Contract validation</strong> — Verify event flows are complete (webhook → status → dispatch → action)</li>
            <li><strong>Dead letter management</strong> — Retry failed events or export for investigation</li>
            <li><strong>Incident packages</strong> — Bundle all events for a correlation ID into an export</li>
          </ul>
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 10: Notifications & Referrals
    // ═══════════════════════════════════════════════════════════
    {
      id: 'notifications-nav',
      element: 'a[href="/dashboard/notifications"]',
      page: '/dashboard/integrations',
      group: 'notifications',
      featureKey: 'email-notifications',
      popover: {
        title: '🔔 Notifications',
        description: `
          <p>The notification system manages customer communications.</p>
          ${badge('email-notifications')}
        `,
        side: 'right',
      },
    },
    {
      id: 'notifications-overview',
      page: '/dashboard/notifications',
      group: 'notifications',
      featureKey: 'email-notifications',
      popover: {
        title: '◌ Notification Management',
        description: `
          <p>Currently, notifications are stored in the database with these types:</p>
          <ul>
            <li><strong>Order updates</strong> — Status changes, delivery tracking</li>
            <li><strong>Booking updates</strong> — Approval, decline, reminders</li>
            <li><strong>Payment updates</strong> — Receipts, refund confirmations</li>
            <li><strong>Referral rewards</strong> — Reward earned notifications</li>
            <li><strong>Promotions</strong> — Marketing and special offers</li>
          </ul>
          ${featureDetail('email-notifications')}
        `,
      },
    },
    {
      id: 'referrals-nav',
      element: 'a[href="/dashboard/referrals"]',
      page: '/dashboard/notifications',
      group: 'notifications',
      featureKey: 'referral-program',
      popover: {
        title: '🎁 Referral Program',
        description: `
          <p>Let's check out how your referral system works.</p>
        `,
        side: 'right',
      },
    },
    {
      id: 'referrals-overview',
      page: '/dashboard/referrals',
      group: 'notifications',
      featureKey: 'referral-program',
      popover: {
        title: '⊛ Referral Management',
        description: `
          <p>Your referral program turns happy customers into brand ambassadors:</p>
          <ul>
            <li><strong>Unique codes</strong> — Each customer gets a shareable referral code</li>
            <li><strong>Invite tracking</strong> — See who was invited and their signup status</li>
            <li><strong>Reward management</strong> — Set reward amounts, track claims</li>
            <li><strong>Status flow</strong>: Pending → Signed Up → Rewarded (or Expired)</li>
          </ul>
          <p>Monitor your referral pipeline to see which customers drive the most growth.</p>
          ${badge('referral-program')}
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 11: Customer Website Overview
    // ═══════════════════════════════════════════════════════════
    {
      id: 'website-overview',
      page: '/dashboard/referrals',
      group: 'website',
      popover: {
        title: '🌐 Your Customer Website',
        description: `
          <p>While you manage things here, your customers interact through the <strong>public website</strong>:</p>
          <ul>
            <li><strong>Homepage</strong> — Hero section, story, featured items, testimonials</li>
            <li><strong>Menu</strong> — Browse categories, view details, add to cart</li>
            <li><strong>Cart & Checkout</strong> — Stripe-powered payment with Apple/Google Pay</li>
            <li><strong>Catering</strong> — Package selection, availability check, deposit payment</li>
            <li><strong>Customer Dashboard</strong> — Order history, saved cards, analytics, referrals</li>
            <li><strong>SEO Landing Pages</strong> — Location-specific pages for search visibility</li>
          </ul>
          <p>The website and admin dashboard share the same database, so all changes you make here are reflected instantly for customers.</p>
        `,
      },
    },
    {
      id: 'website-auth',
      page: '/dashboard/referrals',
      group: 'website',
      popover: {
        title: '🔑 Authentication System',
        description: `
          <p>Both the customer site and this admin dashboard use <strong>NextAuth</strong> with separate security policies:</p>
          <ul>
            <li><strong>Customer sessions</strong> — JWT, 30-day expiry</li>
            <li><strong>Admin sessions</strong> — JWT, 8-hour expiry (tighter security)</li>
          </ul>
          <p>Passwords are hashed with <strong>bcrypt</strong>. The admin login blocks anyone with a "customer" role from accessing this dashboard.</p>
        `,
      },
    },

    // ═══════════════════════════════════════════════════════════
    // GROUP 12: Roadmap & Completion
    // ═══════════════════════════════════════════════════════════
    {
      id: 'roadmap',
      page: '/dashboard',
      group: 'roadmap',
      popover: {
        title: '🗺 Platform Roadmap',
        description: buildRoadmapHTML(),
      },
    },
    {
      id: 'tour-complete',
      page: '/dashboard',
      group: 'roadmap',
      popover: {
        title: '🎉 You\'re All Set!',
        description: `
          <p>You now have a complete understanding of your Backyard BBQ King platform!</p>
          <div class="onboarding-summary">
            <p><strong>Quick reference:</strong></p>
            <ul>
              <li>📦 <strong>Orders</strong> — Monitor and fulfill customer orders</li>
              <li>🎪 <strong>Bookings</strong> — Approve catering events</li>
              <li>🍖 <strong>Menu</strong> — Update items and prices</li>
              <li>💳 <strong>Payments</strong> — Track revenue and handle refunds</li>
              <li>📊 <strong>Analytics</strong> — Data-driven decisions</li>
              <li>🔌 <strong>Integrations</strong> — Delivery platform operations</li>
            </ul>
          </div>
          <p class="onboarding-hint">💡 You can restart this tour anytime from the sidebar.</p>
        `,
      },
    },
  ];
}

export function getTourGroups(): TourGroup[] {
  const steps = getTourSteps();
  const groupMap = new Map<string, { label: string; icon: string; count: number }>();

  const groupMeta: Record<string, { label: string; icon: string }> = {
    welcome: { label: 'Welcome & Overview', icon: '🔥' },
    navigation: { label: 'Navigation & Layout', icon: '🧭' },
    orders: { label: 'Order Management', icon: '📦' },
    catering: { label: 'Catering & Bookings', icon: '🎪' },
    customers: { label: 'Customer Management', icon: '👥' },
    menu: { label: 'Menu Management', icon: '🍖' },
    payments: { label: 'Payments & Finance', icon: '💳' },
    analytics: { label: 'Analytics & Insights', icon: '📊' },
    integrations: { label: 'Delivery Integrations', icon: '🔌' },
    notifications: { label: 'Notifications & Referrals', icon: '🔔' },
    website: { label: 'Customer Website', icon: '🌐' },
    roadmap: { label: 'Roadmap & Completion', icon: '🗺' },
  };

  for (const step of steps) {
    const existing = groupMap.get(step.group);
    if (existing) {
      existing.count++;
    } else {
      const meta = groupMeta[step.group] ?? { label: step.group, icon: '•' };
      groupMap.set(step.group, { ...meta, count: 1 });
    }
  }

  return Array.from(groupMap.entries()).map(([id, info]) => ({
    id,
    label: info.label,
    icon: info.icon,
    stepCount: info.count,
  }));
}
