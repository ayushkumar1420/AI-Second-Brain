import assert from "node:assert/strict";
import { beforeEach, after, mock, test } from "node:test";

// All credentials and upstream calls in this suite are synthetic and offline.
const savedEnv = { ...process.env };
let apps = [];
let verified = [];
let authError;
let requests = [];
let upstream;
mock.module("firebase-admin/app", {
  namedExports: {
    getApps: () => apps,
    cert: (account) => account,
    initializeApp: (options) => { apps.push(options); },
  },
});
mock.module("firebase-admin/auth", {
  namedExports: {
    getAuth: () => ({ verifyIdToken: async (token) => {
      verified.push(token);
      if (authError) throw authError;
      return { uid: "test-user" };
    } }),
  },
});
mock.method(globalThis, "fetch", async (url, options) => {
  requests.push({ url, options });
  if (upstream instanceof Error) throw upstream;
  return upstream;
});
mock.method(console, "error", () => {});
const { default: handler } = await import("../api/gemini.js");

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-only-not-a-key";
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{"project_id":"test-project"}';
  apps = []; verified = []; requests = []; authError = undefined;
  upstream = { ok: true, json: async () => ({ choices: [{ message: { content: " answer " } }] }) };
});
after(() => {
  process.env = savedEnv;
  mock.restoreAll();
});

async function invoke({ method = "POST", token = "test-id-token", body = { action: "generate", input: "hello" } } = {}) {
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
}

test("GET returns 405 without initializing Firebase or calling Gemini", async () => {
  delete process.env.GEMINI_API_KEY;
  const res = await invoke({ method: "GET" });
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, "POST");
  assert.equal(apps.length + requests.length, 0);
});
test("missing server configuration returns 503", async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  assert.equal((await invoke()).code, 503);
  assert.equal(requests.length, 0);
});
test("configured unauthenticated POST returns 401 before Admin initialization", async () => {
  assert.equal((await invoke({ token: null })).code, 401);
  assert.equal(apps.length + requests.length, 0);
});
test("invalid Firebase token returns 401 and never calls Gemini", async () => {
  authError = Object.assign(new Error("invalid token"), { code: "auth/id-token-expired" });
  assert.equal((await invoke()).code, 401);
  assert.deepEqual(verified, ["test-id-token"]);
  assert.equal(requests.length, 0);
});
test("invalid input and unknown action are rejected after authentication", async () => {
  for (const body of [{ action: "generate", input: "" }, { action: "generate", input: "a".repeat(30001) }, { action: "other", input: "hello" }]) {
    assert.equal((await invoke({ body })).code, 400);
  }
  assert.equal(requests.length, 0);
});
test("authenticated generation uses server credentials and reuses Admin app", async () => {
  const res = await invoke();
  assert.equal(res.code, 200);
  assert.equal(res.data.text, "answer");
  assert.match(requests[0].url, /\/chat\/completions$/);
  assert.equal(requests[0].options.headers.Authorization, "Bearer test-only-not-a-key");
  assert.equal(JSON.parse(requests[0].options.body).messages[0].content, "hello");
  await invoke();
  assert.equal(apps.length, 1);
});
test("embedding response and input limit preserve existing behavior", async () => {
  const embedding = Array(3072).fill(0.1);
  upstream = { ok: true, json: async () => ({ data: [{ embedding }] }) };
  const res = await invoke({ body: { action: "embedding", input: "a".repeat(7000) } });
  assert.equal(res.code, 200);
  assert.deepEqual(res.data.embedding, embedding);
  assert.equal(JSON.parse(requests[0].options.body).model, "gemini-embedding-2");
  assert.equal(JSON.parse(requests[0].options.body).input.length, 6000);
});
test("upstream failures and timeouts return controlled errors", async () => {
  upstream = { ok: false, status: 429 };
  assert.equal((await invoke()).code, 429);
  upstream = Object.assign(new Error("timeout"), { name: "TimeoutError" });
  assert.equal((await invoke()).code, 504);
});
test("malformed Admin JSON does not call Gemini or disclose configuration", async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "invalid-test-json";
  const res = await invoke();
  assert.equal(res.code, 503);
  assert.deepEqual(res.data, { error: "Firebase Admin configuration is invalid" });
  assert.equal(requests.length, 0);
});

test("rejects malformed provider embeddings before returning success", async () => {
  for (const embedding of [undefined, [], [0.1], Array(3072).fill(null), Array(3072).fill(Infinity)]) {
    upstream = { ok: true, json: async () => ({ data: [{ embedding }] }) };
    const res = await invoke({ body: { action: "embedding", input: "probe" } });
    assert.equal(res.code, 502);
    assert.match(res.data.error, /3072 finite numbers/);
  }
});

test("provider failures identify stage and status without disclosing provider bodies", async () => {
  upstream = { ok: false, status: 404, json: async () => ({ error: "secret" }) };
  const res = await invoke({ body: { action: "embedding", input: "probe" } });
  assert.equal(res.code, 502);
  assert.equal(res.data.error, "AI provider rejected embedding request (HTTP 404)");
});

test("network and authentication infrastructure failures stay distinct", async () => {
  upstream = new TypeError("sensitive network details");
  assert.match((await invoke()).data.error, /generation request failed/);
  authError = Object.assign(new Error("sensitive SDK details"), { code: "auth/internal-error" });
  const res = await invoke();
  assert.equal(res.code, 503);
  assert.equal(res.data.error, "Authentication service is unavailable");
});
