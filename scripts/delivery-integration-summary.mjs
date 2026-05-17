#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from "node:fs";

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

function buildSummaryMarkdown(summary) {
  return [
    "## Delivery Replay Summary",
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| Webhook firstAttempt.ok | ${summary.webhookFirstOk} |`,
    `| Webhook duplicateSuppressed | ${summary.webhookDuplicateSuppressed} |`,
    `| Dispatch first.ok | ${summary.dispatchFirstOk} |`,
    `| Dispatch duplicateSuppressed | ${summary.dispatchDuplicateSuppressed} |`,
    `| Action first.ok | ${summary.actionFirstOk} |`,
    `| Action duplicateSuppressed | ${summary.actionDuplicateSuppressed} |`,
    `| Settlement first.ok | ${summary.settlementFirstOk} |`,
    `| Settlement duplicateSuppressed | ${summary.settlementDuplicateSuppressed} |`,
    `| Settlement businessKeyDuplicateSuppressed | ${summary.settlementBusinessKeyDuplicateSuppressed} |`,
    `| Daily close settlementNetCents | ${summary.settlementNetCents} |`,
    ""
  ].join("\n");
}

function validate(summary) {
  const failures = [];
  const checks = [
    ["webhook.firstAttempt.ok", summary.webhookFirstOk === true],
    ["webhook.duplicateSuppressed", summary.webhookDuplicateSuppressed === true],
    ["dispatch.first.ok", summary.dispatchFirstOk === true],
    ["dispatch.duplicateSuppressed", summary.dispatchDuplicateSuppressed === true],
    ["action.first.ok", summary.actionFirstOk === true],
    ["action.duplicateSuppressed", summary.actionDuplicateSuppressed === true],
    ["settlement.first.ok", summary.settlementFirstOk === true],
    ["settlement.duplicateSuppressed", summary.settlementDuplicateSuppressed === true],
    [
      "settlement.businessKeyDuplicateSuppressed",
      summary.settlementBusinessKeyDuplicateSuppressed === true
    ]
  ];

  for (const [name, passed] of checks) {
    if (!passed) {
      failures.push(name);
    }
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv);
  const inputDir = args["input-dir"] ?? "artifacts/delivery-replay";
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const requireFiles = args["require-files"] === "true";
  const requirePass = args["require-pass"] === "true";

  const webhook = readJsonIfPresent(`${inputDir}/delivery-webhook-replay.json`);
  const dispatch = readJsonIfPresent(`${inputDir}/delivery-dispatch-replay.json`);
  const action = readJsonIfPresent(`${inputDir}/delivery-action-replay.json`);
  const settlement = readJsonIfPresent(`${inputDir}/delivery-settlement-replay.json`);

  if (requireFiles && (!webhook || !dispatch || !action || !settlement)) {
    console.error(`Missing delivery replay artifacts under ${inputDir}.`);
    process.exit(1);
  }

  const summary = {
    webhookFirstOk: webhook?.firstAttempt?.ok ?? "n/a",
    webhookDuplicateSuppressed: webhook?.duplicateSuppressed ?? "n/a",
    dispatchFirstOk: dispatch?.first?.ok ?? "n/a",
    dispatchDuplicateSuppressed: dispatch?.duplicateSuppressed ?? "n/a",
    actionFirstOk: action?.firstAction?.ok ?? "n/a",
    actionDuplicateSuppressed: action?.duplicateSuppressed ?? "n/a",
    settlementFirstOk: settlement?.firstAttempt?.ok ?? "n/a",
    settlementDuplicateSuppressed: settlement?.duplicateSuppressed ?? "n/a",
    settlementBusinessKeyDuplicateSuppressed:
      settlement?.businessKeyDuplicateSuppressed ?? "n/a",
    settlementNetCents: settlement?.dailyClose?.settlementNetCents ?? "n/a"
  };

  const markdown = buildSummaryMarkdown(summary);
  console.log(markdown);

  if (requirePass) {
    const failures = validate(summary);
    if (failures.length > 0) {
      console.error(`Delivery replay validation failed: ${failures.join(", ")}`);
      process.exit(1);
    }
  }

  if (typeof summaryPath === "string" && summaryPath.length > 0) {
    appendFileSync(summaryPath, `${markdown}\n`, "utf8");
  }
}

main();
