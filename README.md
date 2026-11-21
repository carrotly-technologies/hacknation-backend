# hacknation-backend

NestJS API for HackNation. The React frontend lives in
[hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend).

## Setup

```bash
npm install
cp .env.example .env   # optional, defaults work out of the box
```

| Variable            | Default                 | Description                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------------- |
| `PORT`              | `3000`                  | Port the API listens on                                         |
| `FRONTEND_URL`      | `http://localhost:5173` | Origin allowed by CORS                                          |
| `DEMO_TODAY`        | `2026-11-21`            | Demo "today" for all deadlines                                  |
| `FEATURE_ASSISTANT` | `true`                  | AI assistant chat; `false` hides it and 404s `/api/assistant/*` |

## Run

```bash
npm run start:dev    # watch mode on http://localhost:3000
npm run start        # single run
npm run build && npm run start:prod
```

All routes are under the `/api` prefix:

```bash
curl localhost:3000/api/health   # {"status":"ok"}
```

## API

Contract: `notatki/api-kontrakt-v1.md`. No auth and no database: static data and pure functions.

| Route                                 | What it does                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/competency-model`           | 14 competencies, 49 indicators with level descriptions, scale 1/3/5/7/9, instructions (Polish)     |
| `GET /api/sheets`                     | Sheets `A`, `B`, `C` (periodic, rozp. 2016) and `FIRST` (first assessment, rozp. 2015)             |
| `POST /api/assessments/suggest-level` | Suggested criterion score from indicator ratings (`null` = no basis to rate). Only a suggestion    |
| `POST /api/assessments/evaluate`      | Average, level and POSITIVE/NEGATIVE result with Polish reasons citing the regulation              |

- Suggest rule (ours, not from the regulations): mean of rated indicators, snapped to the nearest point of the
  sheet's scale, exact ties toward 5. On `FIRST`, indicator levels 1/9 are clamped to 3/7 before averaging.
- Periodic: POSITIVE iff average > 4 and no score equals 1 (§11 rozp. 2016). FIRST: POSITIVE iff exam `YES` or
  `NOT_APPLICABLE`, report on time, at most one 3 and average ≥ 5 (§10 rozp. 2015). Thresholds use the exact average.
- Validation errors answer 400 with `message` as an array of Polish strings.

```bash
curl -X POST localhost:3000/api/assessments/evaluate -H 'content-type: application/json' \
  -d '{"sheetId":"FIRST","scores":[{"criterionId":"rzetelnosc","points":5},{"criterionId":"wykorzystywanie_wiedzy","points":5},{"criterionId":"organizacja_pracy","points":5},{"criterionId":"komunikacja","points":5},{"criterionId":"wspolpraca","points":5}],"firstAssessment":{"examPassed":"YES","reportSubmittedOnTime":true}}'
```

### v2: assessment cases (in-memory demo)

Contract: `notatki/api-kontrakt-v2.md`. Cases live in memory, seeded on startup (and on `POST /api/demo/reset`) with
fictional data relative to `DEMO_TODAY` (env, default `2026-11-21`); every deadline is computed against that date.

| Route                            | What it does                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/me`                    | Fictional supervisor (naczelnik wydziału)                                                |
| `GET /api/team`                  | The supervisor's cases (`CaseSummary[]`) and `todo` sorted by deadline                   |
| `GET /api/cases/:id`             | `CaseDetail`: stages, deadlines, OSP + analysis, part I, observations, ratings, check    |
| `PATCH /api/cases/:id`           | Partial update; 400 for invalid values, 409 for parts locked at the current stage       |
| `POST /api/cases/:id/observations` | Adds an S-D-R observation (201)                                                        |
| `POST /api/cases/:id/actions`    | State machine (`{ action }`); 409 with a Polish explanation for an illegal transition   |
| `GET /api/osp`                   | The 3 real OSP documents from the materials (`src/osp/osp.data.ts`)                     |
| `GET /api/hr/overview`           | Counters and every case in the office, with evaluator and last reminder                 |
| `POST /api/hr/reminders`         | Simulated reminders (`{ caseIds }`), logged in each case's history                       |
| `POST /api/demo/reset`           | Restores the seed                                                                        |

- Rules are pure functions with unit tests in `src/cases/*.rules.ts`: deadlines (`deadlines.rules.ts`, KC term rules
  incl. shifting from Saturdays, Sundays and holidays, each `Deadline` with `legalBasis`), stages
  (`stages.rules.ts`), actions (`actions.rules.ts`), PATCH locks (`patch.rules.ts`) and the formal check
  (`formal-check.rules.ts`). The OSP proposal (sheet + additional criteria) is `src/osp/osp-analysis.rules.ts`.
- `evaluation` in `CaseDetail` is computed with the v1 `evaluate` rules once every criterion is decided.
- PATCH merges one level deep (ratings per indicator); `null` in `decisions` / `deviationNotes` removes a key.
- 409 body: `{ statusCode, error, message }` (+ `formalCheck` with the failing items for `SIGN_ASSESSMENT`).
- `CaseDetail` also carries `availableActions` (actions legal right now), an addition to the contract.

The competency data in `src/competency-model/data/model.data.ts` is generated from `notatki/model-kompetencji.json`
by `node scripts/generate-model-data.mjs` (then run prettier on it). Don't edit it by hand.

### AI assistant (source-grounded)

| Route                                  | What it does                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/assistant/ask`              | `{ question, assistant: FORMAL\|CONVERSATION, caseId?, stageId? }` → answer + sources |
| `GET /api/assistant/suggestions`       | Example questions, `?stageId=` per stage                                        |

- Knowledge base: `src/assistant/data/knowledge.data.ts`, generated by `npm run kb:build`
  (`scripts/build-knowledge-base.mjs`, needs `pdftotext` and `unzip`) from the full act, both regulations, both KPRM
  guides, `liczenie terminów.docx` and `notatki/qa-baza-wiedzy.md`; acts are chunked by art./§/ust., guides by page.
  The competency model chunks come from `model.data.ts`. Don't edit the data file by hand.
- Retrieval: local BM25 (`bm25.ts`, `text-normalize.ts`: no diacritics, light Polish stemming, bigrams); below a
  score/coverage threshold the answer is "Nie znalazłem tego w bazie wiedzy" with `grounded: false`.
- Generation: optional, any OpenAI-compatible endpoint via `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (see
  `.env.example`). Without it, or when the call fails, answers are extractive (`mode: "EXTRACTIVE"`).
- Feature flag: `FEATURE_ASSISTANT=false` (Coolify env + restart) turns the chat off without a frontend rebuild.
  `GET /api/config` returns `{ "features": { "assistant": boolean } }` and the frontend reads it on start; with the
  flag off every `/api/assistant/*` route returns 404.
- `npm run eval:assistant`: hit@5 of the 72 Q&A questions against their expected sources.

## Quality

```bash
npm run lint       # oxlint (type-aware)
npm run format     # prettier
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Vitest + supertest)
npm run test:cov
```

## Deploy

Production runs on Coolify (project **Hackathons**, environment `production`)
as the `hacknation-backend` application, built from this repo's `Dockerfile`:

- URL: <https://api.hacknation.rabbithole.carrotly.tech> (health: `/api/health`)
- Every push to `main` triggers a new deploy (GitHub App source, auto-deploy on).
- Env: `PORT=3000`, `FRONTEND_URL=https://hacknation.rabbithole.carrotly.tech`, optional `FEATURE_ASSISTANT=false`.
  Change them in the Coolify app settings and redeploy.

Build and run the image locally:

```bash
docker build -t hacknation-backend .
docker run --rm -p 3000:3000 -e FRONTEND_URL=http://localhost:5173 hacknation-backend
curl localhost:3000/api/health   # {"status":"ok"}
```

The container listens on `0.0.0.0:$PORT` and has a Docker `HEALTHCHECK` on
`/api/health`. The Coolify healthcheck host is set to `127.0.0.1`, not
`localhost`: on Alpine `localhost` resolves to `::1` first, and the app listens
on IPv4 only.
