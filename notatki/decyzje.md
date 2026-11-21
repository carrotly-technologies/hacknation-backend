# Decyzje

Decyzje dotyczące interpretacji przepisów i dokumentów z `docs/`, podjęte w trakcie prac. Każdy wpis: data, decyzja, źródło, stan poprzedni.

## 2026-11-21: Część II arkusza edytowalna przed rozmową oceniającą (wersja robocza)

- **Decyzja:** część II arkusza oceny okresowej (oceny wskaźników, oceny cząstkowe, notatki, uzasadnienie, IPRZ, poprzednia ocena, wniosek o kolejny stopień służbowy i część III) można zapisywać roboczo od chwili wybrania arkusza (etap „Wstępny formularz”) aż do podpisu oceniającego. Po podpisie (`SIGN_ASSESSMENT`) pola są zablokowane. Podpis nadal jest dostępny dopiero po rozpoczęciu rozmowy oceniającej (`START_ASSESSMENT`).
- **Źródło:**
  - Poradnik „Oceny okresowe w służbie cywilnej”, s. 20, etap II „Ocenianie”: „przygotowanie bezpośrednio przed rozmową oceniającą wypełnionego na roboczo arkusza oceny”.
  - § 10 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470): „Przed sporządzeniem oceny na piśmie oceniający przeprowadza z ocenianym rozmowę oceniającą…”; § 11 ust. 2: „Sporządzając ocenę na piśmie, oceniający bierze pod uwagę wnioski z rozmowy oceniającej.”; § 12 ust. 1: „Oceniający niezwłocznie zapoznaje ocenianego z oceną sporządzoną na piśmie.”
  - Wniosek: przed rozmową arkusz wypełnia się roboczo, a po rozmowie można go poprawić; „sporządzenie oceny na piśmie” to podpis oceniającego po rozmowie.
- **Wcześniej:** edycja części II tylko na etapach `ASSESSMENT` / `JUSTIFICATION` (po akcji „Rozpocznij rozmowę oceniającą”).
- **Pierwsza ocena bez zmian:** wersję roboczą przygotowuje się na podstawie sprawozdania ocenianego (Poradnik „Pierwsza ocena”, 2016, s. 27), a sprawozdanie jest dopiero na etapie `FIRST_ASSESSMENT` (§ 8 ust. 1 rozp. PRM z 23.07.2015).
- **Skutek uboczny:** gdy przed zatwierdzeniem części I zmieni się arkusz albo kryteria dodatkowe, robocze oceny kryteriów, które wypadły z oceny, są usuwane.
- **Kod:** `partIIEditable` w `src/cases/patch.rules.ts`.
- **Status:** do potwierdzenia z ekspertem.

## 2026-11-21: Rozmowa oceniająca i weryfikacja formularza jako osobne kroki

- **Decyzja:** po formularzu oceny kompetencji (`ASSESSMENT`, krok 4) są dwa osobne etapy: `ASSESSMENT_TALK` „Rozmowa oceniająca” (krok 5) i `JUSTIFICATION` „Weryfikacja formularza” (krok 6). Sprawa przechodzi na krok 5, gdy wszystkie kryteria mają ocenę cząstkową; akcja `RECORD_ASSESSMENT_TALK` zapisuje datę rozmowy (`assessmentTalkOn`, domyślnie dziś, nie z przyszłości, nie wcześniej niż zapoznanie z częścią I) i przenosi na krok 6. Podpis (`SIGN_ASSESSMENT`) jest możliwy tylko na kroku 6, po odnotowanej rozmowie.
- **Źródło:**
  - Poradnik „Oceny okresowe w służbie cywilnej”, s. 20, Tabela nr 1: etap III „Rozmowa oceniająca” („przed sporządzeniem oceny na piśmie”) i etap IV „Sporządzenie oceny na piśmie (wypełnienie arkusza oceny okresowej)”.
  - § 10 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470): tematy rozmowy (pkt 1–3); § 11 ust. 2: „Sporządzając ocenę na piśmie, oceniający bierze pod uwagę wnioski z rozmowy oceniającej.”
- **Podstawa prawna etapów:** `ASSESSMENT` → § 11 ust. 1 pkt 1–4 (wcześniej razem z § 10), `ASSESSMENT_TALK` → § 10, `JUSTIFICATION` → § 11 i art. 108 ustawy. § 12 (zapoznanie) zostaje przy `DOCUMENT` („Ocena końcowa”), bo dotyczy oceny już sporządzonej.
- **Wcześniej:** po ocenie wszystkich kryteriów sprawa przechodziła od razu do `JUSTIFICATION` („Uzasadnienie i plan rozwoju (IPRZ)”), a data rozmowy nie była zapisywana.
- **Pierwsza ocena bez zmian** (osobny task).
- **Kod:** `src/cases/assessment-talk.rules.ts`, `effectiveStage` w `src/cases/case.rules.ts`, `actionBlocker` / `applyAction` w `src/cases/actions.rules.ts`.
- **Status:** do potwierdzenia z ekspertem.
