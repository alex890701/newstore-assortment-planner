import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute } from './core.js';
import * as C from './charts.js';

boot('trend-brand').then(render);
const OPEN = { 0: true, 1: true, 2: true, 3: true };
let KW = '';

function render() {
  const R = S.R, app = clear($('#app'));
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, 'STEP 05 · 项目所在商圈品牌销售趋势'),
    h('span', { class: 'desc' }, '由单品层聚合品牌 → 按全店日销份额分 4 层。同品牌跨品类共享系数（连锁品牌统一策略），不做归一化'),
    h('span', { class: 'sp' }),
    btn('全部复位 ×1.00', '', async () => { await api.patch('/api/projects/' + S.pid + '/trends', { op: 'resetAllBrand' }); await recompute(); render(); toast('全部复位'); }),
    btn('导出品牌趋势 CSV', '', () => { location.href = '/api/projects/' + S.pid + '/trends/export?type=brand'; })));

  /* 集中度 */
  const c0 = card(null, '品牌集中度');
  const g = h('div', { class: 'grid g2' });
  const st = h('div', {});
  [['CR3 前三品牌份额', fmt.p(R.conc.cr3)], ['CR10 前十品牌份额', fmt.p(R.conc.cr10)],
  ['品牌总数', fmt.n(R.brands.length) + ' 个'], ['已调系数品牌', fmt.n(Object.keys(S.proj.bt).length) + ' 个']]
    .forEach(([l, v]) => st.appendChild(h('div', { class: 'stat' }, h('div', { class: 'n' }, v), h('div', { class: 'l' }, l))));
  g.appendChild(h('div', { class: 'statgrid', style: 'grid-template-columns:1fr 1fr' }, st));
  g.appendChild(h('div', {}, C.hbar(R.brands.slice(0, 10).map((b) => ({ name: b.name, value: b.share, unit: '%', color: '#3a6cb0' })), { w: 520, rowH: 20 })));
  c0.bodyEl.appendChild(g);
  app.appendChild(c0);

  /* 搜索 */
  const c1 = card(null, '品牌趋势调节');
  const si = h('input', { type: 'text', value: KW, placeholder: '搜索品牌 / 主品类' });
  let t;
  si.oninput = () => { clearTimeout(t); t = setTimeout(() => { KW = si.value.trim(); render(); setTimeout(() => { const e = $('#bsearch'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 0); }, 350); };
  si.id = 'bsearch';
  c1.bodyEl.appendChild(h('div', { class: 'fl' }, h('label', {}, '搜索'), si,
    h('span', { class: 'small muted' }, '共 ' + R.brands.length + ' 个品牌')));
  app.appendChild(c1);

  const kws = KW.toLowerCase();
  const list = kws ? R.brands.filter((b) => (b.name + ' ' + b.cat).toLowerCase().includes(kws)) : R.brands;

  [0, 1, 2, 3].forEach((ti) => {
    const T = DICT.BRAND_TIERS[ti];
    const grp = list.filter((b) => b.tier === ti);
    if (!grp.length) return;
    const box = h('div', { class: 'tierbox' });
    box.appendChild(h('div', { class: 'th', style: 'background:' + T.c + '14', onclick: () => { OPEN[ti] = !OPEN[ti]; render(); } },
      h('span', { class: 'tw caret' }, OPEN[ti] ? '▾' : '▸'),
      h('span', { class: 'tag', style: 'background:' + T.c + ';color:#fff' }, T.k),
      h('b', {}, T.n),
      h('span', { class: 'small muted' }, T.d + ' · 范围 ' + T.min + '–' + T.max + ' · 步进 ' + T.step + ' · ' + grp.length + ' 个品牌'),
      h('span', { class: 'sp' })));
    if (OPEN[ti]) {
      const body = h('div', { class: 'tb2' });
      body.appendChild(h('div', { class: 'btnrow', style: 'margin-bottom:8px' },
        btn('整组 +1 档', 'sm', () => shift(grp, T, 1)),
        btn('整组 −1 档', 'sm', () => shift(grp, T, -1)),
        btn('本组复位', 'sm', async () => {
          const b = {}; grp.forEach((x) => { b[x.name] = 1; });
          await api.patch('/api/projects/' + S.pid + '/trends', { brand: b });
          await recompute(); render(); toast(T.n + ' 已复位');
        })));
      grp.forEach((b) => body.appendChild(slider(b, T)));
      box.appendChild(body);
    }
    app.appendChild(box);
  });

  if (!list.length) app.appendChild(h('div', { class: 'empty' }, '没有匹配的品牌'));
}

async function shift(grp, T, dir) {
  const b = {};
  grp.forEach((x) => { b[x.name] = Math.min(T.max, Math.max(T.min, +(x.trend + dir * T.step).toFixed(2))); });
  await api.patch('/api/projects/' + S.pid + '/trends', { brand: b });
  await recompute(); render();
  toast(T.n + (dir > 0 ? ' +1 档' : ' −1 档'));
}

function slider(b, T) {
  const row = h('div', { class: 'sl' });
  row.appendChild(h('div', { class: 'nm' }, b.name, ' ',
    h('span', { class: 'small muted' }, fmt.p(b.share) + ' · ' + b.cat + ' · ' + b.items + ' SKU')));
  const inp = h('input', {
    type: 'range', min: T.min, max: T.max, step: T.step, value: b.trend,
    oninput: (e) => { lab.textContent = fmt.x(Number(e.target.value)); },
    onchange: async (e) => {
      await api.patch('/api/projects/' + S.pid + '/trends', { brand: { [b.name]: Number(e.target.value) } });
      await recompute(); render();
    }
  });
  row.appendChild(inp);
  const lab = h('div', { class: 'vv', style: 'color:' + (b.trend > 1 ? '#c8483f' : b.trend < 1 ? '#1f7a5c' : '#1b2430') }, fmt.x(b.trend));
  row.appendChild(lab);
  return row;
}
