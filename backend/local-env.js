import { loadEnvFile } from "node:process";

// Vercel CLI sets NOW_REGION=dev1 for local functions. Its
// .env loader does not read .env.local; production uses injected variables.
if (process.env.NOW_REGION === "dev1" && process.env.NODE_ENV === "development") {
  try {
    loadEnvFile(".env.local");
  } catch (error) {
    // Missing local configuration is handled by the API's existing 503 guard.
    if (error.code !== "ENOENT") throw new Error("Unable to load backend .env.local");
  }
}
