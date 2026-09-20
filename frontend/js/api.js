const Icons = (() => {
  const svg = (paths, size = 18, extraClass = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon ${extraClass}" aria-hidden="true">${paths}</svg>`;
  return {
    chartBar:    (s=18)=>svg(`<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`, s),
    users:       (s=18)=>svg(`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`, s),
    plusCircle:  (s=18)=>svg(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`, s),
    searchIc:    (s=18)=>svg(`<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`, s),
    brain:       (s=18)=>svg(`<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="9" y1="13" x2="9.01" y2="13"/>`, s),
    targetBull:  (s=28)=>svg(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`, s),
    bookOpen:    (s=14)=>svg(`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`, s),
    trendUp:     (s=14)=>svg(`<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`, s),
    trendFlat:   (s=14)=>svg(`<line x1="3" y1="12" x2="21" y2="12"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/>`, s),
    trendDown:   (s=14)=>svg(`<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`, s),
    rotateCw:    (s=16)=>svg(`<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`, s),
    alertOct:    (s=40)=>svg(`<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`, s),
    trophy:      (s=20)=>svg(`<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`, s),
    ban:         (s=20)=>svg(`<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>`, s),
    target:      (s=20)=>svg(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`, s),
    checkShield: (s=20)=>svg(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>`, s),
    userPlus:    (s=20)=>svg(`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>`, s),
    zap:         (s=20)=>svg(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`, s),
  };
})();
window.Icons = Icons;

const BACKENDS = {
  python: {
    id: 'python',
    label: 'Python FastAPI',
    short: 'PY',
    port: 8000,
    color: '#3b82f6',
    baseUrl: 'http://localhost:8000',
    caseStyle: 'snake',
    docsPath: '/docs',
  },
  node: {
    id: 'node',
    label: 'Node.js Fastify TS',
    short: 'NODE',
    port: 3000,
    color: '#10b981',
    baseUrl: 'http://localhost:3000',
    caseStyle: 'camel',
    docsPath: '/reference',
  },
};

const STATUS_COLORS = {
  new: '#64748b',
  contacted: '#0ea5e9',
  connected: '#6366f1',
  qualified: '#8b5cf6',
  opportunity: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
};

const CHANNEL_ORDER = ['Website', 'Event', 'LinkedIn', 'Organic Search', 'Referral', 'Manual/Sales', 'Other'];
const CHANNEL_COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#64748b'];
const STATUS_ORDER = ['new', 'contacted', 'connected', 'qualified', 'opportunity', 'closed_won', 'closed_lost'];
const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  qualified: 'Qualified',
  opportunity: 'Opportunity',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STORAGE_KEY = 'fe_backend_current';

function getCurrentBackend() {
  const id = localStorage.getItem(STORAGE_KEY) || 'python';
  return BACKENDS[id] || BACKENDS.python;
}

let _backendSwitchPending = false;
function setCurrentBackend(id) {
  localStorage.setItem(STORAGE_KEY, id);
  renderHeader();
  if (!_backendSwitchPending && typeof onBackendSwitchCallback === 'function') {
    _backendSwitchPending = true;
    try {
      onBackendSwitchCallback(BACKENDS[id]);
    } finally {
      _backendSwitchPending = false;
    }
  }
  return BACKENDS[id];
}

let onBackendSwitchCallback = null;
function onBackendSwitch(fn) { onBackendSwitchCallback = fn; }

function toSnake(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  const out = {};
  for (const k of Object.keys(obj)) {
    const sk = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    out[sk] = toSnake(obj[k]);
  }
  return out;
}

function toCamel(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  const out = {};
  for (const k of Object.keys(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[ck] = toCamel(obj[k]);
  }
  return out;
}

async function api(path, opts = {}) {
  const b = getCurrentBackend();
  const url = b.baseUrl + path;
  const userSignal = opts.signal || null;
  const timeoutMs = opts.timeoutMs || 30000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  if (userSignal) {
    try {
      if (userSignal.aborted) ctrl.abort();
      else userSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
    } catch (_) {}
  }
  const fetchOpts = {
    method: opts.method || 'GET',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: ctrl.signal,
  };
  if (opts.body) {
    const converted = b.caseStyle === 'snake' ? toSnake(opts.body) : toCamel(opts.body);
    fetchOpts.body = JSON.stringify(converted);
  }
  try {
    const res = await fetch(url, fetchOpts);
    clearTimeout(t);
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(`[${b.label}] ${msg}`);
    }
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') {
      throw new Error(`[${b.label}] Request timed out (${(timeoutMs/1000)|0}s) — is backend reachable on port ${b.port}?`);
    }
    if (err.message && err.message.startsWith('[')) throw err;
    throw new Error(`[${b.label}] Network error: ${err.message} — is backend running on port ${b.port}?`);
  }
}

async function healthCheck(id) {
  const b = BACKENDS[id] || getCurrentBackend();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(b.baseUrl + '/', { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch (_) { return false; }
}

let _healthIntervalId = null;
function renderHeader(activePage = 'dashboard') {
  const b = getCurrentBackend();
  const inPages = /\/pages\/[^/]*\.html?$/i.test(location.pathname) || location.pathname.endsWith('/pages/');
  const dashHref = inPages ? '../index.html' : './index.html';
  const pagePrefix = inPages ? './' : 'pages/';
  const pages = [
    { id: 'dashboard', href: dashHref,                    iconSvg: Icons.chartBar(15),   label: 'Dashboard' },
    { id: 'leads',     href: pagePrefix + 'leads.html',   iconSvg: Icons.users(15),      label: 'Leads' },
    { id: 'ingest',    href: pagePrefix + 'ingest.html',  iconSvg: Icons.plusCircle(15), label: 'Ingest' },
    { id: 'dedup',     href: pagePrefix + 'dedup.html',   iconSvg: Icons.searchIc(15),   label: 'Dedupe' },
    { id: 'extract',   href: pagePrefix + 'extract.html', iconSvg: Icons.brain(15),      label: 'Source Extract' },
  ];
  const html = pages.map(p => `
    <a class="nav-link ${p.id === activePage ? 'active' : ''}" href="${p.href}">${p.iconSvg} <span>${p.label}</span></a>
  `).join('');
  const el = document.getElementById('app-header');
  if (!el) return;
  el.innerHTML = `
    <div class="header-inner">
      <div class="brand">
        <span class="brand-logo">${Icons.targetBull(26)}</span>
        <div>
          <div class="brand-title">AI Lead Manager</div>
          <div class="brand-sub">Dual-Version Frontend · Vanilla HTML · ROOT/<span class="mono">frontend/</span></div>
        </div>
      </div>
      <nav class="nav">${html}</nav>
      <div class="backend-switcher">
        <div class="switcher-label">Connected to backend:</div>
        <div class="switcher-buttons">
          ${Object.values(BACKENDS).map(bb => `
            <button id="sw-${bb.id}" class="sw-btn ${bb.id === b.id ? 'active' : ''}" style="--c:${bb.color}" onclick="handleSwitchBackend('${bb.id}')">
              <span class="sw-dot" id="dot-${bb.id}">●</span>
              <span class="sw-label">${bb.label}</span>
              <span class="sw-port">:${bb.port}</span>
            </button>
          `).join('')}
          <a class="sw-docs" id="sw-docs" href="${b.baseUrl}${b.docsPath}" target="_blank" rel="noopener">${Icons.bookOpen(13)} <span>API Docs ↗</span></a>
        </div>
      </div>
    </div>
  `;
  refreshHealthIndicators();
  if (_healthIntervalId) clearInterval(_healthIntervalId);
  _healthIntervalId = setInterval(refreshHealthIndicators, 5000);
}

async function refreshHealthIndicators() {
  for (const id of Object.keys(BACKENDS)) {
    const dot = document.getElementById('dot-' + id);
    if (!dot) continue;
    dot.style.color = '#94a3b8';
    dot.title = 'Checking...';
    const ok = await healthCheck(id);
    const bc = BACKENDS[id];
    dot.style.color = ok ? bc.color : '#ef4444';
    dot.title = ok ? `${bc.label} port ${bc.port} — ONLINE` : `${bc.label} port ${bc.port} — OFFLINE (start backend first)`;
  }
}

function handleSwitchBackend(id) {
  if (window._parityAbortCtrl && typeof window._parityAbortCtrl.abort === 'function') {
    try { window._parityAbortCtrl.abort(); } catch (_) {}
  }
  setCurrentBackend(id);
  const bc = BACKENDS[id];
  const btn = document.getElementById('sw-' + id);
  if (btn) {
    btn.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 250 });
  }
  showToast(`Switched backend → ${bc.label} :${bc.port}`, bc.color);
}

let _toastTimer = null;
function showToast(msg, color = '#0ea5e9') {
  const existing = document.querySelector('.toast');
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderColor = color;
  t.innerHTML = `<span class="toast-bar" style="background:${color}"></span><div>${escapeHtml(msg)}</div>`;
  document.body.appendChild(t);
  _toastTimer = setTimeout(() => { t.remove(); _toastTimer = null; }, 3500);
}

function statusBadge(status) {
  const s = status || 'new';
  const c = STATUS_COLORS[s] || '#64748b';
  return `<span class="badge" style="background:${c}1a;color:${c};border:1px solid ${c}44">${escapeHtml(STATUS_LABEL[s] || s)}</span>`;
}

function channelBadge(ch) {
  const i = CHANNEL_ORDER.indexOf(ch);
  const c = CHANNEL_COLORS[i >= 0 ? i : 6];
  return `<span class="badge ch" style="background:${c}1a;color:${c};border:1px solid ${c}44">${escapeHtml(ch || 'Other')}</span>`;
}

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return escapeHtml(s);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function truncate(s, n = 80) {
  s = s == null ? '' : String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

window.renderHeader = renderHeader;
window.handleSwitchBackend = handleSwitchBackend;
window.onBackendSwitch = onBackendSwitch;
window.BACKENDS = BACKENDS;
window.STATUS_ORDER = STATUS_ORDER;
window.STATUS_LABEL = STATUS_LABEL;
window.STATUS_COLORS = STATUS_COLORS;
window.CHANNEL_ORDER = CHANNEL_ORDER;
window.CHANNEL_COLORS = CHANNEL_COLORS;
window.api = api;
window.healthCheck = healthCheck;
window.getCurrentBackend = getCurrentBackend;
window.statusBadge = statusBadge;
window.channelBadge = channelBadge;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.truncate = truncate;
window.showToast = showToast;
