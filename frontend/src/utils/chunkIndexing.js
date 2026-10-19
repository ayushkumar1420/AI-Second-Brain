
import { chunkPdfPages } from "./chunkText.js";

const MAX_CHUNKS = 100;
const EMBEDDING_DIMENSIONS = 3072;

export async function runChunkIndexing(pages, operations) {
  const { generateEmbedding, saveChunk, deleteChunks } = operations;
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

      if (
        !Array.isArray(embedding) ||
        embedding.length !== EMBEDDING_DIMENSIONS ||
        !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
      ) {
        throw new Error(`Invalid embedding returned for chunk ${index + 1}.`);
      }

      await saveChunk({
        chunkId: `chunk-${String(index).padStart(5, "0")}`,
        chunkIndex: index,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        embedding,
      });
    }

    return chunks.length;
  } catch (error) {
    try {
      await deleteChunks();
    } catch (cleanupError) {
      throw new Error(
        `PDF indexing failed: ${error.message}. Chunk cleanup also failed: ${cleanupError.message}`
      );
    }

    throw error;
  }
}
