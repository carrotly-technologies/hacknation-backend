import { docsUrl } from '../docs/docs-files.js';
import type { KnowledgeChunk, KnowledgeDocId } from './knowledge.types.js';

/** Official consolidated text of the civil service act in ISAP (Sejm). */
export const CIVIL_SERVICE_ACT_ISAP_URL =
  'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20082271505';

export const NO_SOURCE_FILE = 'brak pliku źródłowego';

export interface SourceDocument {
  /** A KnowledgeDocId for the documents the assistant answers from. */
  id: string;
  title: string;
  /** Path in docs/, or null when the document is not in the repo. */
  file: string | null;
  /** Where to open it when there is no file in docs/. */
  externalUrl?: string;
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
    file: null,
    externalUrl: CIVIL_SERVICE_ACT_ISAP_URL,
    indexed: true,
    note: 'oficjalny tekst w ISAP (sejm.gov.pl)',
  },
  {
    id: 'RO',
    title:
      'Rozporządzenie PRM z 4 kwietnia 2016 r. w sprawie ocen okresowych (Dz.U. poz. 470)',
    file: 'ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf',
    indexed: true,
  },
  {
    id: 'PO',
    title: 'Poradnik KPRM „Oceny okresowe w służbie cywilnej”',
    file: 'ocena-okresowa/poradnik-oceny-okresowe.pdf',
    indexed: true,
  },
  {
    id: 'AB',
    title: 'Arkusz B oceny okresowej (stanowiska kierujące pracownikami)',
    file: 'ocena-okresowa/arkusz-oceny-b.docx',
    indexed: true,
  },
  {
    id: 'AC',
    title: 'Arkusz C oceny okresowej (pozostałe stanowiska)',
    file: 'ocena-okresowa/arkusz-oceny-c.docx',
    indexed: true,
  },
  {
    id: 'RP',
    title:
      'Rozporządzenie PRM z 23 lipca 2015 r. w sprawie pierwszej oceny (Dz.U. poz. 1144)',
    file: 'pierwsza-ocena/rozporzadzenie-pierwsza-ocena-2015.pdf',
    indexed: true,
  },
  {
    id: 'PP',
    title: 'Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (2016)',
    file: 'pierwsza-ocena/poradnik-pierwsza-ocena-2016.pdf',
    indexed: true,
  },
  {
    id: 'AP',
    title: 'Arkusz pierwszej oceny w służbie cywilnej',
    file: 'pierwsza-ocena/arkusz-pierwszej-oceny.docx',
    indexed: true,
  },
  {
    id: 'MK',
    title: 'Model kompetencji (14 kompetencji, 49 wskaźników, 5 poziomów)',
    file: 'model-kompetencji/model-kompetencji.xlsx',
    indexed: true,
  },
  {
    id: 'LT',
    title: 'Zasady obliczania terminów stosowane przy dokonywaniu ocen',
    file: null,
    indexed: true,
    note: NO_SOURCE_FILE,
  },
  {
    id: 'QA',
    title: 'Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej',
    file: null,
    indexed: true,
    note: NO_SOURCE_FILE,
  },
  {
    id: 'wykaz-kryteriow',
    title:
      'Wykaz kryteriów oceny (zał. nr 1 do rozporządzenia w sprawie ocen okresowych)',
    file: 'model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf',
    indexed: false,
    note: 'treść w bazie jako załącznik rozporządzenia z 2016 r.',
  },
  {
    id: 'sciezki-oceny',
    title: 'Kompas Kompetencji: ścieżki oceny (grafika koncepcyjna)',
    file: 'model-kompetencji/kompas-kompetencji-sciezki-oceny.png',
    indexed: false,
  },
  {
    id: 'osp-starszy-specjalista',
    title:
      'Przykładowy OSP: starszy specjalista, Departament Cyberbezpieczeństwa',
    file: 'opisy-stanowisk/osp-dc-wzksoic-6-starszy-specjalista.docx',
    indexed: false,
  },
  {
    id: 'osp-radca',
    title:
      'Przykładowy OSP: radca, Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji',
    file: 'opisy-stanowisk/osp-dsi-wwi-5-radca.docx',
    indexed: false,
  },
  {
    id: 'osp-naczelnik',
    title:
      'Przykładowy OSP: naczelnik wydziału, Departament Współpracy Międzynarodowej',
    file: 'opisy-stanowisk/osp-dwm-wkam-1-naczelnik-wydzialu.docx',
    indexed: false,
  },
  {
    id: 'opis-zadania',
    title: 'Opis zadania „Kompas Kompetencji” (HackNation 2026)',
    file: 'zadanie/opis-zadania-kompas-kompetencji.pdf',
    indexed: false,
  },
  {
    id: 'regulamin',
    title: 'Regulamin zadania',
    file: 'zadanie/regulamin-zadania.pdf',
    indexed: false,
  },
];

const byId = new Map(SOURCE_DOCUMENTS.map((d) => [d.id, d]));

/** Where a document opens: its file in docs/, an official page, or nowhere. */
export function documentUrl(doc: SourceDocument): string | null {
  if (doc.file) return docsUrl(doc.file);
  return doc.externalUrl ?? null;
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
  url: string | null;
  indexed: boolean;
  note: string | null;
}

export const listDocuments = (): DocumentListItem[] =>
  SOURCE_DOCUMENTS.map((d) => ({
    id: d.id,
    title: d.title,
    url: documentUrl(d),
    indexed: d.indexed,
    note: d.note ?? null,
  }));

/** Ids of the knowledge-base documents, for checks. */
export const INDEXED_DOCUMENT_IDS = SOURCE_DOCUMENTS.filter(
  (d) => d.indexed,
).map((d) => d.id as KnowledgeDocId);
