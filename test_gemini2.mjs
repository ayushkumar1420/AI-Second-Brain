const GEMINI_KEY = process.env.GEMINI_KEY || "YOUR_GEMINI_API_KEY";
const GENERATE_MODEL = "gemini-flash-latest";
const EMBEDDING_MODEL = "gemini-embedding-2";

async function callGemini(path, body) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini request failed: ${error}`);
  }
  return response.json();
}

async function test() {
  try {
    console.log("Testing generation...");
    const res = await callGemini(`models/${GENERATE_MODEL}:generateContent`, {
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    });
    console.log("Generation success:", res.candidates[0].content.parts[0].text);
    
    console.log("Testing embedding...");
    const res2 = await callGemini(`models/${EMBEDDING_MODEL}:embedContent`, {
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: "Hello world" }] },
    });
    console.log("Embedding success:", res2.embedding.values.length);
  } catch (err) {
    console.error(err.message);
  }
}
test();
