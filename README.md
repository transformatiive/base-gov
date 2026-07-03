# BASE.gov Robot

Robot de pesquisa e arquivo de contratos públicos do Portal BASE (https://www.base.gov.pt).

A partir de um termo de pesquisa, percorre a listagem paginada de contratos do BASE (via a API JSON do portal — sem browser na v1), extrai o detalhe de cada contrato, descarrega os documentos anexos e guarda tudo em PostgreSQL (documentos em `BYTEA`). Inclui UI web simples e API REST para integrações externas.

Especificação completa: [SPEC.md](./SPEC.md).

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
