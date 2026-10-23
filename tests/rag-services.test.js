import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, test } from "node:test";
import { runChunkIndexing } from "../frontend/src/utils/chunkIndexing.js";
import { rankByEmbedding } from "../frontend/src/utils/vector.js";

// Exercise production services with in-memory Firebase and Gemini boundaries.
// No credentials, network requests, or production writes are used.
const state = { rows: new Map(), knowledge: [], events: [], supplied: [] };
const vector = () => Array(3072).fill(0.1);
const api = {
  db: {}, storage: {}, runChunkIndexing, rankByEmbedding,
  collection: (_db, ...parts) => parts.join("/"),
  doc: (_db, ...parts) => parts.join("/"),
  limit: (n) => n, query: (path, take) => ({ path, take }),
  serverTimestamp: () => 0,
  setDoc: async (path, data) => state.rows.set(path, data),
  getDocs: async (q) => {
    const path = typeof q === "string" ? q : q.path;
    const docs = [...state.rows].filter(([key]) => key.startsWith(path + "/"))
      .slice(0, q.take || Infinity)
      .map(([ref, data]) => ({ ref, id: ref.split("/").at(-1), data: () => data }));
    return { docs, empty: !docs.length };
  },
  getDoc: async () => ({ exists: () => true, data: () => ({ fileUrl: "test-file" }) }),
  deleteDoc: async (path) => { state.events.push(path); state.rows.delete(path); },
  ref: (_storage, path) => path,
  deleteObject: async () => state.events.push("storage"),
  generateEmbedding: async () => vector(),
  listAllKnowledge: async () => state.knowledge,
  answerWithContext: async (_question, sources) => {
    state.supplied = sources;
    return "Mock answer [1]";
  },
};
globalThis.__ragServices = api;

async function loadService(name) {
  const source = (await readFile(new URL(`../frontend/src/services/${name}.js`, import.meta.url), "utf8"))
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, "");
  const locals = new Set([...source.matchAll(/function\s+(\w+)/g)].map((match) => match[1]));
  const prelude = `const { ${Object.keys(api).filter((key) => !locals.has(key)).join(",")} } = globalThis.__ragServices;\n`;
  return import(`data:text/javascript;base64,${Buffer.from(prelude + source).toString("base64")}`);
}
const chunks = await loadService("chunkService");
Object.assign(api, chunks);
const chat = await loadService("chatService");
const content = await loadService("contentService");
Object.assign(api, {
  pdfWorker: "mock-worker",
  pdfjs: {
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 2,
      getPage: async (n) => ({ getTextContent: async () => ({ items: [{ str: `Page ${n}` }] }), cleanup: () => {} }),
      destroy: async () => {},
    }) }),
  },
  uploadBytesResumable: () => ({
    snapshot: { ref: "mock-file" },
    on: (_event, progress, _error, complete) => {
      progress({ totalBytes: 10, bytesTransferred: 10 });
      complete();
    },
  }),
  getDownloadURL: async () => "mock-file-url",
  addDoc: async (path, data) => { state.rows.set(`${path}/uploaded`, data); return { id: "uploaded" }; },
  updateDoc: async (path, patch) => {
    state.rows.set(path, { ...state.rows.get(path), ...patch });
    if (["ready", "failed"].includes(patch.aiStatus)) state.complete?.();
  },
  summarizeContent: async () => { if (state.summaryError) throw new Error("Mock summary failure"); return "Mock summary"; },
  logActivity: async () => {},
});
const upload = await loadService("uploadService");
beforeEach(() => {
  state.rows.clear(); state.knowledge = []; state.events = []; state.supplied = [];
  state.summaryError = false; state.complete = undefined;
});
after(() => { delete globalThis.__ragServices; });

test("page indexing, retrieval, and RAG preserve PDF citations alongside notes, links, and legacy PDFs", async () => {
  assert.equal(await chunks.indexPdfChunks("owner", "pdf", ["Page one", "Page two"]), 2);
  const parent = { id: "pdf", type: "document", fileName: "sample.pdf", aiStatus: "ready", chunkCount: 2, indexVersion: 1 };
  const retrieved = await chunks.listPdfChunks([parent]);
  assert.deepEqual(retrieved.map((row) => row.pageNumber), [1, 2]);
  state.knowledge = [parent,
    { id: "note", type: "note", embedding: vector() },
    { id: "link", type: "link", embedding: vector() },
    { id: "legacy", type: "document", embedding: vector() },
    { id: "failed", type: "document", aiStatus: "failed", embedding: vector() },
    { id: "processing", type: "document", indexVersion: 1, aiStatus: "processing", embedding: vector() },
  ];
  const result = await chat.askKnowledgeBase("owner", "question");
  assert.deepEqual(result.sources.map((row) => row.id), ["note", "link", "legacy", "pdf"]);
  assert.equal(result.sources[3].pageNumber, 1);
  assert.deepEqual(state.supplied, result.sources);
});

test("incomplete, failed, and malformed PDF indexes cannot enter retrieval", async () => {
  await chunks.indexPdfChunks("owner", "pdf", ["Page one"]);
  const parent = { id: "pdf", aiStatus: "ready", chunkCount: 1 };
  for (const candidate of [{ ...parent, chunkCount: 2 }, { ...parent, aiStatus: "failed" }, { ...parent, aiStatus: "processing" }]) {
    assert.deepEqual(await chunks.listPdfChunks([candidate]), []);
  }
  const path = "documents/pdf/chunks/chunk-00000";
  const valid = state.rows.get(path);
  for (const change of [{ embedding: [0.1] }, { embedding: Array(3072).fill(NaN) }, { pageNumber: 0 }, { content: "" }, { documentId: "other" }]) {
    state.rows.set(path, { ...valid, ...change });
    assert.deepEqual(await chunks.listPdfChunks([parent]), []);
  }
});

test("PDF deletion drains multiple chunk batches before parent and storage deletion", async () => {
  for (let n = 0; n < 105; n++) state.rows.set(`documents/pdf/chunks/${n}`, {});
  await content.deleteContent("document", "pdf");
  assert.equal(state.rows.size, 0);
  assert.equal(state.events.length, 107);
  assert.deepEqual(state.events.slice(-2), ["documents/pdf", "storage"]);
});

test("empty retrieval avoids answer generation", async () => {
  const result = await chat.askKnowledgeBase("owner", "question");
  assert.deepEqual(result.sources, []);
  assert.deepEqual(state.supplied, []);
  assert.match(result.answer, /couldn't find/);
});

test("semantic search produces one card per PDF while excluding failed fallback documents", async () => {
  const source = await readFile(new URL("../frontend/src/pages/SearchPage.jsx", import.meta.url), "utf8");
  // Run the page's actual event handler; rendering and React state are test boundaries.
  const handler = source.slice(source.indexOf("  async function runSemanticSearch()"), source.indexOf("\n  const results = semantic"));
  const data = [
    { id: "pdf", type: "document", indexVersion: 1, chunkCount: 2, aiStatus: "ready" },
    { id: "failed", type: "document", aiStatus: "failed", embedding: vector() },
    { id: "legacy", type: "document", embedding: vector() },
  ];
  let result;
  const run = new Function("query", "data", "generateEmbedding", "listPdfChunks", "rankByEmbedding", "setLoading", "setSemantic", "toast",
    `${handler}\nreturn runSemanticSearch();`);
  await run("query", data, api.generateEmbedding, async () => [
    { id: "pdf", type: "document", pageNumber: 1, embedding: vector() },
    { id: "pdf", type: "document", pageNumber: 2, embedding: vector() },
  ], rankByEmbedding, () => {}, (value) => { result = value; }, { error: (message) => assert.fail(message) });
  assert.deepEqual(result.map((item) => item.id), ["legacy", "pdf"]);
  assert.equal(result[1].matchedPage, 1);
});

test("upload orchestration marks the PDF ready after page extraction and chunk persistence", { timeout: 5000 }, async () => {
  const completed = new Promise((resolve) => { state.complete = resolve; });
  const id = await upload.saveDocument("owner", {
    name: "sample.pdf", type: "application/pdf", size: 10, arrayBuffer: async () => new ArrayBuffer(10),
  });
  await completed;
  const parent = state.rows.get(`documents/${id}`);
  assert.equal(parent.aiStatus, "ready");
  assert.equal(parent.chunkCount, 2);
  assert.equal(parent.extractedText, "Page 1\n\nPage 2");
  assert.equal((await chunks.listPdfChunks([{ ...parent, id }])).length, 2);
});

test("summary failure cleans indexed chunks and marks the uploaded PDF failed", { timeout: 5000 }, async () => {
  state.summaryError = true;
  const completed = new Promise((resolve) => { state.complete = resolve; });
  const id = await upload.saveDocument("owner", {
    name: "sample.pdf", type: "application/pdf", size: 10, arrayBuffer: async () => new ArrayBuffer(10),
  });
  await completed;
  const parent = state.rows.get(`documents/${id}`);
  assert.equal(parent.aiStatus, "failed");
  assert.equal(parent.chunkCount, 0);
  assert.equal(state.rows.size, 1);
  assert.match(parent.aiError, /Mock summary failure/);
});
