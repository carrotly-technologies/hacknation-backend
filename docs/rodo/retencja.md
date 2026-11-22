# Polityka retencji danych: Kompas Kompetencji

## Zasada

Dane przechowujemy nie dłużej, niż to potrzebne do celu (art. 5 ust. 1 lit. e RODO). Oryginał arkusza oceny włącza się
do akt osobowych ocenianego (§ 6 ust. 3 i § 12 ust. 2 rozp. PRM z 4.04.2016, Dz.U. 2016 poz. 470; § 11 ust. 2 rozp. PRM
z 23.07.2015, Dz.U. 2015 poz. 1144), a dokumentację pracowniczą pracodawca przechowuje 10 lat (art. 94 pkt 9b Kodeksu
pracy; Kodeksu nie ma w `docs/`). Aplikacja trzyma tylko kopię roboczą, więc nigdy dłużej niż akta.

| Dane | Okres | Liczony od | Co potem |
|---|---|---|---|
| Sprawa oceny (dane ocenianego, treść oceny, sprzeciw, historia) | `RETENTION_YEARS`, domyślnie 10 lat | zakończenia sprawy: upływu terminu sprzeciwu (7 dni od zapoznania, art. 83 ust. 1 ustawy) dla oceny okresowej, zapoznania dla pierwszej oceny | anonimizacja |
| Notatka przełożonego (dziennik) | `RETENTION_YEARS` | ostatniej zmiany notatki | usunięcie |
| Obserwacja S-D-R (dziennik) | `RETENTION_YEARS` | daty obserwacji | usunięcie |
| Link dla ocenianego | 14 dni (ważność) | wysłania | nieważny; token usuwany przy anonimizacji |
| Dziennik aktywności (`request_log`: IP, przeglądarka, login, ścieżki) | 30 dni | wpisu | usunięcie (przy starcie i co 24 h, `src/monitor`) |
| Pytania do asystenta | nie są przechowywane | | |
| Konta użytkowników | do usunięcia przez administratora | | |

Okres 10 lat jest liczony od zakończenia sprawy, a nie od ustania zatrudnienia, bo aplikacja nie zna daty ustania
stosunku pracy. To ostrożne uproszczenie: kopia robocza znika nie później niż oryginał w aktach. Urząd może skrócić okres
(`RETENTION_YEARS`, np. do 2 lat, gdy kopia robocza nie jest potrzebna po kolejnej ocenie) po uzgodnieniu z IOD.

## Anonimizacja sprawy

`anonymizeCase` w `src/retention/retention.rules.ts`:

- osoba: nowy identyfikator `anon-<id sprawy>` (sprawa nie łączy się już z profilem pracownika), imię i nazwisko
  „Osoba zanonimizowana”, stanowisko i komórka puste;
- usuwane: tematy i oczekiwania części I, obserwacje w sprawie, notatki o odchyleniach, uzasadnienie, IPRZ, motywacja
  wniosku o stopień, treść sprzeciwu, token linku, historia sprawy (zastąpiona jednym wpisem o anonimizacji);
- zostają: arkusz, kryteria, oceny cząstkowe, wynik, daty etapów i oceniający, żeby działały statystyki i reguły
  terminów. Bez danych osoby nie są to już dane osobowe ocenianego.

Sprawa w toku albo w okresie sprzeciwu nigdy nie jest anonimizowana. Ponowne uruchomienie nie zmienia spraw już
zanonimizowanych.

## Techniczna realizacja

- `RetentionService` (`src/retention/retention.service.ts`) działa przy starcie API i potem co 24 godziny.
- Na żądanie: `npm run retention` (po `npm run build`; w obrazie Docker: `node dist/retention/retention.cli.js`)
  uruchamia tę samą logikę na skonfigurowanym magazynie danych i wypisuje raport:

  ```json
  { "today": "2026-11-21", "years": 10, "cutoff": "2016-11-21",
    "casesAnonymized": 0, "journalNotesDeleted": 0, "journalObservationsDeleted": 0 }
  ```

- „Dziś” to `DEMO_TODAY` (jak dla wszystkich terminów), granica to ten sam dzień `RETENTION_YEARS` lat wcześniej:
  dane zakończone przed nią są anonimizowane lub usuwane.
- W logu są tylko liczby, nigdy dane osób.
- Z `DATABASE_URL` wpisy dziennika są usuwane z PostgreSQL (`journal_notes`, `journal_observations`); sprawy są w tej
  wersji w pamięci procesu, więc anonimizacja działa w działającym API (przy starcie i co dobę).
- Testy: `src/retention/*.spec.ts` (dane z przesuniętą datą: sprawa zakończona 11 lat temu jest anonimizowana, 9 lat
  temu nie), `test/rodo.e2e-spec.ts` (anonimizacja widoczna w API), `src/journal/journal.repository.spec.ts`
  (usuwanie z bazy i z pamięci).

Pokaz: `RETENTION_YEARS=0 npm run retention` anonimizuje każdą sprawę, której termin sprzeciwu już minął, i usuwa wpisy
dziennika sprzed dziś; sprawy w toku i w okresie sprzeciwu zostają bez zmian (w seedzie demo jedyna zapoznana sprawa
jest jeszcze w okresie sprzeciwu, więc raport pokaże 0 spraw).

Kopie zapasowe bazy: urząd ustala ich rotację tak, by dane usunięte w aplikacji znikały z kopii najpóźniej po
jej cyklu (np. 30 dni).
