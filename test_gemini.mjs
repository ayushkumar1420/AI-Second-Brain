const GEMINI_KEY = process.env.GEMINI_KEY || "YOUR_GEMINI_API_KEY";
const GENERATE_MODEL = "gemini-1.5-flash";
const EMBEDDING_MODEL = "text-embedding-004";

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

async function generateText(prompt) {
  const data = await callGemini(`models/${GENERATE_MODEL}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1400,
    },
  });
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim() || "";
}

async function test() {
  try {
    const res = await generateText("Hello world");
    console.log("Success:", res);
  } catch (err) {
    console.error(err.message);
  }
}
test();
