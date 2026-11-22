# Teksty do formularza HackTribe

Gotowe do wklejenia. Pełne opisy: [opis-projektu.md](opis-projektu.md), [wykorzystanie-ai.md](wykorzystanie-ai.md),
[architektura-i-technologie.md](architektura-i-technologie.md).

## Nazwa projektu

Kompas Kompetencji – asystent przełożonego w ocenie pracowników służby cywilnej

## Problem

Przełożony w służbie cywilnej prowadzi ocenę rzadko: raz na 24 miesiące (ocena okresowa) albo raz przy nowym
pracowniku (pierwsza ocena). Zasady są rozproszone w ustawie, dwóch rozporządzeniach, poradnikach KPRM i modelu
kompetencji, więc łatwo pomylić arkusz, kryteria lub termin, a ocenę kompetencji trudno rzetelnie uzasadnić. Kadry nie
widzą na bieżąco, na jakim etapie są oceny w urzędzie.

## Rozwiązanie

Aplikacja webowa zbudowana wokół teczki oceny. Prowadzi przełożonego krok po kroku przez pierwszą ocenę albo ocenę
okresową, liczy terminy z podstawą prawną, dobiera arkusz i kryteria na podstawie opisu stanowiska i pilnuje kontroli
formalnej przed podpisem. Kompetencje ocenia się na modelu kompetencji (14 kompetencji, 49 wskaźników behawioralnych,
5 poziomów): przełożony wybiera zachowanie najbliższe temu, co obserwował, system pokazuje sugerowany poziom, a
ostateczny poziom zawsze wybiera przełożony. Asystent AI odpowiada na pytania o przepisy wyłącznie z bazy wiedzy
(ustawa, rozporządzenia, poradniki KPRM, model kompetencji, Q&A), zawsze ze źródłem i linkiem do strony dokumentu, mówi
„nie znalazłem tego w bazie wiedzy”, gdy nie wie, i pomaga przygotować rozmowę z pracownikiem, nie proponując ocen.
HR monitoruje statusy i terminy w całym urzędzie i wysyła przypomnienia.

## Co zostało zrobione

- Działający prototyp: <https://hacknation.rabbithole.carrotly.tech>
- Obie ścieżki procesu z etapami, terminami (reguły KC, święta) i podstawą prawną każdego kroku.
- Analiza 3 prawdziwych OSP → propozycja arkusza B/C i kryteriów dodatkowych.
- Ocena wskaźników behawioralnych, sugerowany poziom, osobna decyzja przełożonego z uzasadnieniem odchylenia, wynik
  oceny według rozporządzeń.
- Etap rozmowy oceniającej z zagadnieniami z § 10 i przygotowaniem pytań przez asystenta.
- Asystent AI: BM25 nad bazą wiedzy + darmowy model językowy (API zgodne z OpenAI), cytaty ze stron PDF, odmowa
  oceniania konkretnej osoby, tryb bez modelu; ewaluacja 72 pytań (hit@5 72/72).
- Arkusz okresowy do pobrania jako PDF i DOCX; link dla ocenianego (zapoznanie bez konta, sprzeciw w 7 dni).
- Panel HR (monitoring, przypomnienia), panel administratora (role), logowanie z rolami sprawdzanymi po stronie
  serwera, dziennik obserwacji przełożonego.
- Architektura: React + NestJS, reguły jako czyste funkcje z testami (ok. 300 testów), Docker, autodeploy;
  przygotowanie pod integrację z QNT (źródło osób i stanowisk) i EZD (odbiorca dokumentów).

## Instrukcja dla jurorów

1. Otwórz <https://hacknation.rabbithole.carrotly.tech>. Pod formularzem logowania są karty kont demo: kliknij kartę,
   żeby się zalogować. Hasło każdego konta: `Kompas2026!`. Wszystkie dane są fikcyjne, „dziś” w demo to 21.11.2026.
   - `k.wisniewska` – przełożona (6 teczek), zalecane na start
   - `a.cieslak-dyjecinska` – HR (monitoring całego urzędu)
   - `admin` – administrator (konta i role)
   - `a.szymanczak`, `j.kuchta` – inni przełożeni (każdy widzi tylko swoje teczki)
2. Zalecana ścieżka jako `k.wisniewska`:
   - „Mój zespół” → Piotr Wójcik, teczka **c-002**: początek oceny okresowej (analiza opisu stanowiska → arkusz →
     kryteria → część I);
   - teczka **c-001** (Formularz oceny kompetencji): oceń wskaźniki, zobacz sugerowany poziom, podejmij decyzję;
   - przycisk „Asystent AI” (prawy dolny róg): zapytaj np. „Ile dni ma oceniany na wniesienie sprzeciwu?”;
   - teczka **c-006**: pobierz arkusz PDF / DOCX;
   - teczka **c-004**: pierwsza ocena.
3. Zaloguj się jako `a.cieslak-dyjecinska`, żeby zobaczyć panel HR i przypomnienia.
4. Przycisk „Przywróć dane demonstracyjne” w górnym pasku przywraca stan początkowy.

## Linki

- Prototyp: <https://hacknation.rabbithole.carrotly.tech>
- Prezentacja (10 slajdów): <https://hacknation.rabbithole.carrotly.tech/prezentacja>
- API (health): <https://api.hacknation.rabbithole.carrotly.tech/api/health>
- Kod backendu: <https://github.com/carrotly-technologies/hacknation-backend>
- Kod frontendu: <https://github.com/carrotly-technologies/hacknation-frontend>
- Opis, AI, architektura: `docs/zgloszenie/` w repozytorium backendu
