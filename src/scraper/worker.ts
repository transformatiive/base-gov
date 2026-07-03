import { pool } from '../db.js';
import { config } from '../config.js';
import { BaseGovClient, ContractDetail, EntityRef, HttpBaseGovClient, ListItem } from './client.js';
import { parseBaseDate, parseBasePrice } from './parse.js';

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

async function processSearch(client: BaseGovClient, searchId: number, term: string): Promise<void> {
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

      // Detalhe: buscar se nunca foi buscado ou se tem mais de 7 dias.
      const { rows } = await pool.query(
        `SELECT detail_scraped_at FROM contracts WHERE id = $1
           AND (detail_scraped_at IS NULL OR detail_scraped_at < now() - interval '7 days')`,
        [contractId]
      );
      if (rows.length > 0) {
        await sleep(config.scrapeDelayMs);
        const detail = await client.getDetail(item.id);
        await saveDetail(contractId, detail);
        await downloadPendingDocuments(client, contractId);
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
    `UPDATE searches SET status = $2, total_scraped = $3, finished_at = now() WHERE id = $1`,
    [searchId, truncated ? 'completed_truncated' : 'completed', scraped]
  );
}

let running = false;

async function tick(client: BaseGovClient): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { rows } = await pool.query(
      `UPDATE searches SET status = 'running', started_at = now()
       WHERE id = (SELECT id FROM searches WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, term`
    );
    if (rows.length === 0) return;
    const { id, term } = rows[0];
    console.log(`[worker] a processar pesquisa #${id} "${term}"`);
    try {
      await processSearch(client, id, term);
      console.log(`[worker] pesquisa #${id} concluída`);
    } catch (err) {
      console.error(`[worker] pesquisa #${id} falhou:`, err);
      await pool.query(
        `UPDATE searches SET status = 'failed', error_message = $2, finished_at = now() WHERE id = $1`,
        [id, String(err)]
      );
    }
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  const client = new HttpBaseGovClient();
  setInterval(() => void tick(client).catch((e) => console.error('[worker] tick error:', e)), 3000);
  console.log('[worker] iniciado');
}
