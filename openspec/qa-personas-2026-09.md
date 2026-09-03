# QA por persona, plano e sector — 3 Set 2026

> **Reteste (noite, 3 Set):** QA-01/QA-02 **passam** em produção com um perfil novo «reabilitação» — run `completed` em ~3 s, 547 anúncios / 55 abertos, Hoje Grátis com 4 cartões após refresh. Relatório: [`qa-radar-prod-2026-09-03.md`](./qa-radar-prod-2026-09-03.md). Este ficheiro fica como o run da **manhã** (ainda descreve a falha).

Ambiente: `https://basegov-robot-production.up.railway.app/`
Corpus: ~2,18 M contratos BASE (2012–2026) e 2 948 anúncios (130 abertos). O dado existe; o problema **neste run da manhã** era a **recolha do perfil** não arrancar.

Contas de teste criadas neste run (visíveis em Admin → Empresas), password só no cofre de QA:

| Persona | Plano | Sector | Empresa |
|---|---|---|---|
| Ana Coelho | Grátis | Obras / reabilitação | Reabilita Coimbra Lda |
| Rui Lopes | Grátis | Energia / iluminação LED | Luz Pública Setúbal Lda |
| Marta Silva | Grátis | Saúde / dispositivos médicos | MediSul Dispositivos Lda |
| João Martins | Pro (admin) | Obras | Obras do Mondego QA |
| Sofia Nunes | Pro (admin) | Energia | Lumicidade QA |
| Pedro Almeida + Carla Mendes | Business (admin) | Saúde | Mediberia QA |
| Inês Trial | Pro trial 7d | Energia | Trial Energia QA |

---

## 1. O que cada plano deve conseguir

### Grátis — vigiar, sem IA
Cenário: o responsável abre o site de manhã, vê concursos abertos na actividade, marca 1–2 na carteira, consulta mapa/sazonalidade, recebe o resumo de segunda.

| Deve funcionar | Deve bloquear (403 + cadeado) |
|---|---|
| Registo, onboarding, perfil da empresa | Oportunidades (score/fit) |
| Concursos abertos filtrados pela actividade | Renovações |
| Carteira (pipeline) | Concorrentes, entidades, TED |
| Mapa e sazonalidade | Filtro de valor / avançados |
| Digest / resumo semanal | Análise IA, dossier, export Excel |
| 1 lugar — convite recusado | |

### Pro — responsável sozinho
Além do Grátis: Hoje com score, renovar a 4 meses, ficha IA, concorrentes, entidades, TED, 2 lugares, trial 7 dias uma vez.

### Business — mesa comercial
Tudo do Pro + 10 lugares, convite/aceitação, pipeline partilhado, teto IA 250 (soft), API/sistemas internos.

---

## 2. Resultado desta execução

173 checks de API + passe UI (login real no browser).

**Gating e conta — passam.**
- Registo começa sempre em Grátis.
- Trial Pro 7 dias activa; segundo trial → 409.
- Admin promove Pro/Business; `/api/auth/me` reflecte o plano.
- Grátis: 4 cadeados na nav (Oportunidades, Renovações, Concorrentes, Entidades); clique em Oportunidades → «Funcionalidade do plano PRO».
- Filtro de valor e convite de lugar → 403 no Grátis.
- PRF-03 (max ≤ min) → 400 com a mensagem certa.
- Business: 2/10 lugares, convite aceite, Carla vê a mesma empresa/plano; teto IA 0/250 visível.
- Billing, preferências de notificação, digest JSON (vazio mas 200).
- TED responde no Pro/Business (6 / 17 / 1 itens) quando o endpoint é chamado sem depender do perfil.
- Landing: ribbon **PARA A EQUIPA**; H1 contratos públicos; exemplos obras + LED + dispositivos.

**Radar da actividade — falha para todos os clientes novos.**

Cada perfil de registo cria um `profile_run` com 6 pesquisas (`contratos`+`anúncios` × 3 termos). Horas depois:

- `last_run.status = pending`, `started_at = null`
- 0 contratos / 0 anúncios / 0 € no KPI do radar
- Hoje: «Sem oportunidades…» / «Sem renovações…» / Em jogo 0 €
- Concursos (com `profile_id`): total 0 — há 130 concursos abertos no corpus, mas o join ao perfil está vazio
- POST `/api/profiles/:id/run` → 409 «já tem um run em curso» (o run fantasma bloqueia um retry)
- UI Pro: «A primeira recolha deste perfil ainda está a decorrer»

O worker (`src/scraper/worker.ts`) deveria reclamar pesquisas `pending`. Não está a reclamar as deste run. Sem isto, **nenhum cliente Grátis/Pro/Business vê a proposta de valor** (concursos da área, renovações, score, IA). A IA e o pipeline sobre peças reais não foram exercitáveis — não havia anúncio no perfil.

**Outros furos encontrados no código / API (não bloqueiam o gating):**

| ID | Gravidade | O quê |
|---|---|---|
| QA-01 | P0 | Recolha inicial presa em `pending`; radar vazio após o registo |
| QA-02 | P0 | Hoje no Grátis chama oportunidades/concorrentes Pro e trata 403 como lista vazia — mesmo com dados, o painel do dia ficaria oco; o Grátis deveria mostrar concursos abertos |
| QA-03 | P1 | `GET /api/contracts` ignora `profile_id` (devolve o corpus inteiro, ~2,18 M) |
| QA-04 | P1 | `GET /api/entities` não filtra por actividade (top 50 global) |
| QA-05 | P2 | TED na página de Concursos, no Grátis, cai no catch e diz «TED indisponível» em vez de upgrade |
| QA-06 | P2 | Perfil admin ainda é «Pirotecnia / fogo de artifício» — contradiz o GTM |
| QA-07 | P3 | Greeting «Bom dia, qa.f-obras…» usa o email em vez do primeiro nome |
| QA-08 | P3 | Landing Grátis promete «concursos abertos na sua área»; hoje isso só existe depois da recolha, que não corre |

IA (go/no-go, dossier, checklist PIP-08) e PIP-02 com item real: **não testado** — depende de QA-01.

---

## 3. Plano de resolução (ordem)

1. **Desbloquear o worker de pesquisas** (QA-01). Ver logs Railway do processo `startWorker`: está vivo? alguma pesquisa `running` órfã a bloquear o `ORDER BY created_at LIMIT 1`? Se o tick morreu, o deploy seguinte volta a arrancar — mas as filas `pending` têm de ser reclamadas. Aceite: um perfil novo com «reabilitação» tem `n_announcements > 0` em < 2 min (o match é contra o corpus já importado, não precisa de ir ao BASE.gov).
2. **Match inicial sem fila lenta** (ainda QA-01). O `createProfileRun` no registo não deve depender de 6 scrapes ao vivo. Cruzar termos/CPV com `contracts`/`announcements` já na BD (como o perfil admin «Equipamentos Informáticos», 41 k contratos). Scrapes ao BASE ficam para *novidades*.
3. **Hoje no Grátis** (QA-02): se `score_fit` 403, preencher «Agir esta semana» com anúncios abertos do perfil (sem score), não com lista vazia.
4. **Correr de novo este guião** com as mesmas 6 personas: concursos > 0, marcar Interessa, IA num caderno, renovação, convite Business a ver o mesmo chip.
5. QA-03/04: filtrar contratos e entidades pelo perfil (ou 400 se `profile_id` em falta na UI).
6. QA-05: 403 TED → painel de upgrade, não «indisponível».
7. QA-06: apagar/arquivar o perfil Pirotecnia da conta admin.
8. QA-07: greeting com `first_name`.

Não misturar o rename da marca neste plano — é decisão de GTM, não de runtime.

---

## 4. Nome e domínio (fora do código)

| Nome | .pt (DNS) | Notas |
|---|---|---|
| **Radar Concursos** | `radarconcursos.pt` **ocupado** | Lista de espera no ar (Cloudflare), produto irmão/concorrente: BASE + IA a cadernos. `radarconcursos.com` ocupado; `radarconcursos.com.br` é site BR de concursos de emprego público. `radarconcursos.eu` NXDOMAIN. |
| **BaseRadar** | `baseradar.pt` NXDOMAIN | Jogo com Portal BASE. `baseradar.com` ocupado. |
| **RadarBASE** | `radarbase.pt` NXDOMAIN | Mais legível em voz. `radarbase.com` parked. |
| **Radar Concurso** (sing.) | `radarconcurso.pt` NXDOMAIN | Evita o .pt ocupado; SEO um pouco pior. |
| Hífen | `radar-concursos.pt` NXDOMAIN | Feio de dizer. |

NXDOMAIN ≠ garantia de registo: confirmar em [dns.pt](https://www.pt.pt/) antes de comprar. Recomendação: **não usar Radar Concursos** enquanto `radarconcursos.pt` for de outro; entre os livres, **RadarBASE** / **BaseRadar.pt** conservam o pun do BASE.
