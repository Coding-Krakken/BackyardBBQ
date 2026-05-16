#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync } from "node:fs";

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

function buildSummaryMarkdown(checkout, dispute) {
  const lines = [
    "## Stripe Replay Summary",
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| Checkout firstAttempt.ok | ${checkout?.firstAttempt?.ok ?? "n/a"} |`,
    `| Checkout secondAttempt.ok | ${checkout?.secondAttempt?.ok ?? "n/a"} |`,
    `| Checkout duplicateSuppressed | ${checkout?.duplicateSuppressed ?? "n/a"} |`,
    `| Dispute firstAttempt.ok | ${dispute?.firstAttempt?.ok ?? "n/a"} |`,
    `| Dispute secondAttempt.ok | ${dispute?.secondAttempt?.ok ?? "n/a"} |`,
    `| Dispute duplicateSuppressed | ${dispute?.duplicateSuppressed ?? "n/a"} |`,
    `| Dispute lookup status | ${dispute?.disputesLookup?.status ?? "n/a"} |`,
    `| Dispute lookup found | ${dispute?.disputesLookup?.found ?? "n/a"} |`,
    "",
  ];

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const inputDir = args["input-dir"] ?? "artifacts/stripe-replay";
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  const checkout = readJsonIfPresent(`${inputDir}/checkout-replay.json`);
  const dispute = readJsonIfPresent(`${inputDir}/dispute-replay.json`);

  const markdown = buildSummaryMarkdown(checkout, dispute);
  console.log(markdown);

  if (typeof summaryPath === "string" && summaryPath.length > 0) {
    appendFileSync(summaryPath, `${markdown}\n`, "utf8");
  }
}

main();
