import { pool } from './db.js';
import { config } from './config.js';
import { chat, gatherAnnouncementDocs, parseJson, userWithCachedPrefix, type AiUsage } from './ai.js';
import {
  STANDARD_CHAPTERS,
  emptyRequirements,
  flattenRequirements,
  type GapItem,
  type GapStatus,
  type ProposalCompanyProfile,
  type ProposalSection,
  type RequirementItem,
  type RequirementsExtraction,
} from './proposals.js';
import { clampForecastPct, type ComparableAward, type StatisticalForecast } from './closeForecast.js';

function asString(v: unknown): string {
  return v == null ? '' : String(v);
}

function asItems(raw: unknown, category: RequirementItem['category']): RequirementItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(o.id) || `${category}-${i + 1}`,
      category,
      title: asString(o.title).trim() || `Requisito ${i + 1}`,
      detail: asString(o.detail),
      mandatory: o.mandatory !== false,
      legal: o.legal === true,
    };
  }).filter((r) => r.title);
}

function normalizeExtraction(raw: unknown): RequirementsExtraction {
  const o = (raw ?? {}) as Record<string, unknown>;
  const fmt = (o.formato ?? {}) as Record<string, unknown>;
  const prazos = (o.prazos ?? {}) as Record<string, unknown>;
  const chapters = Array.isArray(fmt.chapters)
    ? (fmt.chapters as unknown[]).map((c) => String(c).trim()).filter(Boolean)
    : [];
  const specified = fmt.specified === true && chapters.length > 0;
  const criterios = Array.isArray(o.criterios) ? o.criterios as Record<string, unknown>[] : [];
  const base = emptyRequirements();
  return {
    admissao: asItems(o.admissao, 'admissao'),
    tecnicos: asItems(o.tecnicos, 'tecnico'),
    criterios: criterios.map((c, i) => ({
      id: asString(c.id) || `criterio-${i + 1}`,
      title: asString(c.title).trim() || `Critério ${i + 1}`,
      weight_pct: c.weight_pct == null || c.weight_pct === '' ? null : Number(c.weight_pct),
      detail: asString(c.detail),
    })),
    documentos: asItems(o.documentos, 'documento'),
    formato: {
      specified,
      chapters: specified ? chapters : [...STANDARD_CHAPTERS],
      page_limit: fmt.page_limit != null && fmt.page_limit !== '' ? Number(fmt.page_limit) : null,
      notes: asString(fmt.notes),
    },
    prazos: {
      submissao: asString(prazos.submissao) || null,
      esclarecimentos: asString(prazos.esclarecimentos) || null,
      execucao: asString(prazos.execucao) || null,
    },
    legal_declarations: Array.isArray(o.legal_declarations)
      ? (o.legal_declarations as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [],
    notes: asString(o.notes),
  };
}

function announcementBlock(a: Record<string, unknown>, pdfText: string | null, procText: string, docsCount: number): string {
  return `DADOS ESTRUTURADOS DO ANÚNCIO:
- Designação: ${a.contract_designation}
- Entidade adjudicante: ${a.contracting_entity}
- Tipo: ${a.announcement_type} / ${a.model_type ?? a.contracting_procedure_type}
- Tipo de contrato: ${a.contract_type}
- Preço base: ${a.base_price ?? 'n/d'}
- Publicação DR: ${a.dr_publication_date} · Prazo de propostas: ${a.proposal_deadline_date ?? 'n/d'}
- CPV: ${a.cpvs ?? 'n/d'}
- Peças do procedimento: ${a.contracting_procedure_url ?? 'n/d'}

${pdfText ? `TEXTO DO ANÚNCIO PUBLICADO EM DIÁRIO DA REPÚBLICA:\n${pdfText}\n` : ''}${procText ? `PEÇAS DO PROCEDIMENTO (caderno de encargos / programa, ${docsCount} documento(s)):\n${procText}` : ''}${!pdfText && !procText ? 'Sem documentos acessíveis — extrai apenas com os dados estruturados e assinala a limitação em notes.' : ''}`;
}

export async function extractAnnouncementRequirements(announcementId: number): Promise<{
  extraction: RequirementsExtraction;
  cached: boolean;
  model: string;
  docs_used: number;
  usage: AiUsage;
}> {
  const { rows: hit } = await pool.query(
    'SELECT extraction, model FROM announcement_requirements WHERE announcement_id = $1',
    [announcementId]
  );
  if (hit.length > 0) {
    return {
      extraction: hit[0].extraction as RequirementsExtraction,
      cached: true,
      model: hit[0].model,
      docs_used: -1,
      usage: { tokens_in: 0, tokens_out: 0 },
    };
  }
  const { rows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [announcementId]);
  if (rows.length === 0) throw Object.assign(new Error('Anúncio não encontrado'), { statusCode: 404 });
  const a = rows[0];
  const { pdfText, procText, docsCount } = await gatherAnnouncementDocs(a);
  const { rows: an } = await pool.query(
    'SELECT analysis FROM ai_analyses WHERE announcement_id = $1 ORDER BY created_at DESC LIMIT 1',
    [announcementId]
  );

  const system = `És um analista sénior de contratação pública portuguesa (CCP). Extrai uma CHECKLIST ESTRUTURADA de requisitos da proposta a partir do anúncio e das peças do procedimento.
Não inventes requisitos que não estejam no texto. Se um campo não estiver no documento, deixa a lista vazia ou o valor a null.
Responde APENAS com JSON:
{
  "admissao": [{"id":"a1","title":"...","detail":"...","mandatory":true}],
  "tecnicos": [{"id":"t1","title":"...","detail":"...","mandatory":true}],
  "criterios": [{"id":"c1","title":"Preço","weight_pct":60,"detail":"..."}],
  "documentos": [{"id":"d1","title":"DEUCP","detail":"...","mandatory":true,"legal":true}],
  "formato": {"specified": false, "chapters": [], "page_limit": null, "notes": ""},
  "prazos": {"submissao":"...","esclarecimentos":null,"execucao":"..."},
  "legal_declarations": ["DEUCP", "declaração sob compromisso de honra"],
  "notes": "limitações da extração, se as houver"
}
formato.specified=true SÓ se o caderno/programa exigir uma estrutura de capítulos ou limite de páginas.
documentos.legal=true para declarações que exigem assinatura (DEUCP, honra) — a aplicação NÃO as redige, só aponta que são necessárias.`;

  const model = config.aiModelDeep;
  const { content, usage } = await chat(
    model,
    system,
    userWithCachedPrefix(
      announcementBlock(a, pdfText, procText, docsCount),
      an.length ? `ANÁLISE PRÉVIA (usa como pista, mas confirma no texto):\n${JSON.stringify(an[0].analysis).slice(0, 5000)}` : '',
    ),
    4000,
    'proposta-extract',
  );
  const extraction = normalizeExtraction(parseJson(content));
  await pool.query(
    `INSERT INTO announcement_requirements (announcement_id, extraction, model)
     VALUES ($1,$2,$3)
     ON CONFLICT (announcement_id) DO UPDATE SET extraction = $2, model = $3, updated_at = now()`,
    [announcementId, JSON.stringify(extraction), model]
  );
  return { extraction, cached: false, model, docs_used: docsCount, usage };
}

function profileBlock(p: ProposalCompanyProfile): string {
  return `PERFIL DA EMPRESA (usa só estes factos; o que faltar vira [A COMPLETAR: …], nunca inventes):
- Denominação: ${p.legal_name ?? 'n/d'}
- NIF: ${p.nif ?? 'n/d'} · CAE: ${p.cae ?? 'n/d'}
- Habilitações/certidões: ${p.certifications.length ? p.certifications.join('; ') : 'n/d'}
- Capacidades técnicas: ${p.technical_capabilities ?? 'n/d'}
- Portefólio: ${p.portfolio ?? 'n/d'}
- Referências: ${p.references.length ? JSON.stringify(p.references) : 'nenhuma'}
- Equipa-chave: ${p.key_team.length ? JSON.stringify(p.key_team) : 'n/d'}
- Notas: ${p.notes ?? '—'}`;
}

export async function generateProposalSections(opts: {
  announcement: Record<string, unknown>;
  extraction: RequirementsExtraction;
  profile: ProposalCompanyProfile;
  bidPrice: number | null;
}): Promise<{ sections: ProposalSection[]; structure: 'caderno' | 'standard'; structure_note: string; usage: AiUsage; model: string }> {
  const chapters = opts.extraction.formato.specified && opts.extraction.formato.chapters.length
    ? opts.extraction.formato.chapters
    : [...STANDARD_CHAPTERS];
  const structure = opts.extraction.formato.specified ? 'caderno' : 'standard';
  const system = `És um redator sénior de propostas de contratação pública portuguesa.
Geras um RASCUNHO de proposta em JSON, secção a secção, cruzando o perfil da empresa com os requisitos extraídos.
REGRAS:
- NÃO inventes factos (obras, certificados, pessoas, números) que não estejam no perfil.
- Onde faltar informação, escreve exactamente o marcador [A COMPLETAR: descrição do que falta] — nunca um texto plausível inventado.
- NÃO redijas DEUCP nem declarações sob compromisso de honra; numa secção "Documentos legais a anexar" limita-te a listá-los.
- A aplicação NUNCA submete a proposta; o tom é de rascunho de trabalho.
Responde APENAS com JSON:
{"structure_note":"1 frase","sections":[{"title":"...","body":"parágrafos separados por linha em branco"}]}
As secções DEVEM seguir esta ordem e estes títulos: ${JSON.stringify(chapters)}.`;

  const model = config.aiModelDeep;
  const { content, usage } = await chat(
    model,
    system,
    userWithCachedPrefix(
      `${profileBlock(opts.profile)}\n\nREQUISITOS EXTRAÍDOS:\n${JSON.stringify(opts.extraction).slice(0, 12_000)}`,
      `ANÚNCIO:
- ${opts.announcement.contract_designation} · ${opts.announcement.contracting_entity}
- Preço base: ${opts.announcement.base_price ?? 'n/d'}
- Preço a apresentar (se o utilizador o definiu): ${opts.bidPrice ?? 'não indicado — usa [A COMPLETAR: preço da proposta] na secção de Preço'}
- CPV: ${opts.announcement.cpvs ?? 'n/d'}`,
    ),
    7000,
    'proposta-draft',
  );
  const parsed = parseJson(content) as { structure_note?: string; sections?: { title?: string; body?: string }[] };
  const byTitle = new Map((parsed.sections ?? []).map((s) => [String(s.title ?? '').trim().toLowerCase(), s]));
  const sections: ProposalSection[] = chapters.map((title) => {
    const hit = byTitle.get(title.toLowerCase());
    const body = String(hit?.body ?? '').trim()
      || `[A COMPLETAR: redigir a secção «${title}» com base no caderno de encargos e no perfil da empresa]`;
    return { title, body };
  });
  if (opts.extraction.legal_declarations.length) {
    sections.push({
      title: 'Documentos legais a anexar (não gerados)',
      body: `A aplicação não gera documentos que exigem assinatura. Anexar manualmente no portal:\n\n${opts.extraction.legal_declarations.map((d) => `• ${d}`).join('\n')}`,
    });
  }
  return {
    sections,
    structure,
    structure_note: parsed.structure_note
      || (structure === 'caderno'
        ? 'Estrutura seguida do caderno de encargos / programa do concurso.'
        : 'O caderno não impõe formato — usada a estrutura standard PrepBid.'),
    usage,
    model,
  };
}

function parseGapStatus(v: unknown): GapStatus {
  const s = String(v ?? '');
  if (s === 'conforme' || s === 'incompleto' || s === 'em_falta') return s;
  return 'em_falta';
}

export async function reevaluateProposalGaps(opts: {
  extraction: RequirementsExtraction;
  proposalText: string;
}): Promise<{ items: GapItem[]; usage: AiUsage; model: string }> {
  const checklist = flattenRequirements(opts.extraction);
  const system = `És um revisor de propostas de contratação pública. Compara o TEXTO da proposta editada com a CHECKLIST de requisitos extraída do caderno.
Para cada requisito, classifica:
- "conforme": o texto cobre o requisito de forma suficiente
- "incompleto": é mencionado mas falta substância, evidência ou detalhe
- "em_falta": não há rasto no texto
NÃO reescrevas a proposta. NÃO sejas generoso com declarações legais (DEUCP etc.): se não estiverem no texto, "em_falta".
Responde APENAS com JSON:
{"items":[{"requirement_id":"...","status":"conforme|incompleto|em_falta","note":"frase curta"}]}`;

  const model = config.aiModelDeep;
  const { content, usage } = await chat(
    model,
    system,
    userWithCachedPrefix(
      `CHECKLIST:\n${JSON.stringify(checklist).slice(0, 10_000)}`,
      `TEXTO DA PROPOSTA:\n${opts.proposalText.slice(0, 40_000)}`,
    ),
    4000,
    'proposta-gaps',
  );
  const parsed = parseJson(content) as { items?: { requirement_id?: string; status?: string; note?: string }[] };
  const byId = new Map((parsed.items ?? []).map((i) => [String(i.requirement_id), i]));
  const items: GapItem[] = checklist.map((req) => {
    const hit = byId.get(req.id);
    return {
      requirement_id: req.id,
      title: req.title,
      category: req.category,
      status: parseGapStatus(hit?.status),
      note: asString(hit?.note) || (hit ? '' : 'Sem classificação devolvida pelo modelo — tratado como em falta.'),
      legal: req.legal,
    };
  });
  return { items, usage, model };
}

export async function qualifyCloseForecast(opts: {
  announcement: {
    designation: string | null;
    entity: string | null;
    base_price: number | null;
    cpvs: string | null;
    procedure_type: string | null;
    contract_type: string | null;
  };
  statistical: StatisticalForecast;
  comparables: ComparableAward[];
}): Promise<{
  low_pct: number;
  high_pct: number;
  justificacao: string;
  fatores: string[];
  usage: AiUsage;
  model: string;
}> {
  const system = `És um analista de preços de contratação pública portuguesa. A camada estatística já calculou um intervalo de fecho com base em histórico. Qualifica esse intervalo quando a amostra é pequena ou há fatores não-numéricos (complexidade, urgência, tipo de procedimento, entidade).
NÃO inventes uma métrica de confiança percentual (ex.: "80% de confiança"). Usa linguagem de "estimativa baseada em histórico".
Responde APENAS com JSON:
{"low_pct":0.70,"high_pct":0.82,"justificacao":"2-4 frases","fatores":["..."]}`;

  const model = config.aiModelFast;
  const { content, usage } = await chat(
    model,
    system,
    userWithCachedPrefix(
      `CAMADA ESTATÍSTICA:
${JSON.stringify({
    sample_size: opts.statistical.sample_size,
    entity_sample_size: opts.statistical.entity_sample_size,
    match_level: opts.statistical.match_level,
    low_pct: opts.statistical.low_pct,
    high_pct: opts.statistical.high_pct,
    mid_pct: opts.statistical.mid_pct,
    note: opts.statistical.note,
    confidence: opts.statistical.confidence,
  })}

CONCURSOS HISTÓRICOS MAIS SEMELHANTES:
${opts.comparables.slice(0, 12).map((c) =>
    `- ${c.publication_date} · ${c.entity} · adjudicado ${c.awarded} · base hist. ${c.historical_base ?? 'n/d'} · rácio ${c.ratio.toFixed(2)} (${c.ratio_source}) · ${c.title?.slice(0, 80)}`
  ).join('\n')}`,
      `ANÚNCIO: ${opts.announcement.designation} · entidade ${opts.announcement.entity}
Preço base: ${opts.announcement.base_price} · CPV ${opts.announcement.cpvs} · ${opts.announcement.procedure_type} · ${opts.announcement.contract_type}`,
    ),
    1200,
    'fecho-qualifica',
  );
  const parsed = parseJson(content) as { low_pct?: number; high_pct?: number; justificacao?: string; fatores?: string[] };
  const low = clampForecastPct(Number(parsed.low_pct ?? opts.statistical.low_pct ?? 0.7));
  let high = clampForecastPct(Number(parsed.high_pct ?? opts.statistical.high_pct ?? 0.9));
  if (high < low) high = low;
  return {
    low_pct: low,
    high_pct: high,
    justificacao: asString(parsed.justificacao).trim() || opts.statistical.note,
    fatores: Array.isArray(parsed.fatores) ? parsed.fatores.map((f) => String(f)).slice(0, 6) : [],
    usage,
    model,
  };
}
