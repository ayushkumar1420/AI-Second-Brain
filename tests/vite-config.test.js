import assert from "node:assert/strict";
import { test } from "node:test";

test("Vercel-assigned port is honored without a proxy loop", async () => {
  const savedPort = process.env.PORT;
  const savedCli = process.env.VERCEL_CLI_VERSION;
  try {
    process.env.PORT = "45678";
    process.env.VERCEL_CLI_VERSION = "test";
    const { default: config } = await import("../frontend/vite.config.js?vercel-test");
    assert.equal(config.server.port, 45678);
    assert.equal(config.server.strictPort, true);
    assert.equal(config.server.proxy, undefined);
    for (const key of ["GEMINI_API_KEY", "VITE_GEMINI_API_KEY", "FIREBASE_SERVICE_ACCOUNT_JSON", "VERCEL_OIDC_TOKEN"]) {
      assert.equal(config.envPrefix.some(prefix => key.startsWith(prefix)), false);
    }
    delete process.env.PORT;
    delete process.env.VERCEL_CLI_VERSION;
    const { default: standalone } = await import("../frontend/vite.config.js?standalone-test");
    assert.equal(standalone.server.port, 5173);
    assert.equal(standalone.server.proxy["/api"].target, "http://localhost:3000");
  } finally {
    if (savedPort === undefined) delete process.env.PORT; else process.env.PORT = savedPort;
    if (savedCli === undefined) delete process.env.VERCEL_CLI_VERSION; else process.env.VERCEL_CLI_VERSION = savedCli;
  }
});
