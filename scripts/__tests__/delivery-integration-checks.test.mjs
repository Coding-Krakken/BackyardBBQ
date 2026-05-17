import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "scripts", "delivery-integration-checks.mjs");

function runChecks(args, env = {}) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

test("prints usage with --help", () => {
  const result = runChecks(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /Run modes:/);
});

test("fails on invalid channel", () => {
  const result = runChecks(["--channel", "invalid-channel"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --channel/);
});

test("fails on invalid api base url", () => {
  const result = runChecks(["--api-base-url", "localhost:4000"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid --api-base-url/);
});

test("fails in live mode without webhook secret", () => {
  const result = runChecks([
    "--run-live",
    "true",
    "--channel",
    "doordash"
  ], {
    DOORDASH_WEBHOOK_SECRET: "",
    DELIVERY_WEBHOOK_SECRET: ""
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing webhook secret for live mode/);
});

test("accepts explicit validate-summary flag in non-live mode", () => {
  const result = runChecks(["--run-live", "false", "--validate-summary", "false"]);
  assert.equal(result.status, 0);
});
