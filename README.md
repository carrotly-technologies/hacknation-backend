# hacknation-backend

NestJS API for HackNation. The React frontend lives in
[hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend).

Submission docs (Polish: project description, use of AI, architecture, HackTribe texts): [`docs/zgloszenie/`](docs/zgloszenie/).

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
| `DATA_ENCRYPTION_KEY` | dev-only default      | AES-256-GCM key for free text stored in PostgreSQL (32 bytes base64: `openssl rand -base64 32`); without it a warning is logged. Set it in production and keep it outside the database |
| `RETENTION_YEARS`   | `10`                    | Cases that ended (and journal entries) more than this many years ago are anonymized / deleted |
| `MONITOR_TOKEN`     | (unset)                 | Secret of the activity monitor (`X-Monitor-Token`, frontend `/aktywnosc`); unset = `/api/monitor/*` answers 404 |
| `RATE_LIMIT_PER_MINUTE` | `100`              | Requests per minute per route and client (signed-in account, otherwise IP); more → 429 |
| `RATE_LIMIT_LOGIN_PER_MINUTE` | `5`          | Sign-in attempts (`POST /api/auth/login`) and assessed-person confirmations (`POST /api/ack/*`) per minute per IP |
| `TRUST_PROXY`       | `loopback, linklocal, uniquelocal` | Express `trust proxy`: proxies whose `X-Forwarded-For` gives the client IP (default: any on a private network, e.g. Coolify/nginx in front of the container); `false` when clients connect directly |
| `BODY_LIMIT`        | `1mb`                   | Largest request body; bigger answers 413                        |

### Database (optional)

```bash
docker compose up -d db   # PostgreSQL 17 on localhost:5432
DATABASE_URL=postgres://hacknation:hacknation@localhost:5432/hacknation npm run start:dev
```

`src/database` (global module) connects with Drizzle ORM and `pg` and applies the migrations from `drizzle/` at
startup, before the first request. After changing a `src/**/*.tables.ts` schema run
`npx drizzle-kit generate --name=<change>` and commit the generated folder. Without `DATABASE_URL` every module uses
in-memory storage.

### RODO: minimisation, encryption, retention

Documentation for the office (in Polish): [`docs/rodo/`](docs/rodo/): the record of processing
([`rejestr-przetwarzania.md`](docs/rodo/rejestr-przetwarzania.md)), the DPIA with TLS and encryption
([`dpia.md`](docs/rodo/dpia.md)) and the retention policy ([`retencja.md`](docs/rodo/retencja.md)).

- **Encryption at rest** (`src/crypto/field-cipher.ts`): the journal's free text (`journal_notes.text`,
  `journal_observations.situation/action/result`) is stored as `v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM, a fresh IV
  per value, `v1` = key version) and decrypted on read. At startup, after the schema migrations, rows still in plain
  text (or under the dev key, once `DATA_ENCRYPTION_KEY` is set) are encrypted with the current key; a second start
  changes nothing. Cases are in memory in this version, so nothing of them is at rest.
- **Retention** (`src/retention`): cases that ended (objection term over, or acknowledged for a first assessment)
  more than `RETENTION_YEARS` ago are anonymized (person „Osoba zanonimizowana”, free text and history removed,
  scores and dates kept); journal notes last changed and observations dated before that are deleted. Runs at
  startup and every 24 h; on demand:

  ```bash
  npm run build && npm run retention     # prints { cutoff, casesAnonymized, journalNotesDeleted, ... }
  docker exec <container> node dist/retention/retention.cli.js
  ```

- **Minimisation**: each view returns only what its reader needs (`GET /api/ack/:token` exactly what the sheet
  prints, lists without assessment texts, no token or password hash in any response); `test/rodo.e2e-spec.ts`
  checks it.

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

## API docs (Swagger)

Every route with its summary (Polish), request body schema, error codes and required auth, grouped by module:

| Where      | Swagger UI                                                     | OpenAPI 3 spec (JSON)                                               |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| local      | <http://localhost:3000/api/swagger>                            | <http://localhost:3000/api/swagger.json>                            |
| production | <https://api.hacknation.rabbithole.carrotly.tech/api/swagger> | <https://api.hacknation.rabbithole.carrotly.tech/api/swagger.json> |

- Both are public and on in production too. Not `/api/docs`: that path serves the source documents.
- To call a protected route from the UI: `POST /api/auth/login` (a demo account below) → copy `accessToken` →
  „Authorize” → paste it. The token is kept across reloads.
- Body schemas come from the same zod schemas that validate the requests (`@Body({ schema })`, converted by
  `@nestjs/swagger` through Standard JSON Schema), so they can't drift apart. Routes are `bearer` unless `@Public()`,
  bodies get 400 and roles (`@Roles`) 403 automatically (`src/common/openapi.ts`); per route there is only
  `@ApiTags`, `@ApiOperation({ summary })` and the 404/409 the controller throws.

## Sign-in, roles and permissions

Every `/api/*` route needs `Authorization: Bearer <token>` (401 without a valid one), except `GET /api/health`,
`GET /api/config`, `POST /api/auth/login`, the three `/api/auth/login-gov*` routes, Swagger (`/api/swagger`,
`/api/swagger.json`) and the document files `GET /api/docs/<path>` (public legal texts opened from answer links in a
new tab). A route for another role answers 403.

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"login":"k.wisniewska","password":"Kompas2026!"}' | jq -r .accessToken)
curl localhost:3000/api/me -H "Authorization: Bearer $TOKEN"
```

| Route                        | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `POST /api/auth/login`       | `{ login, password }` → `{ accessToken, tokenType, expiresIn, user }`; JWT HS256, 8 h |
| `POST /api/auth/logout`      | 204; ends the session of the token sent with it (refused from then on, 401). Without a token: no-op 204 |
| `POST /api/auth/login-gov/start` | Simulated login.gov.pl: → `{ redirectUrl, state }`; `state` = 32 random bytes (base64url), valid 5 min; `redirectUrl` = `${FRONTEND_URL}/mock-login-gov?state=…` |
| `POST /api/auth/login-gov/mock-authorize` | The mock identity provider: `{ state, pesel, method: 'profil-zaufany' \| 'mobywatel' \| 'bank' }` → `{ artifact }`, one-time, valid 60 s; one artifact per state; 400 for an unknown or expired state, an invalid PESEL or method |
| `POST /api/auth/login-gov`   | `{ artifact, state }` → same body as `POST /api/auth/login` (token `method: 'login.gov.pl'`); 400 bad or expired state, 401 used or expired artifact, 401 „Brak konta dla tej osoby.” for an unknown PESEL |
| `GET /api/me`                | The signed-in user: `{ id, login, name, role, position, unit, officeName }`          |
| `GET /api/admin/users`       | ADMIN: every account (no password hashes)                                            |
| `PATCH /api/admin/users/:id` | ADMIN: `{ role }`; 409 for removing your own ADMIN role                              |
| `GET /api/admin/audit`       | ADMIN: the event log, newest first (see [Audit log](#audit-log-who-what-when))       |
| `GET /api/admin/audit/verify` | ADMIN: checks the hash chain → `{ ok: true, count }` or `{ ok: false, count, firstBrokenId }` |
| `GET /api/admin/audit/actions` | ADMIN: every action with its Polish name `[{ action, label }]` (for the filter)    |

| Role         | May                                                                                                   | 403 on                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `SUPERVISOR` | `GET /api/team`, `GET /api/cases` (own only), `GET /api/people/:personId` (own team), read, PATCH, observations and actions of own cases; own journal about own employees | other supervisors' cases and employees, `/api/hr/*`, `/api/admin/*`, `POST /api/demo/reset` |
| `HR`         | `/api/hr/*`, `GET /api/cases` (all), `GET /api/cases/:id` (read only), `GET /api/people/:personId`                                 | PATCH, observations, actions, `/api/team`, `/api/admin/*`, journal |
| `ADMIN`      | `/api/admin/*` (users, audit log), `POST /api/demo/reset` (also HR)                                   | cases, `/api/team`, `/api/hr/*`, journal                  |
| every role   | `/api/me`, assistant, `/api/docs`, competency model, sheets, assessments, OSP                         | —                                                         |

- The role is read from the account on every request, never from the token. A role changed by an ADMIN also ends
  that user's sessions (`tokenVersion`, claim `tv`): their next request answers 401 and they sign in again with the
  new role.
- Tokens: HS256 only (`alg: none` and other algorithms answer 401), `exp` checked, 8 h. Sign-out revokes the token's
  `jti` until it expires.
- Passwords are scrypt hashes (`PasswordHasher` of `@nestjs/authentication`, Node's `crypto.scrypt`); a wrong
  password and an unknown login get the same 401. `node scripts/hash-password.mjs <password>` prints a hash.
- Accounts sit behind `UsersRepository` (`src/auth/users.repository.ts`); the in-memory implementation
  (`users.in-memory.repository.ts`, seed in `users.seed.ts`) is bound in `AuthModule` and can be swapped for a
  database one there. Supervisors are linked to `EVALUATORS` of the case seed by `evaluatorId`.

### Sign-in through login.gov.pl (simulation)

There is no access to Węzeł Krajowy (login.gov.pl) at the hackathon, so the app ships a mock that follows its flow
(redirect with `state` → one-time artifact → back-channel exchange), not SAML:

1. The frontend calls `POST /api/auth/login-gov/start` and goes to `redirectUrl` (the frontend page
   `/mock-login-gov`, clearly marked as a simulation, with no official logos).
2. On the mock page the user picks a method (profil zaufany, aplikacja mObywatel, bankowość elektroniczna) and a demo
   person; the page calls `POST /api/auth/login-gov/mock-authorize` with that person's fictional PESEL and returns
   to `/logowanie/login-gov?artifact=…&state=…`.
3. The return page calls `POST /api/auth/login-gov`: the backend checks the state, burns the artifact (single use,
   also on failure), finds the account by PESEL (`UsersRepository.findByPesel`) and issues the usual 8 h JWT.

State and artifacts live in process memory (`src/auth/login-gov.service.ts`), expired entries are swept on each call
and each map is capped at 10 000 entries, so this needs a single instance. PESELs sit only in `users.seed.ts` and are
never returned by the API.

To replace the mock with the real Węzeł Krajowy:

- register the service (system) with the operator of Węzeł Krajowy (KPRM / COI) and sign the agreement;
- generate the signing and encryption key pair and certificate, and exchange SAML 2.0 metadata (SP `EntityDescriptor`
  with the `AssertionConsumerService` URL; the IdP metadata of WK for the chosen environment: test or production);
- `start` builds a signed `AuthnRequest` (with `RelayState` = state, required LoA) and redirects to WK instead of
  `/mock-login-gov`; drop `mock-authorize` and the mock page;
- the exchange sends a signed `ArtifactResolve` (SOAP) for the `SAMLart` artifact, verifies the signature, decrypts the
  assertion and reads `PersonIdentifier` (PESEL) from it; then a `LogoutRequest` for single logout;
- keep state and artifacts in a shared store (e.g. the database) when the app runs on more than one instance, and add
  a PESEL column to the accounts table.

### Demo accounts (for the jury)

All people are fictional.

| Login                  | Password      | Role         | Who                                          |
| ---------------------- | ------------- | ------------ | -------------------------------------------- |
| `k.wisniewska`         | `Kompas2026!` | `SUPERVISOR` | Karolina Wiśniewska, 6 cases (c-001…c-006)   |
| `a.szymanczak`         | `Kompas2026!` | `SUPERVISOR` | Agnieszka Szymańczak, 2 cases (c-101, c-102) |
| `j.kuchta`             | `Kompas2026!` | `SUPERVISOR` | Jolanta Kuchta, 2 cases (c-103, c-104)       |
| `a.cieslak-dyjecinska` | `Kompas2026!` | `HR`         | Agata Cieślak-Dyjecińska, HR (kadry)         |
| `admin`                | `Kompas2026!` | `ADMIN`      | Marek Zając, administrator                   |

### Security (OWASP ASVS L2)

Checklist with status and code paths: [`docs/security/asvs-l2.md`](docs/security/asvs-l2.md).

- Headers (`helmet`, `src/configure-app.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS,
  `Referrer-Policy`, COOP, no `X-Powered-By`, `Cache-Control: no-store` (except the public `/api/docs/<path>` files).
  No CSP on the JSON API; the frontend's nginx sends the CSP.
- Rate limits (`src/security/rate-limit.module.ts`, `@nestjs/throttler`): 429 with `Retry-After` and a Polish
  `message`, e.g. „Zbyt wiele prób logowania. Spróbuj ponownie za minutę.”. Counts live in process memory: with
  several instances each counts on its own.
- Validation: every body is a strict zod schema (unknown fields answer 400), every `:id`/`:personId`/`:token`
  matches `[A-Za-z0-9_-]{1,128}` (`src/security/params.schemas.ts`), bodies over `BODY_LIMIT` answer 413.
- `test/rbac.e2e-spec.ts` checks 401 and 403 for every route against its role table and fails when a new route has no
  row there.

## API

Static data and pure functions. The route tables in this README are the API contract (request bodies validated by
the zod schemas in `src/**/*.schemas.ts`).
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

Cases live in memory, seeded on startup (and on `POST /api/demo/reset`) with
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
| `POST /api/cases`                | SUPERVISOR (own team) or HR: `{ personId }` → the new case (201). Path, cycle start and first stage from `src/cases/new-case.rules.ts`: after an acknowledged periodic assessment the next periodic cycle (also while the objection term runs), after a positive first assessment a periodic one from hiring on an indefinite contract, without any case the first assessment in the first 12 months. 409 while a case is in progress, 404 for an unknown or foreign person |
| `POST /api/demo/reset`           | ADMIN/HR: restores the seed (cases and the journal); the audit log is kept and gets a `DEMO_RESET` entry |
| `GET /api/people/:personId`      | Employee profile: `{ person, supervisor, osp, history, currentCase, nextAssessment }`. `osp` = `{ title, purpose, mainTasks }` from the job description of the current case (else the latest), or `null` without one. `history` is newest first: `{ source: 'SYSTEM', caseId, path, cycleLabel, status, result, level, signedByEvaluatorOn, acknowledgedOn }` per case (`result` once signed) and last `{ source: 'EXTERNAL', result, level, date }` (the assessment before the system); `currentCase` = `{ id, path, currentStage }` of the newest unfinished case or `null`; `nextAssessment` `OKRESOWA` \| `PIERWSZA`; `canStartCase` = whether `POST /api/cases` would start a new case now. Built from the cases the caller may read; 404 for an unknown person and for someone else's employee |
| `PATCH /api/people/:personId`    | `{ position, unit, employment: 'URZEDNIK' \| 'PRACOWNIK', hiredOn }` (all required, `hiredOn` not after today) → the profile as in `GET`; updates the person in all their cases. Same access as `GET` (404 otherwise), 400 for an empty field or a future date |
| `GET /api/cases/:id/sheet.pdf`   | The filled periodic sheet (A/B/C, parts I–III) as a PDF (Tinos, metric-compatible with Times New Roman, embedded); who may read the case may download it (403/404 as `GET /api/cases/:id`, 409 for the first assessment) |
| `GET /api/cases/:id/sheet.docx`  | The same sheet as DOCX (Word, LibreOffice)                                                |
| `GET /api/ack/:token`            | Public (no sign-in): the read-only sheet for the assessed person, or `{ acknowledgedOn, objectionDeadline, objection, objectionOpen }` once confirmed (also after the objection term, then `objectionOpen: false`); 404 for an unknown, replaced or expired link |
| `POST /api/ack/:token`           | Public: `{ confirmed: true }` → `EMPLOYEE_ACK_ASSESSMENT` today, `{ acknowledgedOn, objectionDeadline, objection, objectionOpen }`; 400 without `confirmed: true`, 404 as above; a repeat returns the first date |
| `POST /api/ack/:token/objection` | Public: `{ text (1–4000 chars, trimmed), confirmed: true }` → records the objection (art. 83 ust. 1: periodic only, once, within 7 days of the acknowledgement) as `CaseDetail.objection` `{ text, submittedOn }` plus a history entry; returns the same body as `GET`; 400 for invalid input, 404 as above, 409 before the acknowledgement, after the term, for a first assessment or a second time |

- Sheet files (`src/export/`): built from the same case data as the sheet preview in the frontend and the fixed texts
  of the sheet `template`; PDF with [pdfmake](https://github.com/bpampuch/pdfmake) (MIT), DOCX with
  [docx](https://github.com/dolanmiu/docx) (MIT), so no browser or office suite is needed in the container.
  `Content-Disposition: attachment; filename="Arkusz-C-Dabrowska-Ewa-2026-11-21.pdf"; filename*=UTF-8''…` (the
  date is the day of download; CORS exposes the header). Until the evaluator signs, the name ends with
  `-wersja-robocza` and every page has a „WERSJA ROBOCZA” header. Both files are set like an official letter: Times
  New Roman, 12 pt text, 14 pt bold title and part headings, 10 pt notes, line spacing 1.15, A4 with 2 cm margins.
  Times New Roman is commercial and cannot be embedded, so the PDF embeds the metric-compatible Tinos from
  `assets/fonts/` (SIL Open Font License 1.1, `assets/fonts/OFL.txt`, from github.com/googlefonts/tinos v1.340),
  so Polish letters never depend on the viewer. The DOCX names Times New Roman (LibreOffice substitutes Liberation Serif).
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
- Periodic stages: `OSP_ANALYSIS` → `SHEET_PROPOSAL` (shown with `OSP_ANALYSIS` as one step „Analiza stanowiska”: the evaluator reviews the proposed sheet and
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

### Audit log (who, what, when)

Every data change and every sign-in is written to an append-only event log (`src/audit`), which an ADMIN reads and
checks in the app (`/admin/dziennik` in the frontend). Reads are not logged.

| Route                          | What it does                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `GET /api/admin/audit`         | ADMIN: `?actorId=&action=&from=&to=&page=1&pageSize=50` (max 200) → `{ items, total, page, pageSize }`, newest first. `action` is exact or a family (`CASE_ACTION` matches every `CASE_ACTION:*`); `from` / `to` are inclusive ISO dates or timestamps; 400 for invalid values |
| `GET /api/admin/audit/verify`  | ADMIN: recomputes the whole chain → `{ ok: true, count }`, or `{ ok: false, count, firstBrokenId }` with the first entry that does not match (`count` = entries fine before it) |
| `GET /api/admin/audit/actions` | ADMIN: `[{ action, label }]`, every action with its Polish name                      |

- An entry (`items[]`): `{ id, seq, at, actorId, actorRole, action, resourceType, resourceId, changedFields, ip,
  result, prevHash, hash }` plus, resolved when read, `actorName` (current name of the account, `null` without one),
  `actionLabel` and `resourceTypeLabel` (Polish). `actorRole` is the role at the time, or `ASSESSED_VIA_LINK` for the
  assessed person on `/api/ack/:token`; `result` is `OK`, `DENIED` (401/403/429) or `ERROR` (400, 404, 409, 500).
  Actions: `LOGIN`, `LOGIN_FAILED`, `CASE_CREATE`, `CASE_PATCH`, `CASE_OBSERVATION_ADD`, `CASE_ACTION:<action>`,
  `HR_REMINDERS`, `PERSON_UPDATE`, `USER_ROLE_CHANGED`, `DEMO_RESET`, `JOURNAL_NOTE_*`, `JOURNAL_OBSERVATION_*`,
  `ACK_CONFIRM`, `ACK_OBJECTION`; a new route not yet named is still logged as `HTTP:<METHOD> <path>`.
- How it is written: a global interceptor writes the entry of every POST/PUT/PATCH/DELETE after the handler and before
  the response (`src/audit/audit-actions.ts` maps each route to its action and resource; an e2e test fails when a new
  data-changing route is missing there). A change a role guard refuses (403) never reaches an interceptor, so a
  middleware records it when the response is sent. Sign-in writes `LOGIN` / `LOGIN_FAILED` itself. Computations
  (`POST /api/assessments/*`, `POST /api/assistant/ask`) change nothing and are not logged; logout is logged as
  `LOGOUT` (it revokes the token).
- RODO, data minimisation: `changedFields` holds the names of the top-level fields sent (`["ratings",
  "justification"]`), never their values: no ratings, justifications, notes, objection texts or passwords. A failed
  sign-in stores the id of the targeted account (`resourceId`, `null` for an unknown login), never the login typed.
  The ack token is never stored (the entry names the case). Names are not stored either: `actorName` is looked up at
  read time. The client IP (`ip`) is personal data: it is kept for security (who tried what from where), visible to
  ADMIN only, and is the only personal datum in the log besides the account id. Behind a reverse proxy the IP is the
  proxy's unless Express `trust proxy` is set. The log is kept indefinitely (retention is out of scope).
- Immutability:
  - Each entry has `hash = sha256(prevHash || canonical JSON of the entry)` (`src/audit/audit-chain.ts`; keys sorted,
    `prevHash` of the first entry is 64 zeros), so a changed, removed or reordered entry breaks the chain and
    `verify` names it. Removing entries from the end is not detectable by the chain alone.
  - PostgreSQL (`audit_log`, migration `drizzle/20261122090545_audit_log`): a trigger refuses every `UPDATE`,
    `DELETE` and `TRUNCATE` (`audit_log is append-only: … is not allowed`). Appends run in a transaction holding
    `pg_advisory_xact_lock`, read the last entry and insert the next one, so parallel requests, also from several
    instances, form one chain (unique `seq` and `prev_hash` back it up). The test `src/audit/audit.repository.spec.ts`
    runs the real migrations on PGlite: UPDATE/DELETE/TRUNCATE fail, and an entry changed with the trigger disabled
    is reported by `verify`. Against a real server: `docker compose up -d db`, start with `DATABASE_URL`, then
    `docker compose exec db psql -U hacknation -c "DELETE FROM audit_log"` fails.
  - Without `DATABASE_URL` the log is in memory with the same chain (no trigger, no API to change an entry): lost on
    restart and kept per instance, so a deployment with several instances needs `DATABASE_URL`.
- No route changes or removes an entry, and `POST /api/demo/reset` keeps the log (it adds `DEMO_RESET`).
- A failed write of an entry is logged (action name and error type only) and does not fail the request, whose change
  is already done.

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

### Activity monitor (who uses the app)

`src/monitor` logs every `/api/*` call and every screen of the frontend into `request_log` (PostgreSQL with
`DATABASE_URL`, else in memory, at most 50 000 entries), so the team can see whether and how the prototype is used.

- Each entry: `at`, `sessionId` (`X-Session-Id`, a UUID the frontend keeps per tab in `sessionStorage`; anything else
  is stored as `null`), `kind` (`API` / `PAGEVIEW`), `method`, `path` (with the query), `status`, `durationMs`, `ip`
  (first `X-Forwarded-For` address, `trust proxy` is on), `userAgent`, `userId` and `userName` (the account's login,
  not the person's name) of the signed-in account.
- Never logged: request and response bodies (so no passwords, tokens or assessment content), the `Authorization`
  header, the token of the assessed person's link (`/api/ack/***`, `/zapoznanie/***`) and secret query values (`code`, `state`, `token`, `pesel`, … → `***`). Not logged at all:
  `/api/monitor/*`, `/api/health`, Swagger and CORS preflights. A MAC address cannot be known by a web app.
- The write happens after the response is sent and never changes it; a failed write is only a warning in the log.
- Retention: entries older than 30 days are deleted at startup and once a day.
- Calls without a valid `X-Session-Id` (curl, Swagger) are grouped per IP, browser and day as `anon-<day>-<hash>`.
- No geolocation of IPs (it would need an external service or a licensed database).

| Route                                 | What it does                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /api/telemetry/pageview`        | Public: `{ path }` (starts with `/`, ≤ 500 chars) → 204; the frontend sends it on every route change |
| `GET /api/monitor/sessions`           | `?from&to` (date or ISO 8601; a date `to` includes the whole day), `?ip` (part of the address), `?userId` (part of the account id or login), `?page` (1…), `?pageSize` (1–200, default 50) → `{ items, total, page, pageSize }`; each `{ sessionId, anonymous, users: [{ id, name }], ips, userAgent, firstAt, lastAt, pageviews, apiCalls, errors }`, latest activity first |
| `GET /api/monitor/sessions/:sessionId` | `{ session, entries }`: the summary and every entry, oldest first; 404 for an unknown session     |
| `DELETE /api/monitor/sessions`        | Deletes the whole activity log (every session and entry) → `{ removed }`                           |

`/api/monitor/*` needs the header `X-Monitor-Token` equal to `MONITOR_TOKEN` (compared in constant time). Without it,
with a wrong one, or while `MONITOR_TOKEN` is unset, it answers 404 as if the route did not exist. Demo accounts and
roles play no part: a signed-in ADMIN gets 404 too. The frontend shows a one-sentence notice about the log in its
footer.

## Quality

```bash
npm run lint       # oxlint (type-aware)
npm run format     # prettier
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Vitest + supertest)
npm run test:cov
```

## Deploy

Where the data is hosted (server in Poland, what leaves the EU), its level under the government cloud standard
(SCCO, KPRM / Ministry of Digital Affairs) and the production path to an office server room or a national cloud:
[`docs/hosting.md`](docs/hosting.md) (Polish).

Production runs on Coolify (project **Hackathons**, environment `production`)
as the `hacknation-backend` application, built from this repo's `Dockerfile`:

- URL: <https://api.hacknation.rabbithole.carrotly.tech> (health: `/api/health`)
- Every push to `main` triggers a new deploy (GitHub App source, auto-deploy on).
- Env: `PORT=3000`, `FRONTEND_URL=https://hacknation.rabbithole.carrotly.tech`, `JWT_SECRET` (32+ random bytes),
  `DATA_ENCRYPTION_KEY` (32 random bytes, base64; without it the dev key is used and a warning is logged).
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
