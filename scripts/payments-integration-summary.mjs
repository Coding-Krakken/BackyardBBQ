#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync } from "node:fs";

const SUPPORTED_PROVIDERS = new Set(["stripe", "epos"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) {
      continue;
    }

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

function readJsonIfPresent(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function normalizeProvider(value) {
  const provider = (value ?? "stripe").trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error("Invalid provider. Expected stripe or epos.");
  }

  return provider;
}

function buildSummaryMarkdown(provider, checkout, dispute) {
  const lines = [
    `## ${provider === "epos" ? "EPOS" : "Stripe"} Replay Summary`,
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| Provider | ${provider} |`,
    `| Checkout firstAttempt.ok | ${checkout?.firstAttempt?.ok ?? "n/a"} |`,
    `| Checkout secondAttempt.ok | ${checkout?.secondAttempt?.ok ?? "n/a"} |`,
    `| Checkout duplicateSuppressed | ${checkout?.duplicateSuppressed ?? "n/a"} |`,
    "",
  ];

  if (provider === "stripe") {
    lines.splice(
      lines.length - 1,
      0,
      `| Dispute firstAttempt.ok | ${dispute?.firstAttempt?.ok ?? "n/a"} |`,
      `| Dispute secondAttempt.ok | ${dispute?.secondAttempt?.ok ?? "n/a"} |`,
      `| Dispute duplicateSuppressed | ${dispute?.duplicateSuppressed ?? "n/a"} |`,
      `| Dispute lookup status | ${dispute?.disputesLookup?.status ?? "n/a"} |`,
      `| Dispute lookup found | ${dispute?.disputesLookup?.found ?? "n/a"} |`
    );
  }

  return lines.join("\n");
}

function validateReplayResults(provider, checkout, dispute) {
  const failures = [];

  const requiredChecks = [
    ["checkout.firstAttempt.ok", checkout?.firstAttempt?.ok === true],
    ["checkout.secondAttempt.ok", checkout?.secondAttempt?.ok === true],
    ["checkout.duplicateSuppressed", checkout?.duplicateSuppressed === true],
  ];

  if (provider === "stripe") {
    requiredChecks.push(
      ["dispute.firstAttempt.ok", dispute?.firstAttempt?.ok === true],
      ["dispute.secondAttempt.ok", dispute?.secondAttempt?.ok === true],
      ["dispute.duplicateSuppressed", dispute?.duplicateSuppressed === true],
      ["dispute.disputesLookup.found", dispute?.disputesLookup?.found === true]
    );
  }

  for (const [name, passed] of requiredChecks) {
    if (!passed) {
      failures.push(name);
    }
  }

  if (provider === "stripe") {
    const lookupStatus = dispute?.disputesLookup?.status;
    if (typeof lookupStatus !== "number" || lookupStatus < 200 || lookupStatus >= 300) {
      failures.push("dispute.disputesLookup.status");
    }
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv);
  const provider = normalizeProvider(args.provider ?? process.env.PAYMENT_PROVIDER ?? "stripe");
  const inputDir = args["input-dir"] ?? `artifacts/${provider}-replay`;
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const requireFiles = args["require-files"] === "true";
  const requirePass = args["require-pass"] === "true";

  const checkout = readJsonIfPresent(`${inputDir}/checkout-replay.json`);
  const dispute = readJsonIfPresent(`${inputDir}/dispute-replay.json`);

  const missingRequired =
    provider === "stripe"
      ? !checkout || !dispute
      : !checkout;

  if (requireFiles && missingRequired) {
    console.error(
      provider === "stripe"
        ? `Missing replay summary input files under ${inputDir}. Expected checkout-replay.json and dispute-replay.json.`
        : `Missing replay summary input files under ${inputDir}. Expected checkout-replay.json for provider epos.`
    );
    process.exit(1);
  }

  const markdown = buildSummaryMarkdown(provider, checkout, dispute);
  console.log(markdown);

  if (requirePass) {
    const failures = validateReplayResults(provider, checkout, dispute);
    if (failures.length > 0) {
      console.error(
        `Replay validation failed. Expected passing checks for: ${failures.join(", ")}.`
      );
      process.exit(1);
    }
  }

  if (typeof summaryPath === "string" && summaryPath.length > 0) {
    appendFileSync(summaryPath, `${markdown}\n`, "utf8");
  }
}

main();
