# Rejestr czynności przetwarzania: Kompas Kompetencji

Wzór wpisu do rejestru czynności przetwarzania (art. 30 ust. 1 RODO) dla urzędu, który wdraża aplikację.
Pola w nawiasach kwadratowych uzupełnia urząd. Opis odpowiada kodowi w tym repozytorium.

| Pole (art. 30 ust. 1 RODO) | Wpis |
|---|---|
| Nazwa czynności | Przeprowadzanie pierwszej oceny i ocen okresowych członków korpusu służby cywilnej w aplikacji Kompas Kompetencji |
| Administrator (lit. a) | [Nazwa urzędu], w imieniu którego czynności z zakresu prawa pracy wykonuje dyrektor generalny urzędu (art. 25 ustawy o służbie cywilnej); IOD: [dane kontaktowe] |
| Cel (lit. b) | Sporządzenie oceny na piśmie, z rozmową, uzasadnieniem i IPRZ; dotrzymanie terminów; zapoznanie ocenianego z oceną i umożliwienie sprzeciwu; monitorowanie ocen przez komórkę kadr |
| Kategorie osób (lit. c) | Oceniani (urzędnicy i pracownicy służby cywilnej), oceniający (bezpośredni przełożeni), pracownicy kadr, administratorzy aplikacji |
| Odbiorcy (lit. d) | Oceniający (własny zespół), komórka kadr (podgląd i monitoring), oceniany (swój arkusz przez jednorazowy link), dyrektor generalny (sprzeciw, poza aplikacją). Podmiot przetwarzający: dostawca hostingu, jeśli urząd nie hostuje sam (umowa z art. 28 RODO). Opcjonalnie dostawca modelu językowego (patrz niżej) |
| Przekazanie do państw trzecich (lit. e) | Aplikacja sama niczego nie przekazuje poza EOG; miejsce hostingu wybiera urząd (zalecane: UE/PL). Asystent AI działa bez internetu (tryb ekstraktywny) albo z modelem lokalnym (np. Ollama). Zewnętrzny endpoint LLM urząd włącza świadomie i tylko z dostawcą z UE/EOG |
| Termin usunięcia (lit. f) | 10 lat od zakończenia sprawy oceny (`RETENTION_YEARS`), potem anonimizacja: [retencja.md](retencja.md). Notatki i obserwacje dziennika: 10 lat od ostatniej zmiany / daty obserwacji |
| Środki bezpieczeństwa (lit. g, art. 32) | Szyfrowanie w transmisji (TLS 1.2+, HSTS) i w spoczynku (AES-256-GCM pól wolnego tekstu), kontrola dostępu według roli i zespołu, hasła jako skróty scrypt, brak danych osobowych w logach, retencja automatyczna. Szczegóły: [dpia.md](dpia.md), rozdz. 5 |

## Kategorie danych, podstawa prawna i okres przechowywania

Podstawa prawna dla wszystkich kategorii: **art. 6 ust. 1 lit. c RODO** (obowiązek prawny administratora) w związku z:

- art. 38 (pierwsza ocena), art. 81–83 (ocena okresowa, sprzeciw) i art. 84 (opisy stanowisk pracy) ustawy z 21.11.2008 r.
  o służbie cywilnej (t.j. Dz.U. 2026 poz. 590),
- rozporządzeniem PRM z 4.04.2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych (Dz.U. 2016 poz. 470),
- rozporządzeniem PRM z 23.07.2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny
  (Dz.U. 2015 poz. 1144).

Aplikacja nie przetwarza danych szczególnych kategorii (art. 9 RODO) ani danych o wyrokach (art. 10). Pola wolnego tekstu
mogą je przypadkowo zawierać, dlatego są szyfrowane; urząd powinien w instrukcji dla przełożonych wskazać, żeby ich
nie wpisywać.

| Kategoria | Dane (pola w API) | Skąd | Kto widzi | Przechowywanie |
|---|---|---|---|---|
| Dane pracownika (ocenianego) | imię, nazwisko, stanowisko, komórka, status (`URZEDNIK` / `PRACOWNIK`), data zatrudnienia (`Person`) | system kadrowy urzędu albo przełożony | oceniający własnego zespołu, kadry; oceniany na swoim arkuszu | do anonimizacji sprawy (10 lat od zakończenia) |
| Oceny | arkusz, kryteria, oceny cząstkowe, średnia, wynik i poziom, część I (oczekiwania, cele), uzasadnienie, IPRZ, wniosek o stopień służbowy z motywacją, poprzednia ocena, sprzeciw, daty etapów (`CaseRecord`) | oceniający; sprzeciw: oceniany | oceniający, kadry; oceniany: tylko to, co drukuje arkusz | jw.; po anonimizacji zostają liczby i daty bez danych osoby |
| Notatki i obserwacje | notatki przełożonego i obserwacje S-D-R o pracowniku (`journal_notes`, `journal_observations`), obserwacje w sprawie | oceniający | tylko autor wpisu | 10 lat od ostatniej zmiany notatki / od daty obserwacji; w bazie zaszyfrowane |
| Konta | login, imię, nazwisko, rola, stanowisko, komórka, skrót hasła scrypt | administrator aplikacji | administrator (bez skrótów haseł), użytkownik sam o sobie | przez okres pełnienia funkcji; usuwa administrator |
| Link dla ocenianego | losowy token (32 bajty), data ważności | aplikacja | nikt w API (oceniający widzi tylko link do przekazania) | 14 dni; po zapoznaniu link otwiera tylko potwierdzenie; usuwany przy anonimizacji |
| Pytania do asystenta | treść pytania, historia czatu z bieżącej sesji | użytkownik | nikt: nie są zapisywane ani logowane | czas trwania żądania |

## Gdzie to jest w kodzie

- Typy i widoki API (minimalizacja): `src/cases/case.types.ts`, `src/cases/case-view.ts`, `src/ack/ack.types.ts`,
  `src/people/people.types.ts`, `src/hr/hr.service.ts`, `src/auth/user.types.ts` (`toUserView`), test
  `test/rodo.e2e-spec.ts`.
- Szyfrowanie: `src/crypto/field-cipher.ts`, `src/journal/postgres-journal.repository.ts`.
- Retencja: `src/retention/retention.rules.ts`, `src/retention/retention.service.ts`, `npm run retention`.
