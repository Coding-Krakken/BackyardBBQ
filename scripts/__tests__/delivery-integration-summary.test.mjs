import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const scriptPath = join(process.cwd(), "scripts", "delivery-integration-summary.mjs");
const fixtureDir = join(tmpdir(), "bbq-delivery-replay-test-fixtures");
const allChannelsFixtureDir = join(tmpdir(), "bbq-delivery-replay-all-channels-test-fixtures");

function runSummary(args = []) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function setupFixtureFiles() {
  mkdirSync(fixtureDir, { recursive: true });

  writeFileSync(join(fixtureDir, "delivery-webhook-replay.json"), JSON.stringify({
    firstAttempt: { ok: true },
    duplicateSuppressed: true
  }));

  writeFileSync(join(fixtureDir, "delivery-dispatch-replay.json"), JSON.stringify({
    first: { ok: true },
    duplicateSuppressed: true
  }));

  writeFileSync(join(fixtureDir, "delivery-action-replay.json"), JSON.stringify({
    firstAction: { ok: true },
    duplicateSuppressed: true
  }));

  writeFileSync(join(fixtureDir, "delivery-settlement-replay.json"), JSON.stringify({
    firstAttempt: { ok: true },
    duplicateSuppressed: true,
    businessKeyDuplicateSuppressed: true,
    dailyClose: { settlementNetCents: 12345 }
  }));
}

function setupAllChannelsFixtureFiles() {
  for (const channel of ["doordash", "ubereats", "grubhub"]) {
    const channelDir = join(allChannelsFixtureDir, channel);
    mkdirSync(channelDir, { recursive: true });

    writeFileSync(join(channelDir, "delivery-webhook-replay.json"), JSON.stringify({
      firstAttempt: { ok: true },
      duplicateSuppressed: true
    }));

    writeFileSync(join(channelDir, "delivery-dispatch-replay.json"), JSON.stringify({
      first: { ok: true },
      duplicateSuppressed: true
    }));

    writeFileSync(join(channelDir, "delivery-action-replay.json"), JSON.stringify({
      firstAction: { ok: true },
      duplicateSuppressed: true
    }));

    writeFileSync(join(channelDir, "delivery-settlement-replay.json"), JSON.stringify({
      firstAttempt: { ok: true },
      duplicateSuppressed: true,
      businessKeyDuplicateSuppressed: true,
      dailyClose: { settlementNetCents: 11111 }
    }));
  }
}

test("fails when require-files is true and artifacts are missing", () => {
  rmSync(fixtureDir, { recursive: true, force: true });

  const result = runSummary(["--input-dir", fixtureDir, "--require-files", "true"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing delivery replay artifacts/);
});

test("passes when require-pass is true and all checks are true", () => {
  setupFixtureFiles();

  const result = runSummary(["--input-dir", fixtureDir, "--require-files", "true", "--require-pass", "true"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Delivery Replay Summary/);
  assert.match(result.stdout, /settlementNetCents/);
});

test("passes consolidated all-channel summary when all channel artifacts exist", () => {
  rmSync(allChannelsFixtureDir, { recursive: true, force: true });
  setupAllChannelsFixtureFiles();

  const result = runSummary([
    "--input-dir",
    allChannelsFixtureDir,
    "--all-channels",
    "true",
    "--require-files",
    "true",
    "--require-pass",
    "true"
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Delivery Replay Summary \(All Channels\)/);
  assert.match(result.stdout, /doordash/);
  assert.match(result.stdout, /ubereats/);
  assert.match(result.stdout, /grubhub/);
});

test("fails consolidated all-channel summary when one channel artifacts are missing", () => {
  rmSync(allChannelsFixtureDir, { recursive: true, force: true });
  setupAllChannelsFixtureFiles();
  rmSync(join(allChannelsFixtureDir, "ubereats", "delivery-action-replay.json"), { force: true });

  const result = runSummary([
    "--input-dir",
    allChannelsFixtureDir,
    "--all-channels",
    "true",
    "--require-files",
    "true"
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing delivery replay artifacts for ubereats/);
});
