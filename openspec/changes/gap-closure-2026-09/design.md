# Design: Fecho de gaps de produto — BaseRadar v1.1

> Como vamos construir. O detalhe de implementação vive aqui, não nos specs.

---

## 1. Visão geral da arquitetura

Cinco tabelas novas, uma extensão a `users`, nenhuma alteração ao corpus público. Três peças transversais:

1. **`src/scheduler.ts`** — um único `setInterval` de 60 s no processo da app que avalia "o que está *due* agora" (digest às segundas 08:00, lembretes às 08:00) e delega em funções puras. A idempotência vem exclusivamente de `notification_log` (chave única por tipo + referência + período), porque o Railway sobrepõe contentores durante os deploys e não se pode confiar em estado em memória.
2. **`src/fit-rules.ts`** — regras determinísticas (exclusões, geografia, valor) aplicadas **antes** do modelo em `fitScores()`. Gratuitas, explicáveis, testáveis sem IA. Produzem `rule_hits` que aparecem em `reasons` e limitam o score.
3. **Filtros como parâmetros de query** com uma função partilhada `listFilters(query, plan)` que valida, aplica o gating por plano e devolve fragmentos SQL + parâmetros, usada pelas três listagens.

O pipeline é uma tabela de estado `(company_id, item_type, item_id)` com histórico e uma tabela de checklist por item. Tudo lê com `company_id` do contexto autenticado — nada cruza empresas.

```
 Browser (app.js)
   │  filtros no hash  ─►  GET /api/announcements?district=…&value_min=…
   │  chips de estado  ─►  PUT /api/pipeline/:type/:id
   │  👍/👎             ─►  POST /api/ai/feedback
   ▼
 Fastify ─ requireAuth ─ requirePlan(cap) ─ listFilters() ─ SQL (índices novos)
   │
   ├─ ai.ts: profileContext() + companyProfileContext() + negativeExamples()
   │          └─ fit-rules.ts (antes do modelo) → OpenRouter (só o que sobra)
   │
   └─ scheduler.ts (tick 60 s)
        ├─ dueDigests()   → digestData() → mail.ts (layout) → notification_log
        └─ dueReminders() → opportunity_status ⋈ prazos → mail.ts → notification_log
```

---

## 2. Decisões

### Decisão: estado do pipeline numa tabela própria, não em colunas das tabelas do corpus
**Escolha:** `opportunity_status (company_id, item_type, item_id, status, …)` com `UNIQUE(company_id, item_type, item_id)`.
**Porquê:** o corpus (`announcements`, `contracts`) é partilhado por todas as empresas; o estado é por empresa. Uma coluna no corpus obrigaria a *n* colunas ou a JSON por empresa — ambos errados. A chave composta `(item_type, item_id)` segue exactamente o que `/api/insights/opportunities` já devolve (`type: 'anuncio_aberto' | 'renovacao'`, `announcement_id` / `contract_id`), sem inventar identificadores novos.
**Alternativas:** (a) tabela por tipo (`announcement_status`, `contract_status`) — duplica lógica e a vista Pipeline teria de fazer UNION; (b) JSONB em `companies` — não indexável, sem histórico, concorrência difícil. Rejeitadas.

### Decisão: "Nova" é ausência de linha
**Escolha:** não gravar estado "nova"; `LEFT JOIN` devolve `NULL` → UI mostra "Nova".
**Porquê:** evita criar 50 000 linhas por empresa só para dizer "ainda não olhei". O filtro "só novas" é `WHERE os.status IS NULL`.
**Alternativa:** gravar "nova" no primeiro *render* — desperdício e ruído no histórico.

### Decisão: máquina de estados validada no backend, com Descartada reversível
**Escolha:** transições permitidas codificadas num mapa em `src/pipeline.ts`; `submetida → {ganha, perdida, descartada}`; `descartada → {interessa}`; `ganha`/`perdida` terminais (só admin da empresa reabre). Erro 409 com mensagem em português.
**Porquê:** o spec exige recusar `submetida → interessa`; validar só na UI seria contornável pela API.
**Alternativa:** estados livres — perde-se a fiabilidade dos dados que mais tarde alimentam taxas de vitória.

### Decisão: checklist interativa chaveada pelo texto do item
**Escolha:** `opportunity_checklist (company_id, item_type, item_id, item_text_hash, checked, checked_by, checked_at)`; `item_text_hash = sha1(texto normalizado)`.
**Porquê:** a `checklist` da análise é um array de strings sem id; ao regenerar a análise, itens com o mesmo texto mantêm a marcação (cenário do spec) e os novos aparecem desmarcados — sem precisar de migrar a análise para ter ids.
**Alternativa:** guardar índice posicional — quebra à primeira regeneração.

### Decisão: perfil da empresa numa tabela 1:1, separado dos perfis de atividade
**Escolha:** `company_profiles (company_id PK, description, certifications TEXT[], districts TEXT[], value_min, value_max, excluded_terms TEXT[], excluded_entities TEXT[], updated_at)`.
**Porquê:** certificações, geografia e exclusões são atributos da **empresa**, não de cada atividade (uma empresa de pirotecnia com dois perfis tem o mesmo alvará nos dois). Manter em `profiles` obrigaria a repetir e a divergir.
**Alternativas:** colunas em `companies` — mistura faturação com capacidades e polui uma tabela já central; JSONB — sem validação e sem índices. Rejeitadas.

### Decisão: regras determinísticas antes da IA, com limites e não substituições
**Escolha:** `applyFitRules(item, companyProfile) → { skipAi: boolean, cap: number|null, hits: RuleHit[] }`. Exclusões → `skipAi=true, fit=0`. Geografia → `cap=20`. Valor → `cap=35`. O score final é `min(aiScore, cap)`; os `hits` vão para `reasons` com o prefixo "Regra:".
**Porquê:** as regras são gratuitas (poupam chamadas ao modelo nos excluídos), explicáveis ("fora da área geográfica") e o utilizador vê de onde veio o limite, com ligação para editar o perfil. Não elevam nunca o score — a IA continua a ser quem diz "sim".
**Alternativa:** pôr tudo no prompt e confiar no modelo — mais caro, não determinístico, e um "fora de Lisboa" podia sair 60 num dia e 25 no outro. Rejeitada.

### Decisão: distrito do procedimento = mesma expressão do mapa
**Escolha:** reutilizar `DISTRICT` de `routes-v2.ts` (`split_part(split_part(execution_place,'|',1),',',2)`) para contratos; para anúncios, derivar de `contracting_entity`/`execution_place` quando existir, caso contrário `NULL` (regra não se aplica — cenário "dados em falta não penalizam"). Adicionar índice de expressão em `contracts` para o filtro.
**Porquê:** consistência entre mapa, filtro e regra; um só sítio a manter.

### Decisão: invalidação preguiçosa do fit por versão do perfil
**Escolha:** `company_profiles.version INT` incrementado a cada gravação; `ai_fit_scores` ganha `profile_version INT`. Um fit é "desatualizado" se `profile_version < company_profiles.version`. Recomputa-se só quando o item é pedido, dentro do lote habitual de `fitScores()`; se o teto de IA estiver atingido em modo aviso, devolve o valor antigo com `stale: true`.
**Porquê:** o spec proíbe recomputação em massa (custo); a versão evita comparar timestamps entre tabelas.
**Alternativa:** apagar os fits ao guardar o perfil — a lista ficaria toda sem score até se pagar a recomputação inteira. Rejeitada.

### Decisão: agendador em processo com tick de 60 s e idempotência em BD
**Escolha:** `src/scheduler.ts` arrancado em `index.ts` ao lado de `startWorker()`. Cada tick calcula, em Europa/Lisboa, se estamos na janela 08:00–08:59 de segunda (digest) ou de qualquer dia (lembretes) e tenta `INSERT … ON CONFLICT DO NOTHING` em `notification_log` **antes** de enviar; só quem consegue inserir envia. Falhas ficam com `status='failed'` e `attempts`, retentadas nos ticks seguintes até 3.
**Porquê:** 1 réplica no Railway, mas deploys sobrepostos → dois processos podem estar vivos às 08:00. A inserção condicional é a única barreira fiável. Sem dependências novas (não há `node-cron`).
**Alternativas:** Railway cron service separado — custo e um segundo deploy a manter; fila externa — sobredimensionado para 2 tipos de notificação. Rejeitadas.

### Decisão: fuso horário fixo Europa/Lisboa
**Escolha:** `Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', … })` para decidir a hora; sem coluna de fuso por utilizador nesta versão.
**Porquê:** produto PT-only (fora de âmbito: multi-idioma/multi-país). Evita uma coluna e uma UI que ninguém usaria.

### Decisão: opt-out por token assinado, sem sessão
**Escolha:** ligação `/api/notifications/unsubscribe?t=<hmac(user_id|kind|version)>` assinada com `SESSION_SECRET`; ao clicar, desliga a preferência e mostra confirmação com "voltar a ligar" (que exige sessão).
**Porquê:** o spec exige um clique sem início de sessão; um token assinado sem estado cumpre sem tabela extra. `version` incrementa ao religar, invalidando ligações antigas.

### Decisão: feedback usado como *few-shot* limitado, não como treino
**Escolha:** `ai_feedback` guarda verdict + motivo; `negativeExamples(companyId)` devolve os últimos 10 👎 (título + motivo) injetados num bloco "EXEMPLOS DE NÃO-FIT INDICADOS PELA EMPRESA" nos prompts de fit e análise. Sugestão de atualizar o perfil quando o motivo é geografia/requisito.
**Porquê:** é o que dá efeito visível imediato (cenário "fit seguinte mais baixo") sem infraestrutura de *fine-tuning*. Limitar a 10 mantém o prompt cacheável e barato.
**Alternativa:** aprendizagem estatística por CPV — só faz sentido com volume; fica para depois dos dados existirem.

### Decisão: gating dos filtros na função partilhada
**Escolha:** `listFilters(query, plan)` conhece a lista de filtros avançados e lança 403 `plan_required` se um for usado sem capacidade `filtros_avancados`. A UI usa `can('filtros_avancados')` só para desenhar o cadeado.
**Porquê:** o backend é a verdade (regra já em vigor no produto); evita três implementações do mesmo gating.

### Decisão: formatação de datas do digest
**Escolha:** helper `fmtDatePT(value)` em `src/mail.ts` que aceita `Date | string` e devolve `DD/MM/AAAA`; usado em todos os emails.
**Porquê:** o digest atual faz `String(r.end_date).slice(0,10)` sobre um `Date` do driver `pg` e produz "Wed Jul 29" — bug confirmado em produção a 20/07. Ao automatizar o envio, o bug passaria a sair semanalmente.

### Decisão: poller do opendata de 5 s → 60 s
**Escolha:** alterar o intervalo em `startOpendataWorker()`.
**Porquê:** 17 280 queries/dia sem utilizadores, para uma fila que muda uma vez por semana. Zero impacto funcional (o import é assíncrono de qualquer forma).

---

## 3. Modelo de dados (migrações em `src/db.ts`, idempotentes)

```sql
-- A. Pipeline
CREATE TABLE IF NOT EXISTS opportunity_status (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL CHECK (item_type IN ('anuncio_aberto','renovacao')),
  item_id       INT  NOT NULL,                       -- announcements.id | contracts.id
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
  excluded_entities TEXT[] NOT NULL DEFAULT '{}',   -- nomes normalizados (deaccent+lower)
  version           INT NOT NULL DEFAULT 1,
  updated_by        INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (value_min IS NULL OR value_max IS NULL OR value_max > value_min)
);
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS profile_version INT NOT NULL DEFAULT 1;
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS rule_hits JSONB NOT NULL DEFAULT '[]';

-- D. Notificações
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_digest    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_version   INT NOT NULL DEFAULT 1;  -- invalida links de opt-out

CREATE TABLE IF NOT EXISTS notification_log (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,            -- digest | reminder7 | reminder2
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref         TEXT NOT NULL,            -- digest: 'profile:<id>:<AAAA-WW>'; reminder: 'user-day:<AAAA-MM-DD>'
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | sent | failed
  attempts    INT NOT NULL DEFAULT 0,
  provider_id TEXT, error TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ,
  UNIQUE (kind, user_id, ref)
);
-- Lembrete por (oportunidade, prazo): idempotência ao nível do item, para o cenário "prazo prorrogado"
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
  UNIQUE (company_id, user_id, target_type, item_type, item_id)   -- repetir substitui
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_company ON ai_feedback (company_id, verdict, created_at DESC);

-- C. Índices de apoio aos filtros
CREATE INDEX IF NOT EXISTS idx_ann_procedure ON announcements (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_ann_base_price ON announcements (base_price);
CREATE INDEX IF NOT EXISTS idx_ann_entity_trgm ON announcements USING gin (lower(contracting_entity) gin_trgm_ops);  -- requer pg_trgm
CREATE INDEX IF NOT EXISTS idx_contracts_procedure ON contracts (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_contracts_price ON contracts (initial_contractual_price);
CREATE INDEX IF NOT EXISTS idx_contracts_district ON contracts ((NULLIF(btrim(split_part(split_part(execution_place,'|',1),',',2)),'')));
```

> `pg_trgm`: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — disponível na imagem Postgres do Railway. Se a extensão falhar, o filtro por entidade cai para `ILIKE` sem índice (aceitável no âmbito de um perfil).

---

## 4. API (todos com `requireAuth`; `requirePlan` onde indicado)

| Método e caminho | Plano | Notas |
|---|---|---|
| `GET /api/pipeline?status=&assigned=me` | grátis | Itens com estado, enriquecidos com título/entidade/prazo/valor via JOIN por tipo; progresso da checklist |
| `PUT /api/pipeline/:type/:id` | grátis | `{status?, note?, assigned_user_id?}`; valida transição (409); grava histórico; verifica que o item está no âmbito da empresa (404) |
| `GET /api/pipeline/:type/:id/history` | grátis | |
| `PUT /api/pipeline/:type/:id/checklist` | grátis | `{item_text, checked}` |
| `GET /api/company/profile` · `PUT` | grátis | valida intervalo; incrementa `version` |
| `GET /api/announcements` · `/api/contracts` · `/api/insights/opportunities` | (existentes) | + parâmetros `district[]`, `deadline_within`, `q`; **Pro:** `value_min`, `value_max`, `procedure[]`, `entity`, `cpv[]`, `sort`, `order`; + campo `pipeline_status` em cada item; + `stale` nos fits |
| `GET /api/announcements/facets?…` | grátis (contagens só das facetas básicas; Pro para procedimento) | |
| `GET/PUT /api/me/notifications` | grátis | `{notify_digest, notify_reminders}` |
| `GET /api/notifications/unsubscribe?t=` | público | token HMAC; HTML de confirmação |
| `POST /api/ai/feedback` · `DELETE` | Pro (`feedback_ia`) | |
| `GET /api/admin/notifications` · `/api/admin/ai-feedback` | admin | |
| `POST /api/admin/notifications/run` | admin | força um tick (para testar sem esperar pela segunda-feira) |

Capacidades novas em `config.plans.features`: `pipeline: 'free'`, `perfil_empresa: 'free'`, `filtros_avancados: 'pro'`, `lembretes: 'pro'`, `feedback_ia: 'pro'`. `digest` mantém-se `free`.

---

## 5. Fluxos-chave

**Fit com regras + perfil + feedback** (`fitScores()` em `ai.ts`):
1. Carrega `company_profiles` (uma vez por lote) e `negativeExamples(companyId)` (10).
2. Para cada item: `applyFitRules()` → se `skipAi`, grava fit 0 com `rule_hits` e **não** inclui no prompt.
3. Restantes vão ao modelo com `profileContext()` + `companyProfileContext()` + bloco de exemplos negativos.
4. Score final = `min(ai, cap)`; `reasons = [...ruleHits, ...aiReasons]`; grava `profile_version` atual.
5. Ao ler: se `profile_version < atual` → recalcula dentro do teto; senão devolve com `stale: true`.

**Tick do agendador** (`scheduler.ts`, a cada 60 s):
1. `now` em Europa/Lisboa. Se hora ≠ 08 → sai (barato).
2. Se segunda: para cada `(profile, user)` elegível, `INSERT notification_log (digest, user, 'profile:<id>:<AAAA-WW>')` — se inseriu, gera `digestData()` → `layout()` → `sendMail()` → `sent`/`failed`.
3. Todos os dias: para cada empresa Pro+, lista itens `interessa|preparacao` com prazo em 7 ou 2 dias, ainda sem `reminder_log` para `(item, kind, deadline)`; agrupa por utilizador; `INSERT notification_log (reminderN, user, 'user-day:<data>')`; envia um email; grava `reminder_log` por item.
4. Retenta `failed` com `attempts < 3`.

**Filtros** (`listFilters()`): valida tipos, aplica gating, devolve `{ where: string[], params: unknown[], orderBy }`; as três listagens já constroem SQL com `params.push`/`$n` — encaixa no padrão de `dateFilters()`.

---

## 6. Frontend (`public/app.js`, sem framework)

- **Chip de estado** nas linhas de Oportunidades/Concursos/Renovações: `<select class="pl-status">` compacto; `PUT` ao mudar; atualização otimista com reversão em erro.
- **Vista `#/pipeline`** (nav principal, entre Oportunidades e Renovações; `NAV_FEATURE['#/pipeline']='pipeline'`): colunas Interessa / Em preparação / Submetida + secção "Fechadas" colapsada; linha com prazo (vermelho se passado), valor, responsável, barra de checklist.
- **Ficha da oportunidade**: secção "Pipeline" (estado, nota, responsável, histórico) e checklist marcável a partir de `analysis.checklist`.
- **Hoje**: secção "No pipeline" no topo, só quando há itens com prazo ≤ 14 dias.
- **Conta → Perfil da empresa**: formulário; onboarding em 4 passos após o registo (saltável).
- **Barra de filtros** nas listas: chips com contagens; filtros Pro com cadeado via `can('filtros_avancados')`; estado no hash (`#/radar/announcements?district=Lisboa&deadline=30`).
- **👍/👎** no chip do fit e no topo da ficha de análise; popover de motivo no 👎.
- **Conta → Notificações**: dois interruptores.
- **Admin**: cartões "Notificações (últimas 200)" e "Feedback IA por motivo/CPV"; botão "Forçar tick".
- Versão dos assets: incrementar `app.js?v=` e `style.css?v=` em `public/index.html`.

---

## 7. Ficheiros a criar / modificar

| Ficheiro | Ação | Para quê |
|---|---|---|
| `src/db.ts` | MOD | migrações da secção 3 |
| `src/config.ts` | MOD | 5 capacidades novas; `DIGEST_HOUR`, `REMINDER_DAYS` (por omissão `08`, `7,2`) |
| `src/pipeline.ts` | NOVO | máquina de estados, rotas do pipeline, checklist, enriquecimento dos itens |
| `src/company-profile.ts` | NOVO | rotas GET/PUT, validação, `companyProfileContext()` |
| `src/fit-rules.ts` | NOVO | `applyFitRules()` puro e testável |
| `src/ai.ts` | MOD | integrar regras, contexto do perfil, exemplos negativos, `profile_version`, confronto de requisitos na ficha |
| `src/filters.ts` | NOVO | `listFilters()` + endpoint de facetas |
| `src/routes-v2.ts` · `src/routes.ts` | MOD | aplicar `listFilters()`, `pipeline_status` nas listas, ordenação |
| `src/scheduler.ts` | NOVO | tick, `dueDigests()`, `dueReminders()`, retentativas |
| `src/notifications.ts` | NOVO | preferências, token de opt-out, registo, rotas admin |
| `src/mail.ts` | MOD | `fmtDatePT()`, modelos de digest e de lembrete, rodapé com opt-out |
| `src/ai-feedback.ts` | NOVO | rotas de feedback, `negativeExamples()`, sugestão de perfil, agregado admin |
| `src/opendata.ts` | MOD | intervalo 5 s → 60 s |
| `src/index.ts` | MOD | registar rotas novas; `startScheduler()` |
| `public/app.js` · `public/style.css` · `public/index.html` | MOD | secção 6 |
| `README.md` | MOD | variáveis novas |

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Deploy às 08:00 de segunda envia o digest duas vezes | `notification_log` com `UNIQUE` + `ON CONFLICT DO NOTHING` **antes** de enviar |
| Alterar o perfil dispara custo de IA | invalidação por versão, recomputação só do que é pedido, dentro do teto |
| Filtro por entidade lento sem `pg_trgm` | tentar a extensão; cair para `ILIKE` dentro do âmbito do perfil (dezenas de milhares de linhas, não milhões) |
| Regras demasiado agressivas frustram o utilizador | limites (20/35) em vez de zero para geografia/valor; motivo sempre visível com ligação para editar; só exclusões dão 0 |
| Emails marcados como spam | remetente verificado no Resend, rodapé com opt-out de um clique, um email por utilizador por dia para lembretes |
| Regressão no cálculo de score/fit existente | regras só **limitam**; testes de igualdade "sem perfil ⇒ fit idêntico ao atual" |
