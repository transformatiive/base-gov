import { pool } from './db.js';

/** Cria um profile_run e as pesquisas filhas (contratos + anúncios por termo). */
export async function createProfileRun(profileId: number, createdBy: number | null): Promise<number> {
  const { rows: profRows } = await pool.query(
    'SELECT id, terms, include_announcements, fetch_documents FROM profiles WHERE id = $1',
    [profileId]
  );
  if (profRows.length === 0) throw new Error('Perfil não encontrado');
  const profile = profRows[0];

  const { rows: runRows } = await pool.query(
    'INSERT INTO profile_runs (profile_id) VALUES ($1) RETURNING id',
    [profileId]
  );
  const runId = runRows[0].id;

  for (const term of profile.terms as string[]) {
    await pool.query(
      `INSERT INTO searches (term, kind, profile_run_id, created_by, fetch_documents) VALUES ($1,'contratos',$2,$3,$4)`,
      [term, runId, createdBy, profile.fetch_documents === true]
    );
    if (profile.include_announcements) {
      await pool.query(
        `INSERT INTO searches (term, kind, profile_run_id, created_by) VALUES ($1,'anuncios',$2,$3)`,
        [term, runId, createdBy]
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
         (SELECT count(DISTINCT c.id) FROM search_results sr
            JOIN searches s ON s.id = sr.search_id AND s.profile_run_id = $1
            JOIN contracts c ON c.id = sr.contract_id
           WHERE c.created_at >= $2) AS new_contracts,
         (SELECT count(DISTINCT a.id) FROM search_announcements sa
            JOIN searches s ON s.id = sa.search_id AND s.profile_run_id = $1
            JOIN announcements a ON a.id = sa.announcement_id
           WHERE a.created_at >= $2) AS new_announcements,
         (SELECT bool_or(s.status = 'failed') FROM searches s WHERE s.profile_run_id = $1) AS any_failed`,
      [run.id, run.run_started ?? new Date(0)]
    );
    await pool.query(
      `UPDATE profile_runs SET status = $2, new_contracts = $3, new_announcements = $4, finished_at = now(),
         started_at = COALESCE(started_at, $5)
       WHERE id = $1`,
      [run.id, counts.any_failed ? 'failed' : 'completed', counts.new_contracts, counts.new_announcements, run.run_started]
    );
    await pool.query('UPDATE profiles SET last_run_at = now() WHERE id = $1', [run.profile_id]);
  }
}

/** Agenda runs para perfis daily/weekly cujo intervalo passou. */
export async function scheduleDueProfiles(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT p.id FROM profiles p
    WHERE ((p.schedule = 'daily'  AND (p.last_run_at IS NULL OR p.last_run_at < now() - interval '24 hours'))
        OR (p.schedule = 'weekly' AND (p.last_run_at IS NULL OR p.last_run_at < now() - interval '7 days')))
      AND NOT EXISTS (SELECT 1 FROM profile_runs pr WHERE pr.profile_id = p.id AND pr.status IN ('pending','running'))
  `);
  for (const p of rows) {
    // marca já o last_run_at para não re-agendar enquanto corre
    await pool.query('UPDATE profiles SET last_run_at = now() WHERE id = $1', [p.id]);
    await createProfileRun(p.id, null);
    console.log(`[scheduler] run agendado para perfil #${p.id}`);
  }
}
