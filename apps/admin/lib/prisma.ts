import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __adminPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__adminPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__adminPrisma = prisma;
}
