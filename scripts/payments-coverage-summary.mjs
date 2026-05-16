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

function formatTable(total) {
  return [
    "## Payments Coverage Summary",
    "",
    "| Metric | Covered % |",
    "| --- | --- |",
    `| Statements | ${total?.statements?.pct ?? "n/a"} |`,
    `| Branches | ${total?.branches?.pct ?? "n/a"} |`,
    `| Functions | ${total?.functions?.pct ?? "n/a"} |`,
    `| Lines | ${total?.lines?.pct ?? "n/a"} |`,
    "",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.input ?? "coverage/coverage-summary.json";
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!existsSync(inputPath)) {
    console.error(`Coverage summary file not found: ${inputPath}`);
    process.exit(1);
  }

  const coverage = JSON.parse(readFileSync(inputPath, "utf8"));
  const markdown = formatTable(coverage.total);

  console.log(markdown);

  if (typeof summaryPath === "string" && summaryPath.length > 0) {
    appendFileSync(summaryPath, `${markdown}\n`, "utf8");
  }
}

main();
