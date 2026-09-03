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
  const scoreNum = Number(fit.score);
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
      score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 0,
      razao: asStr(fit.razao),
    },
  };
}
