#!/usr/bin/env node

import { spawnSync } from "node:child_process";

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

function printUsage() {
  console.log(`Usage:\n  node scripts/delivery-integration-checks.mjs [--channel doordash|ubereats|grubhub|all] [--api-base-url http://localhost:4000] [--run-live true] [--webhook-secret secret] [--output-dir artifacts/delivery-replay] [--validate-summary true]\n\nRun modes:\n  --run-live true  Executes replay scripts against a running API service.\n  --run-live false Validates replay command wiring via --help (default).\n\nValidation options:\n  --validate-summary true|false  In live mode, enforce summary file checks (default: true).\n\nEnvironment options:\n  API_BASE_URL\n  DELIVERY_CHANNEL\n  <CHANNEL>_WEBHOOK_SECRET\n  DELIVERY_WEBHOOK_SECRET`);
}

function ensureAbsoluteHttpUrl(value, flagName) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
  } catch {
    throw new Error(`Invalid ${flagName}. Provide an absolute http(s) URL.`);
  }
}

function ensureChannel(value) {
  const allowed = new Set(["doordash", "ubereats", "grubhub", "all"]);
  if (!allowed.has(value)) {
    throw new Error("Invalid --channel. Expected one of: doordash, ubereats, grubhub, all.");
  }
}

function getWebhookSecretForChannel(args, channel) {
  return (
    args["webhook-secret"] ??
    process.env[`${channel.toUpperCase()}_WEBHOOK_SECRET`] ??
    process.env.DELIVERY_WEBHOOK_SECRET
  );
}

function ensureOutputDir(value) {
  if (!value.trim()) {
    throw new Error("Invalid --output-dir. Value cannot be empty.");
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  return 1;
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help === "true" || args.h === "true") {
    printUsage();
    process.exit(0);
  }

  const runLive = args["run-live"] === "true";
  const validateSummary = args["validate-summary"] !== "false";
  const channel = args.channel ?? process.env.DELIVERY_CHANNEL ?? "doordash";
  const apiBaseUrl = args["api-base-url"] ?? process.env.API_BASE_URL ?? "http://localhost:4000";
  const outputDir = args["output-dir"] ?? "artifacts/delivery-replay";

  try {
    ensureChannel(channel);
    ensureAbsoluteHttpUrl(apiBaseUrl, "--api-base-url");
    ensureOutputDir(outputDir);

    if (runLive) {
      const channelsToRun = channel === "all" ? ["doordash", "ubereats", "grubhub"] : [channel];
      for (const channelToRun of channelsToRun) {
        const webhookSecret = getWebhookSecretForChannel(args, channelToRun);
        if (!webhookSecret) {
          throw new Error(
            `Missing webhook secret for live mode on channel ${channelToRun}. Use --webhook-secret or CHANNEL_WEBHOOK_SECRET env var.`
          );
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid delivery integration input.";
    console.error(message);
    printUsage();
    process.exit(1);
  }

  if (!runLive) {
    const helpCommands = [
      ["npm", ["run", "test:delivery:webhook-replay", "--", "--help"]],
      ["npm", ["run", "test:delivery:dispatch-replay", "--", "--help"]],
      ["npm", ["run", "test:delivery:action-replay", "--", "--help"]],
      ["npm", ["run", "test:delivery:settlement-replay", "--", "--help"]]
    ];

    for (const [command, commandArgs] of helpCommands) {
      const exitCode = runCommand(command, commandArgs);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    }

    process.exit(0);
  }

  const channelsToRun = channel === "all" ? ["doordash", "ubereats", "grubhub"] : [channel];

  for (const channelToRun of channelsToRun) {
    const webhookSecret = getWebhookSecretForChannel(args, channelToRun);
    const channelOutputDir = channel === "all" ? `${outputDir}/${channelToRun}` : outputDir;
    const webhookOutput = `${channelOutputDir}/delivery-webhook-replay.json`;
    const dispatchOutput = `${channelOutputDir}/delivery-dispatch-replay.json`;
    const actionOutput = `${channelOutputDir}/delivery-action-replay.json`;
    const settlementOutput = `${channelOutputDir}/delivery-settlement-replay.json`;

    const webhookExit = runCommand("npm", [
      "run",
      "test:delivery:webhook-replay",
      "--",
      "--channel",
      channelToRun,
      "--api-base-url",
      apiBaseUrl,
      "--webhook-secret",
      webhookSecret,
      "--output-json",
      webhookOutput
    ]);
    if (webhookExit !== 0) {
      process.exit(webhookExit);
    }

    const dispatchExit = runCommand("npm", [
      "run",
      "test:delivery:dispatch-replay",
      "--",
      "--channel",
      channelToRun,
      "--api-base-url",
      apiBaseUrl,
      "--output-json",
      dispatchOutput
    ]);
    if (dispatchExit !== 0) {
      process.exit(dispatchExit);
    }

    const actionExit = runCommand("npm", [
      "run",
      "test:delivery:action-replay",
      "--",
      "--channel",
      channelToRun,
      "--action",
      "accept",
      "--api-base-url",
      apiBaseUrl,
      "--output-json",
      actionOutput
    ]);
    if (actionExit !== 0) {
      process.exit(actionExit);
    }

    const settlementExit = runCommand("npm", [
      "run",
      "test:delivery:settlement-replay",
      "--",
      "--channel",
      channelToRun,
      "--api-base-url",
      apiBaseUrl,
      "--webhook-secret",
      webhookSecret,
      "--output-json",
      settlementOutput
    ]);
    if (settlementExit !== 0) {
      process.exit(settlementExit);
    }

    if (validateSummary) {
      const summaryExit = runCommand("npm", [
        "run",
        "report:delivery:integration",
        "--",
        "--input-dir",
        channelOutputDir,
        "--require-files",
        "true",
        "--require-pass",
        "true"
      ]);
      if (summaryExit !== 0) {
        process.exit(summaryExit);
      }
    }
  }

  if (channel === "all" && validateSummary) {
    const consolidatedSummaryExit = runCommand("npm", [
      "run",
      "report:delivery:integration",
      "--",
      "--input-dir",
      outputDir,
      "--all-channels",
      "true",
      "--require-files",
      "true",
      "--require-pass",
      "true"
    ]);
    if (consolidatedSummaryExit !== 0) {
      process.exit(consolidatedSummaryExit);
    }
  }

  process.exit(0);
}

main();
