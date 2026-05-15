/**
 * One-time script: promote a customer to admin role.
 * Usage:  npx tsx packages/database/prisma/make-admin.ts
 * (Run from the repo root with DATABASE_URL set in the environment.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "davidtraversmailbox@gmail.com";

async function main() {
  // Upsert the customer so the script works whether or not the account exists yet.
  const customer = await prisma.customer.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "admin" },
    create: {
      email: ADMIN_EMAIL,
      firstName: "David",
      role: "admin",
      emailVerified: false
    },
    select: { id: true, email: true, role: true }
  });

  console.log("✅  Admin role applied:", customer);
}

main()
  .catch((err) => {
    console.error("❌  make-admin failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
