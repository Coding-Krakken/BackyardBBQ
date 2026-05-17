import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { verifyHmacSha256Signature } from "../utils/verifyHmac";

export default async function deliveryRoutes(app: FastifyInstance) {
  app.post("/api/webhooks/delivery/:channel/orders", async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const rawBody = request.rawBody as string;
    const signature = request.headers["x-delivery-signature"] as string;

    // Verify signature
    const secret = process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret || !verifyHmacSha256Signature({ rawBody, signature, secret })) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    // Process the order
    const payload = JSON.stringify(request.body);
    await prisma.integrationEvent.create({
      data: {
        channel,
        eventType: "delivery.order.received",
        payload,
        status: "received", // Add required status property
      },
    });

    reply.status(200).send({ success: true });
  });

  app.post("/api/webhooks/delivery/:channel/status", async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const rawBody = request.rawBody as string;
    const signature = request.headers["x-delivery-signature"] as string;

    // Verify signature
    const secret = process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret || !verifyHmacSha256Signature({ rawBody, signature, secret })) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    // Process the status update
    const payload = JSON.stringify(request.body);
    await prisma.integrationEvent.create({
      data: {
        channel,
        eventType: "delivery.status.update",
        payload,
        status: "updated", // Add required status property
      },
    });

    reply.status(200).send({ success: true });
  });

  app.post("/api/webhooks/delivery/:channel/settlements", async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const rawBody = request.rawBody as string;
    const signature = request.headers["x-delivery-signature"] as string;

    // Verify signature
    const secret = process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret || !verifyHmacSha256Signature({ rawBody, signature, secret })) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    // Process the settlement
    const payload = JSON.stringify(request.body);
    await prisma.integrationEvent.create({
      data: {
        channel,
        eventType: "delivery.settlement.received",
        payload,
        status: "received", // Add required status property
      },
    });

    reply.status(200).send({ success: true });
  });
}