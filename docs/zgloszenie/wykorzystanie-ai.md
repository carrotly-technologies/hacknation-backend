# Kompas Kompetencji – wykorzystanie AI

AI jest w jednym miejscu: **asystent przełożonego** (`POST /api/assistant/ask`, kod w `src/assistant/`). Wszystko, co
dotyczy samej oceny (terminy, etapy, arkusz, sugerowany poziom, wynik), liczą jawne reguły, nie model językowy.

## Asystent: jak działa

1. **Baza wiedzy.** Wyłącznie dokumenty z `docs/`: ustawa o służbie cywilnej, rozporządzenie o ocenach okresowych
   (2016) i o pierwszej ocenie (2015), poradniki KPRM do obu ocen, standardy zarządzania zasobami ludzkimi (ZZL), wzory
   arkuszy B, C i pierwszej oceny, model kompetencji (każda kompetencja i każdy wskaźnik z 5 poziomami) oraz zestaw
   pytań i odpowiedzi opracowany przez zespół na podstawie tych przepisów. Akty są dzielone na artykuły, paragrafy i
   ustępy, poradniki na strony. Bazę buduje skrypt `npm run kb:build`.
2. **Wyszukiwanie (retrieval).** Lokalny algorytm BM25 (`bm25.ts`), bez zewnętrznej usługi: normalizacja polskich
   znaków, lekki stemming, bigramy i słownik skrótów i synonimów służby cywilnej (IPRZ, OSP, DG, „odwołanie” → sprzeciw,
   „formularz” → arkusz), każdy wpis ze źródłem.
3. **Próg pewności → „nie wiem”.** Gdy najlepszy fragment nie przekracza progu trafności i pokrycia pytania, asystent
   nie woła modelu i odpowiada: „Nie znalazłem tego w bazie wiedzy…” (`grounded: false`), z sugestią kontaktu z kadrami.
4. **Generowanie (opcjonalne).** Najlepsze fragmenty, ponumerowane, trafiają do modelu językowego przez dowolny
   endpoint zgodny z API OpenAI (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`). Używamy wyłącznie darmowych modeli:
   Groq (darmowy plan, np. `llama-3.3-70b-versatile`) albo lokalna Ollama (np. `qwen2.5:7b`). Można podać kilka modeli
   po przecinku; przy limicie zapytań system próbuje kolejnego. Prompt systemowy każe odpowiadać tylko z podanych
   fragmentów, cytować je numerami `[1]`, a przy braku odpowiedzi napisać „Nie znalazłem tego w bazie wiedzy”.
5. **Tryb bez modelu.** Bez skonfigurowanego LLM albo gdy wywołanie się nie uda, asystent odpowiada wyciągowo
   (`mode: "EXTRACTIVE"`): cytaty najtrafniejszych fragmentów ze źródłami. Asystent działa więc zawsze.
6. **Źródła.** Każda odpowiedź ma listę źródeł: tytuł dokumentu, jednostkę redakcyjną, cytat i link do oryginału
   (`/api/docs/…pdf#page=N` otwiera właściwą stronę PDF). Lista dokumentów bazy jest na ekranie „Baza wiedzy”.
7. **Pytania uzupełniające.** Historia rozmowy (ostatnie 3 wymiany) służy tylko do przeformułowania pytania na
   samodzielne. Źródła i cytaty zawsze pochodzą z bazy wiedzy. Historia nie jest zapisywana ani logowana.

## Dwa obszary wsparcia

Jeden asystent obsługuje oba obszary wymagane w zadaniu:

- **Zasady i wymagania formalne**: terminy, arkusze, kryteria, skala, sprzeciw, pierwsza ocena vs okresowa. Prompt
  każe rozróżniać obie ścieżki; pierwszeństwo ma akt prawny przed poradnikiem.
- **Przygotowanie do rozmowy**: w teczce asystent dostaje kontekst sprawy (ścieżka, arkusz, etap, kryteria, oczekiwania
  z części I, obserwacje S-D-R) i proponuje pytania do rozmowy, kwestie do omówienia, strukturę informacji zwrotnej i
  pomysły do IPRZ. Bez modelu językowego działa deterministyczny szablon (`conversation.rules.ts`) z pytaniami
  zbudowanymi ze wskaźników kryteriów i obserwacji.

## Bezpieczeństwo i rola doradcza

- **Asystent nie ocenia konkretnej osoby.** Pytania typu „jaką ocenę mam dać…”, „czy dać mu 7 punktów” są wykrywane
  regułą i dostają odmowę: „Nie mogę rozstrzygnąć, jaką ocenę lub poziom przyznać pracownikowi – to decyzja
  oceniającego…”. Prompt systemowy zabrania proponowania ocen i punktów także przy przygotowaniu rozmowy.
- **Stałe zastrzeżenie** pod każdą odpowiedzią: asystent ma funkcję doradczą, decyzja należy do oceniającego, odpowiedź
  należy zweryfikować w źródłach.
- **Minimalizacja danych wysyłanych do modelu.** Do LLM nie trafiają imiona ani nazwiska. Frontend wysyła tylko
  `caseId` i `stageId`; kontekst sprawy buduje serwer i zawiera stanowisko, kryteria, decyzje i obserwacje. Uprawnienia
  do teczki są sprawdzane jak przy jej odczycie. Przed wdrożeniem produkcyjnym zalecamy model uruchomiony w
  infrastrukturze urzędu (Ollama/vLLM), bo stanowisko z komórką może wskazywać osobę.
- **Pomiar jakości.** `npm run eval:assistant` sprawdza 72 pytania z zestawu Q&A: czy oczekiwane źródło jest w pierwszej
  piątce wyników (hit@5). Ostatni pomiar: 72/72.

## Czego AI nie robi (reguły, nie model)

Jawne, deterministyczne funkcje z testami jednostkowymi:

- terminy etapów z podstawą prawną (`src/cases/deadlines.rules.ts`), etapy i dozwolone przejścia
  (`stages.rules.ts`, `actions.rules.ts`), kontrola formalna przed podpisem (`formal-check.rules.ts`);
- **sugerowany poziom kompetencji** (`src/assessments/suggest-level.rules.ts`): średnia ocenionych wskaźników
  dociągnięta do skali arkusza, „brak podstaw do oceny” pomijany; to pomoc, poziom wybiera przełożony;
- wynik oceny (`evaluate.rules.ts`, § 11 rozp. 2016, § 10 rozp. 2015);
- propozycja arkusza i kryteriów dodatkowych z OSP (`src/osp/osp-analysis.rules.ts`).

## Narzędzia AI

Wyłącznie darmowe: modele językowe przez API zgodne z OpenAI (Groq free tier albo Ollama lokalnie), żadnych
płatnych usług AI. Wyszukiwanie BM25 to własny kod bez zewnętrznych usług. Prototyp pod adresem demo odpowiada w trybie
z modelem językowym (`mode: "LLM"`); bez niego przechodzi na tryb wyciągowy.
