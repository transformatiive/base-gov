# BASE.gov Robot

Robot de pesquisa e arquivo de contratos públicos do Portal BASE (https://www.base.gov.pt).

A partir de um termo de pesquisa, percorre a listagem paginada de contratos do BASE (via a API JSON do portal — sem browser na v1), extrai o detalhe de cada contrato, descarrega os documentos anexos e guarda tudo em PostgreSQL (documentos em `BYTEA`). Inclui UI web simples e API REST para integrações externas.

Especificação completa: [SPEC.md](./SPEC.md).

## Funcionalidades v2 — radar comercial

- **Perfis de pesquisa** multi-termo (ex.: "pirotecnia, fogo de artifício") com deduplicação automática, execução manual/diária/semanal e contagem de novidades por run.
- **Anúncios DR** (concursos abertos) via `search_anuncios`/`detail_anuncios`, com prazo de propostas.
- **Radar de renovações**: data prevista de fim de cada contrato (celebração + prazo) e data sugerida de contacto (4 meses antes).
- **Oportunidades com scoring** (0-100): concursos abertos + renovações, ponderando valor, urgência e recorrência da entidade.
- **Sazonalidade**: contratos/anúncios por mês do ano (nº e valor).
- **Mapa por distrito**: valor e densidade de contratos (bolhas sobre Portugal).
- **Fichas de entidade**: histórico como adjudicante/adjudicatária, por ano, tipos de procedimento, fornecedores/clientes.
- **Inteligência competitiva**: adjudicatários da área com quota de mercado, valores médios e clientes.
- **Resiliência anti-bloqueio**: o BASE devolve HTTP 999 sob carga; backoff longo (30/60/120s), retoma automática de pesquisas interrompidas (idempotente, até 5 tentativas com cooldown crescente) e `POST /api/searches/:id/retry`.

### Endpoints v2 (mesma autenticação)

- `GET/POST /api/profiles`, `GET /api/profiles/:id`, `POST /api/profiles/:id/run`, `DELETE /api/profiles/:id`
- `GET /api/announcements?profile_id=&open=1`
- `GET /api/insights/opportunities?profile_id=`
- `GET /api/insights/renewals?profile_id=&months=6`
- `GET /api/insights/seasonality?profile_id=`
- `GET /api/insights/map?profile_id=`
- `GET /api/insights/competitors?profile_id=`
- `GET /api/entities?role=contracting|contracted&q=`, `GET /api/entities/:id`

## Arranque rápido (local)

Requisitos: Node 20+, PostgreSQL 16.

```bash
npm install
npm run build
DATABASE_URL=postgres://basegov:basegov@localhost:5432/basegov npm start
# abre http://localhost:3000 — login: admin / admin123
```

O schema é criado automaticamente no arranque e o utilizador `admin`/`admin123` é seeded.

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgres://basegov:basegov@localhost:5432/basegov` | Ligação Postgres |
| `PORT` | `3000` | Porta HTTP |
| `SESSION_SECRET` | (dev) | Segredo de assinatura do cookie de sessão |
| `APP_API_KEY` | vazio (desligado) | Chave para integrações externas (`X-API-Key`) |
| `BASEGOV_API_VERSION` | `91.0` | Parâmetro `version` da API do BASE |
| `SCRAPE_DELAY_MS` | `500` | Pausa entre pedidos ao BASE |
| `MAX_RESULTS_PER_SEARCH` | `5000` | Limite de segurança por pesquisa |

## API (resumo)

Autenticação: cookie de sessão (UI), header `X-API-Key`, ou HTTP Basic.

- `POST /api/auth/login` `{username, password}`
- `GET/POST /api/searches` — histórico / criar pesquisa `{term}`
- `GET /api/searches/:id` — estado e progresso
- `GET /api/searches/:id/results` — resultados paginados
- `GET /api/searches/:id/full` — **integração externa**: detalhe completo + documentos com `download_url`
- `GET /api/searches/:id/export.xlsx` — exportação Excel (folhas Contratos + Documentos)
- `GET /api/contracts/:id` — detalhe (`?raw=1` inclui JSON bruto do BASE)
- `GET /api/documents/:id/content` — binário do documento a partir do Postgres

Exemplo de integração externa:

```bash
curl -H "X-API-Key: $APP_API_KEY" https://<host>/api/searches/1/full
curl -H "X-API-Key: $APP_API_KEY" -OJ https://<host>/api/documents/12/content
```
