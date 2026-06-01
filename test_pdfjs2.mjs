async function test() {
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    console.log("Success! Worker src is", pdfjs.GlobalWorkerOptions.workerSrc);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
