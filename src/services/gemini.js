const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GENERATE_MODEL = "gemini-flash-latest";
const EMBEDDING_MODEL = "gemini-embedding-2";

async function callGemini(path, body) {
  if (!GEMINI_KEY) {
    throw new Error("Missing VITE_GEMINI_API_KEY. Add it to .env before using AI features.");
  }

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

export async function generateEmbedding(text) {
  const data = await callGemini(`models/${EMBEDDING_MODEL}:embedContent`, {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: text.slice(0, 12_000) }] },
  });
  return data.embedding?.values || [];
}

export async function generateText(prompt) {
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

export async function summarizeContent({ title, content, type }) {
  return generateText(`Summarize this ${type} for a personal knowledge base.

Title: ${title}

Content:
${content.slice(0, 18_000)}

Return 4 concise bullets and one useful tag list.`);
}

export async function answerWithContext(question, sources) {
  const context = sources
    .map((source, index) => `[${index + 1}] ${source.title}\nType: ${source.type}\n${source.content?.slice(0, 3000)}`)
    .join("\n\n");

  return generateText(`You are a personal second-brain assistant. Answer only from the provided sources. If the sources are insufficient, say what is missing.

Question: ${question}

Sources:
${context}

Include a short answer, useful details, and cite source numbers inline.`);
}

export async function generateFlashcards(content) {
  const text = await generateText(`Create 8 concise flashcards from this content. Format as JSON array with "front" and "back" keys only.

${content.slice(0, 12_000)}`);
  return text;
}

export async function generateQuiz(content) {
  const text = await generateText(`Create 5 multiple-choice questions from this content. Format as JSON array with question, options, and answer.

${content.slice(0, 12_000)}`);
  return text;
}
