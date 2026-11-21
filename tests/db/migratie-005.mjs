// Test migratie 005 op PGlite: 001-004 + bestaande data + 005, daarnaast RLS en de functies als echte gebruikers.
// PGlite (Postgres in Node) komt uit de map van Be Strong, naast deze map. Ander pad: zet PGLITE=<pad naar pglite/dist/index.js>.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : new URL('../../../Be strong/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href);
const dir = new URL('../../supabase/migrations/', import.meta.url);
const read = f => readFileSync(new URL(f, dir), 'utf8');
const B = 'b0000000-0000-4000-8000-00000000000b', S = 'c0000000-0000-4000-8000-00000000000c', X = 'd0000000-0000-4000-8000-00000000000d';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) fails++; };

const db = new PGlite();
await db.exec(`
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
insert into auth.users values ('${B}','bjorn@test.nl'),('${S}','Steph@Test.nl'),('${X}','x@test.nl');`);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
for (const f of files.filter(f => f < '005')) await db.exec(read(f));

// Bestaande data zoals op productie: Bjorn heeft items en taken, Stéphanie nog niets.
await db.exec(`
insert into lists_items (user_id, name, standard, on_list, done, list_order, std_order) values
 ('${B}','Melk',true,true,false,1,1),('${B}','Brood',true,false,false,2,2),('${B}','Kaas',false,true,true,3,3);
insert into lists_tasks (user_id, name) values ('${B}','Rolluiken');
insert into lists_challenges (user_id, name) values ('${B}','Lopen');
insert into lists_wishlist (user_id, name) values ('${B}','Lamp');`);
await db.exec(read('005_delen.sql'));
ok(true, '005 loopt zonder fout op bestaande data');

async function as(uid, sql, params = []) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await tx.exec('set local role authenticated');
    return (await tx.query(sql, params)).rows;
  });
}
async function err(uid, sql, params) { try { await as(uid, sql, params); return null; } catch (e) { return e.message; } }
const names = async uid => (await as(uid, 'select name from lists_items order by name')).map(r => r.name).join(',');
const status = async uid => (await as(uid, 'select lists_share_status() s'))[0].s;

ok(await names(B) === 'Brood,Kaas,Melk', 'Bjorn ziet zijn items na de migratie');
ok((await as(B, 'select household_id = user_id h from lists_items')).every(r => r.h), 'Bjorns items in zijn eigen huishouden');

// Stéphanie: nieuw account, voegt zelf items toe (huishouden ontstaat vanzelf)
await as(S, `insert into lists_items (name, standard, on_list, list_order, std_order) values ('melk',false,true,1,null),('Appels',true,true,2,1)`);
ok(await names(S) === 'Appels,melk', 'Stéphanie ziet alleen haar eigen items');
ok(await names(B) === 'Brood,Kaas,Melk', 'Bjorn ziet Stéphanies items niet');
ok(!(await err(B, `insert into lists_items (name) values ('Appels')`)), 'zelfde naam in een ander huishouden mag');
await as(B, `delete from lists_items where name='Appels'`);

// Uitnodigen
ok(/klopt niet/.test(await err(B, `select lists_invite('geen-mail')`)), 'fout e-mailadres geweigerd');
await as(B, `select lists_invite('  STEPH@test.nl ')`);
await as(B, `select lists_invite('steph@test.nl')`); // dubbel: geen fout
let sb = await status(B), ss = await status(S);
ok(sb.sent.length === 1 && sb.sent[0] === 'steph@test.nl', 'Bjorn ziet de verstuurde uitnodiging');
ok(ss.received.length === 1 && ss.received[0].from === 'bjorn@test.nl', 'Stéphanie ziet de uitnodiging van Bjorn');
ok((await status(X)).received.length === 0, 'iemand anders ziet de uitnodiging niet');
const inv = ss.received[0].id;
ok(/bestaat niet/.test(await err(X, `select lists_accept_invite($1)`, [inv])), 'ander e-mailadres kan niet accepteren');
ok(/permission denied/.test(await err(S, `select * from lists_invites`) || ''), 'uitnodigingen-tabel niet direct leesbaar');
ok(/permission denied/.test(await err(S, `insert into lists_household_members values ('${S}','${B}')`) || ''), 'zelf lid worden via de tabel kan niet');
ok(/row-level security|violates/.test(await err(S, `insert into lists_items (name, household_id) values ('Hack','${B}')`) || ''), 'item in andermans huishouden zetten kan niet');

// Accepteren: melk + Melk samenvoegen, Appels verhuist
await as(S, `select lists_accept_invite($1)`, [inv]);
ok(await names(S) === 'Appels,Brood,Kaas,Melk', 'Stéphanie ziet na accepteren de gedeelde lijst');
ok(await names(B) === 'Appels,Brood,Kaas,Melk', 'Bjorn ziet Stéphanies Appels');
const melk = (await as(B, `select * from lists_items where name='Melk'`))[0];
ok(melk.standard && melk.on_list && !melk.done, 'Melk één keer, vast en op de lijst');
const orders = (await as(B, `select name, list_order, std_order from lists_items order by list_order`));
ok(new Set(orders.map(o => o.list_order)).size === 4 && orders.every(o => o.list_order != null), 'unieke volgorde op de lijst: ' + orders.map(o => o.name + '=' + o.list_order).join(' '));
sb = await status(B);
ok(sb.members.length === 2 && sb.sent.length === 0, 'Bjorn ziet 2 leden, geen open uitnodiging');
ok((await status(S)).received.length === 0, 'uitnodiging is weg na accepteren');

// Privé blijft privé
await as(S, `insert into lists_tasks (name) values ('Haar taak')`);
await as(S, `insert into lists_wishlist (name) values ('Haar wens')`);
ok((await as(B, 'select name from lists_tasks')).map(r => r.name).join() === 'Rolluiken', 'Thuis blijft privé (Bjorn)');
ok((await as(S, 'select name from lists_tasks')).map(r => r.name).join() === 'Haar taak', 'Thuis blijft privé (Stéphanie)');
ok((await as(S, 'select count(*)::int n from lists_challenges'))[0].n === 0, 'Challenges blijven privé');
ok((await as(B, 'select name from lists_wishlist')).map(r => r.name).join() === 'Lamp', 'Later kopen blijft privé');

// Samen werken
await as(S, `update lists_items set done = true where name='Brood'`);
ok((await as(B, `select done from lists_items where name='Brood'`))[0].done === true, 'Stéphanie vinkt af, Bjorn ziet het');
await as(S, `insert into lists_items (id, name, on_list) values ('e0000000-0000-4000-8000-00000000000e','Eieren',true)
             on conflict (id) do update set name = excluded.name, on_list = excluded.on_list`);
ok((await names(B)).includes('Eieren'), 'upsert zoals de app (nieuw item) werkt en Bjorn ziet het');
ok(/duplicate|unique/.test(await err(B, `insert into lists_items (name) values ('eieren')`) || ''), 'dubbele naam in het gedeelde huishouden geweigerd');
await as(B, `delete from lists_items where name='Eieren'`);
ok(!(await names(S)).includes('Eieren'), 'Bjorn verwijdert, weg voor Stéphanie');
ok(/row-level security|violates/.test(await err(S, `update lists_items set household_id='${X}' where name='Kaas'`) || ''), 'item naar ander huishouden verplaatsen kan niet');
ok(/geen|niet|Stop/.test(await err(X, `select lists_invite('bjorn@test.nl')`) || 'geen') , 'X kan Bjorn uitnodigen (mag)');
const xi = (await status(B)).received[0]?.id;
ok(/Stop eerst/.test(await err(B, `select lists_accept_invite($1)`, [xi]) || ''), 'wie al deelt kan geen tweede uitnodiging accepteren');
await as(B, `select lists_decline_invite($1)`, [xi]);
ok((await status(B)).received.length === 0, 'weigeren werkt');
ok(/al met dit/.test(await err(B, `select lists_invite('steph@test.nl')`) || ''), 'iemand uitnodigen met wie je al deelt geeft melding');
await as(B, `select lists_invite('x@test.nl')`); await as(B, `select lists_cancel_invite('X@test.nl')`);
ok((await status(B)).sent.length === 0, 'intrekken werkt');

// Stoppen met delen
await as(S, 'select lists_leave()');
ok(await names(S) === 'Appels,Brood,Kaas,Melk', 'Stéphanie houdt een kopie na stoppen');
await as(S, `delete from lists_items where name='Kaas'`);
ok((await names(B)).includes('Kaas'), 'na stoppen niet meer gedeeld');
ok((await status(S)).members.length === 1 && (await status(B)).members.length === 1, 'beide weer alleen');
await as(S, 'select lists_leave()'); ok(true, 'stoppen als je alleen bent: geen fout');

// anon
ok(/permission denied/.test(await db.transaction(async tx => { await tx.exec('set local role anon'); try { await tx.query('select lists_share_status()'); return ''; } catch (e) { return e.message; } })), 'niet ingelogd: functies niet bruikbaar');
console.log(fails ? `${fails} FOUT(EN)` : 'ALLES OK');
