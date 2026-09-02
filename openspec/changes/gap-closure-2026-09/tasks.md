# Tasks: Fecho de gaps de produto — BaseRadar v1.1

> Checklist de implementação. Cada tarefa cabe numa sessão e é verificável sozinha.
> Tamanho: **S** (< 1 h) · **M** (1–3 h) · **L** (meio dia+). Ordem = ordem de execução; cada fase é *mergeável* por si.
> Convenções: migrações idempotentes em `src/db.ts`; `npm run build` verde antes de cada commit; incrementar `?v=` dos assets quando `app.js`/`style.css` mudam; PR por fase.

---

## Fase 0 — Fundações (sem impacto visível)

- [ ] 0.1 **S** Migrações de `opportunity_status`, `opportunity_status_history`, `opportunity_checklist` (design §3-A)
- [ ] 0.2 **S** Migrações de `company_profiles` + colunas `profile_version`, `rule_hits` em `ai_fit_scores` (§3-B)
- [ ] 0.3 **S** Migrações de `users.notify_*`, `notification_log`, `reminder_log` (§3-D)
- [ ] 0.4 **S** Migração de `ai_feedback` (§3-E)
- [ ] 0.5 **S** `CREATE EXTENSION IF NOT EXISTS pg_trgm` com fallback silencioso + índices de filtros (§3-C); confirmar em produção com `/api/admin/db-stats` que os índices existem
- [ ] 0.6 **S** Capacidades novas em `config.plans.features` (`pipeline`, `perfil_empresa` grátis; `filtros_avancados`, `lembretes`, `feedback_ia` Pro) + `DIGEST_HOUR`, `REMINDER_DAYS`
- [ ] 0.7 **S** `fmtDatePT()` em `src/mail.ts` e substituição em `digest.html`/`digest.json` do `String(date).slice(0,10)` — **corrige o bug "Wed Jul 29"**
- [ ] 0.8 **S** `opendata.ts`: intervalo do poller 5 000 → 60 000 ms
- [ ] 0.9 **S** Verificação: deploy, `db-stats` mostra as tabelas novas vazias; digest web mostra datas DD/MM

## Fase 1 — Pipeline (spec `pipeline`)

- [ ] 1.1 **M** `src/pipeline.ts`: mapa de transições + `assertTransition(from, to)` (409 com mensagem PT); `itemInCompanyScope(companyId, type, id)` (404)
- [ ] 1.2 **M** `PUT /api/pipeline/:type/:id` — upsert de estado/nota/responsável; grava histórico só quando o estado muda; `submitted_at`/`decided_at`
- [ ] 1.3 **M** `GET /api/pipeline` — itens enriquecidos por tipo (título, entidade, prazo, valor) + progresso da checklist; filtros `status`, `assigned=me`
- [ ] 1.4 **S** `GET /api/pipeline/:type/:id/history`
- [ ] 1.5 **M** Checklist: `PUT /api/pipeline/:type/:id/checklist` com `item_text_hash`; leitura junta `analysis.checklist` com marcações (itens desaparecidos ocultos)
- [ ] 1.6 **M** `pipeline_status` nas respostas de `/api/insights/opportunities`, `/api/announcements`, `/api/insights/renewals` via `LEFT JOIN` (uma query, sem N+1); parâmetro `only_new=1`
- [ ] 1.7 **M** UI: chip/seletor de estado nas três listas, atualização otimista, reversão em erro
- [ ] 1.8 **L** UI: vista `#/pipeline` (colunas, "Fechadas" colapsada, prazo a vermelho + "Prazo ultrapassado", responsável, barra de checklist, estado vazio explicativo); entrada na navegação
- [ ] 1.9 **M** UI: secção Pipeline na ficha (estado, nota, responsável, histórico) + checklist marcável
- [ ] 1.10 **S** UI: secção "No pipeline" na página Hoje (≤ 7 dias em preparação, ≤ 14 dias interessa); oculta quando vazia; "A minha responsabilidade"
- [ ] 1.11 **S** Verificação dos cenários do spec `pipeline` (transição proibida 409; outra empresa 404; reverter descartada; checklist sobrevive a regeneração; lista com 50 itens numa resposta)

## Fase 2 — Perfil da empresa e regras de fit (spec `company-profile`)

- [ ] 2.1 **M** `src/company-profile.ts`: `GET/PUT /api/company/profile`, validação (intervalo, arrays normalizados), `version++`
- [ ] 2.2 **M** `src/fit-rules.ts`: `applyFitRules(item, profile)` puro — exclusão por termo (título+descrição, sem acentos/maiúsculas), entidade excluída, geografia (cap 20), valor (cap 35); devolve `hits` com texto PT
- [ ] 2.3 **S** Testes de `applyFitRules` (script `npm run test:rules` sem BD): 8 casos incluindo "distrito desconhecido não penaliza" e "valor desconhecido não penaliza"
- [ ] 2.4 **M** `ai.ts`: `companyProfileContext()`; integrar regras em `fitScores()` (skip da IA nos excluídos; `min(ai, cap)`; `reasons` = regras + IA; gravar `rule_hits`, `profile_version`)
- [ ] 2.5 **M** `ai.ts`: ficha de análise confronta `requisitos_habilitacao` com certificações → `{requisito, estado: tem|nao_tem|indeterminavel}`; go/no-go ≤ condicional se algum "não tem"; red flag correspondente
- [ ] 2.6 **M** Invalidação preguiçosa: ao ler fits, recomputar os `profile_version < atual` dentro do lote; se teto atingido em modo aviso → devolver antigo com `stale: true`
- [ ] 2.7 **M** UI: Conta → Perfil da empresa (formulário, sugestões de certificações comuns, seletor de distritos, intervalo de valor, exclusões)
- [ ] 2.8 **M** UI: onboarding de 4 passos após o registo (saltável), reaproveitando o formulário
- [ ] 2.9 **S** UI: motivos de regra destacados no chip do fit ("Regra: …" + ligação para editar o perfil); etiqueta "desatualizado" quando `stale`
- [ ] 2.10 **S** UI: na ficha, lista de requisitos com marcas tem / não tem / indeterminável e sugestão "Complete o perfil" quando vazio
- [ ] 2.11 **S** Verificação: cenários do spec; **regressão**: empresa sem perfil ⇒ fits idênticos aos atuais; alterar perfil ⇒ zero chamadas de IA imediatas (confirmar em `ai_usage_events`)

## Fase 3 — Descoberta com filtros (spec `discovery`)

- [ ] 3.1 **M** `src/filters.ts`: `listFilters(query, plan)` — validação, gating (403 `plan_required`), fragmentos SQL para distrito, prazo, texto, valor, procedimento, entidade (`trgm`/`ILIKE`), CPV por prefixo; ordenação segura (lista fechada)
- [ ] 3.2 **M** Aplicar em `/api/announcements` (distrito a partir de `contracting_entity`/`execution_place` onde existir)
- [ ] 3.3 **M** Aplicar em `/api/insights/opportunities` (inclui `sort=score|fit` Pro) e `/api/contracts`
- [ ] 3.4 **M** `GET /api/announcements/facets` — contagens por distrito e procedimento dado o resto dos filtros; "N sem valor publicado excluídos"
- [ ] 3.5 **L** UI: barra de filtros com chips e contagens; filtros Pro com cadeado; estado no hash; "Limpar filtros"; paginação preserva filtros; ordenação
- [ ] 3.6 **S** Medir: 6 combinações típicas < 1,5 s com cache quente (registar os tempos no PR)
- [ ] 3.7 **S** Verificação: cenários do spec (combinação de 3 filtros; grátis → 403; sem valor; sem resultados; página 2)

## Fase 4 — Notificações (spec `notifications`)

- [ ] 4.1 **M** `src/notifications.ts`: `GET/PUT /api/me/notifications`; token HMAC de opt-out (`SESSION_SECRET`, `notify_version`); `GET /api/notifications/unsubscribe` com página de confirmação; UI em Conta → Notificações
- [ ] 4.2 **M** `mail.ts`: modelo de **digest** (reaproveita `digestData()`; rodapé com opt-out; "Semana sem novidades" quando tudo a zero) e modelo de **lembrete** agrupado (lista de itens com prazo, responsável, progresso)
- [ ] 4.3 **L** `src/scheduler.ts`: tick 60 s em Europa/Lisboa; `dueDigests()` (segunda, janela 08:xx, `INSERT … ON CONFLICT DO NOTHING` antes de enviar); `dueReminders()` (7 e 2 dias, só `interessa|preparacao`, só Pro+, agrupado por utilizador, `reminder_log` por (item, kind, deadline)); retentativa de `failed` até 3; `startScheduler()` em `index.ts`
- [ ] 4.4 **S** `POST /api/admin/notifications/run` (força um tick com `now` opcional, para testar sem esperar pela segunda-feira) + `GET /api/admin/notifications` (últimas 200)
- [ ] 4.5 **S** UI admin: cartão "Notificações" com estado, erro e botão "Forçar tick"
- [ ] 4.6 **S** README: `DIGEST_HOUR`, `REMINDER_DAYS`; nota de que o agendador corre no processo da app
- [ ] 4.7 **M** Verificação: forçar tick de segunda 08:00 duas vezes ⇒ 1 email por utilizador/perfil; opt-out via link sem sessão; submetida antes do lembrete ⇒ não envia; prorrogação ⇒ reenvia; grátis ⇒ sem email mas Hoje mostra; falha de email ⇒ `failed` e retentativa

## Fase 5 — Feedback sobre a IA (spec `ai-feedback`)

- [ ] 5.1 **M** `src/ai-feedback.ts`: `POST/DELETE /api/ai/feedback` (Pro; upsert por utilizador+item); `negativeExamples(companyId)` (últimos 10 👎)
- [ ] 5.2 **S** `ai.ts`: bloco "EXEMPLOS DE NÃO-FIT INDICADOS PELA EMPRESA" nos prompts de fit e análise (mantendo o bloco de sistema cacheável)
- [ ] 5.3 **S** Sugestão de perfil: em `fora_geografia`/`requisito_impossivel`, resposta inclui `suggestion` (distrito/exclusão) e a UI oferece "Adicionar ao perfil" com um clique (chama `PUT /api/company/profile`)
- [ ] 5.4 **M** UI: 👍/👎 no chip do fit e na ficha; popover de motivo; mostra feedbacks de colegas com autor
- [ ] 5.5 **S** Admin: `GET /api/admin/ai-feedback` agregado por motivo e por prefixo CPV + lista; cartão no painel
- [ ] 5.6 **S** Verificação: cenários do spec (repetir substitui; grátis → 403; três 👎 "limpeza" ⇒ fit seguinte menor e razão refere feedback; sugestão de perfil)

## Fase 6 — Melhorias transversais

- [ ] 6.1 **S** Indicador de frescura: `last_run_at` do perfil no cartão de atividade da barra lateral e no topo de Hoje ("Última recolha: DD/MM HH:mm")
- [ ] 6.2 **M** Secção "Formalidades" na ficha de análise: plataforma de submissão inferida do domínio de `contracting_procedure_url` (tabela vortal→Vortal, acingov→AcinGov, saphety→Saphety, anogov→anoGov, compraspublicas→Compras Públicas; senão "ver anúncio"), lembrete de DEUCP e de assinatura digital qualificada (texto estático, sem aconselhamento)
- [ ] 6.3 **S** Landing: rever texto da funcionalidade "Digest semanal" e acrescentar "Pipeline de propostas" e "Lembretes de prazo (Pro)" nos cartões/planos, coerente com o gating
- [ ] 6.4 **S** OFERTA.md: atualizar funcionalidades e tabela de planos

## Fase 7 — Verificação final e arquivo

- [ ] 7.1 **M** Percorrer **todos** os cenários dos cinco specs em produção com duas contas (grátis e Pro) e dois utilizadores na mesma empresa
- [ ] 7.2 **S** Confirmar isolamento multi-tenant: empresa A não vê nem altera pipeline, perfil, feedback ou notificações da empresa B (tentativas diretas à API)
- [ ] 7.3 **S** Confirmar custos: `ai_usage_events` do mês não subiu por causa das regras (excluídos não chamam a IA); métricas Railway sem regime novo de RAM
- [ ] 7.4 **S** Atualizar o ticket Jira TRNSF-1557 com o resumo do que ficou feito
- [ ] 7.5 **S** Fundir os delta-specs na spec principal e mover esta pasta para `openspec/changes/archive/2026-09-gap-closure/`

---

## Perguntas em aberto (decidir antes ou durante a fase indicada)

- **Fase 2** — Lista inicial de "certificações comuns" a sugerir no formulário: alvará de construção (classes), ISO 9001/14001/45001, certificação de segurança privada, licença de pirotecnia, HACCP, … — confirmar 8–10 com o Nuno. *(Quem: Nuno · quando: antes da 2.7)*
- **Fase 3** — Distrito dos anúncios: nem todos trazem local; aceitar "desconhecido" como faceta visível ou esconder? Proposta: visível como "Sem localização (N)". *(Quem: Nuno · durante 3.4)*
- **Fase 4** — Enviar o digest também aos utilizadores em trial? Proposta: sim (é grátis para todos). *(Quem: Nuno · antes da 4.3)*
- **Fase 5** — Guardar o comentário livre do 👎 no prompt ou só o motivo? Proposta: só o motivo + título (evita injeção de texto arbitrário no prompt). *(Quem: decisão técnica, registada aqui · antes da 5.2)*
