export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://basegov:basegov@localhost:5432/basegov',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  appApiKey: process.env.APP_API_KEY || '',
  basegovApiVersion: process.env.BASEGOV_API_VERSION || '91.0',
  scrapeDelayMs: parseInt(process.env.SCRAPE_DELAY_MS || '500', 10),
  scrapeConcurrency: parseInt(process.env.SCRAPE_CONCURRENCY || '3', 10),
  maxResultsPerSearch: parseInt(process.env.MAX_RESULTS_PER_SEARCH || '5000', 10),
  pageSize: parseInt(process.env.BASEGOV_PAGE_SIZE || '50', 10),
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  aiModelDeep: process.env.AI_MODEL_DEEP || 'anthropic/claude-sonnet-5',
  aiModelFast: process.env.AI_MODEL_FAST || 'anthropic/claude-haiku-4.5',

  // Subscrição / trial
  trialDays: parseInt(process.env.TRIAL_DAYS || '7', 10),
  planPriceCents: parseInt(process.env.PLAN_PRICE_CENTS || '2900', 10),  // 29,00 € (sem IVA) — plano Pro
  planName: process.env.PLAN_NAME || 'BaseRadar',
  appBaseUrl: process.env.APP_BASE_URL || '',   // ex.: https://basegov-robot-production.up.railway.app
  supportEmail: process.env.SUPPORT_EMAIL || '',  // destino dos pedidos de ajuda (envio a implementar)

  // Planos de subscrição (free | pro | business). Fonte de verdade do gating.
  // capability → plano mínimo; seats/tetos/preços por plano; soft cap de IA.
  plans: {
    features: {
      // free
      concursos: 'free', digest: 'free', mapa: 'free', sazonalidade: 'free',
      // pro
      score_fit: 'pro', matriz: 'pro', renovacoes: 'pro', ted: 'pro',
      analise_ia: 'pro', concorrentes: 'pro', entidades: 'pro', export_excel: 'pro',
      // business
      seats: 'business', export_avancada: 'business', ia_elevada: 'business', api_integration: 'business',
    } as Record<string, 'free' | 'pro' | 'business'>,
    seats: { free: 1, pro: 2, business: 10 } as Record<string, number>,
    aiCap: { free: 0, pro: 40, business: 250 } as Record<string, number>,   // análises/mês (teto; ver flag)
    priceCents: { free: 0, pro: 2900, business: 9900 } as Record<string, number>,  // sem IVA
    order: ['free', 'pro', 'business'] as const,
    // Soft cap de IA: quando true, AVISA (não bloqueia). Desligado por defeito.
    aiSoftCapEnabled: (process.env.AI_SOFT_CAP_ENABLED || 'false').toLowerCase() === 'true',
  },

  // Taxa de IVA aplicada aos preços "sem IVA" dos planos (para cobrança e fatura).
  ivaRate: parseFloat(process.env.IVA_RATE || '0.23'),

  // Stripe (pagamentos: cartão em subscrição; MB WAY / Multibanco / transferência
  // em pagamento pontual). Chaves e price IDs vêm de variáveis de ambiente.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // Price IDs de subscrição mensal (cartão) — criados no dashboard Stripe.
    pricePro: process.env.STRIPE_PRICE_PRO || '',
    priceBusiness: process.env.STRIPE_PRICE_BUSINESS || '',
    // Métodos pontuais (payment mode) usam price_data inline; os métodos são os
    // ativados no dashboard Stripe (cartão, MB WAY, Multibanco, transferência).
  },

  // Moloni (faturação certificada PT). Emite fatura a cada pagamento confirmado.
  // Tudo por variáveis de ambiente — nenhuma credencial em código.
  moloni: {
    clientId: process.env.MOLONI_CLIENT_ID || '',
    clientSecret: process.env.MOLONI_CLIENT_SECRET || '',
    username: process.env.MOLONI_USERNAME || '',
    password: process.env.MOLONI_PASSWORD || '',
    companyId: process.env.MOLONI_COMPANY_ID || '',
    documentSetId: process.env.MOLONI_DOCUMENT_SET_ID || '',   // série de faturas (ex.: IVCX)
    taxId: process.env.MOLONI_TAX_ID || '',                    // id do IVA no Moloni (para a linha)
    // Finalizar a fatura (status=1, comunicada à AT) ou criar rascunho (status=0).
    // Por segurança, por omissão fica em rascunho até confirmação.
    finalize: (process.env.MOLONI_FINALIZE || 'false').toLowerCase() === 'true',
  },
};
