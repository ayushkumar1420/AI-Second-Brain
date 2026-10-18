
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
      extractedText,
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
