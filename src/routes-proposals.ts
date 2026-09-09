import { FastifyInstance, FastifyReply } from 'fastify';
import { pool } from './db.js';
import { requireAuth, auth } from './auth.js';
import { requirePlan } from './plans.js';
import { recordUsage, rejectIfAiCapped } from './aiUsage.js';
import { aiEnabled } from './ai.js';
import { buildDocx, DOCX_CONTENT_TYPE, extractDocxText } from './docx-lite.js';
import {
  llmFingerprint,
  statisticalForecastForAnnouncement,
  type StatisticalForecast,
} from './closeForecast.js';
import {
  buildGapReport,
  emptyProfile,
  flattenRequirements,
  marginWarning,
  nextVersion,
  parseProfileBody,
  profileMissingFields,
  type ProposalCompanyProfile,
  type RequirementsExtraction,
} from './proposals.js';
import {
  extractAnnouncementRequirements,
  generateProposalSections,
  qualifyCloseForecast,
  reevaluateProposalGaps,
} from './proposalAi.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function errStatus(err: unknown): number {
  const s = (err as { statusCode?: number }).statusCode;
  return typeof s === 'number' ? s : 500;
}

function sendFail(reply: FastifyReply, err: unknown, fallback = 502): void {
  const status = errStatus(err);
  const code = status === 404 ? 'not_found' : status === 400 ? 'invalid' : 'ai_failed';
  reply.code(status === 500 ? fallback : status).send({
    error: { code, message: String((err as Error).message ?? err).slice(0, 400) },
  });
}

function rowToProfile(row: Record<string, unknown> | undefined, company: { name?: string | null; nif?: string | null }): ProposalCompanyProfile {
  if (!row) {
    return {
      ...emptyProfile(),
      legal_name: company.name ?? null,
      nif: company.nif ?? null,
    };
  }
  return {
    legal_name: (row.legal_name as string | null) ?? company.name ?? null,
    nif: (row.nif as string | null) ?? company.nif ?? null,
    cae: (row.cae as string | null) ?? null,
    certifications: (row.certifications as string[]) ?? [],
    technical_capabilities: (row.technical_capabilities as string | null) ?? null,
    portfolio: (row.portfolio as string | null) ?? null,
    references: (row.project_references as ProposalCompanyProfile['references']) ?? [],
    key_team: (row.key_team as ProposalCompanyProfile['key_team']) ?? [],
    min_margin_pct: row.min_margin_pct != null ? Number(row.min_margin_pct) : null,
    notes: (row.notes as string | null) ?? null,
  };
}

async function loadCompany(companyId: number): Promise<{ name: string | null; nif: string | null }> {
  const { rows } = await pool.query('SELECT name, nif FROM companies WHERE id = $1', [companyId]);
  return { name: rows[0]?.name ?? null, nif: rows[0]?.nif ?? null };
}

async function loadProfile(companyId: number): Promise<ProposalCompanyProfile> {
  const company = await loadCompany(companyId);
  const { rows } = await pool.query('SELECT * FROM proposal_company_profiles WHERE company_id = $1', [companyId]);
  return rowToProfile(rows[0], company);
}

async function saveProfile(companyId: number, userId: number | null, profile: ProposalCompanyProfile): Promise<void> {
  await pool.query(
    `INSERT INTO proposal_company_profiles (
       company_id, legal_name, nif, cae, certifications, technical_capabilities,
       portfolio, project_references, key_team, min_margin_pct, notes, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (company_id) DO UPDATE SET
       legal_name = EXCLUDED.legal_name, nif = EXCLUDED.nif, cae = EXCLUDED.cae,
       certifications = EXCLUDED.certifications, technical_capabilities = EXCLUDED.technical_capabilities,
       portfolio = EXCLUDED.portfolio, project_references = EXCLUDED.project_references, key_team = EXCLUDED.key_team,
       min_margin_pct = EXCLUDED.min_margin_pct, notes = EXCLUDED.notes,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [
      companyId, profile.legal_name, profile.nif, profile.cae, profile.certifications,
      profile.technical_capabilities, profile.portfolio, JSON.stringify(profile.references),
      JSON.stringify(profile.key_team), profile.min_margin_pct, profile.notes, userId,
    ]
  );
}

function publicProfile(p: ProposalCompanyProfile) {
  return { ...p, missing: profileMissingFields(p) };
}

function publicForecast(stat: StatisticalForecast, llm: Record<string, unknown> | null, warn: string | null) {
  return {
    available: stat.available,
    confidence: stat.confidence,
    sample_size: stat.sample_size,
    entity_sample_size: stat.entity_sample_size,
    months: stat.months,
    match_level: stat.match_level,
    low_pct: stat.low_pct,
    high_pct: stat.high_pct,
    mid_pct: stat.mid_pct,
    low_value: stat.low_value,
    high_value: stat.high_value,
    mid_value: stat.mid_value,
    note: stat.note,
    used: stat.used.map((u) => ({
      id: u.id,
      basegov_id: u.basegov_id,
      title: u.title,
      entity: u.entity,
      awarded: u.awarded,
      historical_base: u.historical_base,
      publication_date: u.publication_date,
      ratio: Math.round(u.ratio * 1000) / 1000,
      ratio_source: u.ratio_source,
      url: `#/contracts/${u.id}`,
      basegov_url: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${u.basegov_id}`,
    })),
    llm,
    margin_warning: warn,
    disclaimer: 'Estimativa baseada em histórico. Não é uma métrica de confiança de modelo treinado.',
  };
}

function decodeBase64Docx(raw: string): Buffer {
  const cleaned = raw.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw Object.assign(new Error('O ficheiro tem de ser um .docx (Open XML).'), { statusCode: 400 });
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('Ficheiro demasiado grande (máx. 8 MB).'), { statusCode: 400 });
  }
  return buf;
}

export async function registerProposalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/company/proposal-profile', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const profile = await loadProfile(companyId);
    return publicProfile(profile);
  });

  app.put('/api/company/proposal-profile', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    try {
      const current = await loadProfile(companyId);
      const profile = parseProfileBody((req.body ?? {}) as Record<string, unknown>, current);
      await saveProfile(companyId, userId, profile);
      return publicProfile(profile);
    } catch (err) {
      return sendFail(reply, err, 400);
    }
  });

  app.get('/api/company/proposal-profile/suggested-references', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const { rows } = await pool.query(
      `SELECT c.id, c.object_brief_description AS project, c.initial_contractual_price AS value,
              extract(year FROM c.signing_date)::int AS year,
              (SELECT string_agg(e.name, '; ') FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
                WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS client
         FROM contracts c
         JOIN contract_entities ce ON ce.contract_id = c.id AND ce.role = 'contracted'
         JOIN entities e ON e.id = ce.entity_id
         JOIN companies co ON regexp_replace(coalesce(co.nif,''), '\\D', '', 'g')
                            = regexp_replace(coalesce(e.nif,''), '\\D', '', 'g')
        WHERE co.id = $1 AND regexp_replace(coalesce(co.nif,''), '\\D', '', 'g') ~ '^\\d{9}$'
        ORDER BY c.signing_date DESC NULLS LAST
        LIMIT 20`,
      [companyId]
    );
    return {
      items: rows.map((r) => ({
        project: r.project,
        client: r.client,
        value: r.value != null ? Number(r.value) : null,
        year: r.year,
        contract_id: r.id,
      })),
    };
  });

  app.get('/api/announcements/:id/close-forecast', { preHandler: [requireAuth, requirePlan('previsao_fecho')] }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    try {
      const { announcement, statistical } = await statisticalForecastForAnnouncement(id);
      const fp = llmFingerprint(statistical);
      const { rows: cached } = await pool.query(
        'SELECT fingerprint, llm, model FROM close_forecasts WHERE announcement_id = $1',
        [id]
      );
      const llm = cached[0] && cached[0].fingerprint === fp ? cached[0].llm : null;
      let warn: string | null = null;
      const { companyId } = auth(req);
      if (companyId != null && statistical.high_pct != null) {
        const profile = await loadProfile(companyId);
        warn = marginWarning(profile.min_margin_pct, statistical.high_pct);
      }
      return { announcement, forecast: publicForecast(statistical, llm, warn) };
    } catch (err) {
      return sendFail(reply, err, 404);
    }
  });

  app.post('/api/announcements/:id/close-forecast/qualify', { preHandler: [requireAuth, requirePlan('previsao_fecho')] }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const id = Number((req.params as { id: string }).id);
    try {
      const { announcement, statistical } = await statisticalForecastForAnnouncement(id);
      if (!statistical.available) {
        return reply.code(400).send({ error: { code: 'insufficient_sample', message: statistical.note } });
      }
      const fp = llmFingerprint(statistical);
      const { rows: cached } = await pool.query(
        'SELECT fingerprint, llm, model FROM close_forecasts WHERE announcement_id = $1',
        [id]
      );
      if (cached[0] && cached[0].fingerprint === fp && cached[0].llm) {
        return { announcement, forecast: publicForecast(statistical, cached[0].llm, null), cached: true };
      }
      if (await rejectIfAiCapped(req, reply)) return;
      const q = await qualifyCloseForecast({ announcement, statistical, comparables: statistical.used });
      const llm = {
        low_pct: q.low_pct,
        high_pct: q.high_pct,
        low_value: announcement.base_price != null ? Math.round(announcement.base_price * q.low_pct * 100) / 100 : null,
        high_value: announcement.base_price != null ? Math.round(announcement.base_price * q.high_pct * 100) / 100 : null,
        justificacao: q.justificacao,
        fatores: q.fatores,
        model: q.model,
      };
      await pool.query(
        `INSERT INTO close_forecasts (announcement_id, fingerprint, llm, model)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (announcement_id) DO UPDATE SET fingerprint = $2, llm = $3, model = $4, updated_at = now()`,
        [id, fp, JSON.stringify(llm), q.model]
      );
      const { companyId, userId } = auth(req);
      await recordUsage({
        companyId, userId, kind: 'previsao_fecho',
        tokensIn: q.usage.tokens_in, tokensOut: q.usage.tokens_out, model: q.model,
      });
      return { announcement, forecast: publicForecast(statistical, llm, null), cached: false };
    } catch (err) {
      return sendFail(reply, err);
    }
  });

  app.get('/api/announcements/:id/requirements', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const { rows } = await pool.query(
      'SELECT extraction, model, updated_at FROM announcement_requirements WHERE announcement_id = $1',
      [id]
    );
    if (rows.length === 0) return { extraction: null, checklist: [] };
    const extraction = rows[0].extraction as RequirementsExtraction;
    return {
      extraction,
      checklist: flattenRequirements(extraction),
      model: rows[0].model,
      updated_at: rows[0].updated_at,
    };
  });

  app.post('/api/announcements/:id/requirements', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const id = Number((req.params as { id: string }).id);
    const refresh = (req.body as { refresh?: boolean } | undefined)?.refresh === true;
    try {
      if (refresh) await pool.query('DELETE FROM announcement_requirements WHERE announcement_id = $1', [id]);
      if (!refresh) {
        const { rows: hit } = await pool.query(
          'SELECT 1 FROM announcement_requirements WHERE announcement_id = $1',
          [id],
        );
        if (hit.length === 0 && await rejectIfAiCapped(req, reply)) return;
      } else if (await rejectIfAiCapped(req, reply)) return;
      const r = await extractAnnouncementRequirements(id);
      if (!r.cached) {
        const { companyId, userId } = auth(req);
        await recordUsage({
          companyId, userId, kind: 'requisitos',
          tokensIn: r.usage.tokens_in, tokensOut: r.usage.tokens_out, model: r.model,
        });
      }
      return {
        extraction: r.extraction,
        checklist: flattenRequirements(r.extraction),
        cached: r.cached,
        model: r.model,
        docs_used: r.docs_used,
      };
    } catch (err) {
      return sendFail(reply, err);
    }
  });

  app.get('/api/announcements/:id/proposals', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    const { rows } = await pool.query(
      `SELECT id, version, kind, file_name, content_type, gap_report, created_at, created_by,
              octet_length(content) AS size_bytes
         FROM proposal_versions
        WHERE company_id = $1 AND announcement_id = $2
        ORDER BY version DESC`,
      [companyId, id]
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        version: r.version,
        kind: r.kind,
        file_name: r.file_name,
        content_type: r.content_type,
        size_bytes: Number(r.size_bytes),
        gap_report: r.gap_report,
        created_at: r.created_at,
        download_url: `/api/announcements/${id}/proposals/${r.version}/docx`,
      })),
    };
  });

  app.post('/api/announcements/:id/proposals/generate', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      if (await rejectIfAiCapped(req, reply)) return;
      const { rows: anns } = await pool.query('SELECT * FROM announcements WHERE id = $1', [id]);
      if (anns.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Anúncio não encontrado' } });
      let profile = await loadProfile(companyId);
      if (body.profile && typeof body.profile === 'object') {
        profile = parseProfileBody(body.profile as Record<string, unknown>, profile);
        await saveProfile(companyId, userId, profile);
      }
      const reqs = await extractAnnouncementRequirements(id);
      if (!reqs.cached) {
        await recordUsage({
          companyId, userId, kind: 'requisitos',
          tokensIn: reqs.usage.tokens_in, tokensOut: reqs.usage.tokens_out, model: reqs.model,
        });
      }
      const bidPrice = body.bid_price != null && body.bid_price !== '' ? Number(body.bid_price) : null;
      const gen = await generateProposalSections({
        announcement: anns[0],
        extraction: reqs.extraction,
        profile,
        bidPrice: Number.isFinite(bidPrice as number) ? bidPrice : null,
      });
      await recordUsage({
        companyId, userId, kind: 'proposta',
        tokensIn: gen.usage.tokens_in, tokensOut: gen.usage.tokens_out, model: gen.model,
      });
      const { rows: vers } = await pool.query(
        'SELECT version FROM proposal_versions WHERE company_id = $1 AND announcement_id = $2',
        [companyId, id]
      );
      const version = nextVersion(vers.map((v) => Number(v.version)));
      const fileName = `proposta-${id}-v${version}.docx`;
      const buf = buildDocx({
        title: `Proposta — ${anns[0].contract_designation ?? `Anúncio ${id}`}`,
        subtitle: [anns[0].contracting_entity, profile.legal_name].filter(Boolean).join(' · '),
        note: 'Rascunho gerado pelo PrepBid. Requer revisão humana. A submissão no portal de contratação (BASE.gov / Vortal / acinGov / anoGov / SaphetyGov) é sempre manual.',
        sections: gen.sections,
        footer: gen.structure_note,
      });
      const extracted = await extractDocxText(buf);
      const { rows: ins } = await pool.query(
        `INSERT INTO proposal_versions
           (company_id, announcement_id, version, kind, file_name, content_type, content, extracted_text, created_by)
         VALUES ($1,$2,$3,'generated',$4,$5,$6,$7,$8)
         RETURNING id, version, created_at`,
        [companyId, id, version, fileName, DOCX_CONTENT_TYPE, buf, extracted, userId]
      );
      return {
        id: ins[0].id,
        version: ins[0].version,
        kind: 'generated',
        file_name: fileName,
        download_url: `/api/announcements/${id}/proposals/${version}/docx`,
        structure: gen.structure,
        structure_note: gen.structure_note,
        profile_missing: profileMissingFields(profile),
        created_at: ins[0].created_at,
      };
    } catch (err) {
      return sendFail(reply, err);
    }
  });

  app.get('/api/announcements/:id/proposals/:version/docx', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    const { companyId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    const version = Number((req.params as { version: string }).version);
    const { rows } = await pool.query(
      `SELECT file_name, content_type, content FROM proposal_versions
        WHERE company_id = $1 AND announcement_id = $2 AND version = $3`,
      [companyId, id, version]
    );
    if (rows.length === 0) return reply.code(404).send({ error: { code: 'not_found', message: 'Versão não encontrada' } });
    const row = rows[0];
    const buf = row.content as Buffer;
    return reply
      .header('Content-Type', row.content_type || DOCX_CONTENT_TYPE)
      .header('Content-Disposition', `attachment; filename="${String(row.file_name).replace(/"/g, '')}"`)
      .send(buf);
  });

  app.post('/api/announcements/:id/proposals/upload', { preHandler: [requireAuth, requirePlan('geracao_propostas')] }, async (req, reply) => {
    if (!aiEnabled()) return reply.code(503).send({ error: { code: 'ai_disabled', message: 'IA não configurada' } });
    const { companyId, userId } = auth(req);
    if (companyId == null) return reply.code(400).send({ error: { code: 'no_company', message: 'Conta sem empresa associada.' } });
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { filename?: string; content_base64?: string };
    try {
      if (await rejectIfAiCapped(req, reply)) return;
      if (!body.content_base64) {
        return reply.code(400).send({ error: { code: 'invalid', message: 'content_base64 é obrigatório.' } });
      }
      const buf = decodeBase64Docx(body.content_base64);
      const text = await extractDocxText(buf);
      const reqs = await extractAnnouncementRequirements(id);
      if (!reqs.cached) {
        await recordUsage({
          companyId, userId, kind: 'requisitos',
          tokensIn: reqs.usage.tokens_in, tokensOut: reqs.usage.tokens_out, model: reqs.model,
        });
      }
      const evald = await reevaluateProposalGaps({ extraction: reqs.extraction, proposalText: text });
      await recordUsage({
        companyId, userId, kind: 'reeavaliacao',
        tokensIn: evald.usage.tokens_in, tokensOut: evald.usage.tokens_out, model: evald.model,
      });
      const report = buildGapReport(evald.items);
      const { rows: vers } = await pool.query(
        'SELECT version FROM proposal_versions WHERE company_id = $1 AND announcement_id = $2',
        [companyId, id]
      );
      const version = nextVersion(vers.map((v) => Number(v.version)));
      const fileName = (body.filename || `proposta-${id}-v${version}.docx`).replace(/[^\w.\-à-úÀ-Ú ]+/g, '_');
      const { rows: ins } = await pool.query(
        `INSERT INTO proposal_versions
           (company_id, announcement_id, version, kind, file_name, content_type, content, extracted_text, gap_report, created_by)
         VALUES ($1,$2,$3,'uploaded',$4,$5,$6,$7,$8,$9)
         RETURNING id, version, created_at`,
        [companyId, id, version, fileName, DOCX_CONTENT_TYPE, buf, text, JSON.stringify(report), userId]
      );
      return {
        id: ins[0].id,
        version: ins[0].version,
        kind: 'uploaded',
        file_name: fileName,
        download_url: `/api/announcements/${id}/proposals/${version}/docx`,
        gap_report: report,
        created_at: ins[0].created_at,
      };
    } catch (err) {
      return sendFail(reply, err);
    }
  });
}
