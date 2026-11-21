import type { User } from './user.types.js';

/**
 * Demo accounts (fictional people). Every password is `Kompas2026!` (see
 * README); hashes are scrypt from `node scripts/hash-password.mjs <password>`.
 * Supervisors are linked to EVALUATORS in src/cases/seed/seed.data.ts.
 */
export const USER_SEED: readonly (User & { passwordHash: string })[] = [
  {
    id: 'u-kaminska',
    login: 'j.kaminska',
    firstName: 'Joanna',
    lastName: 'Kamińska',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: 'ev-kaminska',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$muCUlBLCt06LxcoiuAUJOA$iCkYIK9Mn+/nXMxyhfvS/n+cGi2bb/xX3fF2fM75L9E',
  },
  {
    id: 'u-sikora',
    login: 'r.sikora',
    firstName: 'Robert',
    lastName: 'Sikora',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
    evaluatorId: 'ev-sikora',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$MSpHBp94rpSu/maQVuJQ3g$0sMx7F0dMorcvQLk/wFGRCBiU573x+Z35j9aqKMp5mY',
  },
  {
    id: 'u-pawlak',
    login: 'a.pawlak',
    firstName: 'Agnieszka',
    lastName: 'Pawlak',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Legislacji, Departament Prawny',
    evaluatorId: 'ev-pawlak',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$WSDKoFIVqLBuRVhi24CqlA$hZdea8jTqKwU848ffQjta4iaGY+WCD2hPpsHB+x4yjE',
  },
  {
    id: 'u-lis',
    login: 'a.lis',
    firstName: 'Agnieszka',
    lastName: 'Lis',
    role: 'HR',
    position: 'Specjalistka ds. kadr',
    unit: 'Biuro Dyrektora Generalnego, Wydział Kadr',
    evaluatorId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$wXT7igtTbLTi4gLon4aZdw$TMy/xSIkZ9bCJ+rD0gzGVG0csp9LXiunCn3QjmBIujU',
  },
  {
    id: 'u-admin',
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
