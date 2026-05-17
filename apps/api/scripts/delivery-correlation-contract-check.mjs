#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) continue;

    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.log(`Usage:\n  node apps/api/scripts/delivery-correlation-contract-check.mjs [--api-base-url http://localhost:4000] [--correlation-id corr_123] [--output-json ./artifacts/delivery-contract-check.json]\n\nEnv fallbacks:\n  API_BASE_URL`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const correlationId = args["correlation-id"]?.trim();
  const outputJson = args["output-json"];

  if (!correlationId) {
    console.error("Missing correlation ID. Use --correlation-id.");
    process.exit(1);
  }

  const url = `${apiBaseUrl.replace(/\/$/, "")}/api/admin/integrations/correlation/${encodeURIComponent(correlationId)}/contract`;
  const response = await fetch(url, {
    headers: {
      "x-admin-role": "owner"
    }
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  const result = {
    correlationId,
    status: response.status,
    ok: response.ok,
    contractPassed: Boolean(body?.result?.passed === true),
    scorePercent: typeof body?.result?.scorePercent === "number" ? body.result.scorePercent : null,
    failedCount: typeof body?.result?.failedCount === "number" ? body.result.failedCount : null,
    checks: Array.isArray(body?.checks)
      ? body.checks.map((check) => ({
          key: check?.key,
          passed: check?.passed,
          details: check?.details
        }))
      : [],
    body
  };

  if (typeof outputJson === "string" && outputJson.trim().length > 0) {
    const normalizedPath = outputJson.trim();
    await mkdir(dirname(normalizedPath), { recursive: true });
    await writeFile(normalizedPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));

  if (!response.ok) {
    process.exit(2);
  }

  if (!result.contractPassed) {
    process.exit(3);
  }
}

main().catch((error) => {
  console.error("delivery-correlation-contract-check failed", error);
  process.exit(99);
});
