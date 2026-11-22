# AGENTS.md

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

The official NestJS agent skills are installed with `npx @nestjs/skills add --agent all`, which also updates them: the mistakes agents make in Nest apps, with recipes checked on the released packages. An agent loads a skill when a task matches it.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

A route handler can return a web `Response`, a `ReadableStream` or an async generator, and Nest streams it as it's produced (https://docs.nestjs.com/http/streaming-responses.md).

Nest's packages are ESM only, and this project is ESM too: relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), and tests run on Vitest, so mocks are `vi.fn()`, not `jest.fn()`.

In this project, `src/main.ts` creates the app and listens on `PORT` (3000 by default), `src/configure-app.ts` sets the global `api` prefix and CORS for `FRONTEND_URL` (shared with e2e tests), and `src/app.module.ts` is the root module (global `ConfigModule`) that imports the feature modules, such as `src/health`. Unit tests sit beside the code as `*.spec.ts` and e2e tests are in `test/`; Vitest runs them (`npm test`, `npm run test:e2e`).

## Wymagania wdrożeniowe (zadanie „Kompas Kompetencji”)

Te wymagania z opisu zadania (`docs/zadanie/opis-zadania-kompas-kompetencji.pdf`, rozdz. 5, tekst w `docs/tekst/zadanie/`) obowiązują przy każdej zmianie, w obu repo (backend i [hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend)). Jury ocenia potencjał wdrożeniowy, więc zmiana, która łamie którąś z poniższych reguł, wymaga uzasadnienia w opisie PR.

Rozwiązanie powinno być:

1. **Neutralne technologicznie**: możliwe do uruchomienia w różnych środowiskach IT, niezależnie od tego, jakiego oprogramowania używa urząd, i niewymagające płatnych licencji.
   - Zależności tylko open source na licencjach permisywnych (MIT, Apache-2.0, BSD, ISC). Przed dodaniem paczki sprawdź jej licencję.
   - Żadna płatna usługa nie może być potrzebna do uruchomienia. Każda usługa zewnętrzna jest opcjonalna i ma działający fallback. Przykład: LLM przez dowolny endpoint zgodny z OpenAI (`src/assistant/llm.client.ts`); bez `LLM_BASE_URL`/`LLM_MODEL` asystent odpowiada ekstraktywnie z cytatami.
   - Działa na Linux, Windows i macOS: przez Node LTS albo jako obraz Docker (`Dockerfile`). Bez kodu zależnego od systemu operacyjnego; ścieżki przez `node:path` / `import.meta.dirname`.
   - Żadnego vendor lock-in: bez usług konkretnej chmury (np. AWS-only SDK), w których nie ma odpowiednika self-hosted.

2. **Łatwe do wdrożenia w każdym urzędzie**: proste w instalacji lub uruchomieniu, gotowe do użycia po krótkiej konfiguracji, niewymagające specjalistycznego szkolenia.
   - `npm install && npm run start` albo `docker build` + `docker run` startuje aplikację z domyślną konfiguracją, bez dodatkowych kroków.
   - Cała konfiguracja przez zmienne środowiskowe z rozsądnymi domyślnymi wartościami. Nowa zmienna → wpis w `.env.example` (z komentarzem) i w tabeli w `README.md`.
   - Jeśli dojdzie baza danych: migracje uruchamiają się automatycznie przy starcie, bez ręcznych skryptów.
   - Interfejs i komunikaty błędów po polsku, prostym językiem, zrozumiałe dla przełożonego bez szkolenia IT.

3. **Przygotowane do pracy w różnych urzędach**: zarówno w małych, jak i dużych jednostkach, w urzędach o wysokim poziomie cyfryzacji oraz w tych, które dopiero wdrażają rozwiązania cyfrowe.
   - Bez nazw, struktur ani danych konkretnego urzędu zaszytych w kodzie. Dane demo są w `src/cases/seed/`, a reguły nie zakładają liczby pracowników ani struktury organizacyjnej.
   - Musi działać bez dostępu do internetu (np. z lokalnym modelem w Ollama albo bez LLM).
   - Integracje z systemami urzędu (EZD, systemy kadrowe np. QNT) tylko przez udokumentowane API, nigdy jako warunek działania. Aplikacja ma działać samodzielnie.
   - Aplikacja jest bezstanowa względem procesu (stan w magazynie danych, nie w pamięci jednej instancji, gdy dojdzie trwały storage), żeby dało się ją skalować poziomo w dużych jednostkach.

4. **Możliwe do łatwej aktualizacji**: zaprojektowane tak, żeby dało się szybko i bezproblemowo wprowadzać zmiany po wykryciu błędów technicznych, przy potrzebie poprawy działania albo gdy pojawią się nowe potrzeby użytkowników.
   - Jeden artefakt wdrożeniowy na repo (obraz Docker). Aktualizacja = nowy obraz, bez ręcznych zmian na serwerze.
   - Każda zmiana logiki ma test (`*.spec.ts` obok kodu, e2e w `test/`); `npm test`, `npm run test:e2e` i `npm run build` muszą przechodzić przed merge.
   - API zmieniamy wstecznie kompatybilnie (tabela tras w `README.md` to dokumentacja API; nowa trasa → wpis w tej tabeli). Zmiana łamiąca = aktualizacja frontendu w tym samym tasku.
   - Moduły Nest są małe i niezależne (`src/<feature>/`), żeby poprawka jednego obszaru nie wymagała zmian w innych.

5. **Zgodne z przepisami**: uwzględnia przepisy ustawy o służbie cywilnej oraz regulacje dotyczące ochrony danych.
   - Źródłem prawdy są dokumenty w `docs/` (ustawa, rozporządzenia z 2015 i 2016 r., model kompetencji, poradniki); spis w `docs/README.md`, opis zgłoszenia (funkcje, AI, architektura) w `docs/zgloszenie/`. Nie wymyślaj reguł, których tam nie ma.
   - RODO i minimalizacja danych: przetwarzamy tylko pola potrzebne do oceny. Żadnych danych osobowych (imię, nazwisko, PESEL, treść ocen) w logach.
   - Do zewnętrznego LLM wysyłamy tylko to, co potrzebne do odpowiedzi. Bez identyfikatorów pracownika, jeśli pytanie ich nie wymaga.
   - AI jest wyłącznie doradcze: może sugerować (np. `src/assessments/suggest-level.rules.ts`), ale nigdy nie ustala ostatecznej oceny. Decyzja zawsze należy do przełożonego, co widać w API i w UI.
   - Asystent odpowiada na podstawie bazy wiedzy, wskazuje źródło, a przy braku informacji mówi to wprost, zamiast zgadywać.
   - Dostęp do danych pracowników tylko dla właściwej roli (przełożony: własny zespół, HR: monitoring).

6. **Elastyczne i otwarte na modyfikacje wynikające ze zmian przepisów**, tak żeby aktualizacja modułów opartych na regulacjach była prosta i nie wymagała przebudowy całego systemu.
   - Logika wynikająca z przepisów żyje wyłącznie w plikach `*.rules.ts` i danych `data/*.data.ts`, np. `src/cases/deadlines.rules.ts`, `src/cases/stages.rules.ts`, `src/cases/formal-check.rules.ts`, `src/assessments/evaluate.rules.ts`, `src/assessments/suggest-level.rules.ts`, `src/competency-model/data/model.data.ts`. Kontrolery i serwisy tylko je wywołują.
   - Każda stała z przepisu (termin, skala, próg, liczba kryteriów) ma jedno miejsce w kodzie i komentarz ze źródłem, np. `// § 7 ust. 2 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470)`.
   - Frontend nie duplikuje stałych prawnych: skale, terminy i progi dostaje z API.
   - Zmiana przepisu = edycja jednego pliku reguł + jego testu. Jeśli wymaga zmian w wielu modułach, najpierw wydziel regułę.
