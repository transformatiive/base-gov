import { foldPt } from './fit-rules.js';
import { addCalendarDays } from './aiQuota.js';

const HOMEWORK_RE = [
  /portal base/,
  /base\.gov/,
  /diario da republica/,
  /ativar o download/,
  /activar o download/,
  /descarregar documentos/,
  /obter caderno/,
  /obter.*pecas do procedimento/,
  /confirmar no portal/,
  /validar a informacao/,
  /monitorizar public/,
  /monitorizar.*diario/,
  /analisar o relatorio de adjudic/,
  /ler o caderno/,
  /atraves do caderno/,
  /motor de pesquisa/,
  /deteccao antecipada do anuncio/,
  /levantar especificacoes/,
  /identificar o calendario/,
  /calendario previsivel/,
  /analise de precos de mercado/,
  /confirmar.*datas reais/,
];

export interface PeerAwardLine {
  id?: number;
  publication_date: string | null;
  awarded: number;
  title: string | null;
  contracted: string | null;
  same_entity: boolean;
}

export interface ContractAnalysisFacts {
  adjudicatario: string;
  janela_renovacao: string;
  precos_referencia: string;
}

/** Itens que mandam o utilizador ao BASE/DRE ou a «ir buscar» o que a análise já devia ter lido. */
export function isExternalHomework(item: string): boolean {
  const t = foldPt(item);
  if (!t) return true;
  return HOMEWORK_RE.some((re) => re.test(t));
}

export function sanitizeChecklist(items: unknown, max = 8): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const s = String(raw ?? '').trim();
    if (!s || isExternalHomework(s)) continue;
    const k = foldPt(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function mergeChecklist(primary: string[], extra: string[]): string[] {
  const out = sanitizeChecklist(primary);
  const seen = new Set(out.map(foldPt));
  for (const s of extra) {
    const t = String(s ?? '').trim();
    if (!t || isExternalHomework(t)) continue;
    const k = foldPt(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

export function asYmd(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function parseExecutionDays(raw: unknown): number | null {
  const m = String(raw ?? '').match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 3650) return null;
  return n;
}

export function renewalWindowText(opts: {
  signingDate: unknown;
  publicationDate: unknown;
  executionDeadline: unknown;
}): string {
  const days = parseExecutionDays(opts.executionDeadline);
  const start = asYmd(opts.signingDate) || asYmd(opts.publicationDate);
  if (days == null) return '';
  if (!start) {
    return `Prazo de execução: ${days} dias. Sem data de celebração/publicação, não é possível estimar o fim nem a janela de renovação.`;
  }
  const end = addCalendarDays(start, days);
  const watchStart = addCalendarDays(end, -90);
  return `Fim estimado da execução: ${end} (${days} dias a partir de ${start}). Janela típica para novo concurso: ${watchStart} a ${end} (cerca de 90 dias antes do fim).`;
}

export function formatEuroPt(n: number): string {
  if (!Number.isFinite(n)) return 'n/d';
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped} €`;
}

export function formatPeerAwards(rows: PeerAwardLine[]): string {
  if (!rows.length) return '';
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const r of rows) {
    if (!(r.awarded > 0)) continue;
    const date = r.publication_date || 's/ data';
    const who = r.contracted || 'adjudicatário n/d';
    const title = (r.title || 'contrato').replace(/\s+/g, ' ').trim().slice(0, 80);
    const tag = r.same_entity ? 'mesma entidade' : 'CPV semelhante';
    const line = `${date} · ${who} · ${formatEuroPt(r.awarded)} · ${title} (${tag})`;
    const k = foldPt(line);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    lines.push(line);
    if (lines.length >= 8) break;
  }
  if (!lines.length) return '';
  return `Adjudicações semelhantes na PrepBid:\n${lines.join('\n')}`;
}

/** Prioridade de PDFs de contrato: relatório de adjudicação e caderno à frente do maior ficheiro. */
export function contractDocPriority(fileName: string): number {
  const n = foldPt(fileName);
  if (/relatorio/.test(n) && /adjudic/.test(n)) return 100;
  if (/caderno/.test(n) && /encargo/.test(n)) return 90;
  if (/\bppe\b/.test(n) || /pecas do procedimento/.test(n)) return 85;
  if (/programa/.test(n) && /(concurso|procedimento)/.test(n)) return 80;
  if (/anuncio/.test(n)) return 40;
  return 10;
}

export function pickContractDocs<T extends { file_name: string; size_bytes?: number | null }>(docs: T[], n = 5): T[] {
  return [...docs].sort((a, b) => {
    const pd = contractDocPriority(b.file_name) - contractDocPriority(a.file_name);
    if (pd !== 0) return pd;
    return Number(b.size_bytes ?? 0) - Number(a.size_bytes ?? 0);
  }).slice(0, n);
}

export function applyStructuredContractFacts(
  analysis: unknown,
  facts: ContractAnalysisFacts,
): Record<string, unknown> {
  const out: Record<string, unknown> = (analysis != null && typeof analysis === 'object' && !Array.isArray(analysis))
    ? { ...(analysis as Record<string, unknown>) }
    : {};
  if (facts.adjudicatario) out.adjudicatario = facts.adjudicatario;
  if (facts.janela_renovacao) out.janela_renovacao = facts.janela_renovacao;
  const existingPrices = String(out.precos_referencia ?? '').trim();
  if (facts.precos_referencia && !existingPrices) out.precos_referencia = facts.precos_referencia;
  out.checklist = sanitizeChecklist(out.checklist);
  out.red_flags = sanitizeChecklist(out.red_flags, 12);
  return out;
}
