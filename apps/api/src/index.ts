import Fastify from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@bbq/database";

const app = Fastify({ logger: true });
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

await app.register(cors, {
  origin: true
});

await app.register(rawBody, {
  global: false,
  field: "rawBody",
  encoding: "utf8",
  runFirst: true
});

app.get("/health", async () => ({ status: "ok", service: "api" }));

app.get("/api/payments/health", async () => ({
  stripeConfigured: Boolean(stripe),
  databaseConfigured: hasDatabaseUrl
}));

const orderSourceSchema = z.enum(["direct", "doordash", "ubereats", "grubhub", "catering"]);

const createOrderSchema = z.object({
  customerEmail: z.string().email().optional(),
  locationId: z.string().optional(),
  source: orderSourceSchema.default("direct"),
  items: z
    .array(
      z.object({
        menuItemName: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(1),
        notes: z.string().optional()
      })
    )
    .min(1),
  tipCents: z.number().int().min(0).default(0),
  taxCents: z.number().int().min(0).default(0)
});

const createBookingSchema = z.object({
  customerEmail: z.string().email().optional(),
  locationId: z.string().optional(),
  eventDate: z.string(),
  partySize: z.number().int().min(1),
  eventAddress: z.string().optional(),
  packageName: z.string().optional(),
  notes: z.string().optional()
});

const orderStatusSchema = z.enum(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]);
const bookingStatusSchema = z.enum(["draft", "pending_approval", "approved", "declined", "cancelled"]);
type AdminRole = "owner" | "admin" | "manager" | "staff" | "accounting";
const adminRoleSchema = z.enum(["owner", "admin", "manager", "staff", "accounting"]);

function parseAdminRole(request: { headers: Record<string, unknown> }) {
  const rawRole = request.headers["x-admin-role"];
  if (typeof rawRole !== "string") {
    return null;
  }

  const parsed = adminRoleSchema.safeParse(rawRole);
  return parsed.success ? parsed.data : null;
}

function requireAdminRole(
  request: { headers: Record<string, unknown> },
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  allowedRoles: AdminRole[]
) {
  const role = parseAdminRole(request);
  if (!role || !allowedRoles.includes(role)) {
    reply.status(403).send({
      message: "Forbidden: insufficient role permissions for this operation"
    });
    return null;
  }

  return role;
}

async function writeAdminAuditEvent(input: {
  role: AdminRole;
  action: string;
  entityId: string;
  entityType: "order" | "booking" | "payment" | "integration";
  orderId?: string;
  payload?: Record<string, unknown>;
}) {
  if (!hasDatabaseUrl) {
    return;
  }

  await prisma.integrationEvent.create({
    data: {
      orderId: input.orderId,
      channel: "admin",
      eventType: `admin.${input.action}`,
      status: "recorded",
      payload: {
        role: input.role,
        entityId: input.entityId,
        entityType: input.entityType,
        ...(input.payload ?? {})
      }
    }
  });
}

function mapStripeStatusToPaymentStatus(status: Stripe.PaymentIntent.Status) {
  const map: Record<Stripe.PaymentIntent.Status, string> = {
    requires_payment_method: "requires_payment_method",
    requires_confirmation: "requires_confirmation",
    requires_action: "requires_action",
    processing: "processing",
    requires_capture: "requires_capture",
    canceled: "canceled",
    succeeded: "succeeded"
  };

  return map[status] ?? "failed";
}

function getDayRange(dateInput?: string) {
  const base = dateInput ? new Date(dateInput) : new Date();
  base.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setDate(end.getDate() + 1);
  return { start: base, end };
}

function getRecentDateKeys(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - index);
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys;
}

const integrationChannels = ["doordash", "ubereats", "grubhub"] as const;

const allowedOrderTransitions: Record<z.infer<typeof orderStatusSchema>, z.infer<typeof orderStatusSchema>[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

const allowedBookingTransitions: Record<z.infer<typeof bookingStatusSchema>, z.infer<typeof bookingStatusSchema>[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "declined", "cancelled"],
  approved: ["cancelled"],
  declined: [],
  cancelled: []
};

async function resolveLocationId(locationId?: string) {
  if (!hasDatabaseUrl) {
    return null;
  }

  if (locationId) {
    return locationId;
  }

  const activeLocation = await prisma.location.findFirst({
    where: { isActive: true },
    select: { id: true }
  });

  return activeLocation?.id ?? null;
}

app.post("/api/orders", async (request, reply) => {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid order payload",
      errors: parsed.error.flatten()
    });
  }

  const subtotalCents = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );
  const totalCents = subtotalCents + parsed.data.tipCents + parsed.data.taxCents;

  if (!hasDatabaseUrl) {
    return {
      id: "demo-order",
      source: parsed.data.source,
      subtotalCents,
      taxCents: parsed.data.taxCents,
      tipCents: parsed.data.tipCents,
      totalCents,
      status: "pending"
    };
  }

  const locationId = await resolveLocationId(parsed.data.locationId);
  if (!locationId) {
    return reply.status(400).send({ message: "No active location available" });
  }

  let customerId: string | undefined;
  if (parsed.data.customerEmail) {
    const customer = await prisma.customer.upsert({
      where: { email: parsed.data.customerEmail },
      update: {},
      create: { email: parsed.data.customerEmail }
    });
    customerId = customer.id;
  }

  const order = await prisma.order.create({
    data: {
      customerId,
      locationId,
      source: parsed.data.source,
      subtotalCents,
      taxCents: parsed.data.taxCents,
      tipCents: parsed.data.tipCents,
      totalCents,
      items: {
        create: parsed.data.items
      }
    },
    include: {
      items: true
    }
  });

  return order;
});

app.post("/api/catering/bookings", async (request, reply) => {
  const parsed = createBookingSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid booking payload",
      errors: parsed.error.flatten()
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: "demo-booking",
      eventDate: parsed.data.eventDate,
      partySize: parsed.data.partySize,
      status: "pending_approval"
    };
  }

  const locationId = await resolveLocationId(parsed.data.locationId);
  if (!locationId) {
    return reply.status(400).send({ message: "No active location available" });
  }

  let customerId: string | undefined;
  if (parsed.data.customerEmail) {
    const customer = await prisma.customer.upsert({
      where: { email: parsed.data.customerEmail },
      update: {},
      create: { email: parsed.data.customerEmail }
    });
    customerId = customer.id;
  }

  const booking = await prisma.cateringBooking.create({
    data: {
      customerId,
      locationId,
      eventDate: new Date(parsed.data.eventDate),
      partySize: parsed.data.partySize,
      eventAddress: parsed.data.eventAddress,
      packageName: parsed.data.packageName,
      notes: parsed.data.notes,
      status: "pending_approval"
    }
  });

  return booking;
});

app.get("/api/admin/catering/bookings", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });

  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "sample-booking-001",
          eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
          partySize: 75,
          status: "pending_approval",
          packageName: "Pitmaster Signature",
          location: { name: "Backyard BBQ King Smokehouse" }
        }
      ]
    };
  }

  const bookings = await prisma.cateringBooking.findMany({
    orderBy: { eventDate: "asc" },
    take: query.limit,
    select: {
      id: true,
      eventDate: true,
      partySize: true,
      status: true,
      packageName: true,
      location: { select: { name: true } }
    }
  });

  return {
    data: bookings
  };
});

app.get("/api/admin/orders", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "staff", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });

  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "sample-direct-001",
          source: "direct",
          status: "pending",
          totalCents: 4200,
          createdAt: new Date().toISOString()
        },
        {
          id: "sample-dd-002",
          source: "doordash",
          status: "preparing",
          totalCents: 5800,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      source: true,
      status: true,
      totalCents: true,
      createdAt: true,
      location: { select: { name: true } }
    }
  });

  return {
    data: orders
  };
});

app.patch("/api/admin/orders/:orderId/status", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "staff"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({
    orderId: z.string()
  });
  const bodySchema = z.object({
    status: orderStatusSchema
  });

  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);

  if (!params.success || !body.success) {
    return reply.status(400).send({
      message: "Invalid status update payload"
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.orderId,
      status: body.data.status
    };
  }

  const existing = await prisma.order.findUnique({
    where: { id: params.data.orderId },
    select: { id: true, status: true }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const currentStatus = orderStatusSchema.parse(existing.status);

  if (!allowedOrderTransitions[currentStatus].includes(body.data.status)) {
    return reply.status(409).send({
      message: `Invalid order transition from ${currentStatus} to ${body.data.status}`
    });
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: { status: body.data.status },
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "order_status_updated",
    entityId: updated.id,
    entityType: "order",
    orderId: updated.id,
    payload: {
      status: updated.status
    }
  });

  return updated;
});

app.patch("/api/admin/catering/bookings/:bookingId/status", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({
    bookingId: z.string()
  });
  const bodySchema = z.object({
    status: bookingStatusSchema
  });

  const params = paramsSchema.safeParse(request.params);
  const body = bodySchema.safeParse(request.body);

  if (!params.success || !body.success) {
    return reply.status(400).send({
      message: "Invalid booking status payload"
    });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.bookingId,
      status: body.data.status
    };
  }

  const existing = await prisma.cateringBooking.findUnique({
    where: { id: params.data.bookingId },
    select: { id: true, status: true }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Booking not found" });
  }

  const currentStatus = bookingStatusSchema.parse(existing.status);

  if (!allowedBookingTransitions[currentStatus].includes(body.data.status)) {
    return reply.status(409).send({
      message: `Invalid booking transition from ${currentStatus} to ${body.data.status}`
    });
  }

  const updated = await prisma.cateringBooking.update({
    where: { id: existing.id },
    data: { status: body.data.status },
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "booking_status_updated",
    entityId: updated.id,
    entityType: "booking",
    payload: {
      status: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/payments", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          stripePaymentIntentId: "pi_demo_001",
          orderId: "sample-direct-001",
          amountCents: 4200,
          currency: "usd",
          status: "succeeded",
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const payments = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      stripePaymentIntentId: true,
      orderId: true,
      amountCents: true,
      currency: true,
      status: true,
      createdAt: true
    }
  });

  return { data: payments };
});

app.post("/api/admin/payments/refunds", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const bodySchema = z.object({
    paymentIntentId: z.string(),
    amountCents: z.number().int().min(1).optional()
  });

  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "Invalid refund payload" });
  }

  if (!stripe) {
    return reply.status(500).send({ message: "Stripe is not configured" });
  }

  const refund = await stripe.refunds.create({
    payment_intent: parsed.data.paymentIntentId,
    amount: parsed.data.amountCents
  });

  if (hasDatabaseUrl) {
    const payment = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: parsed.data.paymentIntentId },
      select: { amountCents: true, orderId: true }
    });

    const targetAmount = payment?.amountCents ?? refund.amount;
    const nextStatus = refund.amount >= targetAmount ? "refunded" : "partially_refunded";

    await prisma.paymentTransaction.updateMany({
      where: { stripePaymentIntentId: parsed.data.paymentIntentId },
      data: { status: nextStatus }
    });

    await writeAdminAuditEvent({
      role,
      action: "payment_refund_created",
      entityId: parsed.data.paymentIntentId,
      entityType: "payment",
      orderId: payment?.orderId ?? undefined,
      payload: {
        refundId: refund.id,
        amountCents: refund.amount,
        status: refund.status
      }
    });
  }

  return {
    refundId: refund.id,
    paymentIntentId: parsed.data.paymentIntentId,
    amountCents: refund.amount,
    status: refund.status
  };
});

app.get("/api/admin/payments/disputes", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "sample-dispute-001",
          disputeId: "dp_demo_001",
          paymentIntentId: "pi_demo_001",
          amountCents: 4200,
          currency: "usd",
          reason: "fraudulent",
          status: "needs_response",
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const disputes = await prisma.integrationEvent.findMany({
    where: {
      channel: "stripe",
      eventType: { contains: "charge.dispute" }
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      payload: true,
      status: true,
      createdAt: true
    }
  });

  return {
    data: disputes.map((event: { id: string; payload: unknown; status: string; createdAt: Date }) => {
      const payload = event.payload as Record<string, unknown>;
      return {
        id: event.id,
        disputeId: typeof payload.disputeId === "string" ? payload.disputeId : "unknown",
        paymentIntentId:
          typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : "unknown",
        amountCents: typeof payload.amountCents === "number" ? payload.amountCents : 0,
        currency: typeof payload.currency === "string" ? payload.currency : "usd",
        reason: typeof payload.reason === "string" ? payload.reason : "unknown",
        status: event.status,
        createdAt: event.createdAt
      };
    })
  };
});

app.patch("/api/admin/payments/disputes/:eventId/review", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({ eventId: z.string() });
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ message: "Invalid dispute identifier" });
  }

  if (!hasDatabaseUrl) {
    return { id: params.data.eventId, status: "reviewed" };
  }

  const updated = await prisma.integrationEvent.update({
    where: { id: params.data.eventId },
    data: { status: "reviewed" },
    select: {
      id: true,
      status: true,
      payload: true
    }
  });

  const payload = updated.payload as Record<string, unknown>;
  await writeAdminAuditEvent({
    role,
    action: "dispute_reviewed",
    entityId: updated.id,
    entityType: "payment",
    payload: {
      disputeId: payload.disputeId,
      paymentIntentId: payload.paymentIntentId,
      reviewStatus: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/integrations/health", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          channel: "doordash",
          status: "healthy",
          processedCount: 19,
          failedCount: 0,
          deadLetterCount: 0,
          latencyMs: 180,
          recordedAt: new Date().toISOString()
        },
        {
          channel: "ubereats",
          status: "degraded",
          processedCount: 16,
          failedCount: 1,
          deadLetterCount: 0,
          latencyMs: 390,
          recordedAt: new Date().toISOString()
        },
        {
          channel: "grubhub",
          status: "down",
          processedCount: 8,
          failedCount: 2,
          deadLetterCount: 1,
          latencyMs: 550,
          recordedAt: new Date().toISOString()
        }
      ]
    };
  }

  const [latestEvents, deadLetterByChannel] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...integrationChannels] },
        eventType: "delivery.sync.health"
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        channel: true,
        status: true,
        payload: true,
        createdAt: true
      }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        channel: { in: [...integrationChannels] },
        status: "dead_letter"
      },
      _count: { _all: true }
    })
  ]);

  const deadLetterMap = new Map<string, number>();
  deadLetterByChannel.forEach((row: { channel: string; _count: { _all: number } }) => {
    deadLetterMap.set(row.channel, row._count._all);
  });

  const byChannel = new Map<string, (typeof latestEvents)[number]>();
  for (const event of latestEvents) {
    if (!byChannel.has(event.channel)) {
      byChannel.set(event.channel, event);
    }
  }

  return {
    data: integrationChannels.map((channel) => {
      const event = byChannel.get(channel);
      const payload = (event?.payload ?? {}) as Record<string, unknown>;
      return {
        channel,
        status: event?.status ?? "unknown",
        processedCount: typeof payload.processedCount === "number" ? payload.processedCount : 0,
        failedCount: typeof payload.failedCount === "number" ? payload.failedCount : 0,
        deadLetterCount: deadLetterMap.get(channel) ?? 0,
        latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : 0,
        recordedAt: event?.createdAt ?? null
      };
    })
  };
});

app.get("/api/admin/integrations/alerts", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      summary: {
        critical: 1,
        warning: 1,
        info: 1
      },
      alerts: [
        {
          severity: "critical",
          channel: "grubhub",
          message: "Channel status is down and requires manual intervention"
        },
        {
          severity: "warning",
          channel: "ubereats",
          message: "Channel status degraded with elevated latency"
        },
        {
          severity: "info",
          channel: "doordash",
          message: "Dead-letter queue has pending retries"
        }
      ]
    };
  }

  const [latestEvents, deadLetterByChannel] = await Promise.all([
    prisma.integrationEvent.findMany({
      where: {
        channel: { in: [...integrationChannels] },
        eventType: "delivery.sync.health"
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        channel: true,
        status: true,
        payload: true
      }
    }),
    prisma.integrationEvent.groupBy({
      by: ["channel"],
      where: {
        channel: { in: [...integrationChannels] },
        status: "dead_letter"
      },
      _count: { _all: true }
    })
  ]);

  const channelEventMap = new Map<string, (typeof latestEvents)[number]>();
  for (const event of latestEvents) {
    if (!channelEventMap.has(event.channel)) {
      channelEventMap.set(event.channel, event);
    }
  }

  const deadLetterMap = new Map<string, number>();
  deadLetterByChannel.forEach((row: { channel: string; _count: { _all: number } }) => {
    deadLetterMap.set(row.channel, row._count._all);
  });

  const alerts: Array<{ severity: "critical" | "warning" | "info"; channel: string; message: string }> = [];

  integrationChannels.forEach((channel) => {
    const event = channelEventMap.get(channel);
    const payload = (event?.payload ?? {}) as Record<string, unknown>;
    const latencyMs = typeof payload.latencyMs === "number" ? payload.latencyMs : 0;
    const deadLetters = deadLetterMap.get(channel) ?? 0;

    if (event?.status === "down") {
      alerts.push({
        severity: "critical",
        channel,
        message: "Channel status is down and requires manual intervention"
      });
    } else if (event?.status === "degraded" || latencyMs >= 450) {
      alerts.push({
        severity: "warning",
        channel,
        message: "Channel status degraded with elevated latency"
      });
    }

    if (deadLetters >= 1) {
      alerts.push({
        severity: event?.status === "down" ? "warning" : "info",
        channel,
        message: `Dead-letter queue contains ${deadLetters} pending event(s)`
      });
    }
  });

  const summary = alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return {
    summary,
    alerts
  };
});

app.get("/api/admin/integrations/dead-letter", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
  });
  const query = querySchema.parse(request.query);

  if (!hasDatabaseUrl) {
    return {
      data: [
        {
          id: "dead-letter-001",
          channel: "grubhub",
          eventType: "delivery.order.sync",
          status: "dead_letter",
          payload: {
            reason: "Delivery provider timeout while syncing status callback",
            orderExternalId: "grubhub-dlq-demo"
          },
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  const rows = await prisma.integrationEvent.findMany({
    where: {
      channel: { in: [...integrationChannels] },
      status: { in: ["dead_letter", "retry_failed", "retried"] }
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      payload: true,
      createdAt: true
    }
  });

  return {
    data: rows
  };
});

app.patch("/api/admin/integrations/dead-letter/:eventId/retry", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager"]);
  if (!role) {
    return;
  }

  const paramsSchema = z.object({ eventId: z.string() });
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({ message: "Invalid dead-letter event id" });
  }

  if (!hasDatabaseUrl) {
    return {
      id: params.data.eventId,
      status: "retried"
    };
  }

  const existing = await prisma.integrationEvent.findUnique({
    where: { id: params.data.eventId },
    select: {
      id: true,
      status: true,
      channel: true,
      payload: true
    }
  });

  if (!existing) {
    return reply.status(404).send({ message: "Dead-letter event not found" });
  }

  if (existing.status !== "dead_letter" && existing.status !== "retry_failed") {
    return reply.status(409).send({ message: `Cannot retry event with status ${existing.status}` });
  }

  const payload = existing.payload as Record<string, unknown>;

  const updated = await prisma.integrationEvent.update({
    where: { id: existing.id },
    data: {
      status: "retried",
      payload: {
        ...payload,
        retriedAt: new Date().toISOString(),
        retriedByRole: role
      }
    },
    select: {
      id: true,
      status: true,
      channel: true
    }
  });

  await writeAdminAuditEvent({
    role,
    action: "integration_dead_letter_retried",
    entityId: updated.id,
    entityType: "integration",
    payload: {
      channel: updated.channel,
      status: updated.status
    }
  });

  return updated;
});

app.get("/api/admin/accounting/daily-close", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    date: z.string().optional()
  });
  const query = querySchema.parse(request.query);
  const { start, end } = getDayRange(query.date);

  if (!hasDatabaseUrl) {
    return {
      date: start.toISOString().slice(0, 10),
      summary: {
        grossSalesCents: 196500,
        refundedCents: 12000,
        netSalesCents: 184500,
        outstandingDisputes: 1
      },
      bySource: [
        { source: "direct", orders: 22, totalCents: 102000 },
        { source: "doordash", orders: 10, totalCents: 60500 },
        { source: "ubereats", orders: 7, totalCents: 24000 },
        { source: "grubhub", orders: 4, totalCents: 10000 }
      ]
    };
  }

  const [grossSales, sourceGroup, refundEvents, outstandingDisputes] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "cancelled" }
      },
      _sum: { totalCents: true }
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: "cancelled" }
      },
      _count: { _all: true },
      _sum: { totalCents: true }
    }),
    prisma.integrationEvent.findMany({
      where: {
        channel: "admin",
        eventType: "admin.payment_refund_created",
        createdAt: { gte: start, lt: end }
      },
      select: { payload: true }
    }),
    prisma.integrationEvent.count({
      where: {
        channel: "stripe",
        eventType: { contains: "charge.dispute" },
        status: "needs_response"
      }
    })
  ]);

  const refundedCents = refundEvents.reduce((sum: number, item: { payload: unknown }) => {
    const payload = item.payload as Record<string, unknown>;
    const amount = typeof payload.amountCents === "number" ? payload.amountCents : 0;
    return sum + amount;
  }, 0);

  const grossSalesCents = grossSales._sum.totalCents ?? 0;

  return {
    date: start.toISOString().slice(0, 10),
    summary: {
      grossSalesCents,
      refundedCents,
      netSalesCents: Math.max(0, grossSalesCents - refundedCents),
      outstandingDisputes
    },
    bySource: sourceGroup.map((row: { source: string; _count: { _all: number }; _sum: { totalCents: number | null } }) => ({
      source: row.source,
      orders: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    }))
  };
});

app.post("/api/admin/accounting/daily-close/finalize", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const bodySchema = z.object({
    date: z.string().optional()
  });
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "Invalid daily close payload" });
  }

  const { start } = getDayRange(parsed.data.date);

  await writeAdminAuditEvent({
    role,
    action: "daily_close_finalized",
    entityId: start.toISOString().slice(0, 10),
    entityType: "payment",
    payload: {
      date: start.toISOString().slice(0, 10)
    }
  });

  return {
    date: start.toISOString().slice(0, 10),
    status: "finalized"
  };
});

app.get("/api/admin/accounting/daily-close/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    date: z.string().optional()
  });
  const query = querySchema.parse(request.query);
  const { start, end } = getDayRange(query.date);
  const reportDate = start.toISOString().slice(0, 10);

  let grossSalesCents = 196500;
  let refundedCents = 12000;
  let netSalesCents = 184500;
  let outstandingDisputes = 1;
  let bySource: Array<{ source: string; orders: number; totalCents: number }> = [
    { source: "direct", orders: 22, totalCents: 102000 },
    { source: "doordash", orders: 10, totalCents: 60500 }
  ];

  if (hasDatabaseUrl) {
    const [grossSales, sourceGroup, refundEvents, disputes] = await Promise.all([
      prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: "cancelled" }
        },
        _sum: { totalCents: true }
      }),
      prisma.order.groupBy({
        by: ["source"],
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: "cancelled" }
        },
        _count: { _all: true },
        _sum: { totalCents: true }
      }),
      prisma.integrationEvent.findMany({
        where: {
          channel: "admin",
          eventType: "admin.payment_refund_created",
          createdAt: { gte: start, lt: end }
        },
        select: { payload: true }
      }),
      prisma.integrationEvent.count({
        where: {
          channel: "stripe",
          eventType: { contains: "charge.dispute" },
          status: "needs_response"
        }
      })
    ]);

    refundedCents = refundEvents.reduce((sum: number, item: { payload: unknown }) => {
      const payload = item.payload as Record<string, unknown>;
      const amount = typeof payload.amountCents === "number" ? payload.amountCents : 0;
      return sum + amount;
    }, 0);
    grossSalesCents = grossSales._sum.totalCents ?? 0;
    netSalesCents = Math.max(0, grossSalesCents - refundedCents);
    outstandingDisputes = disputes;
    bySource = sourceGroup.map((row: { source: string; _count: { _all: number }; _sum: { totalCents: number | null } }) => ({
      source: row.source,
      orders: row._count._all,
      totalCents: row._sum.totalCents ?? 0
    }));
  }

  const header = "date,source,orders,total_cents,gross_sales_cents,refunded_cents,net_sales_cents,outstanding_disputes";
  const rows = bySource.map(
    (row) =>
      `${reportDate},${row.source},${row.orders},${row.totalCents},${grossSalesCents},${refundedCents},${netSalesCents},${outstandingDisputes}`
  );
  const csv = [header, ...rows].join("\n");

  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-daily-close-${reportDate}.csv`);
  return reply.send(csv);
});

async function buildSalesAnalytics(days: number) {
  if (!hasDatabaseUrl) {
    return {
      windowDays: days,
      totals: {
        orders: 118,
        grossSalesCents: 468200,
        averageOrderValueCents: 3968
      },
      daily: [
        { date: "2026-05-12", orders: 37, grossSalesCents: 143000 },
        { date: "2026-05-13", orders: 39, grossSalesCents: 155400 },
        { date: "2026-05-14", orders: 42, grossSalesCents: 169800 }
      ],
      bySource: [
        { source: "direct", orders: 56, grossSalesCents: 241500 },
        { source: "doordash", orders: 29, grossSalesCents: 122200 },
        { source: "ubereats", orders: 21, grossSalesCents: 70200 },
        { source: "grubhub", orders: 12, grossSalesCents: 34300 }
      ],
      topItems: [
        { name: "Brisket Plate", quantity: 74, revenueCents: 118400 },
        { name: "Pulled Pork Sandwich", quantity: 63, revenueCents: 81900 },
        { name: "Smoked Wings", quantity: 48, revenueCents: 62400 }
      ]
    };
  }

  const recentDateKeys = getRecentDateKeys(days);
  const oldestDate = recentDateKeys[0];
  const start = new Date(`${oldestDate}T00:00:00.000Z`);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start },
      status: { not: "cancelled" }
    },
    select: {
      source: true,
      totalCents: true,
      createdAt: true,
      items: {
        select: {
          menuItemName: true,
          quantity: true,
          unitPriceCents: true
        }
      }
    }
  });

  const dailyMap = new Map<string, { orders: number; grossSalesCents: number }>();
  const sourceMap = new Map<string, { orders: number; grossSalesCents: number }>();
  const itemMap = new Map<string, { quantity: number; revenueCents: number }>();

  recentDateKeys.forEach((key) => {
    dailyMap.set(key, { orders: 0, grossSalesCents: 0 });
  });

  let grossSalesCents = 0;
  for (const order of orders) {
    const dateKey = order.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(dateKey);
    if (day) {
      day.orders += 1;
      day.grossSalesCents += order.totalCents;
    }

    const source = sourceMap.get(order.source) ?? { orders: 0, grossSalesCents: 0 };
    source.orders += 1;
    source.grossSalesCents += order.totalCents;
    sourceMap.set(order.source, source);

    grossSalesCents += order.totalCents;

    for (const item of order.items) {
      const row = itemMap.get(item.menuItemName) ?? { quantity: 0, revenueCents: 0 };
      row.quantity += item.quantity;
      row.revenueCents += item.quantity * item.unitPriceCents;
      itemMap.set(item.menuItemName, row);
    }
  }

  const topItems = Array.from(itemMap.entries())
    .map(([name, value]) => ({ name, quantity: value.quantity, revenueCents: value.revenueCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8);

  return {
    windowDays: days,
    totals: {
      orders: orders.length,
      grossSalesCents,
      averageOrderValueCents: orders.length > 0 ? Math.round(grossSalesCents / orders.length) : 0
    },
    daily: recentDateKeys.map((key) => ({
      date: key,
      orders: dailyMap.get(key)?.orders ?? 0,
      grossSalesCents: dailyMap.get(key)?.grossSalesCents ?? 0
    })),
    bySource: Array.from(sourceMap.entries())
      .map(([source, value]) => ({
        source,
        orders: value.orders,
        grossSalesCents: value.grossSalesCents
      }))
      .sort((a, b) => b.grossSalesCents - a.grossSalesCents),
    topItems
  };
}

async function buildForecastAnalytics(days: number) {
  if (!hasDatabaseUrl) {
    return {
      horizonDays: days,
      baseline: {
        trailingAverageOrders: 41,
        trailingAverageSalesCents: 168300
      },
      forecast: Array.from({ length: days }).map((_, index) => ({
        date: new Date(Date.now() + (index + 1) * 86400000).toISOString().slice(0, 10),
        predictedOrders: 40 + (index % 3),
        predictedSalesCents: 166000 + index * 4200,
        confidence: Number(Math.max(0.62, 0.9 - index * 0.03).toFixed(2))
      }))
    };
  }

  const historyDays = 21;
  const recentDateKeys = getRecentDateKeys(historyDays);
  const oldestDate = recentDateKeys[0];
  const historyStart = new Date(`${oldestDate}T00:00:00.000Z`);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: historyStart },
      status: { not: "cancelled" }
    },
    select: {
      createdAt: true,
      totalCents: true
    }
  });

  const dailyMap = new Map<string, { orders: number; salesCents: number; weekday: number }>();
  const weekdayMap = new Map<number, { orders: number; salesCents: number; days: number }>();

  recentDateKeys.forEach((key) => {
    const stamp = new Date(`${key}T00:00:00.000Z`);
    dailyMap.set(key, { orders: 0, salesCents: 0, weekday: stamp.getUTCDay() });
  });

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    if (row) {
      row.orders += 1;
      row.salesCents += order.totalCents;
    }
  }

  const historyRows = recentDateKeys.map((key) => dailyMap.get(key)).filter(Boolean) as Array<{
    orders: number;
    salesCents: number;
    weekday: number;
  }>;

  for (const row of historyRows) {
    const weekday = weekdayMap.get(row.weekday) ?? { orders: 0, salesCents: 0, days: 0 };
    weekday.orders += row.orders;
    weekday.salesCents += row.salesCents;
    weekday.days += 1;
    weekdayMap.set(row.weekday, weekday);
  }

  const trailingWindow = historyRows.slice(-14);
  const previousWindow = historyRows.slice(-21, -14);

  const trailingOrdersAvg =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + row.orders, 0) / trailingWindow.length
      : 0;
  const trailingSalesAvg =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + row.salesCents, 0) / trailingWindow.length
      : 0;

  const previousOrdersAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, row) => sum + row.orders, 0) / previousWindow.length
      : trailingOrdersAvg;
  const previousSalesAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, row) => sum + row.salesCents, 0) / previousWindow.length
      : trailingSalesAvg;

  const ordersTrendPerWeek = trailingOrdersAvg - previousOrdersAvg;
  const salesTrendPerWeek = trailingSalesAvg - previousSalesAvg;

  const orderVariance =
    trailingWindow.length > 0
      ? trailingWindow.reduce((sum, row) => sum + Math.pow(row.orders - trailingOrdersAvg, 2), 0) /
        trailingWindow.length
      : 0;
  const orderStdDev = Math.sqrt(orderVariance);
  const volatilityPenalty = Math.min(0.25, orderStdDev / 20);

  const forecast = Array.from({ length: days }).map((_, index) => {
    const dayOffset = index + 1;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    const weekday = date.getUTCDay();

    const weekdayStats = weekdayMap.get(weekday);
    const weekdayOrderFactor =
      weekdayStats && trailingOrdersAvg > 0
        ? Math.max(0.7, Math.min(1.35, weekdayStats.orders / Math.max(weekdayStats.days, 1) / trailingOrdersAvg))
        : 1;
    const weekdaySalesFactor =
      weekdayStats && trailingSalesAvg > 0
        ? Math.max(0.7, Math.min(1.35, weekdayStats.salesCents / Math.max(weekdayStats.days, 1) / trailingSalesAvg))
        : 1;

    const trendWeight = dayOffset / 7;
    const predictedOrders = Math.max(
      0,
      Math.round((trailingOrdersAvg + ordersTrendPerWeek * trendWeight) * weekdayOrderFactor)
    );
    const predictedSalesCents = Math.max(
      0,
      Math.round((trailingSalesAvg + salesTrendPerWeek * trendWeight) * weekdaySalesFactor)
    );
    const confidence = Number(
      Math.max(0.52, Math.min(0.94, 0.9 - dayOffset * 0.035 - volatilityPenalty)).toFixed(2)
    );

    return {
      date: date.toISOString().slice(0, 10),
      predictedOrders,
      predictedSalesCents,
      confidence
    };
  });

  return {
    horizonDays: days,
    baseline: {
      trailingAverageOrders: Number(trailingOrdersAvg.toFixed(2)),
      trailingAverageSalesCents: Math.round(trailingSalesAvg)
    },
    forecast
  };
}

app.get("/api/admin/analytics/sales", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(90).default(14)
  });
  const query = querySchema.parse(request.query);

  return buildSalesAnalytics(query.days);
});

app.get("/api/admin/analytics/sales/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(90).default(14)
  });
  const query = querySchema.parse(request.query);
  const analytics = await buildSalesAnalytics(query.days);

  const header = "section,key,orders,amount_cents,quantity";
  const rows: string[] = [];
  analytics.daily.forEach((row) => {
    rows.push(`daily,${row.date},${row.orders},${row.grossSalesCents},`);
  });
  analytics.bySource.forEach((row) => {
    rows.push(`source,${row.source},${row.orders},${row.grossSalesCents},`);
  });
  analytics.topItems.forEach((row) => {
    rows.push(`item,${row.name},,${row.revenueCents},${row.quantity}`);
  });

  const csv = [header, ...rows].join("\n");
  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-analytics-sales-${query.days}d.csv`);
  return reply.send(csv);
});

app.get("/api/admin/analytics/forecast", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(30).default(7)
  });
  const query = querySchema.parse(request.query);

  return buildForecastAnalytics(query.days);
});

app.get("/api/admin/analytics/forecast/export", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(3).max(30).default(7)
  });
  const query = querySchema.parse(request.query);
  const forecast = await buildForecastAnalytics(query.days);

  const header = "date,predicted_orders,predicted_sales_cents,confidence";
  const rows = forecast.forecast.map(
    (row) => `${row.date},${row.predictedOrders},${row.predictedSalesCents},${row.confidence}`
  );
  const csv = [header, ...rows].join("\n");

  reply.header("Content-Type", "text/csv; charset=utf-8");
  reply.header("Content-Disposition", `attachment; filename=bbq-analytics-forecast-${query.days}d.csv`);
  return reply.send(csv);
});

app.get("/api/admin/analytics/anomalies", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  const querySchema = z.object({
    days: z.coerce.number().int().min(7).max(60).default(21)
  });
  const query = querySchema.parse(request.query);

  const sales = await buildSalesAnalytics(query.days);
  const forecast = await buildForecastAnalytics(7);

  const anomalies: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }> = [];
  const totalDays = Math.max(1, sales.daily.length);
  const trailingAverageSales = Math.round(
    sales.daily.reduce((sum, row) => sum + row.grossSalesCents, 0) / totalDays
  );
  const trailingAverageOrders = Math.round(
    sales.daily.reduce((sum, row) => sum + row.orders, 0) / totalDays
  );
  const latest = sales.daily[sales.daily.length - 1] ?? { grossSalesCents: 0, orders: 0, date: "n/a" };

  if (trailingAverageSales > 0 && latest.grossSalesCents < trailingAverageSales * 0.68) {
    anomalies.push({
      severity: "warning",
      title: "Sales dip detected",
      detail: `${latest.date} sales are ${(latest.grossSalesCents / trailingAverageSales * 100).toFixed(0)}% of trailing average`
    });
  }

  if (trailingAverageOrders > 0 && latest.orders > trailingAverageOrders * 1.45) {
    anomalies.push({
      severity: "info",
      title: "Order spike detected",
      detail: `${latest.date} order count is above 145% of trailing average`
    });
  }

  const highestSource = sales.bySource[0];
  if (highestSource && sales.totals.grossSalesCents > 0) {
    const concentration = highestSource.grossSalesCents / sales.totals.grossSalesCents;
    if (concentration >= 0.62) {
      anomalies.push({
        severity: "warning",
        title: "Channel concentration risk",
        detail: `${highestSource.source} represents ${(concentration * 100).toFixed(0)}% of gross sales`
      });
    }
  }

  const lowConfidenceCount = forecast.forecast.filter((row) => row.confidence < 0.65).length;
  if (lowConfidenceCount >= 2) {
    anomalies.push({
      severity: "info",
      title: "Forecast confidence softening",
      detail: `${lowConfidenceCount} forecast day(s) are below 65% confidence`
    });
  }

  const summary = anomalies.reduce(
    (acc, anomaly) => {
      acc[anomaly.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  return {
    windowDays: query.days,
    summary,
    anomalies
  };
});

app.get("/api/admin/overview", async (request, reply) => {
  const role = requireAdminRole(request, reply, ["owner", "admin", "manager", "accounting"]);
  if (!role) {
    return;
  }

  if (!hasDatabaseUrl) {
    return {
      totals: {
        pendingOrders: 8,
        activeBookings: 3,
        grossSalesCentsToday: 196500
      }
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pendingOrders, activeBookings, grossSales] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["pending", "confirmed", "preparing", "ready"] } } }),
    prisma.cateringBooking.count({ where: { status: { in: ["pending_approval", "approved"] } } }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: todayStart },
        status: { not: "cancelled" }
      },
      _sum: {
        totalCents: true
      }
    })
  ]);

  return {
    totals: {
      pendingOrders,
      activeBookings,
      grossSalesCentsToday: grossSales._sum.totalCents ?? 0
    }
  };
});

app.post("/api/catering/availability", async (request, reply) => {
  const payloadSchema = z.object({
    date: z.string(),
    partySize: z.number().int().min(1),
    locationId: z.string().optional()
  });

  const parsed = payloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid request payload",
      errors: parsed.error.flatten()
    });
  }

  let capacity = 200;
  let bookedPartySize = 0;

  if (hasDatabaseUrl) {
    try {
      const start = new Date(parsed.data.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const targetLocationId = parsed.data.locationId
        ? parsed.data.locationId
        : (
            await prisma.location.findFirst({
              where: { isActive: true },
              select: { id: true, maxCateringCap: true }
            })
          )?.id;

      if (targetLocationId) {
        const location = await prisma.location.findUnique({
          where: { id: targetLocationId },
          select: { maxCateringCap: true }
        });
        capacity = location?.maxCateringCap ?? capacity;

        const aggregate = await prisma.cateringBooking.aggregate({
          where: {
            locationId: targetLocationId,
            eventDate: { gte: start, lt: end },
            status: { in: ["pending_approval", "approved"] }
          },
          _sum: {
            partySize: true
          }
        });
        bookedPartySize = aggregate._sum.partySize ?? 0;
      }
    } catch (error) {
      request.log.warn({ error }, "Falling back to static capacity heuristic");
    }
  }

  const remainingCapacity = Math.max(0, capacity - bookedPartySize);
  const available = parsed.data.partySize <= remainingCapacity;

  return {
    date: parsed.data.date,
    partySize: parsed.data.partySize,
    available,
    remainingCapacity,
    nextSteps: available
      ? "Proceed to package builder and deposit checkout"
      : "Select a different date or reduce event size"
  };
});

app.post("/api/payments/create-intent", async (request, reply) => {
  const payloadSchema = z.object({
    amountCents: z.number().int().min(50),
    currency: z.string().default("usd"),
    orderId: z.string().optional(),
    customerEmail: z.string().email().optional(),
    metadata: z.record(z.string()).optional()
  });

  const parsed = payloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid payment intent payload",
      errors: parsed.error.flatten()
    });
  }

  if (!stripe) {
    return reply.status(500).send({ message: "Stripe is not configured" });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: parsed.data.amountCents,
    currency: parsed.data.currency,
    receipt_email: parsed.data.customerEmail,
    automatic_payment_methods: { enabled: true },
    metadata: {
      ...(parsed.data.metadata ?? {}),
      orderId: parsed.data.orderId ?? ""
    }
  });

  if (hasDatabaseUrl && parsed.data.orderId) {
    try {
      await prisma.order.update({
        where: { id: parsed.data.orderId },
        data: { stripeIntentId: paymentIntent.id }
      });
    } catch (error) {
      request.log.warn({ error }, "Unable to link payment intent to order");
    }
  }

  if (hasDatabaseUrl) {
    try {
      await prisma.paymentTransaction.upsert({
        where: { stripePaymentIntentId: paymentIntent.id },
        update: {
          amountCents: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        create: {
          orderId: parsed.data.orderId,
          stripePaymentIntentId: paymentIntent.id,
          amountCents: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      });
    } catch (error) {
      request.log.warn({ error }, "Unable to persist payment transaction");
    }
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amountCents: paymentIntent.amount,
    currency: paymentIntent.currency
  };
});

app.post(
  "/api/payments/webhook",
  {
    config: {
      rawBody: true
    }
  },
  async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !signature || !webhookSecret) {
      return reply.status(400).send({ message: "Webhook is not configured" });
    }

    const raw = (request as typeof request & { rawBody?: string }).rawBody;
    if (!raw) {
      return reply.status(400).send({ message: "Missing webhook payload" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    } catch (error) {
      request.log.warn({ error }, "Invalid Stripe webhook signature");
      return reply.status(400).send({ message: "Invalid signature" });
    }

    if (event.type.startsWith("payment_intent.")) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      if (hasDatabaseUrl) {
        try {
          const orderId = typeof paymentIntent.metadata.orderId === "string" && paymentIntent.metadata.orderId
            ? paymentIntent.metadata.orderId
            : undefined;

          await prisma.paymentTransaction.upsert({
            where: { stripePaymentIntentId: paymentIntent.id },
            update: {
              amountCents: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: mapStripeStatusToPaymentStatus(paymentIntent.status),
              orderId
            },
            create: {
              stripePaymentIntentId: paymentIntent.id,
              amountCents: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: mapStripeStatusToPaymentStatus(paymentIntent.status),
              orderId
            }
          });

          if (orderId) {
            await prisma.order.update({
              where: { id: orderId },
              data: { stripeIntentId: paymentIntent.id }
            });
          }

          await prisma.integrationEvent.create({
            data: {
              orderId,
              channel: "stripe",
              eventType: event.type,
              status: "processed",
              payload: {
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status
              }
            }
          });
        } catch (error) {
          request.log.error({ error }, "Failed to reconcile payment intent webhook");
          return reply.status(500).send({ message: "Webhook processing failed" });
        }
      }
    }

    if (event.type.startsWith("charge.dispute.")) {
      const dispute = event.data.object as Stripe.Dispute;

      if (hasDatabaseUrl) {
        try {
          await prisma.integrationEvent.create({
            data: {
              channel: "stripe",
              eventType: event.type,
              status: "needs_response",
              payload: {
                disputeId: dispute.id,
                paymentIntentId:
                  typeof dispute.payment_intent === "string" ? dispute.payment_intent : "unknown",
                amountCents: dispute.amount,
                currency: dispute.currency,
                reason: dispute.reason,
                evidenceDetails: dispute.evidence_details
              }
            }
          });
        } catch (error) {
          request.log.error({ error }, "Failed to persist dispute webhook event");
          return reply.status(500).send({ message: "Webhook processing failed" });
        }
      }
    }

    return { received: true };
  }
);

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
