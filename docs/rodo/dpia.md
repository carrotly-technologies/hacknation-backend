# Ocena skutków dla ochrony danych (DPIA): Kompas Kompetencji

Krótka ocena skutków w rozumieniu art. 35 RODO dla aplikacji wspierającej pierwszą ocenę i oceny okresowe w służbie
cywilnej. Ocena pracownicza to ocena aspektów osobowych pracownika (wydajność, zachowanie, rozwój), czyli przetwarzanie
spełniające kryteria z wykazu Prezesa UODO operacji wymagających DPIA (ocena lub punktacja; osoby w relacji zależności,
czyli pracownicy). Dokument opisuje aplikację w stanie z
tego repozytorium; urząd uzupełnia go o swoje środowisko (hosting, kopie zapasowe, procedury) przed wdrożeniem.

## 1. Opis przetwarzania

- **Co:** dane ocenianego (imię, nazwisko, stanowisko, komórka, status, data zatrudnienia), treść oceny (oceny
  cząstkowe, wynik, uzasadnienie, IPRZ, wniosek o stopień służbowy), notatki i obserwacje przełożonego, sprzeciw
  ocenianego, konta użytkowników. Pełna lista: [rejestr-przetwarzania.md](rejestr-przetwarzania.md).
- **Kto:** przełożony prowadzi ocenę swojego zespołu, kadry monitorują terminy i czytają sprawy, administrator
  zarządza kontami, oceniany otwiera swój arkusz przez jednorazowy link bez logowania.
- **Jak:** przeglądarka → frontend (nginx) → API NestJS → PostgreSQL (opcjonalnie; bez bazy dane są w pamięci procesu).
  Reguły z przepisów są w plikach `*.rules.ts`. Asystent AI odpowiada z lokalnej bazy wiedzy (BM25), a opcjonalny model
  językowy tylko redaguje odpowiedź.
- **Cykl życia:** sprawa oceny trwa od rozmowy otwierającej do upływu terminu sprzeciwu (7 dni od zapoznania,
  art. 83 ust. 1 ustawy). Oryginał arkusza trafia do akt osobowych (§ 12 ust. 2 rozp. 2016, § 11 ust. 2 rozp. 2015),
  aplikacja trzyma kopię roboczą przez `RETENTION_YEARS` (10 lat), potem ją anonimizuje: [retencja.md](retencja.md).

## 2. Niezbędność i proporcjonalność

- **Podstawa:** art. 6 ust. 1 lit. c RODO w zw. z art. 38 i 81–84 ustawy o służbie cywilnej oraz rozporządzeniami PRM
  z 2015 i 2016 r. Ocena jest obowiązkowa, aplikacja nie dodaje celów przetwarzania.
- **Minimalizacja:** przetwarzamy tylko pola z wzorów arkuszy i z procedury oceny. Bez PESEL, adresu, danych
  kontaktowych ocenianego i danych szczególnych kategorii. Każdy widok API zwraca tylko pola potrzebne odbiorcy:
  - link dla ocenianego (`GET /api/ack/:token`) zwraca dokładnie to, co drukuje arkusz: bez identyfikatorów,
    obserwacji, ocen wskaźników, OSP, historii i notatek (lista pól sprawdzana w `test/rodo.e2e-spec.ts`);
  - listy spraw, zespół i przegląd kadr zawierają tylko podsumowanie (osoba, etap, terminy, status), bez treści oceny;
  - widok sprawy nie zawiera tokenu linku (tylko link dla oceniającego, do czasu zapoznania), identyfikatora
    oceniającego ani danych wewnętrznych;
  - lista kont nie zawiera skrótów haseł; notatki i obserwacje z dziennika widzi tylko ich autor;
  - do modelu językowego trafia stanowisko i treść sprawy bez imienia i nazwiska (`caseContext` w
    `src/assistant/conversation.rules.ts`); historia czatu nie jest zapisywana ani logowana.
- **Ograniczenie przechowywania:** automatyczna anonimizacja po 10 latach (art. 5 ust. 1 lit. e RODO).
- **Decyzja człowieka:** AI tylko podpowiada (sugestia poziomu, asystent), ocenę zatwierdza i podpisuje przełożony
  (art. 22 RODO nie ma zastosowania: brak decyzji opartej wyłącznie na zautomatyzowanym przetwarzaniu).
- **Prawa osób:** dostęp i kopia: oceniany dostaje arkusz (link, kopia papierowa z akt); sprostowanie: sprzeciw
  (art. 83) i korekta przez przełożonego przed podpisem; usunięcie: retencja. Panel realizacji praw w aplikacji nie
  jest wdrożony: wnioski obsługuje IOD urzędu (poza zakresem tej wersji).

## 3. Ryzyka

| # | Ryzyko | Skutek dla osoby | Prawdopodobieństwo przed środkami | Waga |
|---|---|---|---|---|
| R1 | Nieuprawniony dostęp do ocen i notatek (inny przełożony, kadry poza zakresem, osoba z zewnątrz) | ujawnienie oceny i opinii przełożonego, dyskryminacja, utrata zaufania | średnie | wysoka |
| R2 | Wyciek linku dla ocenianego (przesłany dalej, przechwycony, zgadnięty) | osoba trzecia czyta arkusz albo potwierdza zapoznanie / wnosi sprzeciw w imieniu ocenianego | średnie | wysoka |
| R3 | Błędy AI: halucynacja przepisu, stronnicza sugestia poziomu, przejęcie oceny przez AI | błędna lub niesprawiedliwa ocena, naruszenie procedury | średnie | średnia |
| R4 | Wyciek bazy danych lub kopii zapasowej | ujawnienie treści ocen i notatek wszystkich pracowników | niskie | wysoka |
| R5 | Podsłuch transmisji | ujawnienie danych i tokenów logowania | niskie | wysoka |
| R6 | Przechowywanie dłużej niż potrzeba | ryzyko R1/R4 rośnie z czasem, naruszenie art. 5 ust. 1 lit. e | wysokie bez retencji | średnia |
| R7 | Dane osobowe w logach lub u dostawcy LLM | ujawnienie poza kontrolą administratora | średnie | średnia |

## 4. Środki zaradcze i ryzyko rezydualne

| Ryzyko | Środki w aplikacji | Środki po stronie urzędu | Ryzyko rezydualne |
|---|---|---|---|
| R1 | Logowanie (JWT HS256, 8 h), rola czytana z konta przy każdym żądaniu; przełożony widzi tylko swój zespół, kadry tylko odczyt, administrator bez dostępu do spraw; dziennik tylko dla autora (`src/auth/case.policy.ts`, testy e2e) | nadawanie ról przez administratora, przegląd kont, silny `JWT_SECRET` | niskie |
| R2 | Token 32 bajty z `crypto.randomBytes`, porównanie stałoczasowe, ważny 14 dni, ponowne wysłanie unieważnia poprzedni, po zapoznaniu link nie pokazuje już arkusza; odpowiedź zawiera tylko dane z arkusza (minimalizacja); TLS + HSTS | przekazywanie linku kanałem służbowym (poczta urzędu) | niskie |
| R3 | Asystent odpowiada tylko z bazy wiedzy z cytatem źródła, przy braku podstaw mówi „Nie znalazłem”; sugestia poziomu to tylko propozycja; zatwierdzenie i podpis wyłącznie przez przełożonego; kontrola formalna przed podpisem | szkolenie przełożonych: AI jest doradcze | niskie |
| R4 | Szyfrowanie po stronie aplikacji AES-256-GCM pól wolnego tekstu (notatki, obserwacje S-D-R) kluczem `DATA_ENCRYPTION_KEY` spoza bazy: zrzut bazy lub kopia zapasowa nie ujawnia ich treści; hasła jako scrypt | szyfrowanie dysku i kopii zapasowych (poza zakresem aplikacji), klucz w menedżerze sekretów, dostęp do bazy tylko z sieci aplikacji | niskie |
| R5 | HSTS (`max-age=31536000; includeSubDomains`) w nginx frontendu; API tylko za proxy | TLS 1.2+ na proxy (rozdz. 5) | niskie |
| R6 | Retencja: anonimizacja spraw i usuwanie wpisów dziennika po `RETENTION_YEARS`, przy starcie, co 24 h i `npm run retention` | ustalenie okresu z IOD, kontrola wyniku w logu | niskie |
| R7 | Logi zawierają tylko liczby i komunikaty techniczne (retencja, migracje), nigdy treść wpisów ani nazwiska; do LLM bez imienia i nazwiska; LLM opcjonalny, może działać lokalnie (Ollama) | wybór dostawcy LLM z UE/EOG i umowa powierzenia albo model lokalny | niskie |

Ryzyko rezydualne jest niskie, więc konsultacja z Prezesem UODO (art. 36 RODO) nie jest wymagana. Ocenę należy powtórzyć
przy zmianie zakresu danych, dodaniu integracji (EZD, system kadrowy) albo zewnętrznego modelu językowego.

## 5. Szyfrowanie

**W transmisji.** TLS terminuje reverse proxy (w produkcji: proxy Coolify z certyfikatami Let's Encrypt; aplikacja nie zmienia
infrastruktury). Wymagane
TLS 1.2 lub 1.3 z szyframi AEAD (ECDHE + AES-GCM / ChaCha20-Poly1305), bez TLS 1.0/1.1, SSL i szyfrów RC4/3DES;
przekierowanie HTTP → HTTPS. Frontend wysyła `Strict-Transport-Security: max-age=31536000; includeSubDomains`
(`nginx.conf` w hacknation-frontend), więc przeglądarka nie łączy się już przez HTTP. Urząd, który hostuje u siebie,
ustawia to samo na swoim proxy (np. nginx: `ssl_protocols TLSv1.2 TLSv1.3;`). Połączenie API z PostgreSQL w tej samej
sieci prywatnej; przy bazie w innej sieci `DATABASE_URL` z `sslmode=require`.

**W spoczynku.** Pola wolnego tekstu o ocenianym zapisywane w PostgreSQL są szyfrowane w aplikacji
(`src/crypto/field-cipher.ts`): AES-256-GCM, losowy 12-bajtowy IV dla każdej wartości, znacznik uwierzytelniający
wykrywa zmianę treści. Format `v1:<iv>:<tag>:<szyfrogram>` (base64), gdzie `v1` to wersja klucza, więc klucz da się
wymienić bez utraty danych. Klucz: `DATA_ENCRYPTION_KEY` (32 bajty base64, `openssl rand -base64 32`), trzymany
poza bazą (zmienna środowiskowa w Coolify / menedżer sekretów). Bez klucza aplikacja używa publicznego klucza
deweloperskiego i ostrzega w logu (tylko do dev i demo). Szyfrowane pola: treść notatki (`journal_notes.text`)
oraz sytuacja, działanie i rezultat obserwacji (`journal_observations.situation/action/result`). Przy starcie migracja
danych szyfruje wiersze zapisane jawnie (lub kluczem deweloperskim) i jest idempotentna.

Sprawy ocen (uzasadnienie, IPRZ, obserwacje w sprawie) są w tej wersji przechowywane tylko w pamięci procesu (demo:
seed przy starcie), nie w bazie, więc nie istnieją „w spoczynku” na dysku. Gdy sprawy trafią do PostgreSQL, te pola
idą przez ten sam `FieldCipher`. Szyfrowanie dysku i kopii zapasowych należy do infrastruktury urzędu.
