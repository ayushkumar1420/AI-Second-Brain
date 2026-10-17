
import test from "node:test";
import assert from "node:assert/strict";
import { chunkText, chunkPdfPages } from "../frontend/src/utils/chunkText.js";

test("empty text returns no chunks", () => {
  assert.deepEqual(chunkText(""), []);
});

test("short content stays in one chunk", () => {
  assert.deepEqual(chunkText("Hello world"), ["Hello world"]);
});

test("long content is split without losing characters", () => {
  const content = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
  const chunks = chunkText(content, 100, 20);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
});

test("invalid overlap is rejected", () => {
  assert.throws(() => chunkText("Example", 100, 100));
});

test("PDF page numbers are preserved", () => {
  const pages = [
    "Redis supports atomic operations.",
    "Lua scripts help prevent race conditions.",
    "Distributed locks prevent double bookings.",
  ];

  const chunks = chunkPdfPages(pages);
  assert.deepEqual(chunks.map((chunk) => chunk.pageNumber), [1, 2, 3]);
  assert.equal(chunks[2].content, pages[2]);
});
