export interface CompanyProfileRules {
  districts: string[];
  value_min: number | null;
  value_max: number | null;
  excluded_terms: string[];
  excluded_entities: string[];
}

export interface FitRuleItem {
  title?: string | null;
  description?: string | null;
  entity?: string | null;
  district?: string | null;
  value?: number | null;
}

export interface RuleHit {
  code: 'exclusao_termo' | 'exclusao_entidade' | 'geografia' | 'valor';
  text: string;
}

export interface FitRulesResult {
  skipAi: boolean;
  cap: number | null;
  hits: RuleHit[];
}

export function foldPt(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function emptyProfile(p: CompanyProfileRules | null | undefined): boolean {
  if (!p) return true;
  return (
    p.districts.length === 0 &&
    p.value_min == null &&
    p.value_max == null &&
    p.excluded_terms.length === 0 &&
    p.excluded_entities.length === 0
  );
}

/**
 * Regras determinísticas aplicadas ANTES da IA. Só limitam o score; nunca o elevam.
 * Sem perfil (ou perfil vazio) → nenhum hit — o fit fica idêntico ao actual.
 */
export function applyFitRules(item: FitRuleItem, profile: CompanyProfileRules | null | undefined): FitRulesResult {
  const hits: RuleHit[] = [];
  if (emptyProfile(profile) || !profile) return { skipAi: false, cap: null, hits };

  const title = foldPt(item.title ?? '');
  const desc = foldPt(item.description ?? '');
  const blob = `${title} ${desc}`;
  const entity = foldPt(item.entity ?? '');

  for (const raw of profile.excluded_terms) {
    const term = foldPt(raw);
    if (!term) continue;
    if (blob.includes(term)) {
      hits.push({
        code: 'exclusao_termo',
        text: `Excluído por regra: contém '${raw.trim()}'`,
      });
      return { skipAi: true, cap: 0, hits };
    }
  }

  for (const raw of profile.excluded_entities) {
    const ex = foldPt(raw);
    if (!ex) continue;
    if (entity && (entity.includes(ex) || ex.includes(entity))) {
      hits.push({
        code: 'exclusao_entidade',
        text: 'Excluído por regra: entidade excluída',
      });
      return { skipAi: true, cap: 0, hits };
    }
  }

  let cap: number | null = null;

  if (profile.districts.length > 0) {
    const known = (item.district ?? '').trim();
    if (known) {
      const served = new Set(profile.districts.map(foldPt));
      if (!served.has(foldPt(known))) {
        hits.push({
          code: 'geografia',
          text: `Fora da área geográfica (${known})`,
        });
        cap = cap == null ? 20 : Math.min(cap, 20);
      }
    }
    // distrito desconhecido → não penaliza
  }

  const vmin = profile.value_min;
  const vmax = profile.value_max;
  if ((vmin != null || vmax != null) && item.value != null && Number.isFinite(item.value)) {
    const v = Number(item.value);
    const below = vmin != null && v < vmin;
    const above = vmax != null && v > vmax;
    if (below || above) {
      const shown = v.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
      hits.push({
        code: 'valor',
        text: `Valor fora do intervalo habitual (${shown} €)`,
      });
      cap = cap == null ? 35 : Math.min(cap, 35);
    }
  }

  return { skipAi: false, cap, hits };
}
