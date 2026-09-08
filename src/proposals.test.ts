import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGapReport,
  emptyProfile,
  flattenRequirements,
  marginWarning,
  nextVersion,
  overallGapStatus,
  parseProfileBody,
  profileMissingFields,
  summarizeGapReport,
  type GapItem,
  type RequirementsExtraction,
} from './proposals.js';

const extraction: RequirementsExtraction = {
  admissao: [{ id: 'a1', category: 'admissao', title: 'Alvará classe 4', detail: 'Obrigatório', mandatory: true }],
  tecnicos: [{ id: 't1', category: 'tecnico', title: 'ISO 9001', detail: '', mandatory: true }],
  criterios: [{ id: 'c1', title: 'Preço', weight_pct: 60, detail: 'Proposta economicamente mais vantajosa' }],
  documentos: [{ id: 'd1', category: 'documento', title: 'DEUCP', detail: 'Declaração', mandatory: true, legal: true }],
  formato: { specified: true, chapters: ['Memória descritiva', 'Preço'], page_limit: 30, notes: '' },
  prazos: { submissao: '12-09-2026', esclarecimentos: null, execucao: '12 meses' },
  legal_declarations: ['DEUCP', 'Declaração de honra'],
  notes: '',
};

test('flattenRequirements covers all categories including criteria weights', () => {
  const items = flattenRequirements(extraction);
  assert.equal(items.some((i) => i.id === 'a1'), true);
  assert.equal(items.some((i) => i.title.includes('60%')), true);
  assert.equal(items.some((i) => i.category === 'formato' && /30 páginas/.test(i.detail)), true);
  assert.equal(items.some((i) => i.category === 'prazo'), true);
});

test('overallGapStatus is missing > incomplete > conforme', () => {
  const items: GapItem[] = [
    { requirement_id: '1', title: 'A', category: 'tecnico', status: 'conforme', note: '' },
    { requirement_id: '2', title: 'B', category: 'tecnico', status: 'incompleto', note: '' },
  ];
  assert.equal(overallGapStatus(items), 'incompleto');
  items.push({ requirement_id: '3', title: 'C', category: 'admissao', status: 'em_falta', note: '' });
  assert.equal(overallGapStatus(items), 'em_falta');
  assert.equal(overallGapStatus(items.filter((i) => i.status === 'conforme')), 'conforme');
});

test('buildGapReport summary is in Portuguese', () => {
  const report = buildGapReport([
    { requirement_id: '1', title: 'A', category: 'tecnico', status: 'conforme', note: 'ok' },
    { requirement_id: '2', title: 'B', category: 'documento', status: 'em_falta', note: 'não anexado' },
  ]);
  assert.equal(report.overall, 'em_falta');
  assert.match(report.summary, /em falta/);
  assert.equal(summarizeGapReport([]), 'Proposta conforme em todos os 0 pontos da checklist.');
});

test('profileMissingFields and parseProfileBody validate NIF and margin', () => {
  assert.deepEqual(profileMissingFields(emptyProfile()), [
    'denominação social', 'NIF', 'capacidades técnicas / portefólio', 'referências de execução', 'habilitações / certidões',
  ]);
  assert.throws(() => parseProfileBody({ nif: '123' }, emptyProfile()), /NIF/);
  assert.throws(() => parseProfileBody({ min_margin_pct: 120 }, emptyProfile()), /margem/);
  const p = parseProfileBody({
    legal_name: 'Verde Lda',
    nif: '123456789',
    certifications: ['ISO 9001'],
    technical_capabilities: 'Jardinagem',
    references: [{ project: 'Parque', client: 'Câmara' }],
    min_margin_pct: 12,
  }, emptyProfile());
  assert.equal(p.nif, '123456789');
  assert.equal(p.references.length, 1);
  assert.equal(p.min_margin_pct, 12);
});

test('nextVersion increments from existing versions', () => {
  assert.equal(nextVersion([]), 1);
  assert.equal(nextVersion([1, 2, 4]), 5);
});

test('marginWarning fires when close range is below the floor', () => {
  assert.equal(marginWarning(15, 0.90), null);
  assert.match(marginWarning(15, 0.80) ?? '', /margem mínima/);
  assert.equal(marginWarning(null, 0.7), null);
});
