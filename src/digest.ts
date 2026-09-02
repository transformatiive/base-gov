import { pool } from './db.js';
import { fmtDatePT } from './mail.js';

const PROFILE_ANNOUNCEMENTS = `
  SELECT DISTINCT sa.announcement_id AS id
  FROM search_announcements sa
  JOIN searches s ON s.id = sa.search_id
  JOIN profile_runs pr ON pr.id = s.profile_run_id
  WHERE pr.profile_id = $1`;

const PROFILE_CONTRACTS = `
  SELECT DISTINCT sr.contract_id AS id
  FROM search_results sr
  JOIN searches s ON s.id = sr.search_id
  JOIN profile_runs pr ON pr.id = s.profile_run_id
  WHERE pr.profile_id = $1`;

const END_DATE = `(c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int))`;
const HAS_END = `c.signing_date IS NOT NULL AND c.execution_deadline ~ '\\d+'`;

export interface DigestData {
  profile: { id: number; name: string; company_id: number };
  newAnns: Record<string, unknown>[];
  openAnns: Record<string, unknown>[];
  renewals: Record<string, unknown>[];
}

export async function digestData(profileId: number): Promise<DigestData | null> {
  const { rows: profRows } = await pool.query('SELECT id, name, company_id FROM profiles WHERE id = $1', [profileId]);
  if (profRows.length === 0) return null;
  const profile = profRows[0];

  const { rows: newAnns } = await pool.query(
    `SELECT a.id, a.contract_designation, a.contracting_entity, a.base_price, a.proposal_deadline_date
       FROM announcements a JOIN (${PROFILE_ANNOUNCEMENTS}) s ON s.id = a.id
      WHERE a.created_at >= now() - interval '7 days' ORDER BY a.proposal_deadline_date NULLS LAST`,
    [profileId]
  );
  const { rows: openAnns } = await pool.query(
    `SELECT a.id, a.contract_designation, a.contracting_entity, a.base_price, a.proposal_deadline_date
       FROM announcements a JOIN (${PROFILE_ANNOUNCEMENTS}) s ON s.id = a.id
      WHERE a.proposal_deadline_date >= CURRENT_DATE ORDER BY a.proposal_deadline_date`,
    [profileId]
  );
  const { rows: renewals } = await pool.query(
    `SELECT c.id, c.object_brief_description, c.initial_contractual_price,
       ${END_DATE} AS end_date, (${END_DATE} - CURRENT_DATE) AS days_left,
       (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
         WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting
     FROM contracts c JOIN (${PROFILE_CONTRACTS}) s ON s.id = c.id
     WHERE ${HAS_END} AND ${END_DATE} BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '90 days'
     ORDER BY end_date LIMIT 12`,
    [profileId]
  );
  return { profile, newAnns, openAnns, renewals };
}

export function digestIsEmpty(d: DigestData): boolean {
  return d.newAnns.length === 0 && d.openAnns.length === 0 && d.renewals.length === 0;
}

export function digestStatsText(d: DigestData): string {
  const ends = d.renewals
    .map((r) => `${r.contracting} (${Number(r.initial_contractual_price ?? 0).toFixed(0)} EUR, termina ${fmtDatePT(r.end_date)})`)
    .slice(0, 6)
    .join('; ');
  return `Novos anúncios (7 dias): ${d.newAnns.length}. Concursos com prazo a decorrer: ${d.openAnns.length}. Contratos a terminar nos próximos 90 dias (oportunidades de renovação): ${d.renewals.length}. Detalhe renovações: ${ends}`;
}

export { PROFILE_ANNOUNCEMENTS, PROFILE_CONTRACTS, END_DATE, HAS_END };
