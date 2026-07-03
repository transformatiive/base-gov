import { config } from '../config.js';

const BASE_URL = 'https://www.base.gov.pt/Base4/pt/resultados/';
const USER_AGENT = 'basegov-robot/1.0 (+contratos publicos; uso nao comercial)';

export interface ListItem {
  id: number;
  contractingProcedureType?: string;
  publicationDate?: string;
  signingDate?: string;
  contracting?: string;
  contracted?: string;
  objectBriefDescription?: string;
  initialContractualPrice?: string;
  ccp?: boolean;
  [k: string]: unknown;
}

export interface SearchPage {
  total: number;
  items: ListItem[];
}

export interface EntityRef {
  id?: number;
  nif?: string;
  description?: string;
}

export interface DocumentRef {
  id: number;
  description?: string;
}

export interface ContractDetail {
  id: number;
  description?: string;
  objectBriefDescription?: string;
  contractingProcedureType?: string;
  contractTypes?: string;
  publicationDate?: string;
  signingDate?: string;
  closeDate?: string;
  executionDeadline?: string;
  executionPlace?: string;
  initialContractualPrice?: string;
  totalEffectivePrice?: string;
  cpvs?: string;
  cpvsDesignation?: string;
  contractFundamentationType?: string;
  regime?: string;
  contractingProcedureUrl?: string;
  centralizedProcedure?: boolean;
  ambientCriteria?: boolean;
  ccp?: boolean;
  contracting?: EntityRef[];
  contracted?: EntityRef[];
  contestants?: EntityRef[];
  invitees?: EntityRef[];
  documents?: DocumentRef[];
  [k: string]: unknown;
}

export interface DownloadedDocument {
  content: Buffer;
  contentType: string;
}

/**
 * Interface de acesso ao Portal BASE. v1: HttpBaseGovClient (API JSON direta).
 * Fase 2: PlaywrightBaseGovClient com a mesma interface, se a API mudar.
 */
export interface BaseGovClient {
  search(term: string, page: number, size: number): Promise<SearchPage>;
  getDetail(basegovId: number): Promise<ContractDetail>;
  downloadDocument(documentId: number): Promise<DownloadedDocument>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, what: string): Promise<T> {
  const delays = [2000, 4000, 8000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length) {
        console.warn(`[scraper] ${what} falhou (tentativa ${attempt + 1}): ${err}. Retry em ${delays[attempt]}ms`);
        await sleep(delays[attempt]);
      }
    }
  }
  throw new Error(`${what}: esgotadas as tentativas — ${lastErr}`);
}

export class HttpBaseGovClient implements BaseGovClient {
  private async post(body: Record<string, string>): Promise<unknown> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} do BASE`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta não-JSON do BASE (formato da API pode ter mudado): ${text.slice(0, 200)}`);
    }
  }

  async search(term: string, page: number, size: number): Promise<SearchPage> {
    return withRetry(async () => {
      const data = (await this.post({
        type: 'search_contratos',
        version: config.basegovApiVersion,
        query: `texto=${term}&tipo=0&tipocontrato=0&pais=0&distrito=0&concelho=0`,
        sort: '-publicationDate',
        page: String(page),
        size: String(size),
      })) as SearchPage;
      if (typeof data?.total !== 'number' || !Array.isArray(data?.items)) {
        throw new Error('Formato inesperado na resposta de pesquisa (API mudou?)');
      }
      return data;
    }, `search "${term}" page ${page}`);
  }

  async getDetail(basegovId: number): Promise<ContractDetail> {
    return withRetry(async () => {
      const data = (await this.post({
        type: 'detail_contratos',
        version: config.basegovApiVersion,
        id: String(basegovId),
      })) as ContractDetail;
      if (typeof data?.id !== 'number') {
        throw new Error('Formato inesperado na resposta de detalhe (API mudou?)');
      }
      return data;
    }, `detail ${basegovId}`);
  }

  async downloadDocument(documentId: number): Promise<DownloadedDocument> {
    return withRetry(async () => {
      const res = await fetch(`${BASE_URL}?type=doc_documentos&id=${documentId}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} no download do documento`);
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        content: buf,
        contentType: res.headers.get('content-type') || 'application/octet-stream',
      };
    }, `document ${documentId}`);
  }
}
