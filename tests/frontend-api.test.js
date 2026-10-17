import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, mock, test } from "node:test";

// Transform only the browser environment and Firebase import; exercise the real service.
const auth = { currentUser: null };
globalThis.__testAuth = auth;
let request;
let response = { ok: true, json: async () => ({ text: "mock answer" }) };
mock.method(globalThis, "fetch", async (url, options) => {
  request = { url, options };
  return response;
});
const source = (await readFile(new URL("../frontend/src/services/gemini.js", import.meta.url), "utf8"))
  .replace('import { auth } from "../firebase/config";', "const auth = globalThis.__testAuth;")
  .replaceAll("import.meta.env", "({})");
const service = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
after(() => { delete globalThis.__testAuth; mock.restoreAll(); });

test("signed-out frontend blocks requests", async () => {
  await assert.rejects(service.generateText("hello"), /Please sign in/);
  assert.equal(request, undefined);
});
test("frontend sends Firebase ID token and JSON to same-origin API", async () => {
  auth.currentUser = { getIdToken: async () => "test-id-token" };
  assert.equal(await service.generateText("hello"), "mock answer");
  assert.equal(request.url, "/api/gemini");
  assert.equal(request.options.headers.Authorization, "Bearer test-id-token");
  assert.deepEqual(JSON.parse(request.options.body), { action: "generate", input: "hello" });
  assert.ok(request.options.signal instanceof AbortSignal);
});
test("frontend surfaces backend errors", async () => {
  response = { ok: false, json: async () => ({ error: "AI service is not configured" }) };
  await assert.rejects(service.generateText("hello"), /AI service is not configured/);
});
