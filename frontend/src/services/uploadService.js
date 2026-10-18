
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { summarizeContent } from "./gemini";
import { indexPdfChunks, deletePdfChunks } from "./chunkService";
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

export async function extractPdfPages(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      try {
        const text = await page.getTextContent();
        pages.push(text.items.map((item) => item.str || "").join(" "));
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

export async function extractPdfText(file) {
  const pages = await extractPdfPages(file);
  return pages.join("\n\n");
}

export function uploadFile(userId, file, onProgress) {
  const path = `users/${userId}/documents/${Date.now()}-${cleanFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;

        onProgress?.(progress);
      },
      (error) => reject(new Error(getFirebaseUploadMessage(error))),
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(new Error(getFirebaseUploadMessage(error)));
        }
      }
    );
  });
}

export async function saveDocument(userId, file, onProgress) {
  if (!userId) throw new Error("You must be signed in before uploading PDFs.");

  if (!file || (file.type && file.type !== "application/pdf") || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Please choose a valid PDF file.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("PDF must be 20 MB or smaller.");
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
      chunkCount: 0,
      indexVersion: 1,
      aiStatus: "extracting",
      uploadedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(getFirestoreSaveMessage(error));
  }

  enrichDocument(document.id, userId, file).catch((error) => {
    console.error("PDF enrichment failed:", error);
  });

  await logActivity(userId, "Uploaded document", file.name);
  return document.id;
}

async function enrichDocument(documentId, userId, file) {
  const documentRef = doc(db, "documents", documentId);
  let extractedText = "";

  try {
    const pages = await extractPdfPages(file);
    extractedText = pages.join("\n\n");

    if (!extractedText.trim()) {
      throw new Error("No readable text found. Scanned PDFs require OCR.");
    }

    await updateDoc(documentRef, {
      extractedText: extractedText.slice(0, 50000),
      summary: "Processing AI summary and document chunks...",
      aiStatus: "processing",
      updatedAt: serverTimestamp(),
    });

    const chunkCount = await indexPdfChunks(userId, documentId, pages);

    const summary = await summarizeContent({
      title: file.name,
      content: extractedText,
      type: "PDF",
    });

    await updateDoc(documentRef, {
      summary,
      embedding: [],
      chunkCount,
      aiStatus: "ready",
      aiError: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    let errorMessage = error.message;

    try {
      await deletePdfChunks(documentId);
    } catch (cleanupError) {
      console.error("PDF chunk cleanup failed:", cleanupError);
      errorMessage += ` Chunk cleanup failed: ${cleanupError.message}`;
    }

    try {
      await updateDoc(documentRef, {
        summary: extractedText.slice(0, 600) ||
          "PDF uploaded, but text extraction or AI processing failed.",
        chunkCount: 0,
        aiStatus: "failed",
        aiError: errorMessage,
        updatedAt: serverTimestamp(),
      });
    } catch (saveError) {
      console.error("Failed to record PDF processing status:", saveError);
    }
  }
}
