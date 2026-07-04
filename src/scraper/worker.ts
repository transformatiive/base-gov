import { pool } from '../db.js';
import { config } from '../config.js';
import {
  AnnouncementDetail,
  AnnouncementListItem,
  BaseGovClient,
  ContractDetail,
  EntityRef,
  HttpBaseGovClient,
  ListItem,
} from './client.js';
import { parseBaseDate, parseBasePrice } from './parse.js';
import { reconcileProfileRuns, scheduleDueProfiles } from '../profiles.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertContractFromList(item: ListItem): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO contracts (basegov_id, object_brief_description, contracting_procedure_type,
       publication_date, signing_date, initial_contractual_price, ccp, raw_list_json, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (basegov_id) DO UPDATE SET
       object_brief_description = EXCLUDED.object_brief_description,
       contracting_procedure_type = EXCLUDED.contracting_procedure_type,
       publication_date = EXCLUDED.publication_date,
       signing_date = EXCLUDED.signing_date,
       initial_contractual_price = EXCLUDED.initial_contractual_price,
       ccp = EXCLUDED.ccp,
       raw_list_json = EXCLUDED.raw_list_json,
       updated_at = now()
     RETURNING id`,
    [
      item.id,
      item.objectBriefDescription ?? null,
      item.contractingProcedureType ?? null,
      parseBaseDate(item.publicationDate),
      parseBaseDate(item.signingDate),
      parseBasePrice(item.initialContractualPrice),
      item.ccp ?? null,
      JSON.stringify(item),
    ]
  );
  return rows[0].id;
}

async function linkEntities(contractId: number, refs: EntityRef[] | undefined, role: string): Promise<void> {
  for (const ref of refs ?? []) {
    const name = ref.description?.trim();
    if (!name) continue;
    const { rows } = await pool.query(
      `INSERT INTO entities (basegov_id, nif, name) VALUES ($1,$2,$3)
       ON CONFLICT (nif, name) DO UPDATE SET basegov_id = COALESCE(entities.basegov_id, EXCLUDED.basegov_id)
       RETURNING id`,
      [ref.id ?? null, ref.nif ?? '', name]
    );
    await pool.query(
      `INSERT INTO contract_entities (contract_id, entity_id, role) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [contractId, rows[0].id, role]
    );
  }
}

async function saveDetail(contractId: number, detail: ContractDetail): Promise<void> {
  await pool.query(
    `UPDATE contracts SET
       description = $2, object_brief_description = COALESCE($3, object_brief_description),
       contracting_procedure_type = COALESCE($4, contracting_procedure_type),
       contract_types = $5, publication_date = COALESCE($6, publication_date),
       signing_date = COALESCE($7, signing_date), close_date = $8,
       execution_deadline = $9, execution_place = $10,
       initial_contractual_price = COALESCE($11, initial_contractual_price),
       total_effective_price = $12, cpvs = $13, cpvs_designation = $14,
       contract_fundamentation = $15, regime = $16, contracting_procedure_url = $17,
       centralized_procedure = $18, ambient_criteria = $19, ccp = COALESCE($20, ccp),
       raw_detail_json = $21, detail_scraped_at = now(), updated_at = now()
     WHERE id = $1`,
    [
      contractId,
      detail.description ?? null,
      detail.objectBriefDescription ?? null,
      detail.contractingProcedureType ?? null,
      detail.contractTypes ?? null,
      parseBaseDate(detail.publicationDate),
      parseBaseDate(detail.signingDate),
      parseBaseDate(detail.closeDate),
      detail.executionDeadline ?? null,
      detail.executionPlace ?? null,
      parseBasePrice(detail.initialContractualPrice),
      parseBasePrice(detail.totalEffectivePrice),
      detail.cpvs ?? null,
      detail.cpvsDesignation ?? null,
      detail.contractFundamentationType ?? null,
      detail.regime ?? null,
      detail.contractingProcedureUrl ?? null,
      detail.centralizedProcedure ?? null,
      detail.ambientCriteria ?? null,
      detail.ccp ?? null,
      JSON.stringify(detail),
    ]
  );

  await linkEntities(contractId, detail.contracting, 'contracting');
  await linkEntities(contractId, detail.contracted, 'contracted');
  await linkEntities(contractId, detail.contestants, 'contestant');
  await linkEntities(contractId, detail.invitees, 'invitee');

  for (const doc of detail.documents ?? []) {
    if (!doc?.id) continue;
    await pool.query(
      `INSERT INTO documents (contract_id, basegov_id, file_name) VALUES ($1,$2,$3)
       ON CONFLICT (basegov_id) DO NOTHING`,
      [contractId, doc.id, doc.description ?? `documento-${doc.id}`]
    );
  }
}

async function downloadPendingDocuments(client: BaseGovClient, contractId: number): Promise<void> {
  const { rows } = await pool.query(
    'SELECT id, basegov_id FROM documents WHERE contract_id = $1 AND download_ok = false',
    [contractId]
  );
  for (const doc of rows) {
    try {
      const { content, contentType } = await client.downloadDocument(Number(doc.basegov_id));
      await pool.query(
        `UPDATE documents SET content = $2, content_type = $3, size_bytes = $4,
           download_ok = true, download_error = NULL, downloaded_at = now()
         WHERE id = $1`,
        [doc.id, content, contentType, content.length]
      );
    } catch (err) {
      // Falha de download não falha a pesquisa — fica registada no documento.
      await pool.query('UPDATE documents SET download_error = $2 WHERE id = $1', [doc.id, String(err)]);
      console.warn(`[worker] download do documento ${doc.basegov_id} falhou: ${err}`);
    }
    await sleep(config.scrapeDelayMs);
  }
}

async function upsertAnnouncementFromList(item: AnnouncementListItem): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO announcements (basegov_id, announcement_type, contracting_procedure_type,
       contracting_entity, contract_designation, base_price, dr_publication_date,
       proposal_deadline_date, raw_list_json, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (basegov_id) DO UPDATE SET
       announcement_type = EXCLUDED.announcement_type,
       contracting_procedure_type = EXCLUDED.contracting_procedure_type,
       contracting_entity = EXCLUDED.contracting_entity,
       contract_designation = EXCLUDED.contract_designation,
       base_price = EXCLUDED.base_price,
       dr_publication_date = EXCLUDED.dr_publication_date,
       proposal_deadline_date = EXCLUDED.proposal_deadline_date,
       raw_list_json = EXCLUDED.raw_list_json,
       updated_at = now()
     RETURNING id`,
    [
      item.id,
      item.type ?? null,
      item.contractingProcedureType ?? null,
      item.contractingEntity ?? null,
      item.contractDesignation ?? null,
      parseBasePrice(item.basePrice),
      parseBaseDate(item.drPublicationDate),
      parseBaseDate(item.proposalDeadline),
      JSON.stringify(item),
    ]
  );
  return rows[0].id;
}

async function saveAnnouncementDetail(announcementId: number, detail: AnnouncementDetail): Promise<void> {
  await pool.query(
    `UPDATE announcements SET
       model_type = $2, announcement_number = $3, contract_type = $4,
       cpvs = $5, contracting_procedure_url = $6, reference_url = $7,
       raw_detail_json = $8, detail_scraped_at = now(), updated_at = now()
     WHERE id = $1`,
    [
      announcementId,
      detail.modelType ?? null,
      detail.announcementNumber ?? null,
      detail.contractType ?? null,
      detail.cpvs ?? null,
      detail.contractingProcedureUrl ?? null,
      detail.reference ?? null,
      JSON.stringify(detail),
    ]
  );
}

async function processAnnouncementSearch(client: BaseGovClient, searchId: number, term: string): Promise<void> {
  let page = 0;
  let scraped = 0;
  let total = Infinity;
  let truncated = false;

  while (page * config.pageSize < total) {
    const result = await client.searchAnnouncements(term, page, config.pageSize);
    total = result.total;
    if (page === 0) {
      await pool.query('UPDATE searches SET total_reported = $2 WHERE id = $1', [searchId, total]);
    }

    for (const item of result.items) {
      const announcementId = await upsertAnnouncementFromList(item);
      await pool.query(
        `INSERT INTO search_announcements (search_id, announcement_id, position) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [searchId, announcementId, scraped]
      );

      const { rows } = await pool.query(
        `SELECT 1 FROM announcements WHERE id = $1
           AND (detail_scraped_at IS NULL OR detail_scraped_at < now() - interval '7 days')`,
        [announcementId]
      );
      if (rows.length > 0) {
        await sleep(config.scrapeDelayMs);
        const detail = await client.getAnnouncementDetail(item.id);
        await saveAnnouncementDetail(announcementId, detail);
      }

      scraped++;
      if (scraped >= config.maxResultsPerSearch) {
        truncated = true;
        break;
      }
    }

    await pool.query('UPDATE searches SET total_scraped = $2 WHERE id = $1', [searchId, scraped]);
    if (truncated || result.items.length === 0) break;
    page++;
    await sleep(config.scrapeDelayMs);
  }

  await pool.query(
    `UPDATE searches SET status = $2, total_scraped = $3, error_message = NULL, finished_at = now() WHERE id = $1`,
    [searchId, truncated ? 'completed_truncated' : 'completed', scraped]
  );
}

/**
 * Liga o corpus local (histórico dos dados abertos + contratos já conhecidos)
 * aos resultados da pesquisa — instantâneo e sem tocar no site.
 */
async function matchLocalCorpus(searchId: number, term: string): Promise<number> {
  const { rowCount } = await pool.query(
    `INSERT INTO search_results (search_id, contract_id, position)
     SELECT $1, c.id, 500000 + row_number() OVER (ORDER BY c.publication_date DESC NULLS LAST)
     FROM contracts c
     WHERE (c.object_brief_description ILIKE $2 OR c.description ILIKE $2)
     ON CONFLICT DO NOTHING`,
    [searchId, `%${term}%`]
  );
  return rowCount ?? 0;
}

async function processSearch(client: BaseGovClient, searchId: number, term: string, fetchDocuments: boolean): Promise<void> {
  const localMatches = await matchLocalCorpus(searchId, term);
  if (localMatches > 0) console.log(`[worker] pesquisa #${searchId}: ${localMatches} contratos do corpus local`);

  let page = 0;
  let scraped = 0;
  let total = Infinity;
  let truncated = false;

  while (page * config.pageSize < total) {
    const result = await client.search(term, page, config.pageSize);
    total = result.total;
    if (page === 0) {
      await pool.query('UPDATE searches SET total_reported = $2 WHERE id = $1', [searchId, total]);
    }

    for (const item of result.items) {
      const contractId = await upsertContractFromList(item);
      await pool.query(
        `INSERT INTO search_results (search_id, contract_id, position) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [searchId, contractId, scraped]
      );

      // Detalhe do site: com o histórico dos dados abertos importado, só vale a pena
      // ir ao site quando (a) o contrato é uma novidade sem cobertura de dados abertos,
      // ou (b) a pesquisa pediu documentos PDF (que só existem no site).
      const { rows } = await pool.query(
        fetchDocuments
          ? `SELECT 1 FROM contracts WHERE id = $1
               AND (detail_scraped_at IS NULL OR detail_scraped_at < now() - interval '7 days')`
          : `SELECT 1 FROM contracts WHERE id = $1
               AND detail_scraped_at IS NULL AND raw_opendata_json IS NULL`,
        [contractId]
      );
      if (rows.length > 0) {
        await sleep(config.scrapeDelayMs);
        const detail = await client.getDetail(item.id);
        await saveDetail(contractId, detail);
        if (fetchDocuments) await downloadPendingDocuments(client, contractId);
      }

      scraped++;
      if (scraped >= config.maxResultsPerSearch) {
        truncated = true;
        break;
      }
    }

    await pool.query('UPDATE searches SET total_scraped = $2 WHERE id = $1', [searchId, scraped]);
    if (truncated || result.items.length === 0) break;
    page++;
    await sleep(config.scrapeDelayMs);
  }

  await pool.query(
    `UPDATE searches SET status = $2, total_scraped = $3, error_message = NULL, finished_at = now() WHERE id = $1`,
    [searchId, truncated ? 'completed_truncated' : 'completed', scraped]
  );
}

let running = false;

async function tick(client: BaseGovClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    await scheduleDueProfiles();

    // Retoma automática: pesquisas falhadas por erros transitórios (anti-bot 999,
    // timeouts, 5xx) voltam à fila após 15 min — sem intervenção manual.
    const { rows: requeued } = await pool.query(
      `UPDATE searches SET status = 'pending', retries = 0, next_attempt_at = now(), finished_at = NULL
       WHERE status = 'failed'
         AND error_message ~* 'HTTP (999|429|404|5[0-9][0-9])|fetch failed|timeout|ECONNRESET|ETIMEDOUT'
         AND finished_at < now() - interval '15 minutes'
       RETURNING id, profile_run_id`
    );
    for (const r of requeued) {
      console.log(`[worker] pesquisa #${r.id} reagendada automaticamente após falha transitória`);
      if (r.profile_run_id) {
        await pool.query(
          `UPDATE profile_runs SET status = 'running', finished_at = NULL WHERE id = $1`,
          [r.profile_run_id]
        );
      }
    }

    const { rows } = await pool.query(
      `UPDATE searches SET status = 'running', started_at = COALESCE(started_at, now())
       WHERE id = (SELECT id FROM searches
                   WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
                   ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, term, kind, profile_run_id, retries, fetch_documents`
    );
    if (rows.length > 0) {
      const { id, term, kind, profile_run_id, retries, fetch_documents } = rows[0];
      if (profile_run_id) {
        await pool.query(
          `UPDATE profile_runs SET status = 'running', started_at = COALESCE(started_at, now()) WHERE id = $1`,
          [profile_run_id]
        );
      }
      console.log(`[worker] a processar pesquisa #${id} "${term}" (${kind})`);
      try {
        if (kind === 'anuncios') {
          await processAnnouncementSearch(client, id, term);
        } else {
          await processSearch(client, id, term, fetch_documents === true);
        }
        console.log(`[worker] pesquisa #${id} concluída`);
      } catch (err) {
        const transient = /HTTP (999|429|404|5\d\d)|fetch failed|timeout|ECONNRESET|ETIMEDOUT/i.test(String(err));
        if (transient && retries < 5) {
          // O processamento é idempotente: ao retomar, os detalhes já extraídos são saltados.
          const cooldownMin = 5 * (retries + 1);
          console.warn(`[worker] pesquisa #${id} interrompida (${err}); retoma em ${cooldownMin} min (tentativa ${retries + 1}/5)`);
          await pool.query(
            `UPDATE searches SET status = 'pending', retries = retries + 1,
               next_attempt_at = now() + ($2 || ' minutes')::interval, error_message = $3 WHERE id = $1`,
            [id, String(cooldownMin), `retoma agendada: ${String(err).slice(0, 300)}`]
          );
        } else {
          console.error(`[worker] pesquisa #${id} falhou:`, err);
          await pool.query(
            `UPDATE searches SET status = 'failed', error_message = $2, finished_at = now() WHERE id = $1`,
            [id, String(err)]
          );
        }
      }
    }

    await reconcileProfileRuns();
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  const client = new HttpBaseGovClient();
  setInterval(() => void tick(client).catch((e) => console.error('[worker] tick error:', e)), 3000);
  console.log('[worker] iniciado');
}
