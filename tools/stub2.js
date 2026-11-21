// Nagebootste Supabase met meerdere gebruikers en huishoudens (zoals migratie 005), voor de UI-test van Delen.
// De database staat in localStorage (gedeeld tussen tabbladen), de login per tabblad in sessionStorage.
// Wachtwoord is altijd 'goed'. Wijzigingen in het ene tabblad komen als "realtime" binnen in het andere.
(() => {
  const KEY = 'stub2-db';
  const fresh = () => ({ users: {}, members: {}, households: [], invites: [], lists_items: [], lists_challenges: [], lists_wishlist: [], lists_tasks: [] });
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { return fresh(); } };
  const save = (db) => { localStorage.setItem(KEY, JSON.stringify(db)); localStorage.setItem('stub2-tick', String(Math.random())); };
  const defaults = {
    lists_items: { standard: false, on_list: false, done: false, list_order: null, std_order: null },
    lists_challenges: { goal: null, count: 0, sales: false, done: false, done_at: null, sort_order: null },
    lists_wishlist: { price: null, priority: false, bought: false, bought_at: null, sort_order: null },
    lists_tasks: { link: null, later: false, done: false, done_at: null, sort_order: null },
  };
  const T = (window.__t = { handlers: {}, rpcs: [], offline: false, delay: 30 });
  const wait = () => new Promise((r) => setTimeout(r, T.delay));
  const uuid = () => crypto.randomUUID();
  let session = null;
  try { const s = JSON.parse(sessionStorage.getItem('stub2-session')); if (s) session = s; } catch (e) {}
  const uid = () => session && session.user.id;
  const offline = () => T.offline || sessionStorage.getItem('stub-offline');
  const OFF = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 };
  const fail = (message) => ({ data: null, error: { code: '22023', message, status: 400 }, status: 400 });

  function ensure(db) {
    const me = uid();
    if (!db.members[me]) { const h = uuid(); db.households.push(h); db.members[me] = h; }
    return db.members[me];
  }
  const emailOf = (db, id) => Object.keys(db.users).find((e) => db.users[e] === id);
  const visible = (db, t) => t === 'lists_items' ? db.lists_items.filter((r) => r.household_id === db.members[uid()]) : db[t].filter((r) => r.user_id === uid());

  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.id = null; }
    select() { return this; }
    upsert(v) { this.op = 'upsert'; this.v = v; return this; }
    insert(v) { this.op = 'upsert'; this.v = v; return this; }
    update(v) { this.op = 'update'; this.v = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(_c, id) { this.id = id; return this; }
    async run() {
      await wait();
      if (offline()) return OFF;
      if (!uid()) return { data: null, error: { status: 401, message: 'jwt' }, status: 401 };
      const db = load(), t = this.t;
      if (t === 'lists_items' && this.op !== 'select') ensure(db);
      const rows = visible(db, t);
      if (this.op === 'select') return { data: JSON.parse(JSON.stringify(rows)), error: null, status: 200 };
      const dup = (name, id) => t === 'lists_items' && name != null && rows.some((r) => r.id !== id && r.name.toLowerCase() === String(name).toLowerCase());
      if (this.op === 'upsert') {
        if (dup(this.v.name, this.v.id)) return { error: { code: '23505', message: 'dubbel' }, status: 409 };
        const r = db[t].find((x) => x.id === this.v.id);
        if (r && !rows.includes(r)) return { error: { code: '42501', message: 'rls' }, status: 403 };
        if (r) Object.assign(r, this.v);
        else db[t].push({ ...defaults[t], user_id: uid(), ...(t === 'lists_items' ? { household_id: db.members[uid()] } : {}), ...this.v });
      }
      if (this.op === 'update') {
        if (dup(this.v.name, this.id)) return { error: { code: '23505', message: 'dubbel' }, status: 409 };
        const r = rows.find((x) => x.id === this.id); if (r) Object.assign(r, this.v);
      }
      if (this.op === 'delete') { const r = rows.find((x) => x.id === this.id); if (r) db[t].splice(db[t].indexOf(r), 1); }
      save(db); ping(t);
      return { data: null, error: null, status: 201 };
    }
    then(a, b) { return this.run().then(a, b); }
  }

  const RPC = {
    lists_share_status(db) {
      const h = ensure(db), me = uid(), my = emailOf(db, me);
      return {
        members: Object.entries(db.members).filter(([, x]) => x === h).map(([u]) => ({ email: emailOf(db, u), me: u === me })),
        sent: db.invites.filter((i) => i.hh === h).map((i) => i.email),
        received: db.invites.filter((i) => i.email === my && i.hh !== h).map((i) => ({ id: i.id, from: emailOf(db, i.by) })),
      };
    },
    lists_invite(db, { p_email }) {
      const h = ensure(db), e = String(p_email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw 'Dit e-mailadres klopt niet.';
      if (Object.entries(db.members).some(([u, x]) => x === h && emailOf(db, u) === e)) throw 'Je deelt al met dit e-mailadres.';
      if (!db.invites.some((i) => i.hh === h && i.email === e)) db.invites.push({ id: uuid(), hh: h, email: e, by: uid() });
    },
    lists_cancel_invite(db, { p_email }) { const h = db.members[uid()]; db.invites = db.invites.filter((i) => !(i.hh === h && i.email === String(p_email).trim().toLowerCase())); },
    lists_decline_invite(db, { p_id }) { const my = emailOf(db, uid()); db.invites = db.invites.filter((i) => !(i.id === p_id && i.email === my)); },
    lists_accept_invite(db, { p_id }) {
      const me = uid(), old = ensure(db), inv = db.invites.find((i) => i.id === p_id && i.email === emailOf(db, me));
      if (!inv) throw 'Deze uitnodiging bestaat niet meer.';
      if (Object.entries(db.members).some(([u, x]) => x === old && u !== me)) throw 'Je deelt al met iemand. Stop eerst met delen.';
      const nw = inv.hh, target = db.lists_items.filter((r) => r.household_id === nw);
      let maxL = Math.max(0, ...target.map((r) => r.list_order || 0)), maxS = Math.max(0, ...target.map((r) => r.std_order || 0));
      for (const s of db.lists_items.filter((r) => r.household_id === old)) {
        const t = target.find((r) => r.name.toLowerCase() === s.name.toLowerCase());
        if (t) {
          const done = t.on_list && s.on_list ? t.done && s.done : s.on_list ? s.done : t.done;
          if (!t.on_list && s.on_list) t.list_order = ++maxL;
          Object.assign(t, { standard: t.standard || s.standard, on_list: t.on_list || s.on_list, done });
          db.lists_items.splice(db.lists_items.indexOf(s), 1);
        } else Object.assign(s, { household_id: nw, list_order: ++maxL, std_order: ++maxS });
      }
      db.members[me] = nw;
      db.invites = db.invites.filter((i) => i.id !== p_id && i.hh !== old);
    },
    lists_leave(db) {
      const me = uid(), old = ensure(db);
      if (!Object.entries(db.members).some(([u, x]) => x === old && u !== me)) return;
      const nw = uuid(); db.households.push(nw);
      for (const r of db.lists_items.filter((x) => x.household_id === old)) db.lists_items.push({ ...r, id: uuid(), user_id: me, household_id: nw });
      db.members[me] = nw;
      db.invites = db.invites.filter((i) => !(i.hh === old && i.by === me));
    },
  };

  function ping(t) { for (const h of T.handlers[t] || []) setTimeout(h); }
  window.addEventListener('storage', (e) => { if (e.key === 'stub2-tick') for (const t of Object.keys(T.handlers)) ping(t); });

  window.supabase = {
    createClient() {
      let cb = null;
      const fire = (ev) => cb && cb(ev, session);
      return {
        from: (t) => new Q(t),
        async rpc(name, args = {}) {
          await wait();
          T.rpcs.push({ name, args });
          if (offline()) return OFF;
          const db = load();
          try { const data = RPC[name](db, args); save(db); ping('lists_items'); return { data: data ?? null, error: null, status: 200 }; }
          catch (m) { if (typeof m !== 'string') throw m; return fail(m); }
        },
        auth: {
          onAuthStateChange(f) { cb = f; setTimeout(() => fire('INITIAL_SESSION')); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithPassword({ email, password }) {
            await wait();
            if (password !== 'goed') return { error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' } };
            const db = load(), e = email.toLowerCase();
            if (!db.users[e]) { db.users[e] = uuid(); save(db); }
            session = { user: { id: db.users[e], email: e } }; sessionStorage.setItem('stub2-session', JSON.stringify(session)); fire('SIGNED_IN'); return { error: null };
          },
          async signOut() { session = null; sessionStorage.removeItem('stub2-session'); fire('SIGNED_OUT'); return { error: null }; },
        },
        channel() {
          const ch = {
            on(_e, f, h) { (T.handlers[f.table] ||= []).push(h); return ch; },
            subscribe(s) { setTimeout(() => s('SUBSCRIBED')); return ch; },
          };
          return ch;
        },
        removeChannel() { T.handlers = {}; },
      };
    },
  };
})();
