import { addDays } from '../cases/dates.js';
import { USER_SEED } from '../auth/users.seed.js';
import { SUPERVISOR_ID } from '../cases/seed/seed.data.js';
import type { JournalNote, JournalObservation } from './journal.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The demo supervisor's account (author of the seeded entries). */
const AUTHOR_ID = USER_SEED.find((u) => u.evaluatorId === SUPERVISOR_ID)!.id;

/**
 * Demo journal of the fictional supervisor (people from her cases in
 * src/cases/seed/). Timestamps are days before `now`, so entries added later
 * are listed first.
 */
export function buildJournalSeed(
  today: string,
  now: Date = new Date(),
): { notes: JournalNote[]; observations: JournalObservation[] } {
  const at = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
  const notes: JournalNote[] = [
    {
      id: 'jn-seed-1',
      personId: 'p-nowak',
      authorId: AUTHOR_ID,
      text: 'Zapytać na rozmowie o szkolenie z zamówień publicznych, o które prosiła w zeszłym kwartale.',
      createdAt: at(20),
      updatedAt: at(20),
    },
    {
      id: 'jn-seed-2',
      personId: 'p-wojcik',
      authorId: AUTHOR_ID,
      text: 'Przejął sprawy kolegi na czas urlopu bez opóźnień w terminach.',
      createdAt: at(9),
      updatedAt: at(9),
    },
  ];
  const observations: JournalObservation[] = [
    {
      id: 'jo-seed-1',
      personId: 'p-nowak',
      authorId: AUTHOR_ID,
      date: addDays(today, -45),
      criterionId: 'komunikacja',
      indicatorId: 'komunikacja.1',
      kind: 'STRENGTH',
      situation: 'Spotkanie z interesantami w sprawie zmiany procedury.',
      action: 'Wyjaśniła zmiany prostym językiem i przygotowała krótką ściągę.',
      result:
        'Liczba pytań telefonicznych w kolejnym tygodniu wyraźnie spadła.',
      createdAt: at(44),
      updatedAt: at(44),
    },
    {
      id: 'jo-seed-2',
      personId: 'p-wojcik',
      authorId: AUTHOR_ID,
      date: addDays(today, -12),
      criterionId: 'rzetelnosc',
      indicatorId: null,
      kind: 'DEVELOPMENT',
      situation: 'Zestawienie miesięczne do dyrektora.',
      action: 'Oddał zestawienie w terminie, ale bez sprawdzenia sum.',
      result: 'Dwie pozycje trzeba było poprawić przed wysłaniem.',
      createdAt: at(11),
      updatedAt: at(11),
    },
  ];
  return { notes, observations };
}
