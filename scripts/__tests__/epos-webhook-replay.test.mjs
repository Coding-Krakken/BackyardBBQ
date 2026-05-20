import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const scriptPath = join(process.cwd(), "apps", "api", "scripts", "epos-webhook-replay.mjs");

function runReplay(args, env = {}) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("prints usage with --help", () => {
  const result = runReplay(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /EPOS_NOW_WEBHOOK_SECRET/);
});

test("fails when webhook secret is missing", () => {
  const result = runReplay([], {
    EPOS_NOW_WEBHOOK_SECRET: "",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing webhook secret/);
});

test("fails on unsupported event type", () => {
  const result = runReplay([
    "--event-type",
    "999",
  ], {
    EPOS_NOW_WEBHOOK_SECRET: "epos_secret_dummy",
  });

  assert.equal(result.status, 99);
  assert.match(result.stderr, /Invalid --event-type/);
});
