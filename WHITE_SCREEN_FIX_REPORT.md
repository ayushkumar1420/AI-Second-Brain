# White screen fix

## 1. Confirmed root cause

The Vercel SPA rewrite `/((?!api/).*)` also matched JavaScript and Vite internal requests. Before repair, `/@vite/client`, `/src/main.jsx`, and `/src/routes/App.jsx` on port 3000 returned **200 text/html containing index.html**, while the same URLs on port 5173 returned **text/javascript**. A 200 response therefore concealed broken module loading.

Opening Vercel Dev in the browser reproduced the blank screen and this server error:

```text
[vite:import-analysis] Failed to parse source for import analysis because the content contains invalid JS syntax.
frontend/index.html:6:31
```

Vite received HTML through the rewritten module requests; the HTML itself was valid. Correcting only the rewrite restored the actual React UI. No incorrect HTML imports were found in application source.

The reported standalone blank screen **was not reproduced**: a fresh `npm run dev` already rendered the landing page and login. No evidence justified changing frontend code or deleting caches.

`manualChunks` was investigated and preserved: it applies to the production build, not these dev module responses. The production bundle also rendered its landing page and login in a browser on port 4173 without console errors. No chunk initialization failure was observed on those routes.

## 2. Files modified

- `vercel.json`: exclude `/api`, Vite's `/@...` modules, `/src`, `/node_modules`, `/assets`, and file-extension paths from the HTML fallback. Preserve fallback for `/`, `/login`, `/signup`, `/app/...`, and unknown extensionless client routes. API entry and build/dev commands are unchanged.
- `tests/vercel-routing.test.js`: two regression tests covering client-route fallback and module/API/asset exclusions.
- `WHITE_SCREEN_FIX_REPORT.md`: this report.

Temporary boolean-only Firebase logging was removed; no net Firebase source change remains. UI, providers, authentication, environment files, backend, models, rules, and RAG logic were not changed.

## 3. Console and terminal findings

- **Before:** reproduced the exact Vite import-analysis error above in Vercel's terminal. Browser log capture returned no error entries for the blank document; response MIME/content checks established the module failure directly.
- **After:** no browser error entries in either development environment or production preview. React Router emits its existing v7 future-flag warnings; these do not block rendering.
- Existing optional SWC migration and Node experimental test-mocking notices remain; no dependency upgrade was needed.

## 4. Tests

| Test | Result |
| --- | --- |
| Standalone browser `/` | PASS — visible Second Brain heading, navigation, hero and feature cards inside `#root` |
| Standalone browser `/login` | PASS — visible Welcome back heading and login controls |
| Standalone `/app/notes` | PASS — redirects to the visible login page when signed out |
| Vercel browser `/` after repair | PASS — actual React landing page, visible heading and populated `#root` |
| Vercel browser `/login` | PASS — visible login form |
| Vercel `/app/notes` | PASS — authentication redirect preserved |
| Browser errors after repair | PASS — none captured |
| Module responses on both servers | PASS — `/@vite/client`, `/@react-refresh`, `/src/main.jsx`, `/src/routes/App.jsx` return JavaScript, not HTML |
| Firebase initialization | PASS — temporary browser diagnostics reported `isFirebaseConfigured=true` on both servers; only booleans logged |
| Environment resolution | PASS — Vite envDir resolves to repository root; sensitive server names absent from exposed client environment |
| Real Vercel GET `/api/gemini` | PASS — 405 |
| Real Vercel unauthenticated POST `{}` | PASS — 401 with existing local backend configuration |
| Production preview `/` and `/login` | PASS — visible React UI with existing manual chunks |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS — 19 tests |
| `git diff --check` | PASS |
| Signed-in pages / live Gemini / deployment | NOT TESTED — no sign-in, paid calls, data changes, or deployment performed |

Browser verification used the desktop in-app browser and rendered DOM/accessibility state, visible-element checks, and screenshots—not HTTP status alone. Vercel CLI 64.5.0 was launched through its cached installed entry with `dev --listen 3000`; standalone used `npm run dev`. All network probes had bounded timeouts.

## 5. Standalone Vite result

**PASS.** Actual React UI renders at `http://localhost:5173/`, login works visually, and nested protected routing remains intact. No standalone source fix or cache deletion was necessary.

## 6. Vercel Dev result

**PASS.** The previously blank page now renders at `http://localhost:3000/`; login and API status checks pass. Screenshot evidence:

![Vercel React UI](</C:/Users/ayush/.codex/visualizations/2026/10/17/01a149e5-7d50-7683-b6d0-613ad6b05985/second-brain-vercel.jpg>)

## 7. Remaining issues

No remaining rendering failure was observed in the tested routes. The earlier standalone failure cannot be attributed to a confirmed cause from this run. Authenticated application pages and deployed production routing remain untested. All task-started servers were stopped after verification; no unrelated process was terminated, and nothing was committed or deployed.

Restart from the repository root with `npm run dev` for standalone Vite or `npx vercel dev --listen 3000` for the combined app.
