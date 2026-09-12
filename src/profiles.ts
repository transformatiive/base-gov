import { pool } from './db.js';
import { PROFILE_RUN_STALE_HOURS, profileScheduleDue } from './harvest-policy.js';
import { noveltyCounts } from './profile-run-policy.js';

/** Cria um profile_run e as pesquisas filhas (contratos + anúncios por termo). */
export async function createProfileRun(profileId: number, createdBy: number | null): Promise<number> {
  const { rows: profRows } = await pool.query(
    'SELECT id, terms, include_announcements, fetch_documents, company_id FROM profiles WHERE id = $1',
    [profileId]
  );
  if (profRows.length === 0) throw new Error('Perfil não encontrado');
  const profile = profRows[0];
  const companyId = profile.company_id ?? null;

  const { rows: runRows } = await pool.query(
    'INSERT INTO profile_runs (profile_id) VALUES ($1) RETURNING id',
    [profileId]
  );
  const runId = runRows[0].id;

  // As pesquisas herdam a empresa do perfil, para manter o isolamento por empresa.
  for (const term of profile.terms as string[]) {
    await pool.query(
      `INSERT INTO searches (term, kind, profile_run_id, created_by, company_id, fetch_documents) VALUES ($1,'contratos',$2,$3,$4,$5)`,
      [term, runId, createdBy, companyId, profile.fetch_documents === true]
    );
    if (profile.include_announcements) {
      await pool.query(
        `INSERT INTO searches (term, kind, profile_run_id, created_by, company_id) VALUES ($1,'anuncios',$2,$3,$4)`,
        [term, runId, createdBy, companyId]
      );
    }
  }
  return runId;
}

/** Fecha runs cujas pesquisas já terminaram todas e calcula as novidades. */
export async function reconcileProfileRuns(): Promise<void> {
  const { rows: runs } = await pool.query(`
    SELECT pr.id, pr.profile_id, min(s.started_at) AS run_started
    FROM profile_runs pr
    JOIN searches s ON s.profile_run_id = pr.id
    WHERE pr.status IN ('pending','running')
    GROUP BY pr.id
    HAVING bool_and(s.status IN ('completed','completed_truncated','failed'))
  `);
  for (const run of runs) {
    const { rows: [counts] } = await pool.query(
      `SELECT
         (SELECT count(DISTINCT sr.contract_id) FROM search_results sr
            JOIN searches s ON s.id = sr.search_id AND s.profile_run_id = $1) AS matched_contracts,
         (SELECT count(DISTINCT sa.announcement_id) FROM search_announcements sa
            JOIN searches s ON s.id = sa.search_id AND s.profile_run_id = $1) AS matched_announcements,
         (SELECT count(DISTINCT c.id) FROM search_results sr
            JOIN searches s ON s.id = sr.search_id AND s.profile_run_id = $1
            JOIN contracts c ON c.id = sr.contract_id
           WHERE c.created_at >= $2) AS created_contracts,
         (SELECT count(DISTINCT a.id) FROM search_announcements sa
            JOIN searches s ON s.id = sa.search_id AND s.profile_run_id = $1
            JOIN announcements a ON a.id = sa.announcement_id
           WHERE a.created_at >= $2) AS created_announcements,
         (SELECT bool_or(s.status = 'failed') FROM searches s WHERE s.profile_run_id = $1) AS any_failed`,
      [run.id, run.run_started ?? new Date(0)]
    );
    // profile_run é match local (sem scrape ao vivo) — «novidades» = cruzados neste run.
    const novelty = noveltyCounts({
      origin: 'profile_run',
      matchedContracts: Number(counts.matched_contracts),
      matchedAnnouncements: Number(counts.matched_announcements),
      createdAfterStartContracts: Number(counts.created_contracts),
      createdAfterStartAnnouncements: Number(counts.created_announcements),
    });
    await pool.query(
      `UPDATE profile_runs SET status = $2, new_contracts = $3, new_announcements = $4, finished_at = now(),
         started_at = COALESCE(started_at, $5)
       WHERE id = $1`,
      [run.id, counts.any_failed ? 'failed' : 'completed', novelty.new_contracts, novelty.new_announcements, run.run_started]
    );
    await pool.query('UPDATE profiles SET last_run_at = now() WHERE id = $1', [run.profile_id]);
  }
}

/**
 * Runs presos em pending/running (worker morto, FTS eterno, last_run_at marcado
 * no enqueue) bloqueavam a agenda diária para sempre. Fecha-os para o próximo tick
 * poder voltar a criar um run.
 */
export async function recoverStaleProfileRuns(): Promise<number> {
  const { rows: stale } = await pool.query(
    `UPDATE profile_runs pr
        SET status = 'failed',
            finished_at = now(),
            error_message = COALESCE(pr.error_message, 'recolha órfã (sem progresso)')
      WHERE pr.status IN ('pending', 'running')
        AND COALESCE(pr.started_at, pr.created_at) < now() - ($1 || ' hours')::interval
        AND NOT EXISTS (
          SELECT 1 FROM searches s
           WHERE s.profile_run_id = pr.id
             AND s.status = 'running'
             AND coalesce(s.heartbeat_at, s.started_at, s.created_at) > now() - interval '20 minutes'
        )
      RETURNING pr.id`,
    [String(PROFILE_RUN_STALE_HOURS)],
  );
  for (const run of stale) {
    await pool.query(
      `UPDATE searches SET status = 'failed',
          error_message = COALESCE(error_message, 'recolha órfã (sem progresso)'),
          finished_at = now()
        WHERE profile_run_id = $1 AND status IN ('pending', 'running')`,
      [run.id],
    );
    console.log(`[scheduler] profile_run #${run.id} marcado como falhado (órfão)`);
  }
  return stale.length;
}

/** Agenda runs para perfis daily/weekly cujo intervalo passou. */
export async function scheduleDueProfiles(): Promise<void> {
  await recoverStaleProfileRuns();
  const { rows } = await pool.query(`
    SELECT p.id, p.schedule, p.last_run_at,
           EXISTS (
             SELECT 1 FROM profile_runs pr
              WHERE pr.profile_id = p.id AND pr.status IN ('pending','running')
           ) AS has_in_flight
      FROM profiles p
     WHERE p.schedule IN ('daily', 'weekly')
  `);
  const now = new Date();
  for (const p of rows) {
    const due = profileScheduleDue({
      schedule: p.schedule,
      hasInFlight: Boolean(p.has_in_flight),
      lastFinishedAt: p.last_run_at ? new Date(p.last_run_at) : null,
      now,
    });
    if (!due) continue;
    await createProfileRun(p.id, null);
    console.log(`[scheduler] run agendado para perfil #${p.id}`);
  }
}
