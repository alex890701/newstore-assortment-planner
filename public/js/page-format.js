import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute } from './core.js';
import * as C from './charts.js';

const DEPTC = { 生鲜部: '#2e9e7b', 食品部: '#e0813c', 非食品部: '#3a6cb0', 耗材: '#8b95a0' };
boot('format').then(render);

function render() {
  const R = S.R, app = clear($('#app'));
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, 'STEP 02 · 业态定位与品类规划'),
    h('span', { class: 'desc' }, '6 套业态预设决定 15 个中类销售占比；陈列节数占比独立设定，两者偏离即为结构问题'),
    h('span', { class: 'sp' }),
    btn('归一化占比', '', async () => {
      await api.patch('/api/projects/' + S.pid, { cat: {}, normalize: 1 });
      await recompute(); render(); toast('已归一化到 100%');
    })));

  /* 业态预设 */
  const c0 = card(null, '业态选择');
  const presets = h('div', { class: 'deptcards' });
  Object.keys(DICT.PRESET).forEach((k) => {
    const on = S.proj.fmt === k;
    presets.appendChild(h('div', { class: 'deptcard' + (on ? ' sel' : ''), onclick: async () => {
      await api.patch('/api/projects/' + S.pid, { fmt: k });
      await recompute(); window.Shell.sync(); render(); toast('已切换到' + DICT.FMT_NAME[k]);
    } },
      h('div', { class: 'n' }, DICT.FMT_NAME[k]),
      h('div', { class: 'm' }, '生鲜 ' + DICT.FRESH_DEF[k].s + '% / 面积 ' + DICT.FRESH_DEF[k].a + '%'),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + DICT.FRESH_DEF[k].s * 2 + '%;background:#2e9e7b' })),
      h('div', { class: 'm small' }, DICT.PRESET[k].slice(0, 5).join(' / ') + ' …')
    ));
  });
  c0.bodyEl.appendChild(presets);
  app.appendChild(c0);

  /* 占比微调表 */
  const c1 = card('01', '品类销售占比结构（可微调）',
    h('span', { class: 'small muted' }, '合计 ' + fmt.p(R.rows.reduce((a, r) => a + r.share, 0), 1)),
    btn('重置为业态预设', '', async () => {
      await api.patch('/api/projects/' + S.pid, { fmt: S.proj.fmt });
      await recompute(); render();
    }));
  const tb = h('table', { class: 'tb' });
  tb.appendChild(h('thead', {}, h('tr', {},
    h('th', {}, '中类'), h('th', {}, '部门'), h('th', { class: 'num' }, '预设'), h('th', { class: 'num' }, '当前销售占比'),
    h('th', { class: 'num' }, '陈列占比'), h('th', { class: 'num' }, '偏离'), h('th', { class: 'num' }, '日销(元)'),
    h('th', { class: 'num' }, '规划SKU'), h('th', { class: 'num' }, '元/节/日'))));
  const tbody = h('tbody', {});
  R.rows.forEach((r, i) => {
    const dv = +(r.share - r.bayPct).toFixed(2);
    const inp = h('input', { type: 'number', class: 'tiny', value: r.share, step: 0.1, min: 0, max: 100 });
    let t;
    inp.oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        await api.patch('/api/projects/' + S.pid, { cat: { [r.c]: { share: Number(inp.value) || 0 } } });
        await recompute(); render();
      }, 380);
    };
    tbody.appendChild(h('tr', {},
      h('td', {}, r.name),
      h('td', {}, h('span', { class: 'tag', style: 'background:' + DEPTC[r.dept] + '22;color:' + DEPTC[r.dept] }, r.dept)),
      h('td', { class: 'num muted' }, fmt.p(DICT.PRESET[S.proj.fmt][i], 0)),
      h('td', { class: 'num' }, inp),
      h('td', { class: 'num muted' }, fmt.p(r.bayPct)),
      h('td', { class: 'num', style: 'color:' + (dv > 1 ? '#c8483f' : dv < -1 ? '#1f7a5c' : '#69747f') }, fmt.sign(dv) + 'pp'),
      h('td', { class: 'num' }, fmt.y(r.day)),
      h('td', { class: 'num' }, fmt.n(r.sku)),
      h('td', { class: 'num' }, fmt.y(r.dayPerBay))));
  });
  tb.appendChild(tbody);
  c1.bodyEl.appendChild(h('div', { class: 'scroll-x' }, tb));
  app.appendChild(c1);

  const g = h('div', { class: 'grid g2' });

  const c2 = card('03', '销售贡献 vs 陈列资源（蝴蝶图）');
  c2.bodyEl.appendChild(C.butterfly(R.rows.slice().sort((a, b) => b.share - a.share)));
  g.appendChild(c2);

  const c3 = card('02', '陈列匹配度诊断（销售占比 − 陈列占比）');
  const dev = R.rows.slice().sort((a, b) => (b.share - b.bayPct) - (a.share - a.bayPct));
  c3.bodyEl.appendChild(C.hbar(dev.map((r) => ({
    name: r.name, value: +(r.share - r.bayPct).toFixed(2), unit: 'pp',
    color: (r.share - r.bayPct) > 0 ? '#c8483f' : '#1f7a5c'
  })), { w: 560 }));
  const mk = h('div', { class: 'legend' },
    h('span', {}, h('i', { style: 'background:#c8483f' }), '红＝陈列资源不足（销售高于陈列）'),
    h('span', {}, h('i', { style: 'background:#1f7a5c' }), '绿＝陈列资源过剩'));
  c3.bodyEl.appendChild(mk);
  g.appendChild(c3);
  app.appendChild(g);

  const g2 = h('div', { class: 'grid g2' });
  const c4 = card('05', 'SKU 宽度分配 TOP 10');
  c4.bodyEl.appendChild(C.hbar(R.rows.slice().sort((a, b) => b.sku - a.sku).slice(0, 10)
    .map((r) => ({ name: r.name, value: r.sku, unit: '', color: DEPTC[r.dept], d: 0 })), { w: 560 }));
  g2.appendChild(c4);

  const c5 = card('07', '单品 / 单节产出效率对比（元/节/日）');
  c5.bodyEl.appendChild(C.hbar(R.rows.slice().sort((a, b) => b.dayPerBay - a.dayPerBay)
    .map((r) => ({ name: r.name, value: r.dayPerBay, unit: '', color: '#3a6cb0', d: 0 })), { w: 560 }));
  g2.appendChild(c5);
  app.appendChild(g2);

  const c6 = card('06', '品类效率象限矩阵（X=坪效　Y=毛利率　气泡=日销）');
  c6.bodyEl.appendChild(C.quad(R.rows));
  app.appendChild(c6);
}
