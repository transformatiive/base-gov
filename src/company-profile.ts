import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { requireAuth, auth } from './auth.js';
import { DISTRICTS } from './districts.js';
import { foldPt } from './fit-rules.js';

export const CERT_SUGGESTIONS = [
  'Alvará classe 1',
  'Alvará classe 2',
  'Alvará classe 3',
  'Alvará classe 4',
  'Alvará classe 5',
  'ISO 9001',
  'ISO 14001',
  'ISO 45001',
  'HACCP',
  'Licença de pirotecnia',
  'Segurança privada',
];

export interface CompanyProfileRow {
  company_id: number;
  description: string | null;
  certifications: string[];
  districts: string[];
  value_min: number | null;
  value_max: number | null;
  excluded_terms: string[];
  excluded_entities: string[];
  version: number;
  updated_at: Date;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
}

function normEntities(v: unknown): string[] {
  return [...new Set(strArr(v).map((s) => foldPt(s)).filter(Boolean))];
}

export async function loadCompanyProfile(companyId: number): Promise<CompanyProfileRow | null> {
  const { rows } = await pool.query('SELECT * FROM company_profiles WHERE company_id = $1', [companyId]);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    company_id: r.company_id,
    description: r.description,
    certifications: r.certifications ?? [],
    districts: r.districts ?? [],
    value_min: r.value_min != null ? Number(r.value_min) : null,
    value_max: r.value_max != null ? Number(r.value_max) : null,
    excluded_terms: r.excluded_terms ?? [],
    excluded_entities: r.excluded_entities ?? [],
    version: Number(r.version ?? 1),
    updated_at: r.updated_at,
  };
}

export function companyProfileContext(p: CompanyProfileRow | null): string {
  if (!p) return '';
  const bits: string[] = [];
  if (p.description) bits.push(`Descrição: ${p.description}`);
  if (p.certifications.length) bits.push(`Certificações/alvarás: ${p.certifications.join(', ')}`);
  if (p.districts.length) bits.push(`Distritos onde executa: ${p.districts.join(', ')}`);
  if (p.value_min != null || p.value_max != null) {
    bits.push(`Intervalo de valor em que concorre: ${p.value_min ?? 'sem mínimo'} – ${p.value_max ?? 'sem máximo'} €`);
  }
  if (p.excluded_terms.length) bits.push(`Nunca faz (termos): ${p.excluded_terms.join(', ')}`);
  if (p.excluded_entities.length) bits.push(`Entidades excluídas: ${p.excluded_entities.join(', ')}`);
  if (bits.length === 0) return '';
  return `PERFIL DA EMPRESA (capacidades reais, distinto da atividade de pesquisa):\n${bits.join('\n')}`;
}

function toJson(p: CompanyProfileRow | null, companyId: number) {
  return {
    company_id: companyId,
    description: p?.description ?? '',
    certifications: p?.certifications ?? [],
    districts: p?.districts ?? [],
    value_min: p?.value_min ?? null,
    value_max: p?.value_max ?? null,
    excluded_terms: p?.excluded_terms ?? [],
    excluded_entities: p?.excluded_entities ?? [],
    version: p?.version ?? 1,
    updated_at: p?.updated_at ?? null,
    suggestions: { certifications: CERT_SUGGESTIONS, districts: DISTRICTS },
  };
}

export async function registerCompanyProfileRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/company/profile', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const p = await loadCompanyProfile(companyId);
    return toJson(p, companyId);
  });

  app.put('/api/company/profile', { preHandler: requireAuth }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const description = String(b.description ?? '').trim() || null;
    const certifications = strArr(b.certifications);
    const districts = strArr(b.districts);
    const valueMin = numOrNull(b.value_min);
    const valueMax = numOrNull(b.value_max);
    if (valueMin != null && valueMax != null && valueMax <= valueMin) {
      return reply.code(400).send({
        error: { code: 'invalid_range', message: 'O valor máximo tem de ser superior ao mínimo' },
      });
    }
    const excludedTerms = strArr(b.excluded_terms);
    const excludedEntities = normEntities(b.excluded_entities);

    const { rows } = await pool.query(
      `INSERT INTO company_profiles (
         company_id, description, certifications, districts, value_min, value_max,
         excluded_terms, excluded_entities, version, updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,now())
       ON CONFLICT (company_id) DO UPDATE SET
         description = EXCLUDED.description,
         certifications = EXCLUDED.certifications,
         districts = EXCLUDED.districts,
         value_min = EXCLUDED.value_min,
         value_max = EXCLUDED.value_max,
         excluded_terms = EXCLUDED.excluded_terms,
         excluded_entities = EXCLUDED.excluded_entities,
         version = company_profiles.version + 1,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [companyId, description, certifications, districts, valueMin, valueMax, excludedTerms, excludedEntities, userId]
    );
    const p = await loadCompanyProfile(companyId);
    return toJson(p ?? {
      company_id: companyId,
      description: rows[0].description,
      certifications: rows[0].certifications ?? [],
      districts: rows[0].districts ?? [],
      value_min: rows[0].value_min != null ? Number(rows[0].value_min) : null,
      value_max: rows[0].value_max != null ? Number(rows[0].value_max) : null,
      excluded_terms: rows[0].excluded_terms ?? [],
      excluded_entities: rows[0].excluded_entities ?? [],
      version: Number(rows[0].version),
      updated_at: rows[0].updated_at,
    }, companyId);
  });
}

/** Usado pelo PUT de feedback «adicionar distrito». */
export async function patchCompanyProfile(
  companyId: number,
  userId: number | null,
  patch: Partial<{ districts: string[]; excluded_entities: string[]; excluded_terms: string[] }>
): Promise<void> {
  const cur = await loadCompanyProfile(companyId);
  const districts = patch.districts
    ? [...new Set([...(cur?.districts ?? []), ...patch.districts])]
    : cur?.districts ?? [];
  const excluded_entities = patch.excluded_entities
    ? [...new Set([...(cur?.excluded_entities ?? []), ...patch.excluded_entities.map(foldPt)])]
    : cur?.excluded_entities ?? [];
  const excluded_terms = patch.excluded_terms
    ? [...new Set([...(cur?.excluded_terms ?? []), ...patch.excluded_terms])]
    : cur?.excluded_terms ?? [];
  await pool.query(
    `INSERT INTO company_profiles (company_id, districts, excluded_entities, excluded_terms, version, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,1,$5,now())
     ON CONFLICT (company_id) DO UPDATE SET
       districts = EXCLUDED.districts,
       excluded_entities = EXCLUDED.excluded_entities,
       excluded_terms = EXCLUDED.excluded_terms,
       version = company_profiles.version + 1,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [companyId, districts, excluded_entities, excluded_terms, userId]
  );
}

export async function requireCompany(req: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  const { companyId } = auth(req);
  if (companyId == null) {
    reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa.' } });
    return null;
  }
  return companyId;
}
