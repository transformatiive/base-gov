/** Prompt caching (Anthropic via OpenRouter): cache_control no prefixo estável. */

export type Part = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
export type Content = string | Part[];

export const cached = (text: string): Part => ({ type: 'text', text, cache_control: { type: 'ephemeral' } });
export const plain = (text: string): Part => ({ type: 'text', text });

export function asParts(content: Content, cache: boolean): Part[] {
  if (Array.isArray(content)) return content.filter((p) => Boolean(p?.text));
  const t = String(content ?? '');
  if (!t) return [];
  return [cache ? cached(t) : plain(t)];
}

/** Documento / checklist estável em cache; a cauda (schema, texto único) fora. */
export function userWithCachedPrefix(stable: string, varying: string): Part[] {
  const out: Part[] = [];
  if (stable.trim()) out.push(cached(stable));
  if (varying.trim()) out.push(plain(varying));
  return out.length ? out : [plain('')];
}

export function buildChatBody(opts: {
  model: string;
  system: Content;
  user: Content;
  maxTokens: number;
  sessionId?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: [
      { role: 'system', content: asParts(opts.system, true) },
      { role: 'user', content: asParts(opts.user, false) },
    ],
  };
  if (opts.sessionId) body.session_id = opts.sessionId;
  return body;
}
