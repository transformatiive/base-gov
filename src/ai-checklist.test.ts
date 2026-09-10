import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStructuredContractFacts,
  contractDocPriority,
  formatEuroPt,
  formatPeerAwards,
  isExternalHomework,
  mergeChecklist,
  parseExecutionDays,
  pickContractDocs,
  renewalWindowText,
  sanitizeChecklist,
} from './ai-checklist.js';

const USER_CHECKLIST = [
  'Ativar o download de documentos no motor de pesquisa para obter caderno de encargos, programa do concurso e relatório final de adjudicação deste contrato',
  'Confirmar no Portal Base.gov.pt as datas reais de publicação/celebração e detalhes do procedimento para validar a informação',
  'Analisar o relatório de adjudicação para entender critérios de avaliação (preço, prazo, qualidade técnica) e posição da proposta vencedora (PRN Informática)',
  'Identificar o calendário previsível de renovação/novo concurso da MMP, EPE para aquisição de equipamento informático, considerando o prazo de execução de 179 dias do contrato atual',
  'Levantar especificações técnicas exigidas (marcas, modelos, garantias, suporte) através do caderno de encargos anterior',
  'Validar capacidade da empresa para apresentar portáteis (CPV 30213100-6) com preços competitivos face aos concorrentes já identificados no mercado',
  'Preparar dossier de habilitação atualizado (certidões, declarações, comprovativos financeiros e técnicos) com antecedência',
  'Estabelecer contacto institucional com a MMP, EPE para recolher informação sobre necessidades futuras e cronograma de renovação',
  'Realizar análise de preços de mercado para posicionar proposta competitiva, considerando o valor de referência de 124.142€ para lotes semelhantes',
  'Preparar referências de fornecimentos similares anteriores para reforçar capacidade técnica na próxima candidatura',
  'Monitorizar publicações no Diário da República e Portal Base para deteção antecipada do anúncio do novo procedimento',
];

test('checklist do utilizador: tira ir ao BASE/DRE e deixa só acções humanas', () => {
  const kept = sanitizeChecklist(USER_CHECKLIST);
  assert.equal(kept.length, 4);
  assert.ok(kept.some((s) => /Validar capacidade/.test(s)));
  assert.ok(kept.some((s) => /dossier de habilitação/.test(s)));
  assert.ok(kept.some((s) => /contacto institucional/.test(s)));
  assert.ok(kept.some((s) => /referências de fornecimentos/.test(s)));
  assert.ok(!kept.some((s) => isExternalHomework(s)));
});

test('isExternalHomework cobre variantes de «vá ler o caderno»', () => {
  assert.equal(isExternalHomework('Ler o caderno de encargos'), true);
  assert.equal(isExternalHomework('Confirmar alvará classe 4'), false);
  assert.equal(isExternalHomework('Contactar a entidade adjudicante'), false);
});

test('mergeChecklist junta evidências em falta e não reintroduz homework', () => {
  const out = mergeChecklist(
    USER_CHECKLIST,
    ['Juntar evidência de: Alvará classe 4', 'Ler o caderno'],
  );
  assert.ok(out.includes('Juntar evidência de: Alvará classe 4'));
  assert.ok(!out.some((s) => /caderno/.test(s) && /Ler/.test(s)));
  assert.ok(out.length <= 8);
});

test('renewalWindowText calcula fim e janela de 90 dias', () => {
  const t = renewalWindowText({
    signingDate: '2025-01-01',
    publicationDate: '2024-12-01',
    executionDeadline: '179 dias',
  });
  assert.match(t, /Fim estimado da execução: 2025-06-29/);
  assert.match(t, /2025-03-31 a 2025-06-29/);
  assert.equal(parseExecutionDays('179 dias'), 179);
  assert.equal(parseExecutionDays(null), null);
});

test('pickContractDocs prefere relatório e caderno ao PDF maior', () => {
  const picked = pickContractDocs([
    { file_name: 'scan-enorme.pdf', size_bytes: 9_000_000 },
    { file_name: 'Caderno de Encargos.pdf', size_bytes: 200_000 },
    { file_name: 'Relatório final de adjudicação.pdf', size_bytes: 80_000 },
    { file_name: 'Programa do concurso.pdf', size_bytes: 50_000 },
  ], 3);
  assert.equal(picked[0]?.file_name, 'Relatório final de adjudicação.pdf');
  assert.equal(picked[1]?.file_name, 'Caderno de Encargos.pdf');
  assert.equal(picked[2]?.file_name, 'Programa do concurso.pdf');
  assert.ok(contractDocPriority('Relatório de adjudicação.pdf') > contractDocPriority('outro.pdf'));
});

test('formatPeerAwards e applyStructuredContractFacts preenchem a ficha', () => {
  const precos = formatPeerAwards([
    {
      publication_date: '2024-06-01',
      awarded: 124142,
      title: 'Fornecimento de portáteis',
      contracted: 'PRN Informática',
      same_entity: true,
    },
  ]);
  assert.match(precos, /124 142 €/);
  assert.match(precos, /PRN Informática/);
  assert.equal(formatEuroPt(124142), '124 142 €');

  const out = applyStructuredContractFacts(
    {
      checklist: USER_CHECKLIST,
      red_flags: ['Confirmar no Portal BASE as datas', 'Prazo apertado'],
      adjudicatario: '',
    },
    {
      adjudicatario: 'PRN Informática',
      janela_renovacao: 'Fim estimado da execução: 2025-06-29',
      precos_referencia: precos,
    },
  );
  assert.equal(out.adjudicatario, 'PRN Informática');
  assert.match(String(out.janela_renovacao), /2025-06-29/);
  assert.equal(out.precos_referencia, precos);
  assert.deepEqual(out.red_flags, ['Prazo apertado']);
  assert.equal((out.checklist as string[]).length, 4);
});
