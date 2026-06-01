import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { answerWithContext, generateEmbedding } from "./gemini";
import { listAllKnowledge } from "./contentService";
import { rankByEmbedding } from "../utils/vector";

export async function askKnowledgeBase(userId, question) {
  const [knowledge, queryEmbedding] = await Promise.all([listAllKnowledge(userId), generateEmbedding(question)]);
  const sources = rankByEmbedding(knowledge, queryEmbedding, 5);
  const answer = await answerWithContext(question, sources);
  return { answer, sources };
}

export async function saveChat(userId, messages) {
  return addDoc(collection(db, "chats"), {
    userId,
    messages,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateChat(chatId, messages) {
  return updateDoc(doc(db, "chats", chatId), {
    messages,
    updatedAt: serverTimestamp(),
  });
}

export async function listChats(userId) {
  const q = query(collection(db, "chats"), where("userId", "==", userId), orderBy("updatedAt", "desc"), limit(20));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
