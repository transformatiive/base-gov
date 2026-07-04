import { pool } from './db.js';

/** minúsculas + sem acentos, para pesquisa tolerante sem depender de extensões PG */
export const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Reconstrói o catálogo CPV a partir do corpus de contratos
 * (códigos e designações oficiais em PT já vêm nos dados abertos).
 */
export async function refreshCpvCatalog(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT code, designation, count(*)::int AS n
    FROM (
      SELECT btrim(u.code) AS code, btrim(coalesce(u.des, '')) AS designation
      FROM contracts c,
      LATERAL unnest(
        string_to_array(c.cpvs, ';'),
        string_to_array(coalesce(c.cpvs_designation, ''), ';')
      ) AS u(code, des)
      WHERE c.cpvs IS NOT NULL
    ) t
    WHERE code ~ '^\\d{8}'
    GROUP BY 1, 2
  `);

  // designação mais frequente por código
  const byCode = new Map<string, { designation: string; n: number; total: number }>();
  for (const r of rows) {
    const code = String(r.code).slice(0, 10);
    const cur = byCode.get(code);
    if (!cur) {
      byCode.set(code, { designation: r.designation, n: r.n, total: r.n });
    } else {
      cur.total += r.n;
      if (r.designation && r.n > cur.n) {
        cur.n = r.n;
        cur.designation = r.designation;
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cpv_catalog');
    const entries = [...byCode.entries()];
    for (let i = 0; i < entries.length; i += 500) {
      const batch = entries.slice(i, i + 500);
      const values: unknown[] = [];
      const tuples = batch.map(([code, v], j) => {
        values.push(code, v.designation || code, normalize(v.designation || code), v.total);
        const o = j * 4;
        return `($${o + 1},$${o + 2},$${o + 3},$${o + 4})`;
      });
      await client.query(
        `INSERT INTO cpv_catalog (code, designation, designation_norm, n_contracts) VALUES ${tuples.join(',')}
         ON CONFLICT (code) DO NOTHING`,
        values
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log(`[cpv] catálogo atualizado: ${byCode.size} códigos`);
  return byCode.size;
}

/** Atualiza o catálogo no arranque se estiver vazio (corre em background). */
export function ensureCpvCatalog(): void {
  void (async () => {
    try {
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM cpv_catalog');
      if (rows[0].n === 0) await refreshCpvCatalog();
    } catch (err) {
      console.error('[cpv] falha a construir catálogo:', err);
    }
  })();
}
