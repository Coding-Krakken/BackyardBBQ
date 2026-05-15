import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __bbqPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__bbqPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bbqPrisma = prisma;
}
