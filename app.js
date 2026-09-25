import { GreenwickAPI } from './api.js?v=0.2.0';
import { paymentPayload, qrSvg, code39Svg, svgData } from './payment-codes.js?v=0.2.0';

const api = new GreenwickAPI();
const root = document.getElementById('app');
const starter = [
  { id: 'water', name: 'Water', cents: 300, category: 'Food & Drink', icon: '💧' },
  { id: 'coffee', name: 'Coffee', cents: 450, category: 'Food & Drink', icon: '☕' },
  { id: 'chips', name: 'Chips', cents: 350, category: 'Food & Drink', icon: '▣' },
  { id: 'sandwich', name: 'Sandwich', cents: 800, category: 'Food & Drink', icon: '🥪' }
];
const pages = ['Terminal', 'Transactions', 'Reports', 'Payouts', 'Devices', 'Settings'];
const state = {
  page: 'Terminal', home: null, catalogue: [], basket: [], request: null,
  busy: false, notice: '', error: '', filter: 'All', search: '', category: 'All',
  authMode: 'login', receipt: null, ready: false
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const amount = cents => `GUD ${new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(cents || 0) / 100)}`;
const date = value => { const d = new Date(value); return Number.isNaN(+d) ? '' : new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(d); };
const key = () => `greenwick-web-catalogue:${state.home?.merchant_id}`;
function loadCatalogue() {
  try {
    const saved = JSON.parse(localStorage.getItem(key()) || 'null');
    state.catalogue = Array.isArray(saved) ? saved.filter(x => typeof x.name === 'string' && Number.isSafeInteger(x.cents) && x.cents > 0).slice(0, 80) : starter.map(x => ({ ...x }));
  } catch { state.catalogue = starter.map(x => ({ ...x })); }
}
function saveCatalogue() { localStorage.setItem(key(), JSON.stringify(state.catalogue)); }
function total() { return state.basket.reduce((sum, line) => sum + line.cents * line.qty, 0); }
function report() {
  const sales = (state.home?.transactions || []).filter(x => x.kind === 'payment');
  const refunds = (state.home?.transactions || []).filter(x => x.kind === 'refund');
  return { sales, refunds, gross: sales.reduce((v, x) => v + Number(x.amount_minor), 0), returned: refunds.reduce((v, x) => v - Number(x.amount_minor), 0) };
}
function notice() { return `${state.error ? `<div class="alert error" role="alert">${esc(state.error)}</div>` : ''}${state.notice ? `<div class="alert good" role="status">${esc(state.notice)}</div>` : ''}`; }
function brand() { return `<div class="brand"><span class="leaf" aria-hidden="true"><i></i><i></i></span><span>Greenwick <b>Bank</b><small>MERCHANT TERMINAL</small></span></div>`; }
function shell(content) {
  const initials = (state.home?.name || 'GW').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return `<header class="topbar">${brand()}<div class="topbar-right"><span class="top-label">Greenwick GUD merchant network</span><button class="merchant" data-nav="Settings"><span class="avatar">${esc(initials)}</span>${esc(state.home?.name || '')}</button></div></header>
  <div class="layout"><aside class="sidebar"><nav aria-label="Main navigation">${pages.map((p, i) => `<button data-nav="${p}" class="nav ${state.page === p ? 'selected' : ''}"><span class="nav-icon">${['▣', '▤', '▥', '↗', '▧', '⚙'][i]}</span>${p}</button>`).join('')}</nav><div class="sidebar-foot"><span class="store-icon">▣</span><span>${esc(state.home.name)}<small>Greenwick merchant</small></span></div></aside><main>${notice()}${content}</main></div>`;
}
function title(name, subtitle, action = '') { return `<div class="heading"><div><h1>${name}</h1><p>${subtitle}</p></div>${action}</div>`; }
function activity(tx) {
  return `<button class="activity" data-receipt="${esc(tx.event_id)}"><span class="activity-icon ${tx.kind === 'refund' ? 'refund-icon' : ''}">${tx.kind === 'refund' ? '↶' : '▣'}</span><span><strong>${tx.kind === 'refund' ? 'Refund' : 'Sale'}</strong><small>${esc(tx.description || 'Greenwick Pay')} · ${date(tx.created_at)}</small></span><span class="activity-amount ${tx.kind === 'refund' ? 'red' : ''}">${amount(tx.amount_minor)}</span><span>›</span></button>`;
}
function terminal() {
  const categories = ['All', ...new Set(state.catalogue.map(x => x.category))];
  const products = state.catalogue.filter(x => state.category === 'All' || x.category === state.category)
    .filter(x => x.name.toLowerCase().includes(state.search.toLowerCase()));
  const isPending = !!state.request;
  const active = state.home.merchant_status === 'active' && state.home.terminal_status === 'active';
  return `${title('Terminal', `Accept internal Greenwick payments for ${esc(state.home.name)}.`, active ? '<span class="pill online">● &nbsp;Terminal online</span>' : '<span class="pill refunded">Terminal unavailable</span>')}
    <div class="terminal-grid"><section class="catalogue panel"><div class="section-heading"><h2>Products</h2><button class="text-btn" data-nav="Settings">Edit catalogue ↗</button></div>
      <input id="product-search" type="search" placeholder="Search products…" value="${esc(state.search)}" aria-label="Search products">
      <div class="chips">${categories.map(c => `<button class="chip ${state.category === c ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="products">${products.length ? products.map(p => `<button class="product" data-add="${esc(p.id)}" ${isPending ? 'disabled' : ''}><span class="product-icon">${esc(p.icon || '▣')}</span><strong>${esc(p.name)}</strong><small>${amount(p.cents)}</small></button>`).join('') : '<p class="muted">No products match. Add a product in Settings.</p>'}</div>
      <div class="catalogue-bottom"><button class="outline" data-custom ${isPending ? 'disabled' : ''}>＋ Custom amount</button><span>Catalogue is stored in this browser; sales are stored in Supabase.</span></div></section>
      <section class="sale panel"><div class="section-heading"><h2>Current sale</h2><button class="text-btn" data-clear ${isPending ? 'disabled' : ''}>Clear</button></div>
      ${isPending ? pending() : `<div class="basket">${state.basket.length ? state.basket.map(x => `<div class="basket-row"><span class="qty-control"><button data-dec="${esc(x.id)}" aria-label="Decrease ${esc(x.name)}">−</button><b>${x.qty}</b><button data-inc="${esc(x.id)}" aria-label="Increase ${esc(x.name)}">+</button></span><span class="basket-name">${esc(x.name)}</span><strong>${amount(x.cents * x.qty)}</strong><button class="remove" data-remove="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">×</button></div>`).join('') : '<div class="empty">Add a product or custom amount to begin.</div>'}</div>
        <div class="totals"><div><span>Subtotal</span><strong>${amount(total())}</strong></div><p>Tax and tips are not applied. Product prices are entered as final GUD amounts.</p><div class="grand"><strong>Total</strong><strong>${amount(total())}</strong></div></div>
        <button class="primary wide" data-charge ${!state.basket.length || state.busy || !active ? 'disabled' : ''}>Charge ${amount(total())}</button><p class="fine center">Customer approval in the Greenwick Bank app is required.</p>`}
      </section></div><div class="below-grid"><section class="panel"><div class="section-heading"><h2>Recent activity</h2><button class="text-btn" data-nav="Transactions">View all →</button></div>${(state.home.transactions || []).slice(0, 4).map(activity).join('') || '<p class="muted">No payments yet.</p>'}</section>
      <section class="panel"><h2>Today</h2><div class="today-number">${amount(state.home.today_sales_minor)}</div><p class="muted">${Number(state.home.today_count || 0)} approved sales · refunds ${amount(state.home.today_refunds_minor)}</p><button class="outline wide" data-nav="Reports">View reports</button></section></div>`;
}
function pending() {
  const r = state.request;
  const payload = paymentPayload(r.token);
  return `<div class="pending"><span class="pill online">● &nbsp;Awaiting customer approval</span><div class="pending-total">${amount(r.amountMinor)}</div><p>Customer opens <b>Bank → Payments → Nearby pay</b> and scans either symbol. Bank shows the merchant and amount for approval.</p><div class="code-gallery"><div><strong>Scan QR</strong><img class="qr-image" src="${svgData(qrSvg(payload))}" alt="Greenwick payment QR code"></div><div><strong>Scan barcode</strong><img class="barcode-image" src="${svgData(code39Svg(payload))}" alt="Greenwick payment Code 39 barcode"><small>For easier scanning, use a wide display or landscape mode.</small></div></div><p class="fine">Camera unavailable? Enter the code below in Bank.</p><div class="token">${esc(r.token)}</div><button class="outline" data-copy>Copy code</button><p class="fine">Expires ${date(r.expiresAt)}. These symbols and the code resolve the same short-lived server request; scanning cannot debit an account.</p><button class="danger wide" data-cancel ${state.busy ? 'disabled' : ''}>Cancel request</button></div>`;
}
function transactions() {
  const { sales, refunds } = report();
  const visible = (state.home.transactions || []).filter(x => state.filter === 'All' || (state.filter === 'Sales' ? x.kind === 'payment' : x.kind === 'refund'))
    .filter(x => `${x.description} ${x.event_id} ${amount(x.amount_minor)}`.toLowerCase().includes(state.search.toLowerCase()));
  return `${title('Transactions', 'View and manage your recent Greenwick payments.', '<button class="outline" data-refresh>↻ Refresh</button>')}
    <div class="stats"><div class="stat"><span>Total sales <small>Last 100 movements</small></span><strong>${sales.length}</strong></div><div class="stat"><span>Sales value <small>Last 100 movements</small></span><strong>${amount(sales.reduce((n,x) => n + Number(x.amount_minor),0))}</strong></div><div class="stat"><span>Refunds <small>Last 100 movements</small></span><strong>${amount(refunds.reduce((n,x) => n - Number(x.amount_minor),0))}</strong></div><div class="stat"><span>Average sale <small>Last 100 movements</small></span><strong>${amount(sales.length ? Math.round(sales.reduce((n,x) => n + Number(x.amount_minor),0) / sales.length) : 0)}</strong></div></div>
    <div class="filters"><input type="search" id="transaction-search" placeholder="Search description, amount, or reference…" value="${esc(state.search)}" aria-label="Search transactions"><div class="chips">${['All','Sales','Refunds'].map(f => `<button class="chip ${state.filter === f ? 'active' : ''}" data-filter="${f}">${f}</button>`).join('')}</div></div>
    <div class="panel table-wrap"><table><thead><tr><th>Type</th><th>Date & time</th><th>Method</th><th>Reference</th><th>Description</th><th>Status</th><th class="right">Amount</th></tr></thead><tbody>${visible.map(x => `<tr data-receipt="${esc(x.event_id)}" tabindex="0"><td>${x.kind === 'refund' ? '↶ Refund' : '▣ Sale'}</td><td>${date(x.created_at)}</td><td>Greenwick Pay</td><td class="mono">${esc(x.event_id.slice(0, 8))}</td><td>${esc(x.description || 'Terminal payment')}</td><td><span class="pill ${x.kind === 'refund' ? 'refunded' : 'approved'}">${x.kind === 'refund' ? 'Refunded' : 'Approved'}</span></td><td class="right ${x.kind === 'refund' ? 'red' : ''}">${amount(x.amount_minor)}</td></tr>`).join('')}</tbody></table>${visible.length ? '' : '<p class="empty">No matching transactions.</p>'}</div><p class="fine">Showing up to 100 most recent ledger movements. Failed requests are not ledger transactions.</p>`;
}
function reports() {
  const today = Number(state.home.today_sales_minor || 0), refunds = Number(state.home.today_refunds_minor || 0);
  const recent = report();
  const byDay = new Map();
  for (const row of recent.sales) {
    const d = new Date(row.created_at).toLocaleDateString('en-CA');
    byDay.set(d, (byDay.get(d) || 0) + Number(row.amount_minor));
  }
  const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toLocaleDateString('en-CA'); });
  const max = Math.max(1, ...dates.map(d => byDay.get(d) || 0));
  return `${title('Reports', 'A clear view of your Greenwick GUD activity.', '<button class="outline" data-refresh>↻ Refresh</button>')}
    <div class="stats"><div class="stat"><span>Today’s sales</span><strong>${amount(today)}</strong></div><div class="stat"><span>Today’s transactions</span><strong>${Number(state.home.today_count || 0)}</strong></div><div class="stat"><span>Average today</span><strong>${amount(state.home.today_count ? Math.round(today / state.home.today_count) : 0)}</strong></div><div class="stat"><span>Today’s refunds</span><strong>${amount(refunds)}</strong></div></div>
    <div class="report-grid"><section class="panel"><h2>Sales overview</h2><p class="muted">Last 7 calendar days, based on the 100 most recent merchant movements</p><div class="chart">${dates.map(d => `<div class="bar-col"><span class="bar-value">${amount(byDay.get(d) || 0)}</span><span class="bar bar-level-${Math.max(0, Math.min(20, Math.round(((byDay.get(d) || 0) / max) * 20)))}"></span><small>${esc(d.slice(5))}</small></div>`).join('')}</div></section>
    <section class="panel"><h2>Payment method</h2><div class="method"><div class="method-circle">100%</div><div><strong>Greenwick Pay</strong><p>${amount(recent.gross)} in the latest ${recent.sales.length} sales</p><p class="fine">External cards and cash do not settle through this ledger.</p></div></div><hr><h2>Recent net activity</h2><div class="today-number">${amount(recent.gross - recent.returned)}</div><p class="fine">This is not an available or withdrawable balance.</p></section></div>`;
}
function payouts() {
  return `${title('Payouts', 'External payouts are not configured for this Greenwick terminal.')}
  <div class="panel payout-hero"><div class="payout-icon">↗</div><h2>Greenwick GUD stays in your merchant wallet</h2><p>Customer payments settle to the merchant GUD wallet in the shared ledger. There is no linked external bank account, scheduled payout, redemption, or withdrawable amount in this app.</p><div class="note"><b>What you can do:</b> Review settled sales and refunds in Transactions. An operator must establish separate redemption and payout rules before this page can offer withdrawals.</div><button class="outline" data-nav="Transactions">View transactions →</button></div>`;
}
function devices() {
  return `${title('Devices', 'How customers find this terminal.')}
  <div class="panel device-card"><div class="device-icon">▧</div><div><h2>Web terminal</h2><p class="muted mono">${esc(state.home.terminal_id)}</p><span class="pill online">● &nbsp;Active Greenwick terminal</span><p>This web page shows a 32-character code for each payment. The customer enters it in Greenwick Bank to preview and approve the server request. The native Android Terminal app can advertise that same token via BLE on supported hardware.</p><p class="fine">Opening this site on a phone does not turn it into a Bluetooth payment reader.</p></div></div>`;
}
function settings() {
  return `${title('Settings', 'Business account and your local product catalogue.')}
  <div class="settings-grid"><section class="panel"><h2>Business profile</h2><dl><dt>Merchant</dt><dd>${esc(state.home.name)}</dd><dt>Terminal ID</dt><dd class="mono">${esc(state.home.terminal_id)}</dd><dt>Currency</dt><dd>Greenwick GUD</dd></dl><p class="fine">Merchant changes and team access require operator review.</p><button class="outline" data-logout>Sign out</button></section>
  <section class="panel"><h2>Catalogue</h2><p class="fine">Products are saved only in this browser. Re-add them on another device. Prices are final GUD prices.</p><form id="product-form" class="product-form"><label>Name<input name="name" required maxlength="60" placeholder="Product or service"></label><label>Price (GUD)<input name="price" type="number" inputmode="decimal" min="0.01" max="1000000" step="0.01" required placeholder="4.50"></label><label>Category<select name="category"><option>Food & Drink</option><option>Retail</option><option>Services</option><option>Other</option></select></label><button class="primary" ${state.busy ? 'disabled' : ''}>Add product</button></form><div class="catalogue-list">${state.catalogue.map(p => `<div><span>${esc(p.name)} <small>${esc(p.category)}</small></span><strong>${amount(p.cents)}</strong><button data-delete-product="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">×</button></div>`).join('') || '<p class="muted">No products added.</p>'}</div></section></div>`;
}
function auth() {
  const signUp = state.authMode === 'signup';
  return `<div class="auth-layout"><div class="auth-brand">${brand()}<h1>Payments for Greenwick merchants.</h1><p>One terminal, one shared GUD ledger. Customers approve every sale in the Greenwick Bank app.</p></div><div class="auth-card panel"><span class="eyebrow">GREENWICK TERMINAL</span><h2>${signUp ? 'Create merchant login' : 'Welcome back'}</h2><p class="muted">${signUp ? 'Set up your merchant profile after confirming your account.' : 'Log in with your Greenwick account.'}</p>${notice()}<form id="auth-form">${signUp ? '<label>Full name<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label>' : ''}<label>Email address<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="${signUp ? 'new-password' : 'current-password'}"></label><button class="primary wide" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Please wait…' : signUp ? 'Create account' : 'Log in'}</button></form><button class="text-btn" data-auth-switch>${signUp ? 'Already have an account? Log in' : 'New here? Sign up'}</button><p class="fine center">Web build 0.2.0</p></div></div>`;
}
function registration() {
  return `<div class="auth-layout"><div class="auth-brand">${brand()}<h1>Set up your merchant terminal.</h1><p>Customers will see the name you register when reviewing a payment request.</p></div><div class="auth-card panel"><span class="eyebrow">BUSINESS PROFILE</span><h2>Register your business</h2>${notice()}<form id="register-form"><label>Business display name<input name="name" minlength="2" maxlength="120" required placeholder="Example: Ashton’s Store"></label><p class="fine">One merchant wallet and terminal will be created for this account.</p><button class="primary wide" ${state.busy ? 'disabled' : ''}>Create merchant terminal</button></form><button class="text-btn" data-logout>Sign out</button></div></div>`;
}
function receipt() {
  const x = state.receipt;
  if (!x) return '';
  return `<div class="modal-backdrop"><div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><button class="modal-close" data-close aria-label="Close">×</button><span class="eyebrow">GREENWICK RECEIPT</span><h2 id="receipt-title">${x.kind === 'refund' ? 'Refund' : 'Sale'} · ${amount(x.amount_minor)}</h2><p>${esc(x.description || 'Greenwick Pay')}</p><dl><dt>Time</dt><dd>${date(x.created_at)}</dd><dt>Reference</dt><dd class="mono">${esc(x.event_id)}</dd><dt>Method</dt><dd>Greenwick Pay</dd></dl><div class="modal-actions"><button class="outline" data-print>Print</button>${x.kind === 'payment' ? `<button class="danger" data-refund="${esc(x.event_id)}" ${state.busy ? 'disabled' : ''}>Full refund</button>` : ''}</div><p class="fine">A refund returns the entire sale to the original customer wallet, if the merchant wallet has enough GUD. The server prevents a duplicate refund.</p></div></div>`;
}
function render() {
  if (!state.ready) { root.innerHTML = `<div class="loading">${brand()}<p>Connecting to Greenwick…</p></div>`; return; }
  if (!api.session) { root.innerHTML = auth(); return; }
  if (!state.home) { root.innerHTML = `<div class="loading">${brand()}<p>Loading merchant…</p>${notice()}</div>`; return; }
  if (!state.home.registered) { root.innerHTML = registration(); return; }
  const content = ({ Terminal: terminal, Transactions: transactions, Reports: reports, Payouts: payouts, Devices: devices, Settings: settings })[state.page]();
  root.innerHTML = shell(content) + receipt();
}

async function task(fn) {
  if (state.busy) return;
  state.busy = true; state.error = ''; state.notice = ''; render();
  try { await fn(); }
  catch (e) { state.error = e?.message || 'Could not connect. Please try again.'; }
  finally { state.busy = false; render(); }
}
async function refreshHome() {
  state.home = await api.home();
  if (state.home.registered && !state.catalogue.length) loadCatalogue();
}
async function poll() {
  const r = state.request;
  if (!r || !api.session || state.busy) return;
  try {
    const result = await api.status(r.id);
    if (state.request?.id !== r.id) return;
    if (result.status === 'paid') {
      state.request = null; state.basket = [];
      await refreshHome();
      state.notice = `Payment approved. Receipt ${String(result.event_id || '').slice(0, 8)}.`;
      render();
    } else if (['expired', 'cancelled'].includes(result.status)) {
      state.request = null;
      state.notice = `Payment request ${result.status}. No charge was made.`;
      render();
    }
  } catch { /* A brief connection loss does not imply the request was paid. */ }
}
setInterval(poll, 2500);

root.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'auth-form') {
    const data = new FormData(form);
    task(async () => {
      const signed = state.authMode === 'signup'
        ? await api.signUp(String(data.get('name')), String(data.get('email')), String(data.get('password')))
        : await api.signIn(String(data.get('email')), String(data.get('password')));
      if (signed) { await refreshHome(); state.notice = 'Signed in.'; }
      else state.notice = 'Check your email to confirm your account, then log in.';
    });
  }
  if (form.id === 'register-form') task(async () => {
    await api.register(String(new FormData(form).get('name')));
    await refreshHome(); state.notice = 'Merchant terminal ready.';
  });
  if (form.id === 'product-form') {
    const data = new FormData(form), raw = String(data.get('price'));
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) { state.error = 'Enter a price with at most two decimal places.'; render(); return; }
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) { state.error = 'Price must be between 0.01 and 1,000,000 GUD.'; render(); return; }
    state.catalogue.push({ id: crypto.randomUUID(), name: String(data.get('name')).trim(), cents,
      category: String(data.get('category')), icon: '▣' });
    saveCatalogue(); render();
  }
});
root.addEventListener('input', event => {
  const t = event.target;
  if (t.id === 'product-search' || t.id === 'transaction-search') {
    state.search = t.value;
    const id = t.id, position = t.selectionStart;
    render();
    const next = document.getElementById(id);
    next?.focus(); next?.setSelectionRange(position, position);
  }
});
root.addEventListener('click', event => {
  const t = event.target.closest('button,[data-receipt]');
  if (!t) return;
  if (t.dataset.nav) { state.page = t.dataset.nav; state.search = ''; state.notice = ''; state.error = ''; render(); return; }
  if ('authSwitch' in t.dataset) { state.authMode = state.authMode === 'login' ? 'signup' : 'login'; state.error = ''; state.notice = ''; render(); return; }
  if ('logout' in t.dataset) { task(async () => { await api.signOut(); state.home = null; state.request = null; state.basket = []; state.catalogue = []; state.receipt = null; }); return; }
  if ('refresh' in t.dataset) { task(async () => { await refreshHome(); state.notice = 'Updated.'; }); return; }
  if (t.dataset.category) { state.category = t.dataset.category; render(); return; }
  if (t.dataset.filter) { state.filter = t.dataset.filter; render(); return; }
  if (t.dataset.add) {
    const p = state.catalogue.find(x => x.id === t.dataset.add); if (!p || state.request) return;
    const line = state.basket.find(x => x.id === p.id);
    if (line) line.qty++; else state.basket.push({ ...p, qty: 1 });
    render(); return;
  }
  if ('custom' in t.dataset) {
    const raw = prompt('Custom amount in GUD (for example, 12.50):');
    if (raw === null) return;
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) { state.error = 'Enter a valid GUD amount with at most two decimal places.'; render(); return; }
    const cents = Math.round(Number(raw.trim()) * 100);
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000000) { state.error = 'Amount is outside the allowed range.'; render(); return; }
    state.basket.push({ id: crypto.randomUUID(), name: 'Custom amount', cents, qty: 1 });
    state.error = ''; render(); return;
  }
  if (t.dataset.inc || t.dataset.dec || t.dataset.remove) {
    const id = t.dataset.inc || t.dataset.dec || t.dataset.remove;
    const line = state.basket.find(x => x.id === id);
    if (line) { if (t.dataset.inc) line.qty++; if (t.dataset.dec) line.qty--; if (t.dataset.remove || line.qty < 1) state.basket = state.basket.filter(x => x.id !== id); }
    render(); return;
  }
  if ('clear' in t.dataset) { state.basket = []; render(); return; }
  if ('charge' in t.dataset) { task(async () => {
    const cents = total();
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000000) throw new Error('Sale amount is outside the allowed range.');
    const description = state.basket.map(x => `${x.qty}× ${x.name}`).join(', ').slice(0, 200);
    state.request = await api.create(state.home.terminal_id, cents, description);
    state.notice = 'Waiting for customer approval.';
  }); return; }
  if ('cancel' in t.dataset) { task(async () => { await api.cancel(state.request.id); state.request = null; state.notice = 'Request cancelled.'; }); return; }
  if ('copy' in t.dataset) { navigator.clipboard.writeText(state.request.token).then(() => { state.notice = 'Terminal code copied.'; render(); }).catch(() => { state.error = 'Could not copy. Select the code manually.'; render(); }); return; }
  if (t.dataset.receipt) { state.receipt = state.home.transactions.find(x => x.event_id === t.dataset.receipt); render(); return; }
  if ('close' in t.dataset) { state.receipt = null; render(); return; }
  if ('print' in t.dataset) { window.print(); return; }
  if (t.dataset.refund) {
    const original = state.receipt;
    if (!confirm(`Refund the full ${amount(original.amount_minor)} to the original customer?`)) return;
    task(async () => {
      const storageKey = `greenwick-refund-key:${original.event_id}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, idempotencyKey); }
      await api.refund(original.event_id, idempotencyKey);
      state.receipt = null; await refreshHome(); state.notice = 'Full refund posted to the original customer wallet.';
    }); return;
  }
  if (t.dataset.deleteProduct) { state.catalogue = state.catalogue.filter(x => x.id !== t.dataset.deleteProduct); saveCatalogue(); render(); }
});
root.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.receipt) { state.receipt = null; render(); }
  if (event.key === 'Enter' && event.target.matches('tr[data-receipt]')) event.target.click();
});

render();
api.restore().then(async restored => {
  if (restored) await refreshHome();
}).catch(e => { state.error = e.message; }).finally(() => { state.ready = true; render(); });
