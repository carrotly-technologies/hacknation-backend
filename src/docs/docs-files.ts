import { realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, resolve, sep } from 'node:path';

/** The repo's docs/ directory: the source documents, served read-only. */
export const DOCS_DIR = resolve(import.meta.dirname, '../../docs');

/** Public path of a file in docs/, e.g. "/api/docs/ocena-okresowa/x.pdf". */
export const docsUrl = (file: string): string => `/api/docs/${file}`;

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export const contentType = (file: string): string =>
  CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

/**
 * The absolute path of a file inside `root`, or null when the path is not a
 * plain relative path to a regular file there: absolute paths, "..", hidden
 * segments, NUL bytes and symlinks pointing outside are all refused.
 */
export function resolveDocFile(rel: string, root = DOCS_DIR): string | null {
  if (!rel || rel.includes('\0') || isAbsolute(rel)) return null;
  const segments = rel.split(/[/\\]/);
  if (segments.some((s) => s === '' || s === '..' || s.startsWith('.'))) {
    return null;
  }
  try {
    const base = realpathSync(root);
    const abs = realpathSync(resolve(base, ...segments));
    if (!abs.startsWith(base + sep)) return null;
    return statSync(abs).isFile() ? abs : null;
  } catch {
    return null;
  }
}
