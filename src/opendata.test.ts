import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pickYearAssets,
  resourceFingerprint,
  yearFromResourceTitle,
  yearsDueForRefresh,
  type ImpicResource,
} from './opendata.js';

const zip = (year: number, extra: Partial<ImpicResource> = {}): ImpicResource => ({
  title: `contratos${year}.zip`,
  url: `https://example.test/${year}.zip`,
  filesize: 10_000,
  last_modified: '2026-09-06T09:00:00Z',
  checksum: { type: 'sha1', value: `abc${year}` },
  ...extra,
});

test('yearFromResourceTitle lê o ano do ficheiro IMPIC', () => {
  assert.equal(yearFromResourceTitle('contratos2026.zip'), 2026);
  assert.equal(yearFromResourceTitle('contratos2025.xlsx'), 2025);
  assert.equal(yearFromResourceTitle('readme.txt'), null);
});

test('resourceFingerprint prefere o sha1 do dados.gov.pt', () => {
  assert.equal(resourceFingerprint(zip(2026)), 'sha1:abc2026');
  assert.equal(
    resourceFingerprint({
      title: 'contratos2026.zip',
      url: 'https://x',
      filesize: 12,
      last_modified: '2026-09-01T00:00:00Z',
    }),
    'meta:12:2026-09-01T00:00:00Z',
  );
});

test('yearsDueForRefresh só olha para o ano corrente e o anterior', () => {
  const resources = [zip(2024), zip(2025), zip(2026)];
  const due = yearsDueForRefresh(resources, [], 2026);
  assert.deepEqual(due.map((d) => d.year), [2026, 2025]);
});

test('yearsDueForRefresh ignora anos cujo checksum já foi importado', () => {
  const resources = [zip(2025), zip(2026)];
  const due = yearsDueForRefresh(
    resources,
    [
      { year: 2026, source_checksum: 'sha1:abc2026' },
      { year: 2025, source_checksum: 'sha1:old' },
    ],
    2026,
  );
  assert.deepEqual(due.map((d) => d.year), [2025]);
});

test('yearsDueForRefresh trata import antigo sem checksum como desactualizado', () => {
  const due = yearsDueForRefresh(
    [zip(2026)],
    [{ year: 2026, source_checksum: null }],
    2026,
  );
  assert.equal(due.length, 1);
  assert.equal(due[0].year, 2026);
});

test('pickYearAssets prefere o zip ao xlsx', () => {
  const assets = pickYearAssets(
    [
      { title: 'contratos2026.xlsx', url: 'https://x.xlsx', filesize: 20_000, checksum: { value: 'x' } },
      zip(2026),
    ],
    2026,
  );
  assert.match(assets.zip ?? '', /\.zip$/);
  assert.equal(assets.fingerprint, 'sha1:abc2026');
});
