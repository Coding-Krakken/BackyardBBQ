#!/usr/bin/env node
/**
 * Validate Data Integrity Script
 *
 * Runs data integrity checks when DATABASE_URL is available.
 * Safe for local/dev/CI usage where DB access may be intentionally absent.
 *
 * Behavior:
 * - If SKIP_DATA_INTEGRITY=1, exits 0.
 * - If DATABASE_URL is missing, exits 0 with guidance.
 * - Otherwise runs the integrity checker and exits with its status.
 */

import { spawn } from "node:child_process";

const shouldSkip = process.env.SKIP_DATA_INTEGRITY === "1";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (shouldSkip) {
  console.log("Data integrity validation skipped (SKIP_DATA_INTEGRITY=1).");
  process.exit(0);
}

if (!hasDatabaseUrl) {
  console.log("Data integrity validation skipped (DATABASE_URL not set).");
  console.log("Set DATABASE_URL to enable database integrity enforcement.");
  process.exit(0);
}

console.log("Running data integrity validation...");

const child = spawn(process.execPath, ["scripts/data-integrity-check.mjs"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Failed to run data integrity validation:", error);
  process.exit(1);
});
