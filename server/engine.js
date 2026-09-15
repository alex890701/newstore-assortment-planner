/**
 * 服务端权威计算引擎
 * 严格实现 PRD 第六部分核心算法，规避第七部分已知坑
 */
import {
  CAT_DEF, CAT_IDS, CAT_MAP, PRESET, FMT_NAME, BAY_MIX, FRESH_DEF, DENSITY, BAY_MM, ZONE_K,
  ROLES, ROLE_MAP, SPEC, BANDS, BAND_C, PB_MIDR, PB_RG, bandOf, TIERS, BRAND_TIERS,
  tierIdx, brandTierIdx, FX_BASE, FX_SPEC3, ZONES, FX_FLAT, DEPT_COLOR
} from './dict.js';
import { items, cat5ItemCounts } from './db.js';
import { treeOf } from './seed.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/* ══════════ 陈列道具 ══════════ */
export function defaultFx() {
  const o = {};
  for (const it of FX_FLAT) {
    const p = (FX_SPEC3[it.sp] || [[1200, 600, 2000]])[0];
    o[it.id] = { L: p[0], W: p[1], H: p[2], lay: it.lay, qty: it.dq };
  }
  return o;
}

/** 健壮规格解析：绝不产生 NaN（PRD §6.2） */
export function parseSpec3(str) {
  const m = String(str || '').match(/\d+(?:\.\d+)?/g) || [];
  return {
    L: clamp(parseFloat(m[0]) || 1200, 300, 8000),
    W: clamp(parseFloat(m[1]) || 600, 100, 5000),
    H: clamp(parseFloat(m[2]) || 2000, 100, 5000)
  };
}

export function fxOne(def, s) {
  const b = FX_BASE[def.sp] || { bw: 600, sqm: 0.62 };
  const L = clamp(+s.L || 1200, 1, 8000), W = clamp(+s.W || 600, 1, 5000);
  const lay = Math.max(0, +s.lay || 0), qty = Math.max(0, +s.qty || 0);
  const bays = qty * L / BAY_MM;
  return {
    id: def.id, n: def.n, sp: def.sp, bk: def.bk,lay, qty, L, W, H: clamp(+s.H || 2000, 1, 5000),
    bays: r2(bays), meters: r2(qty * L / 1000), layers: lay * qty,
    sqm: r2(bays * b.sqm * (W / b.bw)),
    board: lay > 0 ? r2(qty * lay * L * W / 1e6) : 0
  };
}

export function fxReport(fxState) {
  const zones = ZONES.map((zn) => {
    let zBays = 0, zSqm = 0, zMeters = 0, zBoard = 0;
    const courses = zn.courses.map((co) => {
      let cBays = 0, cSqm = 0, cMeters = 0, cBoard = 0;
      const items = co.items.map((def) => {
        const m = fxOne(def, fxState[def.id] || {});
        cBays += m.bays; cSqm += m.sqm; cMeters += m.meters; cBoard += m.board;
        return m;
      });
      zBays += cBays; zSqm += cSqm; zMeters += cMeters; zBoard += cBoard;
      return {
        id: co.id, name: co.name, bays: r2(cBays), sqm: r2(cSqm), meters: r2(cMeters), board: r2(cBoard),
        n: items.length, items
      };
    });
    return {
      id: zn.id, name: zn.name, chu: zn.chu, bays: r2(zBays), sqm: r2(zSqm),
      meters: r2(zMeters), board: r2(zBoard), n: zn.courses.reduce((a, c) => a + c.items.length, 0), courses
    };
  });
  const T = { bays: 0, sqm: 0, meters: 0, board: 0, layers: 0, pieces: 0 };
  const byBk = { main: 0, end: 0, fresh: 0, cold: 0 };
  zones.forEach((z) => z.courses.forEach((c) => c.items.forEach((it) => {
    T.bays += it.bays; T.sqm += it.sqm; T.meters += it.meters; T.board += it.board;
    T.layers += it.layers; T.pieces += it.qty;
    byBk[it.bk] = (byBk[it.bk] || 0) + it.bays;
  })));
  return { zones, total: { ...T, bays: r2(T.bays), sqm: r2(T.sqm), meters: r2(T.meters), board: r2(T.board) }, byBk };
}

/** 按「节数」贪心 ±1 逼近目标（PRD §7.2 —— 切忌按数量缩放） */
export function scaleZone(fxState, zoneId, target) {
  const zn = ZONES.find((z) => z.id === zoneId);
  if (!zn) return fxState;
  const defs = [];
  zn.courses.forEach((c) => c.items.forEach((d) => defs.push(d)));
  const baysOf = () => defs.reduce((a, d) => a + fxOne(d, fxState[d.id]).bays, 0);
  // 1) 等比缩放数量
  let cur = baysOf();
  if (cur > 0) {
    const k = target / cur;
    defs.forEach((d) => {
      const s = fxState[d.id];
      const q = Math.round(s.qty * k);
      fxState[d.id] = { ...s, qty: Math.max(d.dq > 0 ? 1 : 0, q) };
    });
  }
  // 2) 贪心逐件 ±1
  for (let guard = 0; guard < 20000; guard++) {
    cur = baysOf();
    const diff = target - cur;
    if (Math.abs(diff) < 1e-9) break;
    const step = diff > 0 ? 1 : -1;
    let best = null, bestGain = 0;
    for (const d of defs) {
      const s = fxState[d.id];
      const nq = s.qty + step;
      if (nq < 0) continue;
      const gain = step * fxOne({ ...d }, { ...s, qty: 1 }).bays;
      if (step > 0 ? gain > bestGain : gain < bestGain) { best = d; bestGain = gain; }
    }
    if (!best) break;
    fxState[best.id] = { ...fxState[best.id], qty: fxState[best.id].qty + step };
  }
  return fxState;
}

/* ══════════ 主计算 ══════════ */
export function makeCatState(fmt, per) {
  const arr = PRESET[fmt] || PRESET.industrial;
  const o = {};
  CAT_IDS.forEach((id, i) => { o[id] = { share: arr[i], trend: 1 }; });
  return o;
}

export function normalizeCat(cat) {
  let s = 0;
  CAT_IDS.forEach((id) => { s += (+cat[id].share || 0); });
  if (s <= 0) return cat;
  CAT_IDS.forEach((id) => { cat[id].share = r2((+cat[id].share || 0) * 100 / s); });
  return cat;
}

function median(arr) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function brandTrendOf(BT, name) {
  const n = (name || '').trim();
  return (n in BT) ? BT[n] : 1;
}

export function compute(p) {
  const P = p.params, fmt = p.fmt, C = p.cat, BT = p.bt || {}, PB = p.pb || {};

  /* ── STEP 01 商圈 → 客流/日销 ── */
  const zoneK = ZONE_K[P.zone] == null ? 1 : ZONE_K[P.zone];
  const core = (+P.corePop || 0) * (+P.corePen || 0) / 100;
  const sec = (+P.secPop || 0) * (+P.secPen || 0) / 100 * 0.3;
  const traffic = (core + sec) * zoneK;
  const day = traffic * (+P.conv || 0) / 100 * (+P.ticket || 0);
  const month = day * 30;
  const usedArea = (+P.area || 0) * (+P.util || 0) / 100;
  const psm = usedArea > 0 ? month / usedArea : 0;
  const compArea = (+P.comp || 0) * (+P.compArea || 0);
  const compIdx = usedArea > 0 ? compArea / usedArea : 0;

  /* ── STEP 03 陈列资源 ── */
  const fx = fxReport(p.fx);
  const totalBays = fx.total.bays;
  const dens = DENSITY[fmt] || 2.6;
  const bayMix = BAY_MIX[fmt] || BAY_MIX.industrial;

  /* ── STEP 02/04 品类行 ── */
  let sumShare = 0;
  CAT_IDS.forEach((id) => { sumShare += (+C[id].share || 0); });
  const rows = CAT_IDS.map((id, i) => {
    const def = CAT_MAP[id];
    const share = sumShare > 0 ? (+C[id].share || 0) * 100 / sumShare : 0;
    const trend = (+C[id].trend || 0) || 1;
    const dayBase = day * share / 100;
    const dayAdj = dayBase * trend;
    const bays = totalBays * (bayMix[i] || 0) / 100;
    const areaC = bays * dens;
    const sku = Math.round(bays * def.skuPerBay);
    const monthC = dayAdj * 30;
    return {
      c: id, name: def.name, dept: def.dept, base: def.base, gmRate: def.gm,
      skuPerBay: def.skuPerBay, turn: def.turn,
      share: r2(share), trend: r2(trend), tier: tierIdx(share),
      dayBase: r2(dayBase), day: r2(dayAdj), month: r2(monthC),
      gm: r2(dayAdj * def.gm / 100),
      bayPct: bayMix[i] || 0, bays: r2(bays), meters: r2(bays * 1.2), area: r2(areaC), sku,
      psm: areaC > 0 ? r2(monthC / areaC) : 0,
      dayPerBay: bays > 0 ? r2(dayAdj / bays) : 0,
      dayPerSku: sku > 0 ? r2(dayAdj / sku) : 0,
      gmPerBay: bays > 0 ? r2(dayAdj * def.gm / 100 / bays) : 0,
      coverage: 0, counts: 0
    };
  });

  /* ── 生鲜专项 ── */
  const freshRows = rows.filter((r) => r.dept === '生鲜部');
  const freshSalesModel = r2(freshRows.reduce((a, r) => a + r.share, 0));
  const totalAreaSum = rows.reduce((a, r) => a + r.area, 0);
  const freshAreaModel = totalAreaSum > 0
    ? r2(freshRows.reduce((a, r) => a + r.area, 0) * 100 / totalAreaSum) : 0;
  const fa = +P.freshArea || 0, fs = +P.freshSales || 0;
  const freshIdx = fa > 0 ? fs / fa : 0;
  const freshVerdict = freshIdx >= 1.30 ? { k: '驱动型', c: '#1f7a5c', d: '生鲜是门店引流引擎，建议增加资源' }
    : freshIdx >= 1.05 ? { k: '均衡型', c: '#3a6cb0', d: '面积与销售匹配良好' }
      : freshIdx >= 0.80 ? { k: '配套型', c: '#b8862b', d: '生鲜以配套为主，控制资源膨胀' }
        : { k: '压缩型', c: '#c8483f', d: '面积给多了，建议压缩生鲜面积' };
  const fresh = {
    areaPct: fa, salesPct: fs, idx: r2(freshIdx), verdict: freshVerdict,
    modelArea: freshAreaModel, modelSales: freshSalesModel
  };

  /* ── KPI ── */
  const gmVal = rows.reduce((a, r) => a + r.gm, 0);
  const daySum = rows.reduce((a, r) => a + r.day, 0);
  const kpi = {
    traffic: Math.round(traffic), day: r2(day), month: r2(month), psm: r2(psm),
    ticket: r2(+P.ticket || 0), compIdx: r2(compIdx), compArea: compArea, area: +P.area || 0,
    usedArea: r2(usedArea), bays: r2(totalBays), sku: rows.reduce((a, r) => a + r.sku, 0),
    gmRate: daySum > 0 ? r2(gmVal * 100 / daySum) : 0,
    gm: r2(gmVal), itemCount: 0
  };

  /* ── 单品层 ── */
  const catDay = {};
  rows.forEach((r) => { catDay[r.c] = r.day; });
  const ITEMS = items(p.id);
  kpi.itemCount = ITEMS.length;

  const byCat = {};
  ITEMS.forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
  const wsum = {}, medp = {};
  Object.keys(byCat).forEach((k) => {
    wsum[k] = byCat[k].reduce((a, it) => a + ROLE_MAP[it.role].w, 0);
    medp[k] = median(byCat[k].map((it) => +it.price || 0));
  });

  const itemOut = ITEMS.map((it) => {
    const def = CAT_MAP[it.cat] || CAT_MAP.veg;
    const rl = ROLE_MAP[it.role] || ROLE_MAP.main;
    const W = wsum[it.cat] || 0;
    const base = (catDay[it.cat] || 0) * (W > 0 ? rl.w / W : 0);
    const bDay = base;                                   // 不含品牌趋势（供聚合，避免循环依赖）
    const nDay = base * brandTrendOf(BT, it.brand);
    const med = medp[it.cat] || 0;
    const pIdx = med > 0 ? (+it.price || 0) / med : 1;
    const band = bandOf(pIdx);
    const gm = (+it.price || 0) > 0 ? ((+it.price - +it.cost) / +it.price) * 100 : 0;
    const unit = nDay / Math.max(0.01, +it.price || 0.01);
    const qty = (it.qty == null)
      ? Math.max(1, Math.ceil(unit * (def.turn || 7) / 3))
      : Math.max(0, +it.qty);
    return {
      id: it.id, seq: it.seq, cat: it.cat, catName: def.name, dept: def.dept,
      brand: it.brand, name: it.name, barcode: it.barcode, spec: it.spec, sb: it.sb,
      price: +it.price, cost: +it.cost, role: it.role, roleName: rl.n, faces: +it.faces,
      qty, cat5: it.cat5,
      _b: r2(bDay), _day: r2(nDay), _pIdx: r2(pIdx), _band: band, _gm: r2(gm),
      _amt: r2(qty * (+it.cost || 0)), _unit: Math.round(unit)
    };
  });

  /* ── 品类关联单品数 ── */
  const catCnt = {};
  itemOut.forEach((it) => { catCnt[it.cat] = (catCnt[it.cat] || 0) + 1; });
  rows.forEach((r) => { r.counts = catCnt[r.c] || 0; r.coverage = r2(Math.min(999, r.sku > 0 ? r.counts * 100 / r.sku : 0)); });

  /* ── STEP 05 品牌聚合 ── */
  const bmap = new Map();
  itemOut.forEach((a) => {
    const k = (a.brand || '').trim() || '未标注品牌';
    if (!bmap.has(k)) bmap.set(k, { name: k, cat: {}, day: 0, items: 0 });
    const b = bmap.get(k);
    b.day += a._b; b.items += 1;
    b.cat[a.catName] = (b.cat[a.catName] || 0) + a._b;
  });
  const bTot = [...bmap.values()].reduce((a, b) => a + b.day, 0);
  const brands = [...bmap.values()].map((b) => {
    const share = bTot > 0 ? b.day * 100 / bTot : 0;
    const top = Object.entries(b.cat).sort((x, y) => y[1] - x[1])[0];
    const trend = brandTrendOf(BT, b.name);
    return {
      name: b.name, cat: top ? top[0] : '', day: r2(b.day), items: b.items,
      share: r2(share), trend: +trend.toFixed(2), tier: brandTierIdx(share)
    };
  }).sort((a, b) => b.share - a.share);

  /* ── 结构统计 ── */
  const roleStat = ROLES.map((r) => {
    const list = itemOut.filter((a) => a.role === r.id);
    return {
      id: r.id, n: r.n, c: r.c, w: r.w, cnt: list.length,
      day: r2(list.reduce((a, b) => a + b._day, 0)), face: list.reduce((a, b) => a + b.faces, 0)
    };
  });
  const roleDay = roleStat.reduce((a, b) => a + b.day, 0);
  roleStat.forEach((r) => { r.dayPct = roleDay > 0 ? r2(r.day * 100 / roleDay) : 0; });

  const bandStat = BANDS.map((n, i) => {
    const list = itemOut.filter((a) => a._band === i);
    return {
      i, n, c: BAND_C[i], rg: PB_RG[i], mid: PB_MIDR[i], cnt: list.length,
      day: r2(list.reduce((a, b) => a + b._day, 0)),
      face: list.reduce((a, b) => a + b.faces, 0)
    };
  });
  const bTot2 = itemOut.length || 1;
  bandStat.forEach((b) => { b.pct = r2(b.cnt * 100 / bTot2); });

  const tgt = PB.tgt && PB.tgt.length === 6 ? PB.tgt : [8, 22, 30, 22, 12, 6];
  const tgtSum = tgt.reduce((a, b) => a + b, 0) || 1;
  const priceband = {
    act: bandStat.map((b) => b.pct),
    tgt: tgt.map((v) => r2(v * 100 / tgtSum)),
    diff: bandStat.map((b, i) => r2(b.pct - tgt[i] * 100 / tgtSum)),
    rows: bandStat
  };

  const specStat = SPEC.map((n, i) => {
    const list = itemOut.filter((a) => a.sb === n);
    return { n, cnt: list.length, day: r2(list.reduce((a, b) => a + b._day, 0)) };
  });

  const brandConc = brands.slice(0, 12);
  const cr3 = brands.slice(0, 3).reduce((a, b) => a + b.share, 0);
  const cr10 = brands.slice(0, 10).reduce((a, b) => a + b.share, 0);

  /* ── 5 级分类关联计数 ── */
  const tree = treeOf(p.id);
  const cnt = cat5ItemCounts(p.id);
  const counts = { d: {}, c: {}, a: {}, m: {}, x: {} };
  for (const lv of ['d', 'c', 'a', 'm', 'x']) {
    for (const [k, v] of Object.entries(cnt[lv])) counts[lv][k] = v;
  }
  const deptRows = {};
  rows.forEach((r) => { deptRows[r.dept] = deptRows[r.dept] || []; deptRows[r.dept].push(r.c); });

  /* ── 决策建议 / 预警 ── */
  const orderValue = r2(itemOut.reduce((a, b) => a + b._amt, 0));
  const orderQty = itemOut.reduce((a, b) => a + b.qty, 0);
  const { advice, alerts } = buildAdvice({
    P, fmt, rows, kpi, fresh, fx, brands, cr3, cr10, priceband, roleStat, itemOut,
    usedArea, totalBays, orderValue, orderQty
  });

  return {
    fmt, fmtName: FMT_NAME[fmt], rows, kpi, fresh, fx, alerts, advice,
    brands, item: itemOut, role: roleStat, band: bandStat, spec: specStat,
    priceband, brandConc, conc: { cr3: r2(cr3), cr10: r2(cr10) },
    counts, treeStat: {}, catalogReady: tree.all.length > 0,
    orderValue, orderQty
  };
}

/* ══════════ 建议与预警 ══════════ */
function buildAdvice(o) {
  const { P, fmt, rows, kpi, fresh, fx, brands, cr3, priceband, roleStat, itemOut, usedArea, totalBays } = o;
  const advice = [], alerts = [];
  const F = FMT_NAME[fmt] || fmt;

  const dev = rows.map((r) => ({ r, d: +(r.share - r.bayPct).toFixed(2) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (dev[0] && Math.abs(dev[0].d) >= 2) {
    advice.push({
      t: '陈列资源错配', tag: dev[0].d > 0 ? '加压' : '过载', lv: 'warn',
      b: `「${dev[0].r.name}」销售占比 ${dev[0].r.share}%，陈列节数占比仅 ${dev[0].r.bayPct}%，偏离 ${dev[0].d > 0 ? '+' : ''}${dev[0].d}pp。`
        + (dev[0].d > 0
          ? `该品类 ${dev[0].r.dayPerBay.toFixed(0)} 元/节/日高于均值，建议增加 ${Math.ceil(Math.abs(dev[0].d) * totalBays / 100)} 节。`
          : `该品类单节产出仅 ${dev[0].r.dayPerBay.toFixed(0)} 元/节/日，建议让出 ${Math.ceil(Math.abs(dev[0].d) * totalBays / 100)} 节给高效率品类。`)
    });
  }

  advice.push({
    t: '业态匹配度', tag: F, lv: 'info',
    b: `当前为${F}，${rows.slice().sort((a, b) => b.share - a.share)[0].name}为第一支柱品类（${rows.slice().sort((a, b) => b.share - a.share)[0].share}%）。
        建议仔细检查是否与目标客群结构一致；若为蓝领/工厂客群，休闲零食+酒水饮料合计应≥25%。`
  });

  advice.push({
    t: '坪效水平', tag: kpi.psm >= 1800 ? '优秀' : kpi.psm >= 1200 ? '达标' : '偏低', lv: kpi.psm >= 1200 ? 'ok' : 'warn',
    b: `综合坪效 ${kpi.psm.toFixed(0)} 元/㎡/月（实用面积 ${kpi.usedArea.toFixed(0)}㎡，月销 ${(kpi.month / 10000).toFixed(1)} 万元）。
        ${kpi.psm >= 1800 ? '高于行业中位，可考虑提高客单价或扩容。' : kpi.psm >= 1200 ? '处于合理区间，先做结构优化。' : '低于参考值，建议压缩低效品类节数、提高生鲜/日配驱动能力。'}`
  });

  advice.push({
    t: '竞争强度', tag: `竞销比 ${kpi.compIdx.toFixed(2)}×`, lv: kpi.compIdx > 1.2 ? 'warn' : 'ok',
    b: `${+P.comp || 0} 家竞品、合计 ${kpi.compArea.toFixed(0)}㎡，相当于本店实用面积的 ${kpi.compIdx.toFixed(2)} 倍。
        ${kpi.compIdx > 1.2 ? '竞争饱和，须靠生鲜驱动与差异化（现制加工/大规格工业装）切入。' : '竞争温和，重点是把渗透率做起来。'}`
  });

  const tg = rows.slice().sort((a, b) => Math.abs(b.trend - 1) - Math.abs(a.trend - 1))[0];
  if (tg && Math.abs(tg.trend - 1) > 0.05) {
    advice.push({
      t: '趋势修正偏离', tag: `${tg.trend.toFixed(2)}×`, lv: Math.abs(tg.trend - 1) > 0.2 ? 'warn' : 'info',
      b: `「${tg.name}」商圈趋势系数设为 ${tg.trend.toFixed(2)}，日销由 ${tg.dayBase.toFixed(0)} 元修正到 ${tg.day.toFixed(0)} 元。趋势系数不做归一化，全店日销会相应${tg.trend > 1 ? '上浮' : '下探'}。`
    });
  }

  advice.push({
    t: '生鲜坪效指数', tag: fresh.verdict.k, lv: fresh.idx < 0.8 ? 'warn' : 'ok',
    b: `销售占比 ${fresh.salesPct}% ÷ 面积占比 ${fresh.areaPct}% = 坪效指数 ${fresh.idx}（${fresh.verdict.k}）。${fresh.verdict.d}。
        模型推演值为面积 ${fresh.modelArea}% / 销售 ${fresh.modelSales}%，可与手动设定对照。`
  });

  const lowCov = rows.filter((r) => r.sku > 0 && r.coverage < 3).sort((a, b) => a.coverage - b.coverage)[0];
  advice.push({
    t: 'SKU 覆盖率', tag: lowCov ? `${lowCov.name} ${lowCov.coverage}%` : '良好', lv: lowCov ? 'warn' : 'ok',
    b: lowCov
      ? `「${lowCov.name}」规划 ${lowCov.sku} 个 SKU，已录样 ${lowCov.counts} 条，覆盖率 ${lowCov.coverage}%。样板数据仅作结构先验，正式选品须补齐到 ${lowCov.sku} 级，否则首单配货失真。`
      : '各品类样板块覆盖尚可，可直接进入正式选品评审。'
  });

  const pbMax = priceband.diff.map((v, i) => ({ i, v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
  advice.push({
    t: '价格带结构', tag: priceband.rows[pbMax.i].n, lv: Math.abs(pbMax.v) >= 8 ? 'warn' : 'ok',
    b: `实际与目标偏差最大的是「${priceband.rows[pbMax.i].n}」：实际 ${priceband.act[pbMax.i]}% vs 目标 ${priceband.tgt[pbMax.i]}%（${pbMax.v > 0 ? '+' : ''}${pbMax.v}pp）。${pbMax.v > 0 ? '该档过量，可向上迁移，提升毛利。' : '该档不足，注意价格断层风险。'}`
  });

  advice.push({
    t: '品牌集中度', tag: `CR3 ${cr3.toFixed(1)}%`, lv: cr3 > 55 ? 'warn' : 'ok',
    b: `前 3 品牌贡献 ${cr3.toFixed(1)}%、前 10 品牌 ${o.cr10.toFixed(1)}%。${cr3 > 55 ? '集中度过高，采购议价被动，建议引入 2–3 个替代品牌。' : '集中度合理，可继续按品牌趋势调权。'}`
  });

  const tf = roleStat.find((r) => r.id === 'traffic');
  advice.push({
    t: '角色结构', tag: tf ? `引流 ${tf.dayPct}%` : '—', lv: (tf && tf.dayPct > 45) ? 'warn' : 'ok',
    b: `引流爆品占日销 ${tf ? tf.dayPct : 0}%（面位 ${tf ? tf.face : 0} 个）。${(tf && tf.dayPct > 45) ? '引流品承载过重，毛利承压，建议把部分销售迁移到走量主力与毛利品。' : '结构尚属健康，保持引流—走量—毛利的金字塔比例即可。'}`
  });

  advice.push({
    t: '陈列投放节奏', tag: `${Math.round(totalBays)} 节`, lv: 'info',
    b: `全场 ${Math.round(totalBays)} 节、占地 ${fx.total.sqm.toFixed(0)}㎡（主货架/端架堆头/生鲜台位/冷柜卧柜 = ${Math.round(fx.byBk.main)}/${Math.round(fx.byBk.end)}/${Math.round(fx.byBk.fresh)}/${Math.round(fx.byBk.cold)} 节）。
        陈列占地占实用面积 ${usedArea > 0 ? (fx.total.sqm * 100 / usedArea).toFixed(1) : '0'}%，${fx.total.sqm * 100 / Math.max(1, usedArea) > 70 ? '偏高，需复核主通道宽度（建议≥1.6m）。' : '动线空间充足。'}`
  });

  advice.push({
    t: '首单配货', tag: `${o.orderQty} 件`, lv: 'info',
    b: `按当前结构，样板 ${itemOut.length} 条单品首单合计 ${o.orderQty} 件、占用资金 ¥${o.orderValue.toFixed(0)}。
        正式选品建议按 1/3 周转天数备货，并对季节品/新品试销压降首单量至 50%。`
  });

  /* 预警 */
  if (kpi.compIdx > 1.5) alerts.push({ lv: 'danger', t: `竞争饱和：竞销比 ${kpi.compIdx.toFixed(2)}×，商圈已进入红海` });
  else if (kpi.compIdx > 1.0) alerts.push({ lv: 'warn', t: `竞争偏强：竞销比 ${kpi.compIdx.toFixed(2)}×` });
  const fa = fx.total.sqm, fap = usedArea > 0 ? fa * 100 / usedArea : 0;
  if (fap > 70) alerts.push({ lv: 'danger', t: `陈列占地 ${fap.toFixed(1)}%，超过 70% 红线，动线受影响` });
  else if (fap > 60) alerts.push({ lv: 'warn', t: `陈列占地 ${fap.toFixed(1)}%，接近上限` });
  if (fresh.idx < 0.8) alerts.push({ lv: 'danger', t: `生鲜坪效指数 ${fresh.idx}（${fresh.verdict.k}），面积配置过量` });
  else if (fresh.idx > 1.3) alerts.push({ lv: 'warn', t: `生鲜坪效指数 ${fresh.idx}（${fresh.verdict.k}），可加大生鲜投入` });
  if (cr3 > 60) alerts.push({ lv: 'warn', t: `品牌 CR3 ${cr3.toFixed(1)}%，集中度过高` });
  const stale = rows.filter((r) => Math.abs(r.trend - 1) > 0.25);
  if (stale.length) alerts.push({ lv: 'warn', t: `${stale.length} 个品类趋势系数偏离基准 >25%（${stale.map((r) => r.name).join('、')}）` });
  if (!alerts.length) alerts.push({ lv: 'ok', t: '当前参数无重大预警' });

  return { advice: advice.slice(0, 12), alerts };
}
