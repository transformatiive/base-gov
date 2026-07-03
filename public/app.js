/* SPA mínima do BASE.gov Robot — sem dependências. */
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const whoami = document.getElementById('whoami');
let pollTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }));
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    if (location.hash !== '#/login') location.hash = '#/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Erro HTTP ${res.status}`);
  }
  return res.json();
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ---------- Login ---------- */
function renderLogin() {
  topbar.hidden = true;
  app.innerHTML = `
    <div class="card login-box">
      <h2>BASE.gov Robot</h2>
      <p class="muted">Pesquisa e arquivo de contratos públicos do Portal BASE.</p>
      <form id="login-form">
        <label>Utilizador</label>
        <input type="text" name="username" autocomplete="username" required>
        <label>Password</label>
        <input type="password" name="password" autocomplete="current-password" required>
        <div class="error" id="login-error"></div>
        <p><button type="submit">Entrar</button></p>
      </form>
    </div>`;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
      location.hash = '#/';
    } catch (err) {
      document.getElementById('login-error').textContent = err.message === 'unauthorized' ? 'Credenciais inválidas' : err.message;
    }
  };
}

/* ---------- Lista de pesquisas ---------- */
async function renderSearches() {
  const load = async () => {
    const data = await api('/api/searches?size=100');
    const rows = data.items.map((s) => `
      <tr class="clickable" onclick="location.hash='#/searches/${s.id}'">
        <td>${s.id}</td>
        <td><strong>${esc(s.term)}</strong></td>
        <td>${badge(s.status)}</td>
        <td>${s.total_scraped ?? 0}${s.total_reported != null ? ' / ' + s.total_reported : ''}</td>
        <td>${esc(s.created_by_username ?? '')}</td>
        <td>${new Date(s.created_at).toLocaleString('pt-PT')}</td>
      </tr>`).join('');
    const table = document.getElementById('searches-table');
    if (table) table.innerHTML = rows || '<tr><td colspan="6" class="muted">Sem pesquisas ainda. Cria a primeira acima.</td></tr>';
    if (!data.items.some((s) => s.status === 'pending' || s.status === 'running')) stopPolling();
  };

  app.innerHTML = `
    <div class="card">
      <h2>Nova pesquisa</h2>
      <form class="inline" id="new-search-form">
        <input type="text" name="term" placeholder="Termo de pesquisa (objeto do contrato) — ex.: software" required>
        <button type="submit">Pesquisar no BASE</button>
      </form>
      <div class="error" id="search-error"></div>
    </div>
    <div class="card">
      <h2>Pesquisas efetuadas</h2>
      <table>
        <thead><tr><th>#</th><th>Termo</th><th>Estado</th><th>Resultados</th><th>Por</th><th>Data</th></tr></thead>
        <tbody id="searches-table"><tr><td colspan="6" class="muted">A carregar…</td></tr></tbody>
      </table>
    </div>`;

  document.getElementById('new-search-form').onsubmit = async (e) => {
    e.preventDefault();
    const term = new FormData(e.target).get('term');
    try {
      await api('/api/searches', { method: 'POST', body: JSON.stringify({ term }) });
      e.target.reset();
      await load();
      stopPolling();
      pollTimer = setInterval(load, 3000);
    } catch (err) {
      document.getElementById('search-error').textContent = err.message;
    }
  };

  await load();
  stopPolling();
  pollTimer = setInterval(load, 3000);
}

/* ---------- Resultados de uma pesquisa ---------- */
async function renderResults(searchId, page = 0) {
  const search = await api(`/api/searches/${searchId}`);
  const data = await api(`/api/searches/${searchId}/results?page=${page}&size=25`);
  const lastPage = Math.max(0, Math.ceil(data.total / data.size) - 1);

  const rows = data.items.map((c) => `
    <tr class="clickable" onclick="location.hash='#/contracts/${c.id}'">
      <td>${esc(c.object_brief_description || c.description || '')}</td>
      <td>${esc(c.contracting_procedure_type ?? '')}</td>
      <td>${fmtPrice(c.initial_contractual_price)}</td>
      <td>${fmtDate(c.publication_date)}</td>
      <td>${c.n_docs ?? 0}</td>
    </tr>`).join('');

  app.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div>
          <h2 style="margin-bottom:0.2rem">Pesquisa #${search.id}: “${esc(search.term)}” ${badge(search.status)}</h2>
          <div class="muted">${data.total} contratos guardados${search.total_reported != null ? ` (site reporta ${search.total_reported})` : ''}
            · criada em ${new Date(search.created_at).toLocaleString('pt-PT')}
            ${search.error_message ? ` · <span class="error">${esc(search.error_message)}</span>` : ''}</div>
        </div>
        <div>
          <a href="/api/searches/${search.id}/export.xlsx"><button>⬇ Exportar Excel</button></a>
          <button class="btn-secondary" onclick="location.hash='#/'">← Voltar</button>
        </div>
      </div>
      <table>
        <thead><tr><th>Objeto</th><th>Procedimento</th><th>Preço</th><th>Publicação</th><th>Docs</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">Sem resultados (ainda).</td></tr>'}</tbody>
      </table>
      <div class="pager">
        <button ${page <= 0 ? 'disabled' : ''} onclick="location.hash='#/searches/${searchId}?page=${page - 1}'">← Anterior</button>
        <span>Página ${page + 1} de ${lastPage + 1}</span>
        <button ${page >= lastPage ? 'disabled' : ''} onclick="location.hash='#/searches/${searchId}?page=${page + 1}'">Seguinte →</button>
      </div>
    </div>`;

  if (search.status === 'pending' || search.status === 'running') {
    stopPolling();
    pollTimer = setInterval(() => renderResults(searchId, page).catch(() => stopPolling()), 4000);
  }
}

/* ---------- Detalhe de contrato ---------- */
async function renderContract(id) {
  const c = await api(`/api/contracts/${id}`);
  const ent = (role) => (c.entities?.[role] ?? []).map((e) => `${esc(e.name)}${e.nif ? ` (NIF ${esc(e.nif)})` : ''}`).join('<br>') || '—';
  const docs = (c.documents ?? []).map((d) => `
    <tr>
      <td>${d.download_ok ? `<a href="${d.download_url}">${esc(d.file_name)}</a>` : esc(d.file_name)}</td>
      <td>${esc(d.content_type ?? '—')}</td>
      <td>${d.size_bytes ? (d.size_bytes / 1024).toFixed(1) + ' KB' : '—'}</td>
      <td>${d.download_ok ? '✅' : `❌ <span class="muted">${esc(d.download_error ?? 'pendente')}</span>`}</td>
    </tr>`).join('');

  app.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h2>Contrato BASE #${c.basegov_id}</h2>
        <div>
          <a href="${esc(c.basegov_url)}" target="_blank" rel="noopener"><button class="btn-secondary">Ver no BASE ↗</button></a>
          <button class="btn-secondary" onclick="history.back()">← Voltar</button>
        </div>
      </div>
      <dl class="detail">
        <dt>Objeto</dt><dd>${esc(c.object_brief_description ?? '—')}</dd>
        <dt>Descrição</dt><dd>${esc(c.description ?? '—')}</dd>
        <dt>Adjudicante</dt><dd>${ent('contracting')}</dd>
        <dt>Adjudicatário</dt><dd>${ent('contracted')}</dd>
        <dt>Concorrentes</dt><dd>${ent('contestant')}</dd>
        <dt>Tipo de procedimento</dt><dd>${esc(c.contracting_procedure_type ?? '—')}</dd>
        <dt>Tipo de contrato</dt><dd>${esc(c.contract_types ?? '—')}</dd>
        <dt>Preço contratual</dt><dd>${fmtPrice(c.initial_contractual_price)}</dd>
        <dt>Preço efetivo</dt><dd>${fmtPrice(c.total_effective_price)}</dd>
        <dt>Data de publicação</dt><dd>${fmtDate(c.publication_date)}</dd>
        <dt>Data de celebração</dt><dd>${fmtDate(c.signing_date)}</dd>
        <dt>Data de fecho</dt><dd>${fmtDate(c.close_date)}</dd>
        <dt>Prazo de execução</dt><dd>${esc(c.execution_deadline ?? '—')}</dd>
        <dt>Local de execução</dt><dd>${esc(c.execution_place ?? '—')}</dd>
        <dt>CPV</dt><dd>${esc(c.cpvs ?? '—')} ${c.cpvs_designation ? '· ' + esc(c.cpvs_designation) : ''}</dd>
        <dt>Fundamentação</dt><dd>${esc(c.contract_fundamentation ?? '—')}</dd>
        <dt>Regime</dt><dd>${esc(c.regime ?? '—')}</dd>
        <dt>Peças do procedimento</dt><dd>${c.contracting_procedure_url ? `<a href="${esc(c.contracting_procedure_url)}" target="_blank" rel="noopener">${esc(c.contracting_procedure_url)}</a>` : '—'}</dd>
      </dl>
    </div>
    <div class="card">
      <h2>Documentos (${(c.documents ?? []).length})</h2>
      <table>
        <thead><tr><th>Ficheiro</th><th>Tipo</th><th>Tamanho</th><th>Download</th></tr></thead>
        <tbody>${docs || '<tr><td colspan="4" class="muted">Sem documentos.</td></tr>'}</tbody>
      </table>
    </div>`;
}

/* ---------- Router ---------- */
async function route() {
  stopPolling();
  const hash = location.hash || '#/';
  if (hash === '#/login') return renderLogin();

  let me;
  try {
    me = await api('/api/auth/me');
  } catch {
    return; /* api() já redirecionou para login */
  }
  topbar.hidden = false;
  whoami.textContent = me.username;

  const results = hash.match(/^#\/searches\/(\d+)(?:\?page=(\d+))?$/);
  const contract = hash.match(/^#\/contracts\/(\d+)$/);
  try {
    if (results) return await renderResults(Number(results[1]), Number(results[2] ?? 0));
    if (contract) return await renderContract(Number(contract[1]));
    return await renderSearches();
  } catch (err) {
    if (err.message !== 'unauthorized') app.innerHTML = `<div class="card error">${esc(err.message)}</div>`;
  }
}

document.getElementById('logout-btn').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.hash = '#/login';
};

window.addEventListener('hashchange', route);
route();
