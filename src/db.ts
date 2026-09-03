import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('railway') || config.databaseUrl.includes('rlwy.net')
    ? { rejectUnauthorized: false }
    : undefined,
});

const SCHEMA = `
-- Multi-tenant: uma empresa por conta (o modelo permite vários utilizadores por empresa no futuro).
CREATE TABLE IF NOT EXISTS companies (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,
  nif                     TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'baseradar',
  subscription_status     TEXT NOT NULL DEFAULT 'trialing',  -- trialing | active | past_due | canceled
  trial_ends_at           TIMESTAMPTZ,
  easypay_customer_id     TEXT,
  easypay_subscription_id TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;
-- Prova de aceitação dos Termos e da Política de Privacidade: quem aceitou,
-- que versão e quando. Sem isto não há prova em caso de litígio.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_ip          TEXT;

CREATE TABLE IF NOT EXISTS searches (
  id             SERIAL PRIMARY KEY,
  term           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  total_reported INT,
  total_scraped  INT DEFAULT 0,
  error_message  TEXT,
  created_by     INT REFERENCES users(id),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id                         SERIAL PRIMARY KEY,
  basegov_id                 BIGINT UNIQUE NOT NULL,
  description                TEXT,
  object_brief_description   TEXT,
  contracting_procedure_type TEXT,
  contract_types             TEXT,
  publication_date           DATE,
  signing_date               DATE,
  close_date                 DATE,
  execution_deadline         TEXT,
  execution_place            TEXT,
  initial_contractual_price  NUMERIC(15,2),
  total_effective_price      NUMERIC(15,2),
  cpvs                       TEXT,
  cpvs_designation           TEXT,
  contract_fundamentation    TEXT,
  regime                     TEXT,
  contracting_procedure_url  TEXT,
  centralized_procedure      BOOLEAN,
  ambient_criteria           BOOLEAN,
  ccp                        BOOLEAN,
  raw_list_json              JSONB NOT NULL,
  raw_detail_json            JSONB,
  detail_scraped_at          TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entities (
  id          SERIAL PRIMARY KEY,
  basegov_id  BIGINT,
  nif         TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  UNIQUE (nif, name)
);

CREATE TABLE IF NOT EXISTS contract_entities (
  contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  entity_id   INT NOT NULL REFERENCES entities(id),
  role        TEXT NOT NULL,
  PRIMARY KEY (contract_id, entity_id, role)
);

CREATE TABLE IF NOT EXISTS search_results (
  search_id   INT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  contract_id INT NOT NULL REFERENCES contracts(id),
  position    INT NOT NULL,
  PRIMARY KEY (search_id, contract_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id             SERIAL PRIMARY KEY,
  contract_id    INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  basegov_id     BIGINT UNIQUE NOT NULL,
  file_name      TEXT NOT NULL,
  content_type   TEXT,
  size_bytes     BIGINT,
  content        BYTEA,
  download_ok    BOOLEAN NOT NULL DEFAULT false,
  download_error TEXT,
  downloaded_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contracts_basegov ON contracts(basegov_id);
CREATE INDEX IF NOT EXISTS idx_search_results_search ON search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_documents_contract ON documents(contract_id);

-- v2: perfis de pesquisa multi-termo com agendamento
CREATE TABLE IF NOT EXISTS profiles (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT UNIQUE NOT NULL,
  terms                 TEXT[] NOT NULL,
  schedule              TEXT NOT NULL DEFAULT 'manual',  -- manual | daily | weekly
  include_announcements BOOLEAN NOT NULL DEFAULT true,
  last_run_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fetch_documents BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpv_codes TEXT[] NOT NULL DEFAULT '{}';
-- Multi-tenant: perfis pertencem a uma empresa; nome único por empresa (não global).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_company_name ON profiles (company_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles (company_id);

CREATE TABLE IF NOT EXISTS profile_runs (
  id                SERIAL PRIMARY KEY,
  profile_id        INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  new_contracts     INT DEFAULT 0,
  new_announcements INT DEFAULT 0,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE searches ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'contratos';
ALTER TABLE searches ADD COLUMN IF NOT EXISTS profile_run_id INT REFERENCES profile_runs(id) ON DELETE SET NULL;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS retries INT NOT NULL DEFAULT 0;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS fetch_documents BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE searches ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_searches_company ON searches (company_id);

-- v2: anúncios de procedimento (concursos abertos)
CREATE TABLE IF NOT EXISTS announcements (
  id                         SERIAL PRIMARY KEY,
  basegov_id                 BIGINT UNIQUE NOT NULL,
  announcement_type          TEXT,
  model_type                 TEXT,
  announcement_number        TEXT,
  contract_designation       TEXT,
  contract_type              TEXT,
  contracting_procedure_type TEXT,
  contracting_entity         TEXT,
  base_price                 NUMERIC(15,2),
  dr_publication_date        DATE,
  proposal_deadline_date     DATE,
  cpvs                       TEXT,
  contracting_procedure_url  TEXT,
  reference_url              TEXT,
  raw_list_json              JSONB NOT NULL,
  raw_detail_json            JSONB,
  detail_scraped_at          TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_announcements (
  search_id       INT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  announcement_id INT NOT NULL REFERENCES announcements(id),
  position        INT NOT NULL,
  PRIMARY KEY (search_id, announcement_id)
);

-- v3: dados abertos do IMPIC (dados.gov.pt) como fonte primária do histórico
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS raw_opendata_json JSONB;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS opendata_imported BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS opendata_imports (
  id            SERIAL PRIMARY KEY,
  year          INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
  total_rows    INT,
  imported_rows INT DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE opendata_imports ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

-- Catálogo CPV construído a partir do corpus (código + designação PT + frequência)
CREATE TABLE IF NOT EXISTS cpv_catalog (
  code             TEXT PRIMARY KEY,
  designation      TEXT NOT NULL,
  designation_norm TEXT NOT NULL,
  n_contracts      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cpv_norm ON cpv_catalog(designation_norm text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_cpv_n ON cpv_catalog(n_contracts DESC);

-- Análises IA (ficha de oportunidade / go-no-go) e fit scores, com cache
CREATE TABLE IF NOT EXISTS ai_analyses (
  id              SERIAL PRIMARY KEY,
  announcement_id INT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  profile_id      INT NOT NULL DEFAULT 0,   -- 0 = sem contexto de atividade
  model           TEXT,
  analysis        JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, profile_id)
);

CREATE TABLE IF NOT EXISTS ai_contract_analyses (
  id          SERIAL PRIMARY KEY,
  contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  profile_id  INT NOT NULL DEFAULT 0,
  model       TEXT,
  analysis    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, profile_id)
);

CREATE TABLE IF NOT EXISTS ai_fit_scores (
  profile_id INT NOT NULL,
  item_type  TEXT NOT NULL,   -- anuncio_aberto | renovacao
  item_id    INT NOT NULL,
  fit        INT,
  reason     TEXT,
  model      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, item_type, item_id)
);
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS reasons JSONB;

-- Planos de subscrição (free | pro | business). O plano é a fonte de gating.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS renewal_at TIMESTAMPTZ;  -- próxima renovação/cobrança
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pending_plan TEXT;       -- plano em checkout, promovido no webhook pago
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ; -- fim do acesso em pagamento pontual (1 mês); null em subscrição
ALTER TABLE companies ALTER COLUMN plan SET DEFAULT 'free';             -- novos registos = free
-- Backfill legado: o antigo plano único "baseradar" corresponde ao Pro.
UPDATE companies SET plan = 'pro' WHERE plan = 'baseradar';
-- Empresas sem plano reconhecido (nulo/vazio/desconhecido) resolvem como free.
UPDATE companies SET plan = 'free' WHERE plan IS NULL OR plan NOT IN ('free', 'pro', 'business');

-- Registo de utilização de IA (uma linha por análise BEM-SUCEDIDA). Conta e regista;
-- NÃO bloqueia (o teto é soft, controlado por flag). Falhas não contam.
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id             SERIAL PRIMARY KEY,
  company_id     INT REFERENCES companies(id) ON DELETE CASCADE,
  user_id        INT REFERENCES users(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL,               -- fit | analise_anuncio | analise_contrato | dossier
  tokens_in      INT NOT NULL DEFAULT 0,
  tokens_out     INT NOT NULL DEFAULT 0,
  cost_estimate  NUMERIC(12,6) NOT NULL DEFAULT 0,  -- USD estimado
  model          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_company_month ON ai_usage_events (company_id, created_at);

-- Convites de utilizadores por empresa (seats). Limite por plano validado na app.
CREATE TABLE IF NOT EXISTS company_invites (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  invited_by  INT REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_invites_company ON company_invites (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_invites_pending
  ON company_invites (company_id, lower(email)) WHERE accepted_at IS NULL;

-- Feedback / pedidos de ajuda dos utilizadores. O envio por email é feito à parte
-- (a implementar); aqui fica sempre o registo interno para acompanhamento.
CREATE TABLE IF NOT EXISTS feedback (
  id         SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL DEFAULT 'feedback',   -- feedback | help
  message    TEXT NOT NULL,
  email      TEXT,
  handled    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at DESC);

-- Pagamentos confirmados (Stripe). stripe_event_id garante idempotência dos webhooks.
CREATE TABLE IF NOT EXISTS payments (
  id                 SERIAL PRIMARY KEY,
  company_id         INT REFERENCES companies(id) ON DELETE SET NULL,
  stripe_event_id    TEXT UNIQUE,
  kind               TEXT NOT NULL,               -- subscription | one_time
  plan               TEXT,
  amount_cents       INT NOT NULL DEFAULT 0,      -- valor pago (bruto, com IVA)
  currency           TEXT NOT NULL DEFAULT 'eur',
  moloni_document_id BIGINT,                       -- fatura Moloni emitida (se aplicável)
  moloni_status      TEXT,                         -- ok | draft | skipped | error
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments (company_id, created_at DESC);

-- Eventos Stripe já processados (idempotência do webhook; Stripe reenvia).
CREATE TABLE IF NOT EXISTS stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos de recuperação de password. O token é guardado com hash: quem tiver
-- acesso à base de dados não consegue usá-lo para tomar contas.
CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

-- Resumo histórico da contratação anterior ao corte de retenção. Guarda a
-- quota de mercado por entidade/ano/CPV/distrito para que a inteligência
-- competitiva sobreviva ao apagamento das linhas detalhadas dos contratos.
CREATE TABLE IF NOT EXISTS contract_history_agg (
  year         INT NOT NULL,
  entity_id    INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,                 -- contracted | contracting
  cpv_division TEXT NOT NULL DEFAULT '',      -- 2 primeiros dígitos do CPV
  district     TEXT NOT NULL DEFAULT '',
  n_contracts  INT NOT NULL DEFAULT 0,
  total_value  NUMERIC(15,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (year, entity_id, role, cpv_division, district)
);
CREATE INDEX IF NOT EXISTS idx_history_agg_entity ON contract_history_agg (entity_id, role);

CREATE INDEX IF NOT EXISTS idx_announcements_deadline ON announcements(proposal_deadline_date);
CREATE INDEX IF NOT EXISTS idx_announcements_text ON announcements USING gin (to_tsvector('portuguese', coalesce(contract_designation,'') || ' ' || coalesce(contracting_entity,'')));
CREATE INDEX IF NOT EXISTS idx_contracts_text ON contracts USING gin (to_tsvector('portuguese', coalesce(object_brief_description,'') || ' ' || coalesce(description,'')));
CREATE INDEX IF NOT EXISTS idx_ce_entity_role ON contract_entities(entity_id, role);
CREATE INDEX IF NOT EXISTS idx_ce_role_contract ON contract_entities(role, contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_pubdate ON contracts(publication_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts ((signing_date + (substring(execution_deadline from '(\\d+)')::int)))
  WHERE signing_date IS NOT NULL AND execution_deadline ~ '\\d+';
CREATE INDEX IF NOT EXISTS idx_search_announcements_search ON search_announcements(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_profile_run ON searches(profile_run_id);

-- A. Pipeline
CREATE TABLE IF NOT EXISTS opportunity_status (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL CHECK (item_type IN ('anuncio_aberto','renovacao')),
  item_id       INT  NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('interessa','preparacao','submetida','ganha','perdida','descartada')),
  note          TEXT,
  assigned_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by    INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  decided_at    TIMESTAMPTZ,
  UNIQUE (company_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_opp_status_company ON opportunity_status (company_id, status);

CREATE TABLE IF NOT EXISTS opportunity_status_history (
  id          SERIAL PRIMARY KEY,
  status_id   INT NOT NULL REFERENCES opportunity_status(id) ON DELETE CASCADE,
  from_status TEXT, to_status TEXT NOT NULL,
  changed_by  INT REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity_checklist (
  company_id     INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_type      TEXT NOT NULL, item_id INT NOT NULL,
  item_text_hash TEXT NOT NULL,
  checked        BOOLEAN NOT NULL DEFAULT true,
  checked_by     INT REFERENCES users(id) ON DELETE SET NULL,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, item_type, item_id, item_text_hash)
);

-- B. Perfil da empresa
CREATE TABLE IF NOT EXISTS company_profiles (
  company_id        INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  description       TEXT,
  certifications    TEXT[] NOT NULL DEFAULT '{}',
  districts         TEXT[] NOT NULL DEFAULT '{}',
  value_min         NUMERIC(15,2), value_max NUMERIC(15,2),
  excluded_terms    TEXT[] NOT NULL DEFAULT '{}',
  excluded_entities TEXT[] NOT NULL DEFAULT '{}',
  version           INT NOT NULL DEFAULT 1,
  updated_by        INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (value_min IS NULL OR value_max IS NULL OR value_max > value_min)
);
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS profile_version INT NOT NULL DEFAULT 0;
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS rule_hits JSONB NOT NULL DEFAULT '[]';

-- D. Notificações
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_digest    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_version   INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS notification_log (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  attempts    INT NOT NULL DEFAULT 0,
  provider_id TEXT, error TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ,
  UNIQUE (kind, user_id, ref)
);

CREATE TABLE IF NOT EXISTS reminder_log (
  company_id INT NOT NULL, item_type TEXT NOT NULL, item_id INT NOT NULL,
  kind TEXT NOT NULL, deadline DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, item_type, item_id, kind, deadline)
);

-- E. Feedback IA
CREATE TABLE IF NOT EXISTS ai_feedback (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('fit','analysis')),
  item_type   TEXT NOT NULL, item_id INT NOT NULL,
  verdict     TEXT NOT NULL CHECK (verdict IN ('up','down')),
  reason_code TEXT CHECK (reason_code IN ('fora_atividade','fora_geografia','requisito_impossivel','valor_desadequado','outro')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, target_type, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_company ON ai_feedback (company_id, verdict, created_at DESC);

-- C. Índices de filtros (pg_trgm fica no migrateAndSeed com fallback)
CREATE INDEX IF NOT EXISTS idx_ann_procedure ON announcements (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_ann_base_price ON announcements (base_price);
CREATE INDEX IF NOT EXISTS idx_contracts_procedure ON contracts (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_contracts_price ON contracts (initial_contractual_price);
CREATE INDEX IF NOT EXISTS idx_contracts_district ON contracts (
  (NULLIF(btrim(split_part(split_part(execution_place,'|',1),',',2)),''))
);
`;

export async function migrateAndSeed(): Promise<void> {
  await pool.query(SCHEMA);
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_ann_entity_trgm ON announcements USING gin (lower(contracting_entity) gin_trgm_ops)`
    );
  } catch (err) {
    console.warn('[migrate] pg_trgm indisponível — filtros usam ILIKE:', String(err).slice(0, 180));
  }

  // Recuperação pós-restart (single replica): trabalho que ficou 'running'
  // quando o processo morreu é órfão — volta à fila (processamento idempotente).
  const orphanSearches = await pool.query(
    `UPDATE searches SET status = 'pending', next_attempt_at = now() WHERE status = 'running' RETURNING id`);
  const orphanImports = await pool.query(
    `UPDATE opendata_imports SET status = 'pending' WHERE status = 'running' RETURNING id, year`);
  if (orphanSearches.rowCount) console.log(`[recovery] ${orphanSearches.rowCount} pesquisa(s) órfã(s) reagendada(s)`);
  if (orphanImports.rowCount) console.log(`[recovery] ${orphanImports.rowCount} import(s) órfão(s) reagendado(s)`);
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  let adminId = rows[0]?.id as number | undefined;
  if (adminId === undefined) {
    const hash = await bcrypt.hash('admin123', 10);
    const ins = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id', ['admin', hash]);
    adminId = ins.rows[0].id;
    console.log('Seeded default user: admin');
  }

  // Empresa interna que detém todos os dados pré-existentes (conta admin).
  // Fica 'active' para nunca ser bloqueada pelo gating de subscrição.
  let { rows: co } = await pool.query(
    `SELECT id FROM companies WHERE name = 'Conta principal' ORDER BY id LIMIT 1`);
  if (co.length === 0) {
    co = (await pool.query(
      `INSERT INTO companies (name, plan, subscription_status) VALUES ('Conta principal', 'business', 'active') RETURNING id`)).rows;
    console.log('Seeded default company: Conta principal');
  }
  const defaultCompanyId = co[0].id;

  // Liga a conta admin à empresa interna e marca-a como administradora.
  await pool.query(
    `UPDATE users SET company_id = COALESCE(company_id, $1), is_admin = true WHERE id = $2`,
    [defaultCompanyId, adminId]);

  // Todos os perfis/pesquisas sem dono passam para a empresa interna (dados legados).
  await pool.query('UPDATE profiles SET company_id = $1 WHERE company_id IS NULL', [defaultCompanyId]);
  await pool.query('UPDATE searches SET company_id = $1 WHERE company_id IS NULL', [defaultCompanyId]);

  // GTM: o perfil interno de pirotecnia contradiz a oferta (obras / saúde / energia).
  const dropped = await pool.query(
    `DELETE FROM profiles
      WHERE company_id = $1
        AND (name ILIKE '%pirotecnia%' OR name ILIKE '%fogo de artifício%' OR name ILIKE '%fogo de artificio%')
      RETURNING id, name`,
    [defaultCompanyId]
  );
  if (dropped.rowCount) {
    console.log(`[seed] perfil GTM removido: ${dropped.rows.map((r: { name: string }) => r.name).join(', ')}`);
  }
}
