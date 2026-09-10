/** Dossier .docx gerado, em memória, para o GET no Safari (Content-Disposition). */

export interface CachedDossier {
  buf: Buffer;
  fileName: string;
  exp: number;
}

const TTL_MS = 30 * 60 * 1000;
const byUserAnn = new Map<string, CachedDossier>();

function key(userId: number, announcementId: number): string {
  return `${userId}:${announcementId}`;
}

export function rememberDossier(userId: number, announcementId: number, buf: Buffer, fileName: string): void {
  byUserAnn.set(key(userId, announcementId), { buf, fileName, exp: Date.now() + TTL_MS });
}

export function recallDossier(userId: number, announcementId: number): CachedDossier | null {
  const k = key(userId, announcementId);
  const hit = byUserAnn.get(k);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    byUserAnn.delete(k);
    return null;
  }
  return hit;
}

export function dossierFileName(announcementId: number): string {
  return `dossier-resposta-${announcementId}.docx`;
}
