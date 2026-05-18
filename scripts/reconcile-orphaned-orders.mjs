#!/usr/bin/env node
/**
 * Reconcile Orphaned Orders Script
 * 
 * Marks orphaned orders (orders without PaymentTransaction) as cancelled,
 * or backfills PaymentTransaction from Stripe if data exists.
 * 
 * Usage:
 *   node scripts/reconcile-orphaned-orders.mjs --dry-run      # Preview changes
 *   node scripts/reconcile-orphaned-orders.mjs --execute      # Apply changes
 *   node scripts/reconcile-orphaned-orders.mjs --backfill     # Attempt Stripe backfill
 * 
 * Environment: Requires DATABASE_URL. Optional STRIPE_SECRET_KEY for backfill.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STRIPE_SOURCES = ["direct", "catering"];

async function getOrphanedOrders() {
  return prisma.order.findMany({
    where: {
      source: { in: STRIPE_SOURCES },
      status: { notIn: ["cancelled", "pending"] },
      payment: null,
    },
    select: {
      id: true,
      customerId: true,
      source: true,
      status: true,
      totalCents: true,
      stripeIntentId: true,
      createdAt: true,
      customer: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function cancelOrders(orderIds, dryRun = true) {
  if (dryRun) {
    console.log(`\n[DRY RUN] Would cancel ${orderIds.length} orders`);
    return { cancelled: orderIds.length, skipped: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update orders to cancelled
    await tx.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: "cancelled" },
    });

    // Log the action
    await tx.integrationEvent.createMany({
      data: orderIds.map((orderId) => ({
        orderId,
        channel: "admin",
        eventType: "admin.order.cancelled_reconciliation",
        payload: {
          reason: "No PaymentTransaction found - reconciliation cleanup",
          cancelledAt: new Date().toISOString(),
        },
        status: "processed",
      })),
    });

    return { cancelled: orderIds.length, skipped: 0 };
  });

  return result;
}

async function backfillFromStripe(orders, dryRun = true) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log("\nWARNING: STRIPE_SECRET_KEY not set - cannot backfill from Stripe");
    console.log("   Set the environment variable to enable backfill mode");
    return { backfilled: 0, notFound: orders.length };
  }

  // Dynamic import to avoid dependency issues
  let Stripe;
  try {
    Stripe = (await import("stripe")).default;
  } catch {
    console.log("\nWARNING: Stripe SDK not available - cannot backfill");
    return { backfilled: 0, notFound: orders.length };
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

  let backfilled = 0;
  let notFound = 0;

  for (const order of orders) {
    // Try to find PaymentIntent by stripeIntentId on order
    if (order.stripeIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(order.stripeIntentId);
        
        if (pi.status === "succeeded") {
          if (dryRun) {
            console.log(`  [DRY RUN] Would create PaymentTransaction for order ${order.id} from PI ${pi.id}`);
          } else {
            await prisma.paymentTransaction.create({
              data: {
                customerId: order.customerId,
                orderId: order.id,
                stripePaymentIntentId: pi.id,
                amountCents: pi.amount,
                currency: pi.currency,
                status: "succeeded",
                paymentType: "order",
              },
            });
            console.log(`  Created PaymentTransaction for order ${order.id}`);
          }
          backfilled++;
          continue;
        }
      } catch (e) {
        console.log(`  Could not retrieve PI ${order.stripeIntentId}: ${e.message}`);
      }
    }

    // Search by metadata if no stripeIntentId
    try {
      const paymentIntents = await stripe.paymentIntents.search({
        query: `metadata["orderId"]:"${order.id}"`,
        limit: 1,
      });

      if (paymentIntents.data.length > 0) {
        const pi = paymentIntents.data[0];
        if (pi.status === "succeeded") {
          if (dryRun) {
            console.log(`  [DRY RUN] Would create PaymentTransaction for order ${order.id} from PI ${pi.id}`);
          } else {
            await prisma.paymentTransaction.create({
              data: {
                customerId: order.customerId,
                orderId: order.id,
                stripePaymentIntentId: pi.id,
                amountCents: pi.amount,
                currency: pi.currency,
                status: "succeeded",
                paymentType: "order",
              },
            });
            console.log(`  Created PaymentTransaction for order ${order.id}`);
          }
          backfilled++;
          continue;
        }
      }
    } catch (e) {
      console.log(`  Search failed for order ${order.id}: ${e.message}`);
    }

    notFound++;
  }

  return { backfilled, notFound };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || (!args.includes("--execute") && !args.includes("--backfill"));
  const backfill = args.includes("--backfill");

  console.log("===============================================================");
  console.log("           RECONCILE ORPHANED ORDERS");
  console.log("===============================================================\n");

  if (dryRun) {
    console.log("DRY RUN MODE - No changes will be made\n");
  } else if (backfill) {
    console.log("BACKFILL MODE - Will attempt to recover from Stripe\n");
  } else {
    console.log("EXECUTE MODE - Changes will be applied\n");
  }

  // Get orphaned orders
  const orphanedOrders = await getOrphanedOrders();

  if (orphanedOrders.length === 0) {
    console.log("No orphaned orders found. Database is healthy.\n");
    process.exit(0);
  }

  console.log(`Found ${orphanedOrders.length} orphaned orders:\n`);
  
  const totalCents = orphanedOrders.reduce((sum, o) => sum + o.totalCents, 0);
  console.log(`  Total value: $${(totalCents / 100).toFixed(2)}\n`);

  for (const order of orphanedOrders.slice(0, 10)) {
    console.log(`  - ${order.id}`);
    console.log(`    Source: ${order.source} | Status: ${order.status}`);
    console.log(`    Amount: $${(order.totalCents / 100).toFixed(2)} | PI: ${order.stripeIntentId ?? "none"}`);
    console.log(`    Customer: ${order.customer?.email ?? "guest"}`);
    console.log();
  }
  
  if (orphanedOrders.length > 10) {
    console.log(`  ... and ${orphanedOrders.length - 10} more\n`);
  }

  // Process based on mode
  if (backfill) {
    console.log("---------------------------------------------------------------");
    console.log("Attempting Stripe backfill...\n");
    
    const { backfilled, notFound } = await backfillFromStripe(orphanedOrders, dryRun);
    
    console.log(`\nBackfill results:`);
    console.log(`  Backfilled: ${backfilled}`);
    console.log(`  Not found in Stripe: ${notFound}`);
    
    if (notFound > 0 && !dryRun) {
      console.log(`\nWARNING: ${notFound} orders could not be recovered from Stripe.`);
      console.log(`   Run with --execute to cancel these orders.`);
    }
  } else {
    console.log("---------------------------------------------------------------");
    console.log("Cancelling orphaned orders...\n");
    
    const orderIds = orphanedOrders.map((o) => o.id);
    const { cancelled } = await cancelOrders(orderIds, dryRun);
    
    console.log(`\nCancellation results:`);
    console.log(`  ${dryRun ? "Would cancel" : "Cancelled"}: ${cancelled} orders`);
  }

  console.log("\n===============================================================");

  if (dryRun) {
    console.log("\nTIP: To apply changes, run with --execute or --backfill\n");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
