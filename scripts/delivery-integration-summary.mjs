#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const DELIVERY_CHANNELS = ["doordash", "ubereats", "grubhub"];

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

function buildSummaryMarkdown(summary, title = "Delivery Replay Summary") {
  return [
    `## ${title}`,
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| Webhook firstAttempt.ok | ${summary.webhookFirstOk} |`,
    `| Webhook duplicateSuppressed | ${summary.webhookDuplicateSuppressed} |`,
    `| Dispatch first.ok | ${summary.dispatchFirstOk} |`,
    `| Dispatch duplicateSuppressed | ${summary.dispatchDuplicateSuppressed} |`,
    `| Status firstAttempt.ok | ${summary.statusFirstOk} |`,
    `| Status duplicateSuppressed | ${summary.statusDuplicateSuppressed} |`,
    `| Action first.ok | ${summary.actionFirstOk} |`,
    `| Action duplicateSuppressed | ${summary.actionDuplicateSuppressed} |`,
    `| Settlement first.ok | ${summary.settlementFirstOk} |`,
    `| Settlement duplicateSuppressed | ${summary.settlementDuplicateSuppressed} |`,
    `| Settlement businessKeyDuplicateSuppressed | ${summary.settlementBusinessKeyDuplicateSuppressed} |`,
    `| Settlement ledgerSync.observed | ${summary.settlementLedgerObserved} |`,
    `| Settlement ledgerSync.linkedIds | ${summary.settlementLedgerLinkedIds} |`,
    `| Contract replay passed | ${summary.contractReplayPassed} |`,
    `| Contract replay scorePercent | ${summary.contractReplayScorePercent} |`,
    `| Webhook correlation.consistent | ${summary.webhookCorrelationConsistent} |`,
    `| Dispatch correlation.consistent | ${summary.dispatchCorrelationConsistent} |`,
    `| Status correlation.consistent | ${summary.statusCorrelationConsistent} |`,
    `| Action correlation.consistent | ${summary.actionCorrelationConsistent} |`,
    `| Settlement correlation.consistent | ${summary.settlementCorrelationConsistent} |`,
    `| Correlation IDs | ${summary.correlationIds.join(", ")} |`,
    `| Daily close settlementNetCents | ${summary.settlementNetCents} |`,
    ""
  ].join("\n");
}

function buildSummaryFromArtifacts(inputDir) {
  const webhook = readJsonIfPresent(`${inputDir}/delivery-webhook-replay.json`);
  const dispatch = readJsonIfPresent(`${inputDir}/delivery-dispatch-replay.json`);
  const status = readJsonIfPresent(`${inputDir}/delivery-status-webhook-replay.json`);
  const action = readJsonIfPresent(`${inputDir}/delivery-action-replay.json`);
  const settlement = readJsonIfPresent(`${inputDir}/delivery-settlement-replay.json`);
  const contract = readJsonIfPresent(`${inputDir}/delivery-contract-replay.json`);

  return {
    webhook,
    dispatch,
    status,
    action,
    settlement,
    contract,
    summary: {
      webhookFirstOk: webhook?.firstAttempt?.ok ?? "n/a",
      webhookDuplicateSuppressed: webhook?.duplicateSuppressed ?? "n/a",
      dispatchFirstOk: dispatch?.first?.ok ?? "n/a",
      dispatchDuplicateSuppressed: dispatch?.duplicateSuppressed ?? "n/a",
      statusFirstOk: status?.firstAttempt?.ok ?? "n/a",
      statusDuplicateSuppressed: status?.duplicateSuppressed ?? "n/a",
      actionFirstOk: action?.firstAction?.ok ?? "n/a",
      actionDuplicateSuppressed: action?.duplicateSuppressed ?? "n/a",
      settlementFirstOk: settlement?.firstAttempt?.ok ?? "n/a",
      settlementDuplicateSuppressed: settlement?.duplicateSuppressed ?? "n/a",
      settlementBusinessKeyDuplicateSuppressed:
        settlement?.businessKeyDuplicateSuppressed ?? "n/a",
      settlementLedgerObserved: settlement?.ledgerSync?.observed ?? "n/a",
      settlementLedgerLinkedIds:
        typeof settlement?.ledgerSync?.settlementBatchId === "string" &&
        settlement.ledgerSync.settlementBatchId.length > 0 &&
        typeof settlement?.ledgerSync?.settlementLineId === "string" &&
        settlement.ledgerSync.settlementLineId.length > 0,
      contractReplayPassed: contract?.contractPassed ?? "n/a",
      contractReplayScorePercent: contract?.scorePercent ?? "n/a",
      webhookCorrelationConsistent: webhook?.correlation?.consistent ?? "n/a",
      dispatchCorrelationConsistent: dispatch?.correlation?.consistent ?? "n/a",
      statusCorrelationConsistent: status?.correlation?.consistent ?? "n/a",
      actionCorrelationConsistent: action?.correlation?.consistent ?? "n/a",
      settlementCorrelationConsistent: settlement?.correlation?.consistent ?? "n/a",
      correlationIds: [
        typeof webhook?.correlationId === "string" ? webhook.correlationId : null,
        typeof dispatch?.correlationId === "string" ? dispatch.correlationId : null,
        typeof status?.correlationId === "string" ? status.correlationId : null,
        typeof action?.correlationId === "string" ? action.correlationId : null,
        typeof settlement?.correlationId === "string" ? settlement.correlationId : null
      ].filter((value) => typeof value === "string"),
      settlementNetCents: settlement?.dailyClose?.settlementNetCents ?? "n/a"
    }
  };
}

function validate(summary) {
  const failures = [];
  const checks = [
    ["webhook.firstAttempt.ok", summary.webhookFirstOk === true],
    ["webhook.duplicateSuppressed", summary.webhookDuplicateSuppressed === true],
    ["dispatch.first.ok", summary.dispatchFirstOk === true],
    ["dispatch.duplicateSuppressed", summary.dispatchDuplicateSuppressed === true],
    ["status.firstAttempt.ok", summary.statusFirstOk === true],
    ["status.duplicateSuppressed", summary.statusDuplicateSuppressed === true],
    ["action.first.ok", summary.actionFirstOk === true],
    ["action.duplicateSuppressed", summary.actionDuplicateSuppressed === true],
    ["settlement.first.ok", summary.settlementFirstOk === true],
    ["settlement.duplicateSuppressed", summary.settlementDuplicateSuppressed === true],
    [
      "settlement.businessKeyDuplicateSuppressed",
      summary.settlementBusinessKeyDuplicateSuppressed === true
    ],
    ["settlement.ledgerSync.observed", summary.settlementLedgerObserved === true],
    ["settlement.ledgerSync.linkedIds", summary.settlementLedgerLinkedIds === true],
    ["contract.replayPassed", summary.contractReplayPassed === true],
    ["webhook.correlation.consistent", summary.webhookCorrelationConsistent === true],
    ["dispatch.correlation.consistent", summary.dispatchCorrelationConsistent === true],
    ["status.correlation.consistent", summary.statusCorrelationConsistent === true],
    ["action.correlation.consistent", summary.actionCorrelationConsistent === true],
    ["settlement.correlation.consistent", summary.settlementCorrelationConsistent === true]
  ];

  for (const [name, passed] of checks) {
    if (!passed) {
      failures.push(name);
    }
  }

  return failures;
}

function validateCorrelationTarget(summary, expectedCorrelationId) {
  if (!expectedCorrelationId) {
    return [];
  }

  const uniqueCorrelationIds = Array.from(new Set(summary.correlationIds));
  if (uniqueCorrelationIds.length === 0) {
    return ["correlationId.missing"];
  }

  if (uniqueCorrelationIds.length !== 1) {
    return ["correlationId.not_uniform"];
  }

  if (uniqueCorrelationIds[0] !== expectedCorrelationId) {
    return ["correlationId.mismatch"];
  }

  return [];
}

function buildAllChannelsMarkdown(channelSummaries) {
  const lines = [
    "## Delivery Replay Summary (All Channels)",
    "",
    "| Channel | Webhook | Dispatch | Status | Action | Settlement | Business Key | Contract |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const [channel, summary] of channelSummaries) {
    lines.push(
      `| ${channel} | ${summary.webhookFirstOk === true && summary.webhookDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.dispatchFirstOk === true && summary.dispatchDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.statusFirstOk === true && summary.statusDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.actionFirstOk === true && summary.actionDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.settlementFirstOk === true && summary.settlementDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.settlementBusinessKeyDuplicateSuppressed === true ? "pass" : "fail"} | ${summary.contractReplayPassed === true ? "pass" : "fail"} |`
    );
  }

  lines.push("");

  for (const [channel, summary] of channelSummaries) {
    lines.push(buildSummaryMarkdown(summary, `Delivery Replay Summary (${channel})`));
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const inputDir = args["input-dir"] ?? "artifacts/delivery-replay";
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const requireFiles = args["require-files"] === "true";
  const requirePass = args["require-pass"] === "true";
  const correlationId = args["correlation-id"];

  const allChannels = args["all-channels"] === "true";

  if (allChannels) {
    const channelSummaries = new Map();

    for (const channel of DELIVERY_CHANNELS) {
      const artifacts = buildSummaryFromArtifacts(`${inputDir}/${channel}`);
      if (
        requireFiles &&
        (!artifacts.webhook || !artifacts.dispatch || !artifacts.status || !artifacts.action || !artifacts.settlement || !artifacts.contract)
      ) {
        console.error(`Missing delivery replay artifacts for ${channel} under ${inputDir}/${channel}.`);
        process.exit(1);
      }

      channelSummaries.set(channel, artifacts.summary);
    }

    const markdown = buildAllChannelsMarkdown(channelSummaries);
    console.log(markdown);

    if (requirePass) {
      const failures = [];
      for (const [channel, summary] of channelSummaries) {
        const channelFailures = validate(summary);
        for (const failure of channelFailures) {
          failures.push(`${channel}:${failure}`);
        }
        const correlationFailures = validateCorrelationTarget(summary, correlationId);
        for (const failure of correlationFailures) {
          failures.push(`${channel}:${failure}`);
        }
      }
      if (failures.length > 0) {
        console.error(`Delivery replay validation failed: ${failures.join(", ")}`);
        process.exit(1);
      }
    }

    if (typeof summaryPath === "string" && summaryPath.length > 0) {
      appendFileSync(summaryPath, `${markdown}\n`, "utf8");
    }

    return;
  }

  const artifacts = buildSummaryFromArtifacts(inputDir);

  if (requireFiles && (!artifacts.webhook || !artifacts.dispatch || !artifacts.status || !artifacts.action || !artifacts.settlement || !artifacts.contract)) {
    console.error(`Missing delivery replay artifacts under ${inputDir}.`);
    process.exit(1);
  }

  const markdown = buildSummaryMarkdown(artifacts.summary);
  console.log(markdown);

  if (requirePass) {
    const failures = [
      ...validate(artifacts.summary),
      ...validateCorrelationTarget(artifacts.summary, correlationId)
    ];
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
