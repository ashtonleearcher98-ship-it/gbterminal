// Static GitHub Pages client. The publishable key is public; all financial
// authority belongs to the authenticated Supabase RPCs in migration 007.
export const SUPABASE_URL = 'https://opscpbgnwvzplrdmwood.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_RwzmYnvkatFNyJRqsB-9wA_8HABdoSx';
const SESSION_KEY = 'greenwick-terminal-web-session-v1';

export class GreenwickAPI {
  constructor({ fetcher = fetch, storage = sessionStorage, cryptoAPI = crypto } = {}) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.crypto = cryptoAPI;
    this.session = null;
    this.refreshing = null;
  }
  async request(path, body, authenticated = false, retry = true) {
    if (authenticated) await this.ensureSession();
    const response = await this.fetcher(`${SUPABASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PUBLISHABLE_KEY,
        ...(authenticated ? { Authorization: `Bearer ${this.session.access_token}` } : {})
      },
      body: JSON.stringify(body)
    });
    if (response.status === 401 && authenticated && retry) {
      await this.refresh();
      return this.request(path, body, true, false);
    }
    const raw = await response.text();
    let result;
    try { result = raw ? JSON.parse(raw) : null; } catch { result = raw; }
    if (!response.ok) throw new Error(result?.message || result?.msg || result?.error_description || `Request failed (${response.status})`);
    return result;
  }
  remember(result) {
    if (!result?.access_token || !result?.refresh_token) throw new Error('Authentication did not return a session.');
    this.session = {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600)
    };
    this.storage.setItem(SESSION_KEY, JSON.stringify({ refresh_token: this.session.refresh_token }));
    return this.session;
  }
  async signIn(email, password) {
    return this.remember(await this.request('/auth/v1/token?grant_type=password', { email: email.trim(), password }));
  }
  async signUp(name, email, password) {
    if (name.trim().length < 2 || password.length < 8 || !email.includes('@')) throw new Error('Enter a name, email and password of at least eight characters.');
    const result = await this.request('/auth/v1/signup', { email: email.trim(), password, data: { full_name: name.trim() } });
    if (result?.access_token) return this.remember(result);
    return null; // Email confirmation is enabled in this Supabase project.
  }
  async restore() {
    let saved;
    try { saved = JSON.parse(this.storage.getItem(SESSION_KEY) || 'null'); } catch { this.storage.removeItem(SESSION_KEY); }
    if (!saved?.refresh_token) return false;
    try { await this.refresh(saved.refresh_token); return true; }
    catch { this.clear(); return false; }
  }
  async refresh(refreshToken = this.session?.refresh_token) {
    if (this.refreshing) return this.refreshing;
    if (!refreshToken) throw new Error('Please sign in again.');
    this.refreshing = (async () => this.remember(await this.request('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: refreshToken
    })))();
    try { return await this.refreshing; } finally { this.refreshing = null; }
  }
  async ensureSession() {
    if (!this.session) throw new Error('Please sign in again.');
    if (this.session.expires_at - Math.floor(Date.now() / 1000) < 60) await this.refresh();
  }
  clear() { this.session = null; this.storage.removeItem(SESSION_KEY); }
  async signOut() {
    try { if (this.session) await this.request('/auth/v1/logout', {}, true); }
    finally { this.clear(); }
  }
  rpc(name, body = {}) { return this.request(`/rest/v1/rpc/greenwick_${name}`, body, true); }
  home() { return this.rpc('terminal_home'); }
  register(name) { return this.rpc('register_merchant', { p_name: name.trim() }); }
  async create(terminalId, amountMinor, description) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 100000000000) throw new Error('Invalid amount.');
    const token = new Uint8Array(16);
    this.crypto.getRandomValues(token);
    const digest = new Uint8Array(await this.crypto.subtle.digest('SHA-256', token));
    const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const request = await this.rpc('create_terminal_request', {
      p_terminal_id: terminalId, p_amount_minor: amountMinor,
      p_description: description.slice(0, 200), p_token_sha256_hex: toHex(digest)
    });
    return { id: request.request_id, amountMinor, description, token: toHex(token), expiresAt: request.expires_at };
  }
  status(id) { return this.rpc('terminal_request_status', { p_request_id: id }); }
  cancel(id) { return this.rpc('cancel_terminal_request', { p_request_id: id }); }
  refund(eventId, key) { return this.rpc('refund_terminal_payment', { p_event_id: eventId, p_idempotency_key: key }); }
}
