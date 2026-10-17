import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const fallback = config.rewrites.find(route => route.destination === "/index.html");
const matchesFallback = new RegExp(`^${fallback.source}$`);

test("SPA fallback preserves client routes", () => {
  for (const path of ["/", "/login", "/signup", "/app", "/app/notes", "/app/chat", "/unknown-route"]) {
    assert.ok(matchesFallback.test(path), path);
  }
});

test("SPA fallback never rewrites API, Vite modules, or static assets to HTML", () => {
  for (const path of [
    "/api", "/api/gemini", "/@vite/client", "/@react-refresh",
    "/@id/__x00__virtual-module", "/@fs/C:/project/node_modules/react/index.js",
    "/src/main.jsx", "/src/routes/App.jsx", "/src/styles.css",
    "/node_modules/.vite/deps/react.js", "/assets/index-hash.js", "/favicon.ico",
  ]) {
    assert.equal(matchesFallback.test(path), false, path);
  }
});
