import type { User } from './user.types.js';

/**
 * Demo accounts (fictional people). Every password is `Kompas2026!` (see
 * README); hashes are scrypt from `node scripts/hash-password.mjs <password>`.
 * PESELs are made up (valid check digit) for the simulated login.gov.pl
 * sign-in; they never leave the repository through the API.
 * Supervisors are linked to EVALUATORS in src/cases/seed/seed.data.ts.
 */
export const USER_SEED: readonly (Omit<User, 'tokenVersion'> & {
  passwordHash: string;
  pesel: string;
})[] = [
  {
    id: 'u-kaminska',
    pesel: '78031504123',
    login: 'k.wisniewska',
    firstName: 'Karolina',
    lastName: 'Wiśniewska',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: 'ev-kaminska',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$muCUlBLCt06LxcoiuAUJOA$iCkYIK9Mn+/nXMxyhfvS/n+cGi2bb/xX3fF2fM75L9E',
  },
  {
    id: 'u-sikora',
    pesel: '71112205469',
    login: 'a.szymanczak',
    firstName: 'Agnieszka',
    lastName: 'Szymańczak',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
    evaluatorId: 'ev-sikora',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$MSpHBp94rpSu/maQVuJQ3g$0sMx7F0dMorcvQLk/wFGRCBiU573x+Z35j9aqKMp5mY',
  },
  {
    id: 'u-pawlak',
    pesel: '85060912483',
    login: 'j.kuchta',
    firstName: 'Jolanta',
    lastName: 'Kuchta',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Legislacji, Departament Prawny',
    evaluatorId: 'ev-pawlak',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$WSDKoFIVqLBuRVhi24CqlA$hZdea8jTqKwU848ffQjta4iaGY+WCD2hPpsHB+x4yjE',
  },
  {
    id: 'u-lis',
    pesel: '90022703645',
    login: 'a.cieslak-dyjecinska',
    firstName: 'Agata',
    lastName: 'Cieślak-Dyjecińska',
    role: 'HR',
    position: 'Specjalistka ds. kadr',
    unit: 'Biuro Dyrektora Generalnego, Wydział Kadr',
    evaluatorId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$wXT7igtTbLTi4gLon4aZdw$TMy/xSIkZ9bCJ+rD0gzGVG0csp9LXiunCn3QjmBIujU',
  },
  {
    id: 'u-admin',
    pesel: '68093017792',
    login: 'admin',
    firstName: 'Marek',
    lastName: 'Zając',
    role: 'ADMIN',
    position: 'Administrator systemu',
    unit: 'Biuro Informatyki',
    evaluatorId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$Ylmh4H6+RBr9K26THx0f1w$cQ93L1GjIs4C3XLiFgZiK9JidTxTpjYE/ES/tF7YSA0',
  },
];
