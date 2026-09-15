import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute } from './core.js';

boot('trend-cat').then(render);
const OPEN = { 0: true, 1: true, 2: true, 3: true };

function render() {
  const R = S.R, app = clear($('#app'));
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, 'STEP 04 · 项目所在商圈品类销售趋势'),
    h('span', { class: 'desc' }, '趋势系数按销售占比分 4 层，层级越高的品类调整精度越高。不做归一化 —— 系数是对商圈实际表现的修正'),
    h('span', { class: 'sp' }),
    btn('全部复位 ×1.00', '', async () => { await api.patch('/api/projects/' + S.pid + '/trends', { op: 'resetAllCat' }); await recompute(); render(); toast('全部复位'); }),
    btn('导出品类趋势 CSV', '', () => { location.href = '/api/projects/' + S.pid + '/trends/export?type=cat'; })));

  /* 汇总 */
  const c0 = card(null, '趋势影响汇总');
  const tb0 = h('table', { class: 'tb' });
  const sumBase = R.rows.reduce((a, r) => a + r.dayBase, 0);
  const sumAdj = R.rows.reduce((a, r) => a + r.day, 0);
  tb0.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '指标'), h('th', { class: 'num' }, '数值'), h('th', {}, '说明'))));
  tb0.appendChild(h('tbody', {},
    h('tr', {}, h('td', {}, '基准日销'), h('td', { class: 'num' }, fmt.y(sumBase)), h('td', { class: 'muted' }, '业态占比推演结果')),
    h('tr', {}, h('td', {}, '修正后日销'), h('td', { class: 'num', style: 'font-weight:700' }, fmt.y(sumAdj)), h('td', { class: 'muted' }, '叠加品类趋势系数')),
    h('tr', {}, h('td', {}, '净影响'), h('td', { class: 'num', style: 'color:' + (sumAdj >= sumBase ? '#c8483f' : '#1f7a5c') },
      fmt.sign(sumAdj - sumBase) + ' 元（' + fmt.sign((sumAdj / (sumBase || 1) - 1) * 100, 1) + '%）'),
      h('td', { class: 'muted' }, '趋势不归一化，全店日销会整体浮动'))));
  c0.bodyEl.appendChild(h('div', { class: 'scroll-x' }, tb0));
  app.appendChild(c0);

  /* 4 层 */
  [0, 1, 2, 3].forEach((ti) => {
    const T = DICT.TIERS[ti];
    const list = R.rows.filter((r) => r.tier === ti);
    const box = h('div', { class: 'tierbox' });
    const hd = h('div', { class: 'th', style: 'background:' + T.c + '14', onclick: () => { OPEN[ti] = !OPEN[ti]; render(); } },
      h('span', { class: 'tw caret' }, OPEN[ti] ? '▾' : '▸'),
      h('span', { class: 'tag', style: 'background:' + T.c + ';color:#fff' }, T.k),
      h('b', {}, T.n),
      h('span', { class: 'small muted' }, T.d + ' · 范围 ' + T.min + '–' + T.max + ' · 步进 ' + T.step + ' · ' + list.length + ' 项'),
      h('span', { class: 'sp' }));
    box.appendChild(hd);
    if (OPEN[ti]) {
      const body = h('div', { class: 'tb2' });
      const tb = h('div', { class: 'btnrow', style: 'margin-bottom:8px' });
      tb.appendChild(btn('整组 +1 档', 'sm', () => shift(list, T, 1)));
      tb.appendChild(btn('整组 −1 档', 'sm', () => shift(list, T, -1)));
      tb.appendChild(btn('本组复位', 'sm', async () => {
        const c = {}; list.forEach((r) => { c[r.c] = 1; });
        await api.patch('/api/projects/' + S.pid + '/trends', { cat: c });
        await recompute(); render(); toast(T.n + ' 已复位');
      }));
      body.appendChild(tb);
      if (!list.length) body.appendChild(h('div', { class: 'empty' }, '该层级暂无品类'));
      list.forEach((r) => body.appendChild(slider(r, T)));
      box.appendChild(body);
    }
    app.appendChild(box);
  });
}

async function shift(list, T, dir) {
  const c = {};
  list.forEach((r) => {
    const v = Math.min(T.max, Math.max(T.min, +(r.trend + dir * T.step).toFixed(2)));
    c[r.c] = v;
  });
  await api.patch('/api/projects/' + S.pid + '/trends', { cat: c });
  await recompute(); render();
  toast(DICT ? (T.n + (dir > 0 ? ' +1 档' : ' −1 档')) : '');
}

function slider(r, T) {
  const row = h('div', { class: 'sl' });
  row.appendChild(h('div', { class: 'nm' }, r.name, ' ', h('span', { class: 'small muted' }, fmt.p(r.share) + ' / ' + fmt.y(r.day))));
  const inp = h('input', {
    type: 'range', min: T.min, max: T.max, step: T.step, value: r.trend,
    oninput: (e) => { lab.textContent = fmt.x(Number(e.target.value)); },
    onchange: async (e) => {
      await api.patch('/api/projects/' + S.pid + '/trends', { cat: { [r.c]: Number(e.target.value) } });
      await recompute(); render();
    }
  });
  row.appendChild(inp);
  const lab = h('div', { class: 'vv', style: 'color:' + (r.trend > 1 ? '#c8483f' : r.trend < 1 ? '#1f7a5c' : '#1b2430') }, fmt.x(r.trend));
  row.appendChild(lab);
  return row;
}
