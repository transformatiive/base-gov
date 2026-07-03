# SPEC — Robot de Pesquisa e Scraping do Portal BASE (base.gov.pt)

> Especificação funcional e técnica para implementação da aplicação por um agente de código (Claude).
> Versão: 1.0 · Data: 2026-07-03

---

## 1. Objetivo

Criar uma aplicação web ("robot") que, a partir de um **termo de pesquisa** introduzido pelo utilizador:

1. Consulta o site **https://www.base.gov.pt** (Portal BASE — contratos públicos portugueses) através da sua **API JSON não documentada** (chamadas HTTP diretas — ver secção 3);
2. Executa a pesquisa de **contratos** com esse termo;
3. Percorre a **listagem paginada completa** de resultados;
4. Para **cada linha** da listagem, abre/consulta o **detalhe** do contrato e extrai todos os campos;
5. Se a página de detalhe tiver **documentos para download**, descarrega-os e guarda o **binário** associado ao registo;
6. Regista tudo numa base de dados **PostgreSQL**;
7. Disponibiliza um **UI web simples** (login, histórico de pesquisas, resultados, detalhe, nova pesquisa, exportação Excel);
8. Expõe uma **API REST** para aplicações externas obterem os resultados, detalhes e documentos (links ou binário).

> **Faseamento**: a **v1 não usa Playwright** — todo o scraping é feito por chamadas HTTP diretas à API JSON do BASE, verificada e funcional sem browser. O Playwright fica reservado para uma **fase 2** como fallback DOM, caso a API mude ou passe a exigir contexto de browser. A camada `BaseGovClient` (secção 3.4) é desenhada para essa troca ser transparente.

---

## 2. Stack tecnológica (obrigatória/recomendada)

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20+ com TypeScript |
| Scraper | **Cliente HTTP direto** (`undici`/`fetch` nativo) contra a API JSON do BASE — sem browser na v1 |
| Backend / API | Fastify (ou Express) + Zod para validação |
| Base de dados | **PostgreSQL 16** (documentos em `BYTEA`) |
| Acesso a dados | Prisma ORM (ou Knex; escolher um e ser consistente) |
| Frontend | React + Vite (SPA simples) servida pelo backend; UI minimalista (pode usar Tailwind) |
| Exportação Excel | `exceljs` |
| Autenticação | Sessão por cookie (UI) + API key/Basic Auth (API externa) |
| Jobs | Fila em processo (worker interno) — sem dependências externas tipo Redis |
| Deploy local | `docker-compose` (serviços: `app`, `postgres`) |

---

## 3. Como funciona o site base.gov.pt (conhecimento do alvo)

O Portal BASE é uma SPA. A página de pesquisa é `https://www.base.gov.pt/Base4/pt/pesquisa/` e os dados são carregados via **pedidos AJAX POST** para `https://www.base.gov.pt/Base4/pt/resultados/`.

> **⚡ Serviço "escondido" — caminho adotado na v1.** Este endpoint AJAX é, na prática, uma API JSON não documentada que devolve tudo o que precisamos (listagem, detalhe e binário dos documentos) **sem necessidade de fazer parsing de HTML**. Foi verificado ao vivo em 2026-07-03 e **funciona com `curl` puro, sem browser e sem cookies**. A v1 usa exclusivamente esta API via cliente HTTP; ver estratégia em 3.4.

### 3.1 Endpoint de listagem (pesquisa de contratos)

```
POST https://www.base.gov.pt/Base4/pt/resultados/
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

type=search_contratos
&version=91.0
&query=texto%3D<TERMO>%26tipo%3D0%26tipocontrato%3D0%26pais%3D0%26distrito%3D0%26concelho%3D0
&sort=-publicationDate
&page=0          // 0-based
&size=25         // usar 25–100 por página
```

Resposta (JSON):

```json
{
  "total": 37032,
  "items": [
    {
      "id": 15236157,
      "contractingProcedureType": "Consulta Prévia",
      "publicationDate": "03-07-2026",
      "signingDate": "18-06-2026",
      "contracting": "Parques de Sintra-Monte da Lua, SA",
      "contracted": "Code Five, Lda",
      "objectBriefDescription": "Aquisição de serviços de consultoria...",
      "initialContractualPrice": "35.760,00 €",
      "ccp": false
    }
  ]
}
```

- A paginação faz-se incrementando `page` até `page * size >= total`.
- O parâmetro `query` é ele próprio um querystring **URL-encoded dentro do campo** (`texto=<termo>&tipo=0&...`).

### 3.2 Endpoint de detalhe de contrato

```
POST https://www.base.gov.pt/Base4/pt/resultados/
type=detail_contratos&version=91.0&id=<contractId>
```

Resposta (JSON) — campos relevantes a persistir (lista não exaustiva; guardar também o JSON bruto):

`id, description, objectBriefDescription, contractingProcedureType, contractTypes, publicationDate, signingDate, closeDate, executionDeadline, executionPlace, initialContractualPrice, totalEffectivePrice, cpvs, cpvsDesignation, contractFundamentationType, directAwardFundamentationType, regime, centralizedProcedure, ambientCriteria, materialCriteria, frameworkAgreementProcedureId, frameworkAgreementProcedureDescription, contractingProcedureUrl, announcementId, observations, contractStatus, endOfContractType, causesDeadlineChange, causesPriceChange, increments, income, ccp, normal, specialMeasures, contracting[] {id, nif, description}, contracted[] {id, nif, description}, contestants[] {id, nif, description}, invitees[], documents[] {id, description}`

### 3.3 Download de documentos

Cada entrada em `documents[]` do detalhe descarrega-se com:

```
GET https://www.base.gov.pt/Base4/pt/resultados/?type=doc_documentos&id=<documentId>
→ 200, Content-Type: application/pdf (ou outro), corpo = binário do ficheiro
```

Guardar: nome (`description`), content-type devolvido, tamanho e binário.

### 3.4 Estratégia de scraping (v1: API direta, sem browser)

1. Todo o acesso ao BASE faz-se por **chamadas HTTP diretas** (fetch/undici) aos três endpoints acima — listagem, detalhe e documentos. Não há renderização de página nem parsing de HTML.
2. As três operações ficam encapsuladas atrás de uma interface **`BaseGovClient`** (`search(term, page, size)`, `getDetail(id)`, `downloadDocument(id)`), com a implementação v1 `HttpBaseGovClient`.
3. **Fase 2 (fora de âmbito da v1)**: se os endpoints AJAX mudarem ou passarem a exigir contexto de browser (cookies, anti-bot), implementar `PlaywrightBaseGovClient` com a mesma interface — quer via `APIRequestContext` (reutilizando cookies do browser), quer, em último recurso, por interação DOM com a UI de pesquisa. O resto da aplicação não muda.
4. O parâmetro `version` (atualmente `91.0`) deve estar em configuração (env var `BASEGOV_API_VERSION`), não hardcoded espalhado pelo código.
5. Validar as respostas JSON com Zod (`total`/`items` presentes, tipos esperados); uma resposta com formato inesperado deve falhar a pesquisa com `error_message` claro — é o sinal de que a API mudou e é altura de ativar a fase 2.

**Boas práticas de cortesia / robustez:**

- Rate limiting: máx. ~2 pedidos/segundo (delay configurável `SCRAPE_DELAY_MS`, default 500ms), concorrência de detalhe configurável (default 3).
- Retries com backoff exponencial (3 tentativas: 2s/4s/8s) em erros de rede/5xx.
- Timeout por pedido: 30s.
- `User-Agent` realista.
- Idempotência: re-executar uma pesquisa não duplica contratos (upsert por `basegov_id`).
- Limite de segurança configurável `MAX_RESULTS_PER_SEARCH` (default 5000) para termos demasiado genéricos; ao atingi-lo, a pesquisa termina com estado `completed_truncated` e o total real fica registado.

---

## 4. Modelo de dados (PostgreSQL)

```sql
-- utilizadores da aplicação
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- bcrypt
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- seed: admin / admin123 (hash bcrypt gerado no seed)

-- pesquisas efetuadas
CREATE TABLE searches (
  id             SERIAL PRIMARY KEY,
  term           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
    -- pending | running | completed | completed_truncated | failed
  total_reported INT,          -- "total" devolvido pelo site
  total_scraped  INT DEFAULT 0,
  error_message  TEXT,
  created_by     INT REFERENCES users(id),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contratos (únicos por id do BASE; partilháveis entre pesquisas)
CREATE TABLE contracts (
  id                         SERIAL PRIMARY KEY,
  basegov_id                 BIGINT UNIQUE NOT NULL,      -- "id" do BASE
  description                TEXT,
  object_brief_description   TEXT,
  contracting_procedure_type TEXT,
  contract_types             TEXT,
  publication_date           DATE,
  signing_date               DATE,
  close_date                 DATE,
  execution_deadline         TEXT,
  execution_place            TEXT,
  initial_contractual_price  NUMERIC(15,2),   -- parseado de "35.760,00 €"
  total_effective_price      NUMERIC(15,2),
  cpvs                       TEXT,
  cpvs_designation           TEXT,
  contract_fundamentation    TEXT,
  regime                     TEXT,
  contracting_procedure_url  TEXT,
  centralized_procedure      BOOLEAN,
  ambient_criteria           BOOLEAN,
  ccp                        BOOLEAN,
  raw_list_json              JSONB NOT NULL,  -- linha da listagem tal como veio
  raw_detail_json            JSONB,           -- detalhe completo tal como veio
  detail_scraped_at          TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- entidades (adjudicantes/adjudicatárias/concorrentes)
CREATE TABLE entities (
  id          SERIAL PRIMARY KEY,
  basegov_id  BIGINT,
  nif         TEXT,
  name        TEXT NOT NULL,
  UNIQUE (nif, name)
);

CREATE TABLE contract_entities (
  contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  entity_id   INT NOT NULL REFERENCES entities(id),
  role        TEXT NOT NULL,  -- contracting | contracted | contestant | invitee
  PRIMARY KEY (contract_id, entity_id, role)
);

-- ligação pesquisa ↔ contratos encontrados
CREATE TABLE search_results (
  search_id   INT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  contract_id INT NOT NULL REFERENCES contracts(id),
  position    INT NOT NULL,   -- ordem na listagem
  PRIMARY KEY (search_id, contract_id)
);

-- documentos descarregados (binário no Postgres)
CREATE TABLE documents (
  id            SERIAL PRIMARY KEY,
  contract_id   INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  basegov_id    BIGINT UNIQUE NOT NULL,   -- "id" do documento no BASE
  file_name     TEXT NOT NULL,            -- "description" do BASE
  content_type  TEXT,
  size_bytes    BIGINT,
  content       BYTEA,                    -- binário; NULL se download falhou
  download_ok   BOOLEAN NOT NULL DEFAULT false,
  download_error TEXT,
  downloaded_at TIMESTAMPTZ
);

CREATE INDEX idx_contracts_basegov ON contracts(basegov_id);
CREATE INDEX idx_search_results_search ON search_results(search_id);
CREATE INDEX idx_documents_contract ON documents(contract_id);
```

Notas:
- Datas do BASE vêm em `DD-MM-YYYY` → converter para `DATE`.
- Preços vêm como `"35.760,00 €"` → normalizar para `NUMERIC` (remover pontos, vírgula→ponto, remover `€`); guardar sempre o valor original no JSON bruto.
- `raw_list_json` / `raw_detail_json` garantem que nada se perde mesmo que o mapeamento de colunas seja incompleto.

---

## 5. Fluxo do worker de scraping

1. Utilizador cria pesquisa (UI ou API) → linha em `searches` com `status=pending`.
2. Worker (loop em processo, uma pesquisa de cada vez) apanha a pesquisa → `status=running`, `started_at=now()`.
3. `BaseGovClient`: chama `search_contratos` página a página até esgotar `total` (ou `MAX_RESULTS_PER_SEARCH`).
4. Para cada item: upsert em `contracts` (por `basegov_id`) + insert em `search_results`.
5. Para cada contrato **sem `raw_detail_json` ou com detalhe mais antigo que 7 dias**: chama `detail_contratos`, atualiza campos + entidades + `documents` (metadados).
6. Para cada documento ainda sem `content`: faz o download (`doc_documentos`) e guarda binário, content-type e tamanho. Falhas de download **não** falham a pesquisa — registam-se em `download_error`.
7. No fim: `status=completed` (ou `completed_truncated`/`failed` com `error_message`), `finished_at=now()`, `total_scraped` atualizado.
8. Progresso: atualizar `total_scraped` a cada página para o UI poder mostrar progresso via polling.

---

## 6. UI (frontend)

Simples e funcional. Todas as páginas exceto login exigem sessão autenticada.

### 6.1 Login
- Página de entrada com formulário **username / password**.
- Credenciais seed: **admin / admin123** (guardadas com hash bcrypt; criadas em migration/seed).
- Sessão por cookie httpOnly (assinado, `SESSION_SECRET` em env). Logout no header.

### 6.2 Lista de pesquisas (página inicial após login)
- Tabela com as pesquisas anteriores: termo, data, estado (com badge), nº resultados (`total_scraped` / `total_reported`), utilizador.
- Pesquisas `running` mostram progresso (polling a cada ~3s a `GET /api/searches/:id`).
- Clicar numa pesquisa → página de resultados.
- Botão "Nova pesquisa": input do termo + submeter → cria a pesquisa e mostra-a de imediato na lista com estado `pending/running`.
- Permitir re-executar um termo (cria uma **nova** pesquisa; não reutiliza a antiga).

### 6.3 Resultados de uma pesquisa
- Cabeçalho: termo, estado, datas, totais, botão **"Exportar Excel"**.
- Tabela paginada (client ou server-side, 25/página): objeto do contrato, adjudicante, adjudicatário, tipo de procedimento, preço, data de publicação, nº de documentos.
- Filtro de texto local sobre a tabela (nice-to-have).
- Clicar numa linha → página/painel de detalhe.

### 6.4 Detalhe de contrato
- Todos os campos mapeados (secções: Identificação, Datas, Preços, Entidades, Procedimento, Local/CPV, Observações).
- Lista de documentos com nome, tamanho, e link de download (`GET /api/documents/:id/content`).
- Link externo para a página oficial do contrato no BASE: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=<basegov_id>`.

### 6.5 Exportação Excel
- `GET /api/searches/:id/export.xlsx` — gera com `exceljs`:
  - **Folha "Contratos"**: uma linha por contrato com todas as colunas principais (id BASE, objeto, adjudicante(s), adjudicatário(s), NIFs, tipo procedimento, tipo contrato, preço contratual, preço efetivo, datas, prazo, local, CPV, URL do procedimento, nº documentos, link BASE).
  - **Folha "Documentos"**: contrato id BASE, nome do ficheiro, content-type, tamanho, URL de download da API.
- Download imediato com `Content-Disposition: attachment; filename="pesquisa-<id>-<termo>.xlsx"`.

---

## 7. API REST

Prefixo `/api`. JSON. Erros no formato `{ "error": { "code", "message" } }`.

### 7.1 Autenticação
- **UI (browser)**: `POST /api/auth/login {username, password}` → cookie de sessão; `POST /api/auth/logout`; `GET /api/auth/me`.
- **Aplicações externas**: header `X-API-Key: <APP_API_KEY>` (env var) **ou** HTTP Basic com as credenciais de utilizador. Todos os endpoints abaixo aceitam qualquer um dos dois mecanismos.

### 7.2 Pesquisas
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/searches` | Lista pesquisas (paginado `?page=&size=`) |
| POST | `/api/searches` | Cria e agenda pesquisa. Body: `{ "term": "software" }` → `201 {id, status}` |
| GET | `/api/searches/:id` | Estado + metadados (inclui progresso) |
| GET | `/api/searches/:id/results` | Resultados paginados `?page=&size=` — versão "listagem" de cada contrato |
| GET | `/api/searches/:id/full` | **Endpoint para integração externa**: todos os contratos da pesquisa com detalhe completo + documentos. Paginado (`?page=&size=`, default size=100). Cada documento inclui `download_url` |
| GET | `/api/searches/:id/export.xlsx` | Excel (ver 6.5) |

### 7.3 Contratos e documentos
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/contracts/:id` | Detalhe completo (campos mapeados + `raw_detail_json` opcional via `?raw=1`) + lista de documentos com `download_url` |
| GET | `/api/contracts` | Todos os contratos em BD, paginado, filtros `?term=&search_id=` |
| GET | `/api/documents/:id` | Metadados do documento |
| GET | `/api/documents/:id/content` | **Binário** do documento vindo do Postgres (`Content-Type` e `Content-Disposition` corretos) |

Exemplo de item de `/api/searches/:id/full`:

```json
{
  "basegov_id": 15236157,
  "description": "Aquisição de serviços de consultoria...",
  "contracting": [{ "nif": "505174839", "name": "Parques de Sintra-Monte da Lua, SA" }],
  "contracted": [{ "nif": "513854363", "name": "Code Five, Lda" }],
  "initial_contractual_price": 35760.00,
  "publication_date": "2026-07-03",
  "basegov_url": "https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=15236157",
  "documents": [
    {
      "id": 12,
      "file_name": "Contrato 00573.2026 - base.pdf",
      "content_type": "application/pdf",
      "size_bytes": 159433,
      "download_url": "/api/documents/12/content"
    }
  ],
  "raw_detail": { "...": "JSON bruto do BASE" }
}
```

---

## 8. Configuração (variáveis de ambiente)

```
DATABASE_URL=postgres://basegov:basegov@postgres:5432/basegov
SESSION_SECRET=<aleatório>
APP_API_KEY=<aleatório>            # para integrações externas
PORT=3000
BASEGOV_API_VERSION=91.0
SCRAPE_DELAY_MS=500
SCRAPE_CONCURRENCY=3
MAX_RESULTS_PER_SEARCH=5000
```

`docker-compose.yml` com `postgres:16` (volume persistente) e `app` (imagem `node:20-slim` — sem browsers na v1; na fase 2, trocar a base para `mcr.microsoft.com/playwright:v<versão>-jammy`). Migrations e seed (utilizador admin) correm automaticamente no arranque.

---

## 9. Estrutura de projeto proposta

```
/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── prisma/ (ou migrations/)        # schema + seed admin
├── src/
│   ├── server/
│   │   ├── index.ts                # bootstrap Fastify + worker
│   │   ├── auth.ts                 # sessão, api-key, basic
│   │   ├── routes/                 # searches, contracts, documents, auth, export
│   │   └── export/excel.ts
│   ├── scraper/
│   │   ├── client.ts               # interface BaseGovClient
│   │   ├── httpClient.ts           # implementação v1: API JSON via fetch/undici
│   │   ├── worker.ts               # loop de processamento de pesquisas
│   │   └── parse.ts                # datas, preços, normalização
│   │   # fase 2: playwrightClient.ts (mesma interface)
│   └── shared/types.ts
├── web/                            # frontend React (Vite)
│   └── src/pages/{Login,Searches,SearchResults,ContractDetail}.tsx
└── tests/
```

---

## 10. Testes e critérios de aceitação

### Testes automatizados mínimos
- Unitários: `parse.ts` (datas `DD-MM-YYYY`, preços `"1.234,56 €"` → `1234.56`, valores nulos).
- Integração (com BD): criar pesquisa → worker com `BaseGovClient` **mockado** (fixtures JSON reais dos endpoints, incluídas no repo) → verificar contratos, entidades, documentos e estados.
- API: auth (401 sem credenciais), CRUD de pesquisas, export xlsx (abre e tem 2 folhas), download de documento devolve bytes e content-type corretos.
- Smoke test E2E real (opcional, marcado `@live`): pesquisa com termo raro, verifica ≥1 resultado.

### Critérios de aceitação
1. Login com `admin`/`admin123` funciona; credenciais erradas dão erro; páginas protegidas redirecionam para login.
2. Criar pesquisa "software" → estado evolui `pending → running → completed`, com progresso visível; contratos, detalhes e documentos ficam em Postgres (documentos com binário `BYTEA`).
3. Pesquisa com listagem de **várias páginas** é percorrida na totalidade (validar com termo que devolva > 2 páginas).
4. Re-executar o mesmo termo não duplica contratos nem documentos (upsert), mas cria nova entrada no histórico.
5. Excel exportado abre no Excel/LibreOffice com as 2 folhas preenchidas.
6. `GET /api/searches/:id/full` com `X-API-Key` devolve detalhe completo + `download_url`; `GET /api/documents/:id/content` devolve o PDF binário.
7. Falha de download de um documento não impede a conclusão da pesquisa (fica registada no documento).
8. `docker-compose up` arranca tudo do zero (migrations + seed) e a app fica utilizável em `http://localhost:3000`.

---

## 11. Fora de âmbito (v1)

- **Playwright / fallback de browser** — fase 2: implementar `PlaywrightBaseGovClient` (mesma interface `BaseGovClient`) se a API JSON mudar ou passar a exigir contexto de browser/anti-bot.
- Gestão de utilizadores (apenas o admin seed).
- Pesquisa avançada com todos os filtros do BASE (entidades, CPV, datas, preços…) — a arquitetura do `query` já o permite; expor apenas `texto` na v1, mas manter o campo `query` extensível.
- Agendamento periódico de pesquisas (cron) — considerar para v2.
- Armazenamento de documentos fora do Postgres (S3/filesystem) — v2 se o volume crescer.

## 12. Notas legais e de cortesia

Os dados do Portal BASE são públicos (contratação pública). O scraper deve respeitar rate limits conservadores (secção 3.4), identificar-se com User-Agent honesto e nunca paralelizar agressivamente contra o site.
