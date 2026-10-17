
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

let env;
const projectId = "demo-no-project";
const embedding = Array(3072).fill(0.01);

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

after(async () => {
  await env?.cleanup();
});

test("PDF chunk ownership and validation", async () => {
  const ownerId = "user-A";
  const otherId = "user-B";
  const documentId = "test-document";

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "documents", documentId), {
      userId: ownerId,
      fileName: "test.pdf",
    });
  });

  const ownerDb = env.authenticatedContext(ownerId).firestore();
  const otherDb = env.authenticatedContext(otherId).firestore();

  const chunkRef = doc(ownerDb, "documents", documentId, "chunks", "chunk-001");

  const validChunk = {
    userId: ownerId,
    documentId,
    chunkIndex: 0,
    pageNumber: 1,
    content: "Redis distributed locking",
    embedding,
  };

  await assertSucceeds(setDoc(chunkRef, validChunk));
  await assertSucceeds(getDoc(chunkRef));

  const otherChunkRef = doc(otherDb, "documents", documentId, "chunks", "chunk-001");

  await assertFails(getDoc(otherChunkRef));

  await assertFails(
    setDoc(doc(otherDb, "documents", documentId, "chunks", "unauthorized"), {
      ...validChunk,
      userId: otherId,
    })
  );

  await assertFails(updateDoc(chunkRef, { userId: otherId }));
  await assertFails(updateDoc(chunkRef, { documentId: "another-document" }));
  await assertFails(updateDoc(chunkRef, { content: "" }));
  await assertFails(updateDoc(chunkRef, { embedding: [0.1, 0.2] }));

  await assertSucceeds(deleteDoc(chunkRef));

  assert.ok(true);
});
