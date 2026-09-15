import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast } from './core.js';

boot('fixture').then(render);

const OPEN = { op: true, fr: true, cs: true };
const FORCE = {};      // 强制 input 态（避免状态机死循环，PRD §7.1）
let RP = null;

const specStr = (m) => `${m.L}×${m.W}×${m.H}`;

function render() {
  const app = clear($('#app'));
  RP = S.R.fx;
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, 'STEP 03 · 陈列道具配置'),
    h('span', { class: 'desc' }, '47 项道具 / 12 课 · 节数 = 数量×长÷1200　陈列米数 = 数量×长÷1000　占地 = 节数×单节占地×(宽÷基准宽)'),
    h('span', { class: 'sp' }),
    btn('导出道具 CSV', '', () => { location.href = '/api/projects/' + S.pid + '/fx/export'; }),
    btn('恢复默认数量', 'warn', async () => {
      const st = {};
      DICT.ZONES.forEach((z) => z.courses.forEach((c) => c.items.forEach((i) => { st[i.id] = { qty: i.dq, lay: i.lay }; })));
      await api.patch('/api/projects/' + S.pid, { fx: st });
      await boot(); render(); toast('已恢复默认数量与层数');
    })));

  /* KPI */
  const T = RP.total;
  const kpis = h('div', { class: 'kpis' });
  [['陈列总节数', fmt.n(T.bays, 1) + ' 节', '标准节宽 1200mm', ''],
  ['陈列米数', fmt.n(T.meters, 1) + ' m', '按长度累计', 'k-info'],
  ['陈列占地', fmt.n(T.sqm, 1) + ' ㎡', '含操作间距与宽度系数', 'k-accent'],
  ['层板/台面面积', fmt.n(T.board, 1) + ' ㎡', '数量×层数×长×宽', 'k-gold'],
  ['道具总件数', fmt.n(T.pieces) + ' 件', '含全部区域', ''],
  ['总层数', fmt.n(T.layers) + ' 层', '层数×数量', 'k-warn']
  ].forEach(([l, v, s, c]) => kpis.appendChild(h('div', { class: 'kpi ' + c },
    h('div', { class: 'lb' }, l), h('div', { class: 'vl' }, v), h('div', { class: 'sub' }, s))));
  app.appendChild(kpis);

  /* 归集 */
  const bk = RP.byBk, bkT = Object.values(bk).reduce((a, b) => a + b, 0) || 1;
  const c0 = card(null, '节数归集结构');
  const bg = h('div', { class: 'deptcards' });
  [['main', '#1f7a5c'], ['end', '#e0813c'], ['fresh', '#2e9e7b'], ['cold', '#3a6cb0']].forEach(([k, c]) => {
    bg.appendChild(h('div', { class: 'deptcard', style: 'cursor:default' },
      h('div', { class: 'n' }, DICT.BK_NAME[k]),
      h('div', { class: 'm' }, fmt.n(bk[k] || 0, 1) + ' 节 · ' + fmt.p((bk[k] || 0) / bkT * 100, 1)),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + ((bk[k] || 0) / bkT * 100) + '%;background:' + c }))));
  });
  c0.bodyEl.appendChild(bg);
  app.appendChild(c0);

  /* 明细 */
  const c1 = card('09', '陈列道具配置清单（区域 → 处 → 课 → 道具）');
  RP.zones.forEach((z) => c1.bodyEl.appendChild(zoneBlock(z)));
  app.appendChild(c1);
}

function zoneBlock(z) {
  const box = h('div', { style: 'border:1px solid var(--line);border-radius:9px;margin-bottom:10px;overflow:hidden' });
  const hd = h('div', {
    style: 'display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f7f9fa;cursor:pointer',
    onclick: () => { OPEN[z.id] = !OPEN[z.id]; render(); }
  },
    h('span', { class: 'tw caret' }, OPEN[z.id] ? '▾' : '▸'),
    h('b', {}, z.name),
    h('span', { class: 'tag i' }, z.chu),
    h('span', { class: 'small muted' }, z.n + ' 项'),
    h('span', { class: 'sp' }),
    h('span', { class: 'small muted' }, fmt.n(z.bays, 1) + ' 节 · ' + fmt.n(z.sqm, 1) + '㎡ · ' + fmt.n(z.meters, 1) + 'm')
  );
  box.appendChild(hd);
  if (!OPEN[z.id]) return box;

  const tg = h('input', { type: 'number', class: 'tiny', value: Math.round(z.bays), min: 0, step: 10 });
  const tools = h('div', { style: 'padding:8px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)' },
    h('span', { class: 'small muted' }, '缩放到'),
    tg, h('span', { class: 'small muted' }, '节'),
    btn('执行', 'pri', async () => {
      const r = await api.post('/api/projects/' + S.pid + '/fx/scale', { zone: z.id, target: Number(tg.value) || 0 });
      RP = r.report;
      await boot(); render();
      toast(z.name + ' 已缩放到 ' + fmt.n(RP.zones.find((x) => x.id === z.id).bays, 1) + ' 节');
    }),
    h('span', { class: 'small muted' }, '（按节数贪心 ±1 逼近，不是按数量）'));
  box.appendChild(tools);

  z.courses.forEach((co) => box.appendChild(courseBlock(co)));
  return box;
}

function courseBlock(co) {
  const box = h('div', {});
  box.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;padding:6px 12px;background:#fcfdfd;border-bottom:1px solid #f0f3f5' },
    h('b', { style: 'font-size:13px' }, co.name),
    h('span', { class: 'small muted' }, co.n + ' 项 · ' + fmt.n(co.bays, 1) + ' 节 · ' + fmt.n(co.sqm, 1) + '㎡'),
    h('span', { class: 'sp' }),
    btn('同规格', 'sm', async () => {
      const r = await api.post('/api/projects/' + S.pid + '/fx/same-spec', { course: co.id });
      RP = r.report; await boot(); render(); toast(co.name + ' 已统一为首个道具规格');
    })));
  const tb = h('table', { class: 'tb' });
  tb.appendChild(h('thead', {}, h('tr', {},
    h('th', {}, '道具'), h('th', { style: 'width:190px' }, '规格 长×宽×高(mm)'), h('th', { class: 'num', style: 'width:74px' }, '层数'),
    h('th', { class: 'num', style: 'width:74px' }, '数量'), h('th', { class: 'num' }, '节数'), h('th', { class: 'num' }, '陈列米数'),
    h('th', { class: 'num' }, '占地㎡'), h('th', { class: 'num' }, '层板㎡'), h('th', {}, '归集'))));
  const tbody = h('tbody', {});
  co.items.forEach((it) => tbody.appendChild(itemRow(it)));
  tb.appendChild(tbody);
  box.appendChild(h('div', { class: 'scroll-x' }, tb));
  return box;
}

function itemRow(it) {
  const st = S.proj.fx[it.id] || {};
  const set = async (patch) => {
    await api.patch('/api/projects/' + S.pid, { fx: { [it.id]: patch } });
    await boot(); render();
  };
  const tr = h('tr', {});
  tr.appendChild(h('td', {}, h('span', {}, it.n), ' ', h('span', { class: 'small muted' }, it.sp)));

  /* 规格控件 */
  const presets = DICT.FX_SPEC3[it.sp] || [];
  const cur = specStr({ L: it.L, W: it.W, H: it.H });
  const inP = presets.some((p) => p[0] === it.L && p[1] === it.W && p[2] === it.H);
  const cell = h('td', {});
  if (inP && !FORCE[it.id]) {
    const sel = h('select', { class: 'specsel', onchange: (e) => {
      if (e.target.value === '__custom') { FORCE[it.id] = 1; render(); setTimeout(() => { const i = document.getElementById('spc_' + cssId(it.id)); if (i) { i.focus(); i.select(); } }, 0); }
      else { const [L, W, H] = e.target.value.split('×').map(Number); set({ L, W, H }); }
    } },
      ...presets.map((p) => h('option', { value: p.join('×'), selected: cur === p.join('×') ? 'selected' : null }, p.join('×'))),
      h('option', { value: '__custom' }, '自定义…'));
    cell.appendChild(sel);
  } else {
    const inp = h('input', { id: 'spc_' + cssId(it.id), type: 'text', value: cur, placeholder: '1200×600×2000' });
    inp.onchange = () => {
      const m = String(inp.value).match(/\d+(?:\.\d+)?/g) || [];
      set({ L: +m[0] || 1200, W: +m[1] || 600, H: +m[2] || 2000 });
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
    cell.appendChild(h('div', { style: 'display:flex;gap:4px' }, inp,
      btn('↺', 'sm', () => { delete FORCE[it.id]; render(); })));
  }
  tr.appendChild(cell);

  tr.appendChild(h('td', { class: 'num' }, it.lay > 0 || it.sp === 'shelf' || it.sp === 'upright'
    ? numCell(it.lay, (v) => set({ lay: v }), 0, 12) : h('span', { class: 'muted' }, '—')));
  tr.appendChild(h('td', { class: 'num' }, numCell(it.qty, (v) => set({ qty: v }), 0, 9999)));
  tr.appendChild(h('td', { class: 'num mono' }, fmt.n(it.bays, 2)));
  tr.appendChild(h('td', { class: 'num mono' }, fmt.n(it.meters, 2)));
  tr.appendChild(h('td', { class: 'num mono' }, fmt.n(it.sqm, 2)));
  tr.appendChild(h('td', { class: 'num mono' }, it.board ? fmt.n(it.board, 2) : h('span', { class: 'muted' }, '—')));
  tr.appendChild(h('td', {}, h('span', { class: 'tag' }, DICT.BK_NAME[it.bk])));
  return tr;
}

function cssId(s) { return String(s).replace(/[^a-zA-Z0-9]/g, '_'); }

function numCell(v, fn, min, max) {
  const i = h('input', { type: 'number', class: 'tiny', value: v, min: min, max: max, step: 1 });
  let t;
  i.oninput = () => { clearTimeout(t); t = setTimeout(() => fn(Number(i.value) || 0), 380); };
  return i;
}
