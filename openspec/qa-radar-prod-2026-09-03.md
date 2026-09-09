# Reteste produção — radar + sequência UI — 3 Set 2026 (noite)

Ambiente: `https://basegov-robot-production.up.railway.app/`  
Build: `style.css?v=37`, `app.js?v=60` (`fa5f885`, ficha títulos #81).  
Aceite QA-01 (doc anterior): perfil novo com «reabilitação» tem `n_announcements > 0` em &lt; 2 min.

Contas criadas neste run (não reutilizar as personas da manhã — podiam ter `pending` fantasma):

| Papel | Email | Empresa | NIF | Resultado |
|---|---|---|---|---|
| API / cronómetro | `qa.radar.api.1788474702@baseradar.test` | Reabilita QA API Lda | 584747330 | run `completed` em ~3 s; 547 anúncios / 55 abertos aos **12,9 s** |
| UI / sequência | `qa.radar.ui.1788474702@baseradar.test` | Reabilita Coimbra QA Lda | 584747268 | mesmo match; Hoje com 4 cartões após refresh; trial Pro 7d |

Password: a mesma do **cofre de QA**.

---

## Veredicto

**QA-01 está corrigido em produção.** A recolha inicial cruza o corpus local (não espera pelo BASE.gov). Dois registos independentes com o termo **reabilitação**:

| | API | UI |
|---|---|---|
| `last_run.status` | `completed` | `completed` |
| Duração do run | 22:31:44 → 22:31:47 UTC (~3 s) | 22:35:36 → 22:35:39 UTC (~3 s) |
| `n_announcements` | 547 | 547 |
| Concursos abertos | 55 | 55 |
| Contratos no KPI | 2000 (tecto `LOCAL_MATCH_LIMIT`) | 2000 |
| Primeiro anúncio | Jardim de infância da Maia, 908 850 € | o mesmo |

O Hoje **Grátis** deixa de tratar 403 de score como lista vazia: mostra concursos abertos do perfil («Ver concurso», sem donut). Depois do trial, os mesmos cartões passam a score 100/99 e CTA «Analisar com IA».

O que **ainda falha ou incomoda** no radar está na secção 3. A prova de gating das **cinco personas** (energia, saúde, dois Pro, Business dois lugares) está na **secção 6**.

---

## 1. Cronómetro do radar (API)

Registo `POST /api/auth/register` com `terms: ["reabilitação"]`, plano `free`.

- t = 1,4 s: `last_run = running`, `started_at` preenchido, 0 anúncios (já **não** é o `pending` + `started_at = null` da manhã).
- t = 12,9 s: `completed`, 547 anúncios, 55 abertos. Amostra: Maia, Porto Vivo SRU, Braga, Ourém, Alcoutim — todos com «reabilitação» no objecto.
- `POST /api/profiles/:id/run` com o run já fechado → **201** (já não 409 «já tem um run em curso»).
- `new_contracts` / `new_announcements` do run ficam **0**: o match é contra o corpus já importado; o contador de «novidades» só conta linhas criadas depois de `started_at`. O radar enche na mesma via o join ao perfil.

Gating Grátis (403 `plan_required` + mensagem de PRO): Oportunidades, Concorrentes, Entidades, TED. **200**: contratos (filtrados, total 2000), anúncios abertos (55), pipeline vazio, digest, mapa (22 distritos).

Trial: `POST /api/billing/trial` → Pro `trialing`, 7 dias. Segundo trial → **409** «O período de teste já foi utilizado…». Oportunidades Pro: 100 itens com score. `PUT /api/pipeline/anuncio_aberto/9983` `{status:interessa}` → 200. Análise IA do anúncio 9983: **200**, `go_no_go.recomendacao = condicional`, `fit_atividade.score = 65`, modelo `anthropic/claude-sonnet-5` (cache na segunda chamada). `docs_used = -1` (só anúncio DR, sem caderno).

---

## 2. Sequência UI (browser, produção)

Landing → registo → onboarding → Hoje Grátis → cadeados → concursos / carteira / mapa / sazonalidade / digest → conta (PRF-02/03) → trial Pro → oportunidades → Interessa → ficha → carteira → renovações → viewport 390×844.

### Passa

| ID | O quê | Evidência |
|---|---|---|
| GTM-01..06 | Landing e registo | Eyebrow «Responsável por concursos · obras, energia e saúde»; H1 contratos públicos; planos 0 / 29 / 99 €; ribbon **PARA A EQUIPA**; exemplos reabilitação / LED / dispositivos; sem pirotecnia |
| PRF-01 | Onboarding 4 passos + Saltar | Modal «Passo 1 de 4 — Onde executa?» |
| QA-07 | Greeting | «Boa noite, **Ana**.» — não o email |
| QA-01 / QA-02 | Hoje Grátis com dados | Após a recolha: «Há **4 oportunidades** para agir»; **55** concursos abertos; 77,5 M € em jogo; cartões Maia / Porto / Ourém / Braga |
| GATE-* | Cadeados Grátis | Oportunidades / Renovações / Concorrentes / Entidades → «Funcionalidade do plano PRO» + Ver planos |
| CONCURSOS | Lista DR | 547 anúncios, 55 abertos, objectos de reabilitação |
| PIP-05 vazio | Carteira Grátis | «Nada na carteira…» |
| SAZ | Sazonalidade | Três gráficos; KPIs 2000 / 489,9 M € / 547 / 55 |
| FND-01 | Digest | Datas `03/09/2026`; 55 abertos + 12 renovações 90 d, todos reabilitação. Sem `Wed Jul` |
| PRF-02 | Certificações | Alvará classe 1–5, ISO 9001/14001/45001 no topo |
| PRF-03 | Intervalo inválido | «O valor máximo tem de ser superior ao mínimo» |
| Trial | 7 dias | Banner «Teste Pro — 7 dias»; cadeados saem; Hoje com donuts 100/99 e «Analisar com IA» |
| PIP-01 | Chip Interessa | Linha → Interessa; carteira coluna Interessa (1) Maia 908 850 €, prazo 03/09/2026 |
| Ficha | Título / separadores | H1 com ` — ` (já não tofu ▯). Tabs Análise IA, Enquadramento, Carteira, Cronologia, Formalidades |
| RENOV Pro | Radar 12 meses | Abre (não é parede de upgrade) |
| PIP-03 (parcial) | Submetida → Interessa | O menu **omite** Interessa (não oferece a transição). Não vimos o toast do AC; o gating está no dropdown |
| Mobile | Gaveta + Hoje + ficha | `#nav-toggle` visível a 390 px; Hoje com 4 cartões; ficha empilhada |

### Primeira pintura do Hoje (o que engana)

No instante a seguir ao Saltar (~0–3 s, run ainda `running`), o Hoje mostra **0 € / 0 concursos / «Sem prazos»**, **sem** o aviso que o radar já tem («A primeira recolha deste perfil ainda está a decorrer»). O Hoje **não faz poll**. Quem ficar parado nessa tela replica o sintoma da manhã mesmo com o worker a concluir em 3 s. Um refresh ou ir a Concursos/Digest já mostra os 55.

---

## 3. Furos encontrados

| ID | Grav. | O quê |
|---|---|---|
| QA-09 | P1 | **Hoje não actualiza sozinho** enquanto a recolha inicial corre. Sem banner de «a decorrer». Risco de o cliente achar que o radar está vazio. |
| QA-10 | P2 | KPI de contratos/anúncios **corta em 2000** (`LOCAL_MATCH_LIMIT`). «2000 contratos» não é o universo da actividade. |
| QA-11 | P2 | Títulos BASE ainda trazem **`¿`** (aspas/encoding do portal), ex. `…DA MAIA¿`. Os quadrados vazios do #81 já não aparecem. |
| QA-12 | P2 | Carteira vazia manda para **Oportunidades**, que no Grátis está cadeada. Deveria apontar a Concursos. |
| QA-13 | P2 | Análise IA: compile pode ficar &gt;12 s em «A juntar o resultado…». Quando fecha: `COM RESERVAS`, checklist vazia («Gere a análise…») porque `docs_used = -1`. Fit na ficha pode mostrar **1/100** com texto a dizer que está alinhado com «reabilitação» (API bruta do mesmo anúncio: fit 65). |
| QA-14 | P2 | Navegar para Conta **enquanto o digest gera** pode deixar a vista do digest (o async pisa o `#app`). Erros `Cannot set properties of null (onclick/onchange)` no console. |
| QA-15 | P3 | `last_run.new_* = 0` mesmo com 547 matches — a lista de perfis mostra `+0c +0a`. |
| QA-16 | P3 | Copy «Começar grátis — **7 dias**» no hero / login, mas o registo entra em **Grátis**, trial é opt-in nos planos. |
| — | n/a | Mapa: WebGL falhou no Chrome headless do agente. Não se trata como bug de produção. |

---

## 4. Não exercitado neste run (Ana / reabilitação)

- PIP-06 / PIP-07 (responsável + secção vazia do pipeline no Hoje).
- PIP-08 checklist 3/6 (a IA não devolveu checklist sem caderno).
- PRF-04/05 exclusão geográfica e termo «manutenção».
- Stripe checkout real (`billing_enabled: false` em produção).
- Ficha contrato BASE #11009424 (renovação) — o run da Ana usou anúncio 9983 / 21129/2026.

As **cinco personas** (energia, saúde, dois Pro, Business com dois lugares) passaram a estar na **secção 6**.

---

## 5. Conclusão (radar, Ana)

O bloqueio de lançamento «radar vazio após o registo» **já não se reproduz** se se esperar (ou refrescar) ~15 s. O worker reclama o `profile_run`, faz match local, e o Hoje Grátis lista concursos da actividade.

Para o próximo ciclo de produto, o único P1 de UX é **o Hoje ficar a zeros até haver navegação/refresh**. O resto é polish (tecto 2000, `¿` nos títulos, copy dos 7 dias, digest a pisar a Conta, fit 1/100 vs 65).

---

## 6. Cinco personas — prova de gating por plano (noite, 3 Set)

Ambiente: `https://basegov-robot-production.up.railway.app/`  
Contas **novas** (não reutilizar os emails da manhã nem os da Ana). Password só no **cofre de QA**.  
API em paralelo (5 registos + 5 radares + probes); UI em Chrome headless (`/usr/local/bin/google-chrome`).

| Papel | Email | Empresa | NIF | Plano obtido |
|---|---|---|---|---|
| Rui Lopes | `qa.rui.lopes.1788477443012@baseradar.test` | Luz Pública Setúbal QA | 515443012 | Grátis (registo) |
| Marta Silva | `qa.marta.silva.1788477443012@baseradar.test` | MediSul Dispositivos QA | 515443025 | Grátis (registo) |
| João Martins | `qa.joao.martins.1788477443012@baseradar.test` | Obras do Mondego QA | 515443038 | Pro trial 7d (`POST /api/billing/trial`) |
| Sofia Nunes | `qa.sofia.nunes.1788477443012@baseradar.test` | Lumicidade QA | 515443051 | Pro trial 7d (independente) |
| Pedro Almeida | `qa.pedro.almeida.1788477443012@baseradar.test` | Mediberia QA | 515443064 | Business (`POST /api/admin/companies/16/subscription`) |
| Carla Mendes | `qa.carla.mendes.1788477443012@baseradar.test` | Mediberia QA (2.º lugar) | — | Business (convite aceite) |

### 6.1 Matriz — radar + cada capability

**Radar** = primeiro instante com `n_announcements > 0` e `last_run.status = completed` (limite aceite: &lt; 2 min). Os cinco correram **ao mesmo tempo**, daí 30–80 s em vez dos ~13 s da Ana sozinha.

| Persona | Plano | Radar (n_ann / abertos / s) | Hoje / concursos / carteira / mapa / digest / greeting | Oportunidades `score_fit` | Renovações | Concorrentes | Entidades | TED | Análise IA | Export Excel | Filtro valor | Convite lugar | UI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rui | **Grátis** | 52 / **3** / **79,7 s** `completed` | **Pass** 200; greeting «Rui»; digest 3 abertos; mapa 24 distritos; pipeline Interessa 10197 | **Pass** 403 `plan_required` | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 `plan_required` | **Pass** 403 | **Pass** 403 `seat_limit` (máx. 1) | Cadeados nas 4 entradas Pro; clique Oportunidades → «Funcionalidade do plano PRO»; Hoje com 2 cartões solar/fotovoltaico (sem donut); carteira Interessa (1) |
| Marta | **Grátis** | 241 / **2** / **29,9 s** `completed` | **Pass** 200; greeting «Marta»; digest 2 abertos | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 | **Pass** 403 `seat_limit` | Hoje 1 cartão (Centro de Diagnóstico Olivais); 4 cadeados |
| João | **Pro** (trial) | 708 / **71** / **76 s** `completed` | **Pass** (já no Grátis); greeting «João» | **Pass** 200, 100 itens, score 100 (granito Póvoa) | **Pass** 200, 500 itens | **Pass** 200, 50 | **Pass** 200, total 1156 | **Pass** 200, 30 itens | **Pass** 200 no anúncio **9983** (Maia): `go_no_go=condicional`, fit 70, 26 s, `claude-sonnet-5` | **Pass** 200, 7594 B xlsx | **Pass** 200 | **Pass** 201 o 2.º lugar; 3.º → **403** `seat_limit` «PRO permite 2» | Sessão limpa: nav **sem** cadeados; Hoje donuts 100/99 + «Analisar com IA»; Oportunidades 100 linhas; ficha 10223 com tab IA («A juntar o resultado…»); Conta **2 / 40** IA e 1/2 lugares. 2.º trial → **409** |
| Sofia | **Pro** (trial) | 59 / **3** / **48,6 s** `completed` | **Pass**; greeting «Sofia» | **Pass** 200, 100 itens, score 89 (solar Porto) | **Pass** 200 | **Pass** 200 | **Pass** 200 | **Pass** 200, 30 itens | **Pass** não-403 (probe id=1); Interessa 10197 → 200 | **Pass** 200 xlsx | **Pass** 200 | **Pass** 201 | Caps: `ai_cap=40`, seats máx. **2**. 2.º trial → **409** |
| Pedro + Carla | **Business** | 241 / **2** / **72,9 s** `completed` | **Pass**; greeting «Pedro» / «Carla» | **Pass** 200, 100 itens, score 92 (Olivais) | **Pass** 200 | **Pass** 200 | **Pass** 200, total 451 | **Pass** 200, **6** itens | **Pass** não-403 | **Pass** 200 xlsx | **Pass** 200 | **Pass** 201 Carla; ela aceita 201 | Carla `plan=business`, mesma empresa id **16**; teto IA **1 / 250**; equipa **2/10**; nav desbloqueada; Interessa do Pedro (10177, 129 981 €) **visível** na carteira da Carla |

Antes do trial/promote, **João, Sofia e Pedro** ainda Grátis: os mesmos 403 `plan_required` / `seat_limit` que Rui e Marta. O desbloqueio é o plano, não o sector.

`/api/auth/me.first_name` e o cumprimento da UI usam o primeiro nome em todos (QA-07 continua corrigido).

### 6.2 Pass / fail contra a copy da landing e dos cartões

Fonte da copy: `public/landing.html` #preco e `PLAN_FEATURES` em `public/app.js`. Fonte de verdade do gating: HTTP 200 vs 403 `plan_required` (e `seat_limit`).

| Promessa | Veredicto | Evidência |
|---|---|---|
| Grátis: concursos abertos na área, mapa, sazonalidade, resumo, carteira, 1 utilizador | **Pass** | 5/5 radares com abertos &gt; 0 em &lt; 2 min; digest/mapa/pipeline 200; convite 403 `seat_limit` |
| Grátis **não** tem pontuação, renovações, IA, concorrentes/entidades/TED | **Pass** | 403 `plan_required` nas 5 contas enquanto free; UI com cadeado + painel «plano PRO» |
| Grátis: filtro avançado de valor | **Pass** (bloqueado) | `value_min` → 403 `plan_required` (`filtros_avancados`) |
| Pro: pontuação, renovações, TED, concorrentes, entidades, Excel, 2 utilizadores | **Pass** | João e Sofia 200 em todos; Excel PK zip; 2.º convite 201; 3.º 403 máx. 2 |
| Pro: análise IA num anúncio real | **Pass** | João, anúncio 9983, 200, recomendação condicional |
| Pro: trial 7 dias uma vez, sem cartão | **Pass** | Dois trials independentes 200; repetir → 409 `trial_unavailable` |
| Pro **≠** Business: teto IA 40 vs 250; lugares 2 vs 10 | **Pass** | `/api/plans` e `/api/me/capabilities`; UI Conta 2/40 vs 1/250 e 1/2 vs 2/10 |
| Business: convite + pipeline partilhado | **Pass** | Carla aceita; vê Interessa 10177 do Pedro; `seats.used=2` |
| Landing «Começar grátis — **7 dias**» | **Fail de copy** (QA-16) | O registo entra em Grátis; o trial é opt-in nos planos |
| Business: «ligação à gestão comercial / sistemas internos» | **Fail / vapor** | Capability `api_integration` na lista Business; **não há** endpoint extra, chaves de API de cliente, nem CRM |
| Business: «exportação avançada» | **Fail / vapor** | Capability `export_avancada` listada; o Excel é o mesmo do Pro (`export_excel`, ~7,6 kB) |
| Business: «apoio prioritário» | **Não testável** | Só copy |
| Stripe / pagar 29 € ou 99 € | **Não exercitável** | `GET /api/plans` → `billing_enabled: false`. Business deste run foi **promote admin**, não Checkout |
| «Dispositivos médicos / saúde» = concursos de dispositivos | **Fail de match** (QA-18) | Marta/Pedro: abertos são **empreitada hospitalar PRR** e **PPP hospital**, não fornecimento de dispositivos |

O mapa de features em `src/config.ts` marca `seats: 'business'`, mas o limite real é `seatLimit` (Pro=2). A UI usa `seats.max`, por isso o Pro **consegue** convidar — alinhado com a landing («2 utilizadores»), desalinhado com o nome da capability.

### 6.3 Notas de UI e bugs deste bloco

| ID | Grav. | O quê |
|---|---|---|
| QA-17 | P2 | `loadCaps()` reutiliza `window._caps` e o `#/login` só anula `_me`. Trocar de conta **na mesma SPA** (sem reload) herda cadeados/plano do utilizador anterior. João a seguir ao Rui ficou com nav cadeada e Hoje no modo Grátis (sem donut), apesar do pill PRO. **Sessão nova / reload** desbloqueia. Logout também não limpa `_caps`. |
| QA-18 | P2 | Termos «dispositivos médicos» + «saúde» enchem o radar com obras hospitalares. O Grátis cumpre «concursos da actividade» no sentido **lexical**, não no sentido GTM do sector. Energia/LED caiu em solar/fotovoltaico (aceitável). Obras/reabilitação continua o melhor match (Maia, Porto Vivo, Ourém). |
| QA-19 | P2 | Cartão Business promete integração e exportação avançada que o produto **não entrega** além do Pro. |
| QA-13 | P2 | Ficha IA do João (10223) às 10 s ainda em «A juntar o resultado…». A API do 9983 já tinha fechado em 26 s. |
| QA-11 | P2 | Título Maia continua com `¿` residual. |
| — | n/a | KPI de contratos **já não corta em 2000** neste run (Rui 5777, João 3711 na UI). QA-10 pode estar atenuado. |

### 6.4 Veredicto deste bloco

**O gating de subscrição faz o que a API promete.** Grátis vigia e tranca Pro; Pro trial desbloqueia score/IA/TED/Excel/2 lugares; Business sobe teto IA e lugares e parteilha a carteira. Os furos que restam são **copy vs produto** (7 dias no hero, features Business vapor, match «dispositivos médicos») e o **cache de capabilities no login** (QA-17).
