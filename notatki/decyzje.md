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
