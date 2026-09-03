# Reteste produção — radar + sequência UI — 3 Set 2026 (noite)

Ambiente: `https://basegov-robot-production.up.railway.app/`  
Build: `style.css?v=37`, `app.js?v=60` (`fa5f885`, ficha títulos #81).  
Aceite QA-01 (doc anterior): perfil novo com «reabilitação» tem `n_announcements > 0` em &lt; 2 min.

Contas criadas neste run (não reutilizar as personas da manhã — podiam ter `pending` fantasma):

| Papel | Email | Empresa | NIF | Resultado |
|---|---|---|---|---|
| API / cronómetro | `qa.radar.api.1788474702@baseradar.test` | Reabilita QA API Lda | 584747330 | run `completed` em ~3 s; 547 anúncios / 55 abertos aos **12,9 s** |
| UI / sequência | `qa.radar.ui.1788474702@baseradar.test` | Reabilita Coimbra QA Lda | 584747268 | mesmo match; Hoje com 4 cartões após refresh; trial Pro 7d |

Password: a mesma do cofre de QA (`QaRadar2026!`).

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

O que **ainda falha ou incomoda** está na secção 3 — não bloqueia o radar, mas a primeira pintura do Hoje continua a parecer o bug antigo se ninguém refrescar.

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

## 4. Não exercitado neste run

- As **6 personas** da manhã (energia, saúde, Business dois browsers, PIP-02 equipa). Só obras/reabilitação + trial Pro.
- PIP-06 / PIP-07 (responsável + secção vazia do pipeline no Hoje).
- PIP-08 checklist 3/6 (a IA não devolveu checklist sem caderno).
- PRF-04/05 exclusão geográfica e termo «manutenção».
- Convite Business, TED na UI Pro, Stripe checkout real.
- Ficha contrato BASE #11009424 (renovação) — este run usou anúncio 9983 / 21129/2026.

---

## 5. Conclusão

O bloqueio de lançamento «radar vazio após o registo» **já não se reproduz** se se esperar (ou refrescar) ~15 s. O worker reclama o `profile_run`, faz match local, e o Hoje Grátis lista concursos da actividade.

Para o próximo ciclo de produto, o único P1 de UX é **o Hoje ficar a zeros até haver navegação/refresh**. O resto é polish (tecto 2000, `¿` nos títulos, copy dos 7 dias, digest a pisar a Conta, fit 1/100 vs 65).
