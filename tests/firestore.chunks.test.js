
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

let env;

const projectId = "demo-chunk-integration";
const userId = "test-user";
const documentId = "pdf-test-001";

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });

  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "documents", documentId),
      {
        userId,
        fileName: "test.pdf",
        aiStatus: "ready",
      }
    );
  });
});

after(async () => {
  await env?.cleanup();
});

test("PDF chunks create, read and delete correctly", async () => {
  const ownerDb = env.authenticatedContext(userId).firestore();
  const otherDb = env.authenticatedContext("other-user").firestore();

  const chunksRef = collection(
    ownerDb,
    "documents",
    documentId,
    "chunks"
  );

  const embedding = Array(3072).fill(0.01);

  for (let index = 0; index < 3; index++) {
    await assertSucceeds(
      setDoc(doc(chunksRef, `chunk-${index}`), {
        userId,
        documentId,
        chunkIndex: index,
        pageNumber: index + 1,
        content: `PDF page ${index + 1} content`,
        embedding,
      })
    );
  }

  const snapshot = await assertSucceeds(getDocs(chunksRef));

  assert.equal(snapshot.size, 3);

  const pages = snapshot.docs
    .map((item) => item.data().pageNumber)
    .sort((a, b) => a - b);

  assert.deepEqual(pages, [1, 2, 3]);

  await assertFails(
    getDocs(collection(
      otherDb,
      "documents",
      documentId,
      "chunks"
    ))
  );

  // Delete chunks while parent still exists.
  for (const chunk of snapshot.docs) {
    await assertSucceeds(deleteDoc(chunk.ref));
  }

  const afterCleanup = await assertSucceeds(getDocs(chunksRef));
  assert.equal(afterCleanup.size, 0);

  await assertSucceeds(
    deleteDoc(doc(ownerDb, "documents", documentId))
  );

  // Verify deletion using admin-style emulator access.
await env.withSecurityRulesDisabled(async (context) => {
  const adminDb = context.firestore();

  const parent = await getDoc(
    doc(adminDb, "documents", documentId)
  );

  assert.equal(parent.exists(), false);

  const remaining = await getDocs(
    collection(adminDb, "documents", documentId, "chunks")
  );

  assert.equal(remaining.size, 0);
});

  // Confirm no orphan chunks remain.
  await env.withSecurityRulesDisabled(async (context) => {
    const remaining = await getDocs(
      collection(context.firestore(), "documents", documentId, "chunks")
    );

    assert.equal(remaining.size, 0);
  });
});
