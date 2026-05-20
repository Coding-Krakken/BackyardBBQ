import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const scriptPath = join(process.cwd(), "scripts", "payments-integration-summary.mjs");

function runSummary(args) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function createTempDir() {
  return mkdtempSync(join(tmpdir(), "bbq-replay-summary-"));
}

test("prints n/a summary when files are missing in non-strict mode", () => {
  const dir = createTempDir();

  try {
    const result = runSummary(["--input-dir", dir]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Stripe Replay Summary/);
    assert.match(result.stdout, /Provider \| stripe/);
    assert.match(result.stdout, /Checkout firstAttempt.ok \| n\/a/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("passes epos require-pass with checkout replay only", () => {
  const dir = createTempDir();

  try {
    writeFileSync(
      join(dir, "checkout-replay.json"),
      JSON.stringify({
        firstAttempt: { ok: true },
        secondAttempt: { ok: true },
        duplicateSuppressed: true,
      }),
      "utf8"
    );

    const result = runSummary([
      "--provider",
      "epos",
      "--input-dir",
      dir,
      "--require-files",
      "true",
      "--require-pass",
      "true",
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /EPOS Replay Summary/);
    assert.match(result.stdout, /Provider \| epos/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when files are missing in require-files mode", () => {
  const dir = createTempDir();

  try {
    const result = runSummary(["--input-dir", dir, "--require-files", "true"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing replay summary input files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("passes require-pass when all replay checks are true", () => {
  const dir = createTempDir();

  try {
    writeFileSync(
      join(dir, "checkout-replay.json"),
      JSON.stringify({
        firstAttempt: { ok: true },
        secondAttempt: { ok: true },
        duplicateSuppressed: true,
      }),
      "utf8"
    );

    writeFileSync(
      join(dir, "dispute-replay.json"),
      JSON.stringify({
        firstAttempt: { ok: true },
        secondAttempt: { ok: true },
        duplicateSuppressed: true,
        disputesLookup: { status: 200, found: true },
      }),
      "utf8"
    );

    const result = runSummary([
      "--input-dir",
      dir,
      "--require-files",
      "true",
      "--require-pass",
      "true",
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Dispute lookup status \| 200/);
    assert.match(result.stdout, /Dispute lookup found \| true/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails require-pass when replay checks are false", () => {
  const dir = createTempDir();

  try {
    writeFileSync(
      join(dir, "checkout-replay.json"),
      JSON.stringify({
        firstAttempt: { ok: true },
        secondAttempt: { ok: true },
        duplicateSuppressed: true,
      }),
      "utf8"
    );

    writeFileSync(
      join(dir, "dispute-replay.json"),
      JSON.stringify({
        firstAttempt: { ok: true },
        secondAttempt: { ok: false },
        duplicateSuppressed: false,
        disputesLookup: { status: 500, found: false },
      }),
      "utf8"
    );

    const result = runSummary([
      "--input-dir",
      dir,
      "--require-files",
      "true",
      "--require-pass",
      "true",
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Replay validation failed/);
    assert.match(result.stderr, /dispute.secondAttempt.ok/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
