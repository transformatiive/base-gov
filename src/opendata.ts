import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import yauzl from 'yauzl';
// stream-json não publica types ESM completos — importar via createRequire.
import { createRequire } from 'node:module';
import { pool } from './db.js';
import { matchLocalCorpus } from './scraper/worker.js';
import { refreshCpvCatalog } from './cpv.js';

const require = createRequire(import.meta.url);
// stream-json v1 (CJS): parser + StreamArray clássicos
const { parser } = require('stream-json') as { parser: () => NodeJS.ReadWriteStream };
const { streamArray } = require('stream-json/streamers/StreamArray') as {
  streamArray: () => NodeJS.ReadWriteStream & AsyncIterable<{ key: number; value: unknown }>;
};

const DATASET_CONTRATOS = '66d72d488ca4b7cb2de28712'; // Contratos Públicos - Portal BASE - IMPIC (2012-2026)
const CATALOG_URL = `https://dados.gov.pt/api/1/datasets/${DATASET_CONTRATOS}/`;
/** Ano corrente + anterior: é aí que o IMPIC ainda acrescenta e corrige contratos. */
export const OPENDATA_LOOKBACK_YEARS = 2;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type ImpicResource = {
  title: string;
  url: string;
  filesize?: number;
  last_modified?: string | null;
  checksum?: { type?: string; value?: string } | string | null;
};

export type UpsertKind = 'insert' | 'update' | 'skip';

export function yearFromResourceTitle(title: string): number | null {
  const m = /^contratos(\d{4})\.(zip|xlsx)$/i.exec(title.trim());
  return m ? Number(m[1]) : null;
}

export function resourceFingerprint(r: ImpicResource): string | null {
  const c = r.checksum;
  const value = typeof c === 'string' ? c : c?.value;
  const type = (typeof c === 'object' && c?.type) || 'sha1';
  if (value) return `${type}:${value}`;
  if (r.filesize && r.last_modified) return `meta:${r.filesize}:${r.last_modified}`;
  return null;
}

export function pickYearAssets(
  resources: ImpicResource[],
  year: number,
): {
  zip: string | null;
  xlsx: string | null;
  fingerprint: string | null;
  last_modified: string | null;
  filesize: number | null;
} {
  const zip = resources.find((r) => r.title === `contratos${year}.zip` && (r.filesize ?? 0) > 1000);
  const xlsx = resources.find((r) => r.title === `contratos${year}.xlsx` && (r.filesize ?? 0) > 1000);
  const primary = zip ?? xlsx ?? null;
  return {
    zip: zip?.url ?? null,
    xlsx: xlsx?.url ?? null,
    fingerprint: primary ? resourceFingerprint(primary) : null,
    last_modified: primary?.last_modified ?? null,
    filesize: primary?.filesize ?? null,
  };
}

export function yearsDueForRefresh(
  resources: ImpicResource[],
  completed: { year: number; source_checksum: string | null }[],
  nowYear: number,
  lookbackYears = OPENDATA_LOOKBACK_YEARS,
): { year: number; fingerprint: string; last_modified: string | null; filesize: number | null }[] {
  const latest = new Map<number, string | null>();
  for (const row of completed) {
    if (!latest.has(row.year)) latest.set(row.year, row.source_checksum);
  }
  const due: { year: number; fingerprint: string; last_modified: string | null; filesize: number | null }[] = [];
  for (let y = nowYear; y > nowYear - lookbackYears; y--) {
    const assets = pickYearAssets(resources, y);
    if (!assets.fingerprint) continue;
    if (latest.get(y) === assets.fingerprint) continue;
    due.push({
      year: y,
      fingerprint: assets.fingerprint,
      last_modified: assets.last_modified,
      filesize: assets.filesize,
    });
  }
  return due;
}

export async function fetchImpicCatalog(fetchImpl: typeof fetch = fetch): Promise<ImpicResource[]> {
  const res = await fetchImpl(CATALOG_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`dados.gov.pt HTTP ${res.status}`);
  const data = (await res.json()) as { resources?: ImpicResource[] };
  return data.resources ?? [];
}

function lisbonYear(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric' }).format(d),
  );
}

/** Registo do JSON anual do IMPIC (campos usados; o resto fica no raw). */
interface OpenDataContract {
  idcontrato: string;
  objectoContrato?: string;
  descContrato?: string;
  tipoprocedimento?: string;
  tipoContrato?: string[];
  adjudicante?: string[];
  adjudicatarios?: string[];
  concorrentes?: string[] | null;
  dataPublicacao?: string;
  dataCelebracaoContrato?: string;
  dataFechoContrato?: string;
  precoContratual?: number;
  PrecoTotalEfetivo?: number;
  cpv?: string[];
  prazoExecucao?: number;
  localExecucao?: string[];
  fundamentacao?: string;
  regime?: string;
  linkPecasProc?: string;
  ProcedimentoCentralizado?: string;
  ContratEcologico?: string;
  /** datas já em ISO quando a origem é XLSX (seriais Excel convertidos) */
  _datesIso?: { pub: string | null; sign: string | null; close: string | null };
  [k: string]: unknown;
}

function opendataPayload(rec: OpenDataContract): Record<string, unknown> {
  const { _datesIso: _iso, ...rest } = rec;
  return rest;
}

/** "12/04/2026" → "2026-04-12" */
function parseSlashDate(v: string | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "513854363 - Code Five, Lda" → {nif, name} */
function parseEntityRef(v: string): { nif: string; name: string } | null {
  const s = v?.trim();
  if (!s) return null;
  const m = /^(\d{9})\s*-\s*(.+)$/.exec(s);
  return m ? { nif: m[1], name: m[2].trim() } : { nif: '', name: s };
}

/** Resolve os URLs (zip JSON e xlsx) do ano no dados.gov.pt. */
export async function resolveYearUrls(year: number): Promise<{
  zip: string | null;
  xlsx: string | null;
  fingerprint: string | null;
  last_modified: string | null;
  filesize: number | null;
}> {
  const resources = await fetchImpicCatalog();
  const assets = pickYearAssets(resources, year);
  if (!assets.zip && !assets.xlsx) throw new Error(`Sem recursos para o ano ${year} no dataset do IMPIC`);
  return assets;
}

/** Abre o primeiro ficheiro do zip como stream. */
function openZipEntryStream(buffer: Buffer): Promise<Readable> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error('zip inválido'));
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        zipfile.openReadStream(entry, (err2, stream) => {
          if (err2 || !stream) return reject(err2 ?? new Error('erro a abrir entrada do zip'));
          resolve(stream as Readable);
        });
      });
      zipfile.on('error', reject);
    });
  });
}

async function withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // 40P01 = deadlock com outro worker (upserts concorrentes em entities) — repetir resolve
      if (attempt < 3 && /deadlock/i.test(String(err))) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function upsertOpenDataContract(rec: OpenDataContract): Promise<UpsertKind | null> {
  const basegovId = Number(rec.idcontrato);
  if (!Number.isFinite(basegovId)) return null;

  const cpvCodes = (rec.cpv ?? []).map((c) => c.split(' - ')[0].trim()).filter(Boolean).join('; ');
  const cpvNames = (rec.cpv ?? []).map((c) => c.split(' - ').slice(1).join(' - ').trim()).filter(Boolean).join('; ');
  const payload = opendataPayload(rec);

  // Detalhe do site: não reescrever texto já scraped. Fecho e preço efectivo
  // (campos que o IMPIC actualiza depois) entram sempre que o JSON mudou.
  const { rows } = await pool.query(
    `INSERT INTO contracts (basegov_id, description, object_brief_description,
       contracting_procedure_type, contract_types, publication_date, signing_date, close_date,
       execution_deadline, execution_place, initial_contractual_price, total_effective_price,
       cpvs, cpvs_designation, contract_fundamentation, regime, contracting_procedure_url,
       centralized_procedure, ambient_criteria, raw_list_json, raw_opendata_json, opendata_imported, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'{}',$20,true, now())
     ON CONFLICT (basegov_id) DO UPDATE SET
       description = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.description ELSE EXCLUDED.description END,
       object_brief_description = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.object_brief_description ELSE EXCLUDED.object_brief_description END,
       contracting_procedure_type = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.contracting_procedure_type ELSE EXCLUDED.contracting_procedure_type END,
       contract_types = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.contract_types ELSE EXCLUDED.contract_types END,
       publication_date = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.publication_date ELSE EXCLUDED.publication_date END,
       signing_date = COALESCE(EXCLUDED.signing_date, contracts.signing_date),
       close_date = COALESCE(EXCLUDED.close_date, contracts.close_date),
       execution_deadline = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.execution_deadline ELSE EXCLUDED.execution_deadline END,
       execution_place = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.execution_place ELSE EXCLUDED.execution_place END,
       initial_contractual_price = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.initial_contractual_price ELSE EXCLUDED.initial_contractual_price END,
       total_effective_price = COALESCE(EXCLUDED.total_effective_price, contracts.total_effective_price),
       cpvs = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.cpvs ELSE EXCLUDED.cpvs END,
       cpvs_designation = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.cpvs_designation ELSE EXCLUDED.cpvs_designation END,
       contract_fundamentation = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.contract_fundamentation ELSE EXCLUDED.contract_fundamentation END,
       regime = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.regime ELSE EXCLUDED.regime END,
       contracting_procedure_url = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.contracting_procedure_url ELSE EXCLUDED.contracting_procedure_url END,
       centralized_procedure = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.centralized_procedure ELSE EXCLUDED.centralized_procedure END,
       ambient_criteria = CASE WHEN contracts.detail_scraped_at IS NOT NULL THEN contracts.ambient_criteria ELSE EXCLUDED.ambient_criteria END,
       raw_opendata_json = EXCLUDED.raw_opendata_json,
       opendata_imported = true,
       updated_at = now()
     WHERE contracts.raw_opendata_json IS DISTINCT FROM EXCLUDED.raw_opendata_json
     RETURNING id, (xmax = 0) AS inserted`,
    [
      basegovId,
      rec.descContrato || null,
      rec.objectoContrato || null,
      rec.tipoprocedimento || null,
      (rec.tipoContrato ?? []).join('; ') || null,
      rec._datesIso?.pub ?? parseSlashDate(rec.dataPublicacao),
      rec._datesIso?.sign ?? parseSlashDate(rec.dataCelebracaoContrato),
      rec._datesIso?.close ?? parseSlashDate(rec.dataFechoContrato),
      rec.prazoExecucao != null ? `${rec.prazoExecucao} dias` : null,
      (rec.localExecucao ?? []).join(' | ') || null,
      rec.precoContratual ?? null,
      rec.PrecoTotalEfetivo && rec.PrecoTotalEfetivo > 0 ? rec.PrecoTotalEfetivo : null,
      cpvCodes || null,
      cpvNames || null,
      rec.fundamentacao || null,
      rec.regime || null,
      rec.linkPecasProc || null,
      rec.ProcedimentoCentralizado === 'Sim',
      rec.ContratEcologico === 'Sim',
      JSON.stringify(payload),
    ]
  );
  if (rows.length === 0) return 'skip';
  const contractId = rows[0].id as number;
  const kind: UpsertKind = rows[0].inserted ? 'insert' : 'update';

  const link = async (refs: string[] | null | undefined, role: string) => {
    for (const raw of refs ?? []) {
      const ref = parseEntityRef(raw);
      if (!ref) continue;
      const { rows: e } = await pool.query(
        `INSERT INTO entities (nif, name) VALUES ($1,$2)
         ON CONFLICT (nif, name) DO UPDATE SET nif = EXCLUDED.nif RETURNING id`,
        [ref.nif, ref.name]
      );
      await pool.query(
        `INSERT INTO contract_entities (contract_id, entity_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [contractId, e[0].id, role]
      );
    }
  };
  await link(rec.adjudicante, 'contracting');
  await link(rec.adjudicatarios, 'contracted');
  await link(rec.concorrentes, 'contestant');

  return kind;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(600_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Importa a partir do zip JSON (streaming); erros de stream não derrubam o processo. */
async function importFromJsonZip(zipBuf: Buffer, onRecord: (r: OpenDataContract) => Promise<void>): Promise<number> {
  const jsonStream = await openZipEntryStream(zipBuf);
  const p = parser();
  const sa = streamArray();
  // propaga erros de qualquer estádio para o iterador (senão rebentam o processo)
  jsonStream.on('error', (e) => sa.emit('error', e));
  p.on('error', (e) => sa.emit('error', e));
  jsonStream.pipe(p).pipe(sa);

  let n = 0;
  for await (const { value } of sa) {
    await onRecord(value as OpenDataContract);
    n++;
  }
  return n;
}

/** Converte serial Excel (dias desde 1899-12-30) em "YYYY-MM-DD". */
function excelDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = Number(v);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
  }
  return typeof v === 'string' ? parseSlashDate(v) : null;
}

const splitMulti = (v: unknown): string[] =>
  v == null || v === '' ? [] : String(v).split(/;\s*|\|/).map((s) => s.trim()).filter(Boolean);

/** Fallback: importa a partir do XLSX oficial (mesmas colunas). */
async function importFromXlsx(xlsxBuf: Buffer, onRecord: (r: OpenDataContract) => Promise<void>): Promise<number> {
  const { default: ExcelJS } = await import('exceljs');
  const tmp = path.join(os.tmpdir(), `basegov-opendata-${Date.now()}.xlsx`);
  await fs.writeFile(tmp, xlsxBuf);
  let n = 0;
  try {
    const wb = new ExcelJS.stream.xlsx.WorkbookReader(tmp, {});
    let headers: string[] = [];
    for await (const ws of wb) {
      for await (const row of ws) {
        const vals = row.values as unknown[];
        if (row.number === 1) {
          headers = vals.map((v) => String(v ?? ''));
          continue;
        }
        const cell = (name: string) => {
          const raw = vals[headers.indexOf(name)];
          // hiperligações/rich text do exceljs vêm como objetos
          if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
            const o = raw as { text?: unknown; result?: unknown; hyperlink?: unknown };
            return o.text ?? o.result ?? o.hyperlink ?? null;
          }
          return raw ?? null;
        };
        const rec: OpenDataContract = {
          idcontrato: String(cell('idcontrato') ?? ''),
          objectoContrato: (cell('objectoContrato') as string) ?? undefined,
          descContrato: (cell('descContrato') as string) ?? undefined,
          tipoprocedimento: (cell('tipoprocedimento') as string) ?? undefined,
          tipoContrato: splitMulti(cell('tipoContrato')),
          adjudicante: splitMulti(cell('adjudicante')),
          adjudicatarios: splitMulti(cell('adjudicatarios')),
          concorrentes: splitMulti(cell('concorrentes')),
          dataPublicacao: undefined,
          dataCelebracaoContrato: undefined,
          dataFechoContrato: undefined,
          precoContratual: cell('precoContratual') != null ? Number(cell('precoContratual')) : undefined,
          PrecoTotalEfetivo: cell('PrecoTotalEfetivo') != null ? Number(cell('PrecoTotalEfetivo')) : undefined,
          cpv: splitMulti(cell('CPV')),
          prazoExecucao: cell('prazoExecucao') != null ? Number(cell('prazoExecucao')) : undefined,
          localExecucao: splitMulti(cell('LocalExecucao')),
          fundamentacao: (cell('fundamentacao') as string) ?? undefined,
          regime: (cell('regime') as string) ?? undefined,
          linkPecasProc: (cell('linkPecasProc') as string) ?? undefined,
          ProcedimentoCentralizado: (cell('ProcedimentoCentralizado') as string) ?? undefined,
          ContratEcologico: (cell('ContratEcologico') as string) ?? undefined,
          _datesIso: {
            pub: excelDate(cell('dataPublicacao')),
            sign: excelDate(cell('dataCelebracaoContrato')),
            close: excelDate(cell('dataFechoContrato')),
          },
        };
        await onRecord(rec);
        n++;
      }
      break; // só a primeira folha
    }
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
  return n;
}

async function runImport(importId: number, year: number): Promise<void> {
  console.log(`[opendata] a importar contratos de ${year}…`);
  const urls = await resolveYearUrls(year);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const bump = (kind: UpsertKind): void => {
    switch (kind) {
      case 'insert':
        inserted += 1;
        return;
      case 'update':
        updated += 1;
        return;
      case 'skip':
        unchanged += 1;
        return;
      default: {
        const _n: never = kind;
        throw new Error(String(_n));
      }
    }
  };
  const processed = () => inserted + updated + unchanged;
  const onRecord = async (rec: OpenDataContract) => {
    const kind = await withDeadlockRetry(() => upsertOpenDataContract(rec));
    if (kind) bump(kind);
    if (processed() % 2000 === 0) {
      await pool.query(
        `UPDATE opendata_imports SET imported_rows = $2, inserted_rows = $3, updated_rows = $4, unchanged_rows = $5, heartbeat_at = now() WHERE id = $1`,
        [importId, processed(), inserted, updated, unchanged],
      );
      console.log(`[opendata] ${year}: ${inserted} novos, ${updated} actualizados, ${unchanged} iguais`);
    }
  };

  let done = false;
  if (urls.zip) {
    try {
      const buf = await download(urls.zip);
      console.log(`[opendata] ${year}: zip ${(buf.length / 1e6).toFixed(1)} MB descarregado`);
      inserted = 0;
      updated = 0;
      unchanged = 0;
      await importFromJsonZip(buf, onRecord);
      done = true;
    } catch (err) {
      // alguns zips do IMPIC estão corrompidos na origem (ex.: 2025/2026) — cair para o XLSX
      console.warn(`[opendata] ${year}: zip JSON falhou (${String(err).slice(0, 120)}); a tentar XLSX…`);
    }
  }
  if (!done) {
    if (!urls.xlsx) throw new Error(`zip corrompido e sem XLSX disponível para ${year}`);
    const buf = await download(urls.xlsx);
    console.log(`[opendata] ${year}: xlsx ${(buf.length / 1e6).toFixed(1)} MB descarregado`);
    inserted = 0;
    updated = 0;
    unchanged = 0;
    await importFromXlsx(buf, onRecord);
  }

  await pool.query(
    `UPDATE opendata_imports SET status = 'completed', imported_rows = $2, total_rows = $2,
       inserted_rows = $3, updated_rows = $4, unchanged_rows = $5,
       source_checksum = COALESCE(source_checksum, $6),
       source_modified = COALESCE(source_modified, $7::timestamptz),
       source_filesize = COALESCE(source_filesize, $8),
       finished_at = now() WHERE id = $1`,
    [
      importId,
      processed(),
      inserted,
      updated,
      unchanged,
      urls.fingerprint,
      urls.last_modified,
      urls.filesize,
    ],
  );
  console.log(`[opendata] ${year}: concluído — ${inserted} novos, ${updated} actualizados, ${unchanged} iguais`);

  await refreshCpvCatalog().catch((e) => console.error('[cpv] refresh falhou:', e));
  if (inserted + updated > 0) await rematchProfiles();
}

/** Depois de novos dados entrarem, re-liga o corpus aos perfis existentes. */
async function rematchProfiles(): Promise<void> {
  const { rows: profiles } = await pool.query(`SELECT id, terms, cpv_codes FROM profiles`);
  for (const p of profiles) {
    for (const term of p.terms as string[]) {
      // pesquisa mais recente deste termo/perfil (kind contratos) recebe os novos matches
      const { rows } = await pool.query(
        `SELECT s.id FROM searches s JOIN profile_runs pr ON pr.id = s.profile_run_id
         WHERE pr.profile_id = $1 AND s.term = $2 AND s.kind = 'contratos'
         ORDER BY s.created_at DESC LIMIT 1`,
        [p.id, term]
      );
      if (rows.length > 0) {
        const n = await matchLocalCorpus(rows[0].id, term, p.cpv_codes ?? []);
        if (n > 0) console.log(`[opendata] perfil #${p.id} "${term}": +${n} contratos do novo corpus`);
      }
    }
  }
}

let importing = false;

export async function enqueueStaleYears(now = new Date()): Promise<number[]> {
  const resources = await fetchImpicCatalog();
  const { rows: completed } = await pool.query(
    `SELECT DISTINCT ON (year) year, source_checksum
       FROM opendata_imports
      WHERE status = 'completed'
      ORDER BY year, finished_at DESC NULLS LAST, id DESC`,
  );
  const due = yearsDueForRefresh(
    resources,
    completed as { year: number; source_checksum: string | null }[],
    lisbonYear(now),
  );
  const created: number[] = [];
  for (const item of due) {
    const { rows: dup } = await pool.query(
      `SELECT 1 FROM opendata_imports WHERE year = $1 AND status IN ('pending','running')`,
      [item.year],
    );
    if (dup.length > 0) continue;
    const { rows } = await pool.query(
      `INSERT INTO opendata_imports (year, origin, source_checksum, source_modified, source_filesize)
       VALUES ($1, 'cron', $2, $3::timestamptz, $4) RETURNING id`,
      [item.year, item.fingerprint, item.last_modified, item.filesize],
    );
    created.push(rows[0].id as number);
    console.log(`[opendata] cron: ano ${item.year} na fila (ficheiro novo ou alterado)`);
  }
  await pool.query(
    `INSERT INTO opendata_sync (id, last_check_at, last_error) VALUES (1, now(), NULL)
     ON CONFLICT (id) DO UPDATE SET last_check_at = now(), last_error = NULL`,
  );
  return created;
}

async function tick(): Promise<void> {
  if (importing) return;
  importing = true;
  try {
    // Deadlocks com o worker de pesquisas são transitórios — voltar a tentar
    const { rows: dead } = await pool.query(
      `UPDATE opendata_imports SET status = 'pending', error_message = NULL
       WHERE status = 'failed' AND error_message ~* 'deadlock'
         AND finished_at < now() - interval '5 minutes'
       RETURNING year`
    );
    for (const r of dead) console.log(`[opendata] import ${r.year} reagendado após deadlock`);

    // Auto-cura: imports 'running' sem heartbeat recente são de processos mortos
    // (ex.: deploys sobrepostos em que o recovery de arranque corre antes de o
    // contentor antigo morrer) — voltam à fila.
    const { rows: stale } = await pool.query(
      `UPDATE opendata_imports SET status = 'pending'
       WHERE status = 'running' AND coalesce(heartbeat_at, started_at, created_at) < now() - interval '10 minutes'
       RETURNING year`
    );
    for (const r of stale) console.log(`[opendata] import ${r.year} órfão reagendado (sem heartbeat)`);

    const { rows } = await pool.query(
      `UPDATE opendata_imports SET status = 'running', started_at = now(), heartbeat_at = now()
       WHERE id = (SELECT id FROM opendata_imports WHERE status = 'pending' ORDER BY year DESC, created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, year`
    );
    if (rows.length === 0) return;
    const { id, year } = rows[0];
    try {
      await runImport(id, year);
    } catch (err) {
      console.error(`[opendata] import de ${year} falhou:`, err);
      await pool.query(
        `UPDATE opendata_imports SET status = 'failed', error_message = $2, finished_at = now() WHERE id = $1`,
        [id, String(err).slice(0, 500)]
      );
    }
  } finally {
    importing = false;
  }
}

export function startOpendataWorker(): void {
  const check = () =>
    enqueueStaleYears()
      .then((ids) => {
        if (ids.length) console.log(`[opendata] cron enfileirou ${ids.length} ano(s)`);
      })
      .catch(async (e) => {
        console.error('[opendata] verificação do catálogo falhou:', e);
        await pool.query(
          `INSERT INTO opendata_sync (id, last_check_at, last_error) VALUES (1, now(), $1)
           ON CONFLICT (id) DO UPDATE SET last_check_at = now(), last_error = EXCLUDED.last_error`,
          [String(e).slice(0, 500)],
        );
      });
  void check().then(() => tick());
  setInterval(() => void tick().catch((e) => console.error('[opendata] tick error:', e)), 60_000);
  setInterval(() => void check(), CHECK_INTERVAL_MS);
  console.log('[opendata] worker iniciado (verificação automática do ano corrente e do anterior)');
}
