import type { User } from './user.types.js';

/**
 * Demo accounts (fictional people), picked with the account switcher
 * (`X-User-Id`, see README); no passwords. Supervisors are linked to
 * EVALUATORS in src/cases/seed/seed.data.ts.
 */
export const USER_SEED: readonly User[] = [
  {
    id: 'u-kaminska',
    login: 'j.kaminska',
    firstName: 'Joanna',
    lastName: 'Kamińska',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: 'ev-kaminska',
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
  },
];
