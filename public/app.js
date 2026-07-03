/* SPA mínima do BASE.gov Robot — sem dependências. */
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const whoami = document.getElementById('whoami');
let pollTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }));
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
const fmtCompact = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }) + ' €');
const scoreColor = (s) => (s >= 70 ? '#14622d' : s >= 45 ? '#8a4b00' : '#5a6b7b');
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
          ${search.status === 'failed' ? `<button id="retry-btn">↻ Retomar pesquisa</button>` : ''}
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

  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.onclick = async () => {
      try { await api(`/api/searches/${searchId}/retry`, { method: 'POST', body: '{}' }); renderResults(searchId, page); }
      catch (err) { alert(err.message); }
    };
  }

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

/* ---------- Perfis ---------- */
async function renderProfiles() {
  const load = async () => {
    const data = await api('/api/profiles');
    const rows = data.items.map((p) => `
      <tr class="clickable" onclick="location.hash='#/profiles/${p.id}'">
        <td><strong>${esc(p.name)}</strong></td>
        <td class="muted">${p.terms.map(esc).join(', ')}</td>
        <td>${esc(p.schedule)}${p.include_announcements ? ' · anúncios' : ''}</td>
        <td>${p.n_contracts} / ${p.n_announcements}</td>
        <td>${p.last_run ? `${badge(p.last_run.status)} <span class="muted">+${p.last_run.new_contracts ?? 0}c +${p.last_run.new_announcements ?? 0}a</span>` : '—'}</td>
        <td>${p.last_run_at ? new Date(p.last_run_at).toLocaleString('pt-PT') : '—'}</td>
      </tr>`).join('');
    const tbody = document.getElementById('profiles-table');
    if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="muted">Sem perfis. Cria o primeiro acima.</td></tr>';
    if (!data.items.some((p) => p.last_run && ['pending', 'running'].includes(p.last_run.status))) stopPolling();
  };

  app.innerHTML = `
    <div class="card">
      <h2>Novo perfil de pesquisa</h2>
      <p class="muted">Vários termos em conjunto (ex.: pirotecnia, fogo de artifício, espetáculo pirotécnico) com deduplicação automática, contratos + anúncios DR, e execução agendada.</p>
      <form id="new-profile-form">
        <p><input type="text" name="name" placeholder="Nome do perfil — ex.: Pirotecnia" required></p>
        <p><input type="text" name="terms" placeholder="Termos separados por vírgula — ex.: pirotecnia, fogo de artifício" required></p>
        <p>
          <label>Agendamento:
            <select name="schedule"><option value="manual">Manual</option><option value="daily">Diário</option><option value="weekly">Semanal</option></select>
          </label>
          &nbsp; <label><input type="checkbox" name="ann" checked> Incluir anúncios (concursos abertos)</label>
        </p>
        <div class="error" id="profile-error"></div>
        <p><button type="submit">Criar e executar</button></p>
      </form>
    </div>
    <div class="card">
      <h2>Perfis</h2>
      <table>
        <thead><tr><th>Nome</th><th>Termos</th><th>Agenda</th><th>Contratos / Anúncios</th><th>Último run</th><th>Última execução</th></tr></thead>
        <tbody id="profiles-table"><tr><td colspan="6" class="muted">A carregar…</td></tr></tbody>
      </table>
    </div>`;

  document.getElementById('new-profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/profiles', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          terms: String(fd.get('terms')).split(',').map((t) => t.trim()).filter(Boolean),
          schedule: fd.get('schedule'),
          include_announcements: fd.get('ann') === 'on',
        }),
      });
      e.target.reset();
      await load();
      stopPolling();
      pollTimer = setInterval(load, 4000);
    } catch (err) {
      document.getElementById('profile-error').textContent = err.message;
    }
  };

  await load();
  stopPolling();
  pollTimer = setInterval(load, 4000);
}

/* ---------- Dashboard de perfil ---------- */
const PROFILE_TABS = [
  ['opportunities', 'Oportunidades'], ['renewals', 'Renovações'], ['announcements', 'Anúncios'],
  ['seasonality', 'Sazonalidade'], ['map', 'Mapa'], ['competitors', 'Concorrentes'], ['runs', 'Execuções'],
];


/* Conteúdo das tabs de insights — usado no dashboard de perfil e na página global. */
async function renderInsightTab(el, q, tab, p) {

  if (tab === 'opportunities') {
    const d = await api(`/api/insights/opportunities${q}`);
    el.innerHTML = `<h2>Oportunidades priorizadas</h2>
      <p class="muted">Concursos abertos e renovações previsíveis, ordenados por score (valor, urgência e recorrência da entidade).</p>
      <table><thead><tr><th>Score</th><th>Tipo</th><th>Oportunidade</th><th>Entidade</th><th>Valor</th><th>Data-chave</th><th>Ação recomendada</th></tr></thead><tbody>
      ${d.items.map((o) => `<tr>
        <td><span class="score" style="background:${scoreColor(o.score)}">${o.score}</span></td>
        <td>${o.type === 'anuncio_aberto' ? '📢 Concurso' : '🔁 Renovação'}</td>
        <td><a href="${esc(o.basegov_url)}" target="_blank" rel="noopener">${esc(o.title ?? '')}</a><br><span class="muted">${esc(o.reason)}</span></td>
        <td>${esc(o.entity ?? '—')}</td>
        <td>${fmtPrice(o.value)}</td>
        <td>${fmtDate(o.key_date)} <span class="muted">(${o.days_left}d)</span></td>
        <td>${esc(o.action)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sem oportunidades ativas — executa o perfil ou alarga os termos.</td></tr>'}
      </tbody></table>`;
  } else if (tab === 'renewals') {
    const d = await api(`/api/insights/renewals${q}&months=12`);
    el.innerHTML = `<h2>Radar de renovações (próximos 12 meses)</h2>
      <p class="muted">Contratos em curso cuja execução termina em breve — a entidade irá provavelmente lançar novo procedimento; contactar na data sugerida.</p>
      <table><thead><tr><th>Termina</th><th>Contactar até</th><th>Objeto</th><th>Entidade adjudicante</th><th>Fornecedor atual</th><th>Valor</th></tr></thead><tbody>
      ${d.items.map((r) => `<tr>
        <td>${fmtDate(r.end_date)} <span class="muted">(${r.days_left}d)</span></td>
        <td><strong>${fmtDate(r.suggested_contact_date)}</strong></td>
        <td><a href="${esc(r.basegov_url)}" target="_blank" rel="noopener">${esc(r.object_brief_description ?? '')}</a></td>
        <td>${esc(r.contracting ?? '—')}</td>
        <td>${esc(r.incumbent ?? '—')}</td>
        <td>${fmtPrice(r.initial_contractual_price)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sem renovações no horizonte.</td></tr>'}
      </tbody></table>`;
  } else if (tab === 'announcements') {
    const d = await api(`/api/announcements${q}&size=100`);
    el.innerHTML = `<h2>Anúncios DR</h2>
      <table><thead><tr><th>Publicação</th><th>Prazo propostas</th><th>Designação</th><th>Entidade</th><th>Procedimento</th><th>Preço base</th></tr></thead><tbody>
      ${d.items.map((a) => {
        const open = a.proposal_deadline_date && a.proposal_deadline_date >= new Date().toISOString().slice(0, 10);
        return `<tr>
        <td>${fmtDate(a.dr_publication_date)}</td>
        <td>${open ? '🟢' : '⚪'} ${fmtDate(a.proposal_deadline_date)}</td>
        <td><a href="${esc(a.basegov_url)}" target="_blank" rel="noopener">${esc(a.contract_designation ?? '')}</a></td>
        <td>${esc(a.contracting_entity ?? '—')}</td>
        <td>${esc(a.contracting_procedure_type ?? '—')}</td>
        <td>${fmtPrice(a.base_price)}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="muted">Sem anúncios recolhidos.</td></tr>'}
      </tbody></table>`;
  } else if (tab === 'seasonality') {
    const d = await api(`/api/insights/seasonality${q}`);
    const chart = (data, metric, label) => {
      const max = Math.max(1, ...data.map((m) => m[metric]));
      return `<h3>${label}</h3><div class="chart-wrap"><div class="bar-chart">
        ${data.map((m) => `<div class="bar" style="height:${Math.round((m[metric] / max) * 100)}%">
          <b>${metric === 'total_value' ? fmtCompact(m[metric]) : m[metric]}</b><span>${MONTHS[m.month - 1]}</span></div>`).join('')}
      </div></div>`;
    };
    el.innerHTML = `<h2>Sazonalidade</h2>
      <p class="muted">Em que meses do ano se publicam contratos e anúncios nesta área — recuar 4-6 meses para planear o contacto comercial.</p>
      ${chart(d.contracts, 'count', 'Contratos por mês (nº)')}
      ${chart(d.contracts, 'total_value', 'Contratos por mês (valor)')}
      ${chart(d.announcements, 'count', 'Anúncios por mês (nº)')}`;
  } else if (tab === 'map') {
    const d = await api(`/api/insights/map${q}`);
    el.innerHTML = `<h2>Mapa de oportunidades por distrito</h2>
      <p class="muted">Dimensão da bolha = valor total contratado; útil para decidir onde alocar esforço comercial.</p>
      <div class="map-wrap"><div>${districtMapSvg(d.items)}</div>
      <table style="max-width:420px"><thead><tr><th>Distrito</th><th>Contratos</th><th>Valor total</th><th>Valor médio</th></tr></thead><tbody>
      ${d.items.map((r) => `<tr><td>${esc(r.district)}</td><td>${r.count}</td><td>${fmtCompact(r.total_value)}</td><td>${fmtCompact(r.avg_value)}</td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (tab === 'competitors') {
    const d = await api(`/api/insights/competitors${q}`);
    el.innerHTML = `<h2>Inteligência competitiva — adjudicatários nesta área</h2>
      <table><thead><tr><th>Concorrente</th><th>NIF</th><th>Contratos</th><th>Valor total</th><th>Valor médio</th><th>Quota</th><th>Clientes</th></tr></thead><tbody>
      ${d.items.map((c) => `<tr class="clickable" onclick="location.hash='#/entities/${c.id}'">
        <td><strong>${esc(c.name)}</strong></td><td>${esc(c.nif ?? '')}</td><td>${c.n_contracts}</td>
        <td>${fmtCompact(c.total_value)}</td><td>${fmtCompact(c.avg_value)}</td>
        <td>${c.share_pct != null ? c.share_pct + '%' : '—'}</td>
        <td class="muted">${esc((c.top_clients ?? '').slice(0, 120))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sem dados.</td></tr>'}
      </tbody></table>`;
  } else if (tab === 'runs') {
    el.innerHTML = `<h2>Execuções</h2>
      <table><thead><tr><th>#</th><th>Estado</th><th>Novos contratos</th><th>Novos anúncios</th><th>Início</th><th>Fim</th><th>Pesquisas</th></tr></thead><tbody>
      ${p.runs.map((r) => `<tr>
        <td>${r.id}</td><td>${badge(r.status)}</td><td>+${r.new_contracts ?? 0}</td><td>+${r.new_announcements ?? 0}</td>
        <td>${r.started_at ? new Date(r.started_at).toLocaleString('pt-PT') : '—'}</td>
        <td>${r.finished_at ? new Date(r.finished_at).toLocaleString('pt-PT') : '—'}</td>
        <td class="muted">${(r.searches ?? []).map((s) => `${esc(s.term)} (${s.kind}: ${s.status} ${s.total_scraped ?? 0}/${s.total_reported ?? '?'})`).join('<br>')}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="muted">Sem execuções.</td></tr>'}
      </tbody></table>`;
  }

}

async function renderProfile(id, tab = 'opportunities') {
  const p = await api(`/api/profiles/${id}`);
  const running = p.runs.some((r) => ['pending', 'running'].includes(r.status));
  app.innerHTML = `
    <div class="toolbar">
      <div>
        <h2 style="margin:0">${esc(p.name)} ${running ? badge('running') : ''}</h2>
        <div class="muted">Termos: ${p.terms.map(esc).join(', ')} · agenda: ${esc(p.schedule)}</div>
      </div>
      <div>
        <button id="run-btn" ${running ? 'disabled' : ''}>▶ Executar agora</button>
        <button class="btn-secondary" onclick="location.hash='#/profiles'">← Perfis</button>
      </div>
    </div>
    <div class="cards">
      <div class="stat"><div class="n">${p.totals.n_contracts}</div><div class="l">Contratos</div></div>
      <div class="stat"><div class="n">${fmtCompact(p.totals.total_value)}</div><div class="l">Valor total</div></div>
      <div class="stat"><div class="n">${p.totals.n_announcements}</div><div class="l">Anúncios</div></div>
      <div class="stat"><div class="n">${p.totals.open_announcements}</div><div class="l">Concursos abertos</div></div>
    </div>
    <div class="tabs">${PROFILE_TABS.map(([k, l]) =>
      `<button class="${k === tab ? 'active' : ''}" onclick="location.hash='#/profiles/${id}/${k}'">${l}</button>`).join('')}</div>
    <div class="card" id="tab-content"><p class="muted">A carregar…</p></div>`;

  document.getElementById('run-btn').onclick = async () => {
    try { await api(`/api/profiles/${id}/run`, { method: 'POST', body: '{}' }); renderProfile(id, tab); }
    catch (err) { alert(err.message); }
  };

  const el = document.getElementById('tab-content');
  await renderInsightTab(el, `?profile_id=${id}`, tab, p);

  if (running) {
    stopPolling();
    pollTimer = setInterval(() => renderProfile(id, tab).catch(() => stopPolling()), 6000);
  }
}

/* Mapa SVG de Portugal por distrito (bolhas em centróides aproximados). */
const DISTRICT_COORDS = {
  'Viana do Castelo': [41.7, -8.6], Braga: [41.55, -8.42], Porto: [41.15, -8.6],
  'Vila Real': [41.3, -7.75], 'Bragança': [41.8, -6.75], Aveiro: [40.64, -8.65],
  Viseu: [40.66, -7.9], Guarda: [40.54, -7.27], Coimbra: [40.2, -8.4],
  'Castelo Branco': [39.82, -7.5], Leiria: [39.74, -8.8], 'Santarém': [39.23, -8.68],
  Portalegre: [39.3, -7.43], Lisboa: [38.72, -9.14], 'Setúbal': [38.52, -8.9],
  'Évora': [38.57, -7.9], Beja: [38.02, -7.86], Faro: [37.02, -7.93],
};
const ISLANDS = { 'Região Autónoma dos Açores': [60, 320], Açores: [60, 320], 'Região Autónoma da Madeira': [60, 400], Madeira: [60, 400] };

const deaccent = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const COORDS_NORM = Object.fromEntries(
  [...Object.entries(DISTRICT_COORDS).map(([k, v]) => [deaccent(k), { proj: true, v }]),
   ...Object.entries(ISLANDS).map(([k, v]) => [deaccent(k), { proj: false, v }])]
);

function districtMapSvg(items) {
  const W = 300, H = 460;
  const proj = ([lat, lon]) => [((lon + 9.6) / 3.6) * (W - 60) + 30, ((42.3 - lat) / 5.4) * (H - 80) + 20];
  const maxV = Math.max(1, ...items.map((i) => i.total_value));
  const bubbles = items.map((i) => {
    const hit = COORDS_NORM[deaccent(i.district)];
    const xy = hit ? (hit.proj ? proj(hit.v) : hit.v) : null;
    if (!xy) return '';
    const r = 4 + Math.sqrt(i.total_value / maxV) * 26;
    return `<circle cx="${xy[0]}" cy="${xy[1]}" r="${r}" fill="#0b5394" fill-opacity="0.55" stroke="#0b5394">
        <title>${esc(i.district)}: ${i.count} contratos, ${fmtCompact(i.total_value)}</title></circle>
      <text x="${xy[0]}" y="${xy[1] - r - 3}" text-anchor="middle" font-size="9" fill="#1a2733">${esc(i.district)}</text>`;
  }).join('');
  const labels = Object.entries(DISTRICT_COORDS).map(([name, c]) => {
    const [x, y] = proj(c);
    return `<circle cx="${x}" cy="${y}" r="1.5" fill="#9db2c4"/>`;
  }).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#f0f4f8;border-radius:8px">
    ${labels}${bubbles}
    <text x="60" y="300" text-anchor="middle" font-size="9" fill="#5a6b7b">Açores ↓</text>
    <text x="60" y="382" text-anchor="middle" font-size="9" fill="#5a6b7b">Madeira ↓</text>
  </svg>`;
}

/* ---------- Insights globais (todos os dados, sem perfil) ---------- */
async function renderInsights(tab = 'opportunities') {
  const tabs = PROFILE_TABS.filter(([k]) => k !== 'runs');
  app.innerHTML = `
    <div class="toolbar">
      <div>
        <h2 style="margin:0">Insights globais</h2>
        <div class="muted">Sobre todos os contratos e anúncios recolhidos (todas as pesquisas e perfis). Para análise focada, usa um perfil.</div>
      </div>
    </div>
    <div class="tabs">${tabs.map(([k, l]) =>
      `<button class="${k === tab ? 'active' : ''}" onclick="location.hash='#/insights/${k}'">${l}</button>`).join('')}</div>
    <div class="card" id="tab-content"><p class="muted">A carregar…</p></div>`;
  await renderInsightTab(document.getElementById('tab-content'), '?profile_id=', tab, null);
}

/* ---------- Entidades ---------- */
async function renderEntities(role = 'contracting', q = '') {
  const d = await api(`/api/entities?role=${role}&q=${encodeURIComponent(q)}&size=50`);
  app.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h2>Entidades ${role === 'contracting' ? 'adjudicantes (compradores públicos)' : 'adjudicatárias (fornecedores)'}</h2>
        <div>
          <button class="${role === 'contracting' ? '' : 'btn-secondary'}" onclick="renderEntities('contracting')">Adjudicantes</button>
          <button class="${role === 'contracted' ? '' : 'btn-secondary'}" onclick="renderEntities('contracted')">Adjudicatárias</button>
        </div>
      </div>
      <form class="inline" id="ent-search"><input type="text" name="q" placeholder="Pesquisar por nome ou NIF" value="${esc(q)}"><button>Filtrar</button></form>
      <table style="margin-top:0.8rem"><thead><tr><th>Nome</th><th>NIF</th><th>Contratos</th><th>Valor total</th><th>Último contrato</th></tr></thead><tbody>
      ${d.items.map((e) => `<tr class="clickable" onclick="location.hash='#/entities/${e.id}'">
        <td><strong>${esc(e.name)}</strong></td><td>${esc(e.nif ?? '')}</td><td>${e.n_contracts}</td>
        <td>${fmtCompact(e.total_value)}</td><td>${fmtDate(e.last_contract)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem entidades.</td></tr>'}
      </tbody></table>
    </div>`;
  document.getElementById('ent-search').onsubmit = (e) => {
    e.preventDefault();
    renderEntities(role, new FormData(e.target).get('q'));
  };
}
window.renderEntities = renderEntities;

async function renderEntity(id) {
  const e = await api(`/api/entities/${id}`);
  const roleBlock = (r, title, counterLabel) => `
    <div class="card">
      <h2>${title}</h2>
      <div class="cards">
        <div class="stat"><div class="n">${r.n_contracts}</div><div class="l">Contratos</div></div>
        <div class="stat"><div class="n">${fmtCompact(r.total_value)}</div><div class="l">Valor total</div></div>
        <div class="stat"><div class="n">${fmtCompact(r.avg_value)}</div><div class="l">Valor médio</div></div>
      </div>
      ${r.by_year.length ? `<h3>Por ano</h3><table><thead><tr><th>Ano</th><th>Contratos</th><th>Valor</th></tr></thead><tbody>
        ${r.by_year.map((y) => `<tr><td>${y.year}</td><td>${y.count}</td><td>${fmtCompact(y.total_value)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${r.procedure_types.length ? `<h3>Tipos de procedimento</h3><p>${r.procedure_types.map((p) => `${esc(p.type ?? '?')} (${p.count})`).join(' · ')}</p>` : ''}
      ${r.counterparts.length ? `<h3>${counterLabel}</h3><table><thead><tr><th>Entidade</th><th>Contratos</th><th>Valor</th></tr></thead><tbody>
        ${r.counterparts.map((c) => `<tr class="clickable" onclick="location.hash='#/entities/${c.id}'"><td>${esc(c.name)}</td><td>${c.count}</td><td>${fmtCompact(c.total_value)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${r.recent_contracts.length ? `<h3>Contratos recentes</h3><table><thead><tr><th>Publicação</th><th>Objeto</th><th>Valor</th><th>Termina</th></tr></thead><tbody>
        ${r.recent_contracts.map((c) => `<tr><td>${fmtDate(c.publication_date)}</td>
          <td><a href="${esc(c.basegov_url)}" target="_blank" rel="noopener">${esc(c.object_brief_description ?? '')}</a></td>
          <td>${fmtPrice(c.initial_contractual_price)}</td><td>${fmtDate(c.end_date)}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;
  app.innerHTML = `
    <div class="toolbar">
      <h2>${esc(e.name)} ${e.nif ? `<span class="muted">· NIF ${esc(e.nif)}</span>` : ''}</h2>
      <button class="btn-secondary" onclick="history.back()">← Voltar</button>
    </div>
    ${e.as_contracting.n_contracts ? roleBlock(e.as_contracting, 'Como adjudicante (comprador)', 'Fornecedores') : ''}
    ${e.as_contracted.n_contracts ? roleBlock(e.as_contracted, 'Como adjudicatária (fornecedor)', 'Clientes') : ''}`;
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
  const profile = hash.match(/^#\/profiles\/(\d+)(?:\/(\w+))?$/);
  const entity = hash.match(/^#\/entities\/(\d+)$/);
  const insights = hash.match(/^#\/insights(?:\/(\w+))?$/);
  try {
    if (results) return await renderResults(Number(results[1]), Number(results[2] ?? 0));
    if (contract) return await renderContract(Number(contract[1]));
    if (profile) return await renderProfile(Number(profile[1]), profile[2] || 'opportunities');
    if (hash === '#/profiles') return await renderProfiles();
    if (insights) return await renderInsights(insights[1] || 'opportunities');
    if (entity) return await renderEntity(Number(entity[1]));
    if (hash === '#/entities') return await renderEntities();
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
