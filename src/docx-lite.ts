import { deflateRawSync } from 'node:zlib';
import yauzl from 'yauzl';
import {
  CONTENT_TYPES,
  DOC_RELS,
  FONT_MONO,
  FONT_SANS,
  FONT_SANS_SEMIBOLD,
  FONT_TABLE,
  PB,
  RELS,
  SETTINGS,
  STYLES,
  buildVariantALockupXml,
} from './docx-brand.js';

/** Gera e lê documentos .docx (OOXML) sem dependências extra — ZIP + WordprocessingML. */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xmlEsc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch] ?? ch));
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = e.data;
    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, payload);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + payload.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

const PLACEHOLDER_RE = /(\[A COMPLETAR:[^\]]+\])/g;
const DATA_RE = /(\d{8}(?:-\d)?|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,3}(?:[ \u00A0]\d{3})+(?:[.,]\d+)?(?:\s*€)?|(?:\d+[.,]\d+|\d+)\s*€|\d+[.,]?\d*\s*%)/g;

function rFonts(name: string): string {
  return `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" w:cs="${name}" w:eastAsia="${name}"/>`;
}

function textRun(text: string, rPr: string): string {
  const pr = rPr ? `<w:rPr>${rPr}</w:rPr>` : '';
  return `<w:r>${pr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function placeholderRun(text: string): string {
  return textRun(
    text,
    `${rFonts(FONT_SANS_SEMIBOLD)}<w:color w:val="${PB.amber}"/><w:shd w:val="clear" w:color="auto" w:fill="${PB.amberTint}"/>`,
  );
}

function numberedRuns(text: string): string {
  const parts = text.split(DATA_RE);
  return parts.map((part) => {
    if (!part) return '';
    DATA_RE.lastIndex = 0;
    if (DATA_RE.test(part)) {
      DATA_RE.lastIndex = 0;
      return textRun(part, `${rFonts(FONT_MONO)}<w:color w:val="${PB.ink}"/>`);
    }
    DATA_RE.lastIndex = 0;
    return textRun(part, `${rFonts(FONT_SANS)}<w:color w:val="${PB.ink}"/>`);
  }).join('');
}

function runsFromText(text: string, numeric: boolean): string {
  const parts = text.split(PLACEHOLDER_RE);
  return parts.map((part) => {
    if (!part) return '';
    if (PLACEHOLDER_RE.test(part) || /^\[A COMPLETAR:/.test(part)) {
      PLACEHOLDER_RE.lastIndex = 0;
      return placeholderRun(part);
    }
    PLACEHOLDER_RE.lastIndex = 0;
    return numeric ? numberedRuns(part) : textRun(part, '');
  }).join('');
}

function para(style: string, text: string): string {
  const pPr = style === 'Normal' ? '' : `<w:pPr><w:pStyle w:val="${xmlEsc(style)}"/></w:pPr>`;
  return `<w:p>${pPr}${runsFromText(text, style === 'Normal')}</w:p>`;
}

export interface DocxSection {
  title: string;
  body: string;
}

export interface DocxProposalInput {
  title: string;
  subtitle?: string;
  note?: string;
  sections: DocxSection[];
  footer?: string;
}

export function buildProposalDocumentXml(input: DocxProposalInput): string {
  const parts: string[] = [buildVariantALockupXml(), para('Title', input.title)];
  if (input.subtitle) parts.push(para('Subtitle', input.subtitle));
  if (input.note) parts.push(para('Note', input.note));
  for (const section of input.sections) {
    parts.push(para('Heading1', section.title));
    const paragraphs = section.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) parts.push(para('Normal', ''));
    for (const p of paragraphs) {
      for (const line of p.split('\n')) parts.push(para('Normal', line));
    }
  }
  if (input.footer) parts.push(para('Note', input.footer));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:background w:color="${PB.paper}"/>
  <w:body>
    ${parts.join('\n    ')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
  </w:body>
</w:document>`;
}

export function buildDocx(input: DocxProposalInput): Buffer {
  const document = buildProposalDocumentXml(input);
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(RELS, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(DOC_RELS, 'utf8') },
    { name: 'word/styles.xml', data: Buffer.from(STYLES, 'utf8') },
    { name: 'word/settings.xml', data: Buffer.from(SETTINGS, 'utf8') },
    { name: 'word/fontTable.xml', data: Buffer.from(FONT_TABLE, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(document, 'utf8') },
  ]);
}

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Extrai o texto visível de um .docx (word/document.xml → w:t). */
export async function extractDocxText(buf: Buffer): Promise<string> {
  const xml = await readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('Ficheiro .docx inválido (sem word/document.xml)');
  return textFromDocumentXml(xml.toString('utf8'));
}

export function textFromDocumentXml(xml: string): string {
  const lines: string[] = [];
  const paras = xml.split(/<w:p[\s>]/);
  for (const paraXml of paras.slice(1)) {
    const texts: string[] = [];
    const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(paraXml)) !== null) {
      texts.push(m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"));
    }
    const line = texts.join('').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

export function readDocxPart(buf: Buffer, name: string): Promise<Buffer | null> {
  return readZipEntry(buf, name);
}

function readZipEntry(buf: Buffer, name: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('ZIP inválido'));
      let found: Buffer | null = null;
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (entry.fileName !== name) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) { zip.readEntry(); return; }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            found = Buffer.concat(chunks);
            zip.readEntry();
          });
          stream.on('error', () => zip.readEntry());
        });
      });
      zip.on('end', () => resolve(found));
      zip.on('error', reject);
    });
  });
}
