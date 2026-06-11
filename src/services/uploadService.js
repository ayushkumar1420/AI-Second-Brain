import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { generateEmbedding, summarizeContent } from "./gemini";
import { logActivity } from "./activityService";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await page.getTextContent();
    pages.push(text.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

export function uploadFile(userId, file, onProgress) {
  const path = `users/${userId}/documents/${Date.now()}-${file.name}`;
  const task = uploadBytesResumable(ref(storage, path), file);
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export async function saveDocument(userId, file, onProgress) {
  const [fileUrl, extractedText] = await Promise.all([uploadFile(userId, file, onProgress), extractPdfText(file)]);
  const document = await addDoc(collection(db, "documents"), {
    userId,
    fileName: file.name,
    fileUrl,
    extractedText,
    summary: "Processing AI summary...",
    embedding: [],
    aiStatus: "processing",
    uploadedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  enrichDocument(document.id, file.name, extractedText).catch(() => {});
  await logActivity(userId, "Uploaded document", file.name);
  return document.id;
}

async function enrichDocument(documentId, fileName, extractedText) {
  try {
    const [summary, embedding] = await Promise.all([
      summarizeContent({ title: fileName, content: extractedText, type: "PDF" }),
      generateEmbedding(`${fileName}\n${extractedText}`),
    ]);
    await updateDoc(doc(db, "documents", documentId), {
      summary,
      embedding,
      aiStatus: "ready",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await updateDoc(doc(db, "documents", documentId), {
      summary: extractedText.slice(0, 600) || "AI summary is not available yet.",
      aiStatus: "failed",
      aiError: error.message,
      updatedAt: serverTimestamp(),
    });
  }
}
