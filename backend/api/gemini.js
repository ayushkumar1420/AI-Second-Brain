import "../local-env.js";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const GENERATE_MODEL = process.env.GEMINI_GENERATE_MODEL || "gemini-2.5-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-2";

function getAdminAuth() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    }
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

async function callGemini(path, body, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/${path}`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("Gemini upstream error:", response.status);
    throw new Error(`AI provider returned status ${response.status}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!geminiApiKey || !serviceAccountJson) {
    return res.status(503).json({ error: "AI service is not configured" });
  }

  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });

    await getAdminAuth().verifyIdToken(token);

    const { action, input } = req.body || {};

    if (typeof input !== "string" || !input.trim() || input.length > 30000) {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (action === "embedding") {
      const data = await callGemini(
        "embeddings",
        {
          model: EMBEDDING_MODEL,
          input: input.slice(0, 6000),
        },
        geminiApiKey
      );

      return res.status(200).json({
        embedding: data.data?.[0]?.embedding || [],
      });
    }

    if (action === "generate") {
      const data = await callGemini(
        "chat/completions",
        {
          model: GENERATE_MODEL,
          messages: [{ role: "user", content: input }],
          temperature: 0.35,
          top_p: 0.9,
          max_tokens: 700,
        },
        geminiApiKey
      );

      return res.status(200).json({
        text: data.choices?.[0]?.message?.content?.trim() || "",
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    if (error.code?.startsWith("auth/")) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    if (error.name === "TimeoutError") {
      return res.status(504).json({ error: "AI request timed out" });
    }

    console.error("AI request failed:", error.message);
    return res.status(502).json({ error: "AI request failed" });
  }
}
