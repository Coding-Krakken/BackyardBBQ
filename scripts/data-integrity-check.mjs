#!/usr/bin/env node
/**
 * Data Integrity Check Script
 * 
 * Identifies discrepancies between Orders and PaymentTransactions.
 * Run this to diagnose financial data inconsistencies.
 * 
 * Usage: node scripts/data-integrity-check.mjs
 * 
 * Environment: Requires DATABASE_URL to be set
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ONLINE_PAYMENT_SOURCES = ["direct", "catering"];
const THIRD_PARTY_CHANNELS = ["doordash", "ubereats", "grubhub"];
const SUCCESS_STATUSES = ["succeeded", "partially_refunded"];
const paymentProvider = (process.env.PAYMENT_PROVIDER ?? "stripe").trim().toLowerCase();

function resolveExternalPaymentId(value) {
  if (!value || typeof value !== "string") {
    return "none";
  }

  if (value.startsWith("epos_txn_")) {
    return `EPOS TXN: ${value.slice("epos_txn_".length)}`;
  }

  return `Stripe PI: ${value}`;
}

async function main() {
  console.log("Running data integrity check...\n");
  console.log(`Payment provider: ${paymentProvider}\n`);

  // 1. Find orders without payments (online-payment sources only)
  const ordersWithoutPayments = await prisma.order.findMany({
    where: {
      source: { in: ONLINE_PAYMENT_SOURCES },
      status: { notIn: ["cancelled", "pending"] },
      payment: null,
    },
    select: {
      id: true,
      source: true,
      status: true,
      totalCents: true,
      createdAt: true,
      customer: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 2. Find payments without orders
  const paymentsWithoutOrders = await prisma.paymentTransaction.findMany({
    where: {
      orderId: null,
      paymentType: "order",
    },
    select: {
      id: true,
      stripePaymentIntentId: true,
      amountCents: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 3. Calculate sum comparisons
  const [orderSum, paymentSum, thirdPartyOrders] = await Promise.all([
    prisma.order.aggregate({
      where: {
        source: { in: ONLINE_PAYMENT_SOURCES },
        status: { notIn: ["cancelled"] },
      },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        status: { in: SUCCESS_STATUSES },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        source: { in: THIRD_PARTY_CHANNELS },
        status: { notIn: ["cancelled"] },
      },
      _sum: { totalCents: true },
      _count: true,
    }),
  ]);

  const orderSumCents = orderSum._sum.totalCents ?? 0;
  const paymentSumCents = paymentSum._sum.amountCents ?? 0;
  const thirdPartySumCents = thirdPartyOrders._sum.totalCents ?? 0;
  const differenceCents = orderSumCents - paymentSumCents;

  // Output report
  console.log("===============================================================");
  console.log("                    DATA INTEGRITY REPORT");
  console.log("===============================================================\n");

  // Summary
  const healthy = ordersWithoutPayments.length === 0 && 
                  paymentsWithoutOrders.length === 0 && 
                  differenceCents === 0;

  if (healthy) {
    console.log("STATUS: HEALTHY - No discrepancies found\n");
  } else {
    console.log("STATUS: DISCREPANCIES DETECTED\n");
  }

  // Sums comparison
  console.log("FINANCIAL SUMMARY");
  console.log("---------------------------------------------------------------");
  console.log(`  Online Orders (direct + catering):  $${(orderSumCents / 100).toFixed(2)} (${orderSum._count} orders)`);
  console.log(`  PaymentTransactions (succeeded):    $${(paymentSumCents / 100).toFixed(2)} (${paymentSum._count} payments)`);
  console.log(`  Third-party Orders (delivery):      $${(thirdPartySumCents / 100).toFixed(2)} (${thirdPartyOrders._count} orders)`);
  console.log("---------------------------------------------------------------");
  
  if (differenceCents !== 0) {
    console.log(`  DISCREPANCY: $${(Math.abs(differenceCents) / 100).toFixed(2)} ${differenceCents > 0 ? "(Orders > Payments)" : "(Payments > Orders)"}`);
  } else {
    console.log(`  ✓  Orders and Payments are in sync`);
  }
  console.log();

  // Orphaned orders
  console.log("ORPHANED ORDERS (no PaymentTransaction)");
  console.log("---------------------------------------------------------------");
  if (ordersWithoutPayments.length === 0) {
    console.log("  ✓  None found");
  } else {
    console.log(`  Found ${ordersWithoutPayments.length} orders:\n`);
    for (const order of ordersWithoutPayments.slice(0, 20)) {
      console.log(`  - ${order.id}`);
      console.log(`    Source: ${order.source} | Status: ${order.status}`);
      console.log(`    Amount: $${(order.totalCents / 100).toFixed(2)} | Created: ${order.createdAt.toISOString()}`);
      console.log(`    Customer: ${order.customer?.email ?? "guest"}`);
      console.log();
    }
    if (ordersWithoutPayments.length > 20) {
      console.log(`  ... and ${ordersWithoutPayments.length - 20} more`);
    }
  }
  console.log();

  // Orphaned payments
  console.log("ORPHANED PAYMENTS (no linked Order)");
  console.log("---------------------------------------------------------------");
  if (paymentsWithoutOrders.length === 0) {
    console.log("  ✓  None found");
  } else {
    console.log(`  Found ${paymentsWithoutOrders.length} payments:\n`);
    for (const payment of paymentsWithoutOrders.slice(0, 20)) {
      console.log(`  - ${payment.id}`);
      console.log(`    External Id: ${resolveExternalPaymentId(payment.stripePaymentIntentId)}`);
      console.log(`    Amount: $${(payment.amountCents / 100).toFixed(2)} | Status: ${payment.status}`);
      console.log(`    Created: ${payment.createdAt.toISOString()}`);
      console.log();
    }
    if (paymentsWithoutOrders.length > 20) {
      console.log(`  ... and ${paymentsWithoutOrders.length - 20} more`);
    }
  }
  console.log();

  // Recommendations
  if (!healthy) {
    console.log("RECOMMENDED ACTIONS");
    console.log("---------------------------------------------------------------");
    
    if (ordersWithoutPayments.length > 0) {
      console.log("  1. For orphaned orders:");
      console.log(`     - Check ${paymentProvider.toUpperCase()} records for corresponding transactions`);
      console.log("     - If payment exists: backfill PaymentTransaction");
      console.log("     - If no payment exists: mark order as 'cancelled'");
      console.log("     - Run: node scripts/reconcile-orphaned-orders.mjs --dry-run");
      console.log();
    }
    
    if (paymentsWithoutOrders.length > 0) {
      console.log("  2. For orphaned payments:");
      console.log("     - Check external transaction metadata/reference code");
      console.log("     - Link to existing Order if orderId found");
      console.log("     - May indicate webhook processing failure");
      console.log();
    }
    
    if (differenceCents !== 0) {
      console.log("  3. For sum discrepancy:");
      console.log("     - Review orders and payments from the lists above");
      console.log("     - Check for missing payment webhook events");
      console.log(`     - Consider running reconciliation against ${paymentProvider.toUpperCase()} API`);
      console.log();
    }
  }

  console.log("===============================================================\n");

  // Exit with error code if unhealthy (useful for CI)
  process.exit(healthy ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("Error running integrity check:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
