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
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_announcements_deadline ON announcements(proposal_deadline_date);
CREATE INDEX IF NOT EXISTS idx_contracts_text ON contracts USING gin (to_tsvector('portuguese', coalesce(object_brief_description,'') || ' ' || coalesce(description,'')));
CREATE INDEX IF NOT EXISTS idx_search_announcements_search ON search_announcements(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_profile_run ON searches(profile_run_id);
`;

export async function migrateAndSeed(): Promise<void> {
  await pool.query(SCHEMA);
  const { rows } = await pool.query('SELECT 1 FROM users WHERE username = $1', ['admin']);
  if (rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('Seeded default user: admin');
  }
}
