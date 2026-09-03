import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function extractFn(src: string, name: string): string {
  const start = src.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`função em falta: ${name}`);
  const brace = src.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`função por fechar: ${name}`);
}

const appJs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../public/app.js'), 'utf8');
const escSrc = "const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));";
const names = ['unwrapDisplayQuotes', 'cleanDisplayText', 'normalizeFichaCompare', 'fichaTitleParts', 'fichaHeadHtml', 'escTitle', 'escTitleMax'];
const ctx = createContext({ exports: {} });
runInContext(
  `${escSrc}\n${names.map((n) => extractFn(appJs, n)).join('\n')}\n` +
    'this.cleanDisplayText = cleanDisplayText; this.fichaTitleParts = fichaTitleParts; this.fichaHeadHtml = fichaHeadHtml; this.escTitle = escTitle;',
  ctx,
);

const { cleanDisplayText, fichaTitleParts, fichaHeadHtml, escTitle } = ctx as {
  cleanDisplayText: (s: unknown) => string;
  fichaTitleParts: (brief: unknown, extra: unknown) => { ref: string; title: string; lead: string };
  fichaHeadHtml: (brief: unknown, extra: unknown, fallback?: string) => string;
  escTitle: (s: unknown) => string;
};

const SAMPLE = '2324000137 - "Transição Digital na Segurança Social\u0096\u0096 Aquisição de serviços de testes e acreditação de software para o Projeto Portal Unificado da Segurança Social (SSD Nova Geração\u0096 Arquitetura da Informação e Design Visual), ao abrigo dos Acordos Quadro do I.I., IP.\u0096 Programas Informáticos\u0096 Lote 1 (Serviços de Testes e Acreditação de Software)';

test('cleanDisplayText remove C1, tofu e caixas', () => {
  const out = cleanDisplayText(`foo\u0096bar\uFFFD baz\u25AF qux`);
  assert.equal(out.includes('\u0096'), false);
  assert.equal(out.includes('\uFFFD'), false);
  assert.equal(out.includes('\u25AF'), false);
  assert.match(out, /foo · bar · baz · qux/);
});

test('cleanDisplayText normaliza travessões e colapsa ·', () => {
  assert.equal(cleanDisplayText('A - B – C'), 'A — B — C');
  assert.equal(cleanDisplayText('A\u0096\u0096B'), 'A · B');
});

test('ficha: número BASE sai do H1; primeiro segmento é o título', () => {
  const p = fichaTitleParts(SAMPLE, SAMPLE);
  assert.equal(p.ref, '2324000137');
  assert.equal(p.title, 'Transição Digital na Segurança Social');
  assert.match(p.lead, /Programas Informáticos/);
  assert.match(p.lead, /Lote 1/);
  assert.equal(p.lead.includes(p.title) && p.lead.startsWith('Transição Digital'), false);
});

test('ficha: brief = description → não duplica o texto inteiro no lead', () => {
  const same = 'Fornecimento de papel A4 para serviços municipais';
  const p = fichaTitleParts(same, same);
  assert.equal(p.title, same);
  assert.equal(p.lead, '');
  const html = fichaHeadHtml(same, same, 'Contrato #1');
  assert.equal(html.includes('<p class="lead">'), false);
  assert.match(html, /<h1>Fornecimento de papel A4 para serviços municipais<\/h1>/);
});

test('ficha: description extra só aparece se for realmente adicional', () => {
  const p = fichaTitleParts('Limpeza de edifícios', 'Inclui manutenção de AVAC e resíduos.');
  assert.equal(p.title, 'Limpeza de edifícios');
  assert.equal(p.lead, 'Inclui manutenção de AVAC e resíduos.');
});

test('fichaHeadHtml do SAMPLE não contém tofu e tem d-ref', () => {
  const html = fichaHeadHtml(SAMPLE, SAMPLE, 'Contrato #11009424');
  assert.match(html, /<p class="d-ref">2324000137<\/p>/);
  assert.match(html, /<h1>Transição Digital na Segurança Social<\/h1>/);
  assert.match(html, /<p class="lead">/);
  assert.equal(html.includes('\u0096'), false);
  assert.equal(html.includes('\uFFFD'), false);
  assert.equal(html.includes('\u25AF'), false);
});

test('anúncio: H1 usa o mesmo splitter se houver separadores', () => {
  const a = `Concurso\u0097 Lote 2 — serviços de testes`;
  const p = fichaTitleParts(a, null);
  assert.equal(p.title, 'Concurso');
  assert.match(p.lead, /Lote 2/);
});

test('escTitle limpa tofu nas listas', () => {
  const out = escTitle(`Objeto\u0096 caixa`);
  assert.equal(out.includes('\u0096'), false);
  assert.equal(out, 'Objeto · caixa');
});

test('fallback quando o brief está vazio', () => {
  const html = fichaHeadHtml('', null, 'Contrato #9');
  assert.match(html, /<h1>Contrato #9<\/h1>/);
  assert.equal(html.includes('d-ref'), false);
});
