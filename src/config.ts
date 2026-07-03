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
};
