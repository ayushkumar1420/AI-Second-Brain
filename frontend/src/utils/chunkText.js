
export function chunkText(text, chunkSize = 1000, overlap = 150) {
  if (typeof text !== "string" || !text.trim()) return [];

  if (!Number.isInteger(chunkSize) || !Number.isInteger(overlap) ||
      chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Invalid chunk size or overlap.");
  }

  const content = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let start = 0; start < content.length;) {
    let end = Math.min(start + chunkSize, content.length);

    if (end < content.length) {
      const boundary = content.lastIndexOf(" ", end);
      if (boundary > start + chunkSize / 2) end = boundary;
    }

    const chunk = content.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end === content.length) break;
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

export function chunkPdfPages(pages, chunkSize = 1000, overlap = 150) {
  return pages.flatMap((page, pageIndex) =>
    chunkText(page, chunkSize, overlap).map((content, index) => ({
      pageNumber: pageIndex + 1,
      chunkIndexOnPage: index,
      content,
    }))
  );
}
