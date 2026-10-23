# Development investigation and fixes

23 October 2026, Asia/Calcutta.

## Outcome and limits

Applied focused validation, retrieval, and error-reporting fixes. Baseline: 33 tests passed. Final: 45 passed, 0 failed, 0 skipped. Lint and production build passed. No deployment, production rule change, dependency change, credential edit, or real Gemini request was made. Live calls were explicitly declined during this investigation.

The original authenticated 502 and intermittent native crash are **not proven resolved**: neither was reproduced with the permitted checks. Actual provider output dimensions and live PDF RAG correctness remain unverified.

## Findings by issue

### A: 502

The handler previously collapsed Admin initialization failures, network errors, and upstream HTTP errors into the same `AI request failed` 502. This diagnostic defect is confirmed by code and offline regression tests; it does not establish which failure produced the user's historical 502.

Current root environment files contain both required server settings. Without printing their values, verified that Admin JSON parses, contains required fields, constructs an Admin credential, and matches the frontend project ID. These checks do not validate the key with Google or validate a real Firebase session.

Real Vercel HTTP probes returned `/` 200, `/login` 200, GET `/api/gemini` 405, unauthenticated POST 401, and malformed-token POST 401. Five additional invalid-token probes after edits all returned 401. No probe passed authentication or invoked Gemini. Existing Vite PORT handling, API discovery, rewrites, and local env loading therefore worked for these requests.

New behavior: Admin initialization failures return sanitized 503; invalid tokens remain 401; authentication infrastructure failures return 503; Gemini quota/rate errors return 429; other provider HTTP failures return 502 with stage and status; network/invalid-JSON failures identify the generation or embedding stage; upstream timeouts remain 504. Logs no longer print raw SDK/network exception messages.

### B: Windows native crash

Observed Node 24.19.0, Vercel CLI 65.1.0, Vite 8.0.16, npm 12.0.2. Vercel started, served requests, handled source updates, and was stopped without observing `UV_HANDLE_CLOSING`. Initial sandbox launches failed with `spawn EPERM`; permitted child-process launches succeeded. That sandbox error is separate from the reported native assertion.

[Vercel documents both Node 24 and 22 support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). [Node issue 56645](https://github.com/nodejs/node/issues/56645) documents this Windows assertion class, with [upstream fix 61999](https://github.com/nodejs/node/pull/61999). This is a plausible runtime explanation, not a confirmed diagnosis for this project. No runtime pin or downgrade was introduced. Node 22 was not installed or tested. A controlled comparison on a compatible Node 22 LTS installation is a follow-up only if the crash recurs.

### C: dimensions

Backend model remains `gemini-embedding-2`. [Google's embedding documentation](https://ai.google.dev/gemini-api/docs/embeddings) documents 3072 as the default dimension. The application still uses Google's OpenAI-compatible embedding endpoint. Its separate compatibility examples mention a preview identifier, so documentation alone does not prove availability of this model on that endpoint for this account; no speculative model switch was made.

The API previously accepted an empty or short vector as success. The API and frontend now reject anything other than an array of 3072 finite numbers. Existing chunk indexing already enforced this contract; Firestore rules still require 3072 elements. Query and document embeddings use the same backend model. Cosine ranking already rejects unequal lengths and zero/nonpositive scores. Stored PDF vectors are now checked before ranking. Live dimensions have not been measured.

### D: PDF RAG

Confirmed gaps: chunk retrieval accepted any nonempty embedding and did not detect a partially stored index. Search/chat also treated failed or processing PDFs as legacy fallback candidates if they retained a document-level embedding.

Chunk retrieval now requires the stored count to match the ready parent's chunkCount and validates each chunk's document ID, page, content, vector length, and finite values. A corrupt or incomplete index is excluded as a whole. Legacy document-level retrieval requires no indexVersion/chunkCount and either no AI status or ready status. Notes and links retain their existing behavior; legacy PDFs remain available in normal knowledge views.

Verified offline: page-aware indexing, mixed note/link/legacy/PDF retrieval, exclusion of failed/partial/corrupt indexes, one semantic-search card per PDF, chunk cleanup on embedding/write/summary failures, and deleting 105 chunks in batches before deleting the parent and Storage object. Upload orchestration tests mock PDF.js extraction and Storage; they do not validate a real PDF file or browser worker.

The RAG prompt supplies only ranked sources with their page metadata and explicitly requests grounded citations. Tested prompt construction and source propagation. Actual model citation fidelity, factual grounding, and page-number accuracy are not guaranteed by this prompt and were not tested live. No claim is made that arbitrary generated citations are programmatically validated.

## Files changed

| File | Change |
| --- | --- |
| `backend/api/gemini.js` | Distinct sanitized configuration/auth/provider errors; validate returned embedding shape. |
| `frontend/src/services/gemini.js` | Validate query/content vectors and remove unconditional dimension logging. |
| `frontend/src/services/chunkService.js` | Exclude incomplete/corrupt PDF indexes. |
| `frontend/src/services/chatService.js` | Limit document-level fallback to eligible legacy PDFs. |
| `frontend/src/pages/SearchPage.jsx` | Apply the same legacy fallback rule. |
| `tests/gemini.test.js` | Preserve original scenarios with updated contracts; add malformed vector and diagnostic regressions. |
| `tests/frontend-api.test.js` | Add query-vector and citation-prompt checks. |
| `tests/rag-services.test.js` | Seven offline service/handler orchestration regressions using real application functions with substituted external boundaries. |
| `DEVELOPMENT_FIX_REPORT.md` | Findings, evidence, limitations, and follow-up steps. |

## Verification

| Check | Result |
| --- | --- |
| Original baseline `npm test` | 33 pass, 0 fail |
| Final `npm test` | 45 pass, 0 fail, 0 skipped |
| Firestore integration subset | 2 pass using actual local emulator and demo projects |
| Remaining test cases | 43 pass: local configuration, pure logic, mocked auth/AI/service boundaries |
| `npm run lint` | Exit 0, no lint findings |
| `npm run build` | Exit 0 |
| Backend syntax and `git diff --check` | Pass |
| Built frontend credential scan | 27 files; no configured secret value or private-key marker found |
| Valid-user authentication + real Gemini | Not run |
| Native crash reproduction | Not reproduced |

The emulator was confirmed listening on 127.0.0.1:8080 before running either rules-dependent test. The cached Firestore emulator JAR was launched directly because the sandboxed Firebase CLI could not spawn Java. Expected permission-denied logs came from negative ownership/rule assertions. Test-owned Vercel and emulator sessions were stopped afterward.

## Manual follow-up

1. Start `npx vercel dev --listen 3000` from the repository root and use http://localhost:3000. `npm run dev` starts only Vite; AI calls require the backend on port 3000.
2. To rerun the full suite, first start `npx firebase-tools emulators:start --only firestore --project demo-no-project` and confirm port 8080 is ready. Then run `npm run lint`, `npm test`, and `npm run build`.
3. Offline tests cannot identify the original upstream rejection. If you later choose to perform a live test, sign in and try a single semantic query; retain only the HTTP status and sanitized response message, never the token or credentials. The new response distinguishes provider rejection, configuration, authentication infrastructure, timeout, and network failures.
4. Once a real query returns a valid 3072-vector, test a short two-page PDF: wait for ready status, search for page-specific content, check one PDF card, ask a sourced question, inspect cited pages, and delete the PDF. Check notes, links, and a legacy PDF too. This live workflow was not performed in this session.
5. If the native crash recurs, record whether it happens on startup, request handling, reload, or shutdown. Compare the same workload using a compatible Node 22 LTS runtime without changing application dependencies. A successful finite test run cannot establish that an intermittent crash is eliminated.
