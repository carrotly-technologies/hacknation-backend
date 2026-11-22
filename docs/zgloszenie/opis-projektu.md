# Kompas Kompetencji – opis projektu

HackNation 2026, wyzwanie Ministerstwa Cyfryzacji „Kompas Kompetencji”.

- Prototyp: <https://hacknation.rabbithole.carrotly.tech>
- Prezentacja: <https://hacknation.rabbithole.carrotly.tech/prezentacja> (PDF: `hacknation-frontend/docs/prezentacja.pdf`)
- Kod: [hacknation-backend](https://github.com/carrotly-technologies/hacknation-backend),
  [hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend)
- Pozostałe opisy: [wykorzystanie AI](wykorzystanie-ai.md), [architektura i technologie](architektura-i-technologie.md)

## Problem

Przełożony w służbie cywilnej przeprowadza ocenę rzadko, raz na 24 miesiące (ocena okresowa) albo raz przy nowym
pracowniku (pierwsza ocena). Zasady są rozproszone w ustawie, dwóch rozporządzeniach, poradnikach KPRM i modelu
kompetencji. Łatwo pomylić arkusz, kryteria albo termin, a ocena kompetencji „na wyczucie” trudno uzasadnić. Kadry nie
widzą na bieżąco, na jakim etapie są oceny w urzędzie.

## Koncepcja

Aplikacja webowa zbudowana wokół **teczki oceny**: jedna teczka to jeden proces oceny jednej osoby. Teczka prowadzi
przełożonego etap po etapie według właściwej ścieżki, liczy terminy z podstawą prawną, blokuje kroki niedozwolone na
danym etapie i na końcu tworzy wypełniony arkusz. Ocena kompetencji opiera się na wskaźnikach behawioralnych z modelu
kompetencji: system podpowiada, przełożony decyduje. Asystent AI odpowiada na pytania o zasady wyłącznie z bazy
wiedzy i pomaga przygotować rozmowę.

## Najważniejsze funkcjonalności

**Dwie ścieżki procesu** (szyna etapów w teczce, każdy etap z podstawą prawną):

- ocena okresowa (rozp. PRM z 4.04.2016): Analiza opisu stanowiska → Wstępny formularz → Rozmowa rozpoczynająca ·
  część I → Okres oceny · obserwacje → Formularz oceny kompetencji → Rozmowa oceniająca → Weryfikacja formularza →
  Dokument i zapoznanie;
- pierwsza ocena (rozp. PRM z 23.07.2015): Rozmowa wstępna → Sprawozdanie pracownika → Formularz pierwszej oceny →
  Warunki pierwszej oceny → Dokument i zapoznanie.

**Opis stanowiska, arkusz i kryteria.** Analiza OSP (3 prawdziwe OSP z materiałów) proponuje arkusz B lub C (według
liczby podległych pracowników) i kandydatów na kryteria dodatkowe. Przełożony może to zmienić; system pilnuje
kryteriów obowiązkowych arkusza i limitu najwyżej 3 dodatkowych.

**Model kompetencji.** 14 kompetencji, 49 wskaźników behawioralnych, opis 5 poziomów (1/3/5/7/9) dla każdego wskaźnika,
wczytane z `model-kompetencji.xlsx`. Przełożony ocenia wskaźnik, wybierając opis zachowania najbliższy temu, co
obserwował, albo „brak podstaw do oceny”. System liczy **sugerowany poziom** kryterium (średnia ocenionych wskaźników
dociągnięta do skali arkusza; reguła przyjęta przez zespół). Obok jest osobne pole „Twoja decyzja”: sugestię trzeba
świadomie przyjąć albo wybrać inny poziom z uzasadnieniem odchylenia. **Ostateczny poziom zawsze wybiera przełożony.**
Wynik (pozytywny/negatywny) liczony jest według § 11 rozp. 2016 i § 10 rozp. 2015 z podaniem przepisu.

**Prowadzenie krok po kroku i terminy.** Każdy etap ma termin liczony według przepisów (z regułami Kodeksu
cywilnego, w tym przesunięciem z soboty, niedzieli i święta) i podstawą prawną. Niedozwolone przejście kończy się
komunikatem po polsku, co jeszcze trzeba zrobić. Przed podpisem działa kontrola formalna arkusza (np. czy odbyła się
rozmowa oceniająca, czy uzupełniono uzasadnienie i część III). „Mój zespół” pokazuje ludzi i najbliższe terminy,
zaległe na górze. Przełożony prowadzi też całoroczny dziennik notatek i obserwacji w układzie sytuacja – działanie –
rezultat, widoczny tylko dla niego.

**Przygotowanie do rozmowy.** Etap „Rozmowa oceniająca” wypisuje zagadnienia z § 10 rozp. 2016. Przycisk „Przygotuj
pytania do rozmowy” otwiera asystenta z kontekstem teczki: pytania do kryteriów i obserwacji, schemat informacji
zwrotnej S-D-R, pomysły do IPRZ, bez proponowania ocen.

**Asystent AI.** Okno czatu na każdym ekranie aplikacji. Odpowiada z bazy wiedzy (ustawa o służbie cywilnej, oba
rozporządzenia, oba poradniki KPRM, standardy ZZL, wzory arkuszy, model kompetencji, zestaw pytań i odpowiedzi
opracowany przez zespół na podstawie przepisów). Każda odpowiedź ma źródła z linkiem do strony PDF. Poza bazą odpowiada
„Nie znalazłem tego w bazie wiedzy”. Szczegóły: [wykorzystanie-ai.md](wykorzystanie-ai.md).

**Dokumenty.** Wypełniony arkusz okresowy A/B/C (części I–III) do pobrania jako **PDF i DOCX**, złożony jak pismo
urzędowe, z nagłówkiem „WERSJA ROBOCZA” do czasu podpisu oceniającego. Arkusz pierwszej oceny: podgląd i wydruk do PDF
z przeglądarki. Oceniany zapoznaje się z oceną przez jednorazowy link (bez zakładania konta, ważny 14 dni): widzi
arkusz tylko do odczytu, potwierdza zapoznanie i może w ciągu 7 dni złożyć sprzeciw (art. 83 ust. 1 ustawy).

**HR i administrator.** Panel HR: liczniki i lista wszystkich ocen w urzędzie z etapem, terminem, oceniającym i
złożonymi sprzeciwami, filtry, wysyłka przypomnień do przełożonych (w prototypie symulowana: wpis do historii teczki).
Administrator zarządza kontami i rolami.

**Role.** Logowanie loginem i hasłem, role: przełożony (tylko własne teczki i własny zespół), HR (wszystkie teczki do
odczytu i monitoring), administrator (konta i role). Uprawnienia sprawdza serwer przy każdym żądaniu.

**Interfejs.** Polski, w przeglądarce, projektowany na komputer; układ dopasowuje się do rozdzielczości, są tryb
ciemny, wysoki kontrast i powiększenie tekstu do 150%.

## Jak wypróbować

Wejdź na <https://hacknation.rabbithole.carrotly.tech>. Pod formularzem logowania są karty kont demo (logowanie
jednym kliknięciem). Hasło wszystkich kont: `Kompas2026!`. Wszystkie osoby i dane są fikcyjne.

| Login                  | Rola          | Kto i co widzi                                   |
| ---------------------- | ------------- | ------------------------------------------------ |
| `k.wisniewska`         | przełożony    | Karolina Wiśniewska, 6 teczek (c-001…c-006)      |
| `a.szymanczak`         | przełożony    | Agnieszka Szymańczak, 2 teczki (c-101, c-102)    |
| `j.kuchta`             | przełożony    | Jolanta Kuchta, 2 teczki (c-103, c-104)          |
| `a.cieslak-dyjecinska` | HR            | Agata Cieślak-Dyjecińska, panel HR całego urzędu |
| `admin`                | administrator | Marek Zając, konta i role                        |

Data „dziś” w demo to 21.11.2026; wszystkie terminy liczone są względem niej.

**Zalecana ścieżka (ok. 10 minut), konto `k.wisniewska`:**

1. „Mój zespół” → Piotr Wójcik → teczka **c-002** (ocena okresowa na etapie „Analiza opisu stanowiska”: początek
   procesu). Przyjmij analizę OSP, zobacz proponowany arkusz C i kryteria dodatkowe, przejdź do części I.
2. Teczka **c-001** (etap „Formularz oceny kompetencji”): oceń wskaźniki behawioralne, zobacz sugerowany poziom,
   przyjmij go albo wybierz inny z uzasadnieniem.
3. W dowolnej teczce otwórz „Asystent AI” i zapytaj np. „Ile dni ma oceniany na wniesienie sprzeciwu?”, „Kiedy
   przeprowadza się rozmowę rozpoczynającą?”, „Jaką ocenę mam dać pracownikowi?” (odmowa) albo pytanie spoza tematu.
4. Teczka **c-006** (etap „Dokument i zapoznanie”): pobierz arkusz jako PDF i DOCX.
5. Teczka **c-004**: ścieżka pierwszej oceny (etap „Sprawozdanie pracownika”).
6. Wyloguj się i zaloguj jako `a.cieslak-dyjecinska` (HR): panel monitoringu i przypomnienia.

Dane demo są w pamięci serwera; przycisk „Przywróć dane demonstracyjne” w górnym pasku przywraca stan początkowy.

## Co dalej

- Rozpoczęcie nowej oceny z poziomu aplikacji (wybór pracownika, ścieżki i OSP; dziś teczki pochodzą z danych demo).
- Trwała baza danych dla teczek (dziś PostgreSQL obsługuje dziennik przełożonego, teczki są w pamięci).
- Logowanie przez SSO urzędu, rzeczywista wysyłka przypomnień (e-mail, EZD).
- Integracja z systemem kadrowym (np. QNT) jako źródłem osób, stanowisk i OSP oraz z EZD jako odbiorcą podpisanego
  arkusza i potwierdzenia zapoznania.
- Wczytywanie nowych OSP z pliku DOCX, generator PDF arkusza pierwszej oceny, model językowy uruchomiony w
  infrastrukturze urzędu.
- Udostępnienie innym urzędom (model kompetencji, terminy i dokumenty są danymi, nie kodem).
