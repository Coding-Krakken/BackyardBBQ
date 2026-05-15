import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __webPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__webPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__webPrisma = prisma;
}
