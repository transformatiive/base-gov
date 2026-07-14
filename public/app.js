/* SPA mínima do BaseRadar — sem dependências. */
const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const whoami = document.getElementById('whoami');
let pollTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPrice = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }));
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
/* Distância ao fim previsto do contrato: futuro → dias em falta; passado → há quanto terminou. */
const endDaysBadge = (d) => {
  const diff = Math.round((new Date(d) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
  if (Number.isNaN(diff)) return '';
  return diff >= 0
    ? ` <span class="badge" style="background:#dcfae6;color:#067647;border-color:#a9efc5">faltam ${diff} dia(s)</span>`
    : ` <span class="badge" style="background:#f2f4f7;color:#475467">terminou há ${-diff} dia(s)</span>`;
};
const fmtCompact = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }) + ' €');
/* Pares tint (fundo, texto) do design system v2 — chips de score/estado. */
const scorePair = (s) => (s >= 70 ? ['#dcfae6', '#067647'] : s >= 45 ? ['#fef0c7', '#b54708'] : ['#f2f4f7', '#475467']);
const scoreChip = (s, title) => {
  const [bg, fg] = scorePair(s);
  return `<span class="score" style="background:${bg};color:${fg}"${title ? ` title="${title}"` : ''}>${s}</span>`;
};
const FIT_BG = '#eff4ff', FIT_FG = '#175cd3';
const fitChip = (f, title) => `<span class="score" style="background:${FIT_BG};color:${FIT_FG}"${title ? ` title="${title}"` : ''}>${f}</span>`;
const typeChip = (t) => (t === 'anuncio_aberto'
  ? '<span class="badge" style="background:#fffaeb;color:#b54708;border-color:#fedf89">Concurso</span>'
  : '<span class="badge" style="background:#eff4ff;color:#175cd3;border-color:#d1e0ff">Renovação</span>');
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/* Ícones SVG inline (traço, 24x24). */
const ICON_PATHS = {
  download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M4 19h16"/>',
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>',
  external: '<path d="M14 5h5v5"/><path d="M19 5l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  pin: '<path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  doc: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9"/><path d="M10.3 19.5a2 2 0 0 0 3.4 0"/>',
  rotate: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/><path d="M8 8h3M8 12h3M8 16h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};
const ico = (name, size = 15) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px">${ICON_PATHS[name] ?? ''}</svg>`;

/* Wordmark BaseRadar (igual ao do header). */
const wordmark = (size = 20) =>
  `<span class="wordmark"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 15 0"/><path d="M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 12l6.5 6.5"/></svg><span>Base<span class="accent">Radar</span></span></span>`;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    if (location.hash !== '#/login') location.hash = '#/login';
    throw new Error('unauthorized');
  }
  if (res.status === 402) {
    // Subscrição necessária (trial terminado) — encaminha para a página de subscrição.
    if (location.hash !== '#/subscrever') location.hash = '#/subscrever';
    throw new Error('subscription_required');
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

function hideTrialBanner() { const t = document.getElementById('trial-banner'); if (t) { t.hidden = true; t.innerHTML = ''; } }

/* ---------- Login ---------- */
function renderLogin() {
  topbar.hidden = true;
  hideTrialBanner();
  app.innerHTML = `
    <div class="card login-box">
      ${wordmark(24)}
      <p class="muted">Radar comercial de contratos públicos</p>
      <form id="login-form">
        <label>Utilizador</label>
        <input type="text" name="username" autocomplete="username" required>
        <label>Password</label>
        <input type="password" name="password" autocomplete="current-password" required>
        <div class="error" id="login-error"></div>
        <p><button type="submit">Entrar</button></p>
      </form>
      <p class="login-foot">Ainda não tem conta? <a href="#/registo">Comece grátis — 7 dias</a></p>
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

/* ---------- Inscrição (7 dias grátis) ---------- */
async function renderRegister() {
  topbar.hidden = true;
  hideTrialBanner();
  document.body.classList.add('login-bg');
  app.innerHTML = `
    <div class="card register-box">
      ${wordmark(24)}
      <h2 style="margin:0.4rem 0 0.2rem">Comece grátis — 7 dias</h2>
      <p class="muted" style="margin:0 0 1rem">Sem cartão. Diga-nos a sua atividade e o radar fica pré-configurado.</p>
      <form id="reg-form">
        <div class="reg-grid">
          <div><label>Primeiro nome *</label><input type="text" name="first_name" required></div>
          <div><label>Apelido</label><input type="text" name="last_name"></div>
        </div>
        <label>Email *</label><input type="email" name="email" autocomplete="email" required>
        <div class="reg-grid">
          <div><label>Telefone</label><input type="text" name="phone" autocomplete="tel"></div>
          <div><label>Password *</label><input type="password" name="password" autocomplete="new-password" minlength="8" required></div>
        </div>
        <div class="reg-grid">
          <div><label>Empresa *</label><input type="text" name="company_name" required></div>
          <div><label>NIF *</label><input type="text" name="nif" inputmode="numeric" pattern="\\d{9}" maxlength="9" required></div>
        </div>

        <label style="margin-top:0.8rem">A sua atividade</label>
        <p class="muted" style="margin:0 0 0.4rem;font-size:0.82rem">Palavras-chave (ex.: pirotecnia, fogo de artifício) e/ou códigos CPV. Pesquise pelo nome da atividade e clique para adicionar.</p>
        <input type="text" name="terms" placeholder="Palavras-chave separadas por vírgula">
        <div id="reg-cpv-chips" class="cpv-chips" style="margin:0.5rem 0"></div>
        <div class="inline" style="gap:0.5rem;margin-top:0.4rem">
          <input type="text" id="reg-cpv-q" placeholder="Pesquisar CPV pela atividade (ex.: construção)" style="flex:1">
          <button type="button" class="btn-secondary" id="reg-cpv-btn">${ico('search')} Procurar</button>
        </div>
        <div id="reg-cpv-results" style="margin-top:0.4rem"></div>

        <div class="error" id="reg-error" style="margin-top:0.6rem"></div>
        <p style="margin-top:0.9rem"><button type="submit" id="reg-submit">Criar conta e começar</button></p>
        <p class="muted" style="font-size:0.8rem">Ao criar conta, começa um teste gratuito de 7 dias. Depois, ${'29€/mês + IVA'} — cancele quando quiser.</p>
      </form>
      <p class="login-foot">Já tem conta? <a href="#/login">Entrar</a></p>
    </div>`;

  const chosen = new Map(); // code -> designation
  const renderChips = () => {
    document.getElementById('reg-cpv-chips').innerHTML = [...chosen.entries()].map(([code, des]) =>
      `<span class="chip">${esc(code)} · ${esc(des.slice(0, 28))} <button type="button" data-code="${esc(code)}" aria-label="remover">×</button></span>`).join('');
    document.querySelectorAll('#reg-cpv-chips .chip button').forEach((b) => {
      b.onclick = () => { chosen.delete(b.dataset.code); renderChips(); };
    });
  };
  const doSearch = async () => {
    const q = document.getElementById('reg-cpv-q').value.trim();
    const box = document.getElementById('reg-cpv-results');
    box.innerHTML = '<p class="muted">A pesquisar…</p>';
    try {
      const d = await fetch('/api/public/cpv?q=' + encodeURIComponent(q)).then((r) => r.json());
      box.innerHTML = `<table style="min-width:0"><tbody>${d.items.map((c) =>
        `<tr><td><strong>${esc(c.code)}</strong></td><td>${esc(c.designation)}</td><td class="muted">${c.n_contracts}</td>
         <td><a href="#" data-code="${esc(c.code)}" data-des="${esc(c.designation)}">adicionar</a></td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('a[data-code]').forEach((a) => {
        a.onclick = (e) => { e.preventDefault(); chosen.set(a.dataset.code, a.dataset.des); renderChips(); };
      });
    } catch { box.innerHTML = '<p class="error">Falha na pesquisa de CPV.</p>'; }
  };
  document.getElementById('reg-cpv-btn').onclick = doSearch;
  document.getElementById('reg-cpv-q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } };

  document.getElementById('reg-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const terms = String(fd.get('terms') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const cpv_codes = [...chosen.keys()];
    const errBox = document.getElementById('reg-error');
    errBox.textContent = '';
    if (terms.length === 0 && cpv_codes.length === 0) {
      errBox.textContent = 'Escolha pelo menos uma palavra-chave ou código CPV da sua atividade.'; return;
    }
    const btn = document.getElementById('reg-submit');
    btn.disabled = true; btn.textContent = 'A criar conta…';
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify({
        first_name: fd.get('first_name'), last_name: fd.get('last_name'), phone: fd.get('phone'),
        email: fd.get('email'), password: fd.get('password'),
        company_name: fd.get('company_name'), nif: fd.get('nif'), terms, cpv_codes,
      }) });
      window._me = null;
      location.hash = '#/';
    } catch (err) {
      errBox.textContent = err.message; btn.disabled = false; btn.textContent = 'Criar conta e começar';
    }
  };
}

/* ---------- Banner de trial / subscrição no topo ---------- */
function renderTrialBanner(me) {
  const host = document.getElementById('trial-banner');
  const c = me?.company;
  if (!host) return;
  if (!c || me.is_admin || c.subscription_status === 'active') { host.hidden = true; host.innerHTML = ''; return; }
  let msg = '';
  let cls = 'trial';
  if (c.subscription_status === 'trialing') {
    const d = c.trial_days_left;
    msg = `Teste gratuito — ${d} dia${d === 1 ? '' : 's'} restante${d === 1 ? '' : 's'}.`;
  } else if (c.subscription_status === 'past_due') {
    cls = 'past-due'; msg = 'Pagamento pendente — regularize para manter o acesso.';
  } else if (c.subscription_status === 'canceled') {
    cls = 'past-due'; msg = 'Subscrição cancelada.';
  }
  host.hidden = false;
  host.className = 'trial-banner ' + cls;
  host.innerHTML = `<span>${msg}</span> <a href="#/subscrever">Subscrever</a>`;
}

/* ---------- Página de subscrição ---------- */
async function renderSubscribe() {
  topbar.hidden = false;
  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';
  let s;
  try { s = await api('/api/billing/summary'); } catch { return; }
  const c = s.company || {};
  const statusLabel = { trialing: 'Em teste', active: 'Ativa', past_due: 'Pagamento pendente', canceled: 'Cancelada' }[c.subscription_status] || c.subscription_status;
  app.innerHTML = `
    <div class="card" style="max-width:640px;margin:2rem auto">
      <div class="eyebrow" style="color:var(--brand)">Subscrição</div>
      <h2 style="margin:0.3rem 0 0.2rem">${esc(s.plan)}</h2>
      <div class="price" style="display:flex;align-items:baseline;gap:0.4rem;margin:0.4rem 0">
        <span style="font-size:2rem;font-weight:700">${esc(s.price)}</span>
      </div>
      <p class="muted">Empresa: <strong>${esc(c.name ?? '—')}</strong> · Estado: <strong>${esc(statusLabel ?? '—')}</strong>${
        c.subscription_status === 'trialing' && c.trial_days_left != null ? ` · ${c.trial_days_left} dia(s) de teste restantes` : ''}</p>
      <div class="hint">Tudo incluído: oportunidades priorizadas, radar de renovações, mapa e sazonalidade, análise IA do caderno de encargos, inteligência competitiva e digest semanal.</div>
      ${s.billing_enabled ? `
        <p style="margin-top:1rem">Escolha o método de pagamento:</p>
        <div class="inline" style="gap:0.5rem;flex-wrap:wrap">
          <button data-m="mb" class="pay-m">Multibanco</button>
          <button data-m="mbw" class="pay-m btn-secondary">MB WAY</button>
          <button data-m="cc" class="pay-m btn-secondary">Cartão</button>
        </div>
        <div id="pay-result" style="margin-top:1rem"></div>`
        : `<div class="error" style="margin-top:1rem">Os pagamentos ainda não estão ativos nesta instalação. Contacte o suporte para subscrever.</div>`}
      <p style="margin-top:1.2rem"><a href="#/">← Voltar ao radar</a></p>
    </div>`;
  document.querySelectorAll('.pay-m').forEach((b) => {
    b.onclick = async () => {
      const out = document.getElementById('pay-result');
      out.innerHTML = '<p class="muted">A criar pagamento…</p>';
      try {
        const r = await api('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ method: b.dataset.m }) });
        out.innerHTML = `<div class="hint">Pagamento criado (método ${esc(r.method)}). Siga as instruções para concluir; o acesso é ativado assim que o pagamento é confirmado.</div>
          <pre style="white-space:pre-wrap;font-size:0.8rem;background:var(--panel-2,#f6f8fb);padding:0.6rem;border-radius:8px;overflow:auto">${esc(JSON.stringify(r.payment, null, 2))}</pre>`;
      } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
    };
  });
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
    ${configTabs('searches')}
    <div class="card">
      <h2>Nova recolha pontual no site BASE</h2>
      <form class="inline" id="new-search-form">
        <input type="text" name="term" placeholder="Termo de pesquisa (objeto do contrato) — ex.: software" required>
        <button type="submit">Pesquisar</button>
      </form>
      <p class="muted" style="margin:0.5rem 0 0"><label><input type="checkbox" id="new-search-docs"> Descarregar documentos PDF do site BASE (mais lento; o histórico e os detalhes vêm dos dados abertos)</label></p>
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
      await api('/api/searches', {
        method: 'POST',
        body: JSON.stringify({ term, fetch_documents: document.getElementById('new-search-docs')?.checked === true }),
      });
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
/* Filtro temporal por defeito: contratos em execução ou futuros (fim >= hoje). */
let resultsFilter = { mode: 'active', from: '', to: '' };

function resultsFilterQuery() {
  const parts = [];
  if (resultsFilter.mode === 'active') parts.push('active=1');
  if (resultsFilter.from) parts.push(`from=${resultsFilter.from}`);
  if (resultsFilter.to) parts.push(`to=${resultsFilter.to}`);
  return parts.length ? `&${parts.join('&')}` : '';
}

async function renderResults(searchId, page = 0) {
  const search = await api(`/api/searches/${searchId}`);
  const data = await api(`/api/searches/${searchId}/results?page=${page}&size=25${resultsFilterQuery()}`);
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
          ${search.status === 'failed' ? `<button id="retry-btn">${ico('refresh')} Retomar pesquisa</button>` : ''}
          <a href="/api/searches/${search.id}/export.xlsx"><button>${ico('download')} Exportar Excel</button></a>
          <button class="btn-secondary" onclick="location.hash='#/'">${ico('back')} Voltar</button>
        </div>
      </div>
      <div class="map-controls" style="margin-top:0.2rem">
        <select id="res-mode" style="width:auto" aria-label="Âmbito temporal">
          <option value="active" ${resultsFilter.mode === 'active' ? 'selected' : ''}>Em execução e futuros</option>
          <option value="all" ${resultsFilter.mode === 'all' ? 'selected' : ''}>Todos (histórico)</option>
        </select>
        <label class="muted">De <input type="date" id="res-from" value="${resultsFilter.from}" style="width:auto"></label>
        <label class="muted">Até <input type="date" id="res-to" value="${resultsFilter.to}" style="width:auto"></label>
        <span class="muted">datas de publicação</span>
      </div>
      <table>
        <thead><tr><th>Objeto</th><th>Procedimento</th><th>Preço</th><th>Publicação</th><th>Docs</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">${resultsFilter.mode === 'active' ? 'Sem contratos em execução ou futuros neste filtro — muda para "Todos (histórico)" para ver tudo.' : 'Sem resultados (ainda).'}</td></tr>`}</tbody>
      </table>
      <div class="pager">
        <button ${page <= 0 ? 'disabled' : ''} onclick="location.hash='#/searches/${searchId}?page=${page - 1}'">${ico('back')} Anterior</button>
        <span>Página ${page + 1} de ${lastPage + 1}</span>
        <button ${page >= lastPage ? 'disabled' : ''} onclick="location.hash='#/searches/${searchId}?page=${page + 1}'">Seguinte ${ico('next')}</button>
      </div>
    </div>`;

  for (const [id, key] of [['res-mode', 'mode'], ['res-from', 'from'], ['res-to', 'to']]) {
    const input = document.getElementById(id);
    if (input) input.onchange = () => { resultsFilter[key] = input.value; renderResults(searchId, 0); };
  }

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
      <td>${d.download_ok ? `<span style="color:var(--ok)">${ico('check')}</span>` : `<span style="color:var(--bad)">${ico('x')}</span> <span class="muted">${esc(d.download_error ?? 'pendente')}</span>`}</td>
    </tr>`).join('');

  const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value}</b></div>`;
  app.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Contrato BASE #${c.basegov_id}</div>
      <div class="toolbar">
        <h2 class="page-title">${esc(c.object_brief_description ?? `Contrato #${c.basegov_id}`)}</h2>
        <div>
          <a href="${esc(c.basegov_url)}" target="_blank" rel="noopener"><button class="btn-secondary">Ver no BASE ${ico('external')}</button></a>
          <button class="btn-secondary" onclick="history.back()">${ico('back')} Voltar</button>
        </div>
      </div>
      <div class="chip-row">
        ${c.contracting_procedure_type ? `<span class="badge" style="background:#f2f4f7;color:#475467">${esc(c.contracting_procedure_type)}</span>` : ''}
        ${c.contract_types ? `<span class="badge" style="background:#f2f4f7;color:#475467">${esc(c.contract_types)}</span>` : ''}
        ${c.estimated_end_date ? endDaysBadge(c.estimated_end_date) : ''}
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card">
          <h2>Objeto e partes</h2>
          <dl class="detail">
            <dt>Descrição</dt><dd>${esc(c.description ?? '—')}</dd>
            <dt>Adjudicante</dt><dd>${ent('contracting')}</dd>
            <dt>Adjudicatário</dt><dd>${ent('contracted')}</dd>
            <dt>Concorrentes</dt><dd>${ent('contestant')}</dd>
            <dt>Local de execução</dt><dd>${esc(c.execution_place ?? '—')}</dd>
            <dt>CPV</dt><dd>${esc(c.cpvs ?? '—')} ${c.cpvs_designation ? '· ' + esc(c.cpvs_designation) : ''}</dd>
            <dt>Fundamentação</dt><dd>${esc(c.contract_fundamentation ?? '—')}</dd>
            <dt>Peças do procedimento</dt><dd>${c.contracting_procedure_url ? `<a href="${esc(c.contracting_procedure_url)}" target="_blank" rel="noopener">${esc(c.contracting_procedure_url)}</a>` : '—'}</dd>
          </dl>
        </div>
        <div class="card">
          <h2>Documentos (${(c.documents ?? []).length})</h2>
          <table>
            <thead><tr><th>Ficheiro</th><th>Tipo</th><th>Tamanho</th><th>Download</th></tr></thead>
            <tbody>${docs || '<tr><td colspan="4" class="muted">Sem documentos.</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card">
          <div class="toolbar"><h2 style="margin:0">Preparar renovação (IA)</h2>
            <button id="ai-contract-btn">${ico('search')} Analisar com IA</button></div>
          <p class="muted">Analisa este contrato e os seus documentos (quando descarregados) no contexto da tua atividade: critérios usados, requisitos, e o que preparar desde já para vencer a renovação.</p>
          <div id="ai-contract-result"></div>
        </div>
      </div>
      <div>
        <div class="card side-card">
          <div class="side-label">Preço contratual</div>
          <div class="price-hero">${fmtPrice(c.initial_contractual_price)}</div>
          <div class="muted">Preço efetivo: ${fmtPrice(c.total_effective_price)}</div>
          <hr class="hairline">
          ${kv('Publicação', fmtDate(c.publication_date))}
          ${kv('Celebração', fmtDate(c.signing_date))}
          ${kv('Prazo de execução', esc(c.execution_deadline ?? '—'))}
          ${kv('Fecho', fmtDate(c.close_date))}
        </div>
        <div class="card side-card tint">
          <div class="side-label">Fim previsto</div>
          ${c.estimated_end_date
            ? `<div class="side-num">${fmtDate(c.estimated_end_date)}</div>
               <div style="margin:0.25rem 0 0.45rem">${endDaysBadge(c.estimated_end_date).trim()}</div>
               <p class="small-print">Estimado: celebração (${fmtDate(c.signing_date)}) + ${esc(c.execution_deadline)}. É esta a data "Termina" das renovações, mapa e digest.</p>`
            : '<p class="small-print">Sem data de celebração ou prazo em dias no BASE — não é possível estimar.</p>'}
        </div>
        <div class="card side-card">
          <div class="side-label">Regime</div>
          <div style="font-size:0.86rem">${esc(c.regime ?? '—')}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('ai-contract-btn').onclick = async () => {
    const btn = document.getElementById('ai-contract-btn');
    const out = document.getElementById('ai-contract-result');
    btn.disabled = true;
    aiModalOpen([
      'A carregar o contrato e as entidades…',
      'A abrir os documentos PDF guardados na base…',
      'A extrair critérios e requisitos do caderno de encargos…',
      'A estudar o fornecedor atual e o histórico da entidade…',
      'A montar o plano de preparação da renovação…',
    ]);
    try {
      const pid = Number(getCtx() || 0);
      const r = await api(`/api/contracts/${id}/analyze`, { method: 'POST', body: JSON.stringify({ profile_id: pid }) });
      out.innerHTML = renderAiFicha(r.analysis, r.cached, r.model) +
        (r.docs_used === 0 ? '<p class="hint">Nenhum documento PDF disponível para este contrato — a análise usou apenas os dados estruturados. Para análises completas, ativa "Descarregar documentos PDF" na pesquisa/perfil.</p>' : '');
    } catch (err) {
      out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      btn.disabled = false;
    } finally { aiModalClose(); }
  };
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
    ${configTabs('profiles')}
    <div class="card">
      <h2>Novo perfil de atividade</h2>
      <p class="muted">Vários termos em conjunto (ex.: pirotecnia, fogo de artifício, espetáculo pirotécnico) com deduplicação automática, contratos + anúncios DR, e execução agendada.</p>
      <form id="new-profile-form">
        <p><input type="text" name="name" placeholder="Nome do perfil — ex.: Pirotecnia" required></p>
        <p><input type="text" name="terms" placeholder="Termos separados por vírgula — ex.: pirotecnia, fogo de artifício" required></p>
        <div style="margin:0.6rem 0">
          <div id="cpv-chips" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.4rem"></div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <input type="text" id="cpv-search" placeholder="Códigos CPV: pesquisa por atividade — ex.: pirotecnia, limpeza, construção…" style="flex:1;min-width:220px">
            <button type="button" class="btn-secondary" id="cpv-search-btn">${ico('search')} Procurar CPV</button>
          </div>
          <div id="cpv-results" class="muted" style="margin-top:0.4rem"></div>
          <p class="muted" style="margin:0.3rem 0 0">Os códigos CPV apanham contratos classificados na atividade mesmo sem as palavras-chave no texto. Se não souberes o código, pesquisa pelo nome da atividade e clica para adicionar.</p>
        </div>
        <p>
          <label>Agendamento:
            <select name="schedule"><option value="manual">Manual</option><option value="daily">Diário</option><option value="weekly">Semanal</option></select>
          </label>
          &nbsp; <label><input type="checkbox" name="ann" checked> Incluir anúncios (concursos abertos)</label>
          &nbsp; <label><input type="checkbox" name="docs"> Descarregar documentos PDF do site</label>
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

  const cpvSelected = [];
  const renderCpvChips = () => {
    const holder = document.getElementById('cpv-chips');
    if (!holder) return;
    holder.innerHTML = cpvSelected.map((c, i) => `
      <span style="display:inline-flex;align-items:center;gap:0.3rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:0.15rem 0.6rem;font-size:0.8rem">
        <strong>${esc(c.code)}</strong> ${esc((c.designation || '').slice(0, 40))}
        <a href="#" onclick="event.preventDefault(); window._cpvRemove(${i})" aria-label="Remover" style="font-weight:700">&times;</a>
      </span>`).join('');
  };
  window._cpvRemove = (i) => { cpvSelected.splice(i, 1); renderCpvChips(); };
  window._cpvAdd = (code, designation) => {
    if (!cpvSelected.some((c) => c.code === code)) cpvSelected.push({ code, designation });
    renderCpvChips();
  };
  const cpvSearch = async () => {
    const q = document.getElementById('cpv-search').value.trim();
    const box = document.getElementById('cpv-results');
    box.innerHTML = 'A pesquisar no catálogo…';
    try {
      const d = await api(`/api/cpv?q=${encodeURIComponent(q)}`);
      box.innerHTML = d.items.length
        ? `<table style="min-width:0"><thead><tr><th>Código</th><th>Atividade</th><th>Contratos</th><th></th></tr></thead><tbody>
           ${d.items.map((c) => `<tr class="clickable" onclick="window._cpvAdd('${esc(c.code)}', '${esc(String(c.designation).replace(/'/g, ''))}')">
             <td><strong>${esc(c.code)}</strong></td><td>${esc(c.designation)}</td>
             <td>${Number(c.n_contracts).toLocaleString('pt-PT')}</td><td><a href="#" onclick="event.preventDefault()">adicionar</a></td></tr>`).join('')}
           </tbody></table>`
        : 'Nada encontrado — tenta outra palavra (ex.: "limpeza", "software", "fogo").';
    } catch (err) { box.textContent = err.message; }
  };
  document.getElementById('cpv-search-btn').onclick = cpvSearch;
  document.getElementById('cpv-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cpvSearch(); }
  });

  document.getElementById('new-profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/profiles', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          terms: String(fd.get('terms')).split(',').map((t) => t.trim()).filter(Boolean),
          cpv_codes: cpvSelected.map((c) => c.code.split('-')[0]),
          schedule: fd.get('schedule'),
          include_announcements: fd.get('ann') === 'on',
          fetch_documents: fd.get('docs') === 'on',
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
    const kw = window._oppFilter ?? '';
    const d = await api(`/api/insights/opportunities${q}${kw ? `&q=${encodeURIComponent(kw)}` : ''}`);
    window._oppReload = () => renderInsightTab(el, q, tab, p);
    const fitKey = (o) => `${o.type}:${o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id}`;
    const fits = window._fitCache?.[q] ?? {};
    const matrix = renderPriorityMatrix(d.items, fits);
    el.innerHTML = `<div class="toolbar"><h2 style="margin:0">Oportunidades priorizadas</h2>
      <form class="inline" style="margin:0" onsubmit="event.preventDefault(); window._oppFilter=this.q.value; window._oppReload();">
        <input type="text" name="q" value="${esc(kw)}" placeholder="Filtrar por palavra-chave (objeto ou entidade)" style="min-width:230px">
        <button type="submit">${ico('search')} Filtrar</button>
      </form></div>
      ${matrix}
      <p class="muted">Concursos abertos e renovações previsíveis, ordenados por score (valor, urgência e recorrência da entidade).</p>
      <div class="hint">Score (0-100): para concursos abertos soma 25 pontos base, até 35 pelo valor (escala logarítmica) e até 40 de urgência à medida que o prazo de propostas se aproxima. Para renovações soma até 35 pelo valor, até 30 pela proximidade do fim do contrato e até 15 pela recorrência de compra da entidade. &ge;70 = prioridade alta, 45-69 = média, &lt;45 = baixa.</div>
      ${q.includes('profile_id=') && !q.endsWith('profile_id=') ? `<p class="muted" style="margin:0.4rem 0" id="fit-status">Fit IA: calculado automaticamente para oportunidades nos próximos 12 meses.</p>` : ''}
      <table><thead><tr><th>Score</th><th>Fit IA</th><th>Tipo</th><th>Oportunidade</th><th>Entidade</th><th>Valor</th><th>Data-chave</th><th>Ação recomendada</th></tr></thead><tbody>
      ${d.items.map((o) => `<tr>
        <td>${scoreChip(o.score)}</td>
        <td>${fits[fitKey(o)] ? fitChip(fits[fitKey(o)].fit, esc(fits[fitKey(o)].reason))
          : `<button class="btn-secondary fit-one" title="Calcular fit desta oportunidade (a mais de 12 meses, não é automático)" onclick="window._fitOne('${o.type}', ${o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id})">${ico('refresh', 13)}</button>`}</td>
        <td>${typeChip(o.type)}</td>
        <td><a href="${esc(o.internal_url ?? o.basegov_url)}">${esc(o.title ?? '')}</a><br><span class="muted">${esc(o.reason)}</span>${(fits[fitKey(o)]?.reasons ?? []).length ? `<ul class="fit-reasons">${fits[fitKey(o)].reasons.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}</td>
        <td>${esc(o.entity ?? '—')}</td>
        <td>${fmtPrice(o.value)}</td>
        <td>${fmtDate(o.key_date)} <span class="muted">(${o.days_left}d)</span></td>
        <td>${esc(o.action)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sem oportunidades ativas — executa o perfil ou alarga os termos.</td></tr>'}
      </tbody></table>`;
    bindMatrixTooltip(el);
    const pid = new URLSearchParams(q.slice(1)).get('profile_id');
    const toFitItem = (o) => ({
      type: o.type,
      id: o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id,
      title: o.title, entity: o.entity, value: o.value,
    });
    const mergeFits = (scores) => {
      (window._fitCache ??= {})[q] = { ...(window._fitCache[q] ?? {}), ...scores };
    };
    window._fitOne = async (type, itemId) => {
      const o = d.items.find((x) => x.type === type && (x.announcement_id === itemId || x.contract_id === itemId));
      if (!o || !pid) return;
      aiModalOpen(['A avaliar o fit desta oportunidade com a atividade…', 'A justificar a pontuação…']);
      try {
        const r = await api(`/api/profiles/${pid}/fit-scores`, { method: 'POST', body: JSON.stringify({ items: [toFitItem(o)] }) });
        mergeFits(r.scores);
        renderInsightTab(el, q, tab, p);
      } catch (err) { alert(err.message); } finally { aiModalClose(); }
    };
    // Automático: oportunidades com data-chave nos próximos 12 meses (são poucas)
    if (pid) {
      const missing = d.items.filter((o) => o.days_left != null && Number(o.days_left) <= 365 && !fits[fitKey(o)]);
      if (missing.length > 0 && window._fitAutoBusy !== q) {
        window._fitAutoBusy = q;
        const status = el.querySelector('#fit-status');
        if (status) status.textContent = `Fit IA: a calcular automaticamente ${missing.length} oportunidade(s)…`;
        api(`/api/profiles/${pid}/fit-scores`, { method: 'POST', body: JSON.stringify({ items: missing.map(toFitItem) }) })
          .then((r) => { mergeFits(r.scores); window._fitAutoBusy = null; if (document.body.contains(el)) renderInsightTab(el, q, tab, p); })
          .catch((err) => { window._fitAutoBusy = null; if (status) status.textContent = `Fit IA falhou: ${err.message}`; });
      }
    }
  } else if (tab === 'renewals') {
    const d = await api(`/api/insights/renewals${q}&months=12`);
    el.innerHTML = `<h2>Radar de renovações (próximos 12 meses)</h2>
      <p class="muted">Contratos em curso cuja execução termina em breve — a entidade irá provavelmente lançar novo procedimento; contactar na data sugerida.</p>
      <div class="hint">"Termina" é o fim previsto, estimado a partir dos dados do BASE: data de celebração + prazo de execução (o BASE não publica a data de fim explícita). A mesma regra é usada na matriz, no mapa e no digest; a data exata pode desviar-se se o contrato tiver sido suspenso ou prorrogado.</div>
      <table><thead><tr><th>Termina</th><th>Contactar até</th><th>Objeto</th><th>Entidade adjudicante</th><th>Fornecedor atual</th><th>Valor</th></tr></thead><tbody>
      ${d.items.map((r) => `<tr>
        <td>${fmtDate(r.end_date)} <span class="muted">(${r.days_left}d)</span></td>
        <td><strong>${fmtDate(r.suggested_contact_date)}</strong></td>
        <td><a href="#/contracts/${r.id}">${esc(r.object_brief_description ?? '')}</a></td>
        <td>${esc(r.contracting ?? '—')}</td>
        <td>${esc(r.incumbent ?? '—')}</td>
        <td>${fmtPrice(r.initial_contractual_price)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sem renovações no horizonte.</td></tr>'}
      </tbody></table>`;
  } else if (tab === 'announcements') {
    const showAll = window._annShowAll === true;
    const d = await api(`/api/announcements${q}&size=100${showAll ? '' : '&open=1'}`);
    window._annReload = () => renderInsightTab(el, q, tab, p);
    el.innerHTML = `<div class="toolbar"><h2>Anúncios DR ${showAll ? '' : '— concursos abertos'}</h2>
      <label class="muted"><input type="checkbox" ${showAll ? 'checked' : ''}
        onchange="window._annShowAll=this.checked; window._annReload()"> mostrar expirados</label></div>
      <p class="muted">Por omissão só se mostram concursos com prazo de propostas ainda a decorrer — os expirados já não são acionáveis.</p>
      <table><thead><tr><th>Publicação</th><th>Prazo propostas</th><th>Designação</th><th>Entidade</th><th>Procedimento</th><th>Preço base</th></tr></thead><tbody>
      ${d.items.map((a) => {
        const open = a.proposal_deadline_date && a.proposal_deadline_date >= new Date().toISOString().slice(0, 10);
        return `<tr class="clickable" onclick="location.hash='#/announcements/${a.id}'">
        <td>${fmtDate(a.dr_publication_date)}</td>
        <td><span class="dot ${open ? 'open' : 'closed'}"></span> ${fmtDate(a.proposal_deadline_date)}</td>
        <td><a href="#/announcements/${a.id}" onclick="event.stopPropagation()">${esc(a.contract_designation ?? '')}</a></td>
        <td>${esc(a.contracting_entity ?? '—')}</td>
        <td>${esc(a.contracting_procedure_type ?? '—')}</td>
        <td>${fmtPrice(a.base_price)}</td></tr>`;
      }).join('') || `<tr><td colspan="6" class="muted">${showAll ? 'Sem anúncios recolhidos.' : 'Sem concursos abertos neste momento — ativa "mostrar expirados" para ver o histórico.'}</td></tr>`}
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
    document.querySelector('main').classList.add('wide');
    let basis = window._mapBasis ?? 'end';
    const tl = await api(`/api/insights/map-timeline${q}&basis=${basis === 'end' ? 'end' : 'publication'}`);
    const months = tl.months ?? [];
    const monthLabel = (m) => {
      const [y, mm] = m.split('-');
      return `${MONTHS[Number(mm) - 1]} ${y.slice(2)}`;
    };
    /* sel = 0 → todo o período; 1..N → mês months[sel-1] */
    const dataFor = (sel) => {
      const month = sel > 0 ? months[sel - 1] : null;
      return Object.entries(tl.districts ?? {}).map(([district, byMonth]) => {
        let count = 0, total = 0;
        if (month) {
          const m = byMonth[month];
          if (m) { count = m.count; total = m.total_value; }
        } else {
          for (const m of Object.values(byMonth)) { count += m.count; total += m.total_value; }
        }
        return { district, count, total_value: total, avg_value: count ? total / count : 0 };
      }).sort((a, b) => b.total_value - a.total_value);
    };
    let radiusRef = Math.max(1, ...dataFor(0).map((i) => i.total_value));

    // Etiqueta mês a mês; ano visível em janeiro e no primeiro mês; meses fora
    // dos trimestres levam a classe .minor (escondidos em ecrãs estreitos)
    const shownTicks = months.map((m, i) => {
      const mm = Number(m.split('-')[1]);
      const label = i === 0 && basis === 'end' ? 'Hoje'
        : (mm === 1 || i === 0) ? monthLabel(m) : MONTHS[mm - 1];
      return { pos: i + 1, label, minor: !(i === 0 || [1, 4, 7, 10].includes(mm)) };
    });

    const rowsHtml = (items) => items.map((r) =>
      `<tr class="clickable" data-district="${esc(r.district)}" onclick="window._loadRegion('${esc(r.district).replace(/'/g, "\\'")}')"><td>${esc(r.district)}</td><td>${r.count}</td><td>${fmtCompact(r.total_value)}</td><td>${fmtCompact(r.avg_value)}</td></tr>`
    ).join('') || '<tr><td colspan="4" class="muted">Sem contratos neste período.</td></tr>';

    el.innerHTML = `<h2>Mapa de oportunidades por distrito</h2>
      <p class="muted">${basis === 'end'
        ? 'A timeline começa hoje e avança pelo fim previsto dos contratos em execução — desliza para veres onde se concentram as renovações em cada período.'
        : 'Histórico por data de publicação — desliza para veres a evolução do mercado.'}
        Clica num círculo ou numa linha para o detalhe do distrito.</p>
      <div class="map-controls">
        <select id="map-period" style="width:auto" aria-label="Âmbito temporal">
          <option value="end" ${basis === 'end' ? 'selected' : ''}>Renovações futuras (fim de contrato)</option>
          <option value="publication" ${basis === 'publication' ? 'selected' : ''}>Histórico (publicação)</option>
        </select>
        <div style="flex:1 1 260px">
          <input type="range" id="map-slider" min="0" max="${months.length}" step="1" value="0" aria-label="Período" style="width:100%">
          <div class="slider-ticks">
            <span style="left:0%">Tudo</span>
            ${shownTicks.map((t) => `<span class="${t.minor ? 'minor' : ''}" style="left:${(t.pos / Math.max(1, months.length)) * 100}%">${t.label}</span>`).join('')}
          </div>
        </div>
        <span class="month-label" id="map-month-label">Todo o período</span>
      </div>
      <div class="map-wrap">
        <div id="osm-map"></div>
        <div class="map-table" id="region-panel"><table><thead><tr><th>Distrito</th><th>Contratos</th><th>Valor total</th><th>Valor médio</th></tr></thead><tbody id="map-district-tbody"></tbody></table></div>
      </div>
      <div class="legend">
        <span><span class="sw" style="background:${MAP_COLORS[0]}"></span>Sem dados</span>
        <span><span class="sw" style="background:${MAP_COLORS[1]}"></span>Baixo</span>
        <span><span class="sw" style="background:${MAP_COLORS[2]}"></span>Médio</span>
        <span><span class="sw" style="background:${MAP_COLORS[3]}"></span>Alto</span>
        <span>· dimensão do círculo = valor contratado</span>
      </div>`;

    const slider = el.querySelector('#map-slider');
    const label = el.querySelector('#map-month-label');
    const applySelection = () => {
      const sel = Number(slider.value);
      label.textContent = sel > 0 ? monthLabel(months[sel - 1]) : 'Todo o período';
      const items = dataFor(sel);
      updateLeafletMarkers(items, radiusRef);
      const tb = document.getElementById('map-district-tbody');
      if (tb) tb.innerHTML = rowsHtml(items);
    };
    slider.addEventListener('input', applySelection);
    el.querySelector('#map-period').onchange = (e) => {
      window._mapBasis = e.target.value;
      renderInsightTab(el, q, tab, p);
    };

    window._loadRegion = (district) => {
      document.querySelectorAll('#map-district-tbody tr').forEach((tr) =>
        tr.classList.toggle('sel', tr.dataset.district === district));
      return loadRegionPanel(district, q);
    };
    window._annReloadMap = () => renderInsightTab(el, q, tab, p);
    renderLeafletMap(dataFor(0), (district) => loadRegionPanel(district, q), radiusRef);
    applySelection();
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
        <button id="run-btn" ${running ? 'disabled' : ''}>${ico('play')} Executar agora</button>
        <button class="btn-secondary" onclick="location.hash='#/profiles'">${ico('back')} Perfis</button>
      </div>
    </div>
    <div class="cards">
      <div class="stat"><div class="n">${p.totals.n_contracts}</div><div class="l">Contratos</div></div>
      <div class="stat"><div class="n">${fmtCompact(p.totals.total_value)}</div><div class="l">Valor total</div></div>
      <div class="stat"><div class="n">${p.totals.n_announcements}</div><div class="l">Anúncios</div></div>
      <div class="stat accent"><div class="n">${p.totals.open_announcements}</div><div class="l">Concursos abertos</div></div>
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
const ISLANDS = {
  'Região Autónoma dos Açores': [37.74, -25.67], Açores: [37.74, -25.67],
  'Região Autónoma da Madeira': [32.65, -16.91], Madeira: [32.65, -16.91],
};

const deaccent = (str) => String(str ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const COORDS_NORM = Object.fromEntries(
  [...Object.entries(DISTRICT_COORDS), ...Object.entries(ISLANDS)].map(([k, v]) => [deaccent(k), v])
);

/* Painel de drill-down de um distrito: contratos, renovações e perspetiva temporal. */
async function loadRegionPanel(district, q) {
  const panel = document.getElementById('region-panel');
  if (!panel) return;
  panel.innerHTML = '<p class="muted">A carregar dados do distrito…</p>';
  const d = await api(`/api/insights/region${q}&district=${encodeURIComponent(district)}`);
  const maxY = Math.max(1, ...d.by_year.map((y) => y.count));
  const maxM = Math.max(1, ...d.by_month.map((m) => m.count));
  panel.innerHTML = `
    <div class="toolbar"><h3 style="margin:0">${ico('pin')} ${esc(d.district)}</h3>
      <button class="btn-secondary" onclick="window._annReloadMap ? window._annReloadMap() : location.reload()">${ico('back')} Todos os distritos</button></div>
    <h4>Evolução anual (nº contratos)</h4>
    <div class="chart-wrap"><div class="bar-chart" style="height:90px">
      ${d.by_year.map((y) => `<div class="bar" style="height:${Math.round((y.count / maxY) * 100)}%"><b>${y.count}</b><span>${y.year}</span></div>`).join('') || '<span class="muted">Sem dados.</span>'}
    </div></div>
    <h4>Sazonalidade (mês do ano)</h4>
    <div class="chart-wrap"><div class="bar-chart" style="height:70px">
      ${d.by_month.map((m) => `<div class="bar" style="height:${Math.round((m.count / maxM) * 100)}%"><b>${m.count || ''}</b><span>${MONTHS[m.month - 1]}</span></div>`).join('')}
    </div></div>
    <h4>${ico('rotate')} Renovações próximas (${d.renewals.length})</h4>
    ${d.renewals.length ? `<table><thead><tr><th>Termina</th><th>Objeto</th><th>Entidade</th><th>Valor</th></tr></thead><tbody>
      ${d.renewals.map((r) => `<tr class="clickable" onclick="location.hash='#/contracts/${r.id}'">
        <td>${fmtDate(r.end_date)} <span class="muted">(${r.days_left}d)</span></td>
        <td><a href="#/contracts/${r.id}" onclick="event.stopPropagation()">${esc((r.object_brief_description ?? '').slice(0, 90))}</a></td>
        <td>${esc(r.contracting ?? '—')}</td><td>${fmtPrice(r.initial_contractual_price)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sem renovações nos próximos 12 meses.</p>'}
    <h4>Contratos recentes (${d.contracts.length})</h4>
    <table><thead><tr><th>Publicação</th><th>Objeto</th><th>Entidade</th><th>Valor</th></tr></thead><tbody>
      ${d.contracts.map((c) => `<tr class="clickable" onclick="location.hash='#/contracts/${c.id}'">
        <td>${fmtDate(c.publication_date)}</td>
        <td><a href="#/contracts/${c.id}" onclick="event.stopPropagation()">${esc((c.object_brief_description ?? '').slice(0, 90))}</a></td>
        <td>${esc(c.contracting ?? '—')}</td><td>${fmtPrice(c.initial_contractual_price)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sem contratos.</td></tr>'}
    </tbody></table>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Popover rico da matriz (substitui o tooltip nativo do browser). */
function matrixTipHtml(o, fit) {
  const kind = typeChip(o.type);
  const keyDate = o.key_date ? String(o.key_date).slice(0, 10) : '—';
  return `
    ${kind}
    <div class="mt-title">${esc(o.title ?? '')}</div>
    <ul class="mt-list">
      <li><strong>${esc(o.entity ?? '—')}</strong></li>
      <li>Valor: <strong>${fmtPrice(o.value)}</strong></li>
      <li>Data-chave: <strong>${keyDate}</strong> (${o.days_left} dias)</li>
      ${o.recurrence ? `<li>Entidade com <strong>${o.recurrence}</strong> contrato(s) na área</li>` : ''}
    </ul>
    ${fit ? `<div class="mt-fit">${fitChip(fit.fit)} fit com a atividade
      ${(fit.reasons ?? []).length ? `<ul class="mt-list">${fit.reasons.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : (fit.reason ? `<div class="muted">${esc(fit.reason)}</div>` : '')}</div>` : ''}
    <div class="muted" style="margin-top:0.3rem">clique para abrir o detalhe</div>`;
}

/* O tip vive no <body> (position fixed), por isso sobrevive a navegações por hash
   que substituem o conteúdo — tem de ser escondido explicitamente. */
function hideMatrixTip() {
  const t = document.getElementById('matrix-tip');
  if (t) t.style.display = 'none';
}
window.addEventListener('hashchange', hideMatrixTip);
window.addEventListener('scroll', hideMatrixTip, true);

function bindMatrixTooltip(container) {
  let tipEl = document.getElementById('matrix-tip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'matrix-tip';
    document.body.appendChild(tipEl);
  }
  const hide = hideMatrixTip;
  container.addEventListener('mousemove', (e) => {
    const c = e.target.closest?.('circle[data-mi]');
    if (!c) { hide(); return; }
    const o = window._matrixPts?.[Number(c.dataset.mi)];
    if (!o) { hide(); return; }
    const fkey = `${o.type}:${o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id}`;
    tipEl.innerHTML = matrixTipHtml(o, window._matrixFits?.[fkey]);
    tipEl.style.display = 'block';
    const pad = 14;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let left = e.clientX + pad, top = e.clientY + pad;
    if (left + w > window.innerWidth - 8) left = e.clientX - w - pad;
    if (top + h > window.innerHeight - 8) top = e.clientY - h - pad;
    tipEl.style.left = `${Math.max(8, left)}px`;
    tipEl.style.top = `${Math.max(8, top)}px`;
  });
  container.addEventListener('mouseleave', hide);
  container.addEventListener('mouseout', (e) => {
    // saiu de um círculo e o destino já não é (nem está dentro de) um círculo
    if (e.target.closest?.('circle[data-mi]') && !e.relatedTarget?.closest?.('circle[data-mi]')) hide();
  });
  container.addEventListener('click', hide, true);
}

/* Modal de progresso das análises IA: barra + passos contextualizados. */
let _aiModalTimer = null;
function aiModalOpen(steps) {
  aiModalClose();
  const el = document.createElement('div');
  el.id = 'ai-modal';
  el.innerHTML = `
    <div class="ai-modal-box">
      <div class="wordmark" style="justify-content:center;margin-bottom:0.6rem">${wordmark ? wordmark() : 'BaseRadar'}</div>
      <div class="ai-progress"><div class="ai-progress-bar" id="ai-progress-bar"></div></div>
      <p class="muted" id="ai-modal-step" style="text-align:center;min-height:2.2em;margin:0.7rem 0 0">${esc(steps[0])}</p>
    </div>`;
  document.body.appendChild(el);
  let i = 0;
  let pct = 4;
  const bar = () => document.getElementById('ai-progress-bar');
  const stepEl = () => document.getElementById('ai-modal-step');
  _aiModalTimer = setInterval(() => {
    // progresso assimptótico até 92% (o salto para 100% acontece no fecho)
    pct = Math.min(92, pct + Math.max(0.6, (92 - pct) * 0.06));
    if (bar()) bar().style.width = pct + '%';
    if (Math.random() < 0.16 && i < steps.length - 1) {
      i++;
      if (stepEl()) stepEl().textContent = steps[i];
    }
  }, 350);
}
function aiModalClose() {
  if (_aiModalTimer) { clearInterval(_aiModalTimer); _aiModalTimer = null; }
  const el = document.getElementById('ai-modal');
  if (el) {
    const bar = document.getElementById('ai-progress-bar');
    if (bar) bar.style.width = '100%';
    setTimeout(() => el.remove(), 250);
  }
}

const fitColor = (f) => (f >= 75 ? '#067647' : f >= 45 ? '#b54708' : '#98a2b3');

/* Matriz de priorização: X = dias até à data-chave, Y = valor, bolha = recorrência, cor = fit IA ou tipo. */
function renderPriorityMatrix(items, fits) {
  const pts = items.filter((o) => o.days_left != null && o.value != null && o.value > 0).slice(0, 80);
  if (pts.length < 2) return '';
  const W = 860, H = 320, padL = 70, padR = 20, padT = 16, padB = 40;
  const maxDays = Math.max(30, ...pts.map((o) => Number(o.days_left)));
  const maxVal = Math.max(...pts.map((o) => o.value));
  const x = (d) => padL + (Math.min(d, maxDays) / maxDays) * (W - padL - padR);
  const y = (v) => padT + (1 - Math.sqrt(v / maxVal)) * (H - padT - padB);
  const key = (o) => `${o.type}:${o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id}`;

  // grelha Y: 4 níveis da escala sqrt, com o valor real correspondente
  const yGrid = [0.25, 0.5, 0.75, 1].map((f) => {
    const yy = padT + (1 - f) * (H - padT - padB);
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#eef2f7"/>
      <text x="${padL - 6}" y="${yy + 3}" font-size="10" fill="#64748b" text-anchor="end">${fmtCompact(f * f * maxVal)}</text>`;
  }).join('');
  // grelha X: de 30 em 30 dias (máx 8 marcas)
  const stepDays = maxDays > 240 ? 60 : 30;
  let xGrid = '';
  for (let d = stepDays; d <= maxDays; d += stepDays) {
    xGrid += `<line x1="${x(d)}" y1="${padT}" x2="${x(d)}" y2="${H - padB}" stroke="${d === 30 ? '#cbd5e1' : '#eef2f7'}" ${d === 30 ? 'stroke-dasharray="4 4"' : ''}/>
      <text x="${x(d)}" y="${H - padB + 14}" font-size="10" fill="#64748b" text-anchor="middle">${d}d</text>`;
  }

  window._matrixPts = pts;
  window._matrixFits = fits ?? {};
  const dot = (o, i) => {
    const fit = fits?.[key(o)];
    const color = fit ? fitColor(fit.fit) : (o.type === 'anuncio_aberto' ? '#b42318' : '#2952e3');
    const r = 3 + Math.min(11, Math.sqrt(o.value / maxVal) * 11);
    return `<a href="${esc(o.internal_url ?? '#')}"><circle data-mi="${i}" cx="${x(Number(o.days_left))}" cy="${y(o.value)}" r="${r}"
      fill="${color}" fill-opacity="0.55" stroke="${color}" style="cursor:pointer"></circle></a>`;
  };

  return `<div class="card" style="overflow-x:auto;margin:0.6rem 0">
    <h3 style="margin:0 0 0.2rem">Matriz de priorização</h3>
    <p class="muted" style="margin:0 0 0.4rem">Cima-esquerda = agir já (valor alto, prazo próximo). Dimensão da bolha = valor do negócio. ${Object.keys(fits ?? {}).length ? 'Cor = fit IA (verde alto).' : 'Vermelho = concurso aberto, azul = renovação.'}</p>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="min-width:640px;max-width:100%">
      ${yGrid}${xGrid}
      <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#e2e8f0"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#e2e8f0"/>
      <text x="${x(30) + 4}" y="${padT + 10}" font-size="10" fill="#94a3b8">30 dias</text>
      <text x="${W - padR}" y="${H - 8}" font-size="10" fill="#64748b" text-anchor="end">dias até à data-chave →</text>
      <text x="${padL - 6}" y="${H - padB + 3}" font-size="10" fill="#64748b" text-anchor="end">0 €</text>
      ${pts.map((o, i) => dot(o, i)).join('')}
    </svg></div>`;
}

/* Mapa vetorial (MapLibre GL + OpenFreeMap "positron", estilo mapcn). */
/* Rampa azul do design v2: 4 níveis visíveis sobre o basemap claro
   (os tons mais claros da rampa completa desapareciam com opacidade baixa). */
const MAP_COLORS = ['#dbe4f5', '#8fb0f2', '#2952e3', '#1a2f8f'];
const MAP_PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 2l9 5-9 5z"/></svg>';
const MAP_PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>';

function mapColor(value, maxV) {
  if (!value || value <= 0) return MAP_COLORS[0];
  const r = value / Math.max(1, maxV);
  if (r < 0.33) return MAP_COLORS[1];
  if (r < 0.7) return MAP_COLORS[2];
  return MAP_COLORS[3];
}
// Raio ancorado ao máximo do período completo, limitado a 4-22px.
const mapRadius = (value, refV) => (value > 0 ? Math.min(22, 4 + Math.sqrt(value / Math.max(1, refV)) * 18) : 3);
const mapPopup = (i) =>
  `<strong>${esc(i.district)}</strong><br>${i.count} contrato(s)<br>Total: ${fmtCompact(i.total_value)}<br>Médio: ${fmtCompact(i.avg_value)}<br><em>clique para detalhe do distrito</em>`;

let glMap = null;
let glReady = false;
let glPendingData = null;
let glOnDistrictClick = null;
let glPopup = null;

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// Fallback autónomo caso o estilo remoto não carregue (rede restrita):
const MAP_STYLE_FALLBACK = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8edf3' } }],
};

function districtsToGeoJSON(items, refV) {
  // escala de cor só sobre distritos desenháveis — "Desconhecido" (sem coordenadas)
  // esmagava a rampa e deixava tudo no tom mais claro
  const mappable = items.filter((i) => COORDS_NORM[deaccent(i.district)]);
  const maxV = Math.max(1, ...mappable.map((i) => i.total_value));
  return {
    type: 'FeatureCollection',
    features: items.flatMap((i) => {
      const c = COORDS_NORM[deaccent(i.district)];
      if (!c) return [];
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c[1], c[0]] },
        properties: {
          district: i.district,
          count: i.count,
          total_value: i.total_value,
          avg_value: i.avg_value,
          radius: mapRadius(i.total_value, refV ?? maxV),
          color: mapColor(i.total_value, maxV),
        },
      }];
    }),
  };
}

function glApplyData(geojson) {
  if (!glMap) return;
  if (!glReady) { glPendingData = geojson; return; }
  const src = glMap.getSource('districts');
  if (src) src.setData(geojson);
}

function glSetupLayers() {
  glMap.addSource('districts', { type: 'geojson', data: glPendingData ?? { type: 'FeatureCollection', features: [] } });
  glMap.addLayer({
    id: 'district-circles',
    type: 'circle',
    source: 'districts',
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.45,
      'circle-stroke-width': 2,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.85,
    },
  });
  glMap.on('click', 'district-circles', (e) => {
    const f = e.features?.[0];
    if (!f) return;
    const props = f.properties;
    if (glPopup) glPopup.remove();
    glPopup = new maplibregl.Popup({ closeButton: false, offset: 10 })
      .setLngLat(e.lngLat)
      .setHTML(mapPopup({
        district: props.district,
        count: Number(props.count),
        total_value: Number(props.total_value),
        avg_value: Number(props.avg_value),
      }))
      .addTo(glMap);
    if (glOnDistrictClick) glOnDistrictClick(props.district);
  });
  glMap.on('mouseenter', 'district-circles', () => { glMap.getCanvas().style.cursor = 'pointer'; });
  glMap.on('mouseleave', 'district-circles', () => { glMap.getCanvas().style.cursor = ''; });
  glReady = true;
  if (glPendingData) { glApplyData(glPendingData); glPendingData = null; }
}

function renderLeafletMap(items, onDistrictClick, radiusRef) {
  const el = document.getElementById('osm-map');
  if (!el || typeof maplibregl === 'undefined') return;
  if (glMap) { glMap.remove(); glMap = null; }
  glReady = false;
  glPendingData = null;
  glOnDistrictClick = onDistrictClick ?? null;

  const coords = items
    .map((i) => COORDS_NORM[deaccent(i.district)])
    .filter(Boolean)
    .map((c) => [c[1], c[0]]);
  const bounds = coords.length
    ? coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
    : null;

  const create = (style) => {
    glMap = new maplibregl.Map({
      container: el,
      style,
      center: [-8.0, 39.5],
      zoom: 5,
      attributionControl: { compact: true },
    });
    glMap.scrollZoom.disable();
    glMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    glMap.on('load', () => {
      glSetupLayers();
      if (bounds) glMap.fitBounds(bounds, { padding: 40, animate: false });
    });
  };

  create(MAP_STYLE_URL);
  // se o estilo remoto não carregar (rede restrita), recria com fundo neutro
  const fallbackTimer = setTimeout(() => {
    if (!glReady && glMap) {
      const pending = glPendingData;
      glMap.remove();
      glMap = null;
      glReady = false;
      create(MAP_STYLE_FALLBACK);
      glPendingData = pending;
    }
  }, 6000);
  glMap.once('load', () => clearTimeout(fallbackTimer));

  glApplyData(districtsToGeoJSON(items, radiusRef));
}

/* Atualiza os círculos sem reinicializar o mapa (slider temporal). */
function updateLeafletMarkers(items, radiusRef) {
  if (glPopup) { glPopup.remove(); glPopup = null; }
  glApplyData(districtsToGeoJSON(items, radiusRef));
}

/* ---------- Radar: vista principal, sempre no contexto da atividade escolhida ---------- */
function getCtx() { return localStorage.getItem('ctxProfile') || ''; }
function setCtx(v) { localStorage.setItem('ctxProfile', v || ''); }

async function renderRadar(tab = 'opportunities') {
  const profilesData = await api('/api/profiles');
  const profiles = profilesData.items;

  // Sem perfis ainda: onboarding direto para a criação
  if (profiles.length === 0) {
    app.innerHTML = `
      <div class="card" style="max-width:640px;margin:8vh auto;text-align:center">
        <h2>Bem-vindo ao BaseRadar</h2>
        <p class="muted">Começa por definir a tua atividade comercial (palavras-chave e códigos CPV).
        Todos os insights — oportunidades, renovações, mapa, concorrentes — serão apresentados nesse contexto,
        calculados sobre os dados já importados.</p>
        <p><button onclick="location.hash='#/config/profiles'">Criar perfil de atividade</button></p>
      </div>`;
    return;
  }

  let ctx = getCtx();
  if (ctx && !profiles.some((p) => String(p.id) === ctx)) ctx = '';
  if (!ctx && profiles.length > 0) { ctx = String(profiles[0].id); setCtx(ctx); }
  const active = profiles.find((p) => String(p.id) === ctx) ?? null;

  const tabs = PROFILE_TABS.filter(([k]) => k !== 'runs');
  app.innerHTML = `
    <div class="toolbar">
      <div>
        <h2 style="margin:0">Radar</h2>
        <div class="muted">${active
          ? `Atividade: ${esc(active.name)} — ${active.terms.map(esc).join(', ')}${(active.cpv_codes ?? []).length ? ' · CPV ' + active.cpv_codes.map(esc).join(', ') : ''}`
          : 'Todos os dados recolhidos, sem filtro de atividade.'}</div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        ${ctx ? `<button class="btn-secondary" onclick="location.hash='#/digest'">${ico('doc')} Digest semanal</button>` : ''}
        <select id="ctx-select" style="width:auto" aria-label="Atividade">
          ${profiles.map((p) => `<option value="${p.id}" ${String(p.id) === ctx ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          <option value="" ${ctx === '' ? 'selected' : ''}>Todos os dados</option>
        </select>
        <button class="btn-secondary" onclick="location.hash='#/config/profiles'" title="Gerir perfis">${ico('building')} Gerir</button>
      </div>
    </div>
    ${active ? `<div class="cards" id="radar-stats"></div>` : ''}
    <div class="tabs">${tabs.map(([k, l]) =>
      `<button class="${k === tab ? 'active' : ''}" onclick="location.hash='#/radar/${k}'">${l}</button>`).join('')}</div>
    <div class="card" id="tab-content"><p class="muted">A carregar…</p></div>`;

  document.getElementById('ctx-select').onchange = (e) => { setCtx(e.target.value); renderRadar(tab); };

  if (active) {
    const fillStats = (p) => {
      const holder = document.getElementById('radar-stats');
      if (!holder) return;
      const running = p.runs?.[0] && p.runs[0].status !== 'completed' && p.runs[0].status !== 'failed';
      holder.innerHTML = `
        <div class="stat"><div class="n">${p.totals.n_contracts.toLocaleString('pt-PT')}</div><div class="l">Contratos</div></div>
        <div class="stat"><div class="n">${fmtCompact(p.totals.total_value)}</div><div class="l">Valor total</div></div>
        <div class="stat"><div class="n">${p.totals.n_announcements}</div><div class="l">Anúncios</div></div>
        <div class="stat accent"><div class="n">${p.totals.open_announcements}</div><div class="l">Concursos abertos</div></div>` +
        (p.totals.n_contracts === 0 && running
          ? `<p class="hint" style="flex-basis:100%">A primeira recolha deste perfil ainda está a decorrer — os números vão aparecendo à medida que o corpus é cruzado com os termos e CPV.</p>`
          : '');
    };
    // uma falha transitória (ex.: restart durante deploy) não deve deixar os cartões vazios
    api(`/api/profiles/${active.id}`).then(fillStats).catch(() => {
      setTimeout(() => api(`/api/profiles/${active.id}`).then(fillStats).catch(() => {}), 2500);
    });
  }

  await renderInsightTab(document.getElementById('tab-content'), `?profile_id=${ctx}`, tab, null);
}

/* ---------- Configuração: perfis, recolhas e dados abertos ---------- */
const CONFIG_SECTIONS = [['profiles', 'Perfis de atividade'], ['searches', 'Recolhas do site'], ['opendata', 'Dados abertos']];
function configTabs(active) {
  return `<div class="tabs">${CONFIG_SECTIONS.map(([k, l]) =>
    `<button class="${k === active ? 'active' : ''}" onclick="location.hash='#/config/${k}'">${l}</button>`).join('')}</div>`;
}

/* ---------- Detalhe de anúncio ---------- */
async function renderAnnouncement(id) {
  const a = await api(`/api/announcements/${id}?raw=1`);
  const raw = a.raw_detail_json ?? a.raw_list_json ?? {};
  app.innerHTML = `
    <div class="toolbar">
      <h2><span class="dot ${a.is_open ? 'open' : 'closed'}"></span> Anúncio ${esc(a.announcement_number ?? '#' + a.basegov_id)}</h2>
      <div>
        <a href="${esc(a.basegov_url)}" target="_blank" rel="noopener"><button class="btn-secondary">Ver no BASE ${ico('external')}</button></a>
        <button class="btn-secondary" onclick="history.back()">${ico('back')} Voltar</button>
      </div>
    </div>
    <div class="card">
      <dl class="detail">
        <dt>Designação</dt><dd>${esc(a.contract_designation ?? '—')}</dd>
        <dt>Entidade adjudicante</dt><dd>${esc(a.contracting_entity ?? (raw.contractingEntities ?? []).map((e) => e.description).join('; ') ?? '—')}</dd>
        <dt>Tipo de anúncio</dt><dd>${esc(a.announcement_type ?? '—')}</dd>
        <dt>Modelo / procedimento</dt><dd>${esc(a.model_type ?? a.contracting_procedure_type ?? '—')}</dd>
        <dt>Tipo de contrato</dt><dd>${esc(a.contract_type ?? '—')}</dd>
        <dt>Preço base</dt><dd>${fmtPrice(a.base_price)}</dd>
        <dt>Publicação em DR</dt><dd>${fmtDate(a.dr_publication_date)}</dd>
        <dt>Prazo de propostas</dt><dd><strong>${fmtDate(a.proposal_deadline_date)}</strong> ${a.is_open ? '(a decorrer)' : '(expirado)'} ${raw.proposalDeadline ? '· ' + esc(raw.proposalDeadline) : ''}</dd>
        <dt>CPV</dt><dd>${esc(a.cpvs ?? '—')}</dd>
        <dt>Peças do procedimento</dt><dd>${a.contracting_procedure_url ? `<a href="${esc(a.contracting_procedure_url)}" target="_blank" rel="noopener">${esc(a.contracting_procedure_url)}</a>` : '—'}</dd>
        <dt>Publicação DR (PDF)</dt><dd>${a.reference_url ? `<a href="${esc(a.reference_url)}" target="_blank" rel="noopener">${esc(a.reference_url)}</a>` : '—'}</dd>
        <dt>Nº DR / Série</dt><dd>${esc(raw.dreNumber ?? '—')} / ${esc(raw.dreSeries ?? '—')}</dd>
      </dl>
    </div>
    <div class="card" id="ai-card">
      <div class="toolbar"><h2 style="margin:0">Ficha de oportunidade (IA)</h2>
        <button id="ai-analyze-btn">${ico('search')} Analisar com IA</button></div>
      <p class="muted" id="ai-hint">Análise do anúncio publicado em DR, contextualizada à atividade selecionada no Radar: critérios, requisitos de habilitação, riscos e recomendação go/no-go. O resultado fica guardado (só paga uma vez).</p>
      <div id="ai-result"></div>
    </div>`;

  document.getElementById('ai-analyze-btn').onclick = async () => {
    const btn = document.getElementById('ai-analyze-btn');
    const out = document.getElementById('ai-result');
    btn.disabled = true;
    aiModalOpen([
      'A descarregar o anúncio publicado em Diário da República…',
      'A extrair o texto do documento oficial…',
      'A identificar critérios de adjudicação e ponderações…',
      'A levantar requisitos de habilitação, cauções e prazos…',
      'A avaliar o fit com a tua atividade…',
      'A procurar red flags no procedimento…',
      'A compilar a checklist e a recomendação go/no-go…',
    ]);
    try {
      const pid = Number(getCtx() || 0);
      const r = await api(`/api/announcements/${id}/analyze`, { method: 'POST', body: JSON.stringify({ profile_id: pid }) });
      out.innerHTML = renderAiFicha(r.analysis, r.cached, r.model) + `
        <p style="margin-top:0.6rem"><button class="btn-secondary" id="ai-template-btn">${ico('doc')} Gerar dossier de resposta (IA)</button></p>
        <div id="ai-template-out"></div>`;
      document.getElementById('ai-template-btn').onclick = async () => {
        const tbtn = document.getElementById('ai-template-btn');
        tbtn.disabled = true;
        aiModalOpen([
          'A reunir os critérios de adjudicação já extraídos…',
          'A montar a checklist de submissão na plataforma…',
          'A redigir a declaração do Anexo I do CCP…',
          'A estruturar a memória descritiva alinhada aos critérios…',
          'A preparar os placeholders da tua empresa…',
        ]);
        try {
          const t = await api(`/api/announcements/${id}/response-template`, { method: 'POST', body: JSON.stringify({ profile_id: pid }) });
          const blob = new Blob(['\ufeff<html><head><meta charset="utf-8"></head><body><pre style="font-family:Calibri,Arial,sans-serif;white-space:pre-wrap">' + t.markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></body></html>'], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          document.getElementById('ai-template-out').innerHTML = `
            <div class="card" style="margin-top:0.6rem">
              <div class="toolbar"><h3 style="margin:0">Dossier de resposta (com placeholders)</h3>
                <a href="${url}" download="dossier-resposta.doc"><button class="btn-secondary">${ico('download')} Descarregar .doc</button></a></div>
              <pre style="white-space:pre-wrap;font-size:0.85rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.9rem;max-height:480px;overflow:auto">${esc(t.markdown)}</pre>
            </div>`;
        } catch (err) {
          document.getElementById('ai-template-out').innerHTML = `<p class="error">${esc(err.message)}</p>`;
          tbtn.disabled = false;
        } finally { aiModalClose(); }
      };
    } catch (err) {
      out.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      btn.disabled = false;
    } finally { aiModalClose(); }
  };
}

function renderAiFicha(an, cached, model) {
  const badgeGo = { go: ['GO', '#15803d'], condicional: ['CONDICIONAL', '#b45309'], 'no-go': ['NO-GO', '#b91c1c'] }[an.go_no_go?.recomendacao] ?? ['?', '#64748b'];
  const list = (arr) => (arr?.length ? `<ul style="margin:0.2rem 0 0.6rem 1.2rem">${arr.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum.</p>');
  return `
    <div class="toolbar" style="margin-top:0.4rem">
      <span class="score" style="background:${badgeGo[1]};font-size:1rem;padding:0.3rem 0.9rem">${badgeGo[0]}</span>
      ${an.fit_atividade ? `<span>Fit com a atividade: <strong style="color:${fitColor(an.fit_atividade.score)}">${an.fit_atividade.score}/100</strong> — ${esc(an.fit_atividade.razao ?? '')}</span>` : ''}
    </div>
    <p><strong>${esc(an.go_no_go?.justificacao ?? '')}</strong></p>
    <dl class="detail">
      <dt>Resumo</dt><dd>${esc(an.resumo ?? '—')}</dd>
      <dt>Critérios de adjudicação</dt><dd>${esc(an.criterios_adjudicacao ?? '—')}</dd>
      <dt>Prazo de propostas</dt><dd>${esc(an.prazos?.propostas ?? '—')}</dd>
      <dt>Prazo de execução</dt><dd>${esc(an.prazos?.execucao ?? '—')}</dd>
      <dt>Preço base</dt><dd>${esc(an.preco_base ?? '—')}</dd>
      <dt>Caução / garantias</dt><dd>${esc(an.caucao_garantias ?? '—')}</dd>
    </dl>
    <h3>Requisitos de habilitação</h3>${list(an.requisitos_habilitacao)}
    <h3>Red flags</h3>${list(an.red_flags)}
    <h3>Checklist para a proposta</h3>${list(an.checklist)}
    <p class="muted">${cached ? 'Análise em cache' : 'Análise nova'} · modelo ${esc(model ?? '')}</p>`;
}

/* ---------- Digest semanal (página na app; layout de email fica no endpoint .html) ---------- */
async function renderDigest() {
  const ctx = getCtx();
  if (!ctx) { location.hash = '#/'; return; }
  app.innerHTML = '<div class="card"><p class="muted">A gerar o digest da semana…</p></div>';
  const d = await api(`/api/profiles/${ctx}/digest.json`);
  app.innerHTML = `
    <div class="toolbar">
      <div>
        <h2 style="margin:0">Digest semanal — ${esc(d.profile.name)}</h2>
        <div class="muted">Gerado a ${new Date(d.generated_at).toLocaleString('pt-PT')}</div>
      </div>
      <div>
        <a href="/api/profiles/${ctx}/digest.html" target="_blank" rel="noopener"><button class="btn-secondary">${ico('external')} Versão email</button></a>
        <button class="btn-secondary" onclick="location.hash='#/'">${ico('back')} Radar</button>
      </div>
    </div>
    ${d.intro ? `<div class="hint">${esc(d.intro)}</div>` : ''}
    <div class="cards">
      <div class="stat"><div class="n">${d.stats.open}</div><div class="l">Concursos abertos</div></div>
      <div class="stat"><div class="n">${d.stats.new_7d}</div><div class="l">Novos (7 dias)</div></div>
      <div class="stat"><div class="n">${d.stats.renewals_90d}</div><div class="l">Renovações 90 dias</div></div>
    </div>
    <div class="card">
      <h2>Concursos com prazo a decorrer</h2>
      ${d.open_announcements.length ? `<table><thead><tr><th>Prazo</th><th>Designação</th><th>Entidade</th><th>Preço base</th></tr></thead><tbody>
        ${d.open_announcements.map((a) => `<tr class="clickable" onclick="location.hash='#/announcements/${a.id}'">
          <td>${fmtDate(a.deadline)}</td>
          <td><a href="#/announcements/${a.id}" onclick="event.stopPropagation()">${esc((a.designation ?? '').slice(0, 100))}</a></td>
          <td>${esc(a.entity ?? '—')}</td><td>${fmtPrice(a.base_price)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Sem concursos abertos neste momento.</p>'}
    </div>
    <div class="card">
      <h2>Renovações a preparar (próximos 90 dias)</h2>
      ${d.renewals.length ? `<table><thead><tr><th>Termina</th><th>Entidade</th><th>Objeto</th><th>Valor</th></tr></thead><tbody>
        ${d.renewals.map((r) => `<tr class="clickable" onclick="location.hash='#/contracts/${r.id}'">
          <td>${fmtDate(r.end_date)} <span class="muted">(${r.days_left}d)</span></td>
          <td>${esc(r.entity ?? '—')}</td>
          <td><a href="#/contracts/${r.id}" onclick="event.stopPropagation()">${esc((r.object ?? '').slice(0, 90))}</a></td>
          <td>${fmtPrice(r.value)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Sem renovações no horizonte de 90 dias.</p>'}
    </div>
    <p class="muted">Fonte: Portal BASE — IMPIC / dados.gov.pt</p>`;
}

/* ---------- Dados abertos (histórico oficial IMPIC) ---------- */
async function renderOpendata() {
  const load = async () => {
    const d = await api('/api/opendata/imports');
    const totEl = document.getElementById('od-total');
    if (totEl) totEl.textContent = d.total_opendata_contracts.toLocaleString('pt-PT');
    const tbody = document.getElementById('od-table');
    if (tbody) {
      tbody.innerHTML = d.items.map((i) => `<tr>
        <td>${i.year}</td><td>${badge(i.status)}</td>
        <td>${(i.imported_rows ?? 0).toLocaleString('pt-PT')}${i.total_rows ? ' / ' + Number(i.total_rows).toLocaleString('pt-PT') : ''}</td>
        <td>${i.started_at ? new Date(i.started_at).toLocaleString('pt-PT') : '—'}</td>
        <td>${i.finished_at ? new Date(i.finished_at).toLocaleString('pt-PT') : '—'}</td>
        <td class="muted">${esc((i.error_message ?? '').slice(0, 80))}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum import ainda.</td></tr>';
    }
    if (!d.items.some((i) => ['pending', 'running'].includes(i.status))) stopPolling();
  };

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2012; y--) years.push(y);
  app.innerHTML = `
    ${configTabs('opendata')}
    <div class="card">
      <h2>Dados abertos do Portal BASE (IMPIC)</h2>
      <p class="muted">Fonte oficial do histórico: datasets anuais publicados pelo IMPIC em dados.gov.pt (atualização quinzenal) — os mesmos dados do site, sem risco de bloqueio.
      Os contratos importados alimentam automaticamente as pesquisas, perfis e insights. Os PDFs dos documentos e os dados mais recentes que a última publicação continuam a vir do robot.</p>
      <p><strong><span id="od-total">…</span></strong> contratos em base de dados vindos de dados abertos.</p>
      <form class="inline" id="od-form">
        <select name="year">${years.map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
        <button type="submit">Importar ano</button>
        <button type="button" id="od-all" class="btn-secondary">Importar tudo (2012-${years[0]})</button>
      </form>
      <div class="error" id="od-error"></div>
    </div>
    <div class="card">
      <h2>Imports</h2>
      <table>
        <thead><tr><th>Ano</th><th>Estado</th><th>Contratos</th><th>Início</th><th>Fim</th><th>Erro</th></tr></thead>
        <tbody id="od-table"><tr><td colspan="6" class="muted">A carregar…</td></tr></tbody>
      </table>
    </div>`;

  const submit = async (yearsList) => {
    try {
      await api('/api/opendata/import', { method: 'POST', body: JSON.stringify({ years: yearsList }) });
      await load();
      stopPolling();
      pollTimer = setInterval(load, 4000);
    } catch (err) {
      document.getElementById('od-error').textContent = err.message;
    }
  };
  document.getElementById('od-form').onsubmit = (e) => {
    e.preventDefault();
    submit([Number(new FormData(e.target).get('year'))]);
  };
  document.getElementById('od-all').onclick = () => submit(years);

  await load();
  stopPolling();
  pollTimer = setInterval(load, 4000);
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
        ${r.recent_contracts.map((c) => `<tr class="clickable" onclick="location.hash='#/contracts/${c.id}'"><td>${fmtDate(c.publication_date)}</td>
          <td><a href="#/contracts/${c.id}" onclick="event.stopPropagation()">${esc(c.object_brief_description ?? '')}</a></td>
          <td>${fmtPrice(c.initial_contractual_price)}</td><td>${fmtDate(c.end_date)}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;
  app.innerHTML = `
    <div class="toolbar">
      <h2>${esc(e.name)} ${e.nif ? `<span class="muted">· NIF ${esc(e.nif)}</span>` : ''}</h2>
      <button class="btn-secondary" onclick="history.back()">${ico('back')} Voltar</button>
    </div>
    ${e.as_contracting.n_contracts ? roleBlock(e.as_contracting, 'Como adjudicante (comprador)', 'Fornecedores') : ''}
    ${e.as_contracted.n_contracts ? roleBlock(e.as_contracted, 'Como adjudicatária (fornecedor)', 'Clientes') : ''}`;
}

/* ---------- Router ---------- */
async function route() {
  stopPolling();
  hideMatrixTip();
  const hash = location.hash || '#/';
  document.body.classList.toggle('login-bg', hash === '#/login');
  // Estado ativo da navegação (aspeto de segmented control)
  document.querySelectorAll('header nav a').forEach((a) => {
    const href = a.getAttribute('href');
    const on = href === '#/'
      ? !(hash.startsWith('#/entities') || hash.startsWith('#/config') || hash.startsWith('#/profiles') || hash === '#/login')
      : hash.startsWith(href) || (href === '#/config' && hash.startsWith('#/profiles'));
    a.classList.toggle('active', on);
  });
  if (hash === '#/login') { window._me = null; return renderLogin(); }
  if (hash === '#/registo') { window._me = null; return renderRegister(); }

  // Sessão em cache: evita uma ida ao servidor por cada mudança de página.
  // Se expirar, a primeira chamada api() da vista devolve 401 e redireciona.
  if (!window._me) {
    try {
      window._me = await api('/api/auth/me');
    } catch {
      return; /* api() já redirecionou para login */
    }
  }
  topbar.hidden = false;
  whoami.textContent = window._me.username;
  renderTrialBanner(window._me);
  if (hash === '#/subscrever') return renderSubscribe();
  // Feedback imediato ao navegar — o conteúdo real substitui quando os dados chegam.
  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';

  const results = hash.match(/^#\/searches\/(\d+)(?:\?page=(\d+))?$/);
  const contract = hash.match(/^#\/contracts\/(\d+)$/);
  const profile = hash.match(/^#\/profiles\/(\d+)(?:\/(\w+))?$/);
  const entity = hash.match(/^#\/entities\/(\d+)$/);
  const radar = hash.match(/^#\/(?:radar|insights)(?:\/(\w+))?$/);
  const config = hash.match(/^#\/config(?:\/(\w+))?$/);
  const announcement = hash.match(/^#\/announcements\/(\d+)$/);
  document.querySelector('main')?.classList.remove('wide');
  try {
    if (results) return await renderResults(Number(results[1]), Number(results[2] ?? 0));
    if (contract) return await renderContract(Number(contract[1]));
    if (profile) return await renderProfile(Number(profile[1]), profile[2] || 'opportunities');
    if (radar) return await renderRadar(radar[1] || 'opportunities');
    if (config) {
      const section = config[1] || 'profiles';
      if (section === 'searches') return await renderSearches();
      if (section === 'opendata') return await renderOpendata();
      return await renderProfiles();
    }
    // rotas antigas → novos destinos
    if (hash === '#/profiles') return await renderProfiles();
    if (hash === '#/opendata') return await renderOpendata();
    if (hash === '#/digest') return await renderDigest();
    if (entity) return await renderEntity(Number(entity[1]));
    if (hash === '#/entities') return await renderEntities();
    if (announcement) return await renderAnnouncement(Number(announcement[1]));
    return await renderRadar('opportunities');
  } catch (err) {
    if (err.message !== 'unauthorized') app.innerHTML = `<div class="card error">${esc(err.message)}</div>`;
  }
}

document.getElementById('logout-btn').onclick = async () => {
  window._me = null;
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.hash = '#/login';
};

window.addEventListener('hashchange', route);
route();
