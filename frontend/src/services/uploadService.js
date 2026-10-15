import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { generateEmbedding, summarizeContent } from "./gemini";
import { logActivity } from "./activityService";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function cleanFileName(name = "document.pdf") {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 140) || "document.pdf";
}

function getFirebaseUploadMessage(error) {
  const code = error?.code || "";
  if (code.includes("unauthorized")) return "Firebase Storage denied this upload. Check storage.rules and make sure you are signed in.";
  if (code.includes("quota-exceeded")) return "Firebase Storage quota was exceeded. Check your Firebase project billing/quota.";
  if (code.includes("unauthenticated")) return "You must be signed in before uploading PDFs.";
  return error?.message || "PDF upload failed.";
}

function getFirestoreSaveMessage(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return "PDF uploaded to Storage, but Firestore denied saving its record. Check firestore.rules for the documents collection.";
  if (code.includes("unauthenticated")) return "PDF uploaded to Storage, but Firestore says you are not signed in.";
  if (code.includes("resource-exhausted")) return "PDF uploaded to Storage, but Firestore quota was exceeded.";
  return `PDF uploaded to Storage, but the database record could not be saved: ${error?.message || "Unknown Firestore error"}`;
}

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
  const path = `users/${userId}/documents/${Date.now()}-${cleanFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file);
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => reject(new Error(getFirebaseUploadMessage(error))),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(new Error(getFirebaseUploadMessage(error)));
        }
      },
    );
  });
}

export async function saveDocument(userId, file, onProgress) {
  if (!userId) throw new Error("You must be signed in before uploading PDFs.");
  if (!file || (file.type && file.type !== "application/pdf") || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Please choose a valid PDF file.");
  }

  const fileUrl = await uploadFile(userId, file, onProgress);
  let document;
  try {
    document = await addDoc(collection(db, "documents"), {
      userId,
      fileName: file.name,
      fileUrl,
      extractedText: "",
      summary: "PDF uploaded. Extracting text...",
      embedding: [],
      aiStatus: "extracting",
      uploadedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(getFirestoreSaveMessage(error));
  }
  enrichDocument(document.id, file).catch(() => {});
  await logActivity(userId, "Uploaded document", file.name);
  return document.id;
}

async function enrichDocument(documentId, file) {
  const fileName = file.name;
  let extractedText = "";
  try {
    extractedText = await extractPdfText(file);
    await updateDoc(doc(db, "documents", documentId), {
      extractedText,
      summary: "Processing AI summary...",
      aiStatus: "processing",
      updatedAt: serverTimestamp(),
    });

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
      extractedText,
      summary: extractedText.slice(0, 600) || "PDF uploaded, but text extraction or AI processing failed.",
      aiStatus: "failed",
      aiError: error.message,
      updatedAt: serverTimestamp(),
    });
  }
}
