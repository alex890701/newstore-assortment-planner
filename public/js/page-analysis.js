import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute } from './core.js';
import * as C from './charts.js';

boot('analysis').then(render);

function render() {
  const R = S.R, app = clear($('#app'));
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, '模块 12 / 13 · 单品结构分析与选品决策建议'),
    h('span', { class: 'desc' }, '角色结构 · 价格带分布 · 规格带 · 品牌集中度 · 自动生成建议'),
    h('span', { class: 'sp' }),
    btn('导出测算汇总', '', () => { location.href = '/api/projects/' + S.pid + '/summary/export'; })));

  /* 预警 */
  const c0 = card(null, '预警区');
  const ab = h('div', { class: 'alerts' });
  R.alerts.forEach((a) => ab.appendChild(h('div', { class: 'alert ' + a.lv }, a.t)));
  c0.bodyEl.appendChild(ab);
  app.appendChild(c0);

  const g = h('div', { class: 'grid g2' });

  /* 角色结构 */
  const c1 = card('12', '商品角色结构（按日销占比）');
  c1.bodyEl.appendChild(C.hbar(R.role.map((r) => ({ name: r.n, value: r.dayPct, unit: '%', color: r.c })), { w: 560, rowH: 22 }));
  const t1 = h('table', { class: 'tb', style: 'margin-top:10px' });
  t1.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '角色'), h('th', { class: 'num' }, '单品数'), h('th', { class: 'num' }, '权重'),
    h('th', { class: 'num' }, '日销'), h('th', { class: 'num' }, '占比'), h('th', { class: 'num' }, '面位'), h('th', { class: 'num' }, '目标毛利'))));
  t1.appendChild(h('tbody', {}, R.role.map((r) => h('tr', {},
    h('td', {}, h('span', { class: 'tag', style: 'background:' + r.c + '22;color:' + r.c }, r.n)),
    h('td', { class: 'num' }, r.cnt), h('td', { class: 'num' }, r.w),
    h('td', { class: 'num' }, fmt.y(r.day)), h('td', { class: 'num' }, fmt.p(r.dayPct)),
    h('td', { class: 'num' }, r.face),
    h('td', { class: 'num' }, fmt.p(DICT.ROLES.find((x) => x.id === r.id).g, 0))))));
  c1.bodyEl.appendChild(h('div', { class: 'scroll-x' }, t1));
  g.appendChild(c1);

  /* 规格带 */
  const c2 = card('12', '规格带分布');
  c2.bodyEl.appendChild(C.hbar(R.spec.map((s, i) => ({ name: s.n, value: s.cnt, unit: '', color: '#5b8bd8', d: 0 })), { w: 560, rowH: 22 }));
  g.appendChild(c2);
  app.appendChild(g);

  /* 价格带 */
  const c3 = card('12', '价格带分布（目标 vs 实际）',
    h('span', { class: 'small muted' }, '代表倍数 0.46 / 0.72 / 0.92 / 1.14 / 1.52 / 2.30 ×品类中位价'),
    ...DICT.PB_PRESET.map((p, i) => btn(p.n, 'sm' + (S.proj.pb.idx === i ? ' pri' : ''), async () => {
      await api.post('/api/projects/' + S.pid + '/priceband', { idx: i });
      await recompute(); render(); toast('已套用「' + p.n + '」');
    })),
    btn('归一化', 'sm', async () => {
      await api.post('/api/projects/' + S.pid + '/priceband', { mode: 'norm' });
      await recompute(); render();
    }));
  c3.bodyEl.appendChild(C.gbar(R.band.map((b, i) => ({
    name: b.n, sub: b.rg, v: [b.pct, R.priceband.tgt[i]], lb: ['实际', '目标'], c: [b.c, '#c9d3da']
  })), { h: 250 }));
  const t3 = h('table', { class: 'tb', style: 'margin-top:8px' });
  t3.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '价格带'), h('th', {}, '区间'), h('th', { class: 'num' }, '单品数'),
    h('th', { class: 'num' }, '实际%'), h('th', { class: 'num' }, '目标%'), h('th', { class: 'num' }, '偏差'), h('th', { class: 'num' }, '日销'))));
  t3.appendChild(h('tbody', {}, R.band.map((b, i) => {
    const d = R.priceband.diff[i];
    const inp = h('input', { type: 'number', class: 'tiny', value: S.proj.pb.tgt[i], step: 1, min: 0 });
    let t;
    inp.oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const tgt = S.proj.pb.tgt.slice(); tgt[i] = Number(inp.value) || 0;
        await api.post('/api/projects/' + S.pid + '/priceband', { tgt });
        await recompute(); render();
      }, 420);
    };
    return h('tr', {},
      h('td', {}, h('span', { class: 'tag', style: 'background:' + b.c + '44' }, b.n)),
      h('td', { class: 'small muted' }, b.rg),
      h('td', { class: 'num' }, b.cnt), h('td', { class: 'num' }, fmt.p(b.pct)),
      h('td', { class: 'num' }, inp),
      h('td', { class: 'num', style: 'color:' + (d > 2 ? '#c8483f' : d < -2 ? '#1f7a5c' : '#69747f') }, fmt.sign(d) + 'pp'),
      h('td', { class: 'num' }, fmt.y(b.day)));
  })));
  c3.bodyEl.appendChild(h('div', { class: 'scroll-x' }, t3));
  app.appendChild(c3);

  /* 品牌集中度 */
  const c4 = card('12', '品牌集中度 TOP 12');
  c4.bodyEl.appendChild(C.hbar(R.brandConc.map((b) => ({ name: b.name, value: b.share, unit: '%', color: '#3a6cb0' })), { w: 700, rowH: 20 }));
  c4.bodyEl.appendChild(h('div', { class: 'legend' },
    h('span', {}, 'CR3 ' + fmt.p(R.conc.cr3)), h('span', {}, 'CR10 ' + fmt.p(R.conc.cr10)),
    h('span', {}, '品牌总数 ' + R.brands.length)));
  app.appendChild(c4);

  /* 建议 */
  const c5 = card('13', '选品决策建议', h('span', { class: 'small muted' }, '共 ' + R.advice.length + ' 条'));
  const ad = h('div', { class: 'adv' });
  R.advice.forEach((a, i) => ad.appendChild(h('div', { class: 'item lv-' + a.lv },
    h('div', { class: 'h' }, h('span', { class: 'no' }, i + 1), h('b', {}, a.t),
      h('span', { class: 'tag ' + (a.lv === 'warn' ? 'w' : a.lv === 'info' ? 'i' : 'b') }, a.tag)),
    h('div', { class: 'b' }, a.b))));
  c5.bodyEl.appendChild(ad);
  app.appendChild(c5);

  /* 首单 */
  const c6 = card(null, '首单配货概览');
  const sg = h('div', { class: 'statgrid' });
  [['样板块数', fmt.n(R.item.length) + ' 条'], ['首单总量', fmt.n(R.orderQty) + ' 件'],
  ['首单占用资金', fmt.y(R.orderValue)], ['预估日销合计', fmt.y(R.item.reduce((a, b) => a + b._day, 0))],
  ['规划 SKU', fmt.n(R.kpi.sku)], ['陈列节数', fmt.n(R.kpi.bays, 1) + ' 节']]
    .forEach(([l, v]) => sg.appendChild(h('div', { class: 'stat' }, h('div', { class: 'n' }, v), h('div', { class: 'l' }, l))));
  c6.bodyEl.appendChild(sg);
  app.appendChild(c6);
}
