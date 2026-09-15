import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute } from './core.js';
import * as C from './charts.js';

const DEPTC = { 生鲜部: '#2e9e7b', 食品部: '#e0813c', 非食品部: '#3a6cb0', 耗材: '#8b95a0' };

boot('index').then(render);

function render() {
  const R = S.R, P = S.proj.params, app = clear($('#app'));

  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, S.proj.name),
    h('span', { class: 'desc' }, DICT.FMT_NAME[R.fmt] + ' · ' + P.date + ' · 建筑面积 ' + fmt.n(P.area) + '㎡'),
    h('span', { class: 'sp' }),
    h('div', { class: 'steps' },
      h('b', {}, 'STEP 01'), '商圈 → ', h('b', {}, '02'), '业态 → ', h('b', {}, '03'), '道具 → ',
      h('b', {}, '04'), '品类趋势 → ', h('b', {}, '05'), '品牌趋势')
  ));

  /* KPI */
  const kpis = h('div', { class: 'kpis' });
  const K = [
    ['预估客流', fmt.n(R.kpi.traffic) + ' 人/日', '核心+次级渗透×商圈系数', ''],
    ['日销售额', fmt.y(R.kpi.day), '客流×转化率×客单价', 'k-accent'],
    ['月销售额', fmt.yw(R.kpi.month), '按 30 天折算', 'k-info'],
    ['坪效', fmt.n(R.kpi.psm) + ' 元/㎡/月', '实用面积 ' + fmt.n(R.kpi.usedArea) + '㎡', 'k-gold'],
    ['客单价', fmt.y(R.kpi.ticket), '月购物频次 ' + fmt.n(P.freq, 1) + ' 次', ''],
    ['竞争强度', fmt.x(R.kpi.compIdx), P.comp + ' 家竞品 / ' + fmt.n(R.kpi.compArea) + '㎡', 'k-warn']
  ];
  K.forEach(([l, v, s, c]) => kpis.appendChild(h('div', { class: 'kpi ' + c },
    h('div', { class: 'lb' }, l), h('div', { class: 'vl' }, v), h('div', { class: 'sub' }, s))));
  app.appendChild(kpis);

  /* 预警 */
  const ac = card(null, '预警与提示', btn('导出汇总 CSV', '', () => { location.href = '/api/projects/' + S.pid + '/summary/export'; }));
  const ab = h('div', { class: 'alerts' });
  R.alerts.forEach((a) => ab.appendChild(h('div', { class: 'alert ' + a.lv }, a.t)));
  ac.bodyEl.appendChild(ab);
  app.appendChild(ac);

  /* 环形 + 明细 */
  const g = h('div', { class: 'grid g2' });
  const c1 = card('01', '品类销售占比结构');
  c1.bodyEl.appendChild(C.donut(R.rows.map((r) => ({ name: r.name, value: r.share, color: DEPTC[r.dept] })), { center: '销售占比' }));
  g.appendChild(c1);

  const c2 = card('', '品类结构明细（按销售占比降序）');
  const t = h('table', { class: 'tb' });
  t.appendChild(h('thead', {}, h('tr', {},
    h('th', {}, '品类'), h('th', {}, '部门'), h('th', { class: 'num' }, '销售占比'), h('th', { class: 'num' }, '陈列占比'),
    h('th', { class: 'num' }, '日销'), h('th', { class: 'num' }, '毛利率'), h('th', { class: 'num' }, '元/节/日'))));
  const tbody = h('tbody', {});
  R.rows.slice().sort((a, b) => b.share - a.share).forEach((r) => {
    const dv = +(r.share - r.bayPct).toFixed(2);
    tbody.appendChild(h('tr', {},
      h('td', {}, r.name), h('td', {}, h('span', { class: 'tag', style: 'background:' + DEPTC[r.dept] + '22;color:' + DEPTC[r.dept] }, r.dept)),
      h('td', { class: 'num' }, fmt.p(r.share)), h('td', { class: 'num muted' }, fmt.p(r.bayPct)),
      h('td', { class: 'num' }, fmt.y(r.day)),
      h('td', { class: 'num' }, fmt.p(r.gmRate, 0)),
      h('td', { class: 'num', style: 'color:' + (dv > 1 ? '#c8483f' : dv < -1 ? '#1f7a5c' : '#69747f') }, fmt.y(r.dayPerBay))));
  });
  t.appendChild(tbody);
  const sc = h('div', { class: 'scroll' }, t);
  sc.style.maxHeight = '420px';
  c2.bodyEl.appendChild(sc);
  g.appendChild(c2);
  app.appendChild(g);

  /* 双轴 */
  const c3 = card('04', '品类日销与毛利率双轴图');
  c3.bodyEl.appendChild(C.combo(R.rows.slice().sort((a, b) => b.day - a.day)));
  app.appendChild(c3);

  /* 建议 */
  const c4 = card('13', '选品决策建议',
    h('span', { class: 'small muted' }, '共 ' + R.advice.length + ' 条'),
    btn('查看全部 →', '', () => { location.href = '/analysis.html'; }));
  const ad = h('div', { class: 'adv' });
  R.advice.slice(0, 6).forEach((a) => ad.appendChild(h('div', { class: 'item lv-' + a.lv },
    h('div', { class: 'h' }, h('b', {}, a.t), h('span', { class: 'tag ' + (a.lv === 'warn' ? 'w' : a.lv === 'info' ? 'i' : 'b') }, a.tag)),
    h('div', { class: 'b' }, a.b))));
  c4.bodyEl.appendChild(ad);
  app.appendChild(c4);

  /* 快速入口 */
  const c5 = card(null, '下一步');
  const nav = h('div', { class: 'adv' });
  [
    ['商圈测算', '/biz.html', '调整客流、转化率、客单价与竞品参数，重算全盘'],
    ['业态定位', '/format.html', '切换 6 套业态预设，微调 15 个中类销售占比'],
    ['陈列道具', '/fixture.html', '47 项道具的节数/米数/占地换算与缩放'],
    ['品类分析', '/category.html', '5 级分类树 + 单品级明细，边选边改'],
    ['分类管理', '/catmanage.html', '4/22/136/549/3904 分类树的维护']
  ].forEach(([n, u, d]) => nav.appendChild(h('div', { class: 'item lv-info', style: 'cursor:pointer', onclick: () => location.href = u },
    h('div', { class: 'h' }, h('b', {}, n), h('span', { class: 'sp' }), h('span', { class: 'tag i' }, '进入 →')),
    h('div', { class: 'b' }, d))));
  c5.bodyEl.appendChild(nav);
  app.appendChild(c5);
}
