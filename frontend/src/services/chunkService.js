
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
import { chunkPdfPages } from "../utils/chunkText";

const MAX_CHUNKS = 100;
const EMBEDDING_DIMENSIONS = 3072;

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
  const chunks = chunkPdfPages(pages);

  if (!chunks.length) {
    throw new Error("No readable text found. Scanned PDFs require OCR.");
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`PDF contains ${chunks.length} chunks. Maximum supported is ${MAX_CHUNKS}.`);
  }

  try {
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const embedding = await generateEmbedding(chunk.content);

      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Invalid embedding returned for chunk ${index + 1}.`);
      }

      const chunkId = `chunk-${String(index).padStart(5, "0")}`;

      await setDoc(
        doc(db, "documents", documentId, "chunks", chunkId),
        {
          userId,
          documentId,
          chunkIndex: index,
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          embedding,
          createdAt: serverTimestamp(),
        }
      );
    }

    return chunks.length;
  } catch (error) {
    try {
      await deletePdfChunks(documentId);
    } catch (cleanupError) {
      throw new Error(
        `PDF indexing failed: ${error.message}. Chunk cleanup also failed: ${cleanupError.message}`
      );
    }

    throw error;
  }
}
