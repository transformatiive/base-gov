import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILETE,
  FILETE_ON_SURFACE,
  FONT_SANS,
  FONT_SANS_MEDIUM,
  FONT_SANS_SEMIBOLD,
  PAGE_FILL,
  PB,
  STYLES,
  buildVariantALockupXml,
  mixHex,
} from './docx-brand.js';
import {
  buildDocx,
  buildDossierDocx,
  extractDocxText,
  textFromDocumentXml,
  buildProposalDocumentXml,
  readDocxPart,
  sectionsFromMarkdown,
} from './docx-lite.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('textFromDocumentXml joins w:t runs and paragraphs', () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Olá</w:t></w:r><w:r><w:t xml:space="preserve"> mundo</w:t></w:r></w:p>
      <w:p><w:r><w:t>Segunda</w:t></w:r></w:p>
    </w:body>
  </w:document>`;
  assert.equal(textFromDocumentXml(xml), 'Olá mundo\nSegunda');
});

test('hex da marca no .docx bate com tokens.css', () => {
  const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  assert.match(css, new RegExp(`--pb-ink:\\s*#${PB.ink}`, 'i'));
  assert.match(css, new RegExp(`--pb-paper:\\s*#${PB.paper}`, 'i'));
  assert.match(css, new RegExp(`--pb-grey:\\s*#${PB.grey}`, 'i'));
  assert.match(css, new RegExp(`--pb-amber:\\s*#${PB.amber}`, 'i'));
  assert.match(css, new RegExp(`--pb-amber-tint:\\s*#${PB.amberTint}`, 'i'));
});

test('filete é 20 % de tinta sobre o fundo', () => {
  assert.equal(mixHex(PB.ink, PB.paper, 0.2), FILETE);
  assert.equal(FILETE, 'C3C2BD');
  assert.equal(mixHex(PB.ink, PB.surface, 0.2), FILETE_ON_SURFACE);
});

test('estilos do Word: Archivo, tinta, sem itálico nem Calibri', () => {
  assert.match(STYLES, /Archivo SemiBold/);
  assert.match(STYLES, /w:sz w:val="40"/);
  assert.match(STYLES, /Heading2/);
  assert.match(STYLES, new RegExp(`w:color="${PB.green}"`));
  assert.doesNotMatch(STYLES, /<w:i\b/);
  assert.doesNotMatch(STYLES, /Calibri/);
  assert.doesNotMatch(STYLES, /173F35/);
  assert.doesNotMatch(STYLES, /9C5700/);
});

test('variante A: PrepBid numa só run, filete e descritivo em duas linhas', () => {
  const xml = buildVariantALockupXml();
  assert.match(xml, /<w:t>PrepBid<\/w:t>/);
  assert.doesNotMatch(xml, /Prep<\/w:t>/);
  assert.doesNotMatch(xml, /<w:i\b/);
  assert.match(xml, new RegExp(FONT_SANS_SEMIBOLD));
  assert.match(xml, new RegExp(FONT_SANS_MEDIUM));
  assert.match(xml, /<w:t>CONTRATOS<\/w:t>/);
  assert.match(xml, /<w:t>PÚBLICOS<\/w:t>/);
  assert.doesNotMatch(xml, /CONTRATOS PÚBLICOS/);
  assert.match(xml, new RegExp(`w:color="${FILETE_ON_SURFACE}"`));
  assert.match(xml, /w:sz w:val="85"/);
  assert.match(xml, /w:spacing w:val="-32"/);
});

test('buildProposalDocumentXml marca placeholders com âmbar e põe a variante A no título', () => {
  const xml = buildProposalDocumentXml({
    title: 'Proposta',
    sections: [{ title: 'Equipa', body: 'Temos engenheiros.\n\n[A COMPLETAR: CV do coordenador]' }],
  });
  assert.match(xml, new RegExp(`w:fill="${PB.amberTint}"`));
  assert.match(xml, new RegExp(`w:color w:val="${PB.amber}"`));
  assert.doesNotMatch(xml, /w:highlight w:val="yellow"/);
  assert.match(xml, /\[A COMPLETAR: CV do coordenador\]/);
  assert.match(xml, /<w:t>PrepBid<\/w:t>/);
  assert.match(xml, /<w:t>CONTRATOS<\/w:t>/);
  assert.match(xml, new RegExp(`<w:background w:color="${PAGE_FILL}"`));
  assert.equal(PAGE_FILL, 'FFFFFF');
});

test('docx roundtrip preserves section text e a marca', async () => {
  const buf = buildDocx({
    title: 'Proposta — Conservação de espaços verdes',
    subtitle: 'Município de Sintra',
    note: 'Rascunho gerado pelo PrepBid.',
    sections: [
      { title: 'Memória descritiva', body: 'A empresa propõe a manutenção anual.\n\nInclui monda e 12 500 € de materiais.' },
      { title: 'Referências', body: '[A COMPLETAR: referência de projeto semelhante em X]' },
    ],
    footer: 'A submissão no portal é manual.',
  });
  assert.ok(buf.length > 100);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  const text = await extractDocxText(buf);
  assert.match(text, /^PrepBid\nCONTRATOS\nPÚBLICOS\n/);
  assert.match(text, /Proposta — Conservação de espaços verdes/);
  assert.match(text, /Memória descritiva/);
  assert.match(text, /manutenção anual/);
  assert.match(text, /12 500 €/);
  assert.match(text, /\[A COMPLETAR: referência de projeto semelhante em X\]/);
  assert.match(text, /A submissão no portal é manual/);

  const styles = await readDocxPart(buf, 'word/styles.xml');
  assert.ok(styles);
  const stylesXml = styles.toString('utf8');
  assert.match(stylesXml, new RegExp(FONT_SANS));
  assert.doesNotMatch(stylesXml, /<w:i\b/);
  assert.doesNotMatch(stylesXml, /<w:b\b/);
  assert.doesNotMatch(stylesXml, /Calibri/);

  const doc = await readDocxPart(buf, 'word/document.xml');
  assert.ok(doc);
  const docXml = doc.toString('utf8');
  assert.match(docXml, /IBM Plex Mono/);
  assert.match(docXml, /12 500 €/);
});

test('sectionsFromMarkdown: headings, listas e [PLACEHOLDER] viram secções PrepBid', () => {
  const input = sectionsFromMarkdown(`# Dossier X
## Checklist de submissão
- Assinar com [PLACEHOLDER: certificado]
- Carregar na plataforma

## Memória descritiva
Texto **técnico**.
`, 'fallback');
  assert.equal(input.title, 'Dossier X');
  assert.equal(input.sections[0].title, 'Checklist de submissão');
  assert.match(input.sections[0].body, /· Assinar/);
  assert.match(input.sections[0].body, /\[A COMPLETAR: certificado\]/);
  assert.doesNotMatch(input.sections[0].body, /PLACEHOLDER/);
  assert.equal(input.sections[1].title, 'Memória descritiva');
  assert.match(input.sections[1].body ?? '', /Texto técnico/);
});

test('tabela GFM vira w:tbl, não pipes de markdown', async () => {
  const md = `## 1. Checklist de submissão
### 1.1 Plataforma e prazos
| Item | Dados |
|---|---|
| Plataforma electrónica | Vortal |
| Prazo de propostas | 01-04-2027, 23:59 |
`;
  const parsed = sectionsFromMarkdown(md);
  assert.equal(parsed.sections[0].blocks?.[0].kind, 'p');
  assert.equal(parsed.sections[0].blocks?.[1].kind, 'table');
  const buf = buildDossierDocx(md, 'X');
  const xml = (await readDocxPart(buf, 'word/document.xml'))!.toString('utf8');
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /<w:tblHeader\/>/);
  assert.doesNotMatch(xml, /\|---\|/);
  assert.doesNotMatch(xml, /\| Item \|/);
  assert.match(xml, /<w:t xml:space="preserve">Item<\/w:t>|<w:t>Item<\/w:t>/);
  assert.match(xml, /Vortal/);
  assert.match(xml, /Heading2/);
  const text = await extractDocxText(buf);
  assert.doesNotMatch(text, /\|---/);
  assert.match(text, /1\.1 Plataforma e prazos/);
  assert.match(text, /Plataforma electrónica/);
});

test('buildDossierDocx é OOXML com lockup e sem Calibri', async () => {
  const buf = buildDossierDocx('## Preço\nBase 12 500 € e [PLACEHOLDER: valor da proposta].', 'Limpeza urbana');
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  const text = await extractDocxText(buf);
  assert.match(text, /^PrepBid\nCONTRATOS\nPÚBLICOS\n/);
  assert.match(text, /Dossier de resposta — Limpeza urbana/);
  assert.match(text, /\[A COMPLETAR: valor da proposta\]/);
  const styles = (await readDocxPart(buf, 'word/styles.xml'))!.toString('utf8');
  assert.doesNotMatch(styles, /Calibri/);
});
