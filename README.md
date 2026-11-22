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
| `JWT_SECRET`        | dev-only default        | HS256 key for sign-in tokens (32+ bytes: `openssl rand -base64 32`); without it a warning is logged |
| `DATABASE_URL`      | (unset)                 | PostgreSQL URL; unset = in-memory storage (lost on restart)     |
| `OFFICE_PLACE`      | `Warszawa` (demo)       | "miejscowość" printed next to signature dates in the downloaded sheet (PDF/DOCX) |

### Database (optional)

```bash
docker compose up -d db   # PostgreSQL 17 on localhost:5432
DATABASE_URL=postgres://hacknation:hacknation@localhost:5432/hacknation npm run start:dev
```

`src/database` (global module) connects with Drizzle ORM and `pg` and applies the migrations from `drizzle/` at
startup, before the first request. After changing a `src/**/*.tables.ts` schema run
`npx drizzle-kit generate --name=<change>` and commit the generated folder. Without `DATABASE_URL` every module uses
in-memory storage.

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

## Sign-in, roles and permissions

Every `/api/*` route needs `Authorization: Bearer <token>` (401 without a valid one), except `GET /api/health`,
`GET /api/config`, `POST /api/auth/login` and the document files `GET /api/docs/<path>` (public legal texts opened
from answer links in a new tab). A route for another role answers 403.

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"login":"j.kaminska","password":"Kompas2026!"}' | jq -r .accessToken)
curl localhost:3000/api/me -H "Authorization: Bearer $TOKEN"
```

| Route                        | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `POST /api/auth/login`       | `{ login, password }` → `{ accessToken, tokenType, expiresIn, user }`; JWT HS256, 8 h |
| `POST /api/auth/logout`      | No-op (204): tokens are stateless, the client drops its token                        |
| `GET /api/me`                | The signed-in user: `{ id, login, name, role, position, unit, officeName }`          |
| `GET /api/admin/users`       | ADMIN: every account (no password hashes)                                            |
| `PATCH /api/admin/users/:id` | ADMIN: `{ role }`; 409 for removing your own ADMIN role                              |

| Role         | May                                                                                                   | 403 on                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `SUPERVISOR` | `GET /api/team`, `GET /api/cases` (own only), `GET /api/people/:personId` (own team), read, PATCH, observations and actions of own cases; own journal about own employees | other supervisors' cases and employees, `/api/hr/*`, `/api/admin/*` |
| `HR`         | `/api/hr/*`, `GET /api/cases` (all), `GET /api/cases/:id` (read only), `GET /api/people/:personId`                                 | PATCH, observations, actions, `/api/team`, `/api/admin/*`, journal |
| `ADMIN`      | `/api/admin/*`                                                                                        | cases, `/api/team`, `/api/hr/*`, journal                  |
| every role   | `/api/me`, assistant, `/api/docs`, competency model, sheets, assessments, OSP, `POST /api/demo/reset` | —                                                         |

- The role is read from the account on every request, never from the token: a role changed by an ADMIN applies to
  that user's next request (the frontend picks it up at the next sign-in).
- Passwords are scrypt hashes (`PasswordHasher` of `@nestjs/authentication`, Node's `crypto.scrypt`); a wrong
  password and an unknown login get the same 401. `node scripts/hash-password.mjs <password>` prints a hash.
- Accounts sit behind `UsersRepository` (`src/auth/users.repository.ts`); the in-memory implementation
  (`users.in-memory.repository.ts`, seed in `users.seed.ts`) is bound in `AuthModule` and can be swapped for a
  database one there. Supervisors are linked to `EVALUATORS` of the case seed by `evaluatorId`.

### Demo accounts (for the jury)

All people are fictional.

| Login        | Password      | Role         | Who                                     |
| ------------ | ------------- | ------------ | --------------------------------------- |
| `j.kaminska` | `Kompas2026!` | `SUPERVISOR` | Joanna Kamińska, 6 cases (c-001…c-006)  |
| `r.sikora`   | `Kompas2026!` | `SUPERVISOR` | Robert Sikora, 2 cases (c-101, c-102)   |
| `a.pawlak`   | `Kompas2026!` | `SUPERVISOR` | Agnieszka Pawlak, 2 cases (c-103, c-104) |
| `a.lis`      | `Kompas2026!` | `HR`         | Agnieszka Lis, HR (kadry)               |
| `admin`      | `Kompas2026!` | `ADMIN`      | Marek Zając, administrator              |

## API

Contract: `notatki/api-kontrakt-v1.md`. Static data and pure functions.
| Route                                 | What it does                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/competency-model`           | 14 competencies, 49 indicators with level descriptions, scale 1/3/5/7/9, instructions (Polish)     |
| `GET /api/sheets`                     | Sheets `A`, `B`, `C` (periodic, rozp. 2016) and `FIRST` (first assessment, rozp. 2015)             |
| `GET /api/civil-service-grades`       | `{ grades, legalBasis }`: the nine civil-service grades `I`…`IX` (art. 86 ust. 1 ustawy), lowest first |
| `POST /api/assessments/suggest-level` | Suggested criterion score from indicator ratings (`null` = no basis to rate). Only a suggestion    |
| `POST /api/assessments/evaluate`      | Average, level and POSITIVE/NEGATIVE result with Polish reasons citing the regulation              |

- Suggest rule (ours, not from the regulations): mean of rated indicators, snapped to the nearest point of the
  sheet's scale, exact ties toward 5. On `FIRST`, indicator levels 1/9 are clamped to 3/7 before averaging.
- Periodic: POSITIVE iff average > 4 and no score equals 1 (§11 rozp. 2016). FIRST: POSITIVE iff exam `YES` or
  `NOT_APPLICABLE`, report on time, at most one 3 and average ≥ 5 (§10 rozp. 2015). Thresholds use the exact average.
- Validation errors answer 400 with `message` as an array of Polish strings.
- Each periodic sheet has `template`: the fixed texts of its official template (annex, title, „Potwierdzamy” of part I,
  the assessed person's statement, „Pouczenie” of art. 83 ust. 1, the part III note, footnote and request sentence),
  so the UI never retypes them. `FIRST` has `template: null`.

```bash
curl -X POST localhost:3000/api/assessments/evaluate -H 'content-type: application/json' \
  -d '{"sheetId":"FIRST","scores":[{"criterionId":"rzetelnosc","points":5},{"criterionId":"wykorzystywanie_wiedzy","points":5},{"criterionId":"organizacja_pracy","points":5},{"criterionId":"komunikacja","points":5},{"criterionId":"wspolpraca","points":5}],"firstAssessment":{"examPassed":"YES","reportSubmittedOnTime":true}}'
```

### v2: assessment cases (in-memory demo)

Contract: `notatki/api-kontrakt-v2.md`. Cases live in memory, seeded on startup (and on `POST /api/demo/reset`) with
fictional data relative to `DEMO_TODAY` (env, default `2026-11-21`); every deadline is computed against that date.

| Route                            | What it does                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/cases`                 | Cases visible to the caller (`CaseSummary[]`): own for a supervisor, all for HR          |
| `GET /api/team`                  | The supervisor's cases (`CaseSummary[]`) and `todo` sorted by deadline                   |
| `GET /api/cases/:id`             | `CaseDetail`: stages, deadlines, OSP + analysis, part I, observations, ratings, check    |
| `PATCH /api/cases/:id`           | Partial update; 400 for invalid values, 409 for parts locked at the current stage       |
| `POST /api/cases/:id/observations` | Adds an S-D-R observation (201)                                                        |
| `POST /api/cases/:id/actions`    | State machine (`{ action, date? }`; `date` only for `RECORD_ASSESSMENT_TALK`); 409 with a Polish explanation for an illegal transition, 400 for an invalid date |
| `GET /api/osp`                   | The 3 real OSP documents from the materials (`src/osp/osp.data.ts`)                     |
| `GET /api/hr/overview`           | Counters and every case in the office, with evaluator, last reminder and `objectionSubmittedOn` (date of the objection, „Sprzeciw”, else `null`) |
| `POST /api/hr/reminders`         | Simulated reminders (`{ caseIds }`), logged in each case's history                       |
| `POST /api/demo/reset`           | Restores the seed (cases and the journal)                                                |
| `GET /api/people/:personId`      | Employee profile: `{ person, supervisor, osp, history, currentCase, nextAssessment }`. `osp` = `{ title, purpose, mainTasks }` from the job description of the current case (else the latest), or `null` without one. `history` is newest first: `{ source: 'SYSTEM', caseId, path, cycleLabel, status, result, level, signedByEvaluatorOn, acknowledgedOn }` per case (`result` once signed) and last `{ source: 'EXTERNAL', result, level, date }` (the assessment before the system); `currentCase` = `{ id, path, currentStage }` of the newest unfinished case or `null`; `nextAssessment` `OKRESOWA` \| `PIERWSZA`. Built from the cases the caller may read; 404 for an unknown person and for someone else's employee |
| `PATCH /api/people/:personId`    | `{ position, unit, employment: 'URZEDNIK' \| 'PRACOWNIK', hiredOn }` (all required, `hiredOn` not after today) → the profile as in `GET`; updates the person in all their cases. Same access as `GET` (404 otherwise), 400 for an empty field or a future date |
| `GET /api/cases/:id/sheet.pdf`   | The filled periodic sheet (A/B/C, parts I–III) as a PDF (Open Sans embedded); who may read the case may download it (403/404 as `GET /api/cases/:id`, 409 for the first assessment) |
| `GET /api/cases/:id/sheet.docx`  | The same sheet as DOCX (Word, LibreOffice)                                                |
| `GET /api/ack/:token`            | Public (no sign-in): the read-only sheet for the assessed person, or `{ acknowledgedOn, objectionDeadline, objection, objectionOpen }` once confirmed (also after the objection term, then `objectionOpen: false`); 404 for an unknown, replaced or expired link |
| `POST /api/ack/:token`           | Public: `{ confirmed: true }` → `EMPLOYEE_ACK_ASSESSMENT` today, `{ acknowledgedOn, objectionDeadline, objection, objectionOpen }`; 400 without `confirmed: true`, 404 as above; a repeat returns the first date |
| `POST /api/ack/:token/objection` | Public: `{ text (1–4000 chars, trimmed), confirmed: true }` → records the objection (art. 83 ust. 1: periodic only, once, within 7 days of the acknowledgement) as `CaseDetail.objection` `{ text, submittedOn }` plus a history entry; returns the same body as `GET`; 400 for invalid input, 404 as above, 409 before the acknowledgement, after the term, for a first assessment or a second time |

- Sheet files (`src/export/`): built from the same case data as the sheet preview in the frontend and the fixed texts
  of the sheet `template`; PDF with [pdfmake](https://github.com/bpampuch/pdfmake) (MIT), DOCX with
  [docx](https://github.com/dolanmiu/docx) (MIT), so no browser or office suite is needed in the container.
  `Content-Disposition: attachment; filename="Arkusz-C-Dabrowska-Ewa-2026-11-21.pdf"; filename*=UTF-8''…` (the
  date is the day of download; CORS exposes the header). Until the evaluator signs, the name ends with
  `-wersja-robocza` and every page has a „WERSJA ROBOCZA” header. The PDF embeds Open Sans from `assets/fonts/`
  (SIL Open Font License 1.1, `assets/fonts/OFL.txt`), so Polish letters never depend on the viewer.
- Rules are pure functions with unit tests in `src/cases/*.rules.ts`: deadlines (`deadlines.rules.ts`, KC term rules
  incl. shifting from Saturdays, Sundays and holidays, each `Deadline` with `legalBasis`), stages
  (`stages.rules.ts`), actions (`actions.rules.ts`), PATCH locks (`patch.rules.ts`) and the formal check
  (`formal-check.rules.ts`). The OSP proposal (sheet + additional criteria) is `src/osp/osp-analysis.rules.ts`.
- `evaluation` in `CaseDetail` is computed with the v1 `evaluate` rules once every criterion is decided.
- PATCH merges one level deep (ratings per indicator); `null` in `decisions` / `deviationNotes` removes a key.
- Part II items 10–11 and part III of sheets A/B/C (`src/cases/promotion.rules.ts`), editable on the same stages as
  `justification` / `iprz` (until the evaluator signs):
  - `previousAssessment: { result: POSITIVE|NEGATIVE|null, level, date } | null`; `level` is a scale label as the
    sheet writes it (`na poziomie oczekiwań`); seeded (system data) only for urzędnicy past `OPENING_TALK` whose cycle
    started with a previous assessment. Every case up to `OPENING_TALK` starts with these fields empty.
  - `promotionRequest: { attached: YES|NO|NOT_APPLICABLE|null, appointedYear, currentGrade, gradeGrantedOn,
    requestedGrade, motivation }`. A pracownik służby cywilnej is always `NOT_APPLICABLE` (YES/NO → 400); an urzędnik
    answers YES or NO; YES is refused for a negative result (§11 ust. 5 rozp. 2016). Part III fields are accepted and
    kept only with YES (NO clears them), grades come from `GET /api/civil-service-grades`, `requestedGrade` must be
    the next grade after `currentGrade` (art. 89 ust. 1), `motivation` ≤ 4000 characters.
  - The formal check item `PROMOTION_REQUEST` requires an answer and, with YES, a complete part III.
- 409 body: `{ statusCode, error, message }` (+ `formalCheck` with the failing items for `SIGN_ASSESSMENT`).
- `CaseDetail` also carries `availableActions` (actions legal right now), an addition to the contract.
- Link for the assessed person (`src/cases/ack-link.rules.ts`, `src/ack`): `SEND_FOR_ACK` (after the evaluator's
  signature) generates a token (`crypto.randomBytes(32)`, base64url) valid 14 days; calling it again before the
  confirmation replaces the token, so the previous link stops working. `CaseDetail.ackLink` (`/zapoznanie/{token}`, a
  frontend path) and `ackLinkExpiresOn` are filled only for the case's evaluator and only until the confirmation; the
  token itself is never in the case view. `GET /api/ack/:token` returns only what the sheet prints (no ids,
  observations, indicator ratings, OSP or history). `CaseDetail.sentForAckOn` is the date of the first handover.
  After the confirmation the link no longer shows the sheet but keeps working for the objection
  (`src/cases/objection.rules.ts`, hacknation-backend#56): until `objectionDeadline` the assessed person can file
  one objection, read-only afterwards; past the term `GET` returns `objectionOpen: false`.
- Periodic stages: `OSP_ANALYSIS` → `SHEET_PROPOSAL` („Wstępny formularz”: the evaluator reviews the proposed sheet and
  criteria, may change them with PATCH, then `ACCEPT_SHEET`) → `OPENING_TALK` → … `ACCEPT_OSP_ANALYSIS` now moves the
  case to `SHEET_PROPOSAL`; cases already past it report its `completedOn` as the OSP analysis date.
- After `ASSESSMENT` („Formularz oceny kompetencji”, the sheet filled as a draft) come the stages III and IV of the
  Poradnik (Tabela nr 1): `ASSESSMENT_TALK` („Rozmowa oceniająca”, §10 rozp. 2016) once every criterion has a partial
  score, then `JUSTIFICATION` („Weryfikacja formularza”, §11: corrections after the talk, justification, IPRZ, formal
  check, signature) → `DOCUMENT`. `RECORD_ASSESSMENT_TALK` (`{ action, date? }`, today by default; 400 for a date in
  the future or before the employee acknowledged part I) sets `CaseDetail.assessmentTalkOn`. `SIGN_ASSESSMENT` is
  allowed only at `JUSTIFICATION`, after the talk (formal check item `ASSESSMENT_TALK_HELD`).
  `CaseDetail.assessmentTalkTopics` lists the §10 topics (`src/cases/assessment-talk.rules.ts`; empty for the first
  assessment). Part II stays editable until the signature.

The competency data in `src/competency-model/data/model.data.ts` is generated from `notatki/model-kompetencji.json`
by `node scripts/generate-model-data.mjs` (then run prettier on it). Don't edit it by hand.

### Journal: notes and observations about an employee

A supervisor's notes and S-D-R observations about each employee, kept all year, independent of the case stage
(`src/journal`). Stored in PostgreSQL (`journal_notes`, `journal_observations`) with `DATABASE_URL`, in memory
without it; the demo seed goes into empty tables only. `SUPERVISOR` only (HR and ADMIN get 403: notes are private),
and only about people from cases the supervisor evaluates (else 403, unknown person 404); an entry is visible to its
author only (someone else's entry: 404). Lists are newest first.

| Route                                  | What it does                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/people/:personId/notes`      | The user's notes about the person                                                         |
| `POST /api/people/:personId/notes`     | `{ text }` (1–5000 chars, trimmed) → note (201)                                           |
| `PATCH /api/notes/:id`                 | `{ text }` → note with new `updatedAt`                                                    |
| `DELETE /api/notes/:id`                | 204                                                                                       |
| `GET /api/people/:personId/observations` | The user's observations about the person, by `date`                                     |
| `POST /api/people/:personId/observations` | `{ date, criterionId, indicatorId?, kind, situation, action, result }` → observation (201); 400 for an unknown criterion, an indicator of another criterion, a date after today, S/D/R empty or over 2000 chars |
| `PATCH /api/observations/:id`          | Any of those fields; the merged observation is validated again                            |
| `DELETE /api/observations/:id`         | 204                                                                                       |

### AI assistant (source-grounded)

| Route                                  | What it does                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/assistant/ask`              | `{ question, caseId?, stageId?, history? }` → answer + sources; one assistant for rules and talk preparation: with `caseId` the answer also uses the case and its stage; `assistant` (`FORMAL\|CONVERSATION`) is still accepted but ignored; `history`: earlier exchanges of the same chat, oldest first, `[{ question, answer }]` (only the last 3 are used, each field cut to 2000 chars; never stored or logged) |
| `GET /api/assistant/suggestions`       | Example questions, `?stageId=` per stage: one list (rules and talk preparation, up to 6), talk questions first on `ASSESSMENT_TALK` |
| `GET /api/assistant/documents`         | Every source document: `{ id, title, description, url, indexed, note }`         |
| `GET /api/docs`                        | Same list                                                                       |
| `GET /api/docs/<path>`                 | The original file from `docs/` (404 outside it: `..`, absolute paths, dotfiles) |

- Every answer source has `url`: `/api/docs/<file>` (relative to the API origin, `#page=N` for a PDF excerpt), or
  `null` for a document without a file (`LT`, `QA`). The document registry is `src/assistant/documents.ts`.
- Knowledge base: `src/assistant/data/knowledge.data.ts`, generated by `npm run kb:build`
  (`scripts/build-knowledge-base.mjs`, needs `pdftotext` and `unzip`) only from `docs/`: the civil service act, both
  regulations, both KPRM guides, the HR management standards (`SZ`, with the 2020 amendment), sheets B, C and of the
  first assessment, and the competency model (per competency and per indicator with its 5 levels). Acts are chunked
  by art./§/ust., the standards by part and point, guides by page, sheets by part. The deadline note (`LT`) and the
  Q&A set (`QA`) are not in `docs/`: their chunks already in the data file are kept until the file is added at the
  path in the script (see `docs/README.md`). Don't edit the data file by hand.
- Retrieval: local BM25 (`bm25.ts`, `text-normalize.ts`: no diacritics, light Polish stemming, bigrams); below a
  score/coverage threshold the answer is "Nie znalazłem tego w bazie wiedzy" with `grounded: false`.
- Follow-ups (`src/assistant/followup.rules.ts`): with `history`, the last question is first turned into a standalone
  one for retrieval: by the LLM (short rewrite call, 15 s budget) or, without an LLM or when the call fails, by a
  heuristic (a short question, one starting with „a”, „i”, „to”, „czy to” or with a pronoun like „go”, „jej”, „ten”
  gets the earlier question glued in front). The LLM also gets the earlier exchanges as the conversation, without their
  citation numbers; sources and citations still come only from the knowledge base. Without `history` nothing changes.
- Query expansion: abbreviations and synonyms of the civil service (IPRZ, OSP, ZZL, DG, „ponowna ocena”, „odwołanie”
  → sprzeciw, „formularz” → arkusz, …) are in one data file, `src/assistant/data/synonyms.data.ts`, each with its
  source; `query-expansion.rules.ts` adds them to the question with a lower weight, so exact wording still wins.
  To add a term, add an entry with its source (only wordings from `docs/`) and check `npm run eval:assistant`.
- Generation: optional, any OpenAI-compatible endpoint via `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (see
  `.env.example`). Without it, or when the call fails, answers are extractive (`mode: "EXTRACTIVE"`).
- The assistant is always on: there is no feature flag (without an LLM it answers extractively).
  `GET /api/config` stays for older frontends and always returns `{ "features": { "assistant": true } }`.
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
- Env: `PORT=3000`, `FRONTEND_URL=https://hacknation.rabbithole.carrotly.tech`, `JWT_SECRET` (32+ random bytes).
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
