import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast, recompute, field, group, numInput, patchAndRerun } from './core.js';
import * as C from './charts.js';

boot('biz').then(render);

const P0 = () => S.proj.params;

function render() {
  const R = S.R, app = clear($('#app'));
  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, 'STEP 01 · 商圈核心数据'),
    h('span', { class: 'desc' }, '客流 = (核心人口×渗透率 + 次级人口×渗透率×0.3) × 商圈系数；日销 = 客流×进店转化率×客单价'),
    h('span', { class: 'sp' }),
    btn('恢复默认', 'warn', async () => {
      await patchAndRerun({ params: { ...DICT.DEFAULT_PARAMS, freshArea: DICT.FRESH_DEF[S.proj.fmt].a, freshSales: DICT.FRESH_DEF[S.proj.fmt].s } });
      render();
    })));

  const grid = h('div', { class: 'grid', style: 'grid-template-columns:400px 1fr;align-items:start' });
  grid.appendChild(left());
  grid.appendChild(right());
  app.appendChild(grid);
}

/* ── 左：参数 ── */
function left() {
  const P = P0();
  const box = h('div', {});

  const set = async (k, v) => {
    await api.patch('/api/projects/' + S.pid, { params: { [k]: v } });
    await recompute();
    render();
  };

  box.appendChild(h('div', { class: 'card' },
    h('div', { class: 'cardhead' }, h('span', { class: 'no' }, 'c1'), h('span', {}, '商圈核心数据')),
    h('div', { class: 'cardbody' },
      group('项目基础', '项目名称、测算日期与所在行政区划',
        field('项目名称', numInputStr(P.proj, (v) => set('proj', v))),
        field('测算日期', h('input', { type: 'date', value: P.date, onchange: (e) => set('date', e.target.value) })),
        field('所在地区', regionCascader(P))),

      group('商圈人口与渗透', '渗透率指核心/次级商圈居民中到店的比例',
        field('核心商圈人口', numInput(P.corePop, (v) => set('corePop', v), { step: 500 }), '人'),
        field('核心渗透率', numInput(P.corePen, (v) => set('corePen', v), { step: 1 }), '%'),
        field('次级商圈人口', numInput(P.secPop, (v) => set('secPop', v), { step: 500 }), '人'),
        field('次级渗透率', numInput(P.secPen, (v) => set('secPen', v), { step: 1 }), '%  折算系数 0.3'),
        field('商圈类型', h('select', { onchange: (e) => set('zone', e.target.value) },
          Object.keys(DICT.ZONE_K).map((k) => h('option', { value: k, selected: P.zone === k ? 'selected' : null },
            DICT.ZONE_NAME[k] + '（×' + DICT.ZONE_K[k] + '）'))))),

      group('客群与消费', '进店转化率 × 客单价决定日销',
        field('进店转化率', numInput(P.conv, (v) => set('conv', v), { step: 1 }), '%'),
        field('客单价', numInput(P.ticket, (v) => set('ticket', v), { step: 0.5 }), '元'),
        field('月购物频次', numInput(P.freq, (v) => set('freq', v), { step: 0.1 }), '次/月')),

      group('竞争环境', '用于计算竞争强度指数',
        field('竞品门店数', numInput(P.comp, (v) => set('comp', v), { step: 1 }), '家'),
        field('竞品平均面积', numInput(P.compArea, (v) => set('compArea', v), { step: 100 }), '㎡')),

      group('物业条件', '实用面积 = 建筑面积 × 实用率',
        field('建筑面积', numInput(P.area, (v) => set('area', v), { step: 100 }), '㎡'),
        field('实用率', numInput(P.util, (v) => set('util', v), { step: 1 }), '%'))
    )));
  return box;
}

function numInputStr(v, fn) {
  const i = h('input', { type: 'text', value: v });
  let t;
  i.oninput = () => { clearTimeout(t); t = setTimeout(() => fn(i.value), 400); };
  return i;
}

/* ── 行政区划级联选择器（省 / 市 / 区/县 / 镇/街道） ──
 * 数据：GET /api/regions?parent=code
 *   - parent 为空 → 省级
 *   - 直辖市/直筒子市（如北京、东莞）只有 3 级 —— 后端 select 自动禁用无子级的下拉
 * 选完任一级，自动清空下游并 PATCH 持久化
 */
const REGION_FETCH = new Map();        // parent → Promise (去重)
function fetchRegions(parent) {
  const key = parent || '';
  if (REGION_FETCH.has(key)) return REGION_FETCH.get(key);
  const p = api.get('/api/regions?parent=' + encodeURIComponent(key));
  REGION_FETCH.set(key, p);
  return p;
}
/** 把 items 渲染到 select；保留「历史值」选项以便回显已下线的名称 */
function paintSel(sel, items, pickedName, placeholder, orphanLabel) {
  sel.innerHTML = '';
  sel.appendChild(h('option', { value: '' }, placeholder));
  items.forEach((it) => sel.appendChild(h('option', { value: it.code, selected: it.name === pickedName ? 'selected' : null }, it.name)));
  if (pickedName && !items.some((it) => it.name === pickedName)) {
    sel.appendChild(h('option', { value: '__orphan__', selected: 'selected' }, pickedName + ' (' + orphanLabel + ')'));
  }
  sel.disabled = items.length === 0 && !pickedName;
}
function regionCascader(P) {
  const row = h('div', { class: 'region-row' });
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px';
  const mk = (ph) => {
    const s = h('select', { disabled: 'disabled' });
    s.appendChild(h('option', { value: '' }, ph));
    return s;
  };
  const selP = mk('加载省份…'), selC = mk('加载城市…'), selA = mk('加载区/县…'), selT = mk('加载镇/街道…');
  const p = P.regionP || '', c = P.regionC || '', a = P.regionA || '', t = P.regionT || '';

  fetchRegions('').then(async (r) => {
    paintSel(selP, r.items, p, '请选择省份', '历史值');
    selP.onchange = async () => {
      const txt = selP.options[selP.selectedIndex].textContent;
      await api.patch('/api/projects/' + S.pid, { params: { regionP: txt, regionC: '', regionA: '', regionT: '' } });
      await recompute(); render();
    };
    if (!p) return;
    const pc = r.items.find((it) => it.name === p);
    if (!pc) return;
    const r2 = await fetchRegions(pc.code);
    paintSel(selC, r2.items, c, '请选择城市', '历史值');
    selC.onchange = async () => {
      const txt = selC.options[selC.selectedIndex].textContent;
      await api.patch('/api/projects/' + S.pid, { params: { regionC: txt, regionA: '', regionT: '' } });
      await recompute(); render();
    };
    if (!c) return;
    const cc = r2.items.find((it) => it.name === c);
    if (!cc) return;
    const r3 = await fetchRegions(cc.code);
    const lvl3Kind = r3.items[0] && r3.items[0].kind;          // '区/县' | '镇/街道'
    const lvl3PH = !r3.items.length ? '无下级' : (lvl3Kind === '镇/街道' ? '请选择镇/街道' : '请选择区/县');
    paintSel(selA, r3.items, a, lvl3PH, '历史值');
    selA.onchange = async () => {
      const txt = selA.options[selA.selectedIndex].textContent;
      await api.patch('/api/projects/' + S.pid, { params: { regionA: txt, regionT: '' } });
      await recompute(); render();
    };
    // 若第 3 级已经是镇/街道级（如直筒子市），第 4 级自然没有 —— 无论 regionA 是否已选都得显示
    if (lvl3Kind === '镇/街道') {
      paintSel(selT, [], t, '无下级（已是镇/街道）', '历史值');
      return;
    }
    if (!a) return;
    const ac = r3.items.find((it) => it.name === a);
    if (!ac) return;
    const r4 = await fetchRegions(ac.code);
    paintSel(selT, r4.items, t, r4.items.length ? '请选择镇/街道' : '无下级', '历史值');
    selT.onchange = async () => {
      const txt = selT.options[selT.selectedIndex].textContent;
      await api.patch('/api/projects/' + S.pid, { params: { regionT: txt } });
      await recompute(); render();
    };
  }).catch((e) => {
    selP.innerHTML = ''; selP.appendChild(h('option', { value: '' }, '加载失败：' + e.message));
  });
  row.appendChild(selP);
  row.appendChild(selC);
  row.appendChild(selA);
  row.appendChild(selT);
  return row;
}

/* ── 右：结果 ── */
function right() {
  const R = S.R, P = P0();
  const box = h('div', {});

  const kpis = h('div', { class: 'kpis', style: 'grid-template-columns:repeat(3,1fr)' });
  [['预估客流', fmt.n(R.kpi.traffic) + ' 人/日', '覆盖率 ' + fmt.p(R.kpi.traffic / Math.max(1, P.corePop + P.secPop) * 100, 1), ''],
  ['日销售额', fmt.y(R.kpi.day), '月 ' + fmt.yw(R.kpi.month), 'k-accent'],
  ['坪效', fmt.n(R.kpi.psm) + ' 元/㎡/月', '实用面积 ' + fmt.n(R.kpi.usedArea) + '㎡', 'k-gold']
  ].forEach(([l, v, s, c]) => kpis.appendChild(h('div', { class: 'kpi ' + c },
    h('div', { class: 'lb' }, l), h('div', { class: 'vl' }, v), h('div', { class: 'sub' }, s))));
  box.appendChild(kpis);

  /* 客流构成 */
  const core = P.corePop * P.corePen / 100;
  const sec = P.secPop * P.secPen / 100 * 0.3;
  const c1 = card(null, '客流构成');
  c1.bodyEl.appendChild(C.stack([
    { n: '核心商圈', v: core, c: '#1f7a5c' },
    { n: '次级商圈×0.3', v: sec, c: '#3a6cb0' },
    { n: '商圈系数', v: core + sec ? (core + sec) * ((DICT.ZONE_K[P.zone] || 1) - 1) : 0, c: '#e0813c' }
  ], { title: '客流构成（人/日）' }));
  box.appendChild(c1);

  /* 敏感性 */
  const c2 = card(null, '日销敏感性分析（转化率 × 客单价）',
    h('span', { class: 'small muted' }, '单位：元/日 · 当前 ' + fmt.y(R.kpi.day)));
  const traffic = R.kpi.traffic;
  const convs = [10, 15, 20, 25, 26, 30, 35, 40];
  const tks = [25, 30, 36.74, 45, 55, 65];
  const tb = h('table', { class: 'tb' });
  tb.appendChild(h('thead', {}, h('tr', {}, h('th', {}, '转化率＼客单价'),
    ...tks.map((t) => h('th', { class: 'num' }, fmt.n(t, t === 36.74 ? 2 : 0))))));
  const tbody = h('tbody', {});
  const maxD = traffic * 0.4 * 65 || 1;
  convs.forEach((cv) => {
    tbody.appendChild(h('tr', {}, h('td', {}, cv + '%'),
      ...tks.map((tk) => {
        const d = traffic * cv / 100 * tk;
        const cur = Math.abs(cv - P.conv) < 0.01 && Math.abs(tk - P.ticket) < 0.01;
        return h('td', {
          class: 'num', style: cur ? 'background:#e8f3ef;font-weight:700' : ('background:rgba(31,122,92,' + (d / maxD * 0.32).toFixed(3) + ')')
        }, fmt.n(d));
      })));
  });
  tb.appendChild(tbody);
  c2.bodyEl.appendChild(h('div', { class: 'scroll-x' }, tb));
  box.appendChild(c2);

  /* 生鲜专项 */
  const f = R.fresh;
  const c3 = card(null, '生鲜专项 · 坪效指数',
    h('span', { class: 'tag', style: 'background:' + f.verdict.c + '22;color:' + f.verdict.c }, f.verdict.k + ' ' + fmt.x(R.fresh.idx)),
    btn('按面积回填销售', '', async () => {
      await api.post('/api/projects/' + S.pid + '/fresh', { mode: 'toSales' });
      await recompute(); render(); toast('已按模型推演值回填生鲜销售占比');
    }),
    btn('按销售回填面积', '', async () => {
      await api.post('/api/projects/' + S.pid + '/fresh', { mode: 'toArea' });
      await recompute(); render(); toast('已按模型推演值回填生鲜面积占比');
    }));
  const body = h('div', {});
  const row = h('div', { class: 'grid g2' });
  row.appendChild(h('div', { class: 'fgrp' }, h('div', { class: 'gh' }, '生鲜面积占比'),
    h('div', { class: 'gd' }, '模型推演 ' + fmt.p(f.modelArea) + '%'),
    numInput(P.freshArea, async (v) => { await api.patch('/api/projects/' + S.pid, { params: { freshArea: v } }); await recompute(); render(); }, { step: 1 }), '%'));
  row.appendChild(h('div', { class: 'fgrp' }, h('div', { class: 'gh' }, '生鲜销售占比'),
    h('div', { class: 'gd' }, '模型推演 ' + fmt.p(f.modelSales) + '%'),
    numInput(P.freshSales, async (v) => { await api.patch('/api/projects/' + S.pid, { params: { freshSales: v } }); await recompute(); render(); }, { step: 1 }), '%'));
  body.appendChild(row);
  body.appendChild(h('div', { class: 'alert ' + (f.idx < 0.8 ? 'danger' : f.idx < 1.05 ? 'warn' : 'ok'), style: 'margin-top:10px' },
    '坪效指数 = 销售占比 ÷ 面积占比 = ' + f.salesPct + '% ÷ ' + f.areaPct + '% = ' + fmt.x(f.idx) + '　—　' + f.verdict.d
    + '（判定：≥1.30 驱动型 / 1.05–1.30 均衡 / 0.80–1.05 配套 / <0.80 压缩）'));
  c3.bodyEl.appendChild(body);
  box.appendChild(c3);

  return box;
}
