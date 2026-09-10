/**
 * Identidade PrepBid no .docx da proposta.
 * Cores e métricas alinhadas a src/styles/tokens.css e às normas de identidade
 * (variante A horizontal no título: palavra + filete + descritivo).
 */

export const PB = {
  ink: '141613',
  paper: 'EFEDE7',
  surface: 'FFFFFF',
  green: '1C6B4C',
  greenLight: '4FA37E',
  grey: '6E7269',
  amber: 'B4741C',
  amberTint: 'FBF2E4',
  garnet: '8C2F2F',
} as const;

export const FONT_SANS = 'Archivo';
export const FONT_SANS_MEDIUM = 'Archivo Medium';
export const FONT_SANS_SEMIBOLD = 'Archivo SemiBold';
export const FONT_MONO = 'IBM Plex Mono';

/** 15 mm impressos — mínimo da palavra nas normas. */
export const WORDMARK_PT = 42.5;
const WORDMARK_SZ = 85;
const DESCRIPTOR_PT = 11;
const DESCRIPTOR_SZ = 22;
const CAP_RATIO = 0.7;
const M_RATIO = 0.83;

function ptTwips(pt: number): number {
  return Math.round(pt * 20);
}

function emTrackingTwips(pt: number, em: number): number {
  return Math.round(pt * em * 20);
}

/** 20 % de tinta sobre papel — filete da variante A. */
export function mixHex(fg: string, bg: string, alpha: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const a = parse(fg);
  const b = parse(bg);
  const ch = (x: number, y: number) => Math.round(x * alpha + y * (1 - alpha));
  return [ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export const FILETE = mixHex(PB.ink, PB.paper, 0.2);

const GAP_TWIPS = Math.round(0.28 * M_RATIO * WORDMARK_PT * 20);
const FILETE_TWIPS = Math.round(0.66 * CAP_RATIO * WORDMARK_PT * 20);
const CLEAR_P_TWIPS = Math.round(CAP_RATIO * WORDMARK_PT * 20);
const WORDMARK_TRACKING = emTrackingTwips(WORDMARK_PT, -0.038);
const DESCRIPTOR_TRACKING = emTrackingTwips(DESCRIPTOR_PT, 0.2);

function rFonts(name: string): string {
  return `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" w:cs="${name}" w:eastAsia="${name}"/>`;
}

export const FONT_TABLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="${FONT_SANS}">
    <w:charset w:val="00"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="${FONT_SANS_MEDIUM}">
    <w:charset w:val="00"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="${FONT_SANS_SEMIBOLD}">
    <w:charset w:val="00"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="${FONT_MONO}">
    <w:charset w:val="00"/>
    <w:family w:val="modern"/>
    <w:pitch w:val="fixed"/>
  </w:font>
</w:fonts>`;

export const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:displayBackgroundShape/>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;

export const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        ${rFonts(FONT_SANS)}
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="${PB.ink}"/>
        <w:lang w:val="pt-PT"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="372" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr>${rFonts(FONT_SANS)}<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${PB.ink}"/></w:rPr>
    <w:pPr><w:spacing w:after="160" w:line="372" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>${rFonts(FONT_SANS_SEMIBOLD)}<w:sz w:val="42"/><w:szCs w:val="42"/><w:color w:val="${PB.ink}"/><w:spacing w:val="-11"/></w:rPr>
    <w:pPr><w:spacing w:before="${CLEAR_P_TWIPS}" w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>${rFonts(FONT_SANS)}<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${PB.grey}"/></w:rPr>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>${rFonts(FONT_SANS_SEMIBOLD)}<w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="${PB.ink}"/><w:spacing w:val="-8"/></w:rPr>
    <w:pPr><w:spacing w:before="280" w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Note">
    <w:name w:val="Note"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>${rFonts(FONT_SANS)}<w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${PB.grey}"/></w:rPr>
  </w:style>
</w:styles>`;

const NIL_BORDERS = `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/>`;

function descriptorPara(text: string, last: boolean): string {
  const after = last ? 0 : 40;
  return `<w:p>
        <w:pPr><w:spacing w:before="0" w:after="${after}" w:line="240" w:lineRule="auto"/></w:pPr>
        <w:r>
          <w:rPr>${rFonts(FONT_SANS_MEDIUM)}<w:sz w:val="${DESCRIPTOR_SZ}"/><w:szCs w:val="${DESCRIPTOR_SZ}"/><w:color w:val="${PB.grey}"/><w:spacing w:val="${DESCRIPTOR_TRACKING}"/></w:rPr>
          <w:t>${text}</w:t>
        </w:r>
      </w:p>`;
}

/**
 * Variante A — horizontal. Palavra Archivo 600 tracking −3,8 %,
 * filete 1 px a 20 % de tinta (66 % da maiúscula), descritivo Archivo 500
 * caixa alta tracking 20 %, intervalos 0,28×M.
 */
export function buildVariantALockupXml(): string {
  const rowH = ptTwips(WORDMARK_PT);
  return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>${NIL_BORDERS}</w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>
          <w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>
        </w:tblCellMar>
        <w:tblLayout w:type="autofit"/>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="3200"/>
        <w:gridCol w:w="80"/>
        <w:gridCol w:w="2400"/>
      </w:tblGrid>
      <w:tr>
        <w:trPr><w:cantSplit/><w:trHeight w:val="${rowH}" w:hRule="atLeast"/></w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcBorders>${NIL_BORDERS}</w:tcBorders>
            <w:vAlign w:val="center"/>
            <w:tcMar>
              <w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>
              <w:bottom w:w="0" w:type="dxa"/><w:right w:w="${GAP_TWIPS}" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
            <w:r>
              <w:rPr>${rFonts(FONT_SANS_SEMIBOLD)}<w:sz w:val="${WORDMARK_SZ}"/><w:szCs w:val="${WORDMARK_SZ}"/><w:color w:val="${PB.ink}"/><w:spacing w:val="${WORDMARK_TRACKING}"/></w:rPr>
              <w:t>PrepBid</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="80" w:type="dxa"/>
            <w:tcBorders>${NIL_BORDERS}</w:tcBorders>
            <w:vAlign w:val="center"/>
            <w:tcMar>
              <w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>
              <w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="0" w:after="0" w:line="${FILETE_TWIPS}" w:lineRule="exact"/>
              <w:pBdr>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="${FILETE}"/>
              </w:pBdr>
            </w:pPr>
            <w:r><w:t xml:space="preserve"> </w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcBorders>${NIL_BORDERS}</w:tcBorders>
            <w:vAlign w:val="center"/>
            <w:tcMar>
              <w:top w:w="0" w:type="dxa"/><w:left w:w="${GAP_TWIPS}" w:type="dxa"/>
              <w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>
            </w:tcMar>
          </w:tcPr>
          ${descriptorPara('CONTRATOS', false)}
          ${descriptorPara('PÚBLICOS', true)}
        </w:tc>
      </w:tr>
    </w:tbl>`;
}

export const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>`;

export const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>`;
