import {
  canonicalJson,
  GENESIS_HASH,
  hashEntry,
  sealEntry,
  verifyEntries,
} from './audit-chain.js';
import type { AuditDraft } from './audit.types.js';

const draft = (id: string): AuditDraft => ({
  id,
  at: '2026-11-21T10:00:00.000Z',
  actorId: 'u-admin',
  actorRole: 'ADMIN',
  action: 'USER_ROLE_CHANGED',
  resourceType: 'USER',
  resourceId: 'u-lis',
  changedFields: ['role'],
  ip: '10.0.0.1',
  result: 'OK',
});

describe('audit chain', () => {
  it('canonical JSON sorts keys at every level', () => {
    expect(
      canonicalJson({ b: 1, a: { d: [2, { f: 1, e: null }], c: 'x' } }),
    ).toBe('{"a":{"c":"x","d":[2,{"e":null,"f":1}]},"b":1}');
  });

  it('seals the first entry on the genesis hash and the next on its predecessor', () => {
    const a = sealEntry(draft('a'), null);
    const b = sealEntry(draft('b'), a);
    expect(a).toMatchObject({ seq: 1, prevHash: GENESIS_HASH });
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatchObject({ seq: 2, prevHash: a.hash });
    expect(hashEntry(b)).toBe(b.hash);
  });

  it('detects a changed field, a removed entry and a forged hash', () => {
    const a = sealEntry(draft('a'), null);
    const b = sealEntry(draft('b'), a);
    const c = sealEntry(draft('c'), b);
    expect(verifyEntries([a, b, c], null)).toEqual({
      tip: { seq: 3, hash: c.hash },
    });
    expect(verifyEntries([a, { ...b, result: 'DENIED' }, c], null)).toEqual({
      brokenId: 'b',
      validBefore: 1,
    });
    expect(verifyEntries([a, c], null)).toEqual({
      brokenId: 'c',
      validBefore: 1,
    });
    const forged = { ...b, ip: null };
    expect(
      verifyEntries([a, { ...forged, hash: hashEntry(forged) }, c], null),
    ).toEqual({ brokenId: 'c', validBefore: 2 });
  });

  it('continues from a tip (page by page)', () => {
    const a = sealEntry(draft('a'), null);
    const b = sealEntry(draft('b'), a);
    expect(verifyEntries([b], { seq: 1, hash: a.hash })).toEqual({
      tip: { seq: 2, hash: b.hash },
    });
  });
});
