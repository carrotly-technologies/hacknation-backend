# Dokumenty źródłowe – Kompas Kompetencji

Materiały od Ministerstwa Cyfryzacji do zadania „Kompas Kompetencji” (HackNation 2026).
Opis zgłoszenia (projekt, wykorzystanie AI, architektura, teksty do HackTribe): [`zgloszenie/`](zgloszenie/).
Oryginały leżą w podkatalogach tematycznych, a `tekst/` ma ich wersje tekstowe w tej samej strukturze,
do czytania przez agentów i jako baza wiedzy asystenta AI.

Dokumentacja RODO aplikacji (rejestr czynności przetwarzania, DPIA, polityka retencji): [`rodo/`](rodo/).
Bezpieczeństwo aplikacji: checklista OWASP ASVS 4.0 poziom 2 (V1–V14) ze statusem i ścieżkami do kodu: [`security/asvs-l2.md`](security/asvs-l2.md).

## Zadanie

| Plik | Co to jest |
|---|---|
| `zadanie/opis-zadania-kompas-kompetencji.pdf` | Pełna treść wyzwania: oczekiwany rezultat, wymagania formalne i techniczne, sposób testowania, kryteria oceny (25/25/20/20/10) |
| `zadanie/regulamin-zadania.pdf` | Regulamin zadania: jury, nagrody, przeniesienie praw autorskich |

## Akty prawne i standardy

Pobrane 21.11.2026 z oficjalnych serwisów (akty prawne i dokumenty urzędowe nie są chronione prawem autorskim,
art. 4 ustawy o prawie autorskim).

| Plik | Co to jest | Źródło |
|---|---|---|
| `akty-prawne/ustawa-o-sluzbie-cywilnej.pdf` | Ustawa z 21.11.2008 r. o służbie cywilnej, tekst ujednolicony Kancelarii Sejmu opracowany na podstawie t.j. Dz.U. z 2026 r. poz. 590 (71 stron) | ISAP: [karta aktu](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20082271505), plik `https://api.sejm.gov.pl/eli/acts/DU/2008/1505/text/U/D20081505Lj.pdf`; urzędowy t.j.: `https://api.sejm.gov.pl/eli/acts/DU/2026/590/text.pdf` |
| `akty-prawne/standardy-zzl.pdf` | Zarządzenie nr 6 Szefa Służby Cywilnej z 12.03.2020 r. w sprawie standardów zarządzania zasobami ludzkimi w służbie cywilnej, z załącznikiem (standardy, cz. I–VII). Skan; nadal obowiązuje według gov.pl | [gov.pl/web/sluzbacywilna/standardyzzl](https://www.gov.pl/web/sluzbacywilna/standardyzzl), plik `https://www.gov.pl/attachment/08ec7330-b7b0-479e-8df2-c209dc3c1f9a` |
| `akty-prawne/standardy-zzl-zmiana-2020.pdf` | Zarządzenie nr 7 Szefa Służby Cywilnej z 16.12.2020 r.: nowe brzmienie cz. III pkt 1 standardów (obsadzanie stanowisk, na których kieruje się pracownikami) | ta sama strona gov.pl, plik `https://www.gov.pl/attachment/26c6d537-e334-44d7-8e1f-1123c7d55809` |

Numery stron w odwołaniach do standardów (np. „cz. VI pkt 2, s. 15”) to numery wydrukowane na stronach załącznika;
w pliku PDF to strona o jeden dalej (pierwsza strona pliku to samo zarządzenie).

## Model kompetencji

| Plik | Co to jest |
|---|---|
| `model-kompetencji/model-kompetencji.xlsx` | 14 kompetencji, 49 wskaźników behawioralnych, opisy 5 poziomów (1/3/5/7/9) dla każdego wskaźnika |
| `model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf` | Załącznik nr 1 do rozporządzenia z 2016 r.: wykaz 14 kryteriów oceny z opisami (słownik do mapowania OSP → kryteria) |
| `model-kompetencji/kompas-kompetencji-sciezki-oceny.png` | Grafika z wstępną koncepcją aplikacji (ścieżki: pierwsza ocena, ocena okresowa z formularzem B/C) |

## Ocena okresowa (co 24 miesiące)

| Plik | Co to jest |
|---|---|
| `ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf` | Rozporządzenie PRM z 4.04.2016 (Dz.U. 2016 poz. 470): kryteria, arkusze A/B/C, skala 1–9, terminy |
| `ocena-okresowa/poradnik-oceny-okresowe.pdf` | Poradnik KPRM do oceny okresowej |
| `ocena-okresowa/arkusz-oceny-b.docx` | Wzór arkusza B: stanowiska kierujące pracownikami |
| `ocena-okresowa/arkusz-oceny-c.docx` | Wzór arkusza C: pozostałe stanowiska |

## Pierwsza ocena (nowy pracownik)

| Plik | Co to jest |
|---|---|
| `pierwsza-ocena/rozporzadzenie-pierwsza-ocena-2015.pdf` | Rozporządzenie PRM z 23.07.2015 (Dz.U. 2015 poz. 1144): 5 elementów oceny, skala 3/5/7, sprawozdanie, terminy |
| `pierwsza-ocena/poradnik-pierwsza-ocena-2016.pdf` | Poradnik KPRM do pierwszej oceny |
| `pierwsza-ocena/arkusz-pierwszej-oceny.docx` | Wzór arkusza pierwszej oceny |

## Opisy stanowisk pracy (OSP)

Trzy przykładowe OSP z Ministerstwa Cyfryzacji, wejście do kroku „Analiza opisu stanowiska pracy”.

| Plik | Stanowisko | Podległość → arkusz |
|---|---|---|
| `opisy-stanowisk/osp-dc-wzksoic-6-starszy-specjalista.docx` | starszy specjalista, Departament Cyberbezpieczeństwa, Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa | brak podległych → **C** |
| `opisy-stanowisk/osp-dsi-wwi-5-radca.docx` | radca, Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji, Wydział Wspierania Innowacyjności | brak podległych → **C** |
| `opisy-stanowisk/osp-dwm-wkam-1-naczelnik-wydzialu.docx` | naczelnik wydziału, Departament Współpracy Międzynarodowej, Wydział Koordynacji Aktywności Międzynarodowych | kieruje 5–9 osobami → **B** |

## Wersje tekstowe (`tekst/`)

Wygenerowane z oryginałów (pypdf, python-docx, openpyxl; `akty-prawne/` przez `pdftotext` z poppler):

- PDF: tekst strona po stronie, z nagłówkami `--- page N ---` (przydatne do cytowania źródła).
- DOCX: akapity i tabele (komórki rozdzielone `|`, linie w komórce `/`). **Pola wyboru zapisane jako `[x]` / `[ ]`**, więc w OSP widać np. zaznaczoną liczbę podległych pracowników.
- XLSX: każdy arkusz jako `### SHEET: …`, wiersze rozdzielone `|`.

Po zmianie oryginałów wersje tekstowe trzeba wygenerować ponownie.

`tekst/akty-prawne/standardy-zzl.txt`: dwie pierwsze strony skanu (zarządzenie i początek słownika pojęć) nie mają
warstwy tekstowej, więc są odczytane przez OCR (tesseract) i poprawione ręcznie według skanu. Na pozostałych
stronach punktory list zamieniono na `- `. W `standardy-zzl-zmiana-2020.txt` poprawiono ręcznie nagłówek
(numer i datę zarządzenia wpisane odręcznie).

## Baza wiedzy asystenta

`npm run kb:build` czyta wyłącznie z tego katalogu. Oryginały są dostępne w aplikacji pod
`GET /api/docs/<ścieżka>`, a lista dokumentów (z informacją, czy asystent z nich odpowiada) pod
`GET /api/assistant/documents`. Do odpowiedzi indeksowane są: ustawa o służbie cywilnej (z PDF, artykułami i ustępami),
oba rozporządzenia, oba poradniki, standardy ZZL (z wersji tekstowej, częściami i punktami; cz. III pkt 1
w brzmieniu zarządzenia nr 7), arkusze B, C i pierwszej oceny (z wersji tekstowych) oraz model kompetencji
(z wersji tekstowej `model-kompetencji.xlsx`). Opis zadania, regulamin, grafika, przykładowe OSP i samo zarządzenie
zmieniające standardy są tylko na liście dokumentów.

## Czego tu brakuje

Dwa dokumenty bazy wiedzy nie są w repo, bo nie ma ich publicznie. Ich fragmenty są w
`src/assistant/data/knowledge.data.ts` (wygenerowane wcześniej z plików autora asystenta) i `kb:build` je zachowuje,
dopóki pliku brak. Po dodaniu pliku pod wskazaną ścieżką `kb:build` przetworzy go od nowa:

| Dokument | Oczekiwana ścieżka | Do tego czasu |
|---|---|---|
| Zasady obliczania terminów (`LT`) | `materialy-dodatkowe/zasady-obliczania-terminow.docx` | bez linku, „brak pliku źródłowego” |
| Zestaw pytań i odpowiedzi (`QA`) | `materialy-dodatkowe/pytania-i-odpowiedzi.md` | bez linku, „brak pliku źródłowego” |

Opis zadania wymienia też materiały ze strony KPRM poza dwoma poradnikami; nie było ich w paczce.
