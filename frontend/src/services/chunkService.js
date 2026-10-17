
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { generateEmbedding } from "./gemini";
import { chunkPdfPages } from "../utils/chunkText";

const MAX_CHUNKS = 100;
const EMBEDDING_DIMENSIONS = 3072;

export async function indexPdfChunks(userId, documentId, pages) {
  const chunks = chunkPdfPages(pages);

  if (!chunks.length) {
    throw new Error("No readable text found. Scanned PDFs require OCR.");
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`PDF contains ${chunks.length} chunks. Maximum supported is ${MAX_CHUNKS}.`);
  }

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
}
