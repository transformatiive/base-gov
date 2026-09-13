import { pool } from '../db.js';
import { config } from '../config.js';
import { putDocument } from '../storage.js';
import { pickContractDocs } from '../ai-checklist.js';
import { BaseGovClient, HttpBaseGovClient } from './client.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Descarrega PDFs pendentes do BASE para um contrato.
 * Na análise, limita a `maxOk` e prioriza caderno / relatório.
 */
export async function downloadPendingDocuments(
  client: BaseGovClient,
  contractId: number,
  opts?: { maxOk?: number; delayMs?: number },
): Promise<number> {
  const { rows } = await pool.query(
    'SELECT id, basegov_id, file_name FROM documents WHERE contract_id = $1 AND download_ok = false',
    [contractId],
  );
  const pending = pickContractDocs(
    rows as { id: number; basegov_id: number; file_name: string; size_bytes?: number | null }[],
    rows.length,
  );
  const maxOk = opts?.maxOk ?? Infinity;
  const delayMs = opts?.delayMs ?? config.scrapeDelayMs;
  let ok = 0;
  for (const doc of pending) {
    if (ok >= maxOk) break;
    try {
      const { content, contentType } = await client.downloadDocument(Number(doc.basegov_id));
      const onVolume = await putDocument(doc.id, content);
      await pool.query(
        `UPDATE documents SET content = $2, content_type = $3, size_bytes = $4,
           download_ok = true, download_error = NULL, downloaded_at = now()
         WHERE id = $1`,
        [doc.id, onVolume ? null : content, contentType, content.length],
      );
      ok++;
    } catch (err) {
      await pool.query('UPDATE documents SET download_error = $2 WHERE id = $1', [doc.id, String(err)]);
      console.warn(`[docs] download do documento ${doc.basegov_id} falhou: ${err}`);
    }
    if (delayMs > 0) await sleep(delayMs);
  }
  return ok;
}

/** Garante metadados + binários do caderno/relatório quando o BASE os publica. */
export async function ensureContractDocuments(contractId: number): Promise<void> {
  const { rows: existing } = await pool.query(
    'SELECT count(*)::int AS n, count(*) FILTER (WHERE download_ok)::int AS ok FROM documents WHERE contract_id = $1',
    [contractId],
  );
  const n = Number(existing[0]?.n ?? 0);
  const ok = Number(existing[0]?.ok ?? 0);
  const client = new HttpBaseGovClient();
  if (n === 0) {
    const { rows: c } = await pool.query('SELECT basegov_id FROM contracts WHERE id = $1', [contractId]);
    const basegovId = c[0]?.basegov_id;
    if (basegovId == null) return;
    try {
      const detail = await client.getDetail(Number(basegovId));
      for (const doc of detail.documents ?? []) {
        if (!doc?.id) continue;
        await pool.query(
          `INSERT INTO documents (contract_id, basegov_id, file_name) VALUES ($1,$2,$3)
           ON CONFLICT (basegov_id) DO NOTHING`,
          [contractId, doc.id, doc.description ?? `documento-${doc.id}`],
        );
      }
    } catch (err) {
      console.warn(`[docs] detalhe BASE do contrato ${contractId} falhou: ${String(err).slice(0, 160)}`);
      return;
    }
  }
  if (ok > 0 && n === ok) return;
  await downloadPendingDocuments(client, contractId, { maxOk: 5, delayMs: 0 });
}
