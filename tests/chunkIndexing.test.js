
import test from "node:test";
import assert from "node:assert/strict";
import { runChunkIndexing } from "../frontend/src/utils/chunkIndexing.js";

const validEmbedding = () => Array(3072).fill(0.01);

function createMockOperations() {
  const saved = new Map();
  let cleanupCalls = 0;

  return {
    saved,
    get cleanupCalls() {
      return cleanupCalls;
    },
    generateEmbedding: async () => validEmbedding(),
    saveChunk: async (chunk) => {
      saved.set(chunk.chunkId, chunk);
    },
    deleteChunks: async () => {
      cleanupCalls++;
      saved.clear();
    },
  };
}

test("indexes PDF pages with correct chunk metadata", async () => {
  const operations = createMockOperations();

  const count = await runChunkIndexing(
    ["Redis supports atomic scripts.", "Firestore stores document chunks."],
    operations
  );

  assert.equal(count, 2);
  assert.equal(operations.saved.size, 2);

  const first = operations.saved.get("chunk-00000");
  const second = operations.saved.get("chunk-00001");

  assert.equal(first.pageNumber, 1);
  assert.equal(second.pageNumber, 2);
  assert.equal(first.chunkIndex, 0);
  assert.equal(second.chunkIndex, 1);
  assert.equal(first.embedding.length, 3072);
  assert.equal(operations.cleanupCalls, 0);
});

test("cleans saved chunks when embedding generation fails", async () => {
  const operations = createMockOperations();
  let calls = 0;

  operations.generateEmbedding = async () => {
    calls++;
    if (calls === 2) throw new Error("Gemini API unavailable");
    return validEmbedding();
  };

  await assert.rejects(
    runChunkIndexing(["First page content", "Second page content"], operations),
    /Gemini API unavailable/
  );

  assert.equal(operations.saved.size, 0);
  assert.equal(operations.cleanupCalls, 1);
});

test("cleans chunks when saving to Firestore fails", async () => {
  const operations = createMockOperations();
  const originalSave = operations.saveChunk;
  let calls = 0;

  operations.saveChunk = async (chunk) => {
    calls++;
    if (calls === 2) throw new Error("Firestore write failed");
    await originalSave(chunk);
  };

  await assert.rejects(
    runChunkIndexing(["First page content", "Second page content"], operations),
    /Firestore write failed/
  );

  assert.equal(operations.saved.size, 0);
  assert.equal(operations.cleanupCalls, 1);
});

test("rejects invalid embedding dimensions", async () => {
  const operations = createMockOperations();
  operations.generateEmbedding = async () => [0.1, 0.2];

  await assert.rejects(
    runChunkIndexing(["Some PDF content"], operations),
    /Invalid embedding/
  );

  assert.equal(operations.saved.size, 0);
});

test("rejects non-finite embedding values", async () => {
  const operations = createMockOperations();
  const embedding = validEmbedding();
  embedding[0] = NaN;
  operations.generateEmbedding = async () => embedding;

  await assert.rejects(
    runChunkIndexing(["Some PDF content"], operations),
    /Invalid embedding/
  );

  assert.equal(operations.saved.size, 0);
});

test("reports errors when cleanup also fails", async () => {
  const operations = createMockOperations();

  operations.generateEmbedding = async () => {
    throw new Error("Gemini API failed");
  };

  operations.deleteChunks = async () => {
    throw new Error("Firestore cleanup denied");
  };

  await assert.rejects(
    runChunkIndexing(["Some PDF content"], operations),
    /Chunk cleanup also failed: Firestore cleanup denied/
  );
});

test("rejects empty PDFs without generating embeddings", async () => {
  const operations = createMockOperations();

  await assert.rejects(
    runChunkIndexing(["", "   "], operations),
    /No readable text found/
  );

  assert.equal(operations.saved.size, 0);
});
