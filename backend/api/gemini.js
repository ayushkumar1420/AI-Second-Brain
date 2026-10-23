import "../local-env.js";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const GENERATE_MODEL = process.env.GEMINI_GENERATE_MODEL || "gemini-2.5-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 3072;

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
    const error = new Error("AI provider rejected the request");
    error.upstreamStatus = response.status;
    throw error;
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

  let stage = "authentication";
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });

    let adminAuth;
    try {
      adminAuth = getAdminAuth();
    } catch {
      console.error("AI configuration error: Firebase Admin initialization failed");
      return res.status(503).json({ error: "Firebase Admin configuration is invalid" });
    }
    await adminAuth.verifyIdToken(token);

    const { action, input } = req.body || {};

    if (typeof input !== "string" || !input.trim() || input.length > 30000) {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (action === "embedding") {
      stage = "embedding";
      const data = await callGemini(
        "embeddings",
        {
          model: EMBEDDING_MODEL,
          input: input.slice(0, 6000),
        },
        geminiApiKey
      );

      const embedding = data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS ||
          !embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
        return res.status(502).json({ error: "AI provider returned an invalid embedding (expected 3072 finite numbers)" });
      }
      return res.status(200).json({ embedding });
    }

    if (action === "generate") {
      stage = "generation";
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
    if (["auth/argument-error", "auth/invalid-argument", "auth/id-token-expired", "auth/invalid-id-token", "auth/id-token-revoked", "auth/user-disabled"].includes(error.code)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    if (error.name === "TimeoutError") {
      return res.status(504).json({ error: "AI request timed out" });
    }

    // Never log raw SDK/network messages: they may contain request credentials.
    console.error("AI request failed:", { stage, upstreamStatus: error.upstreamStatus || null });
    if (stage === "authentication") {
      return res.status(503).json({ error: "Authentication service is unavailable" });
    }
    if (error.upstreamStatus) {
      return res.status(error.upstreamStatus === 429 ? 429 : 502).json({
        error: `AI provider rejected ${stage} request (HTTP ${error.upstreamStatus})`,
      });
    }
    return res.status(502).json({ error: `AI ${stage} request failed (network or invalid provider response)` });
  }
}
