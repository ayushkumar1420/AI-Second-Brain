const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GENERATE_MODEL = import.meta.env.VITE_GEMINI_GENERATE_MODEL || "gemini-2.5-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-2";
const GEMINI_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS || 12000);

function withTimeout(ms = GEMINI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

async function callGemini(path, body) {
  if (!GEMINI_KEY) {
    throw new Error("Missing VITE_GEMINI_API_KEY. Add it to .env before using AI features.");
  }

  const { controller, timeoutId } = withTimeout();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/${path}`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_KEY}`,
    },
    body: JSON.stringify(body),
  }).finally(() => window.clearTimeout(timeoutId));

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini request failed: ${error}`);
  }

  return response.json();
}

export async function generateEmbedding(text) {
  const data = await callGemini(`embeddings`, {
    model: EMBEDDING_MODEL,
    input: text.slice(0, 6000),
  });
  return data.data?.[0]?.embedding || [];
}

export async function generateText(prompt) {
  const data = await callGemini(`chat/completions`, {
    model: GENERATE_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.35,
    top_p: 0.9,
    max_tokens: 700,
  });
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function summarizeContent({ title, content, type }) {
  return generateText(`Summarize this ${type} for a personal knowledge base.

Title: ${title}

Content:
${content.slice(0, 8000)}

Return 3 concise bullets and one short tag list.`);
}

export async function answerWithContext(question, sources) {
  const context = sources
    .map((source, index) => `[${index + 1}] ${source.title}\nType: ${source.type}\n${source.content?.slice(0, 1500)}`)
    .join("\n\n");

  return generateText(`You are a personal second-brain assistant. Answer only from the provided sources. If the sources are insufficient, say what is missing.

Question: ${question}

Sources:
${context}

Include a short answer, useful details, and cite source numbers inline.`);
}

export async function generateFlashcards(content) {
  const text = await generateText(`Create 8 concise flashcards from this content. Format as JSON array with "front" and "back" keys only.

${content.slice(0, 12000)}`);
  return text;
}

export async function generateQuiz(content) {
  const text = await generateText(`Create 5 multiple-choice questions from this content. Format as JSON array with question, options, and answer.

${content.slice(0, 12000)}`);
  return text;
}
