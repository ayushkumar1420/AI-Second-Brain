import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
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

function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => timestampToMs(b.createdAt || b.uploadedAt || b.updatedAt) - timestampToMs(a.createdAt || a.uploadedAt || a.updatedAt));
}

function formatFirestoreError(error, type) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return `Firestore denied loading ${type}s. Check firestore.rules and the signed-in user ID.`;
  if (code.includes("failed-precondition")) return `Firestore needs an index or query change before loading ${type}s.`;
  if (code.includes("unauthenticated")) return `You must be signed in before loading ${type}s.`;
  return error?.message || `Could not load ${type}s from Firestore.`;
}

export async function listContent(userId, type, take = 80) {
  const startedAt = performance.now();
  try {
    const q = query(collection(db, collections[type]), where("userId", "==", userId), limit(take));
    const snapshot = await getDocs(q);
    const items = sortNewestFirst(snapshot.docs.map((item) => normalizeDoc(item, type)));
    console.info(`[SecondBrain] Loaded ${items.length} ${type}s in ${Math.round(performance.now() - startedAt)}ms`);
    return items;
  } catch (error) {
    console.error(`[SecondBrain] Failed to load ${type}s`, error);
    throw new Error(formatFirestoreError(error, type));
  }
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
  const document = await addDoc(collection(db, "notes"), {
    userId,
    title: payload.title,
    content: payload.content,
    summary: "Processing AI summary...",
    tags: payload.tags,
    category: payload.category,
    embedding: [],
    aiStatus: "processing",
    history: [{ content: payload.content, savedAt: new Date().toISOString() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  enrichNote(document.id, payload.title, plain).catch(() => {});
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

export async function updateDocument(documentId, payload, extractedText) {
  const [summary, embedding] = await Promise.all([
    summarizeContent({ title: payload.fileName, content: extractedText, type: "PDF" }),
    generateEmbedding(`${payload.fileName}\n${extractedText}`),
  ]);
  await updateDoc(doc(db, "documents", documentId), {
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

async function enrichNote(noteId, title, plain) {
  try {
    const [summary, embedding] = await Promise.all([
      summarizeContent({ title, content: plain, type: "note" }),
      generateEmbedding(`${title}\n${plain}`),
    ]);
    await updateDoc(doc(db, "notes", noteId), {
      summary,
      embedding,
      aiStatus: "ready",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await updateDoc(doc(db, "notes", noteId), {
      summary: plain.slice(0, 600) || "AI summary is not available yet.",
      aiStatus: "failed",
      aiError: error.message,
      updatedAt: serverTimestamp(),
    });
  }
}
