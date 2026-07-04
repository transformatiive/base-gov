import { createRequire } from 'node:module';
import { pool } from './db.js';
import { config } from './config.js';

const require = createRequire(import.meta.url);
// pdf-parse v1 é CJS
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function aiEnabled(): boolean {
  return Boolean(config.openrouterApiKey);
}

async function chat(model: string, system: string, user: string, maxTokens = 3000): Promise<string> {
  if (!aiEnabled()) throw new Error('IA não configurada (OPENROUTER_API_KEY em falta)');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://basegov-robot-production.up.railway.app',
      'X-Title': 'BaseRadar',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta vazia do modelo');
  return content;
}

/** Extrai o primeiro objeto JSON da resposta (tolerante a cercas de código). */
function parseJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Resposta do modelo sem JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function fetchPdfText(url: string, maxChars = 45_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(60_000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) return null;
    const { text } = await pdfParse(buf);
    const t = text.replace(/\s+\n/g, '\n').trim();
    return t ? t.slice(0, maxChars) : null;
  } catch (err) {
    console.warn(`[ai] falha a extrair PDF ${url}: ${String(err).slice(0, 120)}`);
    return null;
  }
}

async function profileContext(profileId: number): Promise<string> {
  if (!profileId) return 'Sem contexto de atividade específico.';
  const { rows } = await pool.query('SELECT name, terms, cpv_codes FROM profiles WHERE id = $1', [profileId]);
  if (rows.length === 0) return 'Sem contexto de atividade específico.';
  const p = rows[0];
  let cpvDesc = '';
  if ((p.cpv_codes ?? []).length > 0) {
    const { rows: cats } = await pool.query(
      `SELECT code, designation FROM cpv_catalog WHERE split_part(code,'-',1) = ANY($1)`,
      [p.cpv_codes]
    );
    cpvDesc = cats.map((c) => `${c.code} (${c.designation})`).join(', ');
  }
  return `A empresa opera na atividade "${p.name}": palavras-chave ${JSON.stringify(p.terms)}${cpvDesc ? `; códigos CPV: ${cpvDesc}` : ''}.`;
}

/** Ficha de oportunidade + go/no-go para um anúncio, contextualizada à atividade. */
export async function analyzeAnnouncement(announcementId: number, profileId: number): Promise<{ analysis: unknown; cached: boolean; model: string }> {
  const { rows: cached } = await pool.query(
    'SELECT analysis, model FROM ai_analyses WHERE announcement_id = $1 AND profile_id = $2',
    [announcementId, profileId]
  );
  if (cached.length > 0) return { analysis: cached[0].analysis, cached: true, model: cached[0].model };

  const { rows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [announcementId]);
  if (rows.length === 0) throw new Error('Anúncio não encontrado');
  const a = rows[0];

  const pdfText = a.reference_url ? await fetchPdfText(a.reference_url) : null;
  const ctx = await profileContext(profileId);

  const system = `És um analista sénior de contratação pública portuguesa a apoiar a equipa comercial de uma empresa.
${ctx}
Analisa o anúncio de procedimento e responde APENAS com um objeto JSON válido com esta estrutura:
{
 "resumo": "2-3 frases sobre o que a entidade quer comprar",
 "criterios_adjudicacao": "critério(s) e ponderações se indicados, ou 'não especificado no anúncio'",
 "prazos": {"propostas": "...", "execucao": "..."},
 "preco_base": "...",
 "caucao_garantias": "...",
 "requisitos_habilitacao": ["lista de requisitos, alvarás, certificações, seguros exigidos"],
 "red_flags": ["riscos, prazos apertados, critérios estranhos — [] se nenhum"],
 "checklist": ["passos concretos para preparar a proposta, por ordem"],
 "go_no_go": {"recomendacao": "go|condicional|no-go", "justificacao": "1-2 frases, considerando o fit com a atividade da empresa"},
 "fit_atividade": {"score": 0-100, "razao": "1 frase sobre a relevância para a atividade da empresa"}
}`;

  const user = `DADOS ESTRUTURADOS DO ANÚNCIO:
- Designação: ${a.contract_designation}
- Entidade adjudicante: ${a.contracting_entity}
- Tipo: ${a.announcement_type} / ${a.model_type ?? a.contracting_procedure_type}
- Tipo de contrato: ${a.contract_type}
- Preço base: ${a.base_price ?? 'n/d'}
- Publicação DR: ${a.dr_publication_date} · Prazo de propostas: ${a.proposal_deadline_date ?? 'n/d'}
- CPV: ${a.cpvs ?? 'n/d'}
- Peças do procedimento: ${a.contracting_procedure_url ?? 'n/d'}

${pdfText ? `TEXTO DO ANÚNCIO PUBLICADO EM DIÁRIO DA REPÚBLICA:\n${pdfText}` : 'PDF do anúncio indisponível — analisa apenas com os dados estruturados e indica essa limitação no resumo.'}`;

  const model = config.aiModelDeep;
  const raw = await chat(model, system, user, 3500);
  const analysis = parseJson(raw);

  await pool.query(
    `INSERT INTO ai_analyses (announcement_id, profile_id, model, analysis) VALUES ($1,$2,$3,$4)
     ON CONFLICT (announcement_id, profile_id) DO UPDATE SET model = $3, analysis = $4, created_at = now()`,
    [announcementId, profileId, model, JSON.stringify(analysis)]
  );
  return { analysis, cached: false, model };
}

export interface FitItem {
  type: string;
  id: number;
  title: string;
  entity: string;
  value: number | null;
}

/** Fit 0-100 de cada oportunidade face à atividade do perfil (batch, com cache). */
export async function fitScores(profileId: number, items: FitItem[]): Promise<Record<string, { fit: number; reason: string }>> {
  const result: Record<string, { fit: number; reason: string }> = {};
  const missing: FitItem[] = [];

  for (const it of items) {
    const { rows } = await pool.query(
      'SELECT fit, reason FROM ai_fit_scores WHERE profile_id = $1 AND item_type = $2 AND item_id = $3',
      [profileId, it.type, it.id]
    );
    if (rows.length > 0) result[`${it.type}:${it.id}`] = { fit: rows[0].fit, reason: rows[0].reason };
    else missing.push(it);
  }
  if (missing.length === 0) return result;

  const ctx = await profileContext(profileId);
  const batch = missing.slice(0, 60);
  const system = `És um analista comercial de contratação pública. ${ctx}
Para cada oportunidade, avalia o FIT (0-100) com a atividade da empresa: 90+ = núcleo da atividade; 50-89 = adjacente/possível; <50 = fora da atividade.
Responde APENAS com JSON: {"scores": [{"key": "...", "fit": 0-100, "razao": "máx 12 palavras"}]}`;
  const user = batch.map((it) =>
    `key=${it.type}:${it.id} | ${it.type === 'anuncio_aberto' ? 'CONCURSO' : 'RENOVAÇÃO'} | ${it.title?.slice(0, 160)} | entidade: ${it.entity?.slice(0, 60)} | valor: ${it.value ?? 'n/d'}`
  ).join('\n');

  const model = config.aiModelFast;
  const raw = await chat(model, system, user, 4000);
  const parsed = parseJson(raw) as { scores?: { key: string; fit: number; razao: string }[] };

  for (const s of parsed.scores ?? []) {
    const [type, idStr] = String(s.key).split(':');
    const id = Number(idStr);
    if (!type || !Number.isFinite(id)) continue;
    const fit = Math.max(0, Math.min(100, Math.round(s.fit)));
    result[s.key] = { fit, reason: s.razao ?? '' };
    await pool.query(
      `INSERT INTO ai_fit_scores (profile_id, item_type, item_id, fit, reason, model) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (profile_id, item_type, item_id) DO UPDATE SET fit = $4, reason = $5, model = $6, created_at = now()`,
      [profileId, type, id, fit, s.razao ?? '', model]
    );
  }
  return result;
}

/** Parágrafo de análise semanal para o digest (Haiku). */
export async function digestIntro(profileName: string, stats: string): Promise<string> {
  try {
    const raw = await chat(
      config.aiModelFast,
      `És um analista comercial. Escreve um parágrafo único (3-4 frases, português de Portugal, tom profissional e direto) a resumir a semana de oportunidades de contratação pública para a atividade "${profileName}". Sem saudações, sem markdown.`,
      stats,
      400
    );
    return raw.trim();
  } catch {
    return '';
  }
}
