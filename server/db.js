/**
 * 数据层：node:sqlite（Node >=22.5 内置，零第三方依赖）
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.XD_DATA_DIR || join(ROOT, 'data');
export const DB_FILE = join(DATA_DIR, 'xdxp.db');
mkdirSync(DATA_DIR, { recursive: true });

let _db = null;

export function db() {
  if (_db) return _db;
  const d = new DatabaseSync(DB_FILE);
  d.exec('PRAGMA journal_mode = WAL');
  d.exec('PRAGMA foreign_keys = ON');
  d.exec(`
    CREATE TABLE IF NOT EXISTS projects(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fmt TEXT NOT NULL DEFAULT 'industrial',
      params TEXT NOT NULL,
      cat TEXT NOT NULL,
      bt  TEXT NOT NULL,
      fx  TEXT NOT NULL,
      pb  TEXT NOT NULL,
      created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS items(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pid TEXT NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0,
      cat TEXT, brand TEXT, name TEXT, barcode TEXT,
      spec TEXT, sb TEXT, price REAL, cost REAL,
      role TEXT, faces REAL, qty INTEGER,
      d TEXT, c TEXT, a TEXT, m TEXT, x TEXT,
      ord INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_items_pid ON items(pid);
    CREATE TABLE IF NOT EXISTS cat5(
      pid TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      parent TEXT NOT NULL DEFAULT '',
      ord INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(pid, code)
    );
    CREATE INDEX IF NOT EXISTS idx_cat5_pid_parent ON cat5(pid, parent);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
  `);
  _db = d;
  return d;
}

/* ── 通用助手 ── */
export function q(sql, ...a) { return db().prepare(sql).all(...a); }
export function q1(sql, ...a) { return db().prepare(sql).get(...a); }
export function run(sql, ...a) { return db().prepare(sql).run(...a); }

export function metaGet(k, dflt) {
  const r = q1('SELECT v FROM meta WHERE k=?', k);
  return r ? r.v : dflt;
}
export function metaSet(k, v) {
  run('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v));
}

/* ── 5 级分类模板（pid='__tpl__'） ── */
const cat5Tpl = JSON.parse(readFileSync(join(ROOT, 'server', 'data', 'cat5.json'), 'utf8'));

export function ensureTemplate() {
  const c = q1('SELECT COUNT(*) c FROM cat5 WHERE pid=?', '__tpl__');
  if (c && c.c > 0) return;
  const ins = db().prepare('INSERT INTO cat5(pid,code,name,level,parent,ord) VALUES(?,?,?,?,?,?)');
  db().exec('BEGIN');
  for (const n of cat5Tpl.nodes) ins.run('__tpl__', n.code, n.name, n.level, n.parent, n.ord);
  db().exec('COMMIT');
}

export function cat5Clone(pid) {
  run('DELETE FROM cat5 WHERE pid=?', pid);
  const stmt = db().prepare("INSERT INTO cat5(pid,code,name,level,parent,ord) SELECT ?,code,name,level,parent,ord FROM cat5 WHERE pid='__tpl__'");
  db().exec('BEGIN');
  stmt.run(pid);
  db().exec('COMMIT');
}

export function cat5Nodes(pid, level, parent) {
  if (level === undefined) return q('SELECT * FROM cat5 WHERE pid=? ORDER BY code', pid);
  if (parent === undefined) return q('SELECT * FROM cat5 WHERE pid=? AND level=? ORDER BY ord, code', pid, level);
  return q('SELECT * FROM cat5 WHERE pid=? AND level=? AND parent=? ORDER BY ord, code', pid, level, parent);
}

export function cat5Node(pid, code) {
  return q1('SELECT * FROM cat5 WHERE pid=? AND code=?', pid, code);
}

/** 某节点自身 + 全部后代 code 集合（用于删除 / 统计） */
export function cat5Descendants(pid, code) {
  const out = [code];
  const stack = [code];
  while (stack.length) {
    const p = stack.pop();
    for (const r of q('SELECT code,level FROM cat5 WHERE pid=? AND parent=?', pid, p)) {
      out.push(r.code);
      if (r.level < 5) stack.push(r.code);
    }
  }
  return out;
}

export function cat5Stat(pid) {
  const rows = q('SELECT level, COUNT(*) c FROM cat5 WHERE pid=? GROUP BY level', pid);
  const s = { dept: 0, chu: 0, da: 0, zhong: 0, xiao: 0 };
  const MAP = { 1: 'dept', 2: 'chu', 3: 'da', 4: 'zhong', 5: 'xiao' };
  rows.forEach((r) => { s[MAP[r.level]] = r.c; });
  return s;
}

/** 关联单品计数：按「小类 code」分组 */
export function cat5ItemCounts(pid) {
  const rows = q('SELECT d,c,a,m,x, COUNT(*) n FROM items WHERE pid=? GROUP BY d,c,a,m,x', pid);
  const at = { d: {}, c: {}, a: {}, m: {}, x: {} };
  for (const r of rows) {
    at.d[r.d] = (at.d[r.d] || 0) + r.n;
    at.c[r.c] = (at.c[r.c] || 0) + r.n;
    at.a[r.a] = (at.a[r.a] || 0) + r.n;
    at.m[r.m] = (at.m[r.m] || 0) + r.n;
    at.x[r.x] = (at.x[r.x] || 0) + r.n;
  }
  return at;
}

/* ── 项目读写 ── */
export function listProjects() {
  return q('SELECT id,name,fmt,created_at,updated_at FROM projects ORDER BY updated_at DESC');
}
export function getProject(id) {
  const r = q1('SELECT * FROM projects WHERE id=?', id);
  if (!r) return null;
  return {
    id: r.id, name: r.name, fmt: r.fmt,
    params: JSON.parse(r.params), cat: JSON.parse(r.cat),
    bt: JSON.parse(r.bt), fx: JSON.parse(r.fx), pb: JSON.parse(r.pb),
    created_at: r.created_at, updated_at: r.updated_at
  };
}
export function saveProject(p) {
  run(`UPDATE projects SET name=@name, fmt=@fmt, params=@params, cat=@cat, bt=@bt, fx=@fx, pb=@pb, updated_at=@ts WHERE id=@id`, {
    name: p.name, fmt: p.fmt,
    params: JSON.stringify(p.params), cat: JSON.stringify(p.cat),
    bt: JSON.stringify(p.bt), fx: JSON.stringify(p.fx), pb: JSON.stringify(p.pb),
    ts: Date.now(), id: p.id
  });
}
export function insertProject(p) {
  run(`INSERT INTO projects(id,name,fmt,params,cat,bt,fx,pb,created_at,updated_at)
       VALUES(@id,@name,@fmt,@params,@cat,@bt,@fx,@pb,@ts,@ts)`, {
    id: p.id, name: p.name, fmt: p.fmt,
    params: JSON.stringify(p.params), cat: JSON.stringify(p.cat),
    bt: JSON.stringify(p.bt), fx: JSON.stringify(p.fx), pb: JSON.stringify(p.pb),
    ts: Date.now()
  });
}
export function deleteProject(id) {
  run('DELETE FROM items WHERE pid=?', id);
  run('DELETE FROM cat5 WHERE pid=?', id);
  run('DELETE FROM projects WHERE id=?', id);
}

/* ── 单品 ── */
export function items(pid) {
  return q('SELECT * FROM items WHERE pid=? ORDER BY ord, id', pid).map(normItem);
}
export function itemsCount(pid) {
  const r = q1('SELECT COUNT(*) c FROM items WHERE pid=?', pid);
  return r ? r.c : 0;
}
function normItem(r) {
  return {
    id: r.id, pid: r.pid, seq: r.seq, cat: r.cat, brand: r.brand, name: r.name,
    barcode: r.barcode, spec: r.spec, sb: r.sb, price: r.price, cost: r.cost,
    role: r.role, faces: r.faces, qty: r.qty === null ? null : r.qty,
    cat5: { d: r.d, c: r.c, a: r.a, m: r.m, x: r.x }
  };
}
export function insertItem(pid, it) {
  const r = run(`INSERT INTO items(pid,seq,cat,brand,name,barcode,spec,sb,price,cost,role,faces,qty,d,c,a,m,x,ord)
    VALUES(@pid,@seq,@cat,@brand,@name,@barcode,@spec,@sb,@price,@cost,@role,@faces,@qty,@d,@c,@a,@m,@x,@ord)`, {
    pid, seq: it.seq || 0, cat: it.cat, brand: it.brand, name: it.name, barcode: it.barcode,
    spec: it.spec, sb: it.sb, price: it.price, cost: it.cost, role: it.role, faces: it.faces,
    qty: (it.qty === undefined || it.qty === null) ? null : it.qty,
    d: it.cat5.d, c: it.cat5.c, a: it.cat5.a, m: it.cat5.m, x: it.cat5.x, ord: it.ord || 0
  });
  return Number(r.lastInsertRowid);
}
export function updateItem(id, patch) {
  const COLS = ['seq', 'cat', 'brand', 'name', 'barcode', 'spec', 'sb', 'price', 'cost', 'role', 'faces', 'qty', 'd', 'c', 'a', 'm', 'x'];
  const sets = [], vals = {};
  for (const k of COLS) {
    if (!(k in patch)) continue;
    sets.push(k + '=@' + k);
    vals[k] = (patch[k] === undefined ? null : patch[k]);
  }
  if (!sets.length) return 0;
  vals.id = id;
  return run('UPDATE items SET ' + sets.join(',') + ' WHERE id=@id', vals).changes;
}
export function deleteItem(id) { return run('DELETE FROM items WHERE id=?', id).changes; }
export function clearItems(pid) { return run('DELETE FROM items WHERE pid=?', pid).changes; }

ensureTemplate();
