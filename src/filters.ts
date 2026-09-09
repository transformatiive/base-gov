import { Plan, hasCapability } from './plans.js';
import { announcementDistrictSql, CONTRACT_DISTRICT_SQL } from './districts.js';

export class PlanRequiredError extends Error {
  readonly feature = 'filtros_avancados';
  constructor() {
    super('Esta funcionalidade requer o plano PRO.');
    this.name = 'PlanRequiredError';
  }
}

export type ListKind = 'announcements' | 'contracts' | 'opportunities';

export interface ListFilterResult {
  where: string[];
  params: unknown[];
  orderBy: string;
  excludedNoValue: boolean;
}

function asList(v: unknown): string[] {
  if (v == null || v === '') return [];
  const arr = Array.isArray(v) ? v : String(v).split(',');
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

function first(q: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (q[k] != null && q[k] !== '') return q[k];
  }
  return undefined;
}

function wantsAdvanced(query: Record<string, unknown>): boolean {
  if (query.value_min != null && query.value_min !== '') return true;
  if (query.value_max != null && query.value_max !== '') return true;
  if (asList(query.procedure ?? query['procedure[]']).length > 0) return true;
  if (String(query.entity ?? '').trim() !== '') return true;
  if (asList(query.cpv ?? query['cpv[]']).length > 0) return true;
  const sort = String(query.sort ?? '');
  if (sort === 'score' || sort === 'fit' || sort === 'value' || sort === 'published') return true;
  return false;
}

/**
 * Valida querystring, aplica gating e devolve fragmentos SQL.
 * `alias` = prefixo da tabela (a / c). `paramOffset` = nº de params já usados.
 */
export function listFilters(
  query: Record<string, unknown>,
  plan: Plan,
  kind: ListKind,
  alias: 'a' | 'c',
  paramOffset = 0
): ListFilterResult {
  if (wantsAdvanced(query) && !hasCapability(plan, 'filtros_avancados')) {
    throw new PlanRequiredError();
  }

  const where: string[] = [];
  const params: unknown[] = [];
  const add = (fragment: string, ...vals: unknown[]) => {
    let sql = fragment;
    for (const v of vals) {
      params.push(v);
      sql = sql.replace('?', `$${paramOffset + params.length}`);
    }
    where.push(sql);
  };

  const q = String(query.q ?? '').trim();
  if (q) {
    const like = `%${q}%`;
    if (alias === 'a') add(`(${alias}.contract_designation ILIKE ? OR ${alias}.contracting_entity ILIKE ?)`, like, like);
    else add(`(${alias}.object_brief_description ILIKE ? OR coalesce(${alias}.description,'') ILIKE ?)`, like, like);
  }

  const districts = asList(query.district ?? query['district[]']);
  if (districts.length) {
    const expr = alias === 'a' ? announcementDistrictSql(`${alias}.contracting_entity`) : CONTRACT_DISTRICT_SQL;
    const named = districts.filter((d) => d !== '__unknown__' && !/sem localização/i.test(d));
    const unknown = named.length !== districts.length;
    const parts: string[] = [];
    if (named.length) {
      const ph = named.map((d) => {
        params.push(d);
        return `$${paramOffset + params.length}`;
      });
      parts.push(`${expr} IN (${ph.join(',')})`);
    }
    if (unknown) parts.push(`${expr} IS NULL`);
    if (parts.length) where.push(`(${parts.join(' OR ')})`);
  }

  const deadline = Number(first(query, 'deadline_within', 'deadline') ?? 0);
  if (deadline === 7 || deadline === 15 || deadline === 30 || deadline === 60) {
    if (alias === 'a') {
      add(`${alias}.proposal_deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ?::int`, deadline);
    } else {
      add(
        `(c.signing_date IS NOT NULL AND c.execution_deadline ~ '\\d+' AND (c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int)) BETWEEN CURRENT_DATE AND CURRENT_DATE + ?::int)`,
        deadline
      );
    }
  }

  let excludedNoValue = false;
  const vmin = query.value_min != null && query.value_min !== '' ? Number(query.value_min) : null;
  const vmax = query.value_max != null && query.value_max !== '' ? Number(query.value_max) : null;
  const valueCol = alias === 'a' ? `${alias}.base_price` : `${alias}.initial_contractual_price`;
  if (vmin != null && Number.isFinite(vmin)) {
    add(`${valueCol} >= ?`, vmin);
    excludedNoValue = true;
  }
  if (vmax != null && Number.isFinite(vmax)) {
    add(`${valueCol} <= ?`, vmax);
    excludedNoValue = true;
  }

  const procedures = asList(query.procedure ?? query['procedure[]']);
  if (procedures.length) {
    const ph = procedures.map((p) => {
      params.push(p);
      return `$${paramOffset + params.length}`;
    });
    where.push(`${alias}.contracting_procedure_type IN (${ph.join(',')})`);
  }

  const entity = String(query.entity ?? '').trim();
  if (entity) {
    if (alias === 'a') add(`${alias}.contracting_entity ILIKE ?`, `%${entity}%`);
    else {
      add(
        `EXISTS (
          SELECT 1 FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
           WHERE ce.contract_id = c.id AND ce.role = 'contracting' AND e.name ILIKE ?
        )`,
        `%${entity}%`
      );
    }
  }

  const cpvs = asList(query.cpv ?? query['cpv[]']);
  if (cpvs.length) {
    const parts = cpvs.map((code) => {
      const prefix = code.replace(/\D/g, '').slice(0, 8);
      params.push(`${prefix}%`);
      return `${alias}.cpvs ILIKE $${paramOffset + params.length}`;
    });
    where.push(`(${parts.join(' OR ')})`);
  }

  const sort = String(query.sort ?? '');
  const order = String(query.order ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const deadlineCol = alias === 'a'
    ? `${alias}.proposal_deadline_date`
    : `(c.signing_date + (substring(c.execution_deadline from '(\\d+)')::int))`;
  const pubCol = alias === 'a' ? `${alias}.dr_publication_date` : `${alias}.publication_date`;

  let orderBy: string;
  switch (sort) {
    case 'value':
      orderBy = `${valueCol} ${order} NULLS LAST`;
      break;
    case 'published':
      orderBy = `${pubCol} ${order} NULLS LAST`;
      break;
    case 'deadline':
      orderBy = `${deadlineCol} ${order} NULLS LAST`;
      break;
    case 'score':
    case 'fit':
      orderBy = `${deadlineCol} ASC NULLS LAST`;
      break;
    default:
      orderBy = `${deadlineCol} ASC NULLS LAST`;
      break;
  }
  void kind;
  return { where, params, orderBy, excludedNoValue };
}

export function queryArray(q: Record<string, unknown>, key: string): string[] {
  return asList(q[key] ?? q[`${key}[]`]);
}
