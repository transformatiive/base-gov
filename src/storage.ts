import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Armazenamento dos binários dos documentos (peças do procedimento).
 *
 * Historicamente os PDFs viviam em `documents.content` (BYTEA), o que fazia
 * deles ~47% do tamanho da base de dados — com impacto directo no disco, na
 * memória do Postgres e nos backups. Passam a viver num volume de disco.
 *
 * A transição é tolerante a falhas e sem downtime:
 *  - escrita: tenta o volume; se não houver volume, cai para a coluna BYTEA;
 *  - leitura: tenta o volume; se não existir lá, cai para a coluna BYTEA.
 *
 * Assim, código novo e dados antigos coexistem enquanto a migração decorre.
 */

const DOCS_DIR = process.env.DOCS_DIR || '/data/docs';

let ready: boolean | null = null;   // null = ainda não testado

/** Caminho do ficheiro de um documento, repartido por pastas para não juntar milhares num só directório. */
function filePath(id: number): string {
  return path.join(DOCS_DIR, String(id % 1000), `${id}.bin`);
}

/** Verifica (uma vez) se o volume existe e é gravável. */
export async function storageEnabled(): Promise<boolean> {
  if (ready !== null) return ready;
  try {
    await fs.mkdir(DOCS_DIR, { recursive: true });
    await fs.access(DOCS_DIR);
    ready = true;
  } catch {
    console.warn(`[storage] volume indisponível em ${DOCS_DIR} — os documentos continuam na base de dados`);
    ready = false;
  }
  return ready;
}

/** Grava o binário no volume. Devolve false se não houver volume (o chamador guarda na BD). */
export async function putDocument(id: number, buf: Buffer): Promise<boolean> {
  if (!(await storageEnabled())) return false;
  const target = filePath(id);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    // Escrita atómica: grava para temporário e só depois renomeia, para nunca
    // deixar um ficheiro meio-escrito visível a uma leitura concorrente.
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, target);
    return true;
  } catch (err) {
    console.error(`[storage] falha a gravar documento ${id}:`, String(err).slice(0, 200));
    return false;
  }
}

/** Lê o binário do volume. Devolve null se não estiver lá (o chamador tenta a BD). */
export async function getDocument(id: number): Promise<Buffer | null> {
  if (!(await storageEnabled())) return null;
  try {
    return await fs.readFile(filePath(id));
  } catch {
    return null;
  }
}

/** Remove o binário do volume (usado quando um documento é apagado). */
export async function deleteDocument(id: number): Promise<void> {
  if (!(await storageEnabled())) return;
  try {
    await fs.unlink(filePath(id));
  } catch { /* já não existe */ }
}

/** Espaço ocupado pelos documentos no volume (bytes) e número de ficheiros. */
export async function storageUsage(): Promise<{ files: number; bytes: number; dir: string; enabled: boolean }> {
  if (!(await storageEnabled())) return { files: 0, bytes: 0, dir: DOCS_DIR, enabled: false };
  let files = 0, bytes = 0;
  try {
    for (const bucket of await fs.readdir(DOCS_DIR)) {
      const dir = path.join(DOCS_DIR, bucket);
      let entries: string[];
      try { entries = await fs.readdir(dir); } catch { continue; }
      for (const name of entries) {
        if (name.endsWith('.tmp')) continue;
        try { const st = await fs.stat(path.join(dir, name)); files++; bytes += st.size; } catch { /* corrida */ }
      }
    }
  } catch { /* directório vazio */ }
  return { files, bytes, dir: DOCS_DIR, enabled: true };
}
