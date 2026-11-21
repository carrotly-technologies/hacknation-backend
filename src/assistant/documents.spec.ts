import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_DIR } from '../docs/docs-files.js';
import { KNOWLEDGE_CHUNKS } from './data/knowledge.data.js';
import {
  chunkUrl,
  CIVIL_SERVICE_ACT_ISAP_URL,
  INDEXED_DOCUMENT_IDS,
  listDocuments,
  NO_SOURCE_FILE,
  SOURCE_DOCUMENTS,
} from './documents.js';
import type { KnowledgeChunk } from './knowledge.types.js';

const chunk = (doc: string, page?: number) =>
  ({ id: 'x', doc, title: '', ref: '', text: '', page }) as KnowledgeChunk;

describe('source documents', () => {
  it('points every file at an existing file in docs/', () => {
    for (const d of SOURCE_DOCUMENTS.filter((d) => d.file)) {
      expect(existsSync(join(DOCS_DIR, d.file!)), d.file!).toBe(true);
    }
  });

  it('lists every original in docs/ (not the text versions)', () => {
    const files = new Set(SOURCE_DOCUMENTS.map((d) => d.file));
    for (const f of [
      'zadanie/opis-zadania-kompas-kompetencji.pdf',
      'zadanie/regulamin-zadania.pdf',
      'opisy-stanowisk/osp-dsi-wwi-5-radca.docx',
      'model-kompetencji/model-kompetencji.xlsx',
    ]) {
      expect(files.has(f)).toBe(true);
    }
  });

  it('has an entry for every document of the knowledge base', () => {
    const docs = new Set(KNOWLEDGE_CHUNKS.map((c) => c.doc));
    expect([...docs].sort()).toEqual([...INDEXED_DOCUMENT_IDS].sort());
  });

  it('links PDF excerpts to their page', () => {
    expect(chunkUrl(chunk('RO', 2))).toBe(
      '/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf#page=2',
    );
    expect(chunkUrl(chunk('MK'))).toBe(
      '/api/docs/model-kompetencji/model-kompetencji.xlsx',
    );
    expect(chunkUrl(chunk('AC'))).toBe(
      '/api/docs/ocena-okresowa/arkusz-oceny-c.docx',
    );
  });

  it('links the act to ISAP and leaves documents without a file unlinked', () => {
    expect(chunkUrl(chunk('U', 39))).toBe(CIVIL_SERVICE_ACT_ISAP_URL);
    expect(chunkUrl(chunk('QA'))).toBeNull();
    const lt = listDocuments().find((d) => d.id === 'LT');
    expect(lt).toMatchObject({
      url: null,
      indexed: true,
      note: NO_SOURCE_FILE,
    });
  });

  it('marks the hackathon materials and sample OSPs as not indexed', () => {
    const notIndexed = listDocuments()
      .filter((d) => !d.indexed)
      .map((d) => d.id);
    expect(notIndexed).toEqual(
      expect.arrayContaining(['opis-zadania', 'regulamin', 'osp-radca']),
    );
  });
});
