# BaseRadar — Documento único de fecho de gaps (v1.1 + GTM)

> **Fonte de implementação.** Um único sítio: gaps reais no código × os 9 markdowns de `openspec/changes/gap-closure-2026-09/` × GTM construtor × critérios de aceitação clicáveis.
>
> **Data:** 2026-09-02 · **Âmbito Fable:** aprovado por Nuno Barreto · **Precedência:** não bloqueia Stripe → provisionamento → 1.ª fatura Moloni.
> **Alvo:** fim de setembro 2026. **Ambiente:** `https://basegov-robot-production.up.railway.app/`
>
> Pasta Fable original: [`../gap-closure-2026-09/`](../gap-closure-2026-09/). Continua a existir como artefacto SDD; **este ficheiro é o que se implementa.** Não reabrir decisões técnicas da Fable.

---

## 0. Fontes lidas — nada ficou de fora

Lidos na íntegra, nesta ordem (a que a Fable pede: `proposal` → `specs/*` → `design` → `tasks`):

| # | Ficheiro | Papel | O que este documento absorve |
|---|---|---|---|
| 1 | `proposal.md` | Contrato de âmbito | Problema, objetivo, A–F, gating, fora de âmbito, restrições, fatia mínima, abordagem |
| 2 | `specs/pipeline/spec.md` | Comportamento A | SHALL/MUST + todos os Given/When/Then |
| 3 | `specs/company-profile/spec.md` | Comportamento B | idem |
| 4 | `specs/discovery/spec.md` | Comportamento C | idem |
| 5 | `specs/notifications/spec.md` | Comportamento D | idem |
| 6 | `specs/ai-feedback/spec.md` | Comportamento E | idem |
| 7 | `design.md` | O *como* | Arquitetura, alternativas rejeitadas, SQL, API, fluxos, ficheiros, riscos |
| 8 | `tasks.md` | Checklist | Fases 0–7, tamanhos, perguntas em aberto (**fechadas aqui**) |
| 9 | `README.md` | Convenções SDD | SHALL/MUST, Given/When/Then, sem segredos, arquivo no fim |

Cruzado de novo com a análise de gaps de 2026-09-02 (código vs checklist de produto: Discovery, AI Fit, atrito administrativo, UX PME, qualidade de dados, nice-to-haves) e com o estado actual do repo (`main` @ Stripe Checkout).

Convenções: RFC 2119 nos requisitos Fable. Cada AC de UI passa só se um humano (ou agente de browser) o reproduzir **sem** abrir o código. Os cenários 403/409/404/idempotência mantêm-se como contrato de API e verificam-se nas tarefas de fase.

---

## 1. Matriz — gap × código hoje × Fable × depois desta spec

Legenda: **Coberto** · **Parcial** · **Em falta**. «Depois» = estado prometido se A–F+G forem implementados.

### 1.1 Core Visibility & Discovery

| Ponto do checklist | Código hoje (verificado) | Fable | Depois | AC |
|---|---|---|---|---|
| Filtrar CPV, keywords, entidade, local, valor, tipo, prazo | **Parcial.** Perfis = termos+CPV. Lista: texto livre. Query BASE no scraper hardcoda `tipo=0&tipocontrato=0&pais=0&distrito=0&concelho=0` (`src/scraper/client.ts`) | Filtros combináveis nas **listas Postgres**. Básicos grátis (texto, distrito, prazo 7/15/30/60). Avançados Pro (valor, procedimento, entidade, CPV prefixo). Estado no URL | **Coberto na lista.** Não reescreve o scraper BASE | DIS-01…05 |
| Ingestão automática, atraso mínimo | **Parcial.** Worker contínuo. Perfil criado no registo nasce `'weekly'` (`src/routes-account.ts`) | Não trata o default `weekly`. Poller opendata 5 s → 60 s (custo, não frescura) | **Should:** default `daily` no registo (Fase 0 extra). Recolha continua daily/weekly, não near-real-time | FND-02 |
| Lista/detalhe + links de documentos | **Coberto** | Sem mudança | **Coberto** | — |
| Guardar pesquisas / alertas | **Parcial.** Perfis = pesquisas. Digest HTML + JSON **sem job de envio** | Digest segunda 08:00 Lisboa + lembretes 7/2 dias | **Coberto** (alertas = D) | NTF-01…07 |
| Dados incompletos / sujos | **Parcial.** JSON bruto, retries HTTP 999, fim de contrato estimado | `fmtDatePT`; distrito desconhecido não penaliza o fit; faceta «Sem localização (N)» | **Parcial aceite** | FND-01, PRF-06, DIS-04 |
| Ainda precisa de sítios externos | Sim (Vortal para peças/submissão) | Hand-off = link + nome da plataforma. Submissão automática **fora** | **Parcial aceite** | FOR-01 |

**Veredicto Discovery:** a Fable fecha *exploração* (filtros) e *chegar sozinho* (digest). Não fecha «pesquisar no BASE com todos os filtros oficiais» — de propósito: o matching continua pelo perfil; os filtros actuam sobre o corpus já importado.

### 1.2 AI Fit Analysis

| Ponto | Código hoje | Fable | Depois | AC |
|---|---|---|---|---|
| Perfil editável (setores, CPV, caps, certificações, geo, valor, exclusões) | **Parcial.** Atividade = nome+termos+CPV. **Sem PUT** no perfil de atividade (`routes-v2` cria/apaga). Nenhum alvará/distrito/valor/exclusão | Perfil da **empresa** 1:1 (`company_profiles`), distinto dos perfis de atividade | **Coberto** para o fit. PUT de *atividade* continua fora | PRF-01…03 |
| Fit score + raciocínio | **Coberto** (0–100 + bullets + GO/CONDITIONAL/NO-GO) | Mantém; acrescenta `Regra:` e caps 0 / 20 / 35 | **Coberto** | PRF-04, PRF-05 |
| Extrair requisitos do caderno | **Coberto** (best-effort PDF/ZIP, corte 45–55k) | Confronta `requisitos_habilitacao` com certificações → tem / não tem / indeterminável; go/no-go ≤ condicional se «não tem» | **Coberto** (PDFs ainda best-effort) | PRF-07 |
| Deal-breakers | **Coberto** (`red_flags`) | Red flag «habilitação não coberta pelo perfil» | **Coberto** | PRF-07 |
| Docs longos / mal estruturados | **Parcial** | OCR **fora** | **Parcial aceite** | — |
| Feedback para melhorar a IA | **Em falta** (só `/api/feedback` de produto) | 👍/👎 + motivo; últimos 10 👎 no prompt; sugestão de perfil | **Coberto** | FBK-01…05 |
| Fit amarra à empresa, não só ao sector | **Parcial** — afinidade de termos/CPV | Regras **antes** da IA (gratuitas, determinísticas); IA só no que sobra | **Coberto** | PRF-04…06 |

**Veredicto Fit:** resolve o aviso da análise («se a IA só resume sem o perfil, o valor é limitado»). O exemplo do `proposal.md` — *não tem alvará classe 4, não trabalha nos Açores, nunca acima de 200 k€* — é o critério de aceite do domínio B.

### 1.3 Atrito administrativo

| Ponto | Código hoje | Fable | Depois | AC |
|---|---|---|---|---|
| Lista de docs/declarações | **Parcial** — `analysis.checklist` não estruturada | Checklist **marcável** por empresa, % na vista Pipeline | **Coberto o suficiente** | PIP-08, PIP-12 |
| Completude (ticks persistentes) | **Em falta** | `opportunity_checklist` por `sha1(texto)` | **Coberto** | PIP-08 |
| Countdown + lembretes | **Parcial** — badge «FALTAM N DIAS», sem email | Lembretes 7 e 2 dias (Pro); Hoje mostra prazos (grátis) | **Coberto** | NTF-04…06, PIP-06 |
| ESPD / Anexo I / assinatura | **Parcial** — dossier com Anexo I e assinatura | Formalidades: plataforma + **DEUCP** + assinatura qualificada (texto estático). Jurídico **fora** | **Parcial aceite** (DEUCP ≠ wizard ESPD) | FOR-01 |
| Ligação à plataforma | **Parcial** — URL | Nome inferido do domínio + link. Submissão automática **fora** | **Parcial aceite** | FOR-01 |

### 1.4 UX para PME com pouco tempo

| Ponto | Código hoje | Fable | Depois | AC |
|---|---|---|---|---|
| Valor em 5–10 min | **Coberto** (registo + Hoje) | Onboarding 4 passos saltável | **Coberto** | PRF-01, GTM-06 |
| Mobile | **Parcial** — desktop-first | App nativa **fora**; web responsivo | **Parcial aceite** | — |
| Português, pouco jargão | **Coberto** | PT-PT only | **Coberto**; copy GTM fala alvará/câmara | GTM-* |
| Pipeline interessante / não / submetido | **Em falta** | Máquina completa Nova → … → Ganha/Perdida + Descartada | **Coberto** (mais rico que o checklist original) | PIP-01…12 |
| Export / partilha | **Parcial** — Excel Pro; digest não enviado | Digest email. PDF da ficha **não** está na Fable | **Parcial aceite** | NTF-02 |

### 1.5 Data Quality & Reliability

| Ponto | Código hoje | Fable | Depois | AC |
|---|---|---|---|---|
| Fontes (BASE, IMPIC, DR, TED, plataformas) | **Parcial** — conhecido | Sem novas fontes. «Última recolha» | **Parcial aceite** + transparência | FRS-01 |
| Freshness / correções | **Parcial** | Poller opendata 5 s → 60 s | Idem (menos carga, mesma frescura) | FRS-01 |
| Fontes em baixo | **Coberto** (retries 999) | Scheduler idempotente no deploy | **Coberto** | NTF-08, ADM-01 |
| Link à fonte original | **Coberto** | Sem mudança | **Coberto** | — |
| Bug datas digest «Wed Jul 29» | **Em falta** (produção 20/07: `String(date).slice(0,10)` sobre `Date` do `pg`) | `fmtDatePT` obrigatório | **Coberto** | FND-01 |

### 1.6 Nice-to-have / diferenciação

| Ponto | Código hoje | Fable | Depois |
|---|---|---|---|
| Histórico (quotas, preços médios) | **Parcial / forte** | Win-rate a partir do pipeline → **v1.2 (fora)** | Sem mudança nesta entrega |
| Sinais de concorrentes | **Coberto** | Sem mudança | — |
| Template / checklist da proposta | **Coberto** (dossier Pro) | Checklist interativa em cima | PIP-08 |
| Integração CRM | **Declarativa** (Business) | Slack/CRM/ERP **fora**; API fica como está | Landing Business vende CRM; código = API actual |
| Equipa / seats | **Coberto** (Pro 2, Business 10) | Pipeline partilhado pela empresa | PIP-02 |
| Radar de renovações | **Coberto** — diferenciador | Sem mudança de modelo; GTM vende-o com contratos que **se repetem** (obras, energia, saúde) | GTM-02 |

### 1.7 O que a análise pedia e a Fable **não** cobre

| Gap | Decisão |
|---|---|
| Landing ainda é «festas de Braga» / pirotecnia (hero, `OFERTA.md`, placeholders de registo/perfil, `README.md`) | **Entra como domínio G.** A Fable só pedia «rever texto do digest» (tarefa 6.3) — insuficiente. |
| Default `weekly` no onboarding | **Entra** (Should, Fase 0): registo cria perfil `daily`. |
| PUT/editar perfil de *atividade* | **Fora.** O fit passa a ler o perfil da *empresa*. |
| PDF da ficha de oportunidade | **Fora** (não está em A–F). |
| Win-rate / nº médio de concorrentes | **Fora** — Fable adia; o pipeline já grava Ganha/Perdida. |
| Query BASE com CPV/distrito/preço | **Fora** nesta v1 (invasivo no scraper). |
| ESPD wizard / submissão Vortal | **Fora** — `proposal.md` §2. |
| Recolha near-real-time (minutos) | **Fora** — continua daily/weekly. |

### 1.8 O que a Fable cobre **melhor** do que a análise de gaps (não reabrir)

- Regras determinísticas **antes** da IA (caps 0 / 20 / 35), não «meter tudo no prompt».
- «Nova» = ausência de linha (não 50 k rows por empresa).
- Idempotência do digest: `INSERT … ON CONFLICT DO NOTHING` em `notification_log` **antes** do send (Railway 1 réplica, deploys sobrepostos).
- Checklist por `sha1(texto normalizado)` — sobrevive à regeneração da análise.
- Invalidação preguiçosa por `company_profiles.version` (a análise pedia «não recompute em massa»; a Fable desenhou o *como*).
- Opt-out HMAC sem sessão; `notify_version` invalida links antigos.
- Few-shot limitado a 10 👎 (prompt cacheável); **não** fine-tuning.
- `listFilters(query, plan)` único — o backend é a verdade do gating.

---

## 2. Domínio G — GTM (não estava no `proposal.md`)

**Comprador:** responsável por concursos de uma construtora de classe média (alvará, pessoa comercial, orçamento de ferramentas). Não a micro de 3 operários; não a Mota-Engil.

| Ordem | Sector | Porquê paga | Risco |
|---|---|---|---|
| 1 | Obras / reabilitação | Ticket alto (~€305 k); já paga Vortal; reabilitações municipais **repetem-se** → o «4 meses antes» encaixa | SpotGov |
| 2 | Dispositivos médicos / farmácia hospitalar | Consumo contínuo SNS | Ciclo lento |
| 3 | Energia / ambiente | Contratos gordos, plurianuais | Poucos nomes |
| — | Limpeza, cantinas, festas | 29 € cabe; dono sem orçamento de software | Barato de adquirir, caro de converter |

**Preço:** Pro 29 € é **isco** (7 dias). O dinheiro está no **Business 99 €** (até 10 seats + API/CRM).

**Mensagem:** alvará, caderno, go/no-go, reabilitações da câmara que se repetem. Deixa de vender «concursos para a tua atividade» e «festas de Braga».

Isto **não altera** o gating A–F. Altera copy (landing, registo, OFERTA, README, exemplos da spec de digest que ainda dizem «Pirotecnia») e a lista de certificações sugeridas.

---

## 3. Proposal herdada — intacta, com G

### 3.1 Problema (as três falhas de todos os dias)

1. **Sem memória de trabalho** — a mesma lista amanhã; a equipa Business não se coordena.
2. **Fit = «parecido com os teus termos»**, não «podes concorrer» (alvará, Açores, tecto de 200 k€).
3. **Nada chega sozinho** — digest prometido em todos os planos, na prática rascunho Gmail; sem aviso de prazo.

Secundário: não se explora (sem filtros facetados) e a IA não aprende.

### 3.2 Objetivo semanal (utilizador não-especialista)

Receber o digest sem pedir; marcar em dois cliques; ser avisado 7 e 2 dias antes; confiar que fit baixo é **regra visível**; filtrar onde/quanto/como; corrigir a IA.

### 3.3 Em âmbito

| # | Domínio | Plano | Resumo |
|---|---|---|---|
| **G** | **GTM / landing** | — | Homepage + registo + OFERTA + README para o responsável por concursos (construtor) |
| A | Pipeline | **Grátis** | Nova → Interessa → Em preparação → Submetida → Ganha / Perdida (+ Descartada); nota; responsável; histórico; checklist; vista; Hoje |
| B | Perfil da empresa | **Grátis** (fit continua Pro) | Certificações/alvarás, distritos, valor, exclusões; regras **antes** da IA |
| C | Filtros | Básicos **grátis**; avançados **Pro** | Distrito, prazo, texto; valor, procedimento, entidade, CPV; facetas; URL |
| D | Notificações | Digest **grátis**; lembretes **Pro** | Segunda 08:00 Lisboa; 7 e 2 dias; opt-out; idempotente |
| E | Feedback IA | **Pro** | 👍/👎; few-shot; admin |
| F | Transversal | — | Frescura; Formalidades (plataforma, DEUCP, assinatura); `fmtDatePT`; poller 60 s |

**Fatia mínima (dono):** entrega **A–F completa**. Se o tempo apertar, ordem de valor Fable: **D → A → B → C → E → F**. Com GTM: **G primeiro** (já vende o que D/A vão cumprir), depois a ordem Fable.

### 3.4 Fora de âmbito (cópia fiel do `proposal.md`)

- OCR de peças digitalizadas — a análise continua a depender de PDFs com texto.
- Integrações Slack / Teams / CRM / ERP — a «integração API» do Business fica **declarativa**.
- Aplicação móvel nativa — web responsivo.
- Submissão automática nas plataformas (Vortal, AcinGov…) — hand-off = link.
- Aconselhamento jurídico sobre DEUCP/assinatura para além de texto estático.
- Corte do histórico pré-2019 — decisão separada, adiada.
- Pagamentos e faturação (Stripe, Moloni) — trilho próprio.
- Taxas de vitória por entidade/CPV a partir do pipeline — analítica **v1.2**.
- Multi-idioma — só português europeu.

### 3.5 Restrições (cópia fiel)

| Área | Restrição |
|---|---|
| Stack | Node 22, TypeScript estrito, Fastify, SPA vanilla (`public/app.js`, **sem framework**), Postgres 18. **Sem dependências novas** salvo decisão neste documento / `design.md`. |
| Alojamento | Railway, **1 réplica**. Deploys sobrepõem contentores → agendador idempotente por registo em BD, nunca por memória. |
| Email | Resend via `src/mail.ts` (best-effort; nunca falha a operação de negócio). Remetente `MAIL_FROM`. |
| IA | OpenRouter via `src/ai.ts`; custo em `ai_usage_events`. Alterar o perfil **não** dispara recomputação em massa. |
| Planos | Gating só `config.plans.features` + `requirePlan()`. UI espelha via `can()`. |
| Multi-tenant | Tudo isolado por `company_id`. |
| Idioma | UI, emails e comentários em **português europeu**. |
| Dados | **Não** alterar o corpus público (`contracts`, `announcements`, `entities`). Só tabelas novas. Migrações `IF NOT EXISTS` em `src/db.ts`. |
| Segurança | Nenhum segredo em código. Endpoints novos: `requireAuth` e, quando aplicável, `requirePlan`. Conteúdo do utilizador escapado em email (`esc()`) e na UI. |

Capacidades novas em `config.plans.features`: `pipeline: 'free'`, `perfil_empresa: 'free'`, `filtros_avancados: 'pro'`, `lembretes: 'pro'`, `feedback_ia: 'pro'`. `digest` mantém-se `'free'`. Env: `DIGEST_HOUR` (omissão `08`), `REMINDER_DAYS` (omissão `7,2`).

### 3.6 Abordagem (resumo do `proposal.md` §4)

Cinco tabelas novas e uma extensão (`users`), sem tocar no corpus. Um agendador único em processo (`src/scheduler.ts`) com tick por minuto e `notification_log` como fonte de idempotência. O fit ganha regras determinísticas (exclusões, geografia, valor) **antes** da IA; depois o modelo pontua o que sobra, com perfil rico e exemplos negativos. Filtros = parâmetros de query + índices + facetas. Pipeline = estado por `(empresa, tipo, id)` com histórico e checklist.

---

## 4. Arquitetura e decisões (não reabrir)

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
        ├─ dueDigests()   → digestData() → mail.ts → notification_log
        └─ dueReminders() → opportunity_status ⋈ prazos → mail.ts → notification_log
```

Três peças transversais:

1. **`src/scheduler.ts`** — um `setInterval` de 60 s. Idempotência **só** em `notification_log` (chave única tipo + referência + período).
2. **`src/fit-rules.ts`** — regras antes do modelo em `fitScores()`. Gratuitas, explicáveis, testáveis sem IA. `rule_hits` entram em `reasons`.
3. **`listFilters(query, plan)`** — valida, aplica gating, devolve fragmentos SQL + params; usada pelas três listagens.

### Decisões (escolha · porquê · alternativa rejeitada)

| # | Escolha | Porquê | Rejeitado |
|---|---|---|---|
| 1 | Estado em `opportunity_status (company_id, item_type, item_id)` UNIQUE | Corpus é partilhado; estado é por empresa. `(item_type, item_id)` já é o que `/api/insights/opportunities` devolve (`anuncio_aberto` / `renovacao`) | (a) uma tabela por tipo — UNION na vista; (b) JSONB em `companies` — sem índice, sem histórico |
| 2 | **Nova = ausência de linha** (`LEFT JOIN` → NULL) | Evita 50 k rows «ainda não olhei». Filtro «só novas» = `WHERE os.status IS NULL` | Gravar «nova» no primeiro render — desperdício |
| 3 | Máquina de estados no backend; Descartada reversível | Spec recusa `submetida → interessa`; validar só na UI é contornável. 409 em PT. `ganha`/`perdida` terminais (admin da empresa reabre) | Estados livres — estraga dados para win-rate v1.2 |
| 4 | Checklist chaveada por `sha1(texto normalizado)` | A `checklist` da análise é um array sem id; regenerar mantém ticks do mesmo texto | Índice posicional — quebra à primeira regeneração |
| 5 | `company_profiles` 1:1, **não** colunas em `profiles` de atividade | Alvará/geo/exclusões são da **empresa** (dois perfis de atividade, um alvará) | Colunas em `companies` (mistura faturação); JSONB |
| 6 | Regras **limitam**, nunca elevam. Exclusão → `skipAi`, fit 0. Geo cap 20. Valor cap 35. Score = `min(ai, cap)` | Gratuitas, explicáveis, estáveis. IA continua a ser quem diz «sim» | Tudo no prompt — caro, não determinístico |
| 7 | Distrito = mesma expressão SQL do mapa (`DISTRICT` em `routes-v2.ts`) | Consistência mapa / filtro / regra. Anúncio sem local → `NULL` → regra **não** aplica | Heurística diferente por ecrã |
| 8 | Invalidação preguiçosa: `company_profiles.version`; `ai_fit_scores.profile_version`; stale se menor; recompute só do que é pedido; teto em aviso → `stale: true` | Spec proíbe recompute em massa | Apagar fits ao guardar — lista fica sem score |
| 9 | Scheduler em processo, tick 60 s, Europa/Lisboa, janela 08:00–08:59. `INSERT ON CONFLICT DO NOTHING` **antes** de enviar. Retry `failed` até 3 | 1 réplica mas deploys sobrepostos. Sem `node-cron` | Cron Railway extra; fila externa |
| 10 | Fuso fixo Europa/Lisboa | PT-only (multi-país fora de âmbito) | Coluna de fuso por utilizador |
| 11 | Opt-out HMAC `SESSION_SECRET` sobre `user_id\|kind\|version`, sem sessão | Spec exige um clique sem login. `version++` ao religar invalida links | Tabela extra de tokens |
| 12 | Feedback = few-shot 10 👎 (título + `reason_code`), **não** treino. Comentário livre **fora** do prompt | Efeito imediato; prompt cacheável; evita injecção | Fine-tuning; meter o comentário no prompt |
| 13 | Gating de filtros em `listFilters` (403 `plan_required`) | Backend é a verdade; UI só desenha o cadeado | Três implementações |
| 14 | `fmtDatePT(Date \| string)` → `DD/MM/AAAA` em **todos** os emails | Bug «Wed Jul 29» em produção | Continuar com `.slice(0,10)` |
| 15 | Poller opendata 5 000 → 60 000 ms | 17 280 queries/dia para uma fila semanal | Manter 5 s |

**Mapa de transições** (`src/pipeline.ts`):

- `NULL` (Nova) → `{interessa, preparacao, submetida, descartada}` (e, se fizer sentido operacional, ganha/perdida só depois de submetida).
- `interessa` → `{preparacao, submetida, descartada}`
- `preparacao` → `{interessa, submetida, descartada}`
- `submetida` → `{ganha, perdida, descartada}` **apenas**
- `descartada` → `{interessa}`
- `ganha` / `perdida` → terminais (só admin da empresa reabre)

Mensagem 409 para `submetida → interessa`: *«Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada»*.

---

## 5. Modelo de dados (migrações em `src/db.ts`, `IF NOT EXISTS`)

```sql
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
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS profile_version INT NOT NULL DEFAULT 1;
ALTER TABLE ai_fit_scores ADD COLUMN IF NOT EXISTS rule_hits JSONB NOT NULL DEFAULT '[]';

-- D. Notificações
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_digest    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_version   INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS notification_log (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,            -- digest | reminder7 | reminder2
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref         TEXT NOT NULL,            -- digest: 'profile:<id>:<AAAA-WW>'; reminder: 'user-day:<AAAA-MM-DD>'
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

-- C. Índices de filtros
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- fallback silencioso se falhar → ILIKE
CREATE INDEX IF NOT EXISTS idx_ann_procedure ON announcements (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_ann_base_price ON announcements (base_price);
CREATE INDEX IF NOT EXISTS idx_ann_entity_trgm ON announcements USING gin (lower(contracting_entity) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contracts_procedure ON contracts (contracting_procedure_type);
CREATE INDEX IF NOT EXISTS idx_contracts_price ON contracts (initial_contractual_price);
CREATE INDEX IF NOT EXISTS idx_contracts_district ON contracts (
  (NULLIF(btrim(split_part(split_part(execution_place,'|',1),',',2)),''))
);
```

Nota: `note` do pipeline ≤ 2 000 caracteres; comentário 👎 ≤ 500. Validar no PUT.

---

## 6. API (todos com `requireAuth`, excepto unsubscribe)

| Método e caminho | Plano | Notas |
|---|---|---|
| `GET /api/pipeline?status=&assigned=me` | grátis | Enriquecidos (título, entidade, prazo, valor) + progresso checklist |
| `PUT /api/pipeline/:type/:id` | grátis | `{status?, note?, assigned_user_id?}`; 409 transição; 404 fora de âmbito |
| `GET /api/pipeline/:type/:id/history` | grátis | |
| `PUT /api/pipeline/:type/:id/checklist` | grátis | `{item_text, checked}` → hash |
| `GET /api/company/profile` · `PUT` | grátis | valida intervalo; `version++` |
| `GET /api/announcements` · `/api/contracts` · `/api/insights/opportunities` · `/api/insights/renewals` | existentes | + `district[]`, `deadline_within`, `q`; **Pro:** `value_min`, `value_max`, `procedure[]`, `entity`, `cpv[]`, `sort`, `order`; + `pipeline_status`; + `stale` nos fits; `only_new=1` |
| `GET /api/announcements/facets?…` | grátis (procedimento = Pro) | |
| `GET/PUT /api/me/notifications` | grátis | `{notify_digest, notify_reminders}` |
| `GET /api/notifications/unsubscribe?t=` | **público** | HMAC; HTML de confirmação |
| `POST /api/ai/feedback` · `DELETE` | Pro (`feedback_ia`) | upsert por utilizador+item |
| `GET /api/admin/notifications` · `/api/admin/ai-feedback` | admin | |
| `POST /api/admin/notifications/run` | admin | força tick (`now` opcional) |

`itemInCompanyScope(companyId, type, id)` — 404 sem revelar dados de outra empresa.

---

## 7. Fluxos-chave

**Fit com regras + perfil + feedback** (`fitScores()`):

1. Carrega `company_profiles` (uma vez por lote) e `negativeExamples(companyId)` (10).
2. Por item: `applyFitRules()` → se `skipAi`, grava fit 0 com `rule_hits` e **não** chama o modelo.
3. Restantes: `profileContext()` + `companyProfileContext()` + bloco `EXEMPLOS DE NÃO-FIT INDICADOS PELA EMPRESA` (título + `reason_code` **só**; comentário livre fora).
4. Score = `min(ai, cap)`; `reasons = [...ruleHits, ...aiReasons]`; grava `profile_version`.
5. Ao ler: se `profile_version < atual` → recalcula dentro do teto; senão, se teto em aviso → `stale: true`.

**Regressão obrigatória (tarefa 2.11):** empresa **sem** `company_profiles` ⇒ fits **idênticos** aos de hoje.

**Tick do agendador** (60 s):

1. `now` em Europa/Lisboa. Se hora ≠ 08 → sai.
2. Se segunda: para cada `(profile, user)` elegível (digest on, inclui **trial**), `INSERT notification_log (digest, user, 'profile:<id>:<AAAA-WW>')` — só quem inseriu envia. Assunto: `BaseRadar — Resumo semanal · {nome do perfil} · DD/MM/AAAA`. Semana a zeros: enviar na mesma *«Semana sem novidades na sua atividade»*.
3. Todos os dias: itens `interessa|preparacao` com prazo em 7 ou 2 dias, empresa **Pro+**, sem `reminder_log` para `(item, kind, deadline)`; agrupa por utilizador; um email; grava `reminder_log` por item.
4. Retenta `failed` com `attempts < 3`.

**Filtros:** `listFilters()` devolve `{ where, params, orderBy }`; encaixa no padrão de `dateFilters()`. Ordenação fechada: prazo, valor, publicação, (Pro) score/fit. Itens sem valor no fim quando se ordena por valor. Distrito de anúncios: `contracting_entity` / `execution_place` quando existir.

**Formalidades (inferência de plataforma):** domínio de `contracting_procedure_url` → vortal→Vortal, acingov→AcinGov, saphety→Saphety, anogov→anoGov, compraspublicas→Compras Públicas; senão «ver anúncio».

---

## 8. Frontend e ficheiros

### UI (`public/app.js`, sem framework)

- Chip `<select class="pl-status">` nas linhas de Oportunidades / Concursos / Renovações; PUT optimista com reversão.
- Vista `#/pipeline` — nav entre Oportunidades e Renovações; `NAV_FEATURE['#/pipeline']='pipeline'`. Colunas Interessa / Em preparação / Submetida; «Fechadas» colapsada. Prazo vermelho se passado + «Prazo ultrapassado».
- Ficha: secção Pipeline (estado, nota ≤ 2000, responsável, histórico) + checklist.
- Hoje: «No pipeline» **no topo**, só se houver itens com prazo ≤ 14 dias (Em preparação ≤ 7, Interessa ≤ 14). «A minha responsabilidade».
- Conta → Perfil da empresa; onboarding 4 passos saltável após registo.
- Barra de filtros: chips + contagens; Pro com cadeado `can('filtros_avancados')`; hash `#/radar/announcements?district=Lisboa&deadline=30`.
- 👍/👎 no chip de fit e na ficha; popover de motivo no 👎.
- Conta → Notificações: dois interruptores (default on).
- Admin: «Notificações (últimas 200)» + «Forçar tick»; «Feedback IA por motivo/CPV».
- Incrementar `app.js?v=` e `style.css?v=` em `public/index.html` quando a SPA muda. (Actualmente `v=46` / `v=27`.)

Sugestões de certificação (ordem fechada): **Alvará classe 1, 2, 3, 4, 5**, ISO 9001, ISO 14001, ISO 45001; depois (não no topo) HACCP, licença de pirotecnia, segurança privada. Sem alvará de mediação imobiliária no topo.

Distritos PT para o seletor / heurística: Aveiro … Viseu + Açores + Madeira (lista canónica no código, um sítio).

### Ficheiros

| Ficheiro | Ação | Para quê |
|---|---|---|
| `src/db.ts` | MOD | migrações §5 |
| `src/config.ts` | MOD | 5 capacidades; `DIGEST_HOUR`, `REMINDER_DAYS` |
| `src/pipeline.ts` | NOVO | máquina de estados, rotas, checklist, enriquecimento |
| `src/company-profile.ts` | NOVO | GET/PUT, validação, `companyProfileContext()` |
| `src/fit-rules.ts` | NOVO | `applyFitRules()` puro |
| `src/ai.ts` | MOD | regras, contexto, few-shot, `profile_version`, confronto de requisitos |
| `src/filters.ts` | NOVO | `listFilters()` + facetas |
| `src/routes-v2.ts` · `src/routes.ts` | MOD | filtros, `pipeline_status`, ordenação |
| `src/routes-account.ts` | MOD | default `daily` no perfil de registo |
| `src/scheduler.ts` | NOVO | tick, due*, retries |
| `src/notifications.ts` | NOVO | preferências, HMAC, admin |
| `src/mail.ts` | MOD | `fmtDatePT()`, digest, lembrete, rodapé opt-out |
| `src/ai-feedback.ts` | NOVO | rotas, `negativeExamples()`, sugestão, admin |
| `src/opendata.ts` | MOD | 5 s → 60 s |
| `src/index.ts` | MOD | rotas novas; `startScheduler()` |
| `src/fit-rules.test.ts` | NOVO | 8 casos (tarefa 2.3); `npm run test:rules` **ou** incluir em `npm test` |
| `public/app.js` · `public/style.css` · `public/index.html` | MOD | UI §8 |
| `public/landing.html` | MOD | domínio G |
| `OFERTA.md` · `README.md` | MOD | ICP + planos + exemplos construtor |
| `README.md` (produto) | MOD | `DIGEST_HOUR`, `REMINDER_DAYS`; agendador no processo da app |

Workspace: imports no topo (sem inline); `switch` sobre uniões com `default` + `never`.

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Deploy às 08:00 de segunda envia o digest duas vezes | `UNIQUE` + `ON CONFLICT DO NOTHING` **antes** de enviar |
| Alterar o perfil dispara custo de IA | versão + recompute só do pedido + teto |
| Filtro por entidade lento sem `pg_trgm` | tentar extensão; cair para `ILIKE` no âmbito do perfil |
| Regras agressivas frustram | caps 20/35, não 0, para geo/valor; motivo visível + link; só exclusões dão 0 |
| Emails a spam | remetente verificado, opt-out 1 clique, **um** email de lembretes por utilizador/dia |
| Regressão no fit actual | regras só limitam; teste «sem perfil ⇒ fit idêntico» |

---

## 10. Requisitos + todos os cenários Fable + AC de UI

Como validar um AC: abrir `https://basegov-robot-production.up.railway.app/`, seguir os passos, Passa/Falha. Planos de teste: Grátis, Pro (ou trial 7 dias), Business com **dois** utilizadores.

Os Given/When/Then da Fable **mantêm-se**. A coluna «Verificação» diz se é ecrã (AC) ou API/admin (tarefa).

### G — GTM

#### GTM-01 — Hero fala ao responsável por concursos
- **URL:** `/`
- **Passa se:** eyebrow com «responsável por concursos»; H1 sobre concursos / contratos públicos **antes de irem a concurso**; lead com perfil, CPV ou habilitação; mais do que um sector nomeado (obras, energia, saúde).
- **Falha se:** «festas», ou o hero só fala de construtoras/obras sem outro sector.

#### GTM-02 — Cartão do hero mistura sectores
- **URL:** `/`
- **Passa se:** pelo menos um cartão = obras/reabilitação/escola ≥ 100 000 € **e** outro = energia/iluminação ou saúde/dispositivos, entidade pública, ≥ 100 000 €.
- **Falha se:** «Festas da Cidade», «piromusical», «pirotecnia», «Grupo Luso Pirotecnia».

#### GTM-03 — Business destacado; Pro é isco
- **URL:** `/#preco`
- **Passa se:** 0 / 29 / 99 €; **Business** com ribbon/borda e copy de **equipa de concursos** / 10 utilizadores / gestão comercial; Pro com 7 dias grátis, **sem** ribbon «MAIS POPULAR».
- **Falha se:** ribbon «MAIS POPULAR» no Pro e Business irrelevante.

#### GTM-04 — Funcionalidades sem pirotecnia
- **URL:** `/#funcionalidades`
- **Passa se:** mocks de obras, energia ou saúde e entidades públicas; resumo = email semanal (segunda 08:00); carteira de propostas ou mesa de trabalho mencionado.
- **Falha se:** «Grupo Luso», «Pirotec», «Festas».

#### GTM-05 — Title, meta, CTAs
- **URL:** `/`
- **Passa se:** title/description PT-PT sem festas/pirotecnia; Começar grátis → `/app#/registo`; Entrar → `/app#/login`.

#### GTM-06 — Registo
- **URL:** `/app#/registo`
- **Passa se:** os exemplos cobrem mais do que construção (obras **e** energia ou saúde / CPV).
- **Falha se:** «pirotecnia» ou «fogo de artifício».

Anti-regressão: após **qualquer** PR, repetir GTM-01, GTM-02, GTM-06 em produção.

---

### F — Fundações (Fase 0)

#### FND-01 — Datas DD/MM no digest web
- **URL:** `/app#/digest` + «Versão email»
- **Passa se:** datas `DD/MM/AAAA` (ou `D/MM/AAAA`); nunca `Wed Jul 29` nem ISO com hora.
- Cobre o cenário de datas do spec `notifications` e a tarefa 0.7.

#### FND-02 — Perfil de registo nasce `daily`
- **Verificação:** criar conta nova → perfil com recolha diária (UI e `profiles.schedule`). Tarefa extra à Fase 0; a Fable não a tinha.

Também Fase 0 (não ecrã): migrações A–E, `pg_trgm` com fallback, capacidades novas, poller 60 s, `db-stats` mostra tabelas vazias (0.9).

---

### A — Pipeline (`specs/pipeline/spec.md`, grátis)

Requisitos Fable: estado por oportunidade; único por `(empresa, oportunidade)`; Nova = sem linha; nota ≤ 2000; responsável da mesma empresa (MAY vazio); histórico na ficha; checklist da análise marcável; vista Pipeline; Hoje no topo; listas com `pipeline_status` sem N+1; filtro «Só novas».

| Cenário Fable | AC / tarefa |
|---|---|
| Marcar Interessa a partir da lista; colega vê; aparece na vista | **PIP-01**, **PIP-02** |
| `submetida → interessa` recusada com a mensagem exacta | **PIP-03** |
| Oportunidade de outra empresa → 404, nada gravado, nada revelado | Fase **7.2** (API) |
| Descartada → Interessa; histórico com as duas transições | **PIP-04** |
| Atribuir responsável; Rui vê «A minha responsabilidade» | **PIP-06** |
| Responsável removido da equipa → fica sem responsável, estado intacto | **PIP-09** |
| Consultar histórico Interessa → Preparação → Submetida | **PIP-04** / ficha |
| Escolher o mesmo estado de novo → 200, **zero** linhas de histórico | **PIP-10** |
| Marcar 3/6 → «3/6 · 50 %» na ficha e na vista; colega vê | **PIP-08** |
| Análise regenerada: mesmo texto mantém tick; novos desmarcados; desaparecidos ocultos | **PIP-12** |
| Sem análise → *«Gere a análise de IA para obter a checklist de preparação»* | **PIP-08** |
| Vista vazia + ligação a Oportunidades | **PIP-05** |
| Prazo ultrapassado em preparação → vermelho + etiqueta + sugestão Submetida/Descartada | **PIP-05** |
| Hoje sem prazos ≤ 14 dias → secção pipeline **ausente** | **PIP-07** |
| Lista 50 itens, 3 marcados, **uma** resposta com campo de estado | Fase **1.11** (sem N+1) |
| Filtro «Só novas» | **PIP-11** |

#### PIP-01 — Chip na lista
- **URL:** `/app#/radar/opportunities` (Pro, para haver lista)
- **Passos:** Nova → «Interessa», sem recarregar.
- **Passa se:** chip «Interessa»; nav «Pipeline»; item em `/app#/pipeline` na coluna Interessa.

#### PIP-02 — Equipa
- Utilizador B noutro browser recarrega a lista → vê o mesmo chip.

#### PIP-03 — Transição proibida
- Submetida → Interessa → mensagem *«Uma proposta submetida só pode passar a Ganha, Perdida ou Descartada»*; estado inalterado.

#### PIP-04 — Descartada reversível
- Nova → Descartada → Interessa → volta Interessa; histórico com as duas transições (autor + hora).

#### PIP-05 — Vista `#/pipeline`
- Colunas Interessa / Em preparação / Submetida; Fechadas colapsada; prazo, valor, responsável, % checklist; prazo passado a vermelho + «Prazo ultrapassado» + sugestão; vazio com ligação a Oportunidades.

#### PIP-06 — Responsável no Hoje
- Ana atribui Rui; prazo Em preparação ≤ 7 dias.
- Rui vê «A minha responsabilidade»; «No pipeline» **acima** de «Agir esta semana».

#### PIP-07 — Hoje sem secção vazia
- Pipeline com itens mas nenhum prazo ≤ 14 dias → «No pipeline» **ausente**.

#### PIP-08 — Checklist
- Análise com 6 itens; marcar 3 → «3/6 · 50 %» na ficha e na vista; colega vê o mesmo. Sem análise: texto Fable, sem erro.

#### PIP-09 — Responsável removido
- Admin remove o utilizador da equipa → oportunidade fica sem responsável; estado inalterado. (Conta → equipa, depois `#/pipeline`.)

#### PIP-10 — Mesmo estado não gera histórico
- Interessa → Interessa → sucesso; histórico **não** ganha linha.

#### PIP-11 — Só novas
- Lista de oportunidades → «Só novas» → só linhas sem estado.

#### PIP-12 — Checklist sobrevive à regeneração
- Marcar itens; regenerar análise IA → itens com o mesmo texto continuam marcados; novos desmarcados; os que saíram da lista da IA desaparecem da UI.

---

### B — Perfil da empresa (`specs/company-profile/spec.md`, grátis; fit continua Pro)

| Cenário Fable | AC / tarefa |
|---|---|
| Onboarding 4 perguntas saltável; volta em Conta | **PRF-01** |
| Editar distritos; fits passam a desatualizados; **zero** chamadas IA no momento | **PRF-08** + tarefa **2.11** |
| Min 100 000 > max 50 000 → mensagem exacta, nada gravado | **PRF-03** |
| Exclusão «manutenção» → fit 0, sem consumo IA | **PRF-04** + 2.11 |
| Lisboa+Setúbal; IA 85 no Porto → fit 20; razões regra + IA; link editar | **PRF-05** |
| Distrito desconhecido → regra geo **não** aplica | **PRF-06** |
| Sem alvará classe 4; caderno exige → «não tem»; go/no-go ≤ condicional; red flag | **PRF-07** |
| Perfil vazio → requisitos «não determinável» + «Complete o perfil» | **PRF-07** |
| Teto IA em aviso → valores antigos + etiqueta «desatualizado» | **PRF-08** |

Regras (MUST, antes da IA):

| Regra | Efeito |
|---|---|
| Termo de exclusão no título ou descrição | fit = 0, *«Excluído por regra: contém '<termo>'»*, **sem IA** |
| Entidade na lista de exclusão | fit = 0, *«Excluído por regra: entidade excluída»*, **sem IA** |
| Distrito fora dos servidos (quando definidos **e** conhecidos) | cap 20, *«Fora da área geográfica (<distrito>)»* |
| Valor fora do intervalo (quando definido **e** conhecido) | cap 35, *«Valor fora do intervalo habitual (<valor>)»* |

Normalização: deaccent + lower em termos e entidades. Arrays normalizados no PUT.

#### PRF-01 — Onboarding 4 passos saltável
- Após registo: onde executa, certificações, valores, o que nunca faz; **Saltar**; volta em Conta → Perfil da empresa.

#### PRF-02 — Sugestões de construtor
- Primeiras certificações = Alvará classe 1–5 e ISO 9001/14001/45001.

#### PRF-03 — Intervalo inválido
- *«O valor máximo tem de ser superior ao mínimo»*; nada gravado.

#### PRF-04 — Exclusão por termo = fit 0
- Fit **0**, motivo de regra, ligação ao perfil.

#### PRF-05 — Geografia limita
- Fit **20**; «Fora da área geográfica (Porto)»; razão da IA por baixo; link editar.

#### PRF-06 — Dados em falta não penalizam
- Concurso sem distrito → **não** aparece regra geográfica.

#### PRF-07 — Alvará na ficha
- Sem «Alvará classe 4»; caderno exige-o → «não tem»; go/no-go ≤ **condicional**; red flag. Perfil vazio → «não determinável» + «Complete o perfil».

#### PRF-08 — Desatualizado visível
- Com teto em modo aviso, após mudar o perfil: chip com etiqueta **«desatualizado»** (não bloqueia a lista). Sem teto: fits visíveis recomputados ao abrir a lista.

Testes de `applyFitRules` (2.3), **sem BD**, 8 casos incluindo «distrito desconhecido não penaliza» e «valor desconhecido não penaliza».

---

### C — Descoberta (`specs/discovery/spec.md`)

| Cenário Fable | AC / tarefa |
|---|---|
| Lisboa + 20k–200k + Concurso público; total e URL | **DIS-01** |
| Grátis no filtro de valor → cadeado + planos; API 403 `plan_required` | **DIS-02** + 3.7 |
| Sem preço base + filtro de valor → excluídos; barra *«N concursos sem valor publicado excluídos»* | **DIS-01** (barra) |
| Zero resultados → mensagem + Limpar filtros | **DIS-03** |
| Contagens de distrito dado o resto; zeros desativados | **DIS-04** |
| Página 2 mantém filtros; ordenar valor desc; sem valor no fim | **DIS-05** |
| 6 combinações < 1,5 s cache quente | Tarefa **3.6** (tempos no PR) |

#### DIS-01 — Três filtros (Pro)
- Concursos: Lisboa + 20 000–200 000 + «Concurso público».
- Linhas cumprem os três; total bate certo; hash tem os três; recarregar mantém; barra indica excluídos sem valor se N>0.

#### DIS-02 — Cadeado Grátis
- Clique no filtro de valor → cadeado + explicação Pro + `/app#/planos`. Filtro não aplica.

#### DIS-03 — Zero resultados
- *«Sem resultados com estes filtros»* + **Limpar filtros**.

#### DIS-04 — Contagens
- Prazo 30 dias → cada distrito com N; zeros desativados; **«Sem localização (N)»** se N>0.

#### DIS-05 — Página 2 e ordenação
- Filtros sobrevivem à página 2; valor desc (Pro) → maior valor primeiro, sem valor no fim.

---

### D — Notificações (`specs/notifications/spec.md`)

| Cenário Fable | AC / tarefa |
|---|---|
| Segunda 08:00, 2 users, 1 email cada, assunto com nome do perfil e DD/MM | **NTF-02** (app) + **4.7** (envio) |
| Opt-out de um user; colegas recebem | **NTF-01**, **NTF-03** |
| Semana a zeros → email na mesma com a frase Fable | **NTF-02** |
| Dois contentores às 08:00 → **um** email por user/perfil | **NTF-08** / 4.7 |
| Falha de email → `failed` + retry ≤ 3; não bloqueia outras | **4.7**, **ADM-01** |
| 3 prazos a 7 dias → **um** email agrupado com responsável e % | **NTF-04** |
| Submetida às 07:30 → fora do lembrete das 08:00 | **NTF-05** |
| Grátis: Hoje mostra, **sem** email de lembrete | **NTF-06** |
| Prazo prorrogado → reenvia 7 dias na nova data (`reminder_log` por deadline) | **NTF-07** |
| Preferências default on; link no rodapé | **NTF-01**, **NTF-03** |
| Admin vê últimas 200 (estado, provider id, erro) | **ADM-01** |
| Digest no **trial** Pro | **Sim** (digest é grátis) — 4.3 |

O cenário Fable usa o perfil «Pirotecnia»: na implementação o assunto usa o **nome real do perfil** (ex. «Obras e reabilitação»). Não se força pirotecnia.

#### NTF-01 — Preferências
- `/app#/conta`: digest e lembretes, ambos on por omissão; desligar digest persiste.

#### NTF-02 — Digest na app
- `/app#/digest`: novos / abertos / renovações; DD/MM; se tudo a zero → *«Semana sem novidades na sua atividade»* (também na versão email).

#### NTF-03 — Opt-out sem sessão
- Link do rodapé → confirmação; digest desliga; «voltar a ligar» exige sessão.

#### NTF-04 — Lembrete agrupado (Pro)
- 3× Em preparação a 7 dias; forçar tick → **um** email «3 prazos daqui a 7 dias» com responsável e %.

#### NTF-05 — Submetida não lembra
- Mudar para Submetida antes das 08:00 → item fora do email.

#### NTF-06 — Grátis: prazo no Hoje, sem email
- Interessa com prazo ≤ 14 dias visível no Hoje; admin sem envio de lembrete para essa conta.

#### NTF-07 — Prorrogação
- Lembrete 7 dias já enviado; prazo +10 dias → novo lembrete 7 dias na nova data.

#### NTF-08 — Idempotência
- Forçar tick de segunda 08:00 **duas vezes** → 1 email por utilizador/perfil (`notification_log`).

#### ADM-01 — Admin notificações
- Cartão últimas 200; estado/erro; botão «Forçar tick».

---

### E — Feedback IA (`specs/ai-feedback/spec.md`, Pro)

| Cenário Fable | AC / tarefa |
|---|---|
| 👎 + motivo; chip; repetir substitui | **FBK-01** |
| Grátis → cadeado; API 403 `plan_required` | **FBK-02** + 5.6 |
| Ana 👍 e Rui 👎 visíveis com autor; aprendizagem = mais recente | **FBK-03** |
| Três 👎 «limpeza» ⇒ prompt com os três; fit seguinte menor; razão refere feedback | **5.6** (prompt + ecrã) |
| 👎 geografia Faro → sugestão num clique | **FBK-04** |
| Admin: agregado por motivo e prefixo CPV; abre cada item | **FBK-05** |

Motivos: `fora_atividade` · `fora_geografia` · `requisito_impossivel` · `valor_desadequado` · `outro` (+ comentário ≤ 500, **não** vai ao prompt).

#### FBK-01 — 👎 com motivo
- Chip fit → 👎 «fora da nossa atividade» → ícone + motivo no hover; repetir substitui.

#### FBK-02 — Cadeado Grátis.

#### FBK-03 — Ana 👍 e Rui 👎 visíveis com nome na ficha.

#### FBK-04 — 👎 geografia em Faro → *«Adicionar Faro…»* num clique actualiza o perfil.

#### FBK-05 — Admin
- `/app#/admin` (ou equivalente): contagem por motivo e por CPV; lista com texto do item.

---

### F (resto) — Formalidades e frescura

#### FOR-01 — Ficha: bloco Formalidades
- Plataforma inferida + DEUCP + assinatura digital qualificada. Sem parecer jurídico.

#### FRS-01 — «Última recolha: DD/MM HH:mm»
- Sidebar (cartão de atividade) e topo de Hoje.

Landing (tarefa Fable 6.3) **absorvida por G**. OFERTA.md (6.4) actualiza ICP + planos + pipeline/lembretes.

---

## 11. Tasks Fable 0.1–7.5 — checklist (ordem = execução)

Cada tarefa cabe numa sessão. S < 1 h · M 1–3 h · L meio dia+. Cada fase mergeável. `npm run build` / `typecheck` + `npm test` verdes antes do commit. `?v=` se SPA mudar. PR por fase.

### Fase 0 — Fundações
- [ ] 0.1 S Migrações pipeline
- [ ] 0.2 S Migrações `company_profiles` + `profile_version` / `rule_hits`
- [ ] 0.3 S `users.notify_*`, `notification_log`, `reminder_log`
- [ ] 0.4 S `ai_feedback`
- [ ] 0.5 S `pg_trgm` + índices; confirmar `/api/admin/db-stats`
- [ ] 0.6 S Capacidades + `DIGEST_HOUR` + `REMINDER_DAYS`
- [ ] 0.7 S `fmtDatePT` — bug «Wed Jul 29»
- [ ] 0.8 S opendata 5 000 → 60 000 ms
- [ ] 0.9 S Deploy: tabelas vazias; digest web DD/MM
- [ ] 0.10 S **Extra desta spec:** registo cria perfil `daily`

### Fase 1 — Pipeline
- [ ] 1.1 M `assertTransition` + `itemInCompanyScope`
- [ ] 1.2 M PUT estado/nota/responsável + histórico + timestamps
- [ ] 1.3 M GET lista enriquecida
- [ ] 1.4 S GET history
- [ ] 1.5 M Checklist hash; itens desaparecidos ocultos
- [ ] 1.6 M `pipeline_status` nas listas (uma query); `only_new=1`
- [ ] 1.7 M UI chips optimistas
- [ ] 1.8 L UI `#/pipeline`
- [ ] 1.9 M UI ficha
- [ ] 1.10 S UI Hoje
- [ ] 1.11 S Verificar cenários (409, 404, descartada, checklist, 50 itens)

### Fase 2 — Perfil + regras
- [ ] 2.1 M GET/PUT perfil, `version++`
- [ ] 2.2 M `applyFitRules`
- [ ] 2.3 S Testes sem BD (8 casos)
- [ ] 2.4 M Integrar em `fitScores()`
- [ ] 2.5 M Confronto requisitos na ficha
- [ ] 2.6 M Invalidação preguiçosa + `stale`
- [ ] 2.7 M UI formulário (certificações = lista fechada §8)
- [ ] 2.8 M UI onboarding 4 passos
- [ ] 2.9 S UI «Regra:» + «desatualizado»
- [ ] 2.10 S UI requisitos tem/não tem/indeterminável
- [ ] 2.11 S Spec + **regressão** sem perfil; zero IA ao gravar perfil

### Fase 3 — Filtros
- [ ] 3.1 M `listFilters`
- [ ] 3.2 M `/api/announcements`
- [ ] 3.3 M oportunidades + contratos (+ `sort=score|fit` Pro)
- [ ] 3.4 M Facetas; «Sem localização (N)»
- [ ] 3.5 L UI barra
- [ ] 3.6 S Medir 6 combinações < 1,5 s (tempos no PR)
- [ ] 3.7 S Cenários spec

### Fase 4 — Notificações
- [ ] 4.1 M Preferências + HMAC + UI
- [ ] 4.2 M Templates digest + lembrete
- [ ] 4.3 L Scheduler (digest no trial = sim)
- [ ] 4.4 S Admin run + list
- [ ] 4.5 S UI admin
- [ ] 4.6 S README env
- [ ] 4.7 M Verificação (duplo tick, opt-out, submetida, prorrogação, grátis, retry)

### Fase 5 — Feedback IA
- [ ] 5.1 M POST/DELETE + `negativeExamples`
- [ ] 5.2 S Bloco no prompt (**só** motivo + título)
- [ ] 5.3 S Sugestão de perfil
- [ ] 5.4 M UI 👍/👎
- [ ] 5.5 S Admin agregado
- [ ] 5.6 S Cenários spec

### Fase 6 — Transversal
- [ ] 6.1 S Última recolha
- [ ] 6.2 M Formalidades
- [ ] 6.3 S Landing — **absorvido por G / PR 1**
- [ ] 6.4 S OFERTA.md — **absorvido por G / PR 1**

### Fase 7 — Fecho
- [ ] 7.1 M Todos os cenários em produção, 2 contas (grátis + Pro), 2 users na mesma empresa
- [ ] 7.2 S Isolamento tenant A/B na API
- [ ] 7.3 S `ai_usage_events` não sobe por regras; RAM Railway estável
- [ ] 7.4 S Jira **TRNSF-1557**
- [ ] 7.5 S Fundir delta-specs na spec de produto; arquivar `openspec/changes/archive/2026-09-gap-closure/`

---

## 12. Perguntas em aberto da Fable — fechadas

| Pergunta (`tasks.md`) | Decisão | Porquê |
|---|---|---|
| Certificações comuns (antes da 2.7) | Alvará classe 1–5, ISO 9001/14001/45001; depois HACCP, pirotecnia, segurança privada | ICP = construtor |
| Faceta distrito desconhecido (durante 3.4) | Visível: **«Sem localização (N)»** | O diretor filtra Lisboa/Porto e precisa de ver o resto |
| Digest no trial (antes da 4.3) | **Sim** | Digest é grátis; já vendido no Free |
| Comentário 👎 no prompt (antes da 5.2) | **Não** — só `reason_code` + título | Evita injecção no modelo |

---

## 13. PRs mergeáveis → AC

Cada PR: `npm run typecheck` + `npm test` verdes. Base `main`. Deploy Railway após merge.

| PR | Branch | Fase Fable | Conteúdo extra | AC |
|---|---|---|---|---|
| 1 GTM | `cursor/gtm-landing-construtor-3855` | 6.3–6.4 antecipados | **Este documento** + landing + OFERTA + README + copy de registo/perfil | GTM-01…06 |
| 2 Fundações | `cursor/gap-foundations-3855` | 0.1–0.9 | + default `daily` | FND-01, FND-02 |
| 3 Pipeline | `cursor/gap-pipeline-3855` | 1.1–1.11 | — | PIP-01…12 |
| 4 Perfil + regras | `cursor/gap-company-profile-3855` | 2.1–2.11 | Lista de alvarás fechada | PRF-01…08 |
| 5 Filtros | `cursor/gap-discovery-3855` | 3.1–3.7 | Faceta «Sem localização» | DIS-01…05 |
| 6 Notificações | `cursor/gap-notifications-3855` | 4.1–4.7 | Digest no trial = sim | NTF-01…08, ADM-01 |
| 7 Feedback + F | `cursor/gap-ai-feedback-3855` | 5.1–5.6 + 6.1–6.2 | Comentário 👎 fora do prompt | FBK-01…05, FOR-01, FRS-01 |
| Final | — | 7.1–7.5 | Duas contas + isolamento + custos + Jira + arquivo | Matriz §1 |

Ordem de valor se cortar âmbito: **G (já no ar) → D → A → B → C → E → F**.

---

## 14. O que o produto **já** faz e esta spec não mexe

Radar Hoje, score 0–100, fit IA actual (até existir perfil rico), renovações (celebração+prazo, contacto ~4 meses), TED, mapa, sazonalidade, concorrentes por NIF, fichas de entidade, análise GO/NO-GO + dossier, seats Free 1 / Pro 2 / Business 10, Stripe/Moloni, scraper BASE + IMPIC + retries 999.

**Regra de ouro:** empresa sem `company_profiles` ⇒ fits **idênticos** aos de hoje.

---

## 15. Como usar este documento

1. Implementar pela tabela §13, uma fase = um PR.
2. Não implementar o §3.4 (fora de âmbito) nem a tabela §1.7 marcada **Fora**.
3. Depois de cada PR: AC da coluna + GTM-01/02/06 sempre.
4. Não reabrir a tabela §4.
5. Ao concluir: fundir este documento + delta-specs na spec de produto e arquivar `gap-closure-2026-09/`.

Extracto clicável para QA: [`ui-acceptance.md`](./ui-acceptance.md) (espelha os AC da §10; se divergir, **vence este SPEC**).
