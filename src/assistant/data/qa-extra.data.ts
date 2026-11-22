// Hand-written additions to the team's Q&A set (doc QA), kept apart from the
// generated knowledge.data.ts so that `npm run kb:build` does not drop them.
// Answers restate the cited provisions; the provisions themselves stay the
// source of truth (docs/).
import type { KnowledgeChunk } from '../knowledge.types.js';

const TITLE = 'Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej';

const qa = (
  no: number,
  type: string,
  question: string,
  answer: string,
  source: string,
  sourceText: string,
): KnowledgeChunk => ({
  id: `QA-${no}`,
  doc: 'QA',
  title: TITLE,
  ref: `Zestaw Q&A, pyt. ${no}`,
  text: `Pytanie: ${question}\nOdpowiedź: ${answer}\nŹródło: ${sourceText}`,
  qa: { no, type, question, source },
});

export const QA_EXTRA_CHUNKS: KnowledgeChunk[] = [
  qa(
    73,
    'F',
    'Ile kryteriów obowiązkowych ma arkusz A, arkusz B i arkusz C?',
    'Arkusz C (stanowiska bez kierowania pracownikami) ma 5 kryteriów obowiązkowych: wykorzystywanie wiedzy i doskonalenie zawodowe; rzetelność; organizacja pracy i orientacja na osiąganie celów; współpraca; komunikacja. Arkusz B (bezpośrednie kierowanie pracownikami) ma 5 kryteriów obowiązkowych: zarządzanie ludźmi; podejmowanie decyzji i odpowiedzialność; organizacja pracy i orientacja na osiąganie celów; współpraca; komunikacja. Arkusz A (kierownik urzędu) ma 6 kryteriów obowiązkowych: te same co B oraz zarządzanie strategiczne. Do każdego arkusza oceniający może dodać nie więcej niż 3 kryteria dodatkowe.',
    '[RO] § 4 ust. 1–3, § 5 ust. 2 (Dz.U. s. 1–2).',
    'rozporządzenie o ocenach okresowych 2016: § 4 ust. 1–3, § 5 ust. 2 (Dz.U. s. 1–2).',
  ),
  qa(
    74,
    'F',
    'Kiedy ocena okresowa jest pozytywna, a kiedy negatywna?',
    'Pozytywna: ogólny poziom spełniania kryteriów (średnia arytmetyczna ocen cząstkowych) wynosi powyżej 4 punktów, czyli „na poziomie oczekiwań” lub wyżej, i żadna ocena cząstkowa nie jest „znacznie poniżej oczekiwań” (1 punkt). Negatywna: średnia do 4 punktów włącznie („poniżej oczekiwań” albo „znacznie poniżej oczekiwań”) albo co najmniej jedna ocena cząstkowa „znacznie poniżej oczekiwań”, bez względu na średnią. Przy ocenie negatywnej uzasadnienie jest obowiązkowe.',
    '[RO] § 11 ust. 1 pkt 2–4, ust. 3 (Dz.U. s. 3); [PO] s. 27.',
    'rozporządzenie o ocenach okresowych 2016: § 11 ust. 1 pkt 2–4, ust. 3 (Dz.U. s. 3); poradnik o ocenach okresowych: s. 27.',
  ),
  qa(
    75,
    'T',
    'W jakim terminie i do kogo wnosi się sprzeciw od oceny okresowej?',
    'Sprzeciw wnosi się w terminie 7 dni od dnia zapoznania się z oceną, do dyrektora generalnego urzędu. Sprzeciw rozpatruje się w terminie 14 dni od dnia wniesienia. Gdy sprzeciw nie zostanie rozpatrzony w terminie albo nie zostanie uwzględniony, oceniany może w terminie 14 dni odwołać się do sądu pracy.',
    '[U] art. 83 ust. 1, 3, 5 (s. 40/71).',
    'ustawa o służbie cywilnej: art. 83 ust. 1, 3, 5 (s. 40/71).',
  ),
];

/**
 * Other phrasings of Q&A questions (by number), indexed with the question so
 * that the entry is found however the question is put. Only the question
 * index sees them; answers are unchanged.
 */
export const QA_ALIASES: Record<number, string[]> = {
  1: ['Kto dokonuje oceny okresowej i kto ocenia pracownika?'],
  4: ['Co ile miesięcy sporządza się ocenę okresową?'],
  7: [
    'Do kogo stosuje się arkusz A, arkusz B i arkusz C?',
    'Który arkusz oceny okresowej dla jakiego stanowiska?',
  ],
  11: ['Ile kryteriów dodatkowych może wybrać oceniający?'],
  14: ['Kiedy przeprowadza się rozmowę rozpoczynającą okres oceny?'],
  22: ['Jaka skala punktowa obowiązuje w ocenie okresowej?'],
  28: ['Co to jest IPRZ, indywidualny program rozwoju zawodowego?'],
  75: [
    'Ile dni ma oceniany na sprzeciw od oceny okresowej?',
    'Ile dni ma pracownik na złożenie sprzeciwu i do kogo się go składa?',
    'W jakim terminie przysługuje sprzeciw od oceny okresowej?',
  ],
  51: ['Kiedy urzędnik dostaje wyższy stopień służbowy?'],
  57: [
    'W jakim terminie dokonuje się pierwszej oceny w służbie cywilnej?',
    'Kiedy najwcześniej i najpóźniej można dokonać pierwszej oceny?',
  ],
  74: ['Kiedy przyznaje się ocenie okresowej wynik negatywny albo pozytywny?'],
};
