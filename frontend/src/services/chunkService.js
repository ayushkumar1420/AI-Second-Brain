import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { generateEmbedding } from "./gemini";
import { runChunkIndexing } from "../utils/chunkIndexing";

export async function deletePdfChunks(documentId) {
  const chunksRef = collection(db, "documents", documentId, "chunks");
  let hasMore = true;

  while (hasMore) {
    const snapshot = await getDocs(query(chunksRef, limit(100)));

    if (snapshot.empty) {
      hasMore = false;
      continue;
    }

    for (const chunk of snapshot.docs) {
      await deleteDoc(chunk.ref);
    }
  }
}

export async function indexPdfChunks(userId, documentId, pages) {
  return runChunkIndexing(pages, {
    generateEmbedding,

    saveChunk: async (chunk) => {
      await setDoc(
        doc(db, "documents", documentId, "chunks", chunk.chunkId),
        {
          userId,
          documentId,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          embedding: chunk.embedding,
          createdAt: serverTimestamp(),
        }
      );
    },

    deleteChunks: () => deletePdfChunks(documentId),
  });
}


export async function listPdfChunks(documents, maxDocuments = 20) {
  const readyDocuments = documents
    .filter((item) => item.aiStatus === "ready" && item.chunkCount > 0)
    .slice(0, maxDocuments);

  const results = [];

  for (const document of readyDocuments) {
    const chunksRef = collection(db, "documents", document.id, "chunks");
    const snapshot = await getDocs(chunksRef);
    // A ready parent alone cannot make a partial or corrupt index retrievable.
    if (snapshot.docs.length !== document.chunkCount) continue;
    const valid = snapshot.docs.every((chunk) => {
      const data = chunk.data();
      return data.documentId === document.id &&
        Number.isInteger(data.pageNumber) && data.pageNumber > 0 &&
        typeof data.content === "string" && data.content.trim().length > 0 &&
        Array.isArray(data.embedding) && data.embedding.length === 3072 &&
        data.embedding.every((value) => typeof value === "number" && Number.isFinite(value));
    });
    if (!valid) continue;

    for (const chunk of snapshot.docs) {
      const data = chunk.data();

      results.push({
        id: document.id,
        chunkId: chunk.id,
        type: "document",
        title: document.fileName || "Untitled PDF",
        content: data.content,
        embedding: data.embedding,
        pageNumber: data.pageNumber,
        documentId: document.id,
        fileUrl: document.fileUrl,
      });
    }
  }

  return results;
}
