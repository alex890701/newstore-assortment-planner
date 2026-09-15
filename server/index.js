/**
 * 服务端入口：Node 原生 http（零第三方依赖）
 * 静态托管 public/ + REST API + SQLite 持久化
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as DICT from './dict.js';
import * as DB from './db.js';
import * as E from './engine.js';
import * as SEED from './seed.js';
import * as RG from './regions.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const PORT = +(process.env.XD_PORT || 3020);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json'
};

/* ────────── HTTP helpers ────────── */
function json(res, obj, code = 200) {
  const b = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length });
  res.end(b);
}
function text(res, body, type = 'text/plain; charset=utf-8', code = 200) {
  const b = Buffer.from(body, 'utf8');
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': b.length });
  res.end(b);
}
const err = (res, msg, code = 400) => json(res, { error: String(msg) }, code);

async function body(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
}
function csv(rows) {
  return '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/* ────────── 项目初始化 ────────── */
function newProject(id, name, fmt) {
  const f = DICT.PRESET[fmt] ? fmt : 'industrial';
  const fr = DICT.FRESH_DEF[f] || { a: 22, s: 26 };
  return {
    id, name: name || '未命名门店',
    fmt: f,
    params: { ...DICT.DEFAULT_PARAMS, proj: name || DICT.DEFAULT_PARAMS.proj, freshArea: fr.a, freshSales: fr.s },
    cat: E.makeCatState(f),
    bt: {},
    fx: E.defaultFx(),
    pb: { tgt: DICT.PB_PRESET[1].v.slice(), idx: 1 }
  };
}

function resetInit(p, fmt) {
  const f = DICT.PRESET[fmt] ? fmt : 'industrial';
  const fr = DICT.FRESH_DEF[f] || { a: 22, s: 26 };
  p.fmt = f;
  p.params = { ...DICT.DEFAULT_PARAMS, freshArea: fr.a, freshSales: fr.s };
  p.cat = E.makeCatState(f);
  p.bt = {};
  p.fx = E.defaultFx();
  p.pb = { tgt: DICT.PB_PRESET[1].v.slice(), idx: 1 };
  DB.clearItems(p.id);
  SEED.genItems(p.id, 15).forEach((it) => DB.insertItem(p.id, it));
  DB.cat5Clone(p.id);
  SEED.treeFlush(p.id);
  return p;
}

/* ────────── 路由 ────────── */
const R = [];
const route = (m, pat, fn) => R.push({ m, pat: pat.split('/').filter(Boolean), fn });

function match(url, method) {
  const parts = url.split('/').filter(Boolean);
  for (const r of R) {
    if (r.m !== method) continue;                     // ★ 必须按方法匹配，否则 POST/PATCH 会命中同名 GET
    if (r.pat.length !== parts.length) continue;
    const p = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (r.pat[i][0] === ':') p[r.pat[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (r.pat[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { r, p };
  }
  return null;
}

route('get', '/api/dict', async (req, res) => json(res, {
  CAT_DEF: DICT.CAT_DEF, CAT_IDS: DICT.CAT_IDS, CAT_MAP: DICT.CAT_MAP,
  PRESET: DICT.PRESET, FMT_NAME: DICT.FMT_NAME, BAY_MIX: DICT.BAY_MIX,
  FRESH_DEF: DICT.FRESH_DEF, DENSITY: DICT.DENSITY, ZONE_K: DICT.ZONE_K, ZONE_NAME: DICT.ZONE_NAME,
  ROLES: DICT.ROLES, SPEC: DICT.SPEC, SPEC_K: DICT.SPEC_K,
  BANDS: DICT.BANDS, BAND_C: DICT.BAND_C, PB_EDGE: DICT.PB_EDGE, PB_RG: DICT.PB_RG,
  PB_MIDR: DICT.PB_MIDR, PB_PRESET: DICT.PB_PRESET,
  TIERS: DICT.TIERS, BRAND_TIERS: DICT.BRAND_TIERS,
  CAT5_LINK: DICT.CAT5_LINK, DEPT_COLOR: DICT.DEPT_COLOR, DEPTS: DICT.DEPTS,
  REF_PRICE: DICT.REF_PRICE, CAT_UNIT: DICT.CAT_UNIT, THEME: DICT.THEME,
  ZONES: DICT.ZONES, FX_SPEC3: DICT.FX_SPEC3, FX_BASE: DICT.FX_BASE, BK_NAME: DICT.BK_NAME,
  DEFAULT_PARAMS: DICT.DEFAULT_PARAMS, VERSION: DICT.DICT_VERSION,
  REGION_VERSION: RG.REGION_VERSION
}));

route('get', '/api/projects', async (req, res) => {
  const rows = DB.listProjects().map((p) => {
    p.itemCount = DB.itemsCount(p.id);
    return p;
  });
  json(res, rows);
});

/* ── 行政区划（懒加载：parent 为空返回全部省；非空返回子级） ── */
route('get', '/api/regions', async (req, res, _p, q) => {
  try {
    json(res, { version: RG.REGION_VERSION, items: RG.list(q.parent || '') });
  } catch (e) {
    console.error('regions error', e);
    err(res, e.message, 500);
  }
});

route('post', '/api/projects', async (req, res) => {
  const b = await body(req);
  const id = 'p' + Date.now().toString(36);
  const p = newProject(id, b.name || DICT.DEFAULT_PARAMS.proj, b.fmt || 'industrial');
  DB.insertProject(p);
  DB.cat5Clone(id);
  SEED.treeFlush(id);
  SEED.genItems(id, +(b.per || 15)).forEach((it) => DB.insertItem(id, it));
  json(res, { id: p.id, name: p.name });
});

route('get', '/api/projects/:id', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  json(res, { ...p, itemCount: DB.itemsCount(id), catStat: DB.cat5Stat(id) });
});

route('patch', '/api/projects/:id', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  if (b.name != null) p.name = b.name;
  if (b.fmt != null && DICT.PRESET[b.fmt]) {
    p.fmt = b.fmt;
    if (b.applyPreset !== false) {
      p.cat = E.makeCatState(b.fmt);
      const fr = DICT.FRESH_DEF[b.fmt];
      p.params.freshArea = fr.a; p.params.freshSales = fr.s;
    }
  }
  if (b.params) Object.assign(p.params, b.params);
  if (b.cat) {
    for (const k of DICT.CAT_IDS) if (b.cat[k]) Object.assign(p.cat[k], b.cat[k]);
    if (b.normalize) E.normalizeCat(p.cat);
  }
  if (b.bt) Object.assign(p.bt, b.bt);
  if (b.fx) for (const k in b.fx) p.fx[k] = { ...(p.fx[k] || {}), ...b.fx[k] };
  if (b.pb) Object.assign(p.pb, b.pb);
  DB.saveProject(p);
  json(res, { ok: true, updatedAt: p.updated_at });
});

route('delete', '/api/projects/:id', async (req, res, { id }) => {
  DB.deleteProject(id);
  SEED.treeFlush(id);
  json(res, { ok: true });
});

route('post', '/api/projects/:id/reset', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  resetInit(p, b.fmt || p.fmt);
  DB.saveProject(p);
  json(res, { ok: true });
});

route('get', '/api/projects/:id/compute', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  try {
    json(res, E.compute(p));
  } catch (e) {
    console.error('compute error', e);
    err(res, e.message, 500);
  }
});

/* ── 单品 ── */
route('get', '/api/projects/:id/items', async (req, res, { id }, q) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const R = E.compute(p);
  let list = R.item;
  const f = { d: q.d, c: q.c, a: q.a, m: q.m, x: q.x };
  Object.keys(f).forEach((k) => {
    if (f[k]) list = list.filter((it) => it.cat5 && it.cat5[k] === f[k]);
  });
  if (q.role) list = list.filter((it) => it.role === q.role);
  if (q.cat) list = list.filter((it) => it.cat === q.cat);
  if (q.dept) list = list.filter((it) => it.dept === q.dept);
  if (q.k) {
    const kw = String(q.k).toLowerCase();
    list = list.filter((it) => (it.name + ' ' + it.brand + ' ' + it.barcode).toLowerCase().indexOf(kw) >= 0);
  }
  const totalCount = list.length;
  const page = Math.max(1, +(q.page || 1)), size = Math.min(500, Math.max(10, +(q.size || 80)));
  const total = Math.max(1, Math.ceil(totalCount / size));
  const cur = Math.min(page, total);
  return json(res, {
    rows: list.slice((cur - 1) * size, cur * size),
    page: cur, size, total, count: totalCount, all: totalCount,
    sum: {
      day: Math.round(list.reduce((a, b) => a + b._day, 0)),
      amt: Math.round(list.reduce((a, b) => a + b._amt, 0)),
      qty: list.reduce((a, b) => a + b.qty, 0)
    }
  });
});

route('post', '/api/projects/:id/items', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  const cnt = DB.itemsCount(id);
  const catId = DICT.CAT_IDS.includes(b.cat) ? b.cat : DICT.CAT_IDS[0];
  const ci = DICT.CAT_IDS.indexOf(catId);
  const it = {
    seq: cnt, cat: catId, brand: b.brand || '未标注品牌', name: b.name || '新单品',
    barcode: b.barcode || SEED.makeBarcode(ci, cnt), spec: b.spec || '', sb: b.sb || DICT.SPEC[1],
    price: +(b.price || DICT.REF_PRICE[catId] || 10), cost: +(b.cost || 0) || +((+b.price || 10) * 0.8).toFixed(2),
    role: DICT.ROLE_MAP[b.role] ? b.role : 'main', faces: +(b.faces || DICT.ROLE_MAP[b.role || 'main'].f),
    qty: (b.qty == null ? null : +b.qty),
    cat5: b.cat5 && b.cat5.a ? b.cat5 : SEED.cat5Of(id, catId, cnt),
    ord: 99000 + cnt
  };
  const nid = DB.insertItem(id, it);
  json(res, { ok: true, id: nid });
});

route('patch', '/api/projects/:id/items/:iid', async (req, res, { id, iid }) => {
  const b = await body(req);
  const patch = {};
  const F = ['brand', 'name', 'barcode', 'spec', 'sb', 'price', 'cost', 'role', 'faces', 'qty', 'cat'];
  for (const k of F) if (b[k] !== undefined) patch[k] = b[k];
  if (b.cat5) { patch.d = b.cat5.d; patch.c = b.cat5.c; patch.a = b.cat5.a; patch.m = b.cat5.m; patch.x = b.cat5.x; }
  if (b.qty === 'auto' || b.qty === '') patch.qty = null;
  const n = DB.updateItem(+iid, patch);
  json(res, { ok: n > 0 });
});

route('delete', '/api/projects/:id/items/:iid', async (req, res, { id, iid }) => {
  json(res, { ok: DB.deleteItem(+iid) > 0 });
});

route('delete', '/api/projects/:id/items', async (req, res, { id }) => {
  json(res, { ok: DB.clearItems(id) >= 0 });
});

route('post', '/api/projects/:id/items/generate', async (req, res, { id }) => {
  const b = await body(req);
  DB.clearItems(id);
  SEED.treeFlush(id);
  SEED.genItems(id, Math.max(1, Math.min(60, +(b.per || 15)))).forEach((it) => DB.insertItem(id, it));
  json(res, { ok: true, count: DB.itemsCount(id) });
});

route('post', '/api/projects/:id/items/import', async (req, res, { id }) => {
  const b = await body(req);
  const lines = String(b.csv || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return err(res, 'CSV 为空');
  const rows = lines.map((l) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
  const head = rows[0].map((h) => h.trim());
  const idx = (n) => head.indexOf(n);
  const MAP = {
    中类: 'cat', 品牌: 'brand', 商品名称: 'name', 条码: 'barcode', 规格: 'spec', 规格带: 'sb',
    零售价: 'price', 进价: 'cost', 毛利率: 'gm', 价格带: 'band', 商品角色: 'role', 面位: 'faces', 首单量: 'qty'
  };
  const cols = Object.keys(MAP).map((k) => ({ k, f: MAP[k], i: idx(k) }));
  let ok = 0;
  const base = DB.itemsCount(id);
  rows.slice(1).forEach((r, n) => {
    const o = {};
    cols.forEach((c) => { if (c.i >= 0) o[c.f] = r[c.i]; });
    let catId = DICT.CAT_IDS[0];
    DICT.CAT_DEF.forEach((d) => { if (d[1] === o.cat || d[0] === o.cat) catId = d[0]; });
    DB.insertItem(id, {
      seq: base + n, cat: catId, brand: o.brand || '未标注品牌', name: o.name || '导入单品',
      barcode: o.barcode || SEED.makeBarcode(DICT.CAT_IDS.indexOf(catId), base + n),
      spec: o.spec || '', sb: o.sb || DICT.SPEC[1],
      price: +o.price || 0, cost: +o.cost || 0,
      role: DICT.ROLE_MAP[o.role] ? o.role : 'main',
      faces: +o.faces || 2, qty: (o.qty === '' || o.qty == null) ? null : +o.qty,
      cat5: SEED.cat5Of(id, catId, base + n), ord: 99000 + base + n
    });
    ok++;
  });
  json(res, { ok: true, imported: ok });
});

route('get', '/api/projects/:id/items/export', async (req, res, { id }, q) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const R = E.compute(p);
  let list = R.item;
  ['d', 'c', 'a', 'm', 'x'].forEach((k) => { if (q[k]) list = list.filter((it) => it.cat5 && it.cat5[k] === q[k]); });
  if (q.role) list = list.filter((it) => it.role === q.role);
  if (q.cat) list = list.filter((it) => it.cat === q.cat);
  if (q.dept) list = list.filter((it) => it.dept === q.dept);
  if (q.k) { const kw = String(q.k).toLowerCase(); list = list.filter((it) => (it.name + ' ' + it.brand).toLowerCase().indexOf(kw) >= 0); }
  const t = SEED.treeOf(id);
  const nm = (c) => (t.map.has(c) ? t.map.get(c).name : '');
  const head = ['部门', '处级', '大类', '中类', '小类', '测算中类', '品牌', '商品名称', '条码', '规格', '规格带',
    '零售价', '进价', '毛利率%', '价格带', '价格倍数', '商品角色', '面位', '预估日销(元)', '预估日销件数', '首单量', '首单额(元)'];
  const rows = [head];
  list.forEach((a) => {
    rows.push([a.dept, nm(a.cat5.c), nm(a.cat5.a), nm(a.cat5.m), nm(a.cat5.x), a.catName,
      a.brand, a.name, a.barcode, a.spec, a.sb, a.price, a.cost, a._gm, DICT.BANDS[a._band], a._pIdx,
      a.roleName, a.faces, a._day, a._unit, a.qty, a._amt]);
  });
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="items.csv"'
  });
  res.end(csv(rows));
});

/* ── 5 级分类 ── */
route('get', '/api/projects/:id/cat5', async (req, res, { id }, q) => {
  const level = +(q.level || 0);
  const nodes = q.parent !== undefined
    ? DB.cat5Nodes(id, level, q.parent)
    : (q.code ? [DB.cat5Node(id, q.code)].filter(Boolean) : DB.cat5Nodes(id, level));
  const cnt = DB.cat5ItemCounts(id);
  const LVMAP = { 1: 'd', 2: 'c', 3: 'a', 4: 'm', 5: 'x' };
  const out = nodes.map((n) => ({
    code: n.code, name: n.name, level: n.level, parent: n.parent,
    items: (cnt[LVMAP[n.level]] || {})[n.code] || 0
  }));
  json(res, out);
});

route('get', '/api/projects/:id/cat5/stat', async (req, res, { id }) => {
  json(res, { ...DB.cat5Stat(id), items: DB.itemsCount(id) });
});

route('post', '/api/projects/:id/cat5', async (req, res, { id }) => {
  const b = await body(req);
  const parent = String(b.parent || '');
  let level, ifEmpty;
  if (!parent) { level = 1; }
  else {
    const pn = DB.cat5Node(id, parent);
    if (!pn) return err(res, '父节点不存在');
    level = pn.level + 1;
  }
  if (level > 5) return err(res, '最多 5 级');
  const sib = DB.cat5Nodes(id, level, parent);
  const maxNo = sib.reduce((a, s) => Math.max(a, +s.code.slice(parent.length) || 0), 0);
  if (maxNo >= 99) return err(res, '同级已满 99 项');
  const len = parent.length === 1 ? 1 : 2;
  const code = parent + String(maxNo + 1).padStart(len, '0');
  DB.run('INSERT INTO cat5(pid,code,name,level,parent,ord) VALUES(?,?,?,?,?,?)',
    id, code, String(b.name || '新节点').slice(0, 40), level, parent, sib.length);
  SEED.treeFlush(id);
  json(res, { ok: true, code });
});

route('patch', '/api/projects/:id/cat5/:code', async (req, res, { id, code }) => {
  const b = await body(req);
  DB.run('UPDATE cat5 SET name=? WHERE pid=? AND code=?', String(b.name || '').slice(0, 40) || '未命名', id, code);
  SEED.treeFlush(id);
  json(res, { ok: true });
});

route('delete', '/api/projects/:id/cat5/:code', async (req, res, { id, code }) => {
  const codes = DB.cat5Descendants(id, code);
  const inList = codes.map(() => '?').join(',');
  const affected = DB.q1('SELECT COUNT(*) c FROM items WHERE pid=? AND x IN (' + inList + ')', id, ...codes).c;
  DB.run('DELETE FROM cat5 WHERE pid=? AND code IN (' + inList + ')', id, ...codes);
  // 清理失效的单品路径
  const t = SEED.treeOf(id);
  const alive = new Set(t.all.map((n) => n.code));
  const bad = DB.q('SELECT id,d,c,a,m,x FROM items WHERE pid=?', id)
    .filter((r) => [r.d, r.c, r.a, r.m, r.x].some((c) => c && !alive.has(c)));
  bad.forEach((r) => {
    const lv = ['d', 'c', 'a', 'm', 'x'];
    const patch = {};
    let hit = false;
    lv.forEach((k, i) => {
      if (r[k] && !alive.has(r[k])) {
        if (!hit) { patch[k] = ''; lv.slice(i + 1).forEach((k2) => { patch[k2] = ''; }); hit = true; }
      }
    });
    if (hit) DB.updateItem(r.id, patch);
  });
  SEED.treeFlush(id);
  json(res, { ok: true, removed: codes.length, affectedItems: affected });
});

route('get', '/api/projects/:id/cat5/export', async (req, res, { id }) => {
  const nodes = DB.q('SELECT * FROM cat5 WHERE pid=? ORDER BY code', id);
  const map = new Map(nodes.map((n) => [n.code, n]));
  const rows = [['层级', '编码', '名称', '父级编码', '父级名称']];
  nodes.forEach((n) => {
    rows.push([['', '部门', '处级', '大类', '中类', '小类'][n.level], n.code, n.name, n.parent, map.get(n.parent) ? map.get(n.parent).name : '']);
  });
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="cat5.csv"' });
  res.end(csv(rows));
});

route('post', '/api/projects/:id/cat5/reset', async (req, res, { id }) => {
  DB.cat5Clone(id);
  SEED.treeFlush(id);
  const t = SEED.treeOf(id);
  const alive = new Set(t.all.map((n) => n.code));
  DB.q('SELECT id,d,c,a,m,x FROM items WHERE pid=?', id).forEach((r) => {
    if ([r.d, r.c, r.a, r.m, r.x].some((c) => c && !alive.has(c))) {
      const lv = ['d', 'c', 'a', 'm', 'x']; const patch = {}; let hit = false;
      lv.forEach((k, i) => {
        if (r[k] && !alive.has(r[k]) && !hit) { patch[k] = ''; lv.slice(i + 1).forEach((k2) => { patch[k2] = ''; }); hit = true; }
      });
      if (hit) DB.updateItem(r.id, patch);
    }
  });
  json(res, { ok: true, stat: DB.cat5Stat(id) });
});

/* ── 陈列道具 ── */
route('get', '/api/projects/:id/fx', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  json(res, { report: E.fxReport(p.fx), state: p.fx });
});

route('patch', '/api/projects/:id/fx', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  if (b.state) {
    for (const k in b.state) p.fx[k] = { ...(p.fx[k] || {}), ...b.state[k] };
  }
  DB.saveProject(p);
  json(res, { ok: true, report: E.fxReport(p.fx) });
});

route('post', '/api/projects/:id/fx/same-spec', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  const zn = DICT.ZONES.find((z) => z.courses.some((c) => c.id === b.course));
  const co = zn && zn.courses.find((c) => c.id === b.course);
  if (!co) return err(res, '课別不存在');
  const first = p.fx[co.items[0].id];
  co.items.forEach((it) => { p.fx[it.id] = { ...p.fx[it.id], L: first.L, W: first.W, H: first.H }; });
  DB.saveProject(p);
  json(res, { ok: true, report: E.fxReport(p.fx) });
});

route('post', '/api/projects/:id/fx/scale', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  E.scaleZone(p.fx, b.zone, Math.max(0, +(b.target || 0)));
  DB.saveProject(p);
  json(res, { ok: true, report: E.fxReport(p.fx) });
});

route('get', '/api/projects/:id/fx/export', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const rp = E.fxReport(p.fx);
  const rows = [['区域', '课別', '道具', '规格组', '长(mm)', '宽(mm)', '高(mm)', '层数', '数量', '节数', '陈列米数', '占地(㎡)', '层板面积(㎡)', '归集']];
  rp.zones.forEach((z) => z.courses.forEach((c) => c.items.forEach((i) => {
    rows.push([z.name, c.name, i.n, i.sp, i.L, i.W, i.H, i.lay, i.qty, i.bays, i.meters, i.sqm, i.board, DICT.BK_NAME[i.bk]]);
  })));
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="fixtures.csv"' });
  res.end(csv(rows));
});

/* ── 趋势 ── */
route('get', '/api/projects/:id/trends', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const R = E.compute(p);
  json(res, {
    cat: R.rows.map((r) => ({
      id: r.c, name: r.name, dept: r.dept, share: r.share, day: r.day, dayBase: r.dayBase,
      trend: r.trend, tier: r.tier
    })),
    brand: R.brands
  });
});

route('patch', '/api/projects/:id/trends', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  if (b.cat) for (const k in b.cat) if (p.cat[k]) p.cat[k].trend = +b.cat[k];
  if (b.brand) for (const k in b.brand) p.bt[k] = +b.brand[k];
  if (b.op === 'resetAllCat') DICT.CAT_IDS.forEach((k) => { p.cat[k].trend = 1; });
  if (b.op === 'resetAllBrand') p.bt = {};
  DB.saveProject(p);
  json(res, { ok: true });
});

route('get', '/api/projects/:id/trends/export', async (req, res, { id }, q) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const R = E.compute(p);
  let rows;
  if (q.type === 'brand') {
    rows = [['品牌', '主要品类', '日销(元)', '全店份额%', '趋势系数', '层级', '关联单品数']];
    R.brands.forEach((b) => rows.push([b.name, b.cat, b.day, b.share, b.trend, DICT.BRAND_TIERS[b.tier].n, b.items]));
  } else {
    rows = [['品类', '部门', '销售占比%', '基准日销(元)', '修正日销(元)', '趋势系数', '层级']];
    R.rows.forEach((r) => rows.push([r.name, r.dept, r.share, r.dayBase, r.day, r.trend, DICT.TIERS[r.tier].n]));
  }
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="' + (q.type === 'brand' ? 'brand' : 'cat') + '-trend.csv"'
  });
  res.end(csv(rows));
});

/* ── 生鲜回填 / 价格带 ── */
route('post', '/api/projects/:id/fresh', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  const R = E.compute(p);
  if (b.mode === 'toSales') p.params.freshSales = R.fresh.modelSales;
  if (b.mode === 'toArea') p.params.freshArea = R.fresh.modelArea;
  DB.saveProject(p);
  json(res, { ok: true, freshArea: p.params.freshArea, freshSales: p.params.freshSales });
});

route('post', '/api/projects/:id/priceband', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const b = await body(req);
  if (b.idx != null && DICT.PB_PRESET[+b.idx]) { p.pb.idx = +b.idx; p.pb.tgt = DICT.PB_PRESET[+b.idx].v.slice(); }
  if (Array.isArray(b.tgt) && b.tgt.length === 6) p.pb.tgt = b.tgt.map((v) => +v || 0);
  if (b.mode === 'norm') {
    const s = p.pb.tgt.reduce((a, v) => a + v, 0) || 1;
    p.pb.tgt = p.pb.tgt.map((v) => Math.round(v * 10000 / s) / 100);
  }
  DB.saveProject(p);
  json(res, { ok: true, pb: p.pb });
});

route('get', '/api/projects/:id/summary/export', async (req, res, { id }) => {
  const p = DB.getProject(id);
  if (!p) return err(res, '项目不存在', 404);
  const R = E.compute(p);
  const rows = [
    ['项目', p.name, '业态', R.fmtName, '日期', p.params.date,
      '地区', [p.params.regionP, p.params.regionC, p.params.regionA, p.params.regionT].filter(Boolean).join(' / ') || '—'], [],
    ['指标', '数值'],
    ['预估客流(人/日)', R.kpi.traffic], ['日销售额(元)', R.kpi.day], ['月销售额(元)', R.kpi.month],
    ['坪效(元/㎡/月)', R.kpi.psm], ['客单价(元)', R.kpi.ticket], ['陈列总节数', R.kpi.bays],
    ['规划 SKU', R.kpi.sku], ['综合毛利率%', R.kpi.gmRate], ['单品样板块', R.kpi.itemCount],
    ['首单金额(元)', R.orderValue], [],
    ['品类', '部门', '销售占比%', '陈列占比%', '偏离pp', '日销(元)', '毛利率%', '节数', 'SKU', '元/节/日', '关联单品']
  ];
  R.rows.forEach((r) => rows.push([r.name, r.dept, r.share, r.bayPct, +(r.share - r.bayPct).toFixed(2), r.day, r.gmRate, r.bays, r.sku, r.dayPerBay, r.counts]));
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="summary.csv"' });
  res.end(csv(rows));
});

/* ────────── 服务器 ────────── */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  let path = u.pathname;
  const method = req.method.toLowerCase();

  try {
    if (path.startsWith('/api/')) {
      if (method === 'options') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' });
        return res.end();
      }
      const m = match(path, method);
      if (!m) return err(res, '未实现的接口: ' + path, 404);
      const qobj = {};
      for (const [k, v] of u.searchParams) qobj[k] = v;
      return await m.r.fn(req, res, m.p, qobj);
    }

    if (path === '/favicon.ico') {
      res.writeHead(204, { 'Content-Type': 'image/x-icon' });
      return res.end();
    }

    // 静态资源
    if (path === '/' || path === '') path = '/index.html';
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const file = join(PUBLIC, safe);
    if (!file.startsWith(PUBLIC)) return err(res, '非法路径', 403);
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('nope');
      const buf = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      return res.end(buf);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + path);
    }
  } catch (e) {
    console.error('ERR', path, e);
    return err(res, e.message || '服务器内部错误', 500);
  }
});

/* ── 首次运行：建默认门店 ── */
(function bootstrap() {
  const cnt = DB.q1('SELECT COUNT(*) c FROM projects').c;
  if (cnt > 0) return;
  const p = newProject('p0', DICT.DEFAULT_PARAMS.proj, 'industrial');
  DB.insertProject(p);
  DB.cat5Clone(p.id);
  SEED.treeFlush(p.id);
  SEED.genItems(p.id, 15).forEach((it) => DB.insertItem(p.id, it));
  console.log('已初始化默认门店:', p.name, p.id);
})();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`新店选品测算系统已启动  http://0.0.0.0:${PORT}   数据文件 ${DB.DB_FILE}`);
});
