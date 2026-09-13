/** Uma chamada LLM com 60–100 oportunidades é lenta, falha o JSON e o proxy corta. */
export const FIT_AI_BATCH_SIZE = 8;
export const FIT_CACHE_LOOKUP_LIMIT = 100;
export const FIT_AI_REQUEST_LIMIT = 12;

export function chunkFitItems<T>(items: T[], size = FIT_AI_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
