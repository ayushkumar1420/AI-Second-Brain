import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { generateEmbedding, summarizeContent } from "./gemini";
import { logActivity } from "./activityService";
import { toPlainText } from "../utils/vector";

const collections = {
  note: "notes",
  document: "documents",
  link: "links",
};

function normalizeDoc(snapshot, type) {
  return { id: snapshot.id, type, ...snapshot.data() };
}

export async function listContent(userId, type, take = 40) {
  const q = query(collection(db, collections[type]), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(take));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => normalizeDoc(item, type));
}

export async function listAllKnowledge(userId) {
  const [notes, documents, links] = await Promise.all([
    listContent(userId, "note", 80),
    listContent(userId, "document", 80),
    listContent(userId, "link", 80),
  ]);
  return [...notes, ...documents, ...links].map((item) => ({
    ...item,
    content: item.content || item.extractedText || item.summary || "",
    title: item.title || item.fileName || item.url || "Untitled",
  }));
}

export async function saveNote(userId, payload) {
  const plain = toPlainText(payload.content);
  const [summary, embedding] = await Promise.all([
    summarizeContent({ title: payload.title, content: plain, type: "note" }),
    generateEmbedding(`${payload.title}\n${plain}`),
  ]);
  const document = await addDoc(collection(db, "notes"), {
    userId,
    title: payload.title,
    content: payload.content,
    summary,
    tags: payload.tags,
    category: payload.category,
    embedding,
    history: [{ content: payload.content, savedAt: new Date().toISOString() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logActivity(userId, "Created note", payload.title);
  return document.id;
}

export async function updateNote(noteId, payload) {
  const plain = toPlainText(payload.content);
  const [summary, embedding] = await Promise.all([
    summarizeContent({ title: payload.title, content: plain, type: "note" }),
    generateEmbedding(`${payload.title}\n${plain}`),
  ]);
  await updateDoc(doc(db, "notes", noteId), {
    ...payload,
    summary,
    embedding,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContent(type, id) {
  await deleteDoc(doc(db, collections[type], id));
}

export async function createLink(userId, payload) {
  const content = payload.content || `Saved URL: ${payload.url}`;
  const [summary, embedding] = await Promise.all([
    summarizeContent({ title: payload.title || payload.url, content, type: "article" }),
    generateEmbedding(`${payload.title}\n${payload.url}\n${content}`),
  ]);
  const document = await addDoc(collection(db, "links"), {
    userId,
    url: payload.url,
    title: payload.title || payload.url,
    content,
    summary,
    tags: payload.tags,
    embedding,
    createdAt: serverTimestamp(),
  });
  await logActivity(userId, "Saved link", payload.url);
  return document.id;
}
