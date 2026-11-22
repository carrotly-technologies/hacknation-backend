# Hosting danych i Standardy Cyberbezpieczeństwa Chmur Obliczeniowych (SCCO)

Ten dokument opisuje, gdzie fizycznie działa i przechowuje dane Kompas Kompetencji, czy jakiekolwiek dane wychodzą
poza UE, do jakiego poziomu wymagań Standardów Cyberbezpieczeństwa Chmur Obliczeniowych (SCCO, standard chmurowy
Ministerstwa Cyfryzacji/KPRM dla administracji) należą dane systemu i jak wdrożyć go produkcyjnie w urzędzie albo
w chmurze krajowej.

Stan na **22 listopada 2026 r.** (gałąź `main`). Fakty sprawdzone w kodzie i w publicznych rejestrach podajemy ze
źródłem. Tego, czego nie dało się sprawdzić bez dostępu do panelu Coolify ani do serwera, nie zgadujemy. Takie
miejsca oznaczamy jako **do potwierdzenia**.

## W skrócie

| Pytanie | Odpowiedź |
| --- | --- |
| Gdzie działa aplikacja? | Jeden serwer z Coolify (Docker). Frontend i API mają ten sam adres IP `77.237.25.140` u dostawcy internetu **TOYA sp. z o.o.** w **Polsce (Łódź)**, według rejestru RIPE NCC i geolokalizacji IP ([szczegóły](#lokalizacja-serwera)). |
| Jakie dane są dziś w produkcji? | Tylko fikcyjne dane demo (`src/cases/seed/`, konta z `src/auth/users.seed.ts`). Prawdziwych danych pracowników nie ma. |
| Czy dane wychodzą poza UE? | **Hosting i baza: nie.** **Asystent AI: tak, jeśli działa z Groq** (wariant opisany w zgłoszeniu). Pytanie, historia czatu, fragmenty przepisów i przy pytaniu o teczkę kontekst sprawy (bez imion i nazwisk) trafiają wtedy do Groq, Inc. w USA. [Plan zmiany](#plan-zmiany-asystent-ai-bez-transferu-poza-ue). |
| Poziom SCCO | **SCCO2: informacje prawnie chronione** (dane osobowe pracowników, oceny okresowe, dane w systemie AI). [Uzasadnienie](#klasyfikacja-danych-wg-scco). |
| Gotowość do SCCO2 | Część wymagań aplikacja spełnia już dziś: TLS 1.3, brak vendor lock-in, minimalizacja danych dla AI, role. Szyfrowanie danych w spoczynku, kopie zapasowe, log audytowy, LLM w UE i formalności urzędu są do zrobienia. [Lista kontrolna](#lista-kontrolna-wymagań-scco2). |

## Obecna infrastruktura

| Element | Gdzie i jak | Źródło |
| --- | --- | --- |
| Frontend (React, nginx) | <https://hacknation.rabbithole.carrotly.tech>, obraz Docker z repo [hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend) | README frontendu, sekcja Deploy |
| API (NestJS, Node 24) | <https://api.hacknation.rabbithole.carrotly.tech>, obraz z [`Dockerfile`](../Dockerfile) | [`README.md`](../README.md#deploy) |
| Orkiestracja | Coolify (projekt **Hackathons**, środowisko `production`), autodeploy z gałęzi `main` | [`README.md`](../README.md#deploy) |
| Baza danych | PostgreSQL, opcjonalna (`DATABASE_URL`). Bez niej dane są w pamięci procesu i znikają po restarcie | [`src/database/`](../src/database/), [`.env.example`](../.env.example) |
| Model językowy | Opcjonalny, dowolne API zgodne z OpenAI (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`). W zgłoszeniu: Groq (darmowy plan) albo lokalna Ollama | [`src/assistant/llm.client.ts`](../src/assistant/llm.client.ts), [`docs/zgloszenie/wykorzystanie-ai.md`](zgloszenie/wykorzystanie-ai.md) |
| DNS | Serwery nazw OVH (`dns104.ovh.net`, `ns104.ovh.net`) dla domeny `carrotly.tech` | `dig +short NS carrotly.tech` |
| Certyfikaty TLS | Let's Encrypt (wystawca `YR2`), TLS 1.3 (`TLS_AES_128_GCM_SHA256`) | `openssl s_client -connect api.hacknation.rabbithole.carrotly.tech:443` |

### Lokalizacja serwera

Sprawdzone 22.11.2026 publicznie dostępnymi narzędziami. Każdy może to powtórzyć:

```bash
dig +short A hacknation.rabbithole.carrotly.tech       # 77.237.25.140
dig +short A api.hacknation.rabbithole.carrotly.tech   # 77.237.25.140
dig +short -x 77.237.25.140                            # staticline59484.toya.net.pl.
whois 77.237.25.140                                    # RIPE NCC: netname TOYA, country PL
curl -s https://ipinfo.io/77.237.25.140/json           # Łódź, PL, AS16342 Toya sp. z o.o.
```

- **Rejestr RIPE NCC (whois):** zakres `77.237.24.0 - 77.237.27.255`, `netname: TOYA`, `descr: Toya Sp. z o.o.`,
  `country: PL`, adres: ul. Łąkowa 29, 90-554 Łódź. Trasę ogłasza `AS16342` (Toya:net, PL).
- **Geolokalizacja IP** ([ipinfo.io](https://ipinfo.io/77.237.25.140), [ip-api.com](http://ip-api.com/json/77.237.25.140)):
  Łódź, województwo łódzkie, Polska.
- **Odwrotny DNS:** `staticline59484.toya.net.pl`. Nazwa wskazuje stały adres IP na łączu dostępowym TOYA, a nie
  publiczną chmurę (AWS, Azure, GCP itp.).
- **Brak pośrednika CDN:** odpowiedzi HTTP przychodzą wprost z serwera (nagłówek `server: nginx` frontendu, brak
  nagłówków Cloudflare ani innego CDN), więc ruch użytkowników kończy się na tym adresie IP.

Wniosek: **serwer jest w Polsce, w sieci TOYA sp. z o.o. (Łódź), czyli w UE.**

Do potwierdzenia (wymaga dostępu do panelu Coolify albo do właściciela maszyny, którego nie mieliśmy przy pisaniu
tego dokumentu):

- dokładne miejsce fizyczne i rodzaj obiektu (serwerownia TOYA, kolokacja czy serwer we własnym biurze podłączony
  łączem TOYA). Geolokalizacja IP wskazuje tylko miasto;
- właściciel i administrator maszyny, szyfrowanie dysku, dostęp fizyczny.

### Baza danych i kopie zapasowe

- Kod: z ustawionym `DATABASE_URL` aplikacja łączy się z PostgreSQL przez `pg`/Drizzle i przy starcie stosuje
  migracje z `drizzle/` (`src/database/database.module.ts`). Dziś w bazie jest dziennik przełożonego (notatki
  i obserwacje o pracowniku, `src/journal/journal.tables.ts`). Teczki ocen i konta są w pamięci procesu (seed demo).
- Repozytorium nie konfiguruje kopii zapasowych. `docker-compose.yml` służy tylko do lokalnego developmentu
  (wolumen `db-data` na maszynie dewelopera).
- Produkcja, do potwierdzenia w panelu Coolify: czy `DATABASE_URL` jest ustawiony (sekcja Deploy w `README.md`
  wymienia tylko `PORT`, `FRONTEND_URL` i `JWT_SECRET`), gdzie działa ta baza (na tym samym serwerze jako zasób
  Coolify czy gdzie indziej) i czy są włączone zaplanowane kopie zapasowe Coolify oraz dokąd trafiają (lokalnie czy
  do magazynu S3, a jeśli S3, to w którym kraju).

### Przepływy danych poza serwer

| Dokąd | Co wychodzi | Poza UE? |
| --- | --- | --- |
| Przeglądarka użytkownika ↔ serwer | Cały ruch aplikacji, szyfrowany TLS 1.3 | Nie (serwer w PL) |
| Model językowy (`LLM_BASE_URL`) | Pytanie, do 3 wcześniejszych wymian czatu, fragmenty bazy wiedzy, a przy pytaniu z `caseId` kontekst teczki: stanowisko i komórka, kryteria, oczekiwania z części I, wstępne punkty oceniającego i obserwacje (sytuacja / działanie / rezultat). **Bez imion i nazwisk** (`src/assistant/conversation.rules.ts`, `caseContext`) | **Tak przy Groq**, nie przy Ollama/vLLM w UE |
| Frontend → zewnętrzne serwisy | Brak: strona ładuje tylko własne pliki (`/assets/*`, `/favicon.svg`), bez Google Fonts, analityki i CDN | Nie |
| Let's Encrypt, OVH DNS | Tylko nazwy domen (wydanie certyfikatu, rozwiązywanie nazw), żadnych danych użytkowników | Nie dotyczy danych |
| GitHub (kod, CI) | Kod źródłowy i fikcyjne dane demo, bez danych produkcyjnych | Nie dotyczy danych |

**Odpowiedź wprost:** dane aplikacji (teczki, dziennik, konta) są przechowywane i przetwarzane w Polsce. **Wyjątkiem
jest asystent AI.** Gdy `LLM_BASE_URL` wskazuje na Groq (`https://api.groq.com/openai/v1`, wariant z
[`.env.example`](../.env.example) i ze zgłoszenia), treść zapytań trafia do Groq, Inc. (USA). Groq podaje, że
„All customer data is retained in Google Cloud Platform (GCP) buckets located in the United States”, a transfer
opiera na standardowych klauzulach umownych (SCC) ([Your Data in GroqCloud](https://console.groq.com/docs/your-data)).
Domyślnie Groq nie zachowuje danych z zapytań, ale może je logować do 30 dni przy diagnostyce i nadużyciach, chyba
że włączono Zero Data Retention. Czy `LLM_*` są dziś ustawione w produkcji: **do potwierdzenia** w panelu Coolify.
Przyjmujemy ostrożnie, że tak.

## Standard: Standardy Cyberbezpieczeństwa Chmur Obliczeniowych (SCCO)

- Dokument: **Standardy Cyberbezpieczeństwa Chmur Obliczeniowych (SCCO) v. 2.00, marzec 2025**, część Narodowych
  Standardów Cyberbezpieczeństwa. Przyjęty 24 kwietnia 2025 r. przez ministra cyfryzacji, ministra obrony narodowej
  i ministra spraw wewnętrznych i administracji (koordynatora ds. służb specjalnych).
  Źródło: [gov.pl: Przyjęto nowe Standardy Cyberbezpieczeństwa Chmur Obliczeniowych](https://www.gov.pl/web/cyfryzacja/przyjeto-nowe-standardy-cyberbezpieczenstwa-chmur-obliczeniowych--najwazniejsze-zmiany),
  treść: [SCCO, załączniki nr 1–3](https://www.gov.pl/attachment/3c86a488-9465-4a1a-b678-b21a37c985ac),
  [załącznik nr 4: macierz zabezpieczeń](https://www.gov.pl/attachment/64cf7737-bc57-4469-a668-a17d46839cc2),
  [załącznik nr 5: katalog zabezpieczeń (na podstawie NIST SP 800-53 rev. 5)](https://www.gov.pl/attachment/11a0919d-bad5-4d3e-be6e-8184d3895c61).
- Podstawa: uchwała nr 97 Rady Ministrów z 11 września 2019 r. w sprawie Inicjatywy „Wspólna Infrastruktura
  Informatyczna Państwa” (WIIP), z późn. zm. ([M.P. 2019 poz. 862](http://monitorpolski.gov.pl/mp/2019/862/1),
  [M.P. 2024 poz. 908](https://monitorpolski.gov.pl/MP/rok/2024/pozycja/908)).
- Odbiorcy: dostawcy usług chmurowych dla administracji i jednostki administracji, które z nich korzystają
  (SCCO, rozdz. 1.1).

Poziomy wymagań bezpieczeństwa (SCCO, rozdz. 3.2):

| Poziom | Informacje | Gdzie wolno przetwarzać (centra przetwarzania danych, CPD) |
| --- | --- | --- |
| SCCO1 | inne niż prawnie chronione (np. publiczne strony) | także poza Polską, rekomendowane EOG |
| **SCCO2** | **prawnie chronione** | **CPD w UE. EOG dopuszczalne, jeżeli respektowane jest prawo UE. Przy wysokiej kategorii poufności i integralności w pierwszej kolejności CPD w RP** |
| SCCO3 | niejawne o klauzuli maks. „zastrzeżone” | w RP albo UE/EOG zależnie od analizy ryzyka, po akredytacji |
| SCCO4 | niejawne powyżej „zastrzeżone” | tylko on-premise / chmura prywatna akredytowana |

## Klasyfikacja danych wg SCCO

**Poziom SCCO2: informacje prawnie chronione.**

Uzasadnienie. SCCO (rozdz. 3.2.2) zalicza do SCCO2 informacje, które w szczególności „zawierają dane osobowe
podlegające ochronie prawnej” oraz „zawierają dane w systemach sztucznej inteligencji”. Kompas Kompetencji
przetwarza oba rodzaje:

- **dane osobowe członków korpusu służby cywilnej**: konto (imię, nazwisko, stanowisko, komórka), profil pracownika,
  teczka oceny, czyli arkusz, kryteria, punkty, obserwacje, notatki przełożonego i historia ocen;
- **oceny okresowe i pierwsze oceny**: oryginał arkusza „włącza się do akt osobowych ocenianego” (§ 6 ust. 3 i § 12
  ust. 2 rozporządzenia PRM z 4.04.2016, [`docs/tekst/ocena-okresowa/`](tekst/ocena-okresowa/)). Ocena wpływa na
  stosunek pracy: dwukrotna, następująca po sobie negatywna ocena okresowa powoduje rozwiązanie stosunku pracy
  z urzędnikiem (art. 71 ust. 1 pkt 1 ustawy o służbie cywilnej), a negatywna pierwsza ocena skutkuje wnioskiem
  o niezawieranie umowy na czas nieokreślony albo o jej rozwiązanie (art. 38 ust. 3 pkt 2,
  [`docs/tekst/akty-prawne/`](tekst/akty-prawne/));
- **dane w systemie AI**: asystent przetwarza pytania przełożonych i kontekst teczki (`src/assistant/`).

Nie SCCO3/SCCO4, bo system nie przetwarza informacji niejawnych w rozumieniu ustawy z 5 sierpnia 2010 r. o ochronie
informacji niejawnych. Nie SCCO1, bo dane nie są publiczne. Szczególne kategorie danych (art. 9 RODO, np. dane
o zdrowiu) nie są celem systemu. Wolny tekst obserwacji i notatek może je jednak przypadkowo zawierać, co trzeba
uwzględnić w analizie ryzyka urzędu.

Proponowana kategoria bezpieczeństwa (SCCO, rozdz. 3.1, wzór FIPS 199):

| Atrybut | Wpływ | Dlaczego |
| --- | --- | --- |
| Poufność | **wysoki** | ujawnienie ocen i obserwacji pracownika narusza dane osobowe z akt osobowych (sankcje z art. 107 ustawy o ochronie danych osobowych, wskazane w SCCO 3.2.2) |
| Integralność | **wysoki** | zmiana punktów lub oceny może prowadzić do rozwiązania stosunku pracy (art. 71 ust. 1 pkt 1 usc) |
| Dostępność | umiarkowany | proces jest okresowy z terminami w dniach (np. 7 dni na sprzeciw, art. 83 ust. 1 usc), a arkusz można sporządzić na papierze |

SC = {(poufność, wysoki), (integralność, wysoki), (dostępność, umiarkowany)}, więc system ma kategorię **wysoką**.
Dla SCCO2 z wysoką poufnością i integralnością SCCO zaleca **w pierwszej kolejności centra danych na terenie RP**.
Ostateczną kategoryzację robi gestor systemu, czyli urząd, na podstawie udokumentowanej analizy ryzyka (SCCO,
rozdz. 3.2 i 4, krok 1). Powyższe to nasza propozycja do tej analizy.

### Wymagania SCCO2 wobec dostawcy chmury (i wobec urzędu)

| Obszar | Wymaganie | Źródło w SCCO |
| --- | --- | --- |
| Lokalizacja | CPD w UE (EOG, jeśli respektowane jest prawo UE, ze szczególnym uwzględnieniem ochrony danych i cyberbezpieczeństwa). Przy wysokiej poufności i integralności najpierw CPD w RP | 3.2.2, tabela poziomów |
| Jurysdykcja | dostawca w jurysdykcji PL albo państwa UE/EOG (art. 26 dyrektywy NIS2 2022/2555), lista fizycznych lokalizacji CPD (co najmniej kraj) | 5.2, SA-9 |
| Zabezpieczenia i certyfikacja | deklaracja zgodności zabezpieczeń bazowych na poziomie umiarkowanym/wysokim wg załącznika 5, ze szczegółowym odniesieniem do macierzy (zał. 4). Po pozytywnej weryfikacji przez Ministerstwo Cyfryzacji oferta trafia do katalogu PChO (ZUCH). SCCO nie wymaga jednego konkretnego certyfikatu. Normy ISO/IEC 27001, 27017, 27018 i 22301 są wymienione w wykazie norm (zał. 1) | 4.2, zał. 1, 4, 5 |
| Dostęp służb i organów państw trzecich | dostawca nie może ujawniać danych organom państw, w których dane są przetwarzane, ani państw sprawujących nad nim jurysdykcję (chyba że wynika to wprost z umowy) i musi niezwłocznie poinformować o prawie, które to uniemożliwia. Udostępnia dane uprawnionym podmiotom odpowiedzialnym za bezpieczeństwo wewnętrzne i porządek publiczny | 5.2.1, AC-23 |
| Własność danych | dane, także logi aplikacji odbiorcy, należą do urzędu. Dostawca nie wykorzystuje ich poza umową | 5.2.1 |
| Szyfrowanie transmisji | TLS 1.3, a gdy niedostępny, TLS 1.2 z Perfect Forward Secrecy, uwierzytelnienie stron (certyfikaty), parametry wg BSI TR-02102 | 5.5.1, 5.5.2 |
| Szyfrowanie w spoczynku | szyfrowanie wrażliwych danych, klucze znane tylko odbiorcy, możliwość kasowania kryptograficznego | 5.5.3–5.5.6 |
| Kopie zapasowe | dostawca umożliwia kopie odtwarzalne przez odbiorcę. Odbiorca odpowiada za własne kopie (CP-9), a liczbę i miejsca kopii ustala analiza ryzyka (CP-2) | 5.6 |
| Wyjście z chmury | technologie umożliwiające łatwą migrację (bez vendor lock-in), warunki zwrotu i usunięcia danych w umowie | 5.3 |
| Nośniki | brak danych na wycofanych nośnikach (MP-6) | 5.4 |
| Incydenty | zgłoszenie do CSIRT GOV/NASK/MON w ciągu 24 h, osoba kontaktowa, SZBI wg § 19 KRI | 6 |

## Lista kontrolna wymagań SCCO2

Statusy: **Spełnione**, **Częściowo**, **Do zrobienia**. Część pozycji dotyczy infrastruktury i organizacji urzędu,
a nie kodu.

| # | Wymaganie | Status | Stan i odniesienie |
| --- | --- | --- | --- |
| 1 | Przetwarzanie w CPD w UE, najpierw w RP | Częściowo | Serwer aplikacji i bazy w PL ([Lokalizacja serwera](#lokalizacja-serwera)). Asystent z Groq przetwarza zapytania w USA ([Plan zmiany](#plan-zmiany-asystent-ai-bez-transferu-poza-ue)) |
| 2 | Dostawca w jurysdykcji PL/UE, lista lokalizacji CPD | Częściowo | TOYA sp. z o.o. to polska spółka (RIPE). Umowa hostingowa i fizyczne miejsce: do potwierdzenia. Groq, Inc.: USA |
| 3 | Kategoryzacja systemu i poziom SCCO (5.1) | Częściowo | Propozycja w tym dokumencie ([Klasyfikacja](#klasyfikacja-danych-wg-scco)). Formalna analiza ryzyka należy do urzędu |
| 4 | Szyfrowanie transmisji TLS 1.3 / 1.2 + PFS | Spełnione | Produkcja negocjuje TLS 1.3 (`TLS_AES_128_GCM_SHA256`), certyfikat Let's Encrypt. Połączenie API ↔ PostgreSQL: TLS włącza się przez `sslmode` w `DATABASE_URL` (do ustawienia, gdy baza nie jest na tym samym hoście) |
| 5 | Szyfrowanie danych w spoczynku, klucze urzędu | Do zrobienia | Aplikacja nie szyfruje kolumn. Szyfrowanie dysku/wolumenu bazy na serwerze: do potwierdzenia. W docelowej chmurze: szyfrowanie wolumenów i backupów kluczem zarządzanym przez urząd (KMS/HSM) |
| 6 | Kopie zapasowe (CP-9, CP-2) | Do zrobienia | Repo nie konfiguruje backupów. Teczki są w pamięci (`docs/zgloszenie/architektura-i-technologie.md`, „Do zabezpieczenia przed wdrożeniem”). Backupy Coolify w produkcji: do potwierdzenia |
| 7 | Brak vendor lock-in, łatwa migracja (5.3) | Spełnione | Jeden obraz Docker na repo, PostgreSQL z migracjami przy starcie, LLM przez dowolne API zgodne z OpenAI, żadnego SDK konkretnej chmury ([`AGENTS.md`](../AGENTS.md), [`Dockerfile`](../Dockerfile)) |
| 8 | Kontrola dostępu (AC) | Częściowo | Role SUPERVISOR/HR/ADMIN sprawdzane na każdym żądaniu, hasła scrypt, JWT 8 h ([`README.md`](../README.md#sign-in-roles-and-permissions)). Do zrobienia: SSO urzędu (AD/OIDC), limit prób logowania |
| 9 | Rozliczalność, log audytowy (AU) | Do zrobienia | Brak logu „kto i kiedy czytał lub zmieniał teczkę” (`docs/zgloszenie/architektura-i-technologie.md`). Dane osobowe nie trafiają do logów aplikacji ([`AGENTS.md`](../AGENTS.md), pkt 5) |
| 10 | Dane w systemie AI: minimalizacja i kontrola | Częściowo | Do LLM nie trafiają imiona ani nazwiska, historia czatu nie jest zapisywana ani logowana (`src/assistant/conversation.rules.ts`, [`docs/zgloszenie/wykorzystanie-ai.md`](zgloszenie/wykorzystanie-ai.md)). Stanowisko z komórką może jednak wskazywać osobę, a model jest poza UE (pozycja 1) |
| 11 | Zakaz ujawniania danych organom państw trzecich (AC-23) | Do zrobienia | Hosting w PL u polskiej spółki. Groq podlega prawu USA. Rozwiązanie: LLM w UE/RP albo w urzędzie |
| 12 | Sekrety i klucze (5.5.4) | Częściowo | `JWT_SECRET` i `LLM_API_KEY` tylko w zmiennych środowiskowych Coolify, nie w repo. Do zrobienia: sejf sekretów i rotacja |
| 13 | Obsługa incydentów (uKSC, rozdz. 6) | Do zrobienia | Obowiązek urzędu: procedura, zgłoszenie do CSIRT w 24 h, SZBI wg § 19 KRI |
| 14 | Nośniki i wycofanie sprzętu (MP-6) | Do zrobienia | Po stronie właściciela serwera lub dostawcy chmury, do potwierdzenia i zapisania w umowie |
| 15 | Dostępność (CP) | Częściowo | Docker `HEALTHCHECK` na `/api/health`, autodeploy. Jedna instancja, brak planu ciągłości działania |
| 16 | Ochrona danych osobowych (RODO) | Częściowo | Minimalizacja pól i brak danych osobowych w logach (`AGENTS.md`, pkt 5). Rejestr czynności przetwarzania i ocena skutków (DPIA) to osobne zadanie dokumentacji RODO (hacknation-backend#68) |

## Plan zmiany: asystent AI bez transferu poza UE

Zmiana nie wymaga zmian w kodzie, bo dostawcę modelu wybiera się zmiennymi środowiskowymi
(`src/assistant/llm.client.ts`).

1. **Od razu, bez kosztów:** usunąć `LLM_BASE_URL` i `LLM_MODEL` w produkcji. Asystent przechodzi wtedy na tryb
   wyciągowy (`mode: "EXTRACTIVE"`): odpowiada cytatami z bazy wiedzy, nadal ze źródłami, i nic nie wychodzi poza
   serwer. Wada: odpowiedzi są mniej płynne, a przygotowanie rozmowy działa na szablonie (`conversationTemplate`).
2. **Jeśli Groq zostaje na czas demo z fikcyjnymi danymi:** włączyć Zero Data Retention w Data Controls konsoli
   Groq ([Your Data in GroqCloud](https://console.groq.com/docs/your-data)) i nie wprowadzać prawdziwych danych.
3. **Docelowo (wdrożenie w urzędzie):** model open source uruchomiony w tym samym CPD co aplikacja (Ollama albo
   vLLM, np. `qwen2.5:7b` z `.env.example`):
   `LLM_BASE_URL=http://<host-modelu>:11434/v1`, `LLM_MODEL=qwen2.5:7b`, bez `LLM_API_KEY`. Alternatywa: usługa
   modeli w regionie chmury w Polsce u dostawcy spełniającego SCCO2, z umową wykluczającą retencję i trenowanie na
   danych.
4. Po zmianie: `npm run eval:assistant` (jakość wyszukiwania nie zależy od modelu) i ręczny test kilku pytań
   z teczką, potem aktualizacja tabeli „Przepływy danych poza serwer”.

## Ścieżka wdrożenia produkcyjnego

Aplikacja to dwa obrazy Docker (frontend i API) i PostgreSQL. Każde środowisko, które uruchamia kontenery
i PostgreSQL, wystarczy. Kolejność od najbezpieczniejszej dla SCCO2 o wysokiej kategorii:

| Wariant | Kiedy | Uwagi |
| --- | --- | --- |
| **A. Serwerownia urzędu (on-premise)** | urząd ma własne CPD i administratora | dane i model AI nie opuszczają urzędu. Spełnia warunek „najpierw CPD w RP”. Działa też bez internetu (tryb bez LLM albo Ollama) |
| **B. Rządowa Chmura Obliczeniowa / katalog PChO (ZUCH)** | jednostka administracji rządowej objęta uchwałą WIIP | usługi zamawia się przez System Zapewniania Usług Chmurowych ZUCH ([chmura.gov.pl](https://chmura.gov.pl)). Oferty PChO mają zweryfikowaną deklarację zgodności z SCCO, a odbiorca dostaje standardową umowę zgodną z SCCO (SCCO, rozdz. 4) |
| **C. Operator Chmury Krajowej (Chmura Krajowa)** | urząd wybiera komercyjną chmurę z regionem w Polsce | [chmurakrajowa.pl](https://chmurakrajowa.pl). Przed wyborem trzeba sprawdzić (do potwierdzenia przy zamówieniu): czy konkretna usługa jest w katalogu PChO/ZUCH albo ma deklarację zgodności z SCCO2, listę krajów CPD (dane i kopie zapasowe w RP), postanowienia umowy o dostępie organów państw trzecich (SCCO 5.2.1) i szyfrowanie kluczem urzędu |

Co zmienić względem obecnego demo (bez zmian w kodzie, tylko konfiguracja):

| Ustawienie | Demo dziś | Produkcja SCCO2 |
| --- | --- | --- |
| Obraz | build w Coolify z `main` | ten sam `Dockerfile`: `docker build -t kompas-api .` i obraz frontendu z `--build-arg VITE_API_URL=https://<api-urzędu>` oraz `--build-arg VITE_DEMO_ACCOUNTS=false`. Obrazy w rejestrze urzędu lub chmury w RP |
| `DATABASE_URL` | do potwierdzenia | PostgreSQL w tym samym CPD/regionie w RP, szyfrowany wolumen, `?sslmode=verify-full` jeśli baza jest na innym hoście. Migracje uruchamiają się same przy starcie |
| Kopie zapasowe | brak w repo | `pg_dump` / backup zarządzany co najmniej raz na dobę, kopie szyfrowane, przechowywane w RP (druga lokalizacja wg analizy ryzyka, CP-2/CP-9), test odtworzenia |
| `JWT_SECRET` | zmienna w Coolify | z sejfu sekretów (`openssl rand -base64 32`), rotacja |
| `FRONTEND_URL` | `https://hacknation.rabbithole.carrotly.tech` | adres frontendu w domenie urzędu (CORS) |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | Groq lub brak (do potwierdzenia) | puste (tryb wyciągowy) albo model w tym samym CPD (Ollama/vLLM) |
| `DEMO_TODAY` | `2026-11-21` | data bieżąca. Dane demo, `POST /api/demo/reset` i konta demo trzeba wyłączyć przed przyjęciem prawdziwych danych (`docs/zgloszenie/architektura-i-technologie.md`) |
| TLS | Let's Encrypt na serwerze | certyfikat urzędu albo Let's Encrypt, TLS 1.2+ z PFS, preferowany 1.3 |

Kroki po stronie urzędu (organizacyjne, poza kodem): analiza ryzyka i kategoryzacja (SCCO, rozdz. 4, krok 1), przy
publicznej chmurze opinia właściwego CSIRT (§ 8 uchwały WIIP), umowa z dostawcą obejmująca punkty z tabeli wymagań
SCCO2, decyzja kierownika jednostki o uruchomieniu systemu (krok 5), procedura incydentów, rejestr czynności
przetwarzania i ocena skutków dla ochrony danych.

## Źródła

- Ministerstwo Cyfryzacji, [Standardy Cyberbezpieczeństwa Chmur Obliczeniowych](https://www.gov.pl/web/cyfryzacja/standardy-cyberbezpieczenstwa-chmur-obliczeniowych)
  oraz [Przyjęto nowe Standardy Cyberbezpieczeństwa Chmur Obliczeniowych – najważniejsze zmiany](https://www.gov.pl/web/cyfryzacja/przyjeto-nowe-standardy-cyberbezpieczenstwa-chmur-obliczeniowych--najwazniejsze-zmiany) (gov.pl).
- SCCO v. 2.00 (marzec 2025): [załączniki 1–3 (treść standardu)](https://www.gov.pl/attachment/3c86a488-9465-4a1a-b678-b21a37c985ac),
  [załącznik 4](https://www.gov.pl/attachment/64cf7737-bc57-4469-a668-a17d46839cc2),
  [załącznik 5](https://www.gov.pl/attachment/11a0919d-bad5-4d3e-be6e-8184d3895c61).
- Uchwała nr 97 Rady Ministrów z 11.09.2019 r. (WIIP): [M.P. 2019 poz. 862](http://monitorpolski.gov.pl/mp/2019/862/1), zmiana [M.P. 2024 poz. 908](https://monitorpolski.gov.pl/MP/rok/2024/pozycja/908).
- RIPE NCC whois dla `77.237.25.140`, [ipinfo.io/77.237.25.140](https://ipinfo.io/77.237.25.140), odwrotny DNS. Sprawdzone 22.11.2026.
- Groq, [Your Data in GroqCloud](https://console.groq.com/docs/your-data) (lokalizacja danych, retencja, ZDR).
- Ustawa o służbie cywilnej i rozporządzenie PRM z 4.04.2016 w sprawie ocen okresowych: [`docs/tekst/`](tekst/).
- Kod: [`src/assistant/llm.client.ts`](../src/assistant/llm.client.ts), [`src/assistant/conversation.rules.ts`](../src/assistant/conversation.rules.ts),
  [`src/database/`](../src/database/), [`src/journal/journal.tables.ts`](../src/journal/journal.tables.ts), [`Dockerfile`](../Dockerfile).
