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
    ? ` <span class="badge" style="background:#e4efe8;color:#2c6353;border-color:#cfe2d6">faltam ${diff} dia(s)</span>`
    : ` <span class="badge" style="background:#eef1ef;color:#4c5551">terminou há ${-diff} dia(s)</span>`;
};
const fmtCompact = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }) + ' €');
const fmtEuro0 = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + ' €');
const dPtShort = (v) => (v ? new Date(v).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '—');
const fmtDatePt = (v) => (v ? new Date(v).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const daysUntil = (v) => (v ? Math.round((new Date(v) - new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null);
/* Acordo-quadro: canal de venda distinto (contratação centralizada/ESPAP). */
const isAcordoQuadro = (o) => /acordo[-\s]?quadro/i.test([o?.contract_designation, o?.announcement_type, o?.model_type, o?.contracting_procedure_type, o?.contract_type].filter(Boolean).join(' '));
const AQ_BADGE = '<span class="badge" style="background:#e4efe8;color:#2c6353;border-color:#cfe2d6" title="Acordo-quadro — canal de contratação centralizada">AQ</span>';
/* Pares tint (fundo, texto) do design system v2 — chips de score/estado. */
const scorePair = (s) => (s >= 70 ? ['#e4efe8', '#2c6353'] : s >= 45 ? ['#fdf6e8', '#8a6a1e'] : ['#eef1ef', '#7d8681']);
const scoreChip = (s, title) => {
  const [bg, fg] = scorePair(s);
  return `<span class="score" style="background:${bg};color:${fg}"${title ? ` title="${title}"` : ''}>${s}</span>`;
};
const FIT_BG = '#e4efe8', FIT_FG = '#2c6353';
const fitChip = (f, title) => `<span class="score" style="background:${FIT_BG};color:${FIT_FG}"${title ? ` title="${title}"` : ''}>${f}</span>`;
const typeChip = (t) => (t === 'anuncio_aberto'
  ? '<span class="badge" style="background:#f7e9e4;color:#c2543a;border-color:#ecc9bf">Concurso</span>'
  : '<span class="badge" style="background:#fdf6e8;color:#8a6a1e;border-color:#ecd9ac">Renovação</span>');
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
  chevron: '<path d="M6 9l6 6 6-6"/>',
};
const ico = (name, size = 15) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px">${ICON_PATHS[name] ?? ''}</svg>`;

/* Wordmark BaseRadar (igual ao do header). */
const wordmark = (size = 20) =>
  `<span class="wordmark"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 15 0"/><path d="M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 12l6.5 6.5"/></svg><span>Base<span class="accent">Radar</span></span></span>`;

/* Donut de score (0-100). Circunferência do arco (r=22) ≈ 138. */
const scoreDonut = (score, color, size = 52) => {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const dash = `${Math.round((s / 100) * 138)} 138`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 52 52" aria-hidden="true">
    <circle cx="26" cy="26" r="22" fill="none" stroke="#eef1ef" stroke-width="5"></circle>
    <circle cx="26" cy="26" r="22" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${dash}" stroke-linecap="round" transform="rotate(-90 26 26)"></circle>
    <text x="26" y="30" font-size="14" font-weight="700" text-anchor="middle" fill="#191c1e" font-family="Schibsted Grotesk">${s}</text></svg>`;
};

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    if (location.hash !== '#/login') location.hash = '#/login';
    throw new Error('unauthorized');
  }
  if (res.status === 402) {
    // Subscrição necessária (trial terminado) — encaminha para a página de planos.
    if (location.hash !== '#/planos') location.hash = '#/planos';
    throw new Error('subscription_required');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 403 por plano: funcionalidade fora do plano atual (backend é a verdade).
    if (res.status === 403 && body?.error?.code === 'plan_required') {
      const err = new Error(body.error.message || 'Funcionalidade indisponível no seu plano.');
      err.planRequired = body.error;   // { feature, required_plan, current_plan }
      throw err;
    }
    throw new Error(body?.error?.message || `Erro HTTP ${res.status}`);
  }
  return res.json();
}

/* Capabilities do plano (espelho do backend). O backend é sempre a verdade;
   isto serve só para a UI antecipar o gating e mostrar upgrades. */
async function loadCaps(force = false) {
  if (window._caps && !force) return window._caps;
  try { window._caps = await api('/api/me/capabilities'); } catch { window._caps = null; }
  return window._caps;
}
function can(feature) {
  const c = window._caps;
  if (!c) return true;               // sem info ainda → não bloqueia a UI (backend valida)
  if (window._me?.is_admin) return true;
  return Array.isArray(c.capabilities) && c.capabilities.includes(feature);
}
const PLAN_LABEL = { free: 'Grátis', pro: 'Pro', business: 'Business' };

// Mapa item de navegação → feature exigida (vazio = livre no plano free).
const NAV_FEATURE = {
  '#/radar/opportunities': 'score_fit',
  '#/radar/renewals': 'renovacoes',
  '#/radar/competitors': 'concorrentes',
  '#/entities': 'entidades',
};
/* Marca visualmente os itens de navegação fora do plano (cadeado). O clique
   continua a funcionar — o backend responde 403 e a vista mostra o upgrade. */
function applyNavGating() {
  document.querySelectorAll('#topbar nav a').forEach((a) => {
    const feat = NAV_FEATURE[a.getAttribute('href')];
    const locked = feat && !can(feat);
    a.classList.toggle('nav-locked', !!locked);
    a.querySelector('.nav-lock')?.remove();
    if (locked) a.insertAdjacentHTML('beforeend', ' <span class="nav-lock" aria-hidden="true" title="Plano superior">🔒</span>');
  });
}

/* Painel de upgrade mostrado quando uma vista bate num 403 de plano. */
function upgradePanel(info) {
  const req = (info?.required_plan || 'pro').toUpperCase();
  return `<div class="card upgrade-card" style="max-width:560px;margin:2rem auto;text-align:center">
    <div class="eyebrow" style="color:var(--brand)">Plano ${req}</div>
    <h2 style="margin:.4rem 0 .3rem">Funcionalidade do plano ${req}</h2>
    <p class="muted" style="margin:0 0 1rem">${esc(info?.message || 'Esta funcionalidade requer um plano superior.')}</p>
    <p><a class="btn" href="#/planos" style="display:inline-block;padding:.6rem 1.2rem;background:var(--brand);color:#fff;border-radius:8px;text-decoration:none">Ver planos</a></p>
  </div>`;
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function hideTrialBanner() { const t = document.getElementById('trial-banner'); if (t) { t.hidden = true; t.innerHTML = ''; } }

/* Mensagens de validação do browser em português (por omissão vêm no idioma do browser). */
function localizeValidation(form) {
  if (!form) return;
  const msg = (el) => {
    const v = el.validity;
    if (v.valueMissing) return el.type === 'checkbox' ? 'Assinale esta opção.' : 'Preencha este campo.';
    if (v.typeMismatch && el.type === 'email') return 'Introduza um email válido (ex.: nome@empresa.pt).';
    if (v.patternMismatch) return el.name === 'nif' ? 'O NIF tem de ter 9 dígitos.' : 'O formato não é válido.';
    if (v.tooShort) return `Use pelo menos ${el.minLength} caracteres.`;
    if (v.tooLong) return `Use no máximo ${el.maxLength} caracteres.`;
    if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch) return 'Valor fora do intervalo permitido.';
    return 'Valor inválido.';
  };
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('invalid', () => el.setCustomValidity(msg(el)));
    el.addEventListener('input', () => el.setCustomValidity(''));
    el.addEventListener('change', () => el.setCustomValidity(''));
  });
}

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
  localizeValidation(document.getElementById('login-form'));
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
      <h2 style="margin:0.4rem 0 0.2rem">Comece grátis</h2>
      <p class="muted" style="margin:0 0 1rem">Sem cartão. Diga-nos a sua atividade e o radar fica pré-configurado. Pode experimentar o Pro 7 dias grátis a qualquer momento.</p>
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
        <p class="muted" style="font-size:0.8rem">A conta começa no plano Grátis. Desbloqueie score, IA e renovações com o Pro (7 dias grátis, sem cartão) ou o Business.</p>
        <p class="muted" style="font-size:0.78rem">Ao criar conta, aceita os <a href="/termos" target="_blank" rel="noopener">Termos e Condições</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</p>
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
  localizeValidation(document.getElementById('reg-form'));

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
  if (!c || me.is_admin) { host.hidden = true; host.innerHTML = ''; return; }
  const plan = me.plan || 'free';
  let title = '';
  let sub = '';
  let cls = 'trial';
  let cta = 'Ver planos';
  if (c.subscription_status === 'trialing' && plan !== 'free') {
    const d = c.trial_days_left;
    title = `Teste Pro — ${d} dia${d === 1 ? '' : 's'}`;
    sub = 'Subscreva para manter o acesso Pro.'; cta = 'Subscrever';
  } else if (c.subscription_status === 'past_due') {
    cls = 'past-due'; title = 'Pagamento pendente'; sub = 'Regularize para manter o plano.'; cta = 'Regularizar';
  } else if (plan === 'free') {
    // Convite discreto a experimentar/upgrade — sem alarme (o free é um plano válido).
    title = 'Plano Grátis'; sub = 'Desbloqueie score, IA e renovações.'; cta = 'Fazer upgrade';
  } else {
    host.hidden = true; host.innerHTML = ''; return;   // Pro/Business ativos: sem banner
  }
  host.hidden = false;
  host.className = cls;
  host.innerHTML = `<div class="tb-title">${title}</div><div class="tb-sub">${sub}</div><a href="#/planos">${cta}</a>`;
}

/* Preenche o bloco "Atividade" da barra lateral com o perfil ativo. */
async function updateSidebar() {
  const el = document.getElementById('side-activity');
  if (!el) return;
  try {
    const { items: profiles } = await api('/api/profiles');
    window._profiles = profiles;
    if (!profiles.length) { el.innerHTML = ''; return; }
    let ctx = getCtx();
    if (ctx && !profiles.some((p) => String(p.id) === ctx)) ctx = '';
    const active = profiles.find((p) => String(p.id) === ctx) ?? profiles[0];
    const nT = active.terms?.length ?? 0;
    const nC = (active.cpv_codes ?? []).length;
    const sched = { diaria: 'diária', semanal: 'semanal', mensal: 'mensal' }[active.schedule] ?? (active.schedule || '—');
    el.innerHTML = `<div class="side-section">
      <div class="lbl">ATIVIDADE</div>
      <a class="side-activity" href="#/config/profiles">
        <div class="top"><span class="nm">${esc(active.name)}</span>${ico('chevron', 13)}</div>
        <div class="mt">${nT} termo${nT === 1 ? '' : 's'} · ${nC} CPV · recolha ${esc(sched)}</div>
      </a>
    </div>`;
  } catch { /* silencioso — não bloqueia a navegação */ }
}

/* ---------- Planos (grátis / pro / business): trial, upgrade e pagamento ---------- */
const eur = (cents) => (cents / 100).toLocaleString('pt-PT', { minimumFractionDigits: cents % 100 ? 2 : 0 });
const PLAN_FEATURES = {
  free: ['Concursos abertos', 'Mapa e sazonalidade', 'Digest semanal'],
  pro: ['Tudo do Grátis', 'Oportunidades com score + fit IA', 'Radar de renovações', 'Concursos europeus (TED)', 'Análise IA do caderno de encargos', 'Concorrentes e entidades', 'Exportação Excel', '2 utilizadores'],
  business: ['Tudo do Pro', 'Até 10 utilizadores (seats)', 'Integração API (CRM / ERP)', 'Uso elevado de IA', 'Exportação avançada'],
};

async function renderPlans() {
  topbar.hidden = false;
  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';
  let cat, summary;
  try {
    [cat, summary] = await Promise.all([api('/api/plans'), api('/api/billing/summary')]);
  } catch { return; }
  await loadCaps(true);
  const current = summary.plan || 'free';
  const c = summary.company || {};
  const canTrial = current === 'free' && c.trial_ends_at == null;

  const card = (p) => {
    const isCurrent = p.key === current;
    const paid = p.key !== 'free';
    let cta = '';
    if (isCurrent) cta = `<button class="btn-secondary" disabled>Plano atual</button>`;
    else if (p.key === 'free') cta = '';
    else if (p.key === 'pro' && canTrial) cta = `<button class="plan-cta" data-act="trial">Experimentar 7 dias grátis</button>`;
    else cta = `<button class="plan-cta" data-plan="${p.key}" data-act="checkout">${current === 'free' ? 'Subscrever' : 'Mudar para ' + PLAN_LABEL[p.key]}</button>`;
    return `<div class="plan-box${isCurrent ? ' current' : ''}" style="flex:1;min-width:210px;border:1px solid ${isCurrent ? 'var(--brand)' : 'var(--line,#e2e8f0)'};border-radius:12px;padding:1.1rem;display:flex;flex-direction:column;gap:.6rem">
      <div class="eyebrow" style="color:var(--brand)">${PLAN_LABEL[p.key]}</div>
      <div style="font-size:1.7rem;font-weight:700">${paid ? eur(p.price_cents) + ' €' : 'Grátis'}${paid ? '<span style="font-size:.8rem;font-weight:400;color:var(--muted,#64748b)"> + IVA / mês</span>' : ''}</div>
      <ul style="list-style:none;padding:0;margin:.2rem 0;font-size:.85rem;line-height:1.7">${(PLAN_FEATURES[p.key] || []).map((f) => `<li>✓ ${esc(f)}</li>`).join('')}</ul>
      <div style="margin-top:auto">${cta}</div>
    </div>`;
  };

  app.innerHTML = `
    <div class="card" style="max-width:900px;margin:1.5rem auto">
      <div class="eyebrow" style="color:var(--brand)">Planos</div>
      <h2 style="margin:.3rem 0 .2rem">Escolha o seu plano</h2>
      <p class="muted" style="margin:0 0 1rem">Plano atual: <strong>${PLAN_LABEL[current]}</strong>${
        c.subscription_status === 'trialing' && c.trial_days_left != null ? ` · teste Pro termina em ${c.trial_days_left} dia(s)` : ''}</p>
      <div class="inline" style="gap:1rem;flex-wrap:wrap;align-items:stretch">${(cat.plans || []).map(card).join('')}</div>
      ${!cat.billing_enabled ? '<div class="hint" style="margin-top:1rem">Os pagamentos ainda não estão ativos nesta instalação. O teste gratuito funciona; para subscrever contacte o suporte.</div>' : ''}
      <div id="plan-method" style="margin-top:1rem"></div>
      <div id="plan-result" style="margin-top:1rem"></div>
      <p style="margin-top:1.2rem"><a href="#/conta">← Conta e subscrição</a></p>
    </div>`;

  app.querySelectorAll('.plan-cta').forEach((b) => {
    b.onclick = async () => {
      const out = document.getElementById('plan-result');
      if (b.dataset.act === 'trial') {
        out.innerHTML = '<p class="muted">A ativar o teste…</p>';
        try {
          await api('/api/billing/trial', { method: 'POST' });
          window._me = null; await loadCaps(true);
          out.innerHTML = '<div class="hint">Teste Pro de 7 dias ativado! A recarregar…</div>';
          setTimeout(() => { location.hash = '#/hoje'; }, 900);
        } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
        return;
      }
      // checkout: escolher a forma de pagamento (subscrição cartão vs pontual)
      const plan = b.dataset.plan;
      const methods = document.getElementById('plan-method');
      methods.innerHTML = `<p style="margin:0 0 .5rem">Como quer pagar o plano <strong>${PLAN_LABEL[plan]}</strong>?</p>
        <div class="inline" style="gap:.5rem;flex-wrap:wrap">
          <button class="pay-mode" data-mode="subscription" data-plan="${plan}">Cartão — subscrição automática</button>
          <button class="pay-mode btn-secondary" data-mode="payment" data-plan="${plan}">MB WAY / Multibanco / transferência — 1 mês</button>
        </div>
        <p class="muted" style="font-size:.8rem;margin:.5rem 0 0">O cartão renova automaticamente todos os meses. Os restantes métodos são um pagamento único de 1 mês.</p>`;
      methods.querySelectorAll('.pay-mode').forEach((pm) => {
        pm.onclick = async () => {
          out.innerHTML = '<p class="muted">A abrir o pagamento seguro…</p>';
          try {
            const r = await api('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: pm.dataset.plan, mode: pm.dataset.mode }) });
            if (r.url) { location.href = r.url; return; }   // redireciona para o Stripe Checkout
            out.innerHTML = '<p class="error">Não foi possível iniciar o pagamento.</p>';
          } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
        };
      });
    };
  });
}

/* ---------- Conta: plano, uso de IA e equipa (seats) ---------- */
async function renderAccount() {
  topbar.hidden = false;
  const paid = /[?&]pago=1/.test(location.hash);
  if (paid) { window._me = null; window._caps = null; }   // força releitura do plano após pagamento
  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';
  let caps, summary, seats;
  try {
    [caps, summary] = await Promise.all([api('/api/me/capabilities'), api('/api/billing/summary')]);
  } catch { return; }
  window._caps = caps;
  try { seats = await api('/api/seats'); } catch { seats = null; }
  const c = summary.company || {};
  const plan = caps.plan || 'free';
  const statusLabel = { trialing: 'Em teste', active: 'Ativa', past_due: 'Pagamento pendente', canceled: 'Cancelada' }[c.subscription_status] || c.subscription_status || '—';
  const ai = caps.ai_usage || { used: 0, cap: 0, enabled: false };
  const pct = ai.cap > 0 ? Math.min(100, Math.round((ai.used / ai.cap) * 100)) : 0;
  const seatMax = caps.seats?.max ?? 1;
  const seatUsed = caps.seats?.used ?? 1;

  app.innerHTML = `
    <div class="card" style="max-width:820px;margin:1.5rem auto">
      <div class="eyebrow" style="color:var(--brand)">Conta</div>
      ${paid ? '<div class="hint" style="margin:.4rem 0">Pagamento recebido. Assim que for confirmado pelo banco, o plano é ativado automaticamente — pode demorar alguns instantes nos métodos MB WAY / Multibanco / transferência.</div>' : ''}
      <h2 style="margin:.3rem 0 .2rem">${esc(c.name ?? window._me?.username ?? '')}</h2>
      <p class="muted" style="margin:0 0 1.2rem">${esc(window._me?.username ?? '')}${c.nif ? ' · NIF ' + esc(c.nif) : ''}</p>

      <div class="inline" style="gap:1rem;flex-wrap:wrap;align-items:stretch">
        <div style="flex:1;min-width:220px;border:1px solid var(--line,#e2e8f0);border-radius:12px;padding:1rem">
          <div class="lbl" style="font-size:.7rem;letter-spacing:.06em;color:var(--muted,#64748b);text-transform:uppercase">Plano</div>
          <div style="font-size:1.4rem;font-weight:700;margin:.2rem 0">${PLAN_LABEL[plan]}</div>
          <div class="muted" style="font-size:.85rem">Estado: ${esc(statusLabel)}${
            c.subscription_status === 'trialing' && c.trial_days_left != null ? ` · ${c.trial_days_left} dia(s) restantes` : ''}${
            c.renewal_at ? ` · renova a ${new Date(c.renewal_at).toLocaleDateString('pt-PT')}` : ''}</div>
          <p style="margin:.8rem 0 0"><a class="btn" href="#/planos" style="display:inline-block;padding:.45rem .9rem;background:var(--brand);color:#fff;border-radius:8px;text-decoration:none;font-size:.85rem">${plan === 'business' ? 'Ver planos' : 'Fazer upgrade'}</a></p>
        </div>

        <div style="flex:1;min-width:220px;border:1px solid var(--line,#e2e8f0);border-radius:12px;padding:1rem">
          <div class="lbl" style="font-size:.7rem;letter-spacing:.06em;color:var(--muted,#64748b);text-transform:uppercase">Análises de IA este mês</div>
          <div style="font-size:1.4rem;font-weight:700;margin:.2rem 0">${ai.used}${ai.cap > 0 ? ` <span style="font-size:.9rem;font-weight:400;color:var(--muted,#64748b)">/ ${ai.cap}</span>` : ''}</div>
          ${ai.cap > 0 ? `<div style="height:6px;background:var(--panel-2,#eef2f7);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct >= 100 ? '#e11d48' : 'var(--brand)'}"></div></div>` : '<div class="muted" style="font-size:.85rem">Sem análises de IA no plano Grátis.</div>'}
          <div class="muted" style="font-size:.78rem;margin-top:.5rem">${ai.enabled ? 'O teto é indicativo — avisamos, não bloqueamos.' : 'Contagem informativa; sem bloqueio.'}</div>
        </div>
      </div>

      ${renderSeatsBlock(seats, seatUsed, seatMax, plan)}
    </div>`;

  wireSeats();
}

function renderSeatsBlock(seats, used, max, plan) {
  const canInvite = max > used;
  const members = (seats?.members || []).map((m) => `
    <tr><td>${esc([m.first_name, m.last_name].filter(Boolean).join(' ') || m.username)}</td>
        <td class="muted">${esc(m.email || m.username)}</td>
        <td>${m.is_admin ? '<span class="chip">admin</span>' : ''}</td>
        <td style="text-align:right">${m.id === window._me?.user_id || (seats?.members || []).length <= 1 ? '' : `<button class="lnk seat-rm" data-id="${m.id}" style="color:#e11d48">Remover</button>`}</td></tr>`).join('');
  const invites = (seats?.invites || []).map((i) => `
    <tr><td colspan="2" class="muted">${esc(i.email)} <span class="chip">convite pendente</span></td><td></td>
        <td style="text-align:right"><button class="lnk seat-inv-rm" data-id="${i.id}" style="color:#e11d48">Cancelar</button></td></tr>`).join('');
  return `
    <div style="margin-top:1.4rem;border-top:1px solid var(--line,#e2e8f0);padding-top:1rem">
      <div class="inline" style="justify-content:space-between;align-items:baseline">
        <h3 style="margin:0">Equipa <span class="muted" style="font-size:.85rem;font-weight:400">(${used}/${max} lugares)</span></h3>
      </div>
      <table style="width:100%;margin-top:.6rem;font-size:.9rem"><tbody>${members}${invites || ''}</tbody></table>
      ${max <= 1
        ? '<div class="hint" style="margin-top:.8rem">O plano atual permite apenas 1 utilizador. Faça upgrade para convidar a sua equipa.</div>'
        : canInvite
          ? `<div class="inline" style="gap:.5rem;margin-top:.8rem">
               <input type="email" id="seat-email" placeholder="email@empresa.pt" style="flex:1">
               <button id="seat-invite">Convidar</button>
             </div><div id="seat-result" style="margin-top:.5rem"></div>`
          : '<div class="hint" style="margin-top:.8rem">Limite de lugares atingido para o plano atual.</div>'}
    </div>`;
}

function wireSeats() {
  const inviteBtn = document.getElementById('seat-invite');
  if (inviteBtn) inviteBtn.onclick = async () => {
    const email = document.getElementById('seat-email').value.trim();
    const out = document.getElementById('seat-result');
    out.innerHTML = '<span class="muted">A convidar…</span>';
    try {
      const r = await api('/api/seats/invite', { method: 'POST', body: JSON.stringify({ email }) });
      out.innerHTML = `<div class="hint">Convite criado para ${esc(email)}. Link de aceitação: <code>${esc(location.origin + r.accept_url)}</code></div>`;
      setTimeout(renderAccount, 1400);
    } catch (err) { out.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
  };
  document.querySelectorAll('.seat-rm').forEach((b) => b.onclick = async () => {
    if (!confirm('Remover este utilizador da empresa?')) return;
    try { await api('/api/seats/' + b.dataset.id, { method: 'DELETE' }); renderAccount(); } catch (err) { alert(err.message); }
  });
  document.querySelectorAll('.seat-inv-rm').forEach((b) => b.onclick = async () => {
    try { await api('/api/seats/invites/' + b.dataset.id, { method: 'DELETE' }); renderAccount(); } catch (err) { alert(err.message); }
  });
}

/* ---------- Aceitar convite de equipa ---------- */
async function renderAcceptInvite(token) {
  topbar.hidden = true;
  document.body.classList.add('login-bg');
  app.innerHTML = '<div class="card login-box"><p class="muted">A validar convite…</p></div>';
  let inv;
  try { inv = await api('/api/public/invite/' + encodeURIComponent(token)); }
  catch (err) { app.innerHTML = `<div class="card login-box">${wordmark(24)}<div class="error" style="margin-top:1rem">${esc(err.message)}</div><p class="login-foot"><a href="#/login">Entrar</a></p></div>`; return; }
  app.innerHTML = `
    <div class="card login-box">
      ${wordmark(24)}
      <h2 style="margin:.4rem 0 .2rem">Juntar-se à equipa</h2>
      <p class="muted" style="margin:0 0 1rem">Convite para <strong>${esc(inv.company_name)}</strong> (${esc(inv.email)}).</p>
      <form id="inv-form">
        <div class="reg-grid">
          <div><label>Primeiro nome *</label><input type="text" name="first_name" required></div>
          <div><label>Apelido</label><input type="text" name="last_name"></div>
        </div>
        <label>Password *</label><input type="password" name="password" minlength="8" autocomplete="new-password" required>
        <div class="error" id="inv-error" style="margin-top:.6rem"></div>
        <p style="margin-top:.8rem"><button type="submit">Criar conta e entrar</button></p>
      </form>
    </div>`;
  localizeValidation(document.getElementById('inv-form'));
  document.getElementById('inv-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/public/invite/accept', { method: 'POST', body: JSON.stringify({
        token, password: fd.get('password'), first_name: fd.get('first_name'), last_name: fd.get('last_name') }) });
      window._me = null; window._caps = null;
      location.hash = '#/hoje';
    } catch (err) { document.getElementById('inv-error').textContent = err.message; }
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
          ${can('export_excel') ? `<a href="/api/searches/${search.id}/export.xlsx"><button>${ico('download')} Exportar Excel</button></a>` : ''}
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
  const dPt = (v) => (v ? new Date(v).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const firstEnt = (role) => (c.entities?.[role] ?? [])[0] ?? null;
  const entLine = (role) => (c.entities?.[role] ?? []).map((e) =>
    (e.id ? `<a href="#/entities/${e.id}" style="font-weight:600;border-bottom:1px solid var(--border-btn)">${esc(e.name)}</a>` : `<span style="font-weight:600">${esc(e.name)}</span>`)
    + (e.nif ? ` <span class="nif">NIF ${esc(e.nif)}</span>` : '')).join(' · ') || '—';
  const concorrentes = (c.entities?.contestant ?? []).map((e) => esc(e.name)).join(' · ') || '—';
  const isRenewal = c.estimated_end_date && new Date(c.estimated_end_date) >= new Date(new Date().toISOString().slice(0, 10));

  const docs = (c.documents ?? []).map((d) => {
    const ok = d.download_ok;
    return `<div class="doc-row ${ok ? '' : 'pend'}">
      <span class="fn">${ico('doc', 15)}${ok ? `<a href="${d.download_url}">${esc(d.file_name)}</a>` : `<span>${esc(d.file_name)}</span>`}</span>
      <span class="sz">${d.size_bytes ? (d.size_bytes / 1024).toFixed(1) + ' KB' : '—'}</span>
      <span class="st ${ok ? 'ok' : 'pend'}">${ok ? 'GUARDADO' : 'PENDENTE'}</span>
    </div>`;
  }).join('');

  // Cronologia — só entradas com data válida, por ordem cronológica
  const crono = [];
  if (c.publication_date) crono.push({ d: c.publication_date, dot: '#9aa6a0', label: 'publicação no BASE' });
  if (c.signing_date) crono.push({ d: c.signing_date, dot: '#9aa6a0', label: `celebração${c.execution_deadline ? ` · prazo ${esc(String(c.execution_deadline))}` : ''}` });
  if (c.estimated_end_date) {
    const contactar = new Date(Math.max(Date.now(), new Date(c.estimated_end_date).getTime() - 120 * 86400000)).toISOString().slice(0, 10);
    crono.push({ d: contactar, dot: '#c99a3c', label: 'contacto comercial sugerido' });
    crono.push({ d: c.estimated_end_date, dot: '#c2543a', label: 'fim previsto — renovação', strong: true });
  }
  crono.sort((a, b) => new Date(a.d) - new Date(b.d));
  const cronoHtml = crono.map((r, i) => `<div class="crono-row">
    <div class="crono-mark"><span class="crono-dot" style="background:${r.dot}"></span>${i < crono.length - 1 ? '<span class="crono-line"></span>' : ''}</div>
    <div class="body"><b${r.strong ? ' style="color:#c2543a"' : ''}>${dPt(r.d)}</b> · ${r.label}</div></div>`).join('');

  // Badge do fim previsto
  let fimBadge = '';
  if (c.estimated_end_date) {
    const diff = Math.round((new Date(c.estimated_end_date) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
    fimBadge = diff >= 0
      ? `<span class="fim-badge">FALTAM ${diff} DIAS</span>`
      : `<span class="fim-badge past">HÁ ${-diff} DIAS</span>`;
  }
  const adj = firstEnt('contracting');

  app.innerHTML = `
    <div class="dcrumb"><a href="#/hoje">Hoje</a> → <a href="#/radar/renewals">Renovações</a> → <span class="cur">Contrato BASE #${c.basegov_id}</span></div>
    <div class="d-head">
      <div style="min-width:0">
        <div class="d-tags">
          ${isRenewal ? '<span class="d-tag brand">RENOVAÇÃO</span>' : ''}
          ${c.contracting_procedure_type ? `<span class="d-tag">${esc(String(c.contracting_procedure_type).toUpperCase())}</span>` : ''}
          ${c.contract_types ? `<span class="d-tag">${esc(String(c.contract_types).toUpperCase())}</span>` : ''}
        </div>
        <h1>${esc(c.object_brief_description ?? `Contrato #${c.basegov_id}`)}</h1>
        ${c.description ? `<p class="lead">${esc(c.description)}</p>` : ''}
      </div>
      <div class="d-actions">
        <button id="ai-contract-btn">${ico('search')} ${isRenewal ? 'Preparar renovação com IA' : 'Analisar com IA'}</button>
        <a href="${esc(c.basegov_url)}" target="_blank" rel="noopener"><button class="btn-secondary">Ver no BASE ${ico('external')}</button></a>
      </div>
    </div>
    <div class="d-grid">
      <div>
        <div class="d-card">
          <div class="t">Partes e enquadramento</div>
          <div class="parts">
            <span class="lb">Adjudicante</span><span>${entLine('contracting')}</span>
            <span class="lb">Adjudicatário</span><span>${entLine('contracted')}</span>
            <span class="lb">Concorrentes</span><span>${concorrentes}</span>
            <span class="lb">Local de execução</span><span>${esc(c.execution_place ?? '—')}</span>
            <span class="lb">CPV</span><span>${esc(c.cpvs ?? '—')}${c.cpvs_designation ? ' · ' + esc(c.cpvs_designation) : ''}</span>
            <span class="lb">Fundamentação</span><span>${esc(c.contract_fundamentation ?? '—')}</span>
            <span class="lb">Regime</span><span>${esc(c.regime ?? '—')}</span>
          </div>
        </div>
        ${(c.documents ?? []).length ? `<div class="d-card">
          <div class="t">Documentos · ${(c.documents ?? []).length}</div>
          <div>${docs}</div>
        </div>` : ''}
        ${(c.modifications ?? []).length ? `<div class="d-card">
          <div class="t">Modificações ao contrato · ${c.modifications.length}</div>
          <div class="crono">
            ${c.modifications.map((mo, i) => `<div class="crono-row">
              <div class="crono-mark"><span class="crono-dot" style="background:#c99a3c"></span>${i < c.modifications.length - 1 ? '<span class="crono-line"></span>' : ''}</div>
              <div class="body">${mo.date ? `<b>${fmtDate(mo.date)}</b> · ` : ''}${esc(mo.label)}${mo.price_text ? ` <span class="muted">(${esc(mo.price_text)})</span>` : ''}</div>
            </div>`).join('')}
          </div>
          <p class="small-print" style="margin-top:10px">Adendas/prorrogações registadas no BASE — sinal de contrato que costuma ser ajustado (e de incumbente a defender a posição).</p>
        </div>` : ''}
        <div id="ai-contract-result"></div>
      </div>
      <div>
        <div class="d-price">
          <div class="k">PREÇO CONTRATUAL</div>
          <div class="big">${fmtPrice(c.initial_contractual_price)}</div>
          ${(() => {
            const ini = Number(c.initial_contractual_price), eff = Number(c.total_effective_price);
            if (c.total_effective_price == null) return '';
            const diverge = Number.isFinite(ini) && Number.isFinite(eff) && ini > 0 && Math.abs(eff - ini) / ini >= 0.005;
            const pct = diverge ? Math.round(((eff - ini) / ini) * 100) : 0;
            return `<div class="eff">preço efetivo: ${fmtPrice(c.total_effective_price)}${diverge ? ` <span class="fim-badge" style="background:#e9b99a">${pct > 0 ? '+' : ''}${pct}% · contrato modificado</span>` : ''}</div>`;
          })()}
          <div class="sep">
            <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="k">FIM PREVISTO</span>${fimBadge}</div>
            ${c.estimated_end_date
              ? `<div class="fim">${dPt(c.estimated_end_date)}</div>
                 <p class="est">Estimado: celebração (${dPt(c.signing_date)})${c.execution_deadline ? ' + ' + esc(String(c.execution_deadline)) : ''}.</p>`
              : '<p class="est">Sem data de celebração ou prazo no BASE — não é possível estimar.</p>'}
          </div>
        </div>
        ${cronoHtml ? `<div class="d-card"><div class="t">Cronologia</div><div class="crono">${cronoHtml}</div></div>` : ''}
        ${adj ? `<div class="d-card">
          <div class="t">A entidade compra</div>
          <p style="font-size:12.5px;color:var(--ink-2);margin:0;line-height:1.6">Consulte o histórico de contratos, valores e adjudicatários de <b>${esc(adj.name)}</b> para preparar a abordagem.</p>
          ${adj.id ? `<a href="#/entities/${adj.id}" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:600;border-bottom:1px solid var(--border-btn)">Ficha da entidade →</a>` : ''}
        </div>` : ''}
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
      out.innerHTML = `<div class="d-card aificha-card">${renderAiFicha(r.analysis, r.cached, r.model)}${
        r.docs_used === 0 ? '<p class="hint">Nenhum documento PDF disponível para este contrato — a análise usou apenas os dados estruturados. Para análises completas, ativa "Descarregar documentos PDF" na pesquisa/perfil.</p>' : ''}</div>`;
      out.scrollIntoView({ block: 'nearest' });
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
    const scoreBarColor = (o) => (o.type === 'anuncio_aberto' ? '#c2543a' : o.score >= 70 ? '#173f35' : o.score >= 50 ? '#5e8a7a' : '#9aa6a0');
    const subLine = (o) => {
      if (o.type === 'anuncio_aberto') return `CONCURSO ABERTO · prazo de propostas a ${o.days_left} dias`;
      return o.recurrence && o.recurrence > 1
        ? `RENOVAÇÃO · entidade recorrente (${o.recurrence}×)`
        : `RENOVAÇÃO · termina em ${o.days_left} dias`;
    };
    const oppRow = (o) => {
      const f = fits[fitKey(o)];
      const urgent = o.type === 'anuncio_aberto' || (o.days_left != null && o.days_left <= 30);
      return `<div class="opp-tr body" onclick="location.hash='${esc(o.internal_url ?? o.basegov_url)}'">
        <div class="opp-score"><b>${o.score}</b><div class="track"><div class="fill" style="width:${Math.min(100, o.score)}%;background:${scoreBarColor(o)}"></div></div></div>
        <span class="opp-fit ${f ? '' : 'none'}"${f && f.reason ? ` title="${esc(f.reason)}"` : ''}>${f ? f.fit : '—'}</span>
        <div><div class="ti">${esc(o.title ?? '')}</div><div class="sub">${esc(subLine(o))}</div></div>
        <span class="ent">${esc(o.entity ?? '—')}</span>
        <span class="val">${fmtEuro0(o.value)}</span>
        <span class="dat ${urgent ? 'urgent' : ''}">${o.key_date ? `${dPtShort(o.key_date)} · ${o.days_left}d` : '—'}</span>
      </div>`;
    };
    el.innerHTML = `<div class="toolbar"><div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0">Oportunidades</h1>
        <div class="muted" style="margin-top:3px">Concursos abertos e renovações previsíveis, ordenados por score (valor, urgência, recorrência da entidade).</div></div>
      <form class="opp-search" onsubmit="event.preventDefault(); window._oppFilter=this.q.value; window._oppReload();">
        ${ico('search', 14)}<input type="text" name="q" value="${esc(kw)}" placeholder="Filtrar por objeto ou entidade">
      </form></div>
      ${matrix}
      ${q.includes('profile_id=') && !q.endsWith('profile_id=') ? `<p class="muted" style="margin:0.2rem 0 0.6rem" id="fit-status"></p>` : ''}
      <div class="opp-t">
        <div class="opp-tr head"><span>SCORE</span><span class="fh">FIT IA</span><span>OPORTUNIDADE</span><span class="eh">ENTIDADE</span><span class="val">VALOR</span><span class="dat dh">DATA-CHAVE</span></div>
        ${d.items.map(oppRow).join('') || '<div class="opp-tr" style="color:var(--muted)">Sem oportunidades ativas — executa o perfil ou alarga os termos.</div>'}
      </div>`;
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
        <td><a href="#/announcements/${a.id}" onclick="event.stopPropagation()">${esc(a.contract_designation ?? '')}</a>${isAcordoQuadro(a) ? ' ' + AQ_BADGE : ''}</td>
        <td>${esc(a.contracting_entity ?? '—')}</td>
        <td>${esc(a.contracting_procedure_type ?? '—')}</td>
        <td>${fmtPrice(a.base_price)}</td></tr>`;
      }).join('') || `<tr><td colspan="6" class="muted">${showAll ? 'Sem anúncios recolhidos.' : 'Sem concursos abertos neste momento — ativa "mostrar expirados" para ver o histórico.'}</td></tr>`}
      </tbody></table>
      <div style="margin-top:1.4rem">
        <div class="sec-head"><span class="sd" style="background:#173f35"></span><span class="st">Concursos europeus (TED)</span><span class="sh">acima dos limiares UE · fonte Tenders Electronic Daily</span></div>
        <div id="ted-panel" class="card" style="margin:0"><p class="muted" style="margin:0">A procurar no TED…</p></div>
      </div>`;
    // TED carrega em separado — não bloqueia a lista do BASE nem quebra se falhar.
    api(`/api/insights/ted${q}`).then((t) => {
      const host = document.getElementById('ted-panel');
      if (!host) return;
      const items = t.items ?? [];
      if (!items.length) {
        host.innerHTML = `<p class="muted" style="margin:0">${t.error ? 'TED indisponível de momento.' : 'Sem concursos europeus ativos para esta atividade (a maioria dos contratos desta área fica abaixo dos limiares UE).'}</p>`;
        return;
      }
      host.style.padding = '0';
      host.innerHTML = `<div class="opp-t" style="border:0;box-shadow:none">
        <div class="opp-tr head" style="grid-template-columns:120px minmax(0,1fr) 200px 118px"><span>PRAZO</span><span>CONCURSO</span><span>ENTIDADE</span><span class="dat">PUBLICADO</span></div>
        ${items.map((n) => `<div class="opp-tr body" style="grid-template-columns:120px minmax(0,1fr) 200px 118px" onclick="window.open('${esc(n.url)}','_blank')">
          <span class="dat ${n.days_left != null && n.days_left <= 30 ? 'urgent' : ''}" style="text-align:left">${n.deadline ? `${dPtShort(n.deadline)}${n.days_left != null ? ` · ${n.days_left}d` : ''}` : '—'}</span>
          <div><div class="ti">${esc(n.title)}${/acordo[-\s]?quadro|framework/i.test(n.title) ? ' ' + AQ_BADGE : ''}</div><div class="sub">${esc((n.cpvs || []).slice(0, 3).join(' · '))} · abrir no TED ↗</div></div>
          <span class="ent">${esc(n.buyer)}</span>
          <span class="dat">${n.publication_date ? dPtShort(n.publication_date) : '—'}</span>
        </div>`).join('')}
      </div>`;
    }).catch(() => {
      const host = document.getElementById('ted-panel');
      if (host) host.innerHTML = '<p class="muted" style="margin:0">TED indisponível de momento.</p>';
    });
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
      </div>
      <div id="region-tables" class="region-tables"></div>`;

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
    const maxShare = Math.max(1, ...d.items.map((c) => Number(c.share_pct) || 0));
    const ownNif = (window._me?.company?.nif || '').replace(/\D/g, '');
    const quotaColor = (share, own) => (own ? '#c2543a'
      : share >= 25 ? '#173f35' : share >= 15 ? '#2c6353' : share >= 8 ? '#5e8a7a' : '#8fb3a4');
    const row = (c) => {
      const own = ownNif && String(c.nif ?? '').replace(/\D/g, '') === ownNif;
      const share = Number(c.share_pct) || 0;
      const w = Math.round((share / maxShare) * 100);
      return `<div class="comp-row body" onclick="location.hash='#/entities/${c.id}'">
        <div class="nm">${esc(c.name)}${own ? ' <span class="own">(a sua)</span>' : ''}<div class="nif">NIF ${esc(c.nif ?? '—')}</div></div>
        <span class="r">${c.n_contracts}</span>
        <span class="r b">${fmtCompact(c.total_value)}</span>
        <span class="r m">${fmtCompact(c.avg_value)}</span>
        <div class="comp-quota"><div class="track"><div class="fill" style="width:${w}%;background:${quotaColor(share, own)}"></div></div><span class="pct">${c.share_pct != null ? c.share_pct + '%' : '—'}</span></div>
        <span class="cli">${esc(c.top_clients ?? '—')}</span>
      </div>`;
    };
    el.innerHTML = `<h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0">Concorrentes</h1>
      <div class="muted" style="margin:3px 0 18px">Adjudicatários com contratos na sua atividade — quota, valores médios e clientes.</div>
      <div class="comp-table">
        <div class="comp-row head"><span>CONCORRENTE</span><span class="r">CONTRATOS</span><span class="r">TOTAL</span><span class="r mh">MÉDIO</span><span class="qh">QUOTA</span><span class="ch">PRINCIPAIS CLIENTES</span></div>
        ${d.items.map(row).join('') || '<div class="comp-row"><span class="muted">Sem dados.</span></div>'}
      </div>`;
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
  const tables = document.getElementById('region-tables');
  if (!panel) return;
  panel.innerHTML = '<p class="muted">A carregar dados do distrito…</p>';
  if (tables) tables.innerHTML = '';
  const d = await api(`/api/insights/region${q}&district=${encodeURIComponent(district)}`);
  const maxY = Math.max(1, ...d.by_year.map((y) => y.count));
  const maxM = Math.max(1, ...d.by_month.map((m) => m.count));
  // À direita do mapa: título + gráficos (evolução anual e sazonalidade).
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
    </div></div>`;
  // Por baixo do mapa (largura total): renovações e contratos recentes.
  if (tables) tables.innerHTML = `
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

const fitColor = (f) => (f >= 75 ? '#173f35' : f >= 45 ? '#c99a3c' : '#9aa6a0');

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
    const color = fit ? fitColor(fit.fit) : (o.type === 'anuncio_aberto' ? '#c2543a' : '#173f35');
    const r = 3 + Math.min(11, Math.sqrt(o.value / maxVal) * 11);
    return `<a href="${esc(o.internal_url ?? '#')}"><circle data-mi="${i}" cx="${x(Number(o.days_left))}" cy="${y(o.value)}" r="${r}"
      fill="${color}" fill-opacity="0.55" stroke="${color}" style="cursor:pointer"></circle></a>`;
  };

  return `<div class="card" style="overflow-x:auto;margin:0.6rem 0">
    <h3 style="margin:0 0 0.2rem">Matriz de priorização</h3>
    <p class="muted" style="margin:0 0 0.4rem">Cima-esquerda = agir já (valor alto, prazo próximo). Dimensão da bolha = valor do negócio. ${Object.keys(fits ?? {}).length ? 'Cor = fit IA (verde alto).' : 'Vermelho = concurso aberto, verde = renovação.'}</p>
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
const MAP_COLORS = ['#dfe7e2', '#a7cdbc', '#3f8a70', '#173f35'];
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

/* ---------- Hoje: painel diário de ação (agrega os insights existentes) ---------- */
async function renderHoje() {
  const profilesData = await api('/api/profiles');
  const profiles = profilesData.items;
  if (profiles.length === 0) return renderRadar('opportunities'); // reencaminha ao onboarding

  let ctx = getCtx();
  if (ctx && !profiles.some((p) => String(p.id) === ctx)) ctx = '';
  const pid = ctx || String(profiles[0].id);
  const active = profiles.find((p) => String(p.id) === pid) ?? profiles[0];

  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';
  const q = `?profile_id=${pid}`;
  const [opp, prof, mapData, compData] = await Promise.all([
    api(`/api/insights/opportunities${q}`).catch(() => ({ items: [] })),
    api(`/api/profiles/${pid}`).catch(() => null),
    api(`/api/insights/map${q}`).catch(() => ({ items: [] })),
    api(`/api/insights/competitors${q}`).catch(() => ({ items: [] })),
  ]);
  const items = opp.items ?? [];
  const withDays = items.filter((o) => o.days_left != null);
  const agir = withDays.filter((o) => o.days_left <= 30).sort((a, b) => b.score - a.score).slice(0, 4);
  const preparar = withDays.filter((o) => o.type === 'renovacao' && o.days_left > 30 && o.days_left <= 183)
    .sort((a, b) => a.days_left - b.days_left).slice(0, 5);
  const monitorizar = withDays.filter((o) => o.days_left > 183).sort((a, b) => b.score - a.score);

  const jogo = withDays.filter((o) => o.days_left <= 90 && o.value);
  const jogoTotal = jogo.reduce((s, o) => s + (o.value || 0), 0);
  const jogoConc = jogo.filter((o) => o.type === 'anuncio_aberto').length;
  const jogoRenov = jogo.filter((o) => o.type === 'renovacao').length;
  const nRenov12 = items.filter((o) => o.type === 'renovacao').length;
  const totals = prof?.totals ?? {};
  const fitCache = window._fitCache?.[q] ?? {};
  const fitKey = (o) => `${o.type}:${o.type === 'anuncio_aberto' ? o.announcement_id : o.contract_id}`;

  const h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const firstName = esc((window._me?.username || '').split(/[\s@]/)[0] || 'Olá');
  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const contactar = (keyDate) => {
    if (!keyDate) return '—';
    const d = new Date(Math.max(Date.now(), new Date(keyDate).getTime() - 120 * 86400000));
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  };
  const chipText = (o) => (o.type === 'anuncio_aberto' ? `CONCURSO · ${o.days_left}d` : 'RENOVAÇÃO');
  const chipCls = (o) => (o.type === 'anuncio_aberto' ? 'concurso' : 'renovacao');

  const agirCard = (o) => {
    const fit = fitCache[fitKey(o)];
    return `<div class="opp-card" onclick="location.hash='${esc(o.internal_url ?? '#')}'">
      ${scoreDonut(o.score, o.type === 'anuncio_aberto' ? '#c2543a' : '#c99a3c')}
      <div style="min-width:0">
        <div class="k"><span class="mini-chip ${chipCls(o)}">${esc(chipText(o))}</span>${fit ? `<span class="fit">fit IA ${fit.fit}/100</span>` : ''}</div>
        <div class="ti">${esc(o.title ?? '')}</div>
        <div class="su">${esc(o.entity ?? '—')}${o.value != null ? ' · ' + fmtCompact(o.value) : ''}</div>
      </div>
      <div class="opp-actions">
        <a class="btn primary" href="${esc(o.internal_url ?? '#')}" onclick="event.stopPropagation()">Analisar com IA</a>
        <a class="btn ghost" href="${esc(o.basegov_url ?? '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ver peças</a>
      </div></div>`;
  };
  const prepRow = (o) => `<div class="prep-row" onclick="location.hash='${esc(o.internal_url ?? '#')}'">
    ${scoreDonut(o.score, '#c99a3c', 44)}
    <div><div class="ti">${esc(o.title ?? '')}</div><div class="su">${esc(o.entity ?? '—')}</div></div>
    <div class="cd">contactar até<br><b>${contactar(o.key_date)}</b></div>
    <div class="vl">${fmtCompact(o.value)}</div></div>`;

  const maxMoney = Math.max(1, ...(mapData.items ?? []).map((d) => d.total_value));
  const money = (mapData.items ?? []).filter((d) => d.district !== 'Desconhecido').slice(0, 5).map((d) => {
    const pct = Math.round((d.total_value / maxMoney) * 100);
    return `<div class="money-row"><span class="nm">${esc(d.district)}</span>
      <div class="track"><div class="fill" style="width:${pct}%;background:${mapColor(d.total_value, maxMoney)}"></div></div>
      <span class="vl">${fmtCompact(d.total_value)}</span></div>`;
  }).join('');

  const top = (compData.items ?? [])[0];
  const competCard = top
    ? `<div class="mini-card compet-card">
        <div class="head"><span class="t">Concorrência</span><a href="#/radar/competitors">ver análise →</a></div>
        <p>O <b>${esc(top.name)}</b> lidera a sua área com ${top.share_pct != null ? top.share_pct + '%' : '—'} de quota (${top.n_contracts} contrato${top.n_contracts === 1 ? '' : 's'}).${nRenov12 ? ' As renovações são a melhor via para ganhar terreno.' : ''}</p>
      </div>`
    : `<div class="mini-card">
        <div class="head"><span class="t">Atividade</span><a href="#/config/profiles">gerir →</a></div>
        <p class="compet-card">${esc(active.name)} — ${active.terms.map(esc).join(', ')}.</p>
      </div>`;

  app.innerHTML = `
    <div class="hoje-head">
      <div>
        <div class="day">${esc(today.charAt(0).toUpperCase() + today.slice(1))}</div>
        <h1>${greet}, ${firstName}. ${agir.length ? `Há <span class="u">${agir.length} oportunidade${agir.length === 1 ? '' : 's'}</span> para agir.` : 'Sem prazos urgentes esta semana.'}</h1>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex:none">
        <select id="ctx-select" style="width:auto" aria-label="Atividade">
          ${profiles.map((p) => `<option value="${p.id}" ${String(p.id) === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <button class="btn-secondary" onclick="location.hash='#/digest'">${ico('doc')} Digest semanal</button>
      </div>
    </div>
    <div class="hoje-grid">
      <div class="hoje-col">
        <div>
          <div class="sec-head"><span class="sd" style="background:#c2543a"></span><span class="st">Agir esta semana</span><span class="sh">prazo &lt; 30 dias</span></div>
          <div class="opp-cards">${agir.map(agirCard).join('') || '<div class="card" style="margin:0"><p class="muted" style="margin:0">Sem oportunidades com prazo nos próximos 30 dias.</p></div>'}</div>
        </div>
        <div>
          <div class="sec-head"><span class="sd" style="background:#c99a3c"></span><span class="st">Preparar</span><span class="sh">renovações a 1-6 meses</span></div>
          ${preparar.length ? `<div class="prep-card">${preparar.map(prepRow).join('')}</div>` : '<div class="card" style="margin:0"><p class="muted" style="margin:0">Sem renovações nesta janela.</p></div>'}
        </div>
        ${monitorizar.length ? `<div>
          <div class="sec-head"><span class="sd" style="background:#9aa6a0"></span><span class="st">Monitorizar</span><a class="sh" href="#/radar/opportunities">${monitorizar.length} oportunidade${monitorizar.length === 1 ? '' : 's'} a mais de 6 meses · ver todas →</a></div>
          <div class="monitor-card">${monitorizar.slice(0, 4).map((o) => `<span><b>${esc(o.entity ?? '—')}</b> · ${esc((o.title ?? '').slice(0, 44))} · ${fmtCompact(o.value)}</span>`).join('')}</div>
        </div>` : ''}
      </div>
      <div class="hoje-col hoje-right" style="gap:14px">
        <div class="injogo-card">
          <div class="k">EM JOGO · PRÓXIMOS 90 DIAS</div>
          <div class="big">${fmtCompact(jogoTotal)}</div>
          <div class="sub">${jogo.length} procedimento${jogo.length === 1 ? '' : 's'} · ${jogoConc} concurso${jogoConc === 1 ? '' : 's'} + ${jogoRenov} renovaç${jogoRenov === 1 ? 'ão' : 'ões'}</div>
          <div class="injogo-stats">
            <div><div class="n">${totals.open_announcements ?? jogoConc}</div><div class="l">concursos abertos</div></div>
            <div><div class="n">${nRenov12}</div><div class="l">renovações 12m</div></div>
            <div><div class="n">${(totals.n_contracts ?? 0).toLocaleString('pt-PT')}</div><div class="l">contratos</div></div>
          </div>
        </div>
        ${money ? `<div class="mini-card">
          <div class="head"><span class="t">Onde está o dinheiro</span><a href="#/radar/map">ver mapa →</a></div>
          ${money}
        </div>` : ''}
        ${competCard}
      </div>
    </div>`;

  const sel = document.getElementById('ctx-select');
  if (sel) sel.onchange = (e) => { setCtx(e.target.value); renderHoje(); };
}

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

  // A navegação entre vistas (Oportunidades/Renovações/Mapa/…) vive agora na
  // barra lateral; aqui fica apenas o contexto de atividade e os KPIs.
  app.innerHTML = `
    <div class="toolbar">
      <div>
        <div class="eyebrow">Radar comercial</div>
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
  const dl = daysUntil(a.proposal_deadline_date);
  let prazoBadge = '';
  if (dl != null) {
    prazoBadge = a.is_open && dl >= 0
      ? `<span class="fim-badge">FALTAM ${dl} DIAS</span>`
      : `<span class="fim-badge past">EXPIRADO</span>`;
  }
  const crono = [];
  if (a.dr_publication_date) crono.push({ d: a.dr_publication_date, dot: '#9aa6a0', label: 'publicação em Diário da República' });
  if (a.proposal_deadline_date) crono.push({ d: a.proposal_deadline_date, dot: a.is_open ? '#c2543a' : '#9aa6a0', label: `prazo de propostas${a.is_open ? ' — a decorrer' : ' — expirado'}`, strong: a.is_open });
  crono.sort((x, y) => new Date(x.d) - new Date(y.d));
  const cronoHtml = crono.map((r, i) => `<div class="crono-row">
    <div class="crono-mark"><span class="crono-dot" style="background:${r.dot}"></span>${i < crono.length - 1 ? '<span class="crono-line"></span>' : ''}</div>
    <div class="body"><b${r.strong ? ' style="color:#c2543a"' : ''}>${fmtDatePt(r.d)}</b> · ${r.label}</div></div>`).join('');

  app.innerHTML = `
    <div class="dcrumb"><a href="#/hoje">Hoje</a> → <a href="#/radar/announcements">Concursos</a> → <span class="cur">Anúncio ${esc(a.announcement_number ?? '#' + a.basegov_id)}</span></div>
    <div class="d-head">
      <div style="min-width:0">
        <div class="d-tags">
          <span class="d-tag ${a.is_open ? 'brand' : ''}">${a.is_open ? 'CONCURSO ABERTO' : 'EXPIRADO'}</span>
          ${isAcordoQuadro(a) ? '<span class="d-tag brand">ACORDO-QUADRO</span>' : ''}
          ${a.contracting_procedure_type || a.model_type ? `<span class="d-tag">${esc(String(a.model_type ?? a.contracting_procedure_type).toUpperCase())}</span>` : ''}
          ${a.contract_type ? `<span class="d-tag">${esc(String(a.contract_type).toUpperCase())}</span>` : ''}
        </div>
        <h1>${esc(a.contract_designation ?? `Anúncio #${a.basegov_id}`)}</h1>
      </div>
      <div class="d-actions">
        <button id="ai-analyze-btn">${ico('search')} Analisar com IA</button>
        <a href="${esc(a.basegov_url)}" target="_blank" rel="noopener"><button class="btn-secondary">Ver no BASE ${ico('external')}</button></a>
      </div>
    </div>
    <div class="d-grid">
      <div>
        <div class="d-card">
          <div class="t">Partes e enquadramento</div>
          <div class="parts">
            <span class="lb">Entidade adjudicante</span><span style="font-weight:600">${esc(a.contracting_entity ?? (raw.contractingEntities ?? []).map((e) => e.description).join('; ') ?? '—')}</span>
            <span class="lb">Tipo de anúncio</span><span>${esc(a.announcement_type ?? '—')}</span>
            <span class="lb">Modelo / procedimento</span><span>${esc(a.model_type ?? a.contracting_procedure_type ?? '—')}</span>
            <span class="lb">Tipo de contrato</span><span>${esc(a.contract_type ?? '—')}</span>
            <span class="lb">CPV</span><span>${esc(a.cpvs ?? '—')}</span>
            <span class="lb">Peças do procedimento</span><span>${a.contracting_procedure_url ? `<a href="${esc(a.contracting_procedure_url)}" target="_blank" rel="noopener" style="border-bottom:1px solid var(--border-btn)">abrir na plataforma ↗</a>` : '—'}</span>
            <span class="lb">Publicação DR (PDF)</span><span>${a.reference_url ? `<a href="${esc(a.reference_url)}" target="_blank" rel="noopener" style="border-bottom:1px solid var(--border-btn)">ver no Diário da República ↗</a>` : '—'}${raw.dreNumber ? ` · DR n.º ${esc(raw.dreNumber)}, série ${esc(raw.dreSeries ?? '—')}` : ''}</span>
          </div>
        </div>
        <div id="ai-result"></div>
      </div>
      <div>
        <div class="d-price">
          <div class="k">PREÇO BASE</div>
          <div class="big">${fmtPrice(a.base_price)}</div>
          <div class="sep">
            <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="k">PRAZO DE PROPOSTAS</span>${prazoBadge}</div>
            <div class="fim">${fmtDatePt(a.proposal_deadline_date)}</div>
            ${raw.proposalDeadline ? `<p class="est">No detalhe do BASE: ${esc(raw.proposalDeadline)}.</p>` : ''}
          </div>
        </div>
        ${cronoHtml ? `<div class="d-card"><div class="t">Cronologia</div><div class="crono">${cronoHtml}</div></div>` : ''}
        <div class="d-card">
          <div class="t">Ficha de oportunidade (IA)</div>
          <p style="font-size:12.5px;color:var(--ink-2);margin:0;line-height:1.6">Análise do anúncio contextualizada à tua atividade: critérios, requisitos de habilitação, riscos e recomendação go/no-go. O resultado fica guardado.</p>
        </div>
      </div>
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
      const docNote = r.docs_used > 0
        ? `<p class="hint" style="background:var(--ok-bg);border-color:var(--ok-border);color:var(--brand-text)">Análise fundamentada em ${r.docs_used} documento(s) das peças do procedimento.</p>`
        : r.docs_used === 0
          ? '<p class="hint">Peças do procedimento não acessíveis publicamente (plataforma sem descarga direta ou com registo) — análise com o anúncio do DR e dados estruturados.</p>'
          : '';
      out.innerHTML = `<div class="d-card aificha-card">${renderAiFicha(r.analysis, r.cached, r.model)}${docNote}
        <p style="margin-top:0.6rem"><button class="btn-secondary" id="ai-template-btn">${ico('doc')} Gerar dossier de resposta (IA)</button></p>
        <div id="ai-template-out"></div></div>`;
      out.scrollIntoView({ block: 'nearest' });
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
  // recomendação → [rótulo, cor da etiqueta, classe do destaque]
  const rec = an.go_no_go?.recomendacao;
  const badgeGo = { go: ['GO', '#2c6353', 'go'], condicional: ['CONDICIONAL', '#b26a00', 'condicional'], 'no-go': ['NO-GO', '#c2543a', 'nogo'] }[rec] ?? ['?', '#7d8681', 'condicional'];
  const list = (arr) => (arr?.length ? `<ul style="margin:0.2rem 0 0.6rem 1.2rem">${arr.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum.</p>');
  return `
    <div class="ai-verdict">
      <span class="ai-badge" style="background:${badgeGo[1]}">${badgeGo[0]}</span>
      ${an.fit_atividade ? `<span>Fit com a atividade: <strong style="color:${fitColor(an.fit_atividade.score)}">${an.fit_atividade.score}/100</strong> — ${esc(an.fit_atividade.razao ?? '')}</span>` : ''}
    </div>
    ${an.go_no_go?.justificacao ? `<div class="ai-callout ${badgeGo[2]}">${esc(an.go_no_go.justificacao)}</div>` : ''}
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
    <p class="muted">${cached ? 'Análise em cache' : 'Análise nova'}</p>`;
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

/* ---------- Entidades (lista) ---------- */
async function renderEntities(role = 'contracting', q = '') {
  const d = await api(`/api/entities?role=${role}&q=${encodeURIComponent(q)}&size=50`);
  app.innerHTML = `
    <div class="toolbar">
      <div><h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0">Entidades</h1>
        <div class="muted" style="margin-top:3px">Compradores públicos e fornecedores com histórico na base.</div></div>
      <div class="ent-toggle">
        <button class="${role === 'contracting' ? 'on' : ''}" onclick="renderEntities('contracting')">Adjudicantes</button>
        <button class="${role === 'contracted' ? 'on' : ''}" onclick="renderEntities('contracted')">Adjudicatárias</button>
      </div>
    </div>
    <form class="opp-search" id="ent-search" style="margin:0 0 12px">
      ${ico('search', 14)}<input type="text" name="q" placeholder="Pesquisar por nome ou NIF" value="${esc(q)}">
    </form>
    <div class="ent-list">
      <div class="ent-row head"><span>NOME</span><span class="nifh">NIF</span><span class="r">CONTRATOS</span><span class="r th">VALOR TOTAL</span><span class="r uh">ÚLTIMO CONTRATO</span></div>
      ${d.items.map((e) => `<div class="ent-row body" onclick="location.hash='#/entities/${e.id}'">
        <span class="nm">${esc(e.name)}</span>
        <span class="nif">${esc(e.nif ?? '—')}</span>
        <span class="r">${e.n_contracts}</span>
        <span class="r b">${fmtCompact(e.total_value)}</span>
        <span class="r m ult">${fmtDate(e.last_contract)}</span>
      </div>`).join('') || '<div class="ent-row"><span class="muted">Sem entidades.</span></div>'}
    </div>`;
  document.getElementById('ent-search').onsubmit = (e) => {
    e.preventDefault();
    renderEntities(role, new FormData(e.target).get('q'));
  };
}
window.renderEntities = renderEntities;

/* ---------- Entidade (ficha) ---------- */
async function renderEntity(id) {
  const e = await api(`/api/entities/${id}`);
  const isBuyer = (e.as_contracting?.n_contracts ?? 0) >= (e.as_contracted?.n_contracts ?? 0);
  const r = isBuyer ? e.as_contracting : e.as_contracted;
  const roleLabel = isBuyer ? 'comprador público' : 'fornecedor';
  const topProc = (r.procedure_types ?? [])[0];
  const years = (r.by_year ?? []).map((y) => y.year).filter(Boolean);
  const sinceYear = years.length ? Math.min(...years) : null;
  const counterLabel = isBuyer ? 'Fornecedores habituais' : 'Clientes habituais';
  // Próxima janela: contrato recente com fim previsto no futuro mais próximo
  const future = (r.recent_contracts ?? [])
    .filter((c) => c.end_date && new Date(c.end_date) >= new Date(new Date().toISOString().slice(0, 10)))
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))[0];

  // Enriquecimento derivado do corpus (sem fontes externas): tendência,
  // concentração de clientes/fornecedores, canal de acordo-quadro e — para
  // adjudicatárias — um sinal de vulnerabilidade (= oportunidade de disputa).
  const yrs = (r.by_year ?? []).slice().sort((a, b) => b.year - a.year);
  let trend = null;
  if (yrs[0] && yrs[1] && (yrs[1].total_value ?? 0) > 0) {
    const rel = ((yrs[0].total_value ?? 0) - yrs[1].total_value) / yrs[1].total_value;
    trend = rel > 0.15 ? 'up' : rel < -0.15 ? 'down' : 'flat';
  }
  const topCp = (r.counterparts ?? [])[0];
  const conc = topCp && r.total_value > 0 ? Math.round((topCp.total_value / r.total_value) * 100) : null;
  const usesAQ = (r.procedure_types ?? []).some((pt) => /acordo[-\s]?quadro/i.test(pt.type || ''));
  const vulnerable = !isBuyer && trend === 'down' && conc != null && conc >= 50;
  const signals = [];
  if (trend) signals.push(`Atividade <b style="color:${trend === 'up' ? '#2c6353' : trend === 'down' ? '#c2543a' : '#4c5551'}">${trend === 'up' ? 'em crescimento' : trend === 'down' ? 'em declínio' : 'estável'}</b> face ao ano anterior.`);
  if (conc != null && topCp) signals.push(`<b>${conc}%</b> do valor ${isBuyer ? 'adjudicado a' : 'proveniente de'} <b>${esc(topCp.name)}</b>${conc >= 50 ? ' — dependência elevada.' : '.'}`);
  if (usesAQ) signals.push(isBuyer ? 'Compra ao abrigo de <b>acordos-quadro</b> — para fornecer é preciso estar no AQ.' : 'Fornece ao abrigo de <b>acordos-quadro</b>.');

  const recent = (r.recent_contracts ?? []).slice(0, 8).map((c) => `<div class="row" onclick="location.hash='#/contracts/${c.id}'">
    <span class="pub">${fmtDate(c.publication_date)}</span>
    <span class="obj">${esc(c.object_brief_description ?? '—')}</span>
    <span class="val">${fmtCompact(c.initial_contractual_price)}</span>
    <span class="ter">${c.end_date ? fmtDate(c.end_date) : '—'}</span>
  </div>`).join('') || '<div class="row"><span class="muted" style="grid-column:1/-1">Sem contratos.</span></div>';

  app.innerHTML = `
    <div class="dcrumb"><a href="#/entities">Entidades</a> → <span class="cur">${esc(e.name)}</span></div>
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:18px;flex-wrap:wrap">
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0">${esc(e.name)}</h1>
      <span class="muted">${e.nif ? `NIF ${esc(e.nif)} · ` : ''}${roleLabel}</span>
    </div>
    <div class="ent-statcards">
      <div class="c"><div class="n">${r.n_contracts}</div><div class="l">contratos${isBuyer ? '' : ' adjudicados'}</div></div>
      <div class="c"><div class="n">${fmtCompact(r.total_value)}</div><div class="l">valor total</div></div>
      <div class="c"><div class="n">${fmtCompact(r.avg_value)}</div><div class="l">valor médio</div></div>
    </div>
    <div class="d-grid">
      <div>
        <div class="ent-recent">
          <div class="h">Contratos recentes</div>
          ${recent}
        </div>
      </div>
      <div>
        <div class="d-card">
          <div class="t">${isBuyer ? 'Como compra' : 'Como vende'}</div>
          <div style="font-size:12.5px;color:var(--ink-2);line-height:1.6">${topProc ? `Sobretudo por <b>${esc(topProc.type ?? '—')}</b> · ` : ''}${r.n_contracts} contrato${r.n_contracts === 1 ? '' : 's'}${sinceYear ? ` desde ${sinceYear}` : ''} (média ${fmtCompact(r.avg_value)}).</div>
        </div>
        ${signals.length ? `<div class="d-card">
          <div class="t">Sinais</div>
          <ul style="margin:0;padding-left:1.1rem;font-size:12.5px;color:var(--ink-2);line-height:1.75">${signals.map((s) => `<li>${s}</li>`).join('')}</ul>
          ${vulnerable ? '<div class="ai-callout condicional" style="margin:12px 0 0;font-size:12.5px">Sinal de abertura: adjudicatário em declínio e dependente de poucos clientes — bom alvo para disputar contas.</div>' : ''}
        </div>` : ''}
        ${(r.counterparts ?? []).length ? `<div class="d-card">
          <div class="t">${counterLabel}</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px">
            ${r.counterparts.slice(0, 5).map((c) => `<a href="#/entities/${c.id}" style="display:flex;justify-content:space-between;gap:10px;color:var(--ink)"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><b>${c.count} contrato${c.count === 1 ? '' : 's'}</b></a>`).join('')}
          </div>
        </div>` : ''}
        ${future ? `<div class="d-price" style="padding:16px 20px">
          <div class="k" style="letter-spacing:0.06em">PRÓXIMA JANELA</div>
          <p style="font-size:12.5px;color:var(--accent-line);margin:6px 0 0;line-height:1.55">Um contrato termina a <b style="color:#fff">${fmtDatePt(future.end_date)}</b>. Contactar cerca de 4 meses antes.</p>
          <a href="#/contracts/${future.id}" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:600;color:#fff;border-bottom:1px solid var(--on-dark-muted)">Ver contrato →</a>
        </div>` : ''}
      </div>
    </div>`;
}

/* ---------- Router ---------- */
/* ---------- Admin: gestão de utilizadores, planos e utilização ---------- */
const AI_KIND_LABEL = { fit: 'Fit IA', analise_anuncio: 'Análise de anúncio', analise_contrato: 'Análise de contrato', dossier: 'Dossier de resposta' };
const STATUS_LABEL = { trialing: 'Em teste', active: 'Ativa', past_due: 'Pagamento pendente', canceled: 'Cancelada' };

async function renderAdmin() {
  topbar.hidden = false;
  if (!window._me?.is_admin) { app.innerHTML = '<div class="card error">Acesso reservado a administradores.</div>'; return; }
  app.innerHTML = '<div class="card"><p class="muted">A carregar…</p></div>';
  let stats, companies, feedback;
  try {
    [stats, companies, feedback] = await Promise.all([
      api('/api/admin/stats'), api('/api/admin/companies'), api('/api/admin/feedback').catch(() => ({ items: [] })),
    ]);
  } catch (e) { app.innerHTML = `<div class="card error">${esc(e.message)}</div>`; return; }

  const t = stats.totals || {}; const sub = stats.subscriptions || {};
  const money = (v) => '$' + Number(v || 0).toFixed(2);
  const stat = (label, value, note) => `<div class="admin-stat">
    <div class="asv">${value}</div><div class="asl">${esc(label)}</div>${note ? `<div class="asn">${esc(note)}</div>` : ''}</div>`;

  const planBreak = (stats.companies_by_plan || []).map((r) => `${PLAN_LABEL[r.plan] || r.plan}: <strong>${r.n}</strong>`).join(' · ');
  const aiKinds = (stats.ai_usage?.by_kind || []).map((r) => `<div class="admin-row"><span>${esc(AI_KIND_LABEL[r.kind] || r.kind)}</span><strong>${r.n}</strong></div>`).join('') || '<p class="muted" style="margin:0">Sem análises este mês.</p>';
  const searchKinds = (stats.searches_by_kind || []).map((r) => `<div class="admin-row"><span>${esc(r.kind === 'anuncios' ? 'Anúncios (concursos)' : 'Contratos')}</span><strong>${r.n}</strong></div>`).join('') || '<p class="muted" style="margin:0">Sem pesquisas.</p>';

  const planOpts = (cur) => ['free', 'pro', 'business'].map((p) => `<option value="${p}"${p === cur ? ' selected' : ''}>${PLAN_LABEL[p]}</option>`).join('');
  const statusOpts = (cur) => ['trialing', 'active', 'past_due', 'canceled'].map((s) => `<option value="${s}"${s === cur ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('');
  const userLine = (u) => `<div class="adm-user" style="font-size:.8rem;margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span class="muted">${esc(u.email || u.username)}${u.is_admin ? ' · admin' : ''}</span>
      <button class="lnk rp-user" data-uid="${u.id}" data-email="${esc(u.email || u.username)}">repor password</button></div>`;
  const compRows = (companies.items || []).map((c) => `
    <tr data-id="${c.id}">
      <td><strong>${esc(c.name)}</strong>${c.nif ? `<div class="muted" style="font-size:.8rem">NIF ${esc(c.nif)}</div>` : ''}
        ${(c.users || []).map(userLine).join('')}</td>
      <td>${c.n_users}</td>
      <td>${c.n_profiles}</td>
      <td>${c.ai_month ?? 0}</td>
      <td><select class="adm-plan">${planOpts(normalizeAdminPlan(c.plan))}</select></td>
      <td><select class="adm-status">${statusOpts(c.subscription_status)}</select></td>
      <td>${new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
      <td><button class="adm-save btn-secondary" style="padding:.3rem .7rem;font-size:.8rem">Guardar</button><span class="adm-msg"></span></td>
    </tr>`).join('');

  const fbRows = (feedback.items || []).map((f) => `
    <tr class="${f.handled ? 'fb-done' : ''}">
      <td><span class="chip">${f.kind === 'help' ? 'Ajuda' : 'Sugestão'}</span></td>
      <td>${esc(f.message)}</td>
      <td class="muted" style="font-size:.82rem">${esc(f.company_name || '—')}<br>${esc(f.email || f.username || '')}</td>
      <td class="muted" style="font-size:.8rem;white-space:nowrap">${new Date(f.created_at).toLocaleDateString('pt-PT')}</td>
      <td><button class="fb-toggle lnk" data-id="${f.id}" data-h="${f.handled ? '1' : '0'}">${f.handled ? 'Reabrir' : 'Marcar tratado'}</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">Sem mensagens.</td></tr>';

  app.innerHTML = `
    <div class="admin-wrap">
      <div class="eyebrow" style="color:var(--brand)">Administração</div>
      <h2 style="margin:.3rem 0 1rem">Utilização do BaseRadar</h2>

      <div class="admin-stats">
        ${stat('Empresas', t.companies ?? 0, `${stats.signups?.last7 ?? 0} novas (7d)`)}
        ${stat('Pagantes', sub.paying ?? 0, 'subscrição ativa')}
        ${stat('Em trial', sub.trialing ?? 0, 'Pro 7 dias')}
        ${stat('Free / inativas', sub.free_inactive ?? 0, null)}
        ${stat('Receita (mês)', ((stats.payments?.cents_month ?? 0) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), `${stats.payments?.n_month ?? 0} pagamento(s)`)}
        ${stat('Análises IA (mês)', stats.ai_usage?.n_month ?? 0, `custo est. ${money(stats.ai_usage?.cost_month)}`)}
      </div>

      <div class="admin-grid2">
        <div class="card"><h3 style="margin:0 0 .6rem">Distribuição de planos</h3><p class="muted" style="margin:0 0 .8rem">${planBreak || '—'}</p>
          <div class="admin-row"><span>Faturas Moloni (mês)</span><strong>${stats.payments?.invoiced ?? 0}${stats.payments?.invoice_errors ? ` · ${stats.payments.invoice_errors} erro(s)` : ''}</strong></div>
          <h4 style="margin:.8rem 0 .4rem">Análises de IA por tipo (mês)</h4>${aiKinds}</div>
        <div class="card"><h3 style="margin:0 0 .6rem">Pesquisas por tipo</h3>${searchKinds}
          <h4 style="margin:.8rem 0 .4rem">Recolhas (profile runs)</h4>
          <div class="admin-row"><span>Total</span><strong>${stats.profile_runs?.total ?? 0}</strong></div>
          <div class="admin-row"><span>Últimos 30 dias</span><strong>${stats.profile_runs?.last30 ?? 0}</strong></div>
        </div>
      </div>

      <div class="card" style="margin-top:1.2rem">
        <h3 style="margin:0 0 .8rem">Empresas</h3>
        <div style="overflow-x:auto"><table class="admin-table">
          <thead><tr><th>Empresa</th><th>Utils</th><th>Perfis</th><th>IA/mês</th><th>Plano</th><th>Estado</th><th>Criada</th><th></th></tr></thead>
          <tbody id="admin-companies">${compRows}</tbody>
        </table></div>
      </div>

      <div class="card" style="margin-top:1.2rem">
        <h3 style="margin:0 0 .3rem">Repor password de utilizador</h3>
        <p class="muted" style="margin:0 0 .8rem;font-size:.85rem">Define uma nova password para um utilizador (por email). Recuperação de acesso.</p>
        <div class="inline" style="gap:.5rem;flex-wrap:wrap;align-items:center">
          <input type="email" id="rp-email" placeholder="email@empresa.pt" style="flex:1;min-width:220px">
          <input type="text" id="rp-pass" placeholder="nova password (mín. 8)" style="flex:1;min-width:200px">
          <button id="rp-btn">Repor password</button>
        </div>
        <div id="rp-result" style="margin-top:.5rem"></div>
      </div>

      <div class="card" style="margin-top:1.2rem">
        <h3 style="margin:0 0 .8rem">Feedback e pedidos de ajuda</h3>
        <div style="overflow-x:auto"><table class="admin-table">
          <thead><tr><th>Tipo</th><th>Mensagem</th><th>De</th><th>Data</th><th></th></tr></thead>
          <tbody id="admin-feedback">${fbRows}</tbody>
        </table></div>
      </div>
    </div>`;

  app.querySelectorAll('.rp-user').forEach((btn) => btn.onclick = async () => {
    const pw = prompt(`Nova password para ${btn.dataset.email} (mín. 8 caracteres):`);
    if (pw == null) return;
    if (pw.length < 8) { alert('A password deve ter pelo menos 8 caracteres.'); return; }
    try {
      const r = await api('/api/admin/users/reset-password', { method: 'POST', body: JSON.stringify({ user_id: Number(btn.dataset.uid), new_password: pw }) });
      alert(`✓ Password reposta para ${r.username}. Já pode iniciar sessão com esse email/utilizador.`);
    } catch (e) { alert(e.message); }
  });

  const rpBtn = document.getElementById('rp-btn');
  if (rpBtn) rpBtn.onclick = async () => {
    const email = document.getElementById('rp-email').value.trim();
    const new_password = document.getElementById('rp-pass').value;
    const out = document.getElementById('rp-result');
    out.innerHTML = '<span class="muted">A repor…</span>';
    try {
      const r = await api('/api/admin/users/reset-password', { method: 'POST', body: JSON.stringify({ email, new_password }) });
      out.innerHTML = `<span class="admin-msg">✓ Password reposta para ${esc(r.username)}.</span>`;
      document.getElementById('rp-pass').value = '';
    } catch (e) { out.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
  };

  app.querySelectorAll('#admin-companies .adm-save').forEach((btn) => btn.onclick = async () => {
    const tr = btn.closest('tr'); const id = tr.dataset.id;
    const plan = tr.querySelector('.adm-plan').value;
    const status = tr.querySelector('.adm-status').value;
    const msg = tr.querySelector('.adm-msg');
    msg.textContent = ' a guardar…';
    try {
      await api(`/api/admin/companies/${id}/subscription`, { method: 'POST', body: JSON.stringify({ status, plan }) });
      msg.textContent = ' ✓'; setTimeout(() => { msg.textContent = ''; }, 1500);
    } catch (e) { msg.textContent = ' ' + e.message; }
  });
  app.querySelectorAll('#admin-feedback .fb-toggle').forEach((btn) => btn.onclick = async () => {
    const handled = btn.dataset.h !== '1';
    try { await api(`/api/admin/feedback/${btn.dataset.id}/handled`, { method: 'POST', body: JSON.stringify({ handled }) }); renderAdmin(); }
    catch (e) { alert(e.message); }
  });
}
function normalizeAdminPlan(p) { return p === 'pro' || p === 'business' ? p : (p === 'baseradar' ? 'pro' : 'free'); }

/* Liga "Admin" à navegação lateral (só para administradores). */
function ensureAdminNav() {
  const nav = document.querySelector('#topbar nav');
  if (!nav) return;
  const existing = nav.querySelector('a[href="#/admin"]');
  if (!window._me?.is_admin) { existing?.remove(); return; }
  if (existing) return;
  const a = document.createElement('a');
  a.href = '#/admin'; a.textContent = 'Admin';
  nav.appendChild(a);
}

/* ---------- Feedback / ajuda: botão flutuante + modal ---------- */
function ensureHelpButton() {
  if (document.getElementById('help-fab')) return;
  const b = document.createElement('button');
  b.id = 'help-fab'; b.type = 'button'; b.title = 'Ajuda e feedback';
  b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/><circle cx="12" cy="12" r="10"/></svg><span>Ajuda</span>`;
  b.onclick = openFeedbackModal;
  document.body.appendChild(b);
}
function openFeedbackModal() {
  if (document.getElementById('fb-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'fb-modal'; wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal-box">
      <button class="modal-x" aria-label="Fechar">×</button>
      <h3 style="margin:0 0 .3rem">Como podemos ajudar?</h3>
      <p class="muted" style="margin:0 0 1rem;font-size:.88rem">Envie uma dúvida à equipa de suporte ou deixe uma sugestão para melhorarmos o BaseRadar.</p>
      <div class="fb-tabs">
        <button class="fb-tab active" data-kind="help">Pedir ajuda</button>
        <button class="fb-tab" data-kind="feedback">Sugestão / feedback</button>
      </div>
      <textarea id="fb-msg" rows="5" placeholder="Escreva a sua mensagem…" style="width:100%;margin-top:.6rem"></textarea>
      <div class="error" id="fb-error" style="margin-top:.4rem"></div>
      <div id="fb-ok" class="hint" style="margin-top:.4rem;display:none">Obrigado! A sua mensagem foi registada.</div>
      <div class="inline" style="justify-content:flex-end;gap:.5rem;margin-top:.8rem">
        <button class="btn-secondary" id="fb-cancel">Cancelar</button>
        <button id="fb-send">Enviar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  let kind = 'help';
  const close = () => wrap.remove();
  wrap.querySelector('.modal-x').onclick = close;
  wrap.querySelector('#fb-cancel').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelectorAll('.fb-tab').forEach((tb) => tb.onclick = () => {
    kind = tb.dataset.kind;
    wrap.querySelectorAll('.fb-tab').forEach((x) => x.classList.toggle('active', x === tb));
  });
  wrap.querySelector('#fb-send').onclick = async () => {
    const message = wrap.querySelector('#fb-msg').value.trim();
    const err = wrap.querySelector('#fb-error');
    if (message.length < 3) { err.textContent = 'Escreva a sua mensagem.'; return; }
    err.textContent = '';
    try {
      await api('/api/feedback', { method: 'POST', body: JSON.stringify({ kind, message }) });
      wrap.querySelector('#fb-ok').style.display = 'block';
      wrap.querySelector('#fb-send').disabled = true;
      setTimeout(close, 1400);
    } catch (e) { err.textContent = e.message; }
  };
}

async function route() {
  stopPolling();
  hideMatrixTip();
  const hash = location.hash || '#/';
  document.body.classList.toggle('login-bg', hash === '#/login' || hash === '#/registo');
  // Estado ativo da navegação lateral. A raiz mapeia para Oportunidades.
  const navHash = (hash === '#/' || hash === '') ? '#/hoje' : hash;
  document.querySelectorAll('#topbar nav a').forEach((a) => {
    const href = a.getAttribute('href');
    let on = false;
    if (href === '#/hoje') on = navHash === '#/hoje';
    else if (href.startsWith('#/radar/')) on = navHash === href;
    else if (href === '#/entities') on = navHash.startsWith('#/entities');
    else if (href === '#/config') on = navHash.startsWith('#/config') || navHash.startsWith('#/profiles');
    a.classList.toggle('active', on);
  });
  if (hash === '#/login') { window._me = null; return renderLogin(); }
  if (hash === '#/registo') { window._me = null; return renderRegister(); }
  const invite = hash.match(/^#\/aceitar-convite\?token=(.+)$/);
  if (invite) { window._me = null; return renderAcceptInvite(decodeURIComponent(invite[1])); }

  // Sessão em cache: evita uma ida ao servidor por cada mudança de página.
  // Se expirar, a primeira chamada api() da vista devolve 401 e redireciona.
  if (!window._me) {
    try {
      window._me = await api('/api/auth/me');
    } catch {
      return; /* api() já redirecionou para login */
    }
  }
  loadCaps().then(applyNavGating);   // capabilities em 2.º plano (não bloqueia a navegação)
  topbar.hidden = false;
  const planPill = window._me.plan && window._me.plan !== 'free'
    ? `<span class="plan-pill ${esc(window._me.plan)}">${PLAN_LABEL[window._me.plan] || window._me.plan}</span>` : '';
  whoami.innerHTML = `<a href="#/conta"><span class="nm">${esc(window._me.username)}</span><span class="co"><span class="co-nm">${esc(window._me.company?.name ?? '')}</span>${planPill}</span></a>`;
  renderTrialBanner(window._me);
  updateSidebar();
  ensureHelpButton();
  ensureAdminNav();
  const hashBase = hash.split('?')[0];
  if (hashBase === '#/subscrever' || hashBase === '#/planos') return renderPlans();
  if (hashBase === '#/conta') return renderAccount();
  if (hashBase === '#/admin') return renderAdmin();
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
    if (hash === '#/hoje') return await renderHoje();
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
    return await renderHoje();
  } catch (err) {
    if (err.planRequired) { app.innerHTML = upgradePanel(err.planRequired); return; }
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
