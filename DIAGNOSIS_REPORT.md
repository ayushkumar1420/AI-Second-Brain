# AI Second Brain diagnosis

Date: 17 October 2026 (Asia/Calcutta)

## Outcome

The local Vercel API timeout is repaired. Real HTTP requests through Vercel now return GET **405** and, with temporary process-only dummy configuration, unauthenticated POST **401**. With the existing environment files, POST correctly returns **503** because backend credentials are missing. No real AI request was made.

## Root causes and evidence

1. **Vite ignored the port allocated by Vercel.** `frontend/vite.config.js` hard-coded 5173. The installed Vercel CLI sets `PORT` for its child development server and waits for that port. Before the fix, Vite announced 5173, the frontend on that port returned 200, and `curl.exe --max-time 8 http://127.0.0.1:3000/api/gemini` timed out after 8 seconds with zero bytes. Listeners were Vite on 5173 and Vercel on 3000; this was not an observed port collision. After honoring `PORT`, Vercel logged `Ready!` and the API returned immediately. This also rules out function discovery, the entry-point import, Admin module import, and existing rewrites as causes of this reproduced timeout.
2. **Backend configuration is absent.** Root `.env` contains `VITE_GEMINI_API_KEY`, while the handler requires `GEMINI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT_JSON`. Neither required backend name is in the inspected actual environment files. Root `.env.local` contains `VERCEL_OIDC_TOKEN`, which is not an AI or Firebase credential. The real unconfigured POST returned 503. No secrets were moved or edited.
3. **The legacy Gemini variable was eligible for browser exposure.** Vite's default `VITE_` prefix includes `VITE_GEMINI_API_KEY`. The existing frontend does not reference this key, so its presence alone does not establish a bundle leak. Restricted exposure now excludes that name, all backend credentials, and the Vercel token. A scan of all 27 generated frontend files found zero exact matches for the two configured sensitive values (legacy Gemini value and Vercel token), and no private-key markers. Values were compared in memory, not printed by the scan.
4. **Example-file ignore exceptions were overridden.** The final `.env*` rule ignored both examples despite earlier exceptions. `git check-ignore --no-index` reproduced this. Final exceptions now allow examples while actual env files remain ignored. The frontend example was previously untracked and ignored; it is now an intentional new sanitized file.
5. **Environment location was misleading.** Vite resolves `envDir: "../"` to the repository root. `frontend/.env.local` is therefore not read by Vite. Its six Firebase settings duplicate the root settings and currently match; no value conflicts were found. Examples now identify the root as the configuration location. Previous examples contained project-specific public Firebase configuration and an incomplete Admin JSON illustration; examples now use empty fields.

## Files changed

| File | Reason |
| --- | --- |
| `frontend/vite.config.js` | Honor Vercel's `PORT`, fail explicitly on a busy port, disable the reverse API proxy under Vercel, restrict public environment prefixes. Standalone Vite retains port 5173 and its API proxy. |
| `.gitignore` | Restore final exceptions for sanitized `.env.example` files. |
| `.env.example` | Blank public/server fields and precise root/server-only instructions. |
| `frontend/.env.example` | Sanitized reference directing configuration to the root. |
| `package.json` | Add `npm test` using Node's built-in test runner. |
| `tests/gemini.test.js` | Offline handler tests through the actual root API re-export, with mocked Firebase Admin and fetch. |
| `tests/frontend-api.test.js` | Test the actual frontend service with substituted browser environment/auth and mocked fetch. |
| `tests/vite-config.test.js` | Regression test for assigned port, standalone proxy, and credential exclusion. |
| `DIAGNOSIS_REPORT.md` | Evidence, results, limitations, and next commands. |

No dependency upgrades or lockfile changes were needed. The shared `firebase-admin` declarations resolve to one installed version; there is no duplicate handler logic to remove. `api/gemini.js` correctly re-exports `backend/api/gemini.js`. Existing Vercel rewrites work and were preserved. Frontend UI, Firebase rules, data, RAG algorithms, and Gemini models were preserved. Nothing was deployed or committed; account/project settings were not changed.

## Tests performed

Environment: Windows PowerShell, Node 24.19.0, npm 12.0.2, cached Vercel CLI 64.5.0, Vite 8.0.16.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Original API reproduction | FAIL before repair | Port 3000 request timed out at 8 seconds; port 5173 frontend returned 200. |
| `npm ls --depth=0` | PASS | Workspace dependencies resolve; no missing package reported. |
| `npm run lint` | PASS | Existing frontend lint script, zero warnings/errors. |
| `npm run build` | PASS | Production frontend built successfully before and after repair. |
| `node --check api/gemini.js` | PASS | Root entry syntax. |
| `node --check backend/api/gemini.js` | PASS | Backend implementation syntax. |
| Syntax checks for three test files | PASS | Node parser accepted all tests. |
| `npm test` | PASS | 13 tests, zero failures; no external calls. |
| Real Vercel GET `/api/gemini` | PASS | 405 JSON response, `Allow: POST`. |
| Real Vercel unconfigured POST | PASS | 503, `AI service is not configured`. |
| Real Vercel configured-presence unauthenticated POST | PASS | 401, `Authentication required`; synthetic process-only values, not valid credentials. |
| Vercel frontend `/` and SPA `/login` | PASS | Both HTTP 200. |
| Standalone Vite `/` and `/api/gemini` | PASS | HTTP 200 and proxied HTTP 405 respectively with Vercel also running. |
| Authentication and upstream behavior | PASS, MOCKED | Missing/invalid token, lazy Admin initialization/reuse, input validation, generation, embeddings, upstream failure, timeout, malformed Admin JSON. |
| Frontend API communication | PASS, MOCKED | Sign-in gate, Firebase ID-token header, same-origin JSON POST, timeout signal, error propagation. |
| Environment resolution | PASS | Resolved Vite envDir equals repository root; six duplicated Firebase settings match. |
| Client credential exposure / bundle scan | PASS | No sensitive exposed names and zero matches across 27 generated files. No claim about historical builds. |
| Git ignore/tracking checks | PASS | Actual env files ignored and untracked; sanitized examples not ignored. |
| `git diff --check` | PASS | Only normal Windows line-ending notices. |
| Valid Firebase ID-token verification | NOT TESTED | Missing Admin configuration and no supplied signed-in test session. Mock tests do not establish real credential validity. |
| Live Gemini generation/embedding | NOT TESTED | Missing server configuration; billable calls not authorized. |
| Browser interaction / live Firestore operations | NOT TESTED | Frontend HTTP/build and service mocks tested; no production reads/writes or sign-in performed. |
| Deployed Vercel routing | NOT TESTED | No deployment requested or performed. |

The initial sandboxed `npx` attempt failed DNS resolution before starting Vercel. A cached CLI was then run with approved network access against the existing linked project. Local HTTP probes and both dev servers were run in the same network context; an isolated sandbox listener was not reachable from outside that context. These tooling restrictions are separate from the reproduced application port bug.

Node emits experimental module-mocking and `namedExports` deprecation notices for the tests. They pass on the version above; the flag is test-only. Vite also suggests an optional React plugin migration; no upgrade was made because it is not a functional failure.

## Manual secret/setup actions

Edit the existing **repository-root `.env.local`** in a trusted editor. Preserve its existing entries; do not replace it by copying the example over it.

| Variable | Where and what |
| --- | --- |
| `GEMINI_API_KEY` | Root `.env.local`: your existing authorized server-side Gemini API key. No `VITE_` prefix. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Root `.env.local`: valid one-line Firebase service-account JSON for the same Firebase project as the web app. Enclose the JSON in single quotes and retain JSON `\n` escapes in `private_key`. Never paste it into client code or an example. |
| `GEMINI_GENERATE_MODEL` | Optional root server setting; current default remains `gemini-2.5-flash-lite`. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Already present at root. Maintain the public Firebase web configuration there. The ignored frontend-local duplicates have not been changed. |
| `VITE_GEMINI_TIMEOUT_MS` | Optional public setting; default 25000 milliseconds. |

Manually retire the obsolete `VITE_GEMINI_API_KEY` entry after arranging the server-only key. The actual file has been left untouched. If you establish that this credential was exposed in an earlier deployment or source history, handle rotation in your credential system; this audit did not establish historical exposure and did not rotate anything.

For a future deployment, add the two backend variables to the **existing Vercel project's Environment Variables**, scoped to the intended environments, and provide the public Firebase build variables there. Do not change projects. This task did not alter those settings. The repository root must remain the root used for this layout so Vercel can discover `api/gemini.js`; local discovery is verified.

The Admin JSON `project_id` must match `VITE_FIREBASE_PROJECT_ID`. After configuration, GET 405 and unauthenticated POST 401 verify routing and the configuration-presence gate, **not** the validity of the secrets. To verify Admin without calling Gemini, sign in locally and send an authenticated POST with `{ "action": "diagnostic-invalid", "input": "probe" }` using the current user's ID token without logging it: expect 400 `Unknown action`. This reaches token verification but cannot enter either Gemini branch. A real generation/embedding test still requires separate permission for a potentially billable request.

## Exact commands to run next

Use Node 24 (the tested environment). In PowerShell, from the repository root:

```powershell
Set-Location 'C:\Users\ayush\OneDrive\AI Second Brain'
npm run lint
npm run build
npm test
node --check api/gemini.js
node --check backend/api/gemini.js
npx vercel dev --listen 3000
```

Keep that server running. In a second PowerShell terminal:

```powershell
curl.exe --max-time 15 -i http://127.0.0.1:3000/api/gemini
curl.exe --max-time 15 -i -X POST -H 'Content-Type: application/json' --data '{}' http://127.0.0.1:3000/api/gemini
curl.exe --max-time 10 -o NUL -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
curl.exe --max-time 10 -o NUL -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/login
```

Expected results: **405**, **401 after both backend variables are present** (otherwise 503), **200**, **200**. These commands do not call Gemini. Restart Vercel after editing environment files. Use `http://localhost:3000` for the combined app; `npm run dev` alone starts only Vite and requires a running backend for AI calls.

All dev servers started for diagnosis were stopped after verification, including the process containing dummy configuration.

## Reference documentation

- [Vercel local development](https://vercel.com/docs/cli/dev)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vite envDir and envPrefix](https://vite.dev/config/shared-options)
- [Firebase Admin ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
