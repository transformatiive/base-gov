export type TokenUsage = { tokens_in: number; tokens_out: number };

function asObj(v: unknown): Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStr(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function asStrList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : asStr(x))).map((s) => s.trim()).filter(Boolean);
}

type GoRec = 'go' | 'condicional' | 'no-go';

function asGo(v: unknown): GoRec {
  const s = String(v ?? '').toLowerCase();
  switch (s) {
    case 'go':
      return 'go';
    case 'condicional':
      return 'condicional';
    case 'no-go':
      return 'no-go';
    default:
      return 'condicional';
  }
}

export function sumUsage(...parts: TokenUsage[]): TokenUsage {
  return parts.reduce(
    (acc, u) => ({ tokens_in: acc.tokens_in + u.tokens_in, tokens_out: acc.tokens_out + u.tokens_out }),
    { tokens_in: 0, tokens_out: 0 },
  );
}

/** Fit 0–100. Modelos por vezes devolvem 0–1 (0,65 → 65); 1 e 0 ficam 1 e 0. */
export function normalizeFitScore(score: unknown): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  const scaled = n > 0 && n < 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/**
 * Junta as três partes da análise (ficha, requisitos, decisão) num único
 * objecto no formato que o overlay de habilitação e a UI já conhecem.
 */
export function compileAnalysisParts(fichaRaw: unknown, requisitosRaw: unknown, decisaoRaw: unknown): Record<string, unknown> {
  const ficha = asObj(fichaRaw);
  const requisitos = asObj(requisitosRaw);
  const decisao = asObj(decisaoRaw);
  const prazos = asObj(ficha.prazos);
  const go = asObj(decisao.go_no_go);
  const fit = asObj(decisao.fit_atividade);
  return {
    resumo: asStr(ficha.resumo),
    criterios_adjudicacao: asStr(ficha.criterios_adjudicacao, 'não especificado'),
    prazos: {
      propostas: asStr(prazos.propostas, 'n/d'),
      execucao: asStr(prazos.execucao, 'n/d'),
    },
    preco_base: asStr(ficha.preco_base, 'n/d'),
    caucao_garantias: asStr(ficha.caucao_garantias, 'n/d'),
    requisitos_habilitacao: asStrList(requisitos.requisitos_habilitacao),
    red_flags: asStrList(requisitos.red_flags),
    checklist: asStrList(requisitos.checklist),
    go_no_go: {
      recomendacao: asGo(go.recomendacao),
      justificacao: asStr(go.justificacao),
    },
    fit_atividade: {
      score: normalizeFitScore(fit.score),
      razao: asStr(fit.razao),
    },
  };
}
