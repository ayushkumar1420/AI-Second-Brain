
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
