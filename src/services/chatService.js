import { answerWithContext, generateEmbedding } from "./gemini";
import { listAllKnowledge } from "./contentService";
import { rankByEmbedding } from "../utils/vector";

export async function askKnowledgeBase(userId, question) {
  const [knowledge, queryEmbedding] = await Promise.all([listAllKnowledge(userId), generateEmbedding(question)]);
  const sources = rankByEmbedding(knowledge, queryEmbedding, 3);
  const answer = await answerWithContext(question, sources);
  return { answer, sources };
}
