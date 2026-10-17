import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const loader = new URL("../backend/local-env.js", import.meta.url).href;

function check({ local = true, production = false, file = true, injected = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "second-brain-env-test-"));
  try {
    // Synthetic test fixture only; never read or modify project credentials.
    if (file) writeFileSync(join(cwd, ".env.local"), "GEMINI_API_KEY=test-only\nFIREBASE_SERVICE_ACCOUNT_JSON={}\n");
    const env = {
      SystemRoot: process.env.SystemRoot || "",
      NODE_ENV: production ? "production" : "development",
      ...(local ? { NOW_REGION: "dev1" } : {}),
      ...(injected ? { GEMINI_API_KEY: "injected-test-only" } : {}),
    };
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      await import(${JSON.stringify(loader)});
      console.log(JSON.stringify({
        key: Boolean(process.env.GEMINI_API_KEY),
        account: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
        preserved: process.env.GEMINI_API_KEY === 'injected-test-only'
      }));
    `], { cwd, env, encoding: "utf8", timeout: 10000 });
    assert.equal(child.status, 0, "isolated env test process must succeed");
    return JSON.parse(child.stdout);
  } finally {
    // This path is created by mkdtemp above and contains only this test's fixture.
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("local Vercel function loads root .env.local", () => {
  assert.deepEqual(check(), { key: true, account: true, preserved: false });
});
test("local env loader preserves injected variables", () => {
  assert.deepEqual(check({ injected: true }), { key: true, account: true, preserved: true });
});
test("production and non-Vercel processes do not read local credentials", () => {
  assert.deepEqual(check({ production: true }), { key: false, account: false, preserved: false });
  assert.deepEqual(check({ local: false }), { key: false, account: false, preserved: false });
});
test("missing local file leaves the existing unconfigured behavior intact", () => {
  assert.deepEqual(check({ file: false }), { key: false, account: false, preserved: false });
});
