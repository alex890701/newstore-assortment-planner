import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, cell, recompute } from './core.js';

boot('category').then(render);

/* 状态 */
const CH = new Map();        // parent code -> children
const EXP = {};              // 展开态
const CUR = { d: '', c: '', a: '', m: '', x: '', role: '', k: '' };
let PAGE = 1, PSIZE = 80;
let ROOT = [], DEPTNAME = {};

const LVK = ['d', 'c', 'a', 'm', 'x'];

async function kids(parent, level) {
  const key = parent + '#' + level;
  if (CH.has(key)) return CH.get(key);
  const r = await api.get(`/api/projects/${S.pid}/cat5?level=${level}&parent=${encodeURIComponent(parent)}`);
  CH.set(key, r);
  return r;
}

async function render() {
  const app = clear($('#app'));
  if (!ROOT.length) {
    ROOT = await api.get(`/api/projects/${S.pid}/cat5?level=1`);
    ROOT.forEach((n) => { DEPTNAME[n.code] = n.name; });
  }
  const R = S.R;
  const cnt = (lv, code) => (R.counts[lv] || {})[code] || 0;

  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, '模块 10 · 品类分析'),
    h('span', { class: 'desc' }, '5 级分类树 + 单品级明细 · 树节点与级联下拉同源，数字为实时关联单品数'),
    h('span', { class: 'sp' }),
    btn('导出当前明细 CSV', '', () => location.href = exportUrl())));

  /* 部门卡 */
  const c0 = card(null, '部门聚合（点击筛选，再次点击取消）');
  const dg = h('div', { class: 'deptcards' });
  const allCnt = R.item.length;
  dg.appendChild(h('div', { class: 'deptcard' + (CUR.d ? '' : ' sel'), onclick: () => { CUR.d = ''; resetDeeper(0); render(); } },
    h('div', { class: 'n' }, '全部'), h('div', { class: 'm' }, allCnt + ' 条单品'),
    h('div', { class: 'bar' }, h('i', { style: 'width:100%;background:#8b95a0' }))));
  ROOT.forEach((n) => {
    const c = DICT.DEPT_COLOR[n.name] || '#8b95a0';
    const v = cnt('d', n.code);
    dg.appendChild(h('div', { class: 'deptcard' + (CUR.d === n.code ? ' sel' : ''), style: 'border-left:3px solid ' + c, onclick: () => { CUR.d = CUR.d === n.code ? '' : n.code; resetDeeper(0); render(); } },
      h('div', { class: 'n' }, n.name),
      h('div', { class: 'm' }, v + ' 条单品 · ' + fmt.p(allCnt ? v / allCnt * 100 : 0)),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + (allCnt ? v / allCnt * 100 : 0) + '%;background:' + c }))));
  });
  c0.bodyEl.appendChild(dg);
  app.appendChild(c0);

  /* 分类树 */
  const c1 = card(null, '5 级分类树（逐级懒加载）',
    btn('折叠全部', 'sm', () => { Object.keys(EXP).forEach((k) => delete EXP[k]); render(); }),
    btn('展开至大类', 'sm', async () => {
      for (const n of ROOT) {
        EXP[n.code] = 1;
        const ch = await kids(n.code, 2);
        for (const c of ch) EXP[c.code] = 1;
      }
      render();
    }));
  const tree = h('div', { class: 'tree' });
  for (const n of ROOT) tree.appendChild(await nodeEl(n, 1));
  c1.bodyEl.appendChild(h('div', { class: 'scroll', style: 'max-height:420px' }, tree));
  app.appendChild(c1);

  /* 明细表 */
  const c2 = card(null, '单品级明细清单',
    h('span', { class: 'small muted', id: 'itSum' }, ''),
    btn('批量生成样板', 'sm', async () => {
      if (!confirm('将清空现有单品并重新生成 15 中类 ×15 条样板，确认？')) return;
      await api.post(`/api/projects/${S.pid}/items/generate`, { per: 15 });
      await boot(); render(); toast('已生成 225 条样板');
    }),
    btn('＋ 新增单品', 'sm pri', async () => {
      const name = prompt('商品名称', '新单品');
      if (!name) return;
      await api.post(`/api/projects/${S.pid}/items`, { name, cat: CUR.cat || DICT.CAT_IDS[0] });
      await boot(); render(); toast('已新增');
    }),
    btn('导入 CSV', 'sm', () => {
      const i = h('input', { type: 'file', accept: '.csv', style: 'display:none' });
      i.onchange = async () => {
        const f = i.files[0]; if (!f) return;
        const txt = await f.text();
        const r = await api.post(`/api/projects/${S.pid}/items/import`, { csv: txt });
        await boot(); render(); toast('已导入 ' + r.imported + ' 条');
      };
      document.body.appendChild(i); i.click(); i.remove();
    }),
    btn('清空', 'sm warn', async () => {
      if (!confirm('清空全部单品？')) return;
      await api.del(`/api/projects/${S.pid}/items`);
      await boot(); render();
    }));

  /* 筛选栏 */
  const fb = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);background:#fcfdfd' });
  const mkSel = async (lv, level) => {
    const sel = h('select', { style: 'width:auto;min-width:130px', onchange: (e) => { CUR[lv] = e.target.value; resetDeeper(LVK.indexOf(lv)); render(); } });
    sel.appendChild(h('option', { value: '' }, '全部' + ['部门', '处级', '大类', '中类', '小类'][level - 1]));
    if (level === 2 && !CUR.d) {
      for (const n of ROOT) { const ch = await kids(n.code, 2); ch.forEach((c) => sel.appendChild(h('option', { value: c.code, selected: CUR.c === c.code ? 'selected' : null }, n.name + ' › ' + c.name))); }
    } else {
      const parent = level === 2 ? CUR.d : CUR[LVK[level - 2]];
      if (parent) {
        const ch = await kids(parent, level);
        ch.forEach((c) => sel.appendChild(h('option', { value: c.code, selected: CUR[lv] === c.code ? 'selected' : null }, c.name + '（' + ((S.R.counts[lv] || {})[c.code] || 0) + '）')));
      }
    }
    return sel;
  };
  ['c', 'a', 'm', 'x'].forEach((lv, i) => fb.appendChild(h('span', { class: 'fl', style: 'margin:0' }, h('label', { style: 'width:auto' }, ['处级', '大类', '中类', '小类'][i]), h('span', { id: 'sel_' + lv }, h('select', {}, h('option', {}, '…'))))));
  const roleSel = h('select', { style: 'width:auto', onchange: (e) => { CUR.role = e.target.value; render(); } },
    h('option', { value: '' }, '全部角色'),
    DICT.ROLES.map((r) => h('option', { value: r.id, selected: CUR.role === r.id ? 'selected' : null }, r.n)));
  const kw = h('input', { type: 'text', value: CUR.k, placeholder: '搜索名称 / 品牌 / 条码', style: 'width:200px' });
  let t;
  kw.oninput = () => { clearTimeout(t); t = setTimeout(() => { CUR.k = kw.value; PAGE = 1; render(); setTimeout(() => { const e = $('#itkw'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 0); }, 340); };
  kw.id = 'itkw';
  fb.appendChild(h('span', { class: 'fl', style: 'margin:0' }, h('label', { style: 'width:auto' }, '角色'), roleSel));
  fb.appendChild(h('span', { class: 'fl', style: 'margin:0' }, h('label', { style: 'width:auto' }, '搜索'), kw));
  fb.appendChild(btn('清除筛选', 'sm', () => { Object.keys(CUR).forEach((k) => { CUR[k] = ''; }); PAGE = 1; render(); }));
  c2.bodyEl.appendChild(fb);

  /* 表体（异步填充） */
  const holder = h('div', { id: 'itholder' }, h('div', { class: 'loading' }, '加载明细…'));
  c2.bodyEl.appendChild(holder);
  app.appendChild(c2);

  fillSelects();
  loadItems(holder);
}

async function fillSelects() {
  for (let i = 0; i < 4; i++) {
    const lv = ['c', 'a', 'm', 'x'][i], level = i + 2;
    const host = $('#sel_' + lv);
    if (!host) continue;
    const sel = h('select', { style: 'width:auto;min-width:130px', onchange: (e) => { CUR[lv] = e.target.value; resetDeeper(LVK.indexOf(lv)); render(); } });
    sel.appendChild(h('option', { value: '' }, '全部' + ['处级', '大类', '中类', '小类'][i]));
    if (level === 2 && !CUR.d) {
      for (const n of ROOT) { const ch = await kids(n.code, 2); ch.forEach((c) => sel.appendChild(h('option', { value: c.code, selected: CUR.c === c.code ? 'selected' : null }, n.name + ' › ' + c.name))); }
    } else {
      const parent = level === 2 ? CUR.d : CUR[LVK[level - 2]];
      if (parent) {
        const ch = await kids(parent, level);
        ch.forEach((c) => sel.appendChild(h('option', { value: c.code, selected: CUR[lv] === c.code ? 'selected' : null }, c.name + '（' + ((S.R.counts[lv] || {})[c.code] || 0) + '）')));
      }
    }
    clear(host).appendChild(sel);
  }
}

function resetDeeper(from) {
  for (let i = from + 1; i < LVK.length; i++) CUR[LVK[i]] = '';
  PAGE = 1;
}

function exportUrl() {
  const q = new URLSearchParams();
  LVK.forEach((k) => { if (CUR[k]) q.set(k, CUR[k]); });
  if (CUR.role) q.set('role', CUR.role);
  if (CUR.k) q.set('k', CUR.k);
  return `/api/projects/${S.pid}/items/export?` + q.toString();
}

async function loadItems(holder) {
  const q = new URLSearchParams({ page: PAGE, size: PSIZE });
  LVK.forEach((k) => { if (CUR[k]) q.set(k, CUR[k]); });
  if (CUR.role) q.set('role', CUR.role);
  if (CUR.k) q.set('k', CUR.k);
  const res = await api.get(`/api/projects/${S.pid}/items?` + q.toString());
  const box = clear(holder);
  const sumEl = $('#itSum');
  if (sumEl) sumEl.textContent = `筛选后 ${res.count} 条 · 日销合计 ${fmt.y(res.sum.day)} · 首单额 ${fmt.y(res.sum.amt)} · 首单量 ${fmt.n(res.sum.qty)}`;

  if (!res.count) {
    box.appendChild(h('div', { class: 'empty' }, '没有符合条件的单品。可尝试清除筛选或批量生成样板。'));
    return;
  }

  const tb = h('table', { class: 'tb' });
  tb.appendChild(h('thead', {}, h('tr', {},
    h('th', {}, '5级分类'), h('th', {}, '中类'), h('th', {}, '品牌'), h('th', {}, '商品名称'), h('th', {}, '条码'),
    h('th', {}, '规格'), h('th', {}, '规格带'), h('th', { class: 'num' }, '零售价'), h('th', { class: 'num' }, '进价'),
    h('th', { class: 'num' }, '毛利率'), h('th', {}, '价格带'), h('th', {}, '商品角色'), h('th', { class: 'num' }, '面位'),
    h('th', { class: 'num' }, '预估日销'), h('th', { class: 'num' }, '首单量'), h('th', { class: 'num' }, '首单额'), h('th', {}, ''))));
  const tbody = h('tbody', {});
  const NAME = new Map();
  for (const r of res.rows) {
    const xName = await nameOf(r.cat5.x, 5);
    const mName = await nameOf(r.cat5.m, 4);
    const tr = h('tr', {});
    tr.appendChild(h('td', { title: [r.dept, ...(await Promise.all([nameOf(r.cat5.c, 2), nameOf(r.cat5.a, 3), mName, xName]))].filter(Boolean).join(' › ') },
      h('span', { class: 'small' }, xName || '—')));
    tr.appendChild(h('td', {}, h('span', { class: 'tag b' }, r.catName)));
    tr.appendChild(cell(r.brand, null, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { brand: v }); await boot(); render(); }));
    tr.appendChild(cell(r.name, null, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { name: v }); await boot(); render(); }));
    tr.appendChild(cell(r.barcode, null, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { barcode: v }); await boot(); render(); }));
    tr.appendChild(cell(r.spec, null, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { spec: v }); await boot(); render(); }));
    tr.appendChild(h('td', {}, sel(DICT.SPEC, r.sb, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { sb: v }); await boot(); render(); })));
    tr.appendChild(cell(r.price, fmt.n(r.price, 2), async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { price: v }); await boot(); render(); }, 'number'));
    tr.appendChild(cell(r.cost, fmt.n(r.cost, 2), async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { cost: v }); await boot(); render(); }, 'number'));
    tr.appendChild(h('td', { class: 'num' }, fmt.p(r._gm)));
    tr.appendChild(h('td', {}, h('span', { class: 'tag', style: 'background:' + DICT.BAND_C[r._band] + '33;color:#1b2430' }, DICT.BANDS[r._band] + ' ' + fmt.x(r._pIdx))));
    tr.appendChild(h('td', {}, sel(DICT.ROLES.map((x) => ({ v: x.id, n: x.n })), r.role, async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { role: v }); await boot(); render(); })));
    tr.appendChild(cell(r.faces, fmt.n(r.faces), async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { faces: v }); await boot(); render(); }, 'number'));
    tr.appendChild(h('td', { class: 'num mono' }, fmt.y(r._day)));
    tr.appendChild(cell(r.qty, fmt.n(r.qty), async (v) => { await api.patch(`/api/projects/${S.pid}/items/${r.id}`, { qty: v }); await boot(); render(); }, 'number'));
    tr.appendChild(h('td', { class: 'num mono' }, fmt.y(r._amt)));
    tr.appendChild(h('td', {}, btn('×', 'sm warn', async (e) => {
      e.stopPropagation();
      if (!confirm('删除该单品？')) return;
      await api.del(`/api/projects/${S.pid}/items/${r.id}`);
      await boot(); render();
    })));
    tbody.appendChild(tr);
  }
  tb.appendChild(tbody);
  box.appendChild(h('div', { class: 'scroll-x scroll' }, tb));

  /* 分页 */
  const pg = h('div', { class: 'pager' },
    btn('首页', 'sm', () => { PAGE = 1; render(); }),
    btn('上一页', 'sm', () => { PAGE = Math.max(1, PAGE - 1); render(); }),
    h('span', {}, `第 ${res.page} / ${res.total} 页`),
    btn('下一页', 'sm', () => { PAGE = Math.min(res.total, PAGE + 1); render(); }),
    btn('末页', 'sm', () => { PAGE = res.total; render(); }));
  box.appendChild(pg);
}

function sel(list, cur, fn) {
  const s = h('select', { style: 'width:auto;min-width:88px', onchange: (e) => fn(e.target.value) });
  list.forEach((o) => {
    const v = typeof o === 'string' ? o : o.v, n = typeof o === 'string' ? o : o.n;
    s.appendChild(h('option', { value: v, selected: cur === v ? 'selected' : null }, n));
  });
  return s;
}

async function nameOf(code, level) {
  if (!code) return '';
  const key = '#' + code;
  if (CH.has(key)) return (CH.get(key) || {}).name || '';
  const r = await api.get(`/api/projects/${S.pid}/cat5?code=${encodeURIComponent(code)}`);
  if (r && r[0]) { CH.set(key, r[0]); return r[0].name; }
  return '';
}

async function nodeEl(n, level) {
  const box = h('div', {});
  const open = !!EXP[n.code];
  const cnt = (S.R.counts[LVK[level - 1]] || {})[n.code] || 0;
  const row = h('div', { class: 'tnode' + (CUR[LVK[level - 1]] === n.code ? ' sel' : '') });
  const caret = h('span', { class: 'tw caret', onclick: async (e) => {
    e.stopPropagation();
    if (!open && level < 5) { await kids(n.code, level + 1); EXP[n.code] = 1; } else delete EXP[n.code];
    render();
  } }, level < 5 ? (open ? '▾' : '▸') : '·');
  row.appendChild(caret);
  row.appendChild(h('span', { class: 'lv lv' + level }, ['部', '处', '大', '中', '小'][level - 1]));
  row.appendChild(h('span', { class: 'tname', onclick: () => { pick(level, n.code); } }, n.name));
  row.appendChild(h('span', { class: 'tcnt' }, cnt ? cnt + ' 单品' : ''));
  if (level < 5) row.appendChild(h('span', { class: 'tcnt' }, '· ' + (n.code.length ? '' : '')));
  box.appendChild(row);

  if (open && level < 5) {
    const ch = await kids(n.code, level + 1);
    if (level + 1 === 5) {
      const chips = h('div', { class: 'chips' });
      ch.forEach((c) => chips.appendChild(h('span', {
        class: 'chip' + (CUR.x === c.code ? ' sel' : ''),
        onclick: () => { pick(5, c.code); }
      }, c.name, ' ', h('b', {}, ((S.R.counts.x || {})[c.code] || 0) || ''))));
      box.appendChild(chips);
    } else {
      const wrap = h('div', { style: 'padding-left:16px' });
      for (const c of ch) wrap.appendChild(await nodeEl(c, level + 1));
      box.appendChild(wrap);
    }
  }
  return box;
}

function pick(level, code) {
  const lv = LVK[level - 1];
  CUR[lv] = CUR[lv] === code ? '' : code;
  // 同步上级
  if (level >= 2) CUR.d = code[0];
  if (level >= 3) CUR.c = code.slice(0, 2);
  if (level >= 4) CUR.a = code.slice(0, 4);
  if (level >= 5) CUR.m = code.slice(0, 6);
  resetDeeper(level - 1);
  render();
}
