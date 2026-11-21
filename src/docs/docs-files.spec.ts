import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentType, DOCS_DIR, resolveDocFile } from './docs-files.js';

describe('resolveDocFile', () => {
  it('resolves a file in docs/', () => {
    expect(
      resolveDocFile('ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf'),
    ).toBe(
      join(DOCS_DIR, 'ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf'),
    );
  });

  it.each([
    '../package.json',
    'ocena-okresowa/../../package.json',
    'ocena-okresowa/../README.md',
    '/etc/passwd',
    '..\\package.json',
    '.hidden',
    'ocena-okresowa',
    'missing.pdf',
    'a\0b',
    '',
  ])('refuses %j', (rel) => {
    expect(resolveDocFile(rel)).toBeNull();
  });

  it('refuses a symlink that points outside', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'docs-')));
    const outside = mkdtempSync(join(tmpdir(), 'outside-'));
    writeFileSync(join(outside, 'secret.txt'), 'x');
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'ok.txt'), 'x');
    symlinkSync(join(outside, 'secret.txt'), join(root, 'link.txt'));
    expect(resolveDocFile('sub/ok.txt', root)).toBe(
      join(root, 'sub', 'ok.txt'),
    );
    expect(resolveDocFile('link.txt', root)).toBeNull();
  });
});

describe('contentType', () => {
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.PNG', 'image/png'],
    [
      'a.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['a.bin', 'application/octet-stream'],
  ])('%s -> %s', (file, type) => {
    expect(contentType(file)).toBe(type);
  });
});
