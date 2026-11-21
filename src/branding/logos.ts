/**
 * Ids of the 15 logo proposals the frontend shows on /logo (its SVGs live in
 * hacknation-frontend, src/branding/logos). Only these can be accepted.
 * Product decision, not a regulation.
 */
export const LOGO_IDS = [
  '01-igla-w-kole',
  '02-kafel-z-igla',
  '03-roza-wiatrow',
  '04-k-ze-strzalka',
  '05-skala-1-9',
  '06-kroki-rozwoju',
  '07-macierz-kompetencji',
  '08-otwarty-krag',
  '09-tarcza-z-igla',
  '10-plakietka-z-roza',
  '11-pinezka-kierunku',
  '12-gwiazda-polarna',
  '13-heksagon-umiejetnosci',
  '14-czlowiek-kierunek',
  '15-kompas-typograficzny',
] as const;

export type LogoId = (typeof LOGO_IDS)[number];

export function isLogoId(value: unknown): value is LogoId {
  return (
    typeof value === 'string' && (LOGO_IDS as readonly string[]).includes(value)
  );
}
