# OWASP ASVS 4.0.3, poziom 2: checklista Kompasu Kompetencji

Stan aplikacji z tego repozytorium (API) i z [hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend)
(frontend). Dla każdego rozdziału V1–V14: status, krótkie uzasadnienie i miejsce w kodzie. Statusy:

- **spełnione**: wymagania rozdziału istotne dla aplikacji są zaimplementowane i sprawdzane testem;
- **częściowo**: część wymagań spełniona, reszta opisana w kolumnie „Braki” wraz z tym, kto je uzupełnia;
- **n.d.**: rozdział nie dotyczy aplikacji (np. brak funkcji, której dotyczy).

Testy, które sprawdzają tę listę: `test/security.e2e-spec.ts` (nagłówki, limity, sesja, walidacja),
`test/rbac.e2e-spec.ts` (401/403 dla każdej trasy), `test/auth.e2e-spec.ts`, `test/audit.e2e-spec.ts`,
`test/rodo.e2e-spec.ts`. Urząd, który wdraża aplikację, uzupełnia część środowiskową (TLS, kopie zapasowe, sieć)
o swoje ustalenia.

## Podsumowanie

| Rozdział | Status | Najważniejsze |
| --- | --- | --- |
| V1 Architektura | częściowo | moduły Nest per obszar, jedna warstwa uprawnień; brak formalnego modelu zagrożeń |
| V2 Uwierzytelnianie | częściowo | scrypt, jednakowa odpowiedź na zły login i hasło, limit 5 prób/min/IP; brak zmiany hasła i MFA (poza zakresem) |
| V3 Sesja | spełnione | JWT HS256 z wymuszonym `alg`, `exp` ≤ 8 h, unieważnianie przy wylogowaniu i zmianie roli |
| V4 Kontrola dostępu | spełnione | globalny guard, odmowa domyślna, role + polityki rekordów, macierz 401/403 w e2e |
| V5 Walidacja | spełnione | ścisłe schematy zod na każde body i query, walidowane identyfikatory w ścieżce, limit rozmiaru body |
| V6 Kryptografia danych | spełnione | AES-256-GCM dla tekstów w bazie, scrypt dla haseł, losowe tokeny `crypto.randomBytes` |
| V7 Błędy i logi | częściowo | dziennik zdarzeń (hash chain), komunikaty bez szczegółów technicznych, bez danych osobowych w logach |
| V8 Ochrona danych | spełnione | `Cache-Control: no-store`, minimalizacja pól, token w `sessionStorage`, retencja |
| V9 Komunikacja | częściowo | HSTS z API i frontendu; TLS kończy reverse proxy urzędu |
| V10 Złośliwy kod | spełnione | zależności z npm na licencjach permisywnych, `package-lock.json`, SBOM CycloneDX, skan Trivy i Dependabot w CI |
| V11 Logika biznesowa | spełnione | reguły z przepisów w `*.rules.ts`, limity żądań, kroki procedury w kolejności |
| V12 Pliki i zasoby | spełnione | brak wgrywania plików; pliki źródłowe tylko z `docs/` z ochroną przed path traversal |
| V13 API | spełnione | REST + JSON, CORS tylko `FRONTEND_URL`, `Content-Type` JSON, dokumentacja OpenAPI |
| V14 Konfiguracja | spełnione | nagłówki bezpieczeństwa (helmet w API, nginx we frontendzie z CSP bez `unsafe-inline`), konfiguracja przez env |

## V1 Architektura, projekt i modelowanie zagrożeń: częściowo

- Małe, niezależne moduły Nest (`src/<obszar>/`); uwierzytelnianie i uprawnienia w jednym miejscu
  (`src/auth/`, globalne guardy z `@nestjs/authentication` i `@nestjs/authorization`, kolejność w `src/app.module.ts`).
- Kontrola dostępu po stronie serwera, nigdy w przeglądarce (V1.4.1): frontend tylko ukrywa przyciski.
- Reguły wynikające z przepisów w plikach `*.rules.ts`, wywoływane przez serwisy (V1.1.x, łatwa aktualizacja).
- Zależności: tylko otwarte paczki na licencjach MIT/Apache/BSD/ISC (`AGENTS.md`).
- **Braki:** brak spisanego modelu zagrożeń (V1.1.2); dokumenty RODO (`docs/rodo/dpia.md`) opisują ryzyka
  dla danych, nie dla ataków.

## V2 Uwierzytelnianie: częściowo

- Hasła jako skróty scrypt (`PasswordHasher` z `@nestjs/authentication`, `src/auth/credentials.service.ts`),
  porównanie w stałym czasie także dla nieistniejącego loginu (V2.4.1, V2.2.x).
- Zły login i złe hasło dają tę samą odpowiedź 401 „Nieprawidłowy login lub hasło.” (V2.2.1 bez enumeracji kont).
- Ochrona przed zgadywaniem (V2.2.1): `POST /api/auth/login` przyjmuje `RATE_LIMIT_LOGIN_PER_MINUTE` (domyślnie 5)
  prób na minutę z jednego IP, potem 429 „Zbyt wiele prób logowania. Spróbuj ponownie za minutę.” z nagłówkiem
  `Retry-After` (`src/security/rate-limit.module.ts`, `src/auth/auth.controller.ts`). Ten sam limit mają oba kroki
  symulowanego logowania przez login.gov.pl, które przyjmują sekret (`POST /api/auth/login-gov/mock-authorize`,
  `POST /api/auth/login-gov`, `src/auth/login-gov.controller.ts`). Każda próba (udana i nieudana) trafia do dziennika
  zdarzeń (`LOGIN`, `LOGIN_FAILED`, `LOGIN_GOV`, `LOGIN_GOV_FAILED`, `src/audit/`).
- **Braki:** konta są demonstracyjne (`src/auth/users.seed.ts`) i nie ma zmiany ani resetu hasła, więc wymagania
  V2.1 (polityka haseł, sprawdzanie haseł wyciekniętych) i V2.5 (odzyskiwanie) czekają na prawdziwe konta; docelowo
  logowanie przez SSO urzędu (OIDC, `@nestjs/authentication`). MFA (V2.7, V2.8) poza zakresem tego etapu.

## V3 Zarządzanie sesją: spełnione

- Token Bearer JWT podpisany HS256 kluczem `JWT_SECRET` (32+ bajty; bez niego ostrzeżenie w logu,
  `src/auth/jwt-secret.ts`). Weryfikacja przyjmuje tylko HS256: `alg: none`, HS512 i każdy inny algorytm dają 401
  (V3.5.3; test „refuses alg none” w `test/security.e2e-spec.ts`).
- `exp` sprawdzane przy każdym żądaniu, czas życia 8 h (V3.3.2; `src/auth/auth.module.ts`).
- Wylogowanie unieważnia token po stronie serwera (V3.3.1): `POST /api/auth/logout` zapisuje `jti` tokenu na liście
  odwołanych do jego wygaśnięcia (`src/auth/revoked-tokens.service.ts`, `src/auth/jwt.auth.ts`); frontend usuwa
  token z `sessionStorage` (`src/lib/auth.tsx`). Inne sesje tego samego konta działają dalej (wspólne konta demo).
- Zmiana roli przez administratora kończy wszystkie sesje tego użytkownika (V3.3.3 w duchu „zmiana uprawnień =
  nowa sesja”): `tokenVersion` na koncie, claim `tv` w tokenie (`src/auth/users.in-memory.repository.ts`).
- Rola nigdy nie jest brana z tokenu: konto jest wczytywane przy każdym żądaniu.
- Token w `sessionStorage`, nie w ciasteczku: nie ma CSRF (V3.4 n.d., V4.2.2), token kończy się z kartą.
  Ryzyko: skrypt wstrzyknięty przez XSS mógłby go odczytać. Mitygacja: CSP frontendu bez `unsafe-inline`
  i tylko `'self'` dla skryptów (V14.4.3), React escapuje treść, brak `dangerouslySetInnerHTML` na danych z API,
  krótki czas życia tokenu i unieważnienie przy wylogowaniu.
- **Uwaga wdrożeniowa:** lista odwołanych tokenów i konta są w pamięci procesu. Przy kilku instancjach API trzeba je
  przenieść do bazy razem (to samo miejsce, w którym zamienia się `UsersRepository`).

## V4 Kontrola dostępu: spełnione

- Odmowa domyślna (V4.1.3, V4.1.5): każda trasa wymaga tokenu, chyba że ma `@Public()`; trasa bez `@Can`/`@Roles`
  daje 403 (`@nestjs/authorization`). Publiczne: health, config, logowanie/wylogowanie, pliki `/api/docs/<plik>`,
  link ocenianego `/api/ack/:token` (nie do zgadnięcia: 32 losowe bajty, ważny 14 dni, `src/cases/ack-link.rules.ts`),
  symulacja login.gov.pl, zapis odsłony strony (`POST /api/telemetry/pageview`), Swagger UI. Monitor aktywności
  `/api/monitor/*` chroni osobny sekret `X-Monitor-Token` (bez niego 404, `src/monitor/monitor-token.guard.ts`).
- Role (`@Roles`, `src/auth/roles.decorator.ts`) i polityki rekordów (`src/auth/case.policy.ts`): przełożony widzi
  tylko swoje sprawy i swój zespół, kadry czytają wszystko bez edycji, administrator zarządza kontami i dziennikiem
  (V4.2.1, tabela ról w `README.md`).
- `test/rbac.e2e-spec.ts` sprawdza dla **każdej** trasy: 401 bez tokenu i z tokenem nieprawidłowym, 403 dla każdej
  roli spoza tabeli, brak 401/403 dla ról uprawnionych. Test wylicza trasy z routera aplikacji i nie przechodzi,
  gdy pojawi się trasa bez wiersza w tabeli.
- Odmowy 403 trafiają do dziennika zdarzeń (`src/audit/audit.middleware.ts`).

## V5 Walidacja, sanityzacja i kodowanie: spełnione

- Każde `@Body` i `@Query` przechodzi przez schemat zod (`src/**/*.schemas.ts`, `StandardSchemaValidationPipe`
  w `src/configure-app.ts`). Schematy są ścisłe (`z.strictObject`): nieznane pola dają 400 „Nierozpoznane klucze”
  (V5.1.2, ochrona przed mass assignment), także w obiektach zagnieżdżonych.
- Każdy parametr ścieżki `:id`, `:personId`, `:token` musi pasować do `[A-Za-z0-9_-]{1,128}`
  (`src/security/params.schemas.ts`), inaczej 400 „Nieprawidłowy identyfikator w adresie.” (V5.1.3).
  Ścieżka pliku w `/api/docs/<plik>` jest sprawdzana przez `resolveDocFile` (`src/docs/docs-files.ts`).
- Limit rozmiaru body `BODY_LIMIT` (domyślnie 1 MB): większe żądanie dostaje 413 po polsku
  (`src/security/body-errors.filter.ts`); zepsuty JSON dostaje 400 po polsku.
- Kodowanie wyjścia (V5.3): API zwraca JSON; frontend renderuje przez React (escapowanie), pliki PDF/DOCX budowane
  bibliotekami z danych, bez szablonów HTML. Zapytania do bazy tylko przez Drizzle (parametryzowane, V5.3.4).
- Do modelu językowego trafia tylko pytanie i fragmenty bazy wiedzy, bez identyfikatorów pracownika
  (`src/assistant/`).

## V6 Kryptografia danych przechowywanych: spełnione

- Teksty w PostgreSQL (notatki, obserwacje) szyfrowane AES-256-GCM kluczem `DATA_ENCRYPTION_KEY`
  (`src/crypto/field-cipher.ts`, `docs/rodo/`).
- Hasła: scrypt (V6.2.x przez `@nestjs/authentication`). Losowość: `crypto.randomBytes` / `randomUUID` (V6.3.1).
- Klucze z env, nie z repozytorium; bez nich ostrzeżenie w logu i klucz deweloperski (tylko do demo).

## V7 Obsługa błędów i logowanie: częściowo

- Dziennik zdarzeń „kto, co, kiedy” (V7.1.3, V7.2.x): append-only, łańcuch skrótów, w PostgreSQL trigger blokuje
  UPDATE/DELETE (`src/audit/`). Zapisuje logowania, wylogowania, zmiany danych i odmowy dostępu, z IP klienta
  (`TRUST_PROXY`), bez treści pól.
- Bez danych osobowych i sekretów w logach aplikacji (V7.1.1, V7.1.2): logi to start, baza, błędy LLM.
- Komunikaty błędów po polsku, bez stosów i szczegółów technicznych (V7.4.1); nieznany błąd to ogólne 500.
- **Braki:** logi aplikacji to tekst na stdout, bez formatu JSON i korelacji żądań (V7.1.4); zbiera je platforma.

## V8 Ochrona danych: spełnione

- `Cache-Control: no-store` na każdej odpowiedzi API z danymi (V8.2.1, `src/configure-app.ts`); wyjątek: publiczne
  pliki źródłowe `/api/docs/<plik>`.
- Minimalizacja (V8.3.x): API zwraca tylko pola potrzebne odbiorcy, link ocenianego zwraca dokładnie zawartość
  arkusza (`test/rodo.e2e-spec.ts`); retencja i anonimizacja po `RETENTION_YEARS` (`docs/rodo/retencja.md`).
- Przeglądarka (V8.2.2): token tylko w `sessionStorage` (`kompas.token`), w `localStorage` wyłącznie preferencje
  wyglądu (`kompas.prefs`); wylogowanie czyści token. Bez narzędzi analitycznych.

## V9 Komunikacja: częściowo

- API i frontend wysyłają `Strict-Transport-Security` (V9.1.1); działa, gdy urząd udostępnia aplikację przez HTTPS.
- **Braki / środowisko:** TLS kończy reverse proxy urzędu (w demo Coolify z certyfikatem Let's Encrypt); kontener
  mówi HTTP w sieci wewnętrznej. Konfiguracja szyfrów TLS (V9.1.2, V9.1.3) należy do proxy.
  Połączenie z PostgreSQL i z LLM: `DATABASE_URL` z `sslmode=require` i endpoint `https://` według środowiska.

## V10 Złośliwy kod: spełnione

- Tylko zależności z rejestru npm, przypięte w `package-lock.json`; obraz budowany `npm ci` (V10.3.2).
- SBOM (CycloneDX), skan podatności Trivy i Dependabot w CI (`.github/workflows/security.yml`,
  `.github/dependabot.yml`); opis i proces obsługi podatności: [`cra-nis2.md`](cra-nis2.md),
  [`podatnosci.md`](podatnosci.md).
- Bez zdalnego ładowania kodu w przeglądarce: CSP `script-src 'self'`, fonty i ikony w paczce (V10.3.1).

## V11 Logika biznesowa: spełnione

- Kroki procedury oceny w kolejności z przepisów, akcje dozwolone tylko w danym etapie
  (`src/cases/actions.rules.ts`, `src/cases/stages.rules.ts`): 409 z wyjaśnieniem przy próbie pominięcia kroku
  (V11.1.1, V11.1.2).
- Limity żądań (V11.1.4): `RATE_LIMIT_PER_MINUTE` (domyślnie 100) na trasę i klienta (zalogowane konto, inaczej IP),
  `RATE_LIMIT_LOGIN_PER_MINUTE` (domyślnie 5) na logowanie i potwierdzenia przez link ocenianego, na IP.
  Za proxy IP pochodzi z `X-Forwarded-For`, ale tylko od proxy w sieci prywatnej (`TRUST_PROXY`).
- **Uwaga wdrożeniowa:** liczniki są w pamięci procesu (`@nestjs/throttler`). Przy kilku instancjach każda liczy
  osobno (limit efektywnie × liczba instancji); docelowo wspólny magazyn (np. Redis) dla throttlera.
- AI tylko doradza: sugestia poziomu (`src/assessments/suggest-level.rules.ts`) nigdy nie zapisuje oceny.

## V12 Pliki i zasoby: spełnione

- Aplikacja nie przyjmuje plików od użytkowników (V12.1–V12.2 n.d.).
- Pliki źródłowe tylko z katalogu `docs/`: odrzucane ścieżki bezwzględne, `..`, ukryte segmenty, bajty NUL
  i dowiązania poza katalog (V12.3.1, `src/docs/docs-files.ts`, `src/docs/docs-files.spec.ts`).
- Pliki do pobrania (PDF/DOCX arkusza) generowane w pamięci z `Content-Disposition` i właściwym typem (V12.5.x).
- Brak żądań do adresów podanych przez użytkownika (V12.6.1, SSRF): jedyny adres zewnętrzny to `LLM_BASE_URL` z env.

## V13 API i usługi sieciowe: spełnione

- REST + JSON; każda odpowiedź z `Content-Type: application/json` i `X-Content-Type-Options: nosniff` (V13.1.x).
- CORS tylko dla `FRONTEND_URL` (V13.2.x / V14.5.3; test „allows CORS for FRONTEND_URL only”).
- Metody HTTP zgodne z działaniem; wejście walidowane schematami (V13.2.2), dokumentacja OpenAPI pod `/api/swagger`.
- Uwierzytelnianie nagłówkiem `Authorization`, nie ciasteczkiem, więc bez CSRF (V13.2.3).

## V14 Konfiguracja: spełnione

- Nagłówki API (`helmet`, `src/configure-app.ts`; V14.4): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, HSTS, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy: cross-origin` (pliki źródłowe otwiera frontend z innego originu), bez `X-Powered-By`.
  API nie wysyła CSP: zwraca JSON i pliki, nie strony; Swagger UI działa bez dodatkowej konfiguracji.
- Nagłówki frontendu (`nginx.conf` w hacknation-frontend): `Content-Security-Policy` z `script-src 'self'` i
  `style-src 'self'` bez `unsafe-inline` (skrypt preferencji wyglądu w pliku `public/preferences-init.js`),
  `connect-src 'self' <adres API>` (z `VITE_API_URL`, zmienna `CSP_CONNECT_SRC`), `frame-ancestors 'none'`,
  `object-src 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (kamera, mikrofon, geolokalizacja wyłączone), `X-Frame-Options: DENY`, HSTS.
- Cała konfiguracja przez zmienne środowiskowe z rozsądnymi domyślnymi (`.env.example`, tabela w `README.md`);
  błędna wartość limitu zatrzymuje start z komunikatem po polsku (`src/security/security.config.ts`).
- Jeden obraz Docker na repo, uruchamiany jako użytkownik `node` (V14.1.x); `NODE_ENV=production` w obrazie.
- **Uwaga wdrożeniowa:** w produkcji ustaw `JWT_SECRET` i `DATA_ENCRYPTION_KEY`; bez nich aplikacja działa
  na kluczach deweloperskich i ostrzega w logu.
