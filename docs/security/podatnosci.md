# Podatności – hacknation-backend

Rejestr podatności w zależnościach i w obrazie Docker backendu. Źródło: workflow
[`security`](../../.github/workflows/security.yml) (Trivy `fs` i `image`), uruchamiany przy każdym
pushu na `main`, przy każdym PR i raz w tygodniu. Wyniki są w zakładce
**Security → Code scanning** (kategorie `trivy-fs` i `trivy-image`) oraz jako artefakty
`trivy-fs.sarif` / `trivy-image.sarif` z każdego runu.

## Zasada

- Podatność **HIGH/CRITICAL z dostępną poprawką** blokuje merge (krok „Trivy gate”, `--ignore-unfixed --exit-code 1`).
  Naprawiamy ją aktualizacją zależności albo obrazu bazowego, zanim zmiana trafi na `main`.
- Podatność **bez poprawki** albo o niższej wadze nie blokuje builda. Wpisujemy ją do tabeli niżej
  z oceną wpływu i decyzją, a Dependabot i cotygodniowy skan pilnują, kiedy pojawi się poprawka.

## Naprawione przy wdrożeniu skanu (22.11.2026)

| Gdzie | Pakiet | CVE | Waga | Poprawka |
|---|---|---|---|---|
| obraz (npm w `node:24-alpine`) | `undici` 6.28.0 | CVE-2026-109383, CVE-2026-109869, CVE-2026-19534, CVE-2026-87018 | HIGH | npm, npx i corepack usunięte z warstwy runtime (`Dockerfile`): aplikacja startuje przez `node dist/main` i ich nie potrzebuje |
| obraz (npm w `node:24-alpine`) | `brace-expansion` 5.0.9 | CVE-2026-102276, CVE-2026-102278 | HIGH | jak wyżej |
| obraz (Alpine) | pakiety systemowe | – | – | `apk upgrade --no-cache` w warstwie runtime, żeby obraz miał poprawki Alpine wydane po obrazie bazowym |

Przy okazji `package-lock.json` został zsynchronizowany z `package.json` (brakowało w nim
`@emnapi/core` i `@emnapi/runtime` 2.0.0-beta.2, opcjonalnych zależności deweloperskich), bo bez
tego `npm ci` w `Dockerfile` i w CI kończyło się błędem.

## Otwarte podatności (bez poprawki)

Stan na 22.11.2026 (Trivy 0.76, wszystkie wagi, także bez poprawki): **brak** w `package-lock.json`
i w obrazie.

| Pakiet | CVE | Waga | Wpływ na aplikację | Decyzja | Data przeglądu |
|---|---|---|---|---|---|
| – | – | – | – | – | – |

Nową pozycję dodajemy, gdy skan pokaże podatność bez poprawki: wpływ ocenia się względem tego,
czy podatny kod jest osiągalny w aplikacji (np. paczka tylko deweloperska, funkcja nieużywana),
a decyzja to „akceptujemy do czasu poprawki”, „obchodzimy (jak)” albo „usuwamy zależność”.
Wyjątek w skanie (`.trivyignore`) dodajemy tylko razem z wpisem w tej tabeli.
