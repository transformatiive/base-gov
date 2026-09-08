import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocx, extractDocxText, textFromDocumentXml, buildProposalDocumentXml } from './docx-lite.js';

test('textFromDocumentXml joins w:t runs and paragraphs', () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Olá</w:t></w:r><w:r><w:t xml:space="preserve"> mundo</w:t></w:r></w:p>
      <w:p><w:r><w:t>Segunda</w:t></w:r></w:p>
    </w:body>
  </w:document>`;
  assert.equal(textFromDocumentXml(xml), 'Olá mundo\nSegunda');
});

test('buildProposalDocumentXml marks placeholders', () => {
  const xml = buildProposalDocumentXml({
    title: 'Proposta',
    sections: [{ title: 'Equipa', body: 'Temos engenheiros.\n\n[A COMPLETAR: CV do coordenador]' }],
  });
  assert.match(xml, /w:highlight w:val="yellow"/);
  assert.match(xml, /\[A COMPLETAR: CV do coordenador\]/);
});

test('docx roundtrip preserves section text', async () => {
  const buf = buildDocx({
    title: 'Proposta — Conservação de espaços verdes',
    subtitle: 'Município de Sintra',
    note: 'Rascunho gerado pelo BaseRadar.',
    sections: [
      { title: 'Memória descritiva', body: 'A empresa propõe a manutenção anual.\n\nInclui monda e rega.' },
      { title: 'Referências', body: '[A COMPLETAR: referência de projeto semelhante em X]' },
    ],
    footer: 'A submissão no portal é manual.',
  });
  assert.ok(buf.length > 100);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  const text = await extractDocxText(buf);
  assert.match(text, /Proposta — Conservação de espaços verdes/);
  assert.match(text, /Memória descritiva/);
  assert.match(text, /manutenção anual/);
  assert.match(text, /\[A COMPLETAR: referência de projeto semelhante em X\]/);
  assert.match(text, /A submissão no portal é manual/);
});
