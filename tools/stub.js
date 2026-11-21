// Nagebootste Supabase in het geheugen, alleen voor de UI-test.
(() => {
  const db = { lists_items: [], lists_challenges: [], lists_wishlist: [], lists_tasks: [] };
  const defaults = {
    lists_items: { standard: false, on_list: false, done: false, list_order: null, std_order: null },
    lists_challenges: { goal: null, count: 0, done: false, done_at: null, sort_order: null },
    lists_wishlist: { price: null, priority: false, bought: false, bought_at: null, sort_order: null },
    lists_tasks: { link: null, done: false, done_at: null, sort_order: null },
  };
  try { const saved = sessionStorage.getItem('stub-db'); if (saved) Object.assign(db, JSON.parse(saved)); } catch (e) {}
  const T = (window.__t = { db, writes: [], signOut: [], handlers: {}, delay: 30, fail: false, cfg: null, channels: 0, removed: 0 });
  const wait = () => new Promise((r) => setTimeout(r, T.delay));
  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.id = null; }
    select() { return this; }
    insert(v) { this.op = 'insert'; this.v = v; return this; }
    upsert(v) { this.op = 'upsert'; this.v = v; return this; }
    update(v) { this.op = 'update'; this.v = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(_c, id) { this.id = id; return this; }
    async run() {
      await wait();
      if (T.offline || sessionStorage.getItem('stub-offline')) return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 };
      if (T.fail) return { data: null, error: { message: 'kapot' }, status: 400 };
      const rows = db[this.t];
      if (this.op === 'select') return { data: JSON.parse(JSON.stringify(rows)), error: null, status: 200 };
      T.writes.push({ t: this.t, op: this.op, v: this.v, id: this.id });
      const dup = (name, id) => this.t === 'lists_items' && rows.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase());
      if (this.op === 'insert') {
        if (dup(this.v.name)) return { error: { code: '23505', message: 'dubbel' }, status: 409 };
        rows.push({ ...defaults[this.t], user_id: 'u1', updated_at: new Date().toISOString(), ...this.v });
      }
      if (this.op === 'upsert') {
        if (dup(this.v.name, this.v.id)) return { error: { code: '23505', message: 'dubbel' }, status: 409 };
        const r = rows.find((x) => x.id === this.v.id);
        if (r) Object.assign(r, this.v); else rows.push({ ...defaults[this.t], user_id: 'u1', updated_at: new Date().toISOString(), ...this.v });
      }
      if (this.op === 'update') { const r = rows.find((x) => x.id === this.id); if (r) Object.assign(r, this.v); }
      if (this.op === 'delete') { const i = rows.findIndex((x) => x.id === this.id); if (i >= 0) rows.splice(i, 1); }
      sessionStorage.setItem('stub-db', JSON.stringify(db));
      return { data: null, error: null, status: 201 };
    }
    then(a, b) { return this.run().then(a, b); }
  }
  window.supabase = {
    createClient(url, key, cfg) {
      T.cfg = { url, key, ...cfg };
      let cb = null, session = sessionStorage.getItem('stub-session') ? { user: { id: 'u1' } } : null;
      const fire = (ev) => cb && cb(ev, session);
      return {
        from: (t) => new Q(t),
        auth: {
          onAuthStateChange(f) { cb = f; setTimeout(() => fire('INITIAL_SESSION')); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithPassword({ email, password }) {
            await wait();
            if (password !== 'goed') return { error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' } };
            session = { user: { id: 'u1', email } }; sessionStorage.setItem('stub-session', '1'); fire('SIGNED_IN'); return { error: null };
          },
          async signOut(o) { T.signOut.push(o); session = null; sessionStorage.removeItem('stub-session'); fire('SIGNED_OUT'); return { error: null }; },
        },
        channel() {
          T.channels++;
          const ch = {
            on(_e, f, h) { (T.handlers[f.table] ||= []).push(h); return ch; },
            subscribe(s) { setTimeout(() => s(T.state || 'SUBSCRIBED')); T.sub = s; return ch; },
          };
          return ch;
        },
        removeChannel() { T.removed++; T.handlers = {}; },
      };
    },
  };
})();
