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
| `OPENROUTER_API_KEY` | vazio | Chave OpenRouter (análises de IA) |
| `IVA_RATE` | `0.23` | Taxa de IVA aplicada aos preços dos planos |
| `AI_SOFT_CAP_ENABLED` | `false` | Teto de IA em modo aviso (não bloqueia) |

### Pagamentos (Stripe) e faturação (Moloni)

Todas as chaves vivem em variáveis de ambiente — nunca em código. Na Railway: **Variables** do serviço da app (não no repositório).

| Variável | Descrição |
|---|---|
| `STRIPE_SECRET_KEY` | Restricted key Stripe (`rk_test_…` / `rk_live_…`). Fallback `sk_test_…` / `sk_live_…`. Nunca commitar. |
| `STRIPE_PUBLISHABLE_KEY` | Chave publicável (`pk_test_…` / `pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Segredo de assinatura do webhook (`whsec_…`) |
| `STRIPE_PRICE_PRO` | Price ID da subscrição mensal Pro (recorrente, EUR) — `price_…` de teste ou live, nunca hardcoded |
| `STRIPE_PRICE_BUSINESS` | Price ID da subscrição mensal Business (recorrente, EUR) |
| `APP_URL` | URL público da app (success/cancel do Checkout e endpoint do webhook). Sem barra final. |
| `APP_BASE_URL` | Fallback legado de `APP_URL` (instalações já configuradas) |
| `MOLONI_CLIENT_ID` / `MOLONI_CLIENT_SECRET` | Credenciais da API Moloni |
| `MOLONI_USERNAME` / `MOLONI_PASSWORD` | Utilizador Moloni |
| `MOLONI_COMPANY_ID` | ID da empresa no Moloni |
| `MOLONI_DOCUMENT_SET_ID` | Série de faturas |
| `MOLONI_TAX_ID` | ID do IVA a aplicar na linha |
| `MOLONI_FINALIZE` | `true` finaliza a fatura (comunica à AT); `false` (default) cria rascunho |

Restricted key (recomendado) — permissões mínimas: Checkout Sessions (write), Customers (write), Subscriptions (read), Invoices (read), Prices (read), Products (read). Webhook Endpoints (write) só se usar o botão admin de provisionamento em modo teste.

Notas:
- **API**: Stripe `2026-07-29.dahlia` via SDK oficial `stripe` (Node). Cliente instanciado com `new Stripe(key)` — sem chave global.
- **Planos**: Grátis 0€ (sem Checkout) / Pro 29€ / Business 99€, mensal, EUR, Portugal. Price IDs só por env.
- **Modelo de cobrança**: cartão → Checkout `mode=subscription`; MB WAY / Multibanco / transferência → `mode=payment` pontual de 1 mês. Métodos dinâmicos do Dashboard — o código **não** envia `payment_method_types`.
- **Stripe Tax**: `automatic_tax` está **desligado** (não há registo de Stripe Tax no projecto). Preços Stripe com IVA incluído; a fatura Moloni usa o valor sem IVA + IVA.
- **Não é Connect**: produto SaaS de subscrição, não marketplace.
- Configure o webhook para `APP_URL/api/billing/webhook` (API version `2026-07-29.dahlia`) com: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Teste (Stripe test mode)**: use `rk_test_…` / `pk_test_…`, crie produtos/preços mensais no Dashboard de teste (Pro 29€+IVA, Business 99€+IVA, EUR), copie os `price_…` para `STRIPE_PRICE_*`, rode `stripe listen --forward-to localhost:3000/api/billing/webhook` e pague com o cartão de teste `4242 4242 4242 4242`. O helper admin "Criar produtos e preços de TESTE" recusa chaves live.

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
