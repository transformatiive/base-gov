# Proposal: Fecho de gaps de produto — BaseRadar v1.1

> **Data:** 2026-09-02 · **Autor da decisão:** Nuno Barreto · **Estado:** aprovado para implementação
> **Precedência:** não bloqueia nem depende do caminho crítico de lançamento (chave Stripe → provisionamento → 1.ª fatura Moloni), que corre em paralelo.

---

## 1. Intenção

### Problema

O BaseRadar já faz a parte difícil — cruza 2,1 M de contratos públicos com a atividade de uma PME e produz oportunidades, renovações previsíveis e uma análise de IA fundamentada nos cadernos de encargos. Mas falha em três coisas que um comercial de PME sente **todos os dias**:

1. **Não há memória de trabalho.** O utilizador vê a mesma lista amanhã sem saber o que já olhou, o que decidiu ignorar, o que está a preparar e o que já submeteu. Com dois ou mais utilizadores (plano Business), a equipa não se coordena.
2. **O fit de IA é "parecido com os teus termos", não "podes mesmo concorrer".** O perfil só tem palavras-chave e CPV; a IA não sabe que a empresa não tem alvará classe 4, não trabalha nos Açores ou nunca concorre acima de 200 k€. O resultado é um score plausível mas pouco acionável — exactamente o "genérico" que o checklist de validação avisa.
3. **Nada chega sozinho.** O digest semanal, anunciado em todos os planos, é um rascunho manual no Gmail. Não há aviso de prazo. A ferramenta só ajuda quem se lembra de a abrir.

A estes juntam-se dois gaps secundários: **não se consegue explorar** (não há filtros por distrito, valor, tipo de procedimento ou entidade — só o filtro implícito do perfil) e **a IA não aprende** com o utilizador (não há forma de dizer "isto não faz sentido para nós").

### Objetivo

Um utilizador de PME, sem ser especialista em contratação pública, consegue em cada semana:

- receber na caixa de correio, sem pedir, o que há de novo na sua atividade;
- marcar em dois cliques o que interessa e o que está a preparar, e ver a equipa a fazer o mesmo;
- ser avisado 7 e 2 dias antes de cada prazo das oportunidades que marcou;
- confiar que um fit baixo é porque a empresa **não pode** concorrer (regra explícita e visível), não porque o modelo adivinhou;
- filtrar concursos por onde, quanto e como;
- corrigir a IA quando erra, e ver essa correção refletida.

### Porquê agora

O produto vai ser lançado comercialmente. As funcionalidades acima são as que se veem em uso diário e as que separam "ferramenta de consulta" de "ferramenta de trabalho" — e o digest está prometido na landing em todos os planos.

---

## 2. Âmbito

### Em âmbito

| # | Domínio | Resumo |
|---|---|---|
| A | **Pipeline por oportunidade** | Estados Nova → Interessa → Em preparação → Submetida → Ganha / Perdida (+ Descartada), com nota, responsável, histórico e checklist de preparação interativa. Vista "Pipeline" e chips nas listas. |
| B | **Perfil rico da empresa** | Certificações/alvarás, distritos servidos, intervalo de valor, exclusões (termos e entidades), descrição livre. Regras determinísticas e transparentes aplicadas **antes** da IA; contexto injetado nos prompts de fit e de análise. |
| C | **Descoberta com filtros** | Filtros facetados nas listas de concursos, oportunidades e contratos: distrito, valor, tipo de procedimento, janela de prazo, entidade, CPV. Contagens por faceta. Estado do filtro no URL. |
| D | **Notificações automáticas** | Digest semanal por email (segunda 08:00, por perfil, a todos os utilizadores da empresa, com opt-out) e lembretes de prazo (7 e 2 dias) para itens marcados no pipeline. Agendador idempotente. |
| E | **Feedback sobre a IA** | 👍/👎 com motivo no fit e na ficha de análise; visível no admin; injetado como exemplos negativos nos prompts seguintes da mesma empresa. |
| F | **Melhorias transversais** | Indicador de frescura ("última recolha"), secção "Formalidades" na ficha (plataforma de submissão, DEUCP, assinatura qualificada), correção do formato de datas no digest, poller do opendata de 5 s → 60 s. |

**Acesso por plano (decisão):** A e B **grátis** (engagement e qualidade do fit para todos); lembretes (D), filtros avançados (C) e feedback IA (E) **a partir do Pro**. O digest (D) é grátis, como já anunciado.

### Fora de âmbito (não-objetivos explícitos)

- **OCR** de peças digitalizadas — a análise continua a depender de PDFs com texto.
- **Integrações Slack / Teams / CRM / ERP** — a "integração API" do Business fica como está (declarativa).
- **Aplicação móvel nativa** — mantém-se web responsivo.
- **Submissão automática nas plataformas** (Vortal, AcinGov…) — o hand-off continua a ser um link.
- **Aconselhamento jurídico sobre DEUCP/assinatura** para além de texto orientador estático.
- **Corte do histórico pré-2019** — decisão separada, adiada; o agregado mantém-se.
- **Pagamentos e faturação** (Stripe, Moloni) — trilho próprio, em curso.
- **Taxas de vitória por entidade/CPV** calculadas a partir do pipeline — o pipeline recolhe os dados (Ganha/Perdida); a analítica fica para v1.2.
- **Multi-idioma** — só português europeu.

### Fatia mínima que prova o conceito

Decisão do dono: **entrega única** com todos os domínios A–F. Ainda assim, `tasks.md` está ordenado para que cada fase seja *mergeável* e útil por si — se o tempo apertar, a ordem de valor é D (digest) → A (pipeline) → B (perfil) → C (filtros) → E (feedback) → F.

---

## 3. Restrições

| Área | Restrição |
|---|---|
| Stack | Node 22, TypeScript estrito, Fastify, SPA vanilla-JS (`public/app.js`, sem framework), Postgres 18. **Sem dependências novas** salvo decisão em `design.md`. |
| Alojamento | Railway, **1 réplica**. Os *deploys* sobrepõem contentores durante segundos → qualquer agendador em processo tem de ser idempotente por registo em BD, nunca por estado em memória. |
| Email | Resend via `src/mail.ts` (best-effort; nunca falha a operação de negócio). Remetente em `MAIL_FROM`. |
| IA | OpenRouter via `src/ai.ts`; custo por análise contabilizado em `ai_usage_events`. Alterar o perfil **não** pode disparar recomputação em massa de fits — invalidação preguiçosa. |
| Planos | Gating exclusivamente via `config.plans.features` + `requirePlan()` (backend é a verdade; UI só espelha via `can()`). |
| Multi-tenant | Tudo isolado por `company_id`; nenhuma leitura cruza empresas. |
| Idioma | UI, emails e comentários de código em **português europeu**. |
| Dados | Não alterar o corpus público (`contracts`, `announcements`, `entities`). Novas tabelas apenas. Migrações idempotentes em `src/db.ts` (`IF NOT EXISTS`). |
| Segurança | Nenhum segredo em código. Endpoints novos protegidos por `requireAuth` e, quando aplicável, `requirePlan`. Conteúdo do utilizador escapado em email (`esc()`) e em UI. |
| Prazo | Alvo: **fim de setembro de 2026** (v1.1), sem bloquear o lançamento comercial. |

---

## 4. Abordagem (resumo)

Cinco tabelas novas e uma extensão (`users`), sem tocar no corpus. Um agendador único em processo (`src/scheduler.ts`) com *tick* por minuto e `notification_log` como fonte de idempotência. O fit ganha uma camada de **regras determinísticas** (exclusões, geografia, valor) que corre antes da IA, é gratuita e explicável, e só depois o modelo pontua o que sobra — com o perfil rico e os exemplos negativos do feedback no prompt. Os filtros são parâmetros de query com índices de apoio e um endpoint de facetas. O pipeline é uma tabela de estado por `(empresa, tipo de item, id)` com histórico e checklist. Detalhe em `design.md`.
