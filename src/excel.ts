import ExcelJS from 'exceljs';
import { pool } from './db.js';

export async function buildSearchWorkbook(searchId: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const contractsSheet = wb.addWorksheet('Contratos');
  contractsSheet.columns = [
    { header: 'ID BASE', key: 'basegov_id', width: 12 },
    { header: 'Objeto', key: 'object', width: 60 },
    { header: 'Descrição', key: 'description', width: 50 },
    { header: 'Adjudicante(s)', key: 'contracting', width: 40 },
    { header: 'Adjudicatário(s)', key: 'contracted', width: 40 },
    { header: 'Tipo procedimento', key: 'procedure', width: 25 },
    { header: 'Tipo contrato', key: 'ctype', width: 25 },
    { header: 'Preço contratual', key: 'price', width: 16 },
    { header: 'Preço efetivo', key: 'effective', width: 16 },
    { header: 'Data publicação', key: 'pub', width: 14 },
    { header: 'Data celebração', key: 'sign', width: 14 },
    { header: 'Prazo execução', key: 'deadline', width: 14 },
    { header: 'Local execução', key: 'place', width: 30 },
    { header: 'CPV', key: 'cpv', width: 16 },
    { header: 'Designação CPV', key: 'cpvname', width: 35 },
    { header: 'URL procedimento', key: 'purl', width: 40 },
    { header: 'Nº documentos', key: 'ndocs', width: 12 },
    { header: 'Link BASE', key: 'link', width: 55 },
  ];
  contractsSheet.getRow(1).font = { bold: true };

  const { rows: contracts } = await pool.query(
    `SELECT c.*,
       (SELECT string_agg(e.name || CASE WHEN e.nif <> '' THEN ' (' || e.nif || ')' ELSE '' END, '; ')
          FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
         WHERE ce.contract_id = c.id AND ce.role = 'contracting') AS contracting_names,
       (SELECT string_agg(e.name || CASE WHEN e.nif <> '' THEN ' (' || e.nif || ')' ELSE '' END, '; ')
          FROM contract_entities ce JOIN entities e ON e.id = ce.entity_id
         WHERE ce.contract_id = c.id AND ce.role = 'contracted') AS contracted_names,
       (SELECT count(*) FROM documents d WHERE d.contract_id = c.id) AS n_docs
     FROM search_results sr JOIN contracts c ON c.id = sr.contract_id
     WHERE sr.search_id = $1 ORDER BY sr.position`,
    [searchId]
  );

  for (const c of contracts) {
    contractsSheet.addRow({
      basegov_id: Number(c.basegov_id),
      object: c.object_brief_description,
      description: c.description,
      contracting: c.contracting_names,
      contracted: c.contracted_names,
      procedure: c.contracting_procedure_type,
      ctype: c.contract_types,
      price: c.initial_contractual_price ? Number(c.initial_contractual_price) : null,
      effective: c.total_effective_price ? Number(c.total_effective_price) : null,
      pub: c.publication_date,
      sign: c.signing_date,
      deadline: c.execution_deadline,
      place: c.execution_place,
      cpv: c.cpvs,
      cpvname: c.cpvs_designation,
      purl: c.contracting_procedure_url,
      ndocs: Number(c.n_docs),
      link: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${c.basegov_id}`,
    });
  }

  const docsSheet = wb.addWorksheet('Documentos');
  docsSheet.columns = [
    { header: 'Contrato (ID BASE)', key: 'contract', width: 18 },
    { header: 'Ficheiro', key: 'name', width: 50 },
    { header: 'Content-Type', key: 'ctype', width: 25 },
    { header: 'Tamanho (bytes)', key: 'size', width: 16 },
    { header: 'Download OK', key: 'ok', width: 12 },
    { header: 'URL API', key: 'url', width: 40 },
  ];
  docsSheet.getRow(1).font = { bold: true };

  const { rows: docs } = await pool.query(
    `SELECT d.id, d.file_name, d.content_type, d.size_bytes, d.download_ok, c.basegov_id
     FROM documents d
     JOIN contracts c ON c.id = d.contract_id
     JOIN search_results sr ON sr.contract_id = c.id
     WHERE sr.search_id = $1 ORDER BY sr.position`,
    [searchId]
  );
  for (const d of docs) {
    docsSheet.addRow({
      contract: Number(d.basegov_id),
      name: d.file_name,
      ctype: d.content_type,
      size: d.size_bytes ? Number(d.size_bytes) : null,
      ok: d.download_ok ? 'sim' : 'não',
      url: `/api/documents/${d.id}/content`,
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
