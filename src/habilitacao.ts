import { foldPt } from './fit-rules.js';

export type HabilitacaoStatus = 'tem' | 'nao_tem' | 'indeterminavel';

export interface HabilitacaoItem {
  text: string;
  status: HabilitacaoStatus;
}

function looksLikeNamedCert(req: string): boolean {
  return /alvar[aá]|iso\s*\d|haccp|licen[cç]a|certific/i.test(req);
}

function certCovers(req: string, cert: string): boolean {
  const r = foldPt(req);
  const c = foldPt(cert);
  if (!r || !c) return false;
  return r.includes(c) || c.includes(r);
}

export function confrontHabilitacao(
  requisitos: unknown,
  certifications: string[] | null | undefined,
): { items: HabilitacaoItem[]; anyMissing: boolean; profileEmpty: boolean } {
  const texts = Array.isArray(requisitos) ? requisitos.map((x) => {
    if (x && typeof x === 'object' && 'text' in (x as object)) return String((x as { text: unknown }).text);
    return String(x);
  }).filter(Boolean) : [];
  const certs = certifications ?? [];
  const profileEmpty = certs.length === 0;
  const items: HabilitacaoItem[] = texts.map((text) => {
    if (profileEmpty) return { text, status: 'indeterminavel' };
    if (certs.some((c) => certCovers(text, c))) return { text, status: 'tem' };
    if (looksLikeNamedCert(text)) return { text, status: 'nao_tem' };
    return { text, status: 'indeterminavel' };
  });
  return {
    items,
    anyMissing: items.some((i) => i.status === 'nao_tem'),
    profileEmpty,
  };
}

function statusLabel(s: HabilitacaoStatus): string {
  switch (s) {
    case 'tem':
      return 'tem';
    case 'nao_tem':
      return 'não tem';
    case 'indeterminavel':
      return 'não determinável';
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}

export function overlayHabilitacao(
  analysis: unknown,
  certifications: string[] | null | undefined,
): unknown {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const a = { ...(analysis as Record<string, unknown>) };
  const { items, anyMissing, profileEmpty } = confrontHabilitacao(a.requisitos_habilitacao, certifications);
  a.habilitacao = items.map((i) => ({ ...i, label: statusLabel(i.status) }));
  if (profileEmpty && items.length > 0) {
    a.habilitacao_hint = 'Complete o perfil da empresa';
  }
  if (anyMissing) {
    const flags = Array.isArray(a.red_flags) ? a.red_flags.map(String) : [];
    if (!flags.some((f) => /habilita[cç][aã]o n[aã]o coberta/i.test(f))) {
      flags.push('Habilitação não coberta pelo perfil');
    }
    a.red_flags = flags;
    const gng = (a.go_no_go && typeof a.go_no_go === 'object')
      ? { ...(a.go_no_go as Record<string, unknown>) }
      : {};
    if (String(gng.recomendacao ?? '') === 'go') gng.recomendacao = 'condicional';
    a.go_no_go = gng;
  }
  return a;
}
