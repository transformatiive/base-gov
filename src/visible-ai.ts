/** IDs de modelo (OpenRouter / fornecedor) que não devem aparecer na UI. */
const MODEL_ID_RE =
  /\b(?:anthropic|openai|google|meta-llama|mistralai|cohere)\/[a-z0-9._-]+|\b(?:claude|gpt|o\d|gemini|llama)[-.][a-z0-9._-]*/gi;

export function isAiModelId(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  MODEL_ID_RE.lastIndex = 0;
  const m = MODEL_ID_RE.exec(s);
  return Boolean(m && m[0] === s);
}

export function stripAiModelIds(text: string): string {
  return text
    .replace(MODEL_ID_RE, '')
    .replace(/\s+·\s+/g, ' · ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
