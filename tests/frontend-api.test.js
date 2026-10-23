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

test("query embeddings require the same finite 3072 values as PDF indexing", async () => {
  for (const embedding of [[], [1, 2], Array(3072).fill(null)]) {
    response = { ok: true, json: async () => ({ embedding }) };
    await assert.rejects(service.generateEmbedding("query"), /3072 finite numbers/);
  }
  const embedding = Array(3072).fill(0.1);
  response = { ok: true, json: async () => ({ embedding }) };
  assert.deepEqual(await service.generateEmbedding("query"), embedding);
});

test("RAG prompt carries only supplied sources and their page numbers", async () => {
  response = { ok: true, json: async () => ({ text: "See page 3 [1]." }) };
  assert.equal(await service.answerWithContext("Where?", [
    { title: "PDF", type: "document", pageNumber: 3, content: "Retrieved passage" },
  ]), "See page 3 [1].");
  const prompt = JSON.parse(request.options.body).input;
  assert.match(prompt, /\[1\] PDF\nType: document\nPage: 3/);
  assert.match(prompt, /Do not reference sources that were not provided/);
  assert.doesNotMatch(prompt, /\[2\] PDF/);
});
