import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const truckLocation = await prisma.location.upsert({
    where: { id: "seed-truck-location" },
    update: {
      name: "Backyard BBQ King Truck",
      type: "truck",
      isActive: true,
      maxCateringCap: 250
    },
    create: {
      id: "seed-truck-location",
      name: "Backyard BBQ King Truck",
      type: "truck",
      isActive: true,
      maxCateringCap: 250
    }
  });

  const shopLocation = await prisma.location.upsert({
    where: { id: "seed-shop-location" },
    update: {
      name: "Backyard BBQ King Smokehouse",
      type: "brick_and_mortar",
      isActive: true,
      maxCateringCap: 500
    },
    create: {
      id: "seed-shop-location",
      name: "Backyard BBQ King Smokehouse",
      type: "brick_and_mortar",
      isActive: true,
      maxCateringCap: 500
    }
  });

  await prisma.menuItem.createMany({
    data: [
      {
        locationId: truckLocation.id,
        name: "Brisket Plate",
        description: "Smoked brisket with two sides",
        basePriceCents: 1899,
        category: "Plates",
        isAvailable: true
      },
      {
        locationId: shopLocation.id,
        name: "Rib Combo",
        description: "Half rack ribs with mac and beans",
        basePriceCents: 2199,
        category: "Combos",
        isAvailable: true
      }
    ],
    skipDuplicates: true
  });

  const customer = await prisma.customer.upsert({
    where: { email: "demo.customer@backyardbbqking.com" },
    update: {},
    create: {
      email: "demo.customer@backyardbbqking.com",
      firstName: "Demo",
      lastName: "Customer"
    }
  });

  const existingBooking = await prisma.cateringBooking.findFirst({
    where: {
      customerId: customer.id,
      notes: "Seed booking for admin dashboard testing"
    },
    select: { id: true }
  });

  if (!existingBooking) {
    await prisma.cateringBooking.create({
      data: {
        customerId: customer.id,
        locationId: shopLocation.id,
        eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        partySize: 90,
        eventAddress: "123 Event Plaza",
        packageName: "Pitmaster Signature",
        status: "approved",
        estimatedTotalCents: 240000,
        depositCents: 60000,
        finalPaymentCents: 180000,
        notes: "Seed booking for admin dashboard testing"
      }
    });
  }

  let order = await prisma.order.findFirst({
    where: {
      customerId: customer.id,
      source: "direct",
      subtotalCents: 3798,
      totalCents: 4802
    },
    select: { id: true }
  });

  if (!order) {
    order = await prisma.order.create({
      data: {
        customerId: customer.id,
        locationId: truckLocation.id,
        source: "direct",
        status: "preparing",
        subtotalCents: 3798,
        taxCents: 304,
        tipCents: 700,
        totalCents: 4802,
        items: {
          create: [
            {
              menuItemName: "Brisket Plate",
              quantity: 2,
              unitPriceCents: 1899
            }
          ]
        }
      },
      select: { id: true }
    });
  }

  // Create PaymentTransaction for the demo order to ensure data integrity
  // (Gross Sales from Orders should match Payment volume)
  const existingPayment = await prisma.paymentTransaction.findFirst({
    where: { orderId: order.id },
    select: { id: true }
  });

  if (!existingPayment) {
    await prisma.paymentTransaction.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        stripePaymentIntentId: "pi_seed_demo_order_" + order.id,
        amountCents: 4802,
        currency: "usd",
        status: "succeeded",
        paymentType: "order"
      }
    });
  }

  await prisma.integrationEvent.createMany({
    data: [
      {
        orderId: order.id,
        channel: "direct",
        eventType: "order.created",
        payload: {
          source: "seed"
        },
        status: "processed"
      }
    ]
  });

  // Keep full menu data aligned with the primary seed path.
  await import("./seed-menu");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
