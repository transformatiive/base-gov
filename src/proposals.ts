export type GapStatus = 'conforme' | 'incompleto' | 'em_falta';
export type RequirementCategory = 'admissao' | 'tecnico' | 'criterio' | 'documento' | 'formato' | 'prazo';

export interface RequirementItem {
  id: string;
  category: RequirementCategory;
  title: string;
  detail: string;
  mandatory: boolean;
  legal?: boolean;
}

export interface AwardCriterion {
  id: string;
  title: string;
  weight_pct: number | null;
  detail: string;
}

export interface RequirementsExtraction {
  admissao: RequirementItem[];
  tecnicos: RequirementItem[];
  criterios: AwardCriterion[];
  documentos: RequirementItem[];
  formato: {
    specified: boolean;
    chapters: string[];
    page_limit: number | null;
    notes: string;
  };
  prazos: {
    submissao: string | null;
    esclarecimentos: string | null;
    execucao: string | null;
  };
  legal_declarations: string[];
  notes: string;
}

export interface GapItem {
  requirement_id: string;
  title: string;
  category: RequirementCategory;
  status: GapStatus;
  note: string;
  legal?: boolean;
}

export interface GapReport {
  overall: GapStatus;
  items: GapItem[];
  summary: string;
}

export interface CompanyReference {
  project: string;
  client: string;
  value?: number | null;
  year?: number | null;
  description?: string | null;
}

export interface KeyPerson {
  name: string;
  role: string;
  cv_summary?: string | null;
}

export interface ProposalCompanyProfile {
  legal_name: string | null;
  nif: string | null;
  cae: string | null;
  certifications: string[];
  technical_capabilities: string | null;
  portfolio: string | null;
  references: CompanyReference[];
  key_team: KeyPerson[];
  min_margin_pct: number | null;
  notes: string | null;
}

export interface ProposalSection {
  title: string;
  body: string;
}

export const STANDARD_CHAPTERS = [
  'Memória descritiva',
  'Capacidade técnica',
  'Equipa',
  'Referências',
  'Cronograma',
  'Preço',
] as const;

export function emptyRequirements(): RequirementsExtraction {
  return {
    admissao: [],
    tecnicos: [],
    criterios: [],
    documentos: [],
    formato: { specified: false, chapters: [...STANDARD_CHAPTERS], page_limit: null, notes: '' },
    prazos: { submissao: null, esclarecimentos: null, execucao: null },
    legal_declarations: [],
    notes: '',
  };
}

export function flattenRequirements(extraction: RequirementsExtraction): RequirementItem[] {
  const out: RequirementItem[] = [];
  for (const r of extraction.admissao) out.push({ ...r, category: 'admissao' });
  for (const r of extraction.tecnicos) out.push({ ...r, category: 'tecnico' });
  for (const c of extraction.criterios) {
    out.push({
      id: c.id,
      category: 'criterio',
      title: c.weight_pct != null ? `${c.title} (${c.weight_pct}%)` : c.title,
      detail: c.detail,
      mandatory: true,
    });
  }
  for (const r of extraction.documentos) out.push({ ...r, category: 'documento' });
  if (extraction.formato.specified || extraction.formato.chapters.length > 0) {
    out.push({
      id: 'formato',
      category: 'formato',
      title: 'Formato da proposta',
      detail: [
        extraction.formato.chapters.length ? `Capítulos: ${extraction.formato.chapters.join(' → ')}` : '',
        extraction.formato.page_limit != null ? `Limite: ${extraction.formato.page_limit} páginas` : '',
        extraction.formato.notes,
      ].filter(Boolean).join('. '),
      mandatory: extraction.formato.specified,
    });
  }
  const prazoBits = [
    extraction.prazos.submissao ? `submissão: ${extraction.prazos.submissao}` : '',
    extraction.prazos.esclarecimentos ? `esclarecimentos: ${extraction.prazos.esclarecimentos}` : '',
    extraction.prazos.execucao ? `execução: ${extraction.prazos.execucao}` : '',
  ].filter(Boolean);
  if (prazoBits.length) {
    out.push({
      id: 'prazos',
      category: 'prazo',
      title: 'Prazos',
      detail: prazoBits.join('; '),
      mandatory: true,
    });
  }
  return out;
}

export function overallGapStatus(items: GapItem[]): GapStatus {
  let hasMissing = false;
  let hasIncomplete = false;
  for (const item of items) {
    switch (item.status) {
      case 'em_falta':
        hasMissing = true;
        break;
      case 'incompleto':
        hasIncomplete = true;
        break;
      case 'conforme':
        break;
      default: {
        const _x: never = item.status;
        void _x;
      }
    }
  }
  if (hasMissing) return 'em_falta';
  if (hasIncomplete) return 'incompleto';
  return 'conforme';
}

export function summarizeGapReport(items: GapItem[]): string {
  const counts = { conforme: 0, incompleto: 0, em_falta: 0 };
  for (const i of items) counts[i.status]++;
  const overall = overallGapStatus(items);
  switch (overall) {
    case 'conforme':
      return `Proposta conforme em todos os ${items.length} pontos da checklist.`;
    case 'incompleto':
      return `${counts.incompleto} ponto(s) incompleto(s), ${counts.em_falta} em falta, ${counts.conforme} conforme(s).`;
    case 'em_falta':
      return `${counts.em_falta} requisito(s) em falta, ${counts.incompleto} incompleto(s), ${counts.conforme} conforme(s).`;
    default: {
      const _x: never = overall;
      return _x;
    }
  }
}

export function buildGapReport(items: GapItem[]): GapReport {
  return { overall: overallGapStatus(items), items, summary: summarizeGapReport(items) };
}

export function profileMissingFields(p: ProposalCompanyProfile): string[] {
  const missing: string[] = [];
  if (!p.legal_name?.trim()) missing.push('denominação social');
  if (!p.nif?.trim()) missing.push('NIF');
  if (!p.technical_capabilities?.trim() && !p.portfolio?.trim()) missing.push('capacidades técnicas / portefólio');
  if (p.references.length === 0) missing.push('referências de execução');
  if (p.certifications.length === 0) missing.push('habilitações / certidões');
  return missing;
}

export function emptyProfile(): ProposalCompanyProfile {
  return {
    legal_name: null,
    nif: null,
    cae: null,
    certifications: [],
    technical_capabilities: null,
    portfolio: null,
    references: [],
    key_team: [],
    min_margin_pct: null,
    notes: null,
  };
}

export function parseProfileBody(body: Record<string, unknown>, fallback: ProposalCompanyProfile): ProposalCompanyProfile {
  const str = (v: unknown): string | null => {
    const s = String(v ?? '').trim();
    return s ? s : null;
  };
  const strArr = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean);
  const refsRaw = Array.isArray(body.references) ? body.references : fallback.references;
  const teamRaw = Array.isArray(body.key_team) ? body.key_team : fallback.key_team;
  const marginRaw = body.min_margin_pct;
  let minMargin: number | null = fallback.min_margin_pct;
  if (marginRaw === null || marginRaw === '') minMargin = null;
  else if (marginRaw != null) {
    const n = Number(marginRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw Object.assign(new Error('A margem mínima tem de estar entre 0 e 100.'), { statusCode: 400 });
    }
    minMargin = n;
  }
  const nif = body.nif !== undefined ? str(body.nif) : fallback.nif;
  if (nif && !/^\d{9}$/.test(nif.replace(/\s/g, ''))) {
    throw Object.assign(new Error('NIF inválido (9 dígitos).'), { statusCode: 400 });
  }
  return {
    legal_name: body.legal_name !== undefined ? str(body.legal_name) : fallback.legal_name,
    nif: nif ? nif.replace(/\s/g, '') : null,
    cae: body.cae !== undefined ? str(body.cae) : fallback.cae,
    certifications: body.certifications !== undefined ? strArr(body.certifications) : fallback.certifications,
    technical_capabilities: body.technical_capabilities !== undefined
      ? str(body.technical_capabilities) : fallback.technical_capabilities,
    portfolio: body.portfolio !== undefined ? str(body.portfolio) : fallback.portfolio,
    references: refsRaw.map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        project: String(o.project ?? '').trim(),
        client: String(o.client ?? '').trim(),
        value: o.value != null && o.value !== '' ? Number(o.value) : null,
        year: o.year != null && o.year !== '' ? Number(o.year) : null,
        description: o.description != null ? String(o.description).trim() : null,
      };
    }).filter((r) => r.project || r.client),
    key_team: teamRaw.map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        name: String(o.name ?? '').trim(),
        role: String(o.role ?? '').trim(),
        cv_summary: o.cv_summary != null ? String(o.cv_summary).trim() : null,
      };
    }).filter((p) => p.name),
    min_margin_pct: minMargin,
    notes: body.notes !== undefined ? str(body.notes) : fallback.notes,
  };
}

export function nextVersion(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

export function marginWarning(minMarginPct: number | null, highPct: number | null): string | null {
  if (minMarginPct == null || highPct == null) return null;
  const floor = 1 - minMarginPct / 100;
  if (highPct < floor) {
    return `A faixa estimada de fecho (até ${Math.round(highPct * 100)}% do preço base) fica abaixo da margem mínima declarada (${minMarginPct}%). Confirma o preço a apresentar.`;
  }
  return null;
}
