import { docsUrl } from '../docs/docs-files.js';
import type { KnowledgeChunk, KnowledgeDocId } from './knowledge.types.js';

export const NO_SOURCE_FILE = 'brak pliku źródłowego';

export interface SourceDocument {
  /** A KnowledgeDocId for the documents the assistant answers from. */
  id: string;
  title: string;
  /** One line under the title: what the document covers. */
  description: string;
  /** Path in docs/, or null when the document is not in the repo. */
  file: string | null;
  /** Whether the assistant answers from it (it is in the knowledge base). */
  indexed: boolean;
  note?: string;
}

/** Every document of docs/ plus the knowledge-base documents not in it. */
export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: 'U',
    title:
      'Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (tekst jednolity)',
    description:
      'art. 35–38 (pierwsza ocena), art. 81–83 (ocena okresowa, sprzeciw), art. 89, art. 108',
    file: 'akty-prawne/ustawa-o-sluzbie-cywilnej.pdf',
    indexed: true,
    note: 'tekst ujednolicony z ISAP (sejm.gov.pl), na podstawie t.j. Dz.U. z 2026 r. poz. 590',
  },
  {
    id: 'SZ',
    title:
      'Standardy zarządzania zasobami ludzkimi w służbie cywilnej (zarządzenie nr 6 Szefa Służby Cywilnej z 12 marca 2020 r.)',
    description:
      'organizacja zarządzania ludźmi, nabór, motywowanie, rozwój i szkolenia (IPRZ, plan szkoleń), informacja zwrotna',
    file: 'akty-prawne/standardy-zzl.pdf',
    indexed: true,
    note: 'cz. III pkt 1 w bazie w brzmieniu zarządzenia nr 7 z 16 grudnia 2020 r.',
  },
  {
    id: 'standardy-zzl-zmiana',
    title:
      'Zarządzenie nr 7 Szefa Służby Cywilnej z 16 grudnia 2020 r. zmieniające standardy ZZL',
    description:
      'nowe brzmienie cz. III pkt 1: obsadzanie stanowisk, na których kieruje się pracownikami',
    file: 'akty-prawne/standardy-zzl-zmiana-2020.pdf',
    indexed: false,
    note: 'treść w bazie jako część standardów ZZL',
  },
  {
    id: 'RO',
    title:
      'Rozporządzenie PRM z 4 kwietnia 2016 r. w sprawie ocen okresowych (Dz.U. poz. 470)',
    description:
      'warunki i sposób przeprowadzania ocen okresowych (Dz.U. poz. 470), wzory arkuszy A, B, C',
    file: 'ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf',
    indexed: true,
  },
  {
    id: 'PO',
    title: 'Poradnik KPRM „Oceny okresowe w służbie cywilnej”',
    description: 'ocena okresowa: interpretacje i przykłady',
    file: 'ocena-okresowa/poradnik-oceny-okresowe.pdf',
    indexed: true,
  },
  {
    id: 'AB',
    title: 'Arkusz B oceny okresowej (stanowiska kierujące pracownikami)',
    description: 'wzór arkusza dla osób kierujących zespołem',
    file: 'ocena-okresowa/arkusz-oceny-b.docx',
    indexed: true,
  },
  {
    id: 'AC',
    title: 'Arkusz C oceny okresowej (pozostałe stanowiska)',
    description: 'wzór arkusza dla pozostałych członków korpusu',
    file: 'ocena-okresowa/arkusz-oceny-c.docx',
    indexed: true,
  },
  {
    id: 'RP',
    title:
      'Rozporządzenie PRM z 23 lipca 2015 r. w sprawie pierwszej oceny (Dz.U. poz. 1144)',
    description:
      'pierwsza ocena w służbie cywilnej (Dz.U. poz. 1144), arkusz i sprawozdanie',
    file: 'pierwsza-ocena/rozporzadzenie-pierwsza-ocena-2015.pdf',
    indexed: true,
  },
  {
    id: 'PP',
    title: 'Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (2016)',
    description: 'pierwsza ocena: interpretacje i przykłady',
    file: 'pierwsza-ocena/poradnik-pierwsza-ocena-2016.pdf',
    indexed: true,
  },
  {
    id: 'AP',
    title: 'Arkusz pierwszej oceny w służbie cywilnej',
    description: 'wzór arkusza pierwszej oceny',
    file: 'pierwsza-ocena/arkusz-pierwszej-oceny.docx',
    indexed: true,
  },
  {
    id: 'MK',
    title: 'Model kompetencji (14 kompetencji, 49 wskaźników, 5 poziomów)',
    description: '14 kompetencji, 49 wskaźników behawioralnych, 5 poziomów',
    file: 'model-kompetencji/model-kompetencji.xlsx',
    indexed: true,
  },
  {
    id: 'LT',
    title: 'Zasady obliczania terminów stosowane przy dokonywaniu ocen',
    description: 'jak liczyć terminy w procedurze ocen',
    file: null,
    indexed: true,
    note: NO_SOURCE_FILE,
  },
  {
    id: 'QA',
    title: 'Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej',
    description: 'zestaw przygotowany przez zespół do weryfikacji asystenta',
    file: null,
    indexed: true,
    note: NO_SOURCE_FILE,
  },
  {
    id: 'wykaz-kryteriow',
    title:
      'Wykaz kryteriów oceny (zał. nr 1 do rozporządzenia w sprawie ocen okresowych)',
    description: 'kryteria obowiązkowe i do wyboru dla arkuszy A, B, C',
    file: 'model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf',
    indexed: false,
    note: 'treść w bazie jako załącznik rozporządzenia z 2016 r.',
  },
  {
    id: 'sciezki-oceny',
    title: 'Kompas Kompetencji: ścieżki oceny (grafika koncepcyjna)',
    description: 'jak model kompetencji łączy się z oceną okresową',
    file: 'model-kompetencji/kompas-kompetencji-sciezki-oceny.png',
    indexed: false,
  },
  {
    id: 'osp-starszy-specjalista',
    title:
      'Przykładowy OSP: starszy specjalista, Departament Cyberbezpieczeństwa',
    description: 'przykład opisu stanowiska pracy z wymaganiami',
    file: 'opisy-stanowisk/osp-dc-wzksoic-6-starszy-specjalista.docx',
    indexed: false,
  },
  {
    id: 'osp-radca',
    title:
      'Przykładowy OSP: radca, Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji',
    description: 'przykład opisu stanowiska pracy z wymaganiami',
    file: 'opisy-stanowisk/osp-dsi-wwi-5-radca.docx',
    indexed: false,
  },
  {
    id: 'osp-naczelnik',
    title:
      'Przykładowy OSP: naczelnik wydziału, Departament Współpracy Międzynarodowej',
    description: 'przykład opisu stanowiska kierowniczego z wymaganiami',
    file: 'opisy-stanowisk/osp-dwm-wkam-1-naczelnik-wydzialu.docx',
    indexed: false,
  },
  {
    id: 'opis-zadania',
    title: 'Opis zadania „Kompas Kompetencji” (HackNation 2026)',
    description:
      'wymagania zadania hackathonu, na których opiera się aplikacja',
    file: 'zadanie/opis-zadania-kompas-kompetencji.pdf',
    indexed: false,
  },
  {
    id: 'regulamin',
    title: 'Regulamin zadania',
    description: 'zasady zadania hackathonu',
    file: 'zadanie/regulamin-zadania.pdf',
    indexed: false,
  },
];

const byId = new Map(SOURCE_DOCUMENTS.map((d) => [d.id, d]));

/** Where a document opens: its file in docs/, or nowhere. */
export function documentUrl(doc: SourceDocument): string | null {
  return doc.file ? docsUrl(doc.file) : null;
}

/** The link of a knowledge-base excerpt, on its page for a local PDF. */
export function chunkUrl(chunk: KnowledgeChunk): string | null {
  const doc = byId.get(chunk.doc);
  if (!doc) return null;
  const url = documentUrl(doc);
  if (url && doc.file?.endsWith('.pdf') && chunk.page) {
    return `${url}#page=${chunk.page}`;
  }
  return url;
}

export interface DocumentListItem {
  id: string;
  title: string;
  description: string;
  url: string | null;
  indexed: boolean;
  note: string | null;
}

/** Every source document with its link (GET /api/docs). */
export const listDocuments = (): DocumentListItem[] =>
  SOURCE_DOCUMENTS.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    url: documentUrl(d),
    indexed: d.indexed,
    note: d.note ?? null,
  }));

/** Ids of the knowledge-base documents, for checks. */
export const INDEXED_DOCUMENT_IDS = SOURCE_DOCUMENTS.filter(
  (d) => d.indexed,
).map((d) => d.id as KnowledgeDocId);
