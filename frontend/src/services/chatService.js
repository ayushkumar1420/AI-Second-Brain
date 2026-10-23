
import { answerWithContext, generateEmbedding } from "./gemini";
import { listAllKnowledge } from "./contentService";
import { listPdfChunks } from "./chunkService";
import { rankByEmbedding } from "../utils/vector";

export async function askKnowledgeBase(userId, question) {
  const [knowledge, queryEmbedding] = await Promise.all([
    listAllKnowledge(userId),
    generateEmbedding(question),
  ]);

  const documents = knowledge.filter((item) => item.type === "document");
  const otherKnowledge = knowledge.filter((item) =>
    item.type !== "document" ||
    (!item.indexVersion && !item.chunkCount &&
      (!item.aiStatus || item.aiStatus === "ready"))
  );

  const pdfChunks = await listPdfChunks(documents);

  const sources = rankByEmbedding(
    [...otherKnowledge, ...pdfChunks],
    queryEmbedding,
    4
  );

  if (!sources.length) {
    return {
      answer: "I couldn't find relevant information in your saved knowledge.",
      sources: [],
    };
  }

  const answer = await answerWithContext(question, sources);

  return { answer, sources };
}
