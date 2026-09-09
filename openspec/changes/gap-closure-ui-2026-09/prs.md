# Fatias mergeáveis

Cada PR é auto-mergeável e útil sozinho. Base: `main`. Deploy: Railway em `https://basegov-robot-production.up.railway.app/` após merge.

| PR | Branch | Conteúdo | AC em `ui-acceptance.md` |
|---|---|---|---|
| 1 | `cursor/gtm-landing-construtor-3855` | `SPEC.md` (documento único) + landing + OFERTA + README + copy de registo/perfil | GTM-01 … GTM-06 |
| 2 | `cursor/gap-foundations-3855` | Migrações, capacidades, `fmtDatePT`, poller opendata 60 s, default `daily` no registo | FND-01, FND-02 |
| 3 | `cursor/gap-pipeline-3855` | Pipeline (API + chips + vista `#/pipeline` + Hoje) | PIP-01 … PIP-12 |
| 4 | `cursor/gap-company-profile-3855` | Perfil empresa, `fit-rules`, onboarding 4 passos, motivos “Regra:” | PRF-01 … PRF-08 |
| 5 | `cursor/gap-discovery-3855` | Filtros facetados, URL, cadeado Pro | DIS-01 … DIS-05 |
| 6 | `cursor/gap-notifications-3855` | Digest automático, lembretes, preferências, opt-out | NTF-01 … NTF-08, ADM-01 |
| 7 | `cursor/gap-ai-feedback-3855` | 👍/👎, formalidades, frescura | FBK-01 … FBK-05, FOR-01, FRS-01 |

Convenções (iguais à Fable): TypeScript estrito, sem dependências novas, UI e comentários em português europeu, migrações `IF NOT EXISTS` em `src/db.ts`, `?v=` de `app.js`/`style.css` incrementado quando a SPA muda, `npm test` e `npm run typecheck` verdes.
