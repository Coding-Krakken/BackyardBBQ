import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __webPrisma: PrismaClient | undefined;
}

function getResolvedDatabaseUrl(urlValue: string | undefined): string | undefined {
  if (!urlValue || process.env.NODE_ENV === "production") {
    return urlValue;
  }

  try {
    const parsed = new URL(urlValue);
    if (parsed.hostname === "host") {
      parsed.hostname = "localhost";
      console.warn("[web/prisma] DATABASE_URL host placeholder detected. Falling back to localhost for local development.");
      return parsed.toString();
    }
  } catch {
    // Keep original value when DATABASE_URL cannot be parsed.
  }

  return urlValue;
}

const resolvedDatabaseUrl = getResolvedDatabaseUrl(process.env.DATABASE_URL);

export const prisma = globalThis.__webPrisma
  ?? new PrismaClient(
    resolvedDatabaseUrl
      ? { datasources: { db: { url: resolvedDatabaseUrl } } }
      : undefined
  );

if (process.env.NODE_ENV !== "production") {
  globalThis.__webPrisma = prisma;
}
