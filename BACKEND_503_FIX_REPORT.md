# Backend 503 fix

## 1. Confirmed root cause

Vercel CLI **64.5.0** does not load root `.env.local` for this plain Node function. Inspection of its installed `commands/dev/index.js` shows `getLocalEnv(".env", ...)` and `getLocalEnv(".env.build", ...)`; cloud Development values are used only when that combined environment is empty. This project's `.env` is nonempty, so the cloud fallback is skipped. No `.vercel/.env.development.local` exists. Downloaded Development values were not overriding the secrets.

The required names exist in `.env.local` but not `.env`. On a fresh real Vercel server, POST returned **503** and temporary handler diagnostics reported:

```text
GEMINI_API_KEY: false
FIREBASE_SERVICE_ACCOUNT_JSON: false
```

After loading `.env.local` inside the local function process, both booleans became **true** and the same unauthenticated request returned **401**. Actual existing local configuration was used, not dummy credentials. Diagnostics were removed afterward.

This establishes a CLI env-file selection problem, not a JSON-parsing, workspace, API-discovery, frontend, or authentication problem. The earlier reported PowerShell injection failure was not independently established by this run; the confirmed fix does not depend on shell injection.

## 2. Files changed

- `backend/local-env.js`: Node's built-in `loadEnvFile(".env.local")`, guarded by Vercel's local `NOW_REGION=dev1` and `NODE_ENV=development`. Existing process variables retain precedence; a missing file preserves the normal 503 behavior. Other read errors use a sanitized message. No dotenv dependency or custom parser. This local fallback is necessary to support the unchanged `npx vercel dev` command without editing secret files. Tested on Node **24.19.0**; requires Node **20.12+** for the native loader.
- `backend/api/gemini.js`: import the local environment setup before model/configuration evaluation.
- `tests/local-env.test.js`: isolated synthetic-file tests for local loading, injected-value precedence, production/non-Vercel isolation, and missing-file handling.
- `BACKEND_503_FIX_REPORT.md`: this report.

No secret files, frontend/config files, dependencies, models, rules, data, or account settings changed. Deployed production/preview processes continue using Vercel-injected environment variables.

## 3. Actual test results

Final HTTP checks used a freshly restarted real Vercel Dev server on port 3000, with 10–15 second request bounds. The installed cached CLI entry was invoked directly to avoid an unrelated npx package lookup.

| Check | Result |
| --- | --- |
| GET `/api/gemini` | PASS — 405 |
| Unauthenticated POST `{}` | PASS — 401, existing local configuration |
| Invalid action without token | PASS — 401 |
| Frontend `/` | PASS — 200 |
| Frontend `/login` | PASS — 200 |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 17 tests; Firebase/Gemini behavior mocked, env regression tests use synthetic isolated files |
| Backend syntax / `git diff --check` | PASS |
| Generated frontend scan | PASS — no configured secret matches or private-key markers; no sensitive client env names exposed |
| Real Firebase authentication / Gemini calls | NOT TESTED — no authenticated or paid requests made |
| Production deployment | NOT TESTED — no deployment performed |

## 4. Is 503 resolved?

**Yes, for the real local endpoint with the existing root `.env.local`.** Both required variables reached the handler, and unauthenticated POST returned **401**, including after diagnostic logging was removed. This does not assert that credentials are valid for live Firebase/Gemini operations.

## 5. Remaining manual action

No Dashboard change or repeated secret entry is needed for this local fix. Test-owned servers were stopped; restart from the repository root with:

```powershell
npx vercel dev --listen 3000
```

Production environment settings were not audited or modified. No commit or deployment was made.
