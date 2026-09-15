/* 手写原生 SVG 图表库（零第三方图表依赖） */
import { h, fmt } from './core.js';

const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  kids.flat(3).forEach((c) => { if (c != null) e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
  return e;
}
export function svg(w, ht, ...kids) {
  return S('svg', { viewBox: `0 0 ${w} ${ht}`, width: '100%', height: ht, preserveAspectRatio: 'xMidYMid meet' }, kids);
}
function txt(x, y, s, o) {
  return S('text', Object.assign({ x, y, fill: o && o.fill || '#69747f', 'font-size': (o && o.size) || 11, 'text-anchor': (o && o.anchor) || 'start' }, (o && o.weight ? { 'font-weight': o.weight } : {})), s);
}

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const [x0, y0] = p(a0, r1), [x1, y1] = p(a1, r1), [x2, y2] = p(a1, r0), [x3, y3] = p(a0, r0);
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

/* ── 环形图 ── */
export function donut(data, o) {
  o = o || {};
  const W = o.w || 520, H = o.h || 300, cx = o.cx || 165, cy = H / 2, r1 = 118, r0 = 68;
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const g = [];
  let a = -Math.PI / 2;
  data.forEach((d) => {
    const frac = Math.max(0, d.value) / total;
    if (frac <= 0) return;
    const a1 = a + frac * Math.PI * 2;
    g.push(S('path', {
      d: arc(cx, cy, r0, r1, a, a1 - 0.008), fill: d.color, stroke: '#fff', 'stroke-width': 1.4,
      onmousemove: null
    }, S('title', {}, `${d.name} ${fmt.n(d.value, 1)}${o.unit || '%'}（${(frac * 100).toFixed(1)}%）`)));
    a = a1;
  });
  g.push(txt(cx, cy - 6, fmt.n(total, 1) + (o.unit || '%'), { anchor: 'middle', size: 20, fill: '#1b2430', weight: 700 }));
  g.push(txt(cx, cy + 14, o.center || '合计', { anchor: 'middle', size: 11 }));
  const sv = svg(W, H, g);
  // 图例
  const top = data.slice().sort((x, y) => y.value - x.value).slice(0, o.legend || 15);
  const lg = h('div', { class: 'legend' });
  top.forEach((d) => {
    lg.appendChild(h('span', {},
      h('i', { style: 'background:' + d.color }),
      `${d.name} ${fmt.n(d.value, 1)}${o.unit || '%'}`));
  });
  const box = h('div', {}, sv, lg);
  return box;
}

/* ── 横向条形（可左右两侧） ── */
export function hbar(data, o) {
  o = o || {};
  const rowH = o.rowH || 22, padL = o.padL || 92, padR = o.padR || 62, W = o.w || 620;
  const H = Math.max(40, data.length * rowH + 26);
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const half = W / 2;
  const g = [];
  data.forEach((d, i) => {
    const y = i * rowH + 12;
    const w = Math.abs(d.value) / max * (half - padL - 8);
    const x0 = d.value >= 0 ? padL : padL - w;
    g.push(txt(padL - 6, y + 11, d.name, { anchor: 'end', size: 11.5, fill: '#46525d' }));
    g.push(S('rect', { x: padL, y: y + 1, width: (half - padL - 8) * 2 - 0, height: rowH - 8, fill: '#f5f7f9', rx: 3 }));
    g.push(S('rect', { x: x0, y: y + 1, width: Math.max(1, w), height: rowH - 8, fill: d.color || '#1f7a5c', rx: 3 }, S('title', {}, `${d.name}: ${fmt.n(d.value, d.d == null ? 1 : d.d)}${d.unit || ''}`)));
    g.push(txt(padL + (half - padL - 8) * 2 + 6, y + 11, fmt.n(d.value, d.d == null ? 1 : d.d) + (d.unit || ''), { size: 11, fill: '#69747f' }));
  });
  return svg(W, H, g);
}

/* ── 蝴蝶图（销售占比 vs 陈列占比） ── */
export function butterfly(rows, o) {
  o = o || {};
  const rowH = 21, W = 640, H = rows.length * rowH + 30, mid = W / 2, gap = 46;
  const max = Math.max(...rows.map((r) => Math.max(r.share, r.bayPct))) * 1.1 || 1;
  const g = [];
  g.push(txt(mid - gap - 40, 14, '◀ 销售占比 %', { anchor: 'end', size: 11, fill: '#c8483f', weight: 600 }));
  g.push(txt(mid + gap + 40, 14, '陈列节数占比 % ▶', { size: 11, fill: '#3a6cb0', weight: 600 }));
  rows.forEach((r, i) => {
    const y = i * rowH + 24;
    const wl = r.share / max * (mid - gap - 60);
    const wr = r.bayPct / max * (mid - gap - 60);
    g.push(S('rect', { x: mid - gap - wl, y, width: wl, height: rowH - 7, fill: '#e0813c', rx: 2 }, S('title', {}, `${r.name} 销售 ${r.share}%`)));
    g.push(S('rect', { x: mid + gap, y, width: wr, height: rowH - 7, fill: '#3a6cb0', rx: 2 }, S('title', {}, `${r.name} 陈列 ${r.bayPct}%`)));
    g.push(txt(mid, y + rowH - 12, r.name, { anchor: 'middle', size: 10.5, fill: '#1b2430' }));
  });
  return svg(W, H, g);
}

/* ── 双轴：柱(日销) + 折线(毛利率) ── */
export function combo(rows, o) {
  o = o || {};
  const W = 900, H = o.h || 300, pl = 54, pr = 48, pt = 16, pb = 54;
  const iw = W - pl - pr, ih = H - pt - pb;
  const maxDay = Math.max(1, ...rows.map((r) => r.day));
  const gms = rows.map((r) => r.gmRate);
  const g0 = Math.min(...gms, 0), g1 = Math.max(...gms, 10);
  const bw = iw / rows.length * 0.6;
  const g = [];
  // 网格
  for (let i = 0; i <= 4; i++) {
    const y = pt + ih - ih * i / 4;
    g.push(S('line', { x1: pl, y1: y, x2: pl + iw, y2: y, stroke: '#eef2f4' }));
    g.push(txt(pl - 6, y + 3.5, fmt.n(maxDay * i / 4 / 1000, 1) + 'k', { anchor: 'end', size: 10 }));
  }
  rows.forEach((r, i) => {
    const cx = pl + iw * (i + 0.5) / rows.length;
    const bhh = r.day / maxDay * ih;
    g.push(S('rect', { x: cx - bw / 2, y: pt + ih - bhh, width: bw, height: Math.max(1, bhh), fill: r.dept === '生鲜部' ? '#2e9e7b' : r.dept === '食品部' ? '#e0813c' : '#3a6cb0', rx: 2 },
      S('title', {}, `${r.name} 日销 ${fmt.y(r.day)} / 毛利率 ${r.gmRate}%`)));
    g.push(txt(cx, H - pb + 14, r.name, { anchor: 'middle', size: 10, fill: '#46525d' }));
  });
  // 折线
  const pts = rows.map((r, i) => {
    const cx = pl + iw * (i + 0.5) / rows.length;
    const cy = pt + ih - (r.gmRate - g0) / (g1 - g0 || 1) * ih;
    return [cx, cy];
  });
  g.push(S('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#c8483f', 'stroke-width': 2 }));
  pts.forEach((p, i) => g.push(S('circle', { cx: p[0], cy: p[1], r: 3, fill: '#fff', stroke: '#c8483f', 'stroke-width': 2 },
    S('title', {}, `${rows[i].name} 毛利率 ${rows[i].gmRate}%`))));
  g.push(txt(W - pr + 6, pt + 8, '毛利率%', { size: 10, fill: '#c8483f' }));
  g.push(txt(pl - 6, pt - 4, '日销(元)', { anchor: 'end', size: 10 }));
  return svg(W, H, g);
}

/* ── 象限矩阵 ── */
export function quad(rows, o) {
  o = o || {};
  const W = 720, H = o.h || 420, pl = 56, pr = 22, pt = 18, pb = 46;
  const iw = W - pl - pr, ih = H - pt - pb;
  const xs = rows.map((r) => r.psm), ys = rows.map((r) => r.gmRate);
  const x0 = 0, x1 = Math.max(1, ...xs) * 1.12;
  const y0 = 0, y1 = Math.max(10, ...ys) * 1.12;
  const mx = Math.max(...xs) ? x1 / 2 : 1, my = y1 / 2;
  const px = (v) => pl + (v - x0) / (x1 - x0 || 1) * iw;
  const py = (v) => pt + ih - (v - y0) / (y1 - y0 || 1) * ih;
  const maxDay = Math.max(1, ...rows.map((r) => r.day));
  const g = [];
  g.push(S('rect', { x: pl, y: pt, width: iw, height: ih, fill: '#fcfdfd', stroke: '#eef2f4' }));
  g.push(S('line', { x1: px(mx), y1: pt, x2: px(mx), y2: pt + ih, stroke: '#dfe5ea', 'stroke-dasharray': '4 4' }));
  g.push(S('line', { x1: pl, y1: py(my), x2: pl + iw, y2: py(my), stroke: '#dfe5ea', 'stroke-dasharray': '4 4' }));
  g.push(txt(pl + 8, pt + 14, '高坪效 · 高毛利（明星）', { size: 10.5, fill: '#1f7a5c' }));
  g.push(txt(pl + iw - 8, pt + 14, '高坪效 · 低毛利（走量）', { size: 10.5, fill: '#3a6cb0', anchor: 'end' }));
  g.push(txt(pl + 8, pt + ih - 8, '低坪效 · 高毛利（待激活）', { size: 10.5, fill: '#b8862b' }));
  g.push(txt(pl + iw - 8, pt + ih - 8, '低坪效 · 低毛利（压缩）', { size: 10.5, fill: '#c8483f', anchor: 'end' }));
  rows.forEach((r) => {
    const rad = 5 + Math.sqrt(r.day / maxDay) * 15;
    g.push(S('circle', { cx: px(r.psm), cy: py(r.gmRate), r: rad, fill: r.dept === '生鲜部' ? '#2e9e7b' : r.dept === '食品部' ? '#e0813c' : '#3a6cb0', 'fill-opacity': .42, stroke: r.dept === '生鲜部' ? '#2e9e7b' : r.dept === '食品部' ? '#e0813c' : '#3a6cb0' },
      S('title', {}, `${r.name} 坪效 ${fmt.n(r.psm)} / 毛利 ${r.gmRate}% / 日销 ${fmt.y(r.day)}`)));
    g.push(txt(px(r.psm), py(r.gmRate) + 3, r.name.slice(0, 2), { anchor: 'middle', size: 9.5, fill: '#1b2430' }));
  });
  g.push(txt(pl + iw / 2, H - 12, '坪效（元/㎡/月）→', { anchor: 'middle', size: 11 }));
  g.push(S('g', { transform: `translate(14,${pt + ih / 2}) rotate(-90)` }, txt(0, 0, '毛利率 % →', { anchor: 'middle', size: 11 })));
  return svg(W, H, g);
}

/* ── 分组对比柱状（目标 vs 实际） ── */
export function gbar(items, o) {
  o = o || {};
  const W = 720, H = o.h || 260, pl = 44, pr = 16, pt = 14, pb = 46;
  const iw = W - pl - pr, ih = H - pt - pb;
  const max = Math.max(1, ...items.flatMap((d) => d.v));
  const gw = iw / items.length;
  const g = [];
  for (let i = 0; i <= 4; i++) {
    const y = pt + ih - ih * i / 4;
    g.push(S('line', { x1: pl, y1: y, x2: pl + iw, y2: y, stroke: '#eef2f4' }));
    g.push(txt(pl - 6, y + 3.5, fmt.n(max * i / 4, 0) + '%', { anchor: 'end', size: 10 }));
  }
  items.forEach((d, i) => {
    const bw = gw * 0.3;
    d.v.forEach((v, j) => {
      const x = pl + gw * i + gw * 0.2 + j * (bw + 4);
      const bhh = v / max * ih;
      g.push(S('rect', { x, y: pt + ih - bhh, width: bw, height: Math.max(1, bhh), fill: d.c[j], rx: 2 },
        S('title', {}, `${d.name} ${d.lb[j]} ${fmt.n(v, 1)}%`)));
      g.push(txt(x + bw / 2, pt + ih - bhh - 4, fmt.n(v, 1), { anchor: 'middle', size: 9.5, fill: '#69747f' }));
    });
    g.push(txt(pl + gw * i + gw / 2, H - pb + 16, d.name, { anchor: 'middle', size: 11, fill: '#46525d' }));
    g.push(txt(pl + gw * i + gw / 2, H - pb + 30, d.sub || '', { anchor: 'middle', size: 10, fill: '#8b95a0' }));
  });
  return svg(W, H, g);
}

/* ── 简单折线（敏感性/结构） ── */
export function lineChart(series, o) {
  o = o || {};
  const W = o.w || 620, H = o.h || 240, pl = 52, pr = 18, pt = 14, pb = 40;
  const iw = W - pl - pr, ih = H - pt - pb;
  const max = o.max || Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p[1])));
  const min = 0;
  const xs = series[0].pts.map((p) => p[0]);
  const px = (i) => pl + iw * i / Math.max(1, xs.length - 1);
  const py = (v) => pt + ih - (v - min) / (max - min || 1) * ih;
  const g = [];
  for (let i = 0; i <= 4; i++) {
    const y = pt + ih - ih * i / 4;
    g.push(S('line', { x1: pl, y1: y, x2: pl + iw, y2: y, stroke: '#eef2f4' }));
    g.push(txt(pl - 6, y + 3.5, fmt.w((max - min) * i / 4 + min), { anchor: 'end', size: 10 }));
  }
  series.forEach((s) => {
    const pts = s.pts.map((p, i) => [px(i), py(p[1])]);
    g.push(S('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2 }));
    pts.forEach((p, i) => g.push(S('circle', { cx: p[0], cy: p[1], r: 3, fill: '#fff', stroke: s.color, 'stroke-width': 2 },
      S('title', {}, `${s.name} @ ${s.pts[i][0]} = ${fmt.n(s.pts[i][1])}`))));
  });
  xs.forEach((x, i) => { if (i % (o.step || 1) === 0) g.push(txt(px(i), H - pb + 16, x, { anchor: 'middle', size: 10 })); });
  const lg = h('div', { class: 'legend' });
  series.forEach((s) => lg.appendChild(h('span', {}, h('i', { style: 'background:' + s.color }), s.name)));
  return h('div', {}, svg(W, H, g), lg);
}

/* ── 瀑布/构成条形（客流构成） ── */
export function stack(parts, o) {
  o = o || {};
  const W = o.w || 620, H = 92, pl = 8, iw = W - 16;
  const tot = parts.reduce((a, p) => a + Math.max(0, p.v), 0) || 1;
  const g = [];
  let x = pl;
  parts.forEach((p) => {
    const w = Math.max(0, p.v) / tot * iw;
    g.push(S('rect', { x: x + 1, y: 22, width: Math.max(0, w - 2), height: 34, fill: p.c, rx: 4 },
      S('title', {}, `${p.n} ${fmt.n(p.v, 0)}（${(p.v / tot * 100).toFixed(1)}%）`)));
    if (w > 44) g.push(txt(x + w / 2, 43, `${p.n} ${(p.v / tot * 100).toFixed(0)}%`, { anchor: 'middle', size: 11, fill: '#fff', weight: 600 }));
    x += w;
  });
  g.push(txt(pl, 14, `${o.title || '构成'}  合计 ${fmt.n(tot, 0)}`, { size: 11.5, fill: '#46525d' }));
  return svg(W, H, g);
}
