# CRA i NIS2 – łańcuch dostaw i obsługa podatności

Wspólny dokument dla obu repo:
[hacknation-backend](https://github.com/carrotly-technologies/hacknation-backend) i
[hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend).
Opisuje, co z wymagań dotyczących SBOM, podatności i aktualizacji bezpieczeństwa jest wdrożone,
gdzie to widać i czego jeszcze brakuje.

- **CRA**: rozporządzenie (UE) 2024/2847 o horyzontalnych wymogach cyberbezpieczeństwa w odniesieniu
  do produktów z elementami cyfrowymi (Cyber Resilience Act). Obowiązki zgłaszania (art. 14) stosuje
  się od 11.09.2026 r., pozostałe od 11.12.2027 r.
- **NIS2**: dyrektywa (UE) 2022/2555 w sprawie środków na rzecz wysokiego wspólnego poziomu
  cyberbezpieczeństwa; art. 21 ust. 2 wymienia środki zarządzania ryzykiem, które musi stosować
  podmiot kluczowy lub ważny (np. urząd), także wobec swoich dostawców oprogramowania.

To, czy CRA obejmuje ten projekt formalnie, zależy od sposobu udostępnienia (CRA dotyczy produktów
wprowadzanych do obrotu w ramach działalności handlowej). Urząd, który wdraża aplikację, jest jednak
objęty NIS2 i musi ocenić bezpieczeństwo łańcucha dostaw, więc poniższe mechanizmy są dowodem dla
niego niezależnie od statusu projektu wobec CRA.

## Co jest wdrożone

| Mechanizm | Gdzie | Jak sprawdzić |
|---|---|---|
| SBOM w formacie CycloneDX (zależności produkcyjne, `npm sbom --omit dev`) | job `SBOM (CycloneDX)` w `.github/workflows/security.yml` | artefakt `sbom.cdx.json` w każdym runie workflow `security` |
| Skan podatności zależności, sekretów i konfiguracji (Trivy `fs`) | job `Trivy (fs)` | Security → Code scanning, kategoria `trivy-fs` |
| Skan obrazu Docker, który jest wdrażany (Trivy `image`) | job `Trivy (image)` | Security → Code scanning, kategoria `trivy-image` |
| Blokada merge przy HIGH/CRITICAL z dostępną poprawką | krok `Trivy gate` (`--ignore-unfixed --exit-code 1`) | czerwony check `security` na PR |
| Cotygodniowy skan bez zmian w kodzie (nowe CVE w starych zależnościach) | `schedule` w `security.yml` (poniedziałki 05:00 UTC) | historia runów workflow `security` |
| Automatyczne aktualizacje zależności `npm`, obrazów `docker` i akcji GitHub | `.github/dependabot.yml` (co tydzień, minor/patch w grupach) | zakładka Pull requests, autor `dependabot` |
| Akcje CI przypięte do SHA commita (ochrona przed podmianą tagu) | `uses: …@<sha> # vX.Y.Z` w `security.yml` | plik workflow; Dependabot podbija SHA razem z komentarzem |
| Minimalne uprawnienia tokenu CI | `permissions: contents: read`, `security-events: write` tylko w jobie Trivy | plik workflow |
| Rejestr podatności bez poprawki z oceną wpływu i decyzją | `docs/security/podatnosci.md` w każdym repo | plik w repo |
| Utwardzony obraz runtime | backend: bez npm/npx/corepack, użytkownik `node`; frontend: nginx jako użytkownik `nginx`; oba: `apk upgrade` | `Dockerfile` w każdym repo |

SBOM z ostatniego runu na `main`:
[backend](https://github.com/carrotly-technologies/hacknation-backend/actions/workflows/security.yml?query=branch%3Amain),
[frontend](https://github.com/carrotly-technologies/hacknation-frontend/actions/workflows/security.yml?query=branch%3Amain)
(najnowszy run → sekcja Artifacts → `sbom.cdx.json`). Artefakty GitHub Actions są przechowywane
90 dni; cotygodniowy run sprawia, że zawsze jest aktualny SBOM.

## Mapowanie na CRA (załącznik I)

| Wymaganie | Co je realizuje | Status |
|---|---|---|
| Cz. I pkt 2 lit. a: produkt bez znanych podatności, które można wykorzystać | Trivy `fs` + `image` na każdym PR i co tydzień, blokada HIGH/CRITICAL z poprawką | wdrożone |
| Cz. I pkt 2 lit. c: usuwanie podatności przez aktualizacje bezpieczeństwa | Dependabot, obraz Docker jako jedyny artefakt wdrożenia (aktualizacja = nowy obraz) | wdrożone |
| Cz. I pkt 2 lit. j: ograniczenie powierzchni ataku | obraz runtime bez narzędzi deweloperskich i npm, procesy bez roota | wdrożone |
| Cz. II pkt 1: identyfikacja i dokumentowanie komponentów i podatności, w tym SBOM w powszechnie używanym, czytelnym maszynowo formacie | SBOM CycloneDX w każdym runie, `podatnosci.md` | wdrożone |
| Cz. II pkt 2: usuwanie podatności bez zbędnej zwłoki, w tym przez aktualizacje bezpieczeństwa | blokada merge, Dependabot, cotygodniowy skan | wdrożone |
| Cz. II pkt 3: regularne testy i przeglądy bezpieczeństwa | automatyczny skan przy każdej zmianie i co tydzień | wdrożone (bez testów penetracyjnych) |
| Cz. II pkt 4: publiczne ujawnianie usuniętych podatności | sekcja „Naprawione” w `podatnosci.md` | częściowo (bez osobnych biuletynów) |
| Cz. II pkt 5 i 6: polityka skoordynowanego ujawniania podatności (CVD) i adres kontaktowy | – | brak: do dodania `SECURITY.md` z kontaktem |
| Cz. II pkt 7 i 8: bezpieczna i bezpłatna dystrybucja poprawek | obraz budowany z repo przez CI, kod źródłowy i aktualizacje bez opłat | wdrożone (bez podpisu obrazu) |
| Art. 14: zgłaszanie aktywnie wykorzystywanych podatności (CSIRT/ENISA, 24 h) | – | proces organizacyjny, poza repo |

## Mapowanie na NIS2 (art. 21 ust. 2)

| Środek | Co go realizuje | Status |
|---|---|---|
| Lit. d: bezpieczeństwo łańcucha dostaw | SBOM (urząd wie, z czego składa się aplikacja), przypięte akcje CI, tylko licencje permisywne (`AGENTS.md`), lockfile i `npm ci` | wdrożone |
| Lit. e: bezpieczeństwo pozyskiwania, rozwijania i utrzymania systemów, w tym obsługa i ujawnianie podatności | Trivy z blokadą merge, Dependabot, rejestr `podatnosci.md` | wdrożone (bez CVD, jak wyżej) |
| Lit. f: ocena skuteczności środków | historia runów `security`, alerty w Code scanning (otwarte/zamknięte) | wdrożone |
| Lit. g: cyberhigiena | aktualne obrazy bazowe, minimalne uprawnienia tokenu CI, procesy bez roota | wdrożone |

## Poza zakresem

- Podpisywanie obrazów (cosign) i SLSA provenance.
- Zmiana procesu wdrożenia na Coolify (obraz budowany z `Dockerfile` jak dotąd).
- Polityka CVD (`SECURITY.md`) i proces zgłoszeń z art. 14 CRA: decyzja organizacyjna, osobne zadanie.
