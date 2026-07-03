import { config } from '../config.js';

const BASE_URL = 'https://www.base.gov.pt/Base4/pt/resultados/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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

export interface AnnouncementListItem {
  id: number;
  type?: string;                    // "Anúncio de procedimento"
  contractingProcedureType?: string;
  contractingEntity?: string;
  contractDesignation?: string;
  basePrice?: string;
  drPublicationDate?: string;
  proposalDeadline?: string;        // na listagem vem como data DD-MM-YYYY
  [k: string]: unknown;
}

export interface AnnouncementSearchPage {
  total: number;
  items: AnnouncementListItem[];
}

export interface AnnouncementDetail {
  id: number;
  announcementNumber?: string;
  modelType?: string;
  contractType?: string;
  contractDesignation?: string;
  contractingEntities?: EntityRef[];
  basePrice?: string;
  drPublicationDate?: string;
  proposalDeadline?: string;        // no detalhe vem como "17 dias."
  cpvs?: string;
  contractingProcedureUrl?: string;
  reference?: string;
  [k: string]: unknown;
}

/**
 * Interface de acesso ao Portal BASE. v1: HttpBaseGovClient (API JSON direta).
 * Fase 2: PlaywrightBaseGovClient com a mesma interface, se a API mudar.
 */
export interface BaseGovClient {
  search(term: string, page: number, size: number): Promise<SearchPage>;
  getDetail(basegovId: number): Promise<ContractDetail>;
  downloadDocument(documentId: number): Promise<DownloadedDocument>;
  searchAnnouncements(term: string, page: number, size: number): Promise<AnnouncementSearchPage>;
  getAnnouncementDetail(basegovId: number): Promise<AnnouncementDetail>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Erros de rate limiting / anti-bot (o BASE devolve 999 e, em bloqueios de IP, 404). */
function isRateLimit(err: unknown): boolean {
  return /HTTP (999|429|503|404)/.test(String(err));
}

async function withRetry<T>(fn: () => Promise<T>, what: string): Promise<T> {
  const delays = [2000, 4000, 8000];
  const rateLimitDelays = [30_000, 60_000, 120_000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length) {
        const wait = isRateLimit(err) ? rateLimitDelays[attempt] : delays[attempt];
        console.warn(`[scraper] ${what} falhou (tentativa ${attempt + 1}): ${err}. Retry em ${wait}ms`);
        await sleep(wait);
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

  async searchAnnouncements(term: string, page: number, size: number): Promise<AnnouncementSearchPage> {
    return withRetry(async () => {
      const data = (await this.post({
        type: 'search_anuncios',
        version: config.basegovApiVersion,
        query: `texto=${term}&tipoacto=0&tipomodelo=0&tipocontrato=0&cpv=&numeroanuncio=&emissora=&desdedatapublicacao=&atedatapublicacao=&desdeprecobase=&ateprecobase=`,
        sort: '-drPublicationDate',
        page: String(page),
        size: String(size),
      })) as AnnouncementSearchPage | null;
      if (typeof data?.total !== 'number' || !Array.isArray(data?.items)) {
        throw new Error('Formato inesperado na resposta de pesquisa de anúncios (API mudou?)');
      }
      return data;
    }, `search_anuncios "${term}" page ${page}`);
  }

  async getAnnouncementDetail(basegovId: number): Promise<AnnouncementDetail> {
    return withRetry(async () => {
      const data = (await this.post({
        type: 'detail_anuncios',
        version: config.basegovApiVersion,
        id: String(basegovId),
      })) as AnnouncementDetail;
      if (typeof data?.id !== 'number') {
        throw new Error('Formato inesperado no detalhe de anúncio (API mudou?)');
      }
      return data;
    }, `detail_anuncios ${basegovId}`);
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
