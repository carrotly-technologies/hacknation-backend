# Audyt zgodności – Kompas Kompetencji

Stan na 21.11.2026. Porównanie wymagań zadania „Kompas Kompetencji”, przepisów i materiałów z `docs/` z kodem na `main`:

- backend `carrotly-technologies/hacknation-backend` @ `4ffcc09` (oznaczany niżej `be:`),
- frontend `carrotly-technologies/hacknation-frontend` @ `b48be6a` (oznaczany niżej `fe:`).

Ocena powstała z czytania kodu, testów i lokalnych uruchomień. Wdrożenia na Coolify nie sprawdzano, z wyjątkiem jednego `curl` na `/api/health`. W raporcie nie ma żadnych zmian w kodzie.

Legenda: ✅ spełnione, ⚠️ częściowo albo nie da się tego rozstrzygnąć z samego kodu, ❌ brak.
Priorytet (P1 najwyższy, P3 najniższy) mówi, jak bardzo luka szkodzi ocenie jury: zgodność 25%, UX 25%, AI 20%, innowacyjność 20%, potencjał wdrożeniowy 10%.

## Podsumowanie

| Status | Liczba wierszy |
|---|---|
| ✅ | 36 |
| ⚠️ | 15 |
| ❌ | 12 |

Najmocniejsza część to rdzeń merytoryczny. Obie ścieżki, model kompetencji, sugestia poziomu, reguły punktacji, terminy i kontrola formalna są czystymi funkcjami z testami jednostkowymi i powołują właściwe paragrafy. Najsłabsze są trzy obszary:

1. **Asystenta AI nie ma.** `fe:src/api/assistant.ts` to zaślepka, która zawsze odpowiada „brak połączenia z bazą wiedzy”, a backend nie ma żadnego endpointu AI. Obejmuje to 20% oceny i wprost wymienione elementy testu jury.
2. **Nie ma uwierzytelniania ani ról po stronie serwera.** Każdy, kto zna adres API, może czytać i zmieniać wszystkie teczki.
3. **Nie ma materiałów do oddania**: opisu projektu, prezentacji, opisu użycia AI ani opisu architektury. Do tego oba repozytoria są prywatne.

## Tabela wymagań

Skróty źródeł: **OZ** = `docs/zadanie/opis-zadania-kompas-kompetencji.pdf`, **RO** = `docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf`, **RP** = `docs/pierwsza-ocena/rozporzadzenie-pierwsza-ocena-2015.pdf`, **MK** = `docs/model-kompetencji/model-kompetencji.xlsx`, **PO** = `docs/ocena-okresowa/poradnik-oceny-okresowe.pdf`, **OSP** = `docs/opisy-stanowisk/*.docx`. Strony według `docs/tekst/` (`--- page N ---`).

### A. Ścieżki procesu

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| A1 | Dwie odrębne ścieżki: pierwsza ocena i ocena okresowa | OZ s. 2 (pkt 3) | ✅ | `be:src/cases/case.types.ts` (`PERIODIC_STAGES`, `FIRST_STAGES`), `be:src/cases/stages.rules.ts` (`buildStages`, `STAGE_LEGAL_BASIS`); `fe:src/case/StageRail.tsx`, `fe:src/case/stages/FirstPrepStages.tsx`, `fe:src/case/stages/FirstConditionsStage.tsx` | – | – |
| A2 | Prowadzenie krok po kroku, etap po etapie, zgodnie z zasadami danej ścieżki | OZ s. 2–3 | ✅ | `be:src/cases/actions.rules.ts` (`actionBlocker`, `applyAction`, 409 z polskim wyjaśnieniem), `be:src/cases/patch.rules.ts` (blokada części I po zatwierdzeniu; część II roboczo od wyboru arkusza do podpisu oceniającego, `partIIEditable`, PO s. 20 etap II, RO § 10–§ 12, decyzja w `be:notatki/decyzje.md`); `POST /api/cases/:id/actions`; `fe:src/case/stages/StageNotOpen.tsx`, `availableActions` w `CaseDetail` | – | – |
| A3 | Rozpoczęcie procesu przez przełożonego (scenariusz testu: „rozpoczęcie procesu”) | OZ s. 5 (pkt 6) | ⚠️ | Teczki pochodzą tylko z seeda: `be:src/cases/seed/seed.data.ts` (np. sprawa na etapie `OSP_ANALYSIS`, `INTRO_TALK`), `POST /api/demo/reset` | Nie ma `POST /api/cases` ani ekranu „Nowa ocena” (wybór pracownika, ścieżki i OSP). W demo trzeba zaczynać od gotowej teczki z seeda. | P1 |

### B. Opis stanowiska pracy, arkusz i kryteria

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| B1 | Analiza OSP jako wejście do doboru arkusza i kryteriów | OZ s. 7 (pkt 7: 3 szablony OSP); PO s. 21–22 | ✅ | `be:src/osp/osp.data.ts` (3 prawdziwe OSP), `GET /api/osp`, `be:src/osp/osp-analysis.rules.ts`, analiza w `CaseDetail.ospAnalysis`; `fe:src/case/stages/OspAnalysisStage.tsx` | Trzy OSP są przepisane ręcznie do kodu. Nie da się wczytać nowego OSP (.docx). | P3 |
| B2 | Wybór arkusza B/C na podstawie liczby podległych pracowników | RO § 3 ust. 3–4; pola `[x]` w `docs/tekst/opisy-stanowisk/*.txt` | ✅ | `be:src/osp/osp-analysis.rules.ts` (`analyseOsp`): wynik dla trzech OSP to C, C i B (naczelnik „od 5 do 9 pracowników”), zgodnie z `docs/README.md`; `be:src/osp/osp-analysis.rules.spec.ts`. W UI przełożony może zmienić arkusz (`OspAnalysisStage.tsx`, select „Arkusz”). | Arkusz A nie jest sugerowany nigdy (świadoma decyzja, opisana w kodzie). Przy „koordynuje” system pokazuje ostrzeżenie. | – |
| B3 | Kryteria obowiązkowe arkusza B (5) i C (5) | RO § 4 ust. 2–3 | ✅ | `be:src/competency-model/data/model.data.ts` (`SHEET_MAPPING.B/C`), `be:src/sheets/sheets.data.ts`, `GET /api/sheets`; zgodność z listą z § 4 sprawdzona ręcznie | – | – |
| B4 | Wybór najwyżej 3 kryteriów dodatkowych, w tym zero, i nie spośród obowiązkowych | RO § 2 ust. 2, § 5 ust. 2; PO s. 21–22 | ✅ | `be:src/cases/patch.rules.ts` (limit 3, duplikaty, obowiązkowe jako dodatkowe → 400), `be:src/cases/formal-check.rules.ts` (`ADDITIONAL_CRITERIA_CONSISTENT`), `be:src/assessments/evaluate.rules.ts` (`validateEvaluation`); `fe:OspAnalysisStage.tsx` (licznik `n/3`, tekst „Można nie wybrać żadnego”) | – | – |
| B5 | Propozycja kryteriów dodatkowych na podstawie obowiązków i wymaganych kompetencji z OSP | PO s. 21–22 | ⚠️ | `be:src/osp/osp-analysis.rules.ts`: kandydaci to wyłącznie kompetencje miękkie z OSP, które nie są obowiązkowe w danym arkuszu | Główne zadania z OSP nie są analizowane. Dla OSP radcy (`osp-dsi-wwi-5`) system nie proponuje żadnego kandydata. Dobre miejsce na AI z cytatem z OSP. | P2 |
| B6 | Część I: omówione zagadnienia, oczekiwania, termin oceny, potwierdzenie przez ocenianego | RO § 5 ust. 1 i 3, § 6 | ✅ | `be:src/cases/case.types.ts` (`PartI.topics`, `expectations`, `assessmentDue`), akcje `CONFIRM_PART_I` i `EMPLOYEE_ACK_PART_I`; `fe:src/case/stages/OpeningTalkStage.tsx` | Potwierdzenie przez ocenianego to akcja klikana przez przełożonego. Pracownik nie ma własnego konta. | P3 |

### C. Model kompetencji

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| C1 | 14 kompetencji i 49 wskaźników behawioralnych | MK (arkusz „Model kompetencji”); OZ s. 2 | ✅ | `be:src/competency-model/data/model.data.ts`: policzone 14 kompetencji i 49 wskaźników; `GET /api/competency-model`; `be:src/competency-model/competency-model.controller.spec.ts` | Dane wygenerowano skryptem `be:scripts/generate-model-data.mjs` z `notatki/model-kompetencji.json`, którego nie ma w żadnym repo, więc nie da się ich odtworzyć z `docs/`. | P3 |
| C2 | 5 poziomów z opisem zachowania dla każdego wskaźnika; przełożony wybiera zachowanie najlepiej opisujące obserwacje | MK; OZ s. 2 | ✅ | `be:src/competency-model/competency-model.types.ts` (`Indicator.levels` 1/3/5/7/9), `scale` z etykietami; `fe:src/case/stages/AssessmentStage.tsx` (rubryka wskaźnik × poziom) | – | – |
| C3 | Zasada „brak podstaw do oceny” | MK (instrukcja, wiersz 5) | ✅ | `be:src/assessments/suggest-level.rules.ts` (`points: null`, pominięcie w średniej, ostrzeżenie), `be:src/assessments/suggest-level.rules.spec.ts`; `fe:AssessmentStage.tsx` (przycisk „Brak podstaw do oceny”, „b.p.” w wyliczeniu) | – | – |
| C4 | Pierwsza ocena: 5 stałych elementów, bez kryteriów dodatkowych | RP § 2 pkt 1 | ✅ | `SHEET_MAPPING.first` w `be:model.data.ts`; `be:src/sheets/sheets.data.ts` (`FIRST`, `maxAdditionalCriteria: 0`); `validateSuggestLevel` i `validateEvaluation` odrzucają inne kompetencje | – | – |
| C5 | Obserwacje z okresu oceny (sytuacja, działanie, rezultat) | MK (instrukcja: „Zapisz sytuację, działanie i jego rezultat”); PO s. 20 (etap II) | ✅ | `POST /api/cases/:id/observations`, `be:src/cases/case.types.ts` (`Observation`); `fe:src/case/stages/ObservationStage.tsx` | – | – |

### D. Sugerowany poziom i decyzja przełożonego

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| D1 | System liczy i pokazuje sugerowany poziom z wybranych zachowań | OZ s. 2 (pkt 3), s. 5 (pkt 6) | ✅ | `POST /api/assessments/suggest-level`, `be:src/assessments/suggest-level.rules.ts` (średnia ocenionych wskaźników przyciągnięta do skali, remis w stronę 5, `rationale`, `warnings`, `isSuggestionOnly: true`); `fe:AssessmentStage.tsx` (blok „sugestia” z wyliczeniem) | Regułę przeliczenia przyjął zespół, przepisy jej nie określają (system mówi to w `rationale`). Warto ją pokazać jury jako świadomą decyzję. | – |
| D2 | Ostateczną ocenę zawsze wybiera przełożony | OZ s. 2, s. 4 | ✅ | Osobne pola `ratings` (wskaźniki) i `decisions` (ocena cząstkowa), które ustawia tylko `PATCH /api/cases/:id`; `be:src/cases/patch.rules.ts`; `fe:AssessmentStage.tsx` (wybór punktów, przycisk „Przyjmij sugestię”, `deviationNotes` przy odstępstwie) | – | – |
| D3 | Mapowanie 5 poziomów modelu na skalę 3/5/7 w pierwszej ocenie | RP § 9 ust. 1; MK | ✅ | `be:src/assessments/suggest-level.rules.ts`: dla `FIRST` poziomy 1 i 9 są przeliczane na 3 i 7 przed uśrednieniem, z ostrzeżeniem; testy w `suggest-level.rules.spec.ts`; skala decyzji 3/5/7 w `patch.rules.ts` | Przeliczenie przyjął zespół, przepisy go nie określają. Warto potwierdzić je z mentorem MC. | P3 |

### E. Punktacja, średnia i wynik

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| E1 | Ocena okresowa: oceny cząstkowe 1/3/5/7/9 | RO § 11 ust. 1 pkt 1 | ✅ | `be:src/sheets/sheets.data.ts` (`PERIODIC_SCALE`), `be:src/cases/patch.rules.ts` (400 poza skalą), `formal-check.rules.ts` (`POINTS_IN_SCALE`) | – | – |
| E2 | Ocena okresowa: średnia arytmetyczna i przedziały poziomu (1–2, >2–4, >4–6, >6–8, >8–9) | RO § 11 ust. 1 pkt 2 | ✅ | `be:src/assessments/evaluate.rules.ts` (`periodicLevel`, `PERIODIC_BANDS`, progi liczone z dokładnej średniej), `evaluate.rules.spec.ts` | – | – |
| E3 | Ocena okresowa: pozytywna przy średniej > 4; negatywna przy średniej ≤ 4 albo przy jakiejkolwiek ocenie cząstkowej 1 pkt | RO § 11 ust. 1 pkt 3–4 | ✅ | `be:src/assessments/evaluate.rules.ts` (`evaluate`), `POST /api/assessments/evaluate`, `CaseDetail.evaluation`; ostrzeżenie o 1 pkt już przy wskaźnikach (`suggest-level.rules.ts`); `fe:src/case/stages/ResultBar.tsx` | – | – |
| E4 | Uzasadnienie obowiązkowe przy ocenie negatywnej, IPRZ zawsze w ocenie okresowej | RO § 11 ust. 1 pkt 5, ust. 3–4 | ✅ | `be:src/cases/formal-check.rules.ts` (`JUSTIFICATION_IF_NEGATIVE`, `IPRZ_REQUIRED`); `SIGN_ASSESSMENT` jest zablokowane, dopóki kontrola formalna nie przejdzie; `fe:src/case/stages/JustificationStage.tsx`, `FormalCheck.tsx` | – | – |
| E5 | Pierwsza ocena: oceny cząstkowe 3/5/7 i ocena łączna jako średnia | RP § 7 pkt 2–3, § 9 ust. 1 | ✅ | `be:src/sheets/sheets.data.ts` (`FIRST.scale`), `evaluateFirst` w `be:src/assessments/evaluate.rules.ts` | – | – |
| E6 | Pierwsza ocena pozytywna: egzamin zaliczony (lub zwolnienie z § 10 ust. 3), sprawozdanie w terminie, najwyżej jedna ocena 3 pkt, średnia ≥ 5 | RP § 10 ust. 1–3 | ✅ | `evaluateFirst` w `be:evaluate.rules.ts` (`YES` / `NO` / `NOT_APPLICABLE`), `reportOnTime` w `be:src/cases/case.rules.ts`, `FIRST_CONDITIONS_FILLED` w `formal-check.rules.ts`; `fe:FirstConditionsStage.tsx` | „NIE DOTYCZY” nie wymaga wskazania, który z trzech przypadków § 10 ust. 3 zachodzi. | P3 |
| E7 | Pierwsza ocena: uzasadnienie przy negatywnej, wnioski rozwojowe tylko przy pozytywnej | RP § 10 ust. 4–6 | ✅ | `be:formal-check.rules.ts` (`JUSTIFICATION_IF_NEGATIVE`, `DEVELOPMENT_ONLY_IF_POSITIVE`) | – | – |
| E8 | Rozmowa oceniająca przed sporządzeniem oceny na piśmie (§ 10 pkt 1–3); przy sporządzaniu oceny oceniający bierze pod uwagę wnioski z rozmowy | RO § 10, § 11 ust. 2; PO s. 20 (Tabela nr 1, etapy III i IV) | ✅ | Etapy `ASSESSMENT_TALK` („Rozmowa oceniająca”) i `JUSTIFICATION` („Weryfikacja formularza”) w `be:src/cases/case.types.ts`; tematy § 10 i walidacja daty w `be:src/cases/assessment-talk.rules.ts` (`CaseDetail.assessmentTalkTopics`); akcja `RECORD_ASSESSMENT_TALK` i blokada `SIGN_ASSESSMENT` bez rozmowy w `be:src/cases/actions.rules.ts`; `ASSESSMENT_TALK_HELD` w `formal-check.rules.ts`; formularz edytowalny po rozmowie do podpisu (`partIIEditable`); `fe:src/case/stages/AssessmentTalkStage.tsx`, `fe:src/case/stages/JustificationStage.tsx` | Notatek z przebiegu rozmowy nie zapisujemy. Pierwsza ocena nie ma jeszcze osobnego kroku rozmowy (RP § 7). | P3 |

### F. Terminy z przepisów

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| F1 | Rozmowa rozpoczynająca i część I: 30 dni od poprzedniej oceny lub zatrudnienia na czas nieokreślony, 7 dni od oceny negatywnej | RO § 7 | ✅ | `openingTalkDeadline` w `be:src/cases/deadlines.rules.ts` (z przesunięciem z dnia wolnego, art. 115 KC), `deadlines.rules.spec.ts` | – | – |
| F2 | Termin sporządzenia oceny (co 24 miesiące), ponowna ocena 6 miesięcy po negatywnej | RO § 5 ust. 3; ustawa art. 81 (przywołana w kodzie) | ✅ | `defaultAssessmentDue`, `reassessmentAfterNegativeDue`, `assessmentDueDeadline` w `be:deadlines.rules.ts`; `PATCH` odrzuca termin w przeszłości (`patch.rules.ts`) | Ustawy o służbie cywilnej nie ma w `docs/`, więc artykułów nie dało się sprawdzić ze źródłem (zob. I6). | P3 |
| F3 | Sprzeciw: 7 dni od zapoznania się z oceną | ustawa art. 83 ust. 1 (przywołany w arkuszu, RO zał. 3 i 4) | ✅ | `objectionDeadline` w `be:deadlines.rules.ts`, status `OKRES_SPRZECIWU` w `be:stages.rules.ts`; treść pouczenia z wzoru w `template.objectionNotice` (`be:src/sheets/sheets.data.ts`), wyświetlana w `fe:src/sheet/SheetDocument.tsx` i w części II kreatora | – | – |
| F4 | Pierwsza ocena: rozmowa wstępna w ciągu 21 dni od nawiązania stosunku pracy | RP § 3 | ✅ | `introTalkDeadline` w `be:deadlines.rules.ts`, etap `INTRO_TALK` | Wariant zastępstwa (21 dni od ustalenia, że oceniany podlega pierwszej ocenie) nie jest obsłużony. | P3 |
| F5 | Termin sprawozdania po upływie 8 miesięcy; sprawozdanie obejmuje co najmniej 7 miesięcy | RP § 4 ust. 1, § 6 ust. 1 | ⚠️ | `defaultReportDue` w `be:deadlines.rules.ts` (8 miesięcy + 14 dni) | `PATCH firstConditions.reportDue` w `be:patch.rules.ts` nie sprawdza, czy termin wypada po 8 miesiącach. Minimum 7 miesięcy nie jest nigdzie sprawdzane, a treści sprawozdania (§ 6 ust. 2) system nie zbiera: jest tylko flaga „złożone”. | P2 |
| F6 | Okno pierwszej oceny: po 8 miesiącach i nie później niż miesiąc przed końcem umowy | RP § 4 ust. 1 (odesłanie do art. 38 ust. 1 ustawy) | ✅ | `firstAssessmentWindow` w `be:deadlines.rules.ts`, `FIRST_ASSESSMENT_WINDOW` w `formal-check.rules.ts` | – | – |
| F7 | Zmiany terminów: nowy termin oceny (§ 8), zmiana stanowiska (§ 9), przedłużenie terminu sprawozdania o nieobecność (RP § 5) z pisemnym zawiadomieniem | RO § 8–9; RP § 5 | ❌ | Brak. Jedynie `reportDue` da się edytować przed złożeniem sprawozdania (`be:patch.rules.ts`). | Brak akcji „zmień termin” z podstawą prawną i zapisem w historii teczki, brak zawiadomienia. | P3 |

### G. Dokumentacja i PDF

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| G1 | Arkusz oceny okresowej (części I, II, III) wypełniany z teczki | RO zał. 3–4; `docs/ocena-okresowa/arkusz-oceny-b.docx`, `arkusz-oceny-c.docx` | ✅ | `fe:src/sheet/SheetDocument.tsx`, `fe:src/sheet/SheetPage.tsx` (`/teczka/:id/arkusz`); kreator `fe:src/case/stages/SheetPartI–III.tsx`. Poprzednia ocena, pytanie TAK/NIE/NIE DOTYCZY i część III: `be:src/cases/promotion.rules.ts` (art. 89 ust. 1, § 11 ust. 5 RO, `PROMOTION_REQUEST` w kontroli formalnej), stopnie służbowe `be:src/civil-service-grades/data/grades.data.ts` (art. 86 ust. 1), stałe teksty wzorów w `template` arkuszy (`be:src/sheets/sheets.data.ts`) | – | – |
| G2 | Generowanie dokumentacji w PDF | OZ s. 4 (pkt 5) | ⚠️ | `fe:SheetPage.tsx` („Drukuj / zapisz PDF”, `window.print()`, `?druk=1`), `fe:src/styles/sheet.css` (`@media print`, strony A4); „Pobierz PDF” w `fe:src/case/CasePage.tsx` | PDF powstaje przez okno drukowania przeglądarki, nie jako plik. Wynik zależy od przeglądarki i ustawień druku. Nie ma endpointu `GET /api/cases/:id/pdf` do integracji (EZD). | P2 |
| G3 | Arkusz pierwszej oceny zgodny ze wzorem | RP zał. 2; `docs/pierwsza-ocena/arkusz-pierwszej-oceny.docx` | ⚠️ | `fe:SheetDocument.tsx` (wariant `FIRST`) | Brakuje pól wzoru: okresu sprawozdania „od–do” (jest tylko „do”), „Okresu, w którym powinna zostać dokonana pierwsza ocena” (od–do) i sekcji „Dane kierującego komórką organizacyjną”. | P2 |
| G4 | Formularz sprawozdania pracownika | RP § 6, zał. 3 | ❌ | Brak | Nie ma formularza ani wydruku sprawozdania (4 punkty z § 6 ust. 2). | P3 |

### H. Panel HR

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| H1 | Monitorowanie statusów procesów | OZ s. 3 | ✅ | `GET /api/hr/overview` (`counters`: w toku, termin bliski, po terminie, do zapoznania, okres sprzeciwu), `be:src/hr/hr.service.ts`; `fe:src/pages/HrPage.tsx` (liczniki jako filtry, filtr departamentu, ścieżki, wyszukiwarka) | – | – |
| H2 | Monitorowanie terminów | OZ s. 3 | ✅ | `nextDeadline` w każdej sprawie (`be:src/cases/stages.rules.ts`), stany `OK`/`SOON`/`OVERDUE` (`toDeadline`, `SOON_DAYS = 14`); kolumna terminu w `fe:HrPage.tsx` | – | – |
| H3 | Wysyłanie przypomnień | OZ s. 3 | ⚠️ | `POST /api/hr/reminders` (`be:src/hr/hr.service.ts`, `remind`), przyciski „Przypomnij” w `fe:HrPage.tsx` | Przypomnienie jest symulowane: trafia tylko do `history` teczki i `lastReminderOn`. Przełożony nie widzi go w swoim widoku jako powiadomienia, nie ma e-maila. | P2 |
| H4 | Komunikacja z przełożonymi | OZ s. 2 (pkt 2) | ⚠️ | Jak H3, plus historia teczki w `CaseDetail.history` | Nie ma kanału HR → przełożony poza symulowanym wpisem w historii. | P3 |

### I. Asystent AI

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| I1 | Odpowiedzi na podstawie bazy wiedzy | OZ s. 3, s. 4 (pkt 5) | ❌ | `fe:src/api/assistant.ts`: `askAssistant` to zaślepka, która zawsze zwraca `noAnswer: true, placeholder: true`. W backendzie nie ma żadnego endpointu AI (`be:src/app.module.ts`). | Brak RAG, modelu i indeksu. Teksty z numerami stron są gotowe w `docs/tekst/`. Kontrakt UI (`AssistantAnswer.sources`, `noAnswer`) jest gotowy. | P1 |
| I2 | Wskazanie źródła odpowiedzi | OZ s. 4 | ❌ | UI umie wyświetlić `sources` (`fe:src/assistant/AssistantPanel.tsx`), ale nic ich nie dostarcza | Jak I1 | P1 |
| I3 | Komunikat „nie wiem” przy braku informacji w bazie | OZ s. 4 | ❌ | Jest tylko pole `noAnswer` w kontrakcie i tekst w `fe:src/pages/KnowledgePage.tsx`. Zaślepka mówi „nie wiem” na każde pytanie, więc mechanizmu nie da się ocenić. | Potrzebny próg trafności wyszukiwania i odpowiedź „brak w bazie wiedzy” z backendu. | P1 |
| I4 | Przygotowanie do rozmowy: pytania, kwestie do omówienia, porządkowanie argumentów | OZ s. 3 | ❌ | Tryb `CONVERSATION` i podpowiadane pytania per etap w `fe:src/assistant/suggestions.ts`; kontekst teczki (`caseId`, `stageId`) jest przekazywany do `askAssistant`, ale nieużywany | Brak generowania. Asystent powinien korzystać z obserwacji, decyzji i OSP z teczki. | P1 |
| I5 | AI nie ustala poziomu oceny, decyzja należy do przełożonego | OZ s. 4 | ✅ | Sugestia poziomu to reguła deterministyczna, nie AI (`be:src/assessments/suggest-level.rules.ts`, `isSuggestionOnly`). Oceny zapisuje tylko przełożony (`PATCH decisions`). Informacja „Nie ocenia pracownika” w `fe:AssistantPanel.tsx`. | Przy wdrażaniu asystenta trzeba to utrzymać: AI nie zwraca punktów ani nie zapisuje decyzji. | – |
| I6 | Baza wiedzy: ustawa o SC, rozporządzenia, model, poradniki i materiały KPRM, zestaw pytań i odpowiedzi | OZ s. 4 | ❌ | `docs/` ma rozporządzenia, model, dwa poradniki i OSP. `docs/README.md` („Czego tu brakuje”) wymienia brak ustawy, części materiałów KPRM i zestawu Q&A. | Bez ustawy asystent nie odpowie poprawnie o art. 38, 81 i 83, o które jury prawdopodobnie zapyta. `fe:KnowledgePage.tsx` wymienia ustawę i Q&A jako źródła, choć ich nie ma. | P1 |
| I7 | Darmowe narzędzia AI na etapie hackathonu | OZ s. 4 | ⚠️ | Nie dotyczy kodu, bo AI jeszcze nie ma | Przy wyborze modelu użyć darmowego API lub modelu open source i opisać to w materiałach. | P2 |

### J. Bezpieczeństwo i dane

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| J1 | Uwierzytelnianie | OZ s. 4 (pkt 5) | ❌ | `be:README.md` („No auth and no database”); w `be:src/` nie ma guardów ani modułu auth | Brak logowania. | P1 |
| J2 | Autoryzacja, role i uprawnienia | OZ s. 4 | ❌ | Rola to przełącznik w UI zapisany w `localStorage` (`fe:src/lib/role.tsx`, `fe:src/shell/AppShell.tsx`). API go nie zna. | `GET /api/cases/:id` i `PATCH` działają dla każdej teczki, także cudzego przełożonego. `GET /api/hr/overview` jest dostępne dla każdego. | P1 |
| J3 | Ochrona danych osobowych i poufność informacji o pracownikach | OZ s. 4 | ⚠️ | Dane są fikcyjne (`be:src/cases/seed/seed.data.ts`, `OFFICE_NAME` „dane demonstracyjne”), trzymane w pamięci. CORS ogranicza się do `FRONTEND_URL` (`be:src/configure-app.ts`). | Bez J1 i J2 publiczne API pozwala każdemu czytać i zmieniać teczki. Brak dziennika dostępu. Przy wdrażaniu asystenta trzeba określić, jakie dane teczki trafiają do zewnętrznego LLM. | P1 |
| J4 | Minimalizacja przetwarzanych danych | OZ s. 4 | ✅ | `Person` w `be:src/cases/case.types.ts` zawiera tylko imię, nazwisko, stanowisko, komórkę, rodzaj zatrudnienia i datę zatrudnienia. Nie ma PESEL ani adresu. | Opisać zasadę w materiałach. Do LLM wysyłać tylko to, co potrzebne, bez nazwisk. | P3 |

### K. API i architektura

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| K1 | Udokumentowane interfejsy (API) | OZ s. 4 | ⚠️ | Tabele tras w `be:README.md`, walidacja zod (`be:src/**/*.schemas.ts`) | README odsyła do `notatki/api-kontrakt-v1.md` i `v2.md`, których nie ma w żadnym repo. Nie ma OpenAPI ani Swaggera (`@nestjs/swagger` nie jest zainstalowany). | P2 |
| K2 | Bezpieczna wymiana danych: walidacja wejścia i czytelne błędy | OZ s. 4 | ✅ | `StandardSchemaValidationPipe` w `be:src/configure-app.ts`, schematy zod, 400 z polskimi komunikatami, 409 dla niedozwolonych przejść; e2e w `be:test/cases.e2e-spec.ts`, `be:test/assessments.e2e-spec.ts` | – | – |
| K3 | Architektura umożliwiająca rozwój i skalowanie | OZ s. 4 | ⚠️ | Moduły NestJS per domena, reguły jako czyste funkcje z testami, Dockerfile w obu repo | Stan trzyma `Map` w pamięci (`be:src/cases/case-store.service.ts`), więc restart kasuje dane, a dwie instancje mają różny stan. Brak bazy danych. | P2 |
| K4 | Możliwość integracji z EZD i systemami kadrowymi (np. QNT) | OZ s. 4 | ⚠️ | REST/JSON API (K1) to naturalny punkt integracji | Nie ma opisu, jak integracja miałaby wyglądać (import pracowników i OSP, eksport PDF do EZD). Wystarczy opis w materiałach. | P3 |

### L. Interfejs

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| L1 | Interfejs w przeglądarce, na desktop, bez smartfonów | OZ s. 2, s. 4 | ✅ | SPA React (`fe:src/App.tsx`), `min-width: 1120px` w `fe:src/styles/base.css` | Poniżej 1120 px strona przewija się w poziomie. Nie ma komunikatu „otwórz na komputerze” na telefonie ani układu dla mniejszych laptopów („responsywny”). | P3 |
| L2 | Główny użytkownik to przełożony, dodatkowy to HR | OZ s. 2 | ✅ | `fe:src/pages/TeamPage.tsx` (`/zespol`, lista zadań według terminów), `fe:src/pages/HrPage.tsx` (`/hr`); `GET /api/team`, `GET /api/me` | – | – |
| L3 | Polski interfejs z podstawą prawną przy etapach i terminach | OZ s. 5 (pkt 6: zgodność z zasadami) | ✅ | `legalBasis` w `Deadline`, `StageInfo`, `FormalCheckItem` (`be:src/cases/stages.rules.ts`, `be:src/cases/formal-check.rules.ts`) | – | – |

### M. Materiały do oddania

| # | Wymaganie | Źródło | Status | Dowód | Luka | Priorytet |
|---|---|---|---|---|---|---|
| M1 | Działający prototyp z co najmniej jedną kompletną ścieżką | OZ s. 3 (pkt 4), s. 5 | ⚠️ | Ścieżka okresowa i pierwsza ocena przechodzą od etapu do etapu (`be:test/cases.e2e-spec.ts`); prod `GET https://api.hacknation.rabbithole.carrotly.tech/api/health` zwrócił `{"status":"ok"}` | Brak asystenta AI (I1), który ma być częścią demo. Start procesu z seeda (A3). | P1 |
| M2 | Krótki opis projektu (koncepcja, funkcjonalności) | OZ s. 3 | ❌ | Brak. README obu repo są techniczne. | – | P1 |
| M3 | Prezentacja, najwyżej 10 slajdów | OZ s. 3 | ❌ | Brak | – | P1 |
| M4 | Opis wykorzystania AI | OZ s. 3 | ❌ | Brak | Zależy od I1–I4. | P1 |
| M5 | Technologie, architektura i elementy do zabezpieczenia przed produkcją | OZ s. 3, s. 4 | ⚠️ | Stos i deploy opisują `be:README.md` i `fe:README.md` | Brak schematu architektury i listy elementów do zabezpieczenia (auth, baza, LLM, RODO), której OZ wymaga wprost. | P2 |
| M6 | Linki aktywne i dostępne dla oceniających bez dodatkowych uprawnień | OZ s. 3 | ⚠️ | `gh repo view`: oba repozytoria są `PRIVATE`. Aplikacja na Coolify odpowiada publicznie. | Przed oddaniem trzeba upublicznić repo albo dołączyć archiwum kodu i sprawdzić, czy demo działa bez logowania (lub z kontem demo). | P1 |

## Porównanie z ticketami #1 i #2

### #1 „Szkielet apki: React (frontend) + NestJS (backend), połączone ze sobą”

| Założenie ticketu | Stan w kodzie | Ocena |
|---|---|---|
| NestJS z Nest CLI, ESLint, Prettier, Jest | NestJS 12 z Prettierem, ale lint to **oxlint** (`npm run lint`), a testy to **Vitest** (`vitest.config.ts`, `vitest.config.e2e.ts`) | ⚠️ świadoma zmiana narzędzi, funkcja zachowana |
| `@nestjs/config` globalnie, `PORT` (3000), `FRONTEND_URL` | `be:src/app.module.ts` (`isGlobal: true`), `be:src/main.ts`, `be:src/configure-app.ts`; doszło `DEMO_TODAY` | ✅ |
| Prefix `api`, CORS dla `FRONTEND_URL` | `be:src/configure-app.ts` | ✅ |
| `GET /api/health` → `{"status":"ok"}` i test | `be:src/health/health.controller.ts`, `health.controller.spec.ts`, `be:test/health.e2e-spec.ts` | ✅ |
| `.env.example`, `.gitignore`, README | Są w obu repo | ✅ |
| Frontend: Vite, React, TS, ESLint | Vite i React 19 z TS, lint to **oxlint** | ⚠️ jak w backendzie |
| Proxy `/api` → `:3000` | `fe:vite.config.ts` (z nadpisaniem `API_PROXY_TARGET`) | ✅ |
| `App.tsx` pokazuje status `/api/health` i czytelny błąd | Status jest teraz małym wskaźnikiem w menu (`fe:src/components/ApiStatus.tsx`), a błędy API obsługuje `fe:src/api/client.ts` („Brak połączenia z serwerem API…”) | ✅ zmienione w ramach dalszych prac |
| Poza zakresem: baza, autoryzacja, router, state management, Swagger | Router (react-router) i TanStack Query już doszły. Baza, autoryzacja i Swagger nadal nie istnieją. | Te braki to dziś luki J1, J2, K1 i K3 |

### #2 „Deploy hacknation (frontend + backend) na Coolify”

| Założenie ticketu | Stan w kodzie | Ocena |
|---|---|---|
| Backend: multi-stage `Dockerfile` (Node LTS), `.dockerignore` | `be:Dockerfile` (node:24-alpine, `npm prune --omit=dev`, `USER node`, `HEALTHCHECK` na `127.0.0.1`), `be:.dockerignore` | ✅ |
| Nasłuch na `0.0.0.0:$PORT` | `be:src/main.ts` | ✅ |
| Frontend: multi-stage z `ARG VITE_API_URL` i nginx z fallbackiem SPA | `fe:Dockerfile`, `fe:nginx.conf` (`try_files $uri $uri/ /index.html`) | ✅ |
| Fetch do `${VITE_API_URL}/api/...` | `fe:src/api/client.ts` | ✅ |
| Sekcja „Deploy” w README | Jest w obu README (URL, auto-deploy, uruchomienie obrazu lokalnie) | ✅ |
| Aplikacje w Coolify i auto-deploy | Poza zakresem audytu. Jedyna kontrola: `curl https://api.hacknation.rabbithole.carrotly.tech/api/health` → `{"status":"ok"}` | ⚠️ nie weryfikowano |

## Wyniki testów i checków

Backend (`hacknation-backend` @ `4ffcc09`, po `npm ci`):

```
$ npm test
 Test Files  11 passed (11)
      Tests  132 passed (132)

$ npm run test:e2e
 Test Files  3 passed (3)
      Tests  27 passed (27)

$ npm run lint    # oxlint --type-aware src/ test/: bez uwag
$ npm run build   # nest build: OK
```

Frontend (`hacknation-frontend` @ `b48be6a`, tylko odczyt, osobny worktree): `npm run lint` bez uwag, `npm run build` OK (`tsc -b && vite build`). Frontend nie ma testów.

## Proponowane taski

Kolejność według wpływu na ocenę jury. Żaden z tych tasków nie jest jeszcze na tablicy, trafią tam po akceptacji operatora.

### 1. Asystent AI odpowiadający z bazy wiedzy, ze źródłami i z „nie wiem”

**Cel:** jury może zadać pytanie o zasady pierwszej lub okresowej oceny i dostaje poprawną odpowiedź z cytatem i stroną dokumentu albo jasne „nie ma tego w bazie wiedzy” (AI 20%, zgodność 25%; luki I1–I3, I7).

- `POST /api/assistant/ask` w backendzie (kontrakt jak `AskAssistantRequest`/`AssistantAnswer` z `fe:src/api/assistant.ts`) indeksuje `docs/tekst/` z podziałem na strony i zwraca `sources` z plikiem, stroną lub paragrafem oraz cytatem.
- Gdy wyszukiwanie nie znajdzie fragmentu powyżej progu, odpowiedź ma `noAnswer: true` i nie zawiera treści wygenerowanej bez źródła.
- `askAssistant` we frontendzie woła ten endpoint, a znaczek „Tryb demonstracyjny” znika.
- Test na co najmniej 10 pytaniach z przepisów (np. „Czy jedna ocena 1 pkt oznacza ocenę negatywną?”, „W jakim terminie rozmowa wstępna?”) sprawdza, że każda odpowiedź podaje właściwe źródło. Model jest darmowy i opisany w README.

### 2. Materiały do oddania i dostęp dla jury

**Cel:** zespół spełnia wymagania formalne z OZ pkt 4, bez których projekt może nie zostać oceniony (luki M2–M6).

- W repo są: opis projektu (koncepcja i funkcje), opis użycia AI (gdzie AI jest, a gdzie świadomie go nie ma, np. sugestia poziomu) oraz opis technologii i architektury ze schematem i listą elementów do zabezpieczenia przed produkcją.
- Jest prezentacja o najwyżej 10 slajdach: logika działania, kluczowe funkcje, kierunek rozwoju.
- Repozytoria są publiczne albo do zgłoszenia dołączono archiwum kodu. Wszystkie linki otwierają się w oknie incognito.

### 3. Asystent rozmowy korzystający z kontekstu teczki

**Cel:** asystent pomaga przygotować rozmowę: proponuje pytania, kwestie do omówienia i porządkuje argumenty na podstawie obserwacji i decyzji z teczki, nie proponując punktów (AI 20%, UX 25%; luka I4, zasada I5).

- Tryb `CONVERSATION` wykorzystuje `context.caseId` i `stageId`: obserwacje S-D-R, oczekiwania z części I, decyzje i odstępstwa od sugestii.
- Odpowiedzi nie zawierają proponowanej liczby punktów ani poziomu. Sprawdza to test promptu lub filtr odpowiedzi.
- Do LLM nie trafiają nazwiska ani dane identyfikujące, tylko treść obserwacji (minimalizacja, J3–J4).

### 4. Logowanie i role egzekwowane przez API

**Cel:** przełożony widzi i zmienia tylko teczki swoich pracowników, a panel HR jest tylko dla HR (zgodność 25%, wdrożeniowy 10%; luki J1–J3).

- Demo-logowanie (np. 2–3 konta z seeda: przełożony A, przełożony B, HR) z sesją lub JWT przez `@nestjs/authentication`.
- `GET/PATCH /api/cases/:id` dla cudzej teczki zwraca 403, a `/api/hr/*` dla roli przełożonego zwraca 403. Testy e2e to sprawdzają.
- Przełącznik roli w `AppShell` zastępuje wylogowanie i logowanie albo „zaloguj jako” z kont demo.

### 5. Rozpoczęcie nowej oceny z poziomu przełożonego

**Cel:** demo pokazuje pełną ścieżkę od początku, jak wymaga OZ pkt 6 (luka A3).

- `POST /api/cases` tworzy teczkę dla pracownika z wybraną ścieżką (pierwsza lub okresowa) i OSP, z walidacją i polskimi błędami.
- Ekran „Nowa ocena” w `/zespol` prowadzi do etapu `OSP_ANALYSIS` albo `INTRO_TALK` nowej teczki.
- Test e2e przechodzi ścieżką okresową od utworzenia do `EMPLOYEE_ACK_ASSESSMENT`.

### 6. Uzupełnienie bazy wiedzy o ustawę i zestaw pytań i odpowiedzi

**Cel:** asystent zna art. 35–38 i 81–83 ustawy o służbie cywilnej i materiały KPRM, o które jury zapyta (luki I6, F2).

- `docs/` i `docs/tekst/` zawierają ustawę (co najmniej w zakresie potrzebnym do zadania) i zestaw Q&A z Discorda, z numerami stron.
- `fe:KnowledgePage.tsx` wymienia tylko źródła, które naprawdę są w indeksie.
- Zestaw Q&A służy jako test regresji asystenta (task 1).

### 7. Kompletny arkusz pierwszej oceny i plik PDF

**Cel:** generowana dokumentacja jest zgodna ze wzorami („poprawność generowanych rezultatów i dokumentacji”; luki G2–G4).

- Arkusz pierwszej oceny ma wszystkie pola wzoru z RP zał. 2: okres sprawozdania od–do, okres dokonania oceny od–do, dane kierującego komórką.
- Jest endpoint lub przycisk, który zwraca gotowy plik PDF (np. `GET /api/cases/:id/pdf`), a nie tylko okno drukowania.
- Opcjonalnie: formularz sprawozdania pracownika (RP zał. 3).

### 8. Analiza OSP z propozycją kryteriów dodatkowych na podstawie obowiązków

**Cel:** dobór kryteriów dodatkowych odpowiada poradnikowi (PO s. 21–22): obowiązki i wymagane kompetencje z OSP, z cytatem (innowacyjność 20%, AI 20%; luka B5).

- Kandydaci powstają także z głównych zadań OSP (reguły albo AI), każdy z cytatem z OSP i uzasadnieniem.
- OSP radcy (`osp-dsi-wwi-5`) dostaje co najmniej jedną uzasadnioną propozycję albo jawną informację „brak kryteriów dodatkowych, bo…”.
- Przełożony nadal akceptuje lub odrzuca każdą propozycję, z limitem 3.

### 9. Walidacja terminów pierwszej oceny i zmiany terminów

**Cel:** system nie pozwala ustawić terminu sprzecznego z RP § 4–6 i obsługuje zmiany terminów (luki F5, F7).

- `PATCH firstConditions.reportDue` odrzuca termin przed upływem 8 miesięcy od zatrudnienia i okres sprawozdania krótszy niż 7 miesięcy (400 z podstawą prawną).
- Akcja „zmień termin” (nieobecność według RP § 5 i zmiana terminu oceny według RO § 8) zapisuje powód i podstawę w historii teczki.
- Testy jednostkowe w `deadlines.rules.spec.ts` lub `patch.rules` pokrywają oba przypadki.

### 10. Dokumentacja API w OpenAPI

**Cel:** udokumentowane interfejsy do integracji z EZD i systemami kadrowymi (wdrożeniowy 10%; luki K1, K4).

- `@nestjs/swagger` udostępnia `/api/docs` z opisem wszystkich tras i schematów.
- Odwołania do `notatki/api-kontrakt-v*.md` w README zastępuje link do OpenAPI albo pliki kontraktu trafiają do repo.
- Krótki opis punktów integracji (import pracowników i OSP, eksport PDF).

### 11. Trwały magazyn danych

**Cel:** dane teczek przetrwają restart i deploy (wdrożeniowy 10%; luka K3).

- `CaseStoreService` korzysta z bazy (np. SQLite lub Postgres przez `@nestjs/typeorm` lub `@nestjs/drizzle`) zamiast `Map`.
- `POST /api/demo/reset` dalej odtwarza seed.
- Istniejące testy e2e przechodzą bez zmian w kontrakcie.

### 12. Przypomnienia widoczne u przełożonego

**Cel:** przypomnienie od HR realnie dociera do przełożonego (luki H3–H4).

- `GET /api/team` lub osobny endpoint zwraca nieodczytane przypomnienia dla zalogowanego przełożonego.
- Widok `/zespol` pokazuje je przy teczce, a przełożony może oznaczyć je jako przeczytane.
- HR widzi w `/hr`, czy przypomnienie odczytano.
