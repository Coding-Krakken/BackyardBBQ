#!/usr/bin/env node
/**
 * Reconcile Orphaned Orders Script
 * 
 * Marks orphaned orders (orders without PaymentTransaction) as cancelled,
 * or backfills PaymentTransaction from the active payment provider if data exists.
 * 
 * Usage:
 *   node scripts/reconcile-orphaned-orders.mjs --dry-run      # Preview changes
 *   node scripts/reconcile-orphaned-orders.mjs --execute      # Apply changes
 *   node scripts/reconcile-orphaned-orders.mjs --backfill     # Attempt provider backfill
 * 
 * Environment: Requires DATABASE_URL.
 * - Stripe backfill requires STRIPE_SECRET_KEY.
 * - EPOS backfill requires EPOS_NOW_BASE_URL + EPOS_NOW_AUTH_TOKEN.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ONLINE_PAYMENT_SOURCES = ["direct", "catering"];
const paymentProvider = (process.env.PAYMENT_PROVIDER ?? "stripe").trim().toLowerCase();

async function getOrphanedOrders() {
  return prisma.order.findMany({
    where: {
      source: { in: ONLINE_PAYMENT_SOURCES },
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

function isSupportedProvider(provider) {
  return provider === "stripe" || provider === "epos";
}

function resolveExternalPaymentId(value) {
  if (!value || typeof value !== "string") {
    return "none";
  }

  if (value.startsWith("epos_txn_")) {
    return `EPOS TXN: ${value.slice("epos_txn_".length)}`;
  }

  return `Stripe PI: ${value}`;
}

async function getOrphanedSuccessfulPayments() {
  return prisma.paymentTransaction.findMany({
    where: {
      status: "succeeded",
      paymentType: "order",
      orderId: null,
    },
    select: {
      id: true,
      stripePaymentIntentId: true,
      amountCents: true,
      currency: true,
      createdAt: true,
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

function getEposConfig() {
  const baseUrl = process.env.EPOS_NOW_BASE_URL?.trim();
  const authToken = process.env.EPOS_NOW_AUTH_TOKEN?.trim();

  if (!baseUrl || !authToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    authToken,
    authHeaderName: process.env.EPOS_NOW_AUTH_HEADER?.trim() || "Authorization",
    authScheme: process.env.EPOS_NOW_AUTH_SCHEME?.trim() || "Bearer",
  };
}

function getEposAuthHeaderValue(config) {
  if (!config.authScheme) {
    return config.authToken;
  }

  return `${config.authScheme} ${config.authToken}`;
}

async function eposRequest(config, path) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      [config.authHeaderName]: getEposAuthHeaderValue(config),
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown EPOS error");
    throw new Error(`EPOS request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

function toRecord(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeEposTransaction(value) {
  const data = toRecord(value);
  const rawId = data.Id ?? data.id;
  const id = typeof rawId === "number" || typeof rawId === "string" ? String(rawId) : null;

  const statusId = toNumber(data.StatusId ?? data.statusId);
  const totalAmount = toNumber(data.TotalAmount ?? data.totalAmount);

  return {
    id,
    statusId,
    totalAmount,
  };
}

function transactionIsCompleted(transaction) {
  return transaction.statusId === 1;
}

function selectBestEposTransaction(candidate) {
  if (Array.isArray(candidate)) {
    const normalized = candidate.map((item) => normalizeEposTransaction(item));
    const completed = normalized.find((item) => item.id && transactionIsCompleted(item));
    if (completed) {
      return completed;
    }

    return normalized.find((item) => item.id) ?? null;
  }

  const single = normalizeEposTransaction(candidate);
  return single.id ? single : null;
}

function getPaginationEnvelope(response) {
  const root = toRecord(response);
  const currentPage = toNumber(root.Page ?? root.page ?? root.CurrentPage ?? root.currentPage);
  const totalPages = toNumber(root.TotalPages ?? root.totalPages ?? root.PageCount ?? root.pageCount);

  if (
    typeof currentPage === "number" &&
    Number.isInteger(currentPage) &&
    currentPage > 0 &&
    typeof totalPages === "number" &&
    Number.isInteger(totalPages) &&
    totalPages > 0
  ) {
    return { currentPage, totalPages };
  }

  return null;
}

function extractTransactionsFromResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  const root = toRecord(response);
  const candidates = [
    root.Items,
    root.items,
    root.Data,
    root.data,
    root.Results,
    root.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function hasPossibleNextPage(response) {
  const envelope = getPaginationEnvelope(response);
  if (envelope) {
    return envelope.currentPage < envelope.totalPages;
  }

  // EPOS docs indicate list endpoints return 200 items per page.
  const items = extractTransactionsFromResponse(response);
  return items.length === 200;
}

async function fetchEposTransactionsByReferenceCode(config, referenceCode) {
  const encodedReference = encodeURIComponent(referenceCode);
  const configuredMaxPages = Number(process.env.EPOS_NOW_REFERENCE_LOOKUP_MAX_PAGES ?? "5");
  const maxPages =
    Number.isInteger(configuredMaxPages) && configuredMaxPages > 0
      ? Math.min(configuredMaxPages, 50)
      : 5;
  let page = 1;
  const items = [];

  while (page <= maxPages) {
    const suffix = page === 1 ? "" : `?page=${page}`;
    let response;
    try {
      response = await eposRequest(
        config,
        `/api/v4/Transaction/ReferenceCode/${encodedReference}${suffix}`
      );
    } catch (error) {
      // A non-first page can fail when there are no additional pages.
      if (page === 1) {
        throw error;
      }
      break;
    }

    if (!response || typeof response !== "object") {
      break;
    }

    const pageItems = extractTransactionsFromResponse(response);
    if (pageItems.length > 0) {
      items.push(...pageItems);
    } else {
      items.push(response);
      break;
    }

    if (!hasPossibleNextPage(response)) {
      break;
    }

    page += 1;
  }

  return items;
}

async function backfillFromEpos(orders, dryRun = true) {
  const config = getEposConfig();
  if (!config) {
    console.log("\nWARNING: EPOS config missing - cannot backfill");
    console.log("   Set EPOS_NOW_BASE_URL and EPOS_NOW_AUTH_TOKEN to enable backfill mode");
    return { backfilled: 0, notFound: orders.length };
  }

  let backfilled = 0;
  let notFound = 0;

  for (const order of orders) {
    let transaction = null;

    const existingExternalId =
      typeof order.stripeIntentId === "string" && order.stripeIntentId.startsWith("epos_txn_")
        ? order.stripeIntentId.slice("epos_txn_".length)
        : null;

    try {
      if (existingExternalId) {
        const byId = await eposRequest(config, `/api/v4/Transaction/${encodeURIComponent(existingExternalId)}`);
        transaction = normalizeEposTransaction(byId);
      }

      if (!transaction?.id) {
        const referenceCandidates = [order.id, `epos_order_${order.id}`];

        for (const referenceCode of referenceCandidates) {
          const byReference = await fetchEposTransactionsByReferenceCode(config, referenceCode);
          transaction = selectBestEposTransaction(byReference);
          if (transaction?.id) {
            break;
          }
        }
      }
    } catch (error) {
      console.log(`  EPOS lookup failed for order ${order.id}: ${error.message}`);
      transaction = null;
    }

    if (!transaction?.id || !transactionIsCompleted(transaction)) {
      notFound++;
      continue;
    }

    const amountCents =
      transaction.totalAmount !== null
        ? Math.max(0, Math.round(transaction.totalAmount * 100))
        : order.totalCents;

    if (dryRun) {
      console.log(
        `  [DRY RUN] Would create PaymentTransaction for order ${order.id} from EPOS txn ${transaction.id}`
      );
    } else {
      await prisma.paymentTransaction.create({
        data: {
          customerId: order.customerId,
          orderId: order.id,
          stripePaymentIntentId: `epos_txn_${transaction.id}`,
          amountCents,
          currency: "usd",
          status: "succeeded",
          paymentType: "order",
        },
      });
      console.log(`  Created PaymentTransaction for order ${order.id}`);
    }

    backfilled++;
  }

  return { backfilled, notFound };
}

async function backfillFromProvider(orders, dryRun = true) {
  if (paymentProvider === "epos") {
    return backfillFromEpos(orders, dryRun);
  }

  return backfillFromStripe(orders, dryRun);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || (!args.includes("--execute") && !args.includes("--backfill"));
  const backfill = args.includes("--backfill");

  console.log("===============================================================");
  console.log("           RECONCILE ORPHANED ORDERS");
  console.log("===============================================================\n");

  if (!isSupportedProvider(paymentProvider)) {
    console.error(`Unsupported PAYMENT_PROVIDER '${paymentProvider}'. Expected 'stripe' or 'epos'.`);
    process.exit(1);
  }

  console.log(`Payment provider: ${paymentProvider}\n`);

  if (dryRun) {
    console.log("DRY RUN MODE - No changes will be made\n");
  } else if (backfill) {
    console.log("BACKFILL MODE - Will attempt to recover from provider records\n");
  } else {
    console.log("EXECUTE MODE - Changes will be applied\n");
  }

  // Get orphaned orders
  const orphanedOrders = await getOrphanedOrders();
  const orphanedPayments = await getOrphanedSuccessfulPayments();

  if (orphanedPayments.length > 0) {
    console.log(`Found ${orphanedPayments.length} successful payments with no linked order:\n`);
    for (const payment of orphanedPayments.slice(0, 10)) {
      console.log(`  - ${payment.id}`);
      console.log(`    External Id: ${resolveExternalPaymentId(payment.stripePaymentIntentId)}`);
      console.log(`    Amount: ${payment.amountCents} ${payment.currency.toUpperCase()}`);
      console.log();
    }

    if (orphanedPayments.length > 10) {
      console.log(`  ... and ${orphanedPayments.length - 10} more\n`);
    }

    console.log("WARNING: Payments without linked orders indicate webhook/order linkage gaps.\n");
  }

  if (orphanedOrders.length === 0 && orphanedPayments.length === 0) {
    console.log("No orphaned orders or unlinked successful payments found. Database is healthy.\n");
    process.exit(0);
  }

  console.log(`Found ${orphanedOrders.length} orphaned orders:\n`);
  
  const totalCents = orphanedOrders.reduce((sum, o) => sum + o.totalCents, 0);
  console.log(`  Total value: $${(totalCents / 100).toFixed(2)}\n`);

  for (const order of orphanedOrders.slice(0, 10)) {
    console.log(`  - ${order.id}`);
    console.log(`    Source: ${order.source} | Status: ${order.status}`);
    console.log(
      `    Amount: $${(order.totalCents / 100).toFixed(2)} | External Id: ${resolveExternalPaymentId(order.stripeIntentId)}`
    );
    console.log(`    Customer: ${order.customer?.email ?? "guest"}`);
    console.log();
  }
  
  if (orphanedOrders.length > 10) {
    console.log(`  ... and ${orphanedOrders.length - 10} more\n`);
  }

  // Process based on mode
  if (backfill) {
    console.log("---------------------------------------------------------------");
    console.log(`Attempting ${paymentProvider.toUpperCase()} backfill...\n`);
    
    const { backfilled, notFound } = await backfillFromProvider(orphanedOrders, dryRun);
    
    console.log(`\nBackfill results:`);
    console.log(`  Backfilled: ${backfilled}`);
    console.log(`  Not found in Stripe: ${notFound}`);
    
    if (notFound > 0 && !dryRun) {
      console.log(`\nWARNING: ${notFound} orders could not be recovered from ${paymentProvider.toUpperCase()}.`);
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
