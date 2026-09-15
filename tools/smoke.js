/**
 * 服务端冒烟测试：不依赖浏览器，直接校验引擎与 REST API
 * 用法：先 node server/index.js，再 node tools/smoke.js
 */
const BASE = process.env.XD_BASE || 'http://127.0.0.1:3020';

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '  → ' + extra : '')); }
};

async function get(p, opt) { const r = await fetch(BASE + p, opt); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* noop */ } return { status: r.status, body: j, text: t }; }
async function send(p, m, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const hasNaN = (o) => JSON.stringify(o).includes('null,') ? false : /:\s*NaN|"NaN"/.test(JSON.stringify(o));

(async () => {
  console.log('\n=== 1. 字典与项目 ===');
  const dict = await get('/api/dict');
  ok(dict.status === 200, 'GET /api/dict 200');
  ok(dict.body && dict.body.CAT_DEF.length === 15, '15 个测算中类');
  ok(Object.keys(dict.body.PRESET).length === 6, '6 套业态预设');
  ok(dict.body.ZONES.reduce((a, z) => a + z.courses.reduce((b, c) => b + c.items.length, 0), 0) === 47, '47 项陈列道具');
  ok(Object.keys(dict.body.FMT_NAME).length === 6, '业态名称字典');

  const ps = await get('/api/projects');
  ok(ps.status === 200 && Array.isArray(ps.body), 'GET /api/projects');
  const pid = ps.body[0] ? ps.body[0].id : null;
  ok(!!pid, '存在默认项目', pid);

  console.log('\n=== 2. 分类树 ===');
  const st = await get('/api/projects/' + pid + '/cat5/stat');
  ok(st.body.dept === 4 && st.body.chu === 22 && st.body.da === 136 && st.body.zhong === 549 && st.body.xiao === 3904,
    '分类数量 4/22/136/549/3904', JSON.stringify(st.body));
  ok(st.body.items === 225, '默认单品 225 条', String(st.body.items));

  const L1 = await get('/api/projects/' + pid + '/cat5?level=1');
  ok(L1.body.length === 4, '4 个部门');
  const L2 = await get('/api/projects/' + pid + '/cat5?level=2&parent=1');
  ok(L2.body.length === 6, '生鲜部 6 个处级', String(L2.body.length));
  const L3 = await get('/api/projects/' + pid + '/cat5?level=3&parent=11');
  ok(L3.body.length === 10, '蔬菜处 10 个大类', String(L3.body.length));

  console.log('\n=== 3. 计算引擎 ===');
  const cp = await get('/api/projects/' + pid + '/compute');
  ok(cp.status === 200, 'GET /compute 200');
  const R = cp.body;
  ok(!hasNaN(R), '结果无 NaN');
  ok(R.rows.length === 15, '15 行品类结果');
  ok(Math.abs(R.rows.reduce((a, r) => a + r.share, 0) - 100) < 0.5, '销售占比合计≈100%');
  ok(R.kpi.traffic > 0 && R.kpi.day > 0 && R.kpi.psm > 0, 'KPI 有效', JSON.stringify(R.kpi));
  ok(R.item.length === 225, '单品计算 225 条');
  ok(R.item.every((i) => Number.isFinite(i._day) && Number.isFinite(i.qty)), '单品日销/首单量有效');
  ok(R.brands.length > 10 && R.brands[0].share > 0, '品牌聚合有效 top=' + (R.brands[0] && R.brands[0].name));
  ok(Math.abs(R.brands.reduce((a, b) => a + b.share, 0) - 100) < 0.6, '品牌份额合计≈100%');
  ok(R.advice.length >= 9 && R.advice.length <= 12, `建议 ${R.advice.length} 条（9~12）`);
  ok(R.alerts.length >= 1, '预警区有内容');
  ok(R.fx.total.bays > 0, '陈列总节数 ' + R.fx.total.bays);
  // 聚集度：同一测算中类的大类+中类必须唯一
  const agg = {};
  R.item.forEach((i) => { const k = i.cat + '|' + i.cat5.a + '|' + i.cat5.m; agg[k] = (agg[k] || 0) + 1; });
  const groups = {};
  Object.keys(agg).forEach((k) => { const c = k.split('|')[0]; groups[c] = (groups[c] || 0) + 1; });
  ok(Object.values(groups).every((v) => v === 1), '单品聚集度 = 1（同中类落在同一大类+中类）', JSON.stringify(groups));

  console.log('\n=== 4. 商圈参数联动 ===');
  const before = JSON.parse(JSON.stringify(R.kpi));
  await send('/api/projects/' + pid, 'PATCH', { params: { conv: 40 } });
  const cp2 = await get('/api/projects/' + pid + '/compute');
  ok(cp2.body.kpi.day > before.day, '提高进店转化率后日销上升', `${before.day} → ${cp2.body.kpi.day}`);
  await send('/api/projects/' + pid, 'PATCH', { params: { conv: 26 } });

  console.log('\n=== 4b. 行政区划懒加载 ===');
  const rgRoot = await get('/api/regions');
  ok(rgRoot.status === 200 && rgRoot.body.items.length === 31, 'GET /api/regions 返回 31 个省级单位', String(rgRoot.body.items.length));
  const gd = rgRoot.body.items.find((it) => it.name === '广东省');
  ok(!!gd && gd.hasChild, '广东省在 31 省级中且有子级', gd && gd.code);
  const rgGd = await get('/api/regions?parent=' + gd.code);
  ok(rgGd.body.items.length === 21, '广东下辖 21 个城市', String(rgGd.body.items.length));
  const dg = rgGd.body.items.find((it) => it.name === '东莞市');
  ok(!!dg, '东莞市在广东下', dg && dg.code);
  const rgDg = await get('/api/regions?parent=' + dg.code);
  ok(rgDg.body.items.length >= 28 && rgDg.body.items.length <= 35, '东莞 32 个镇/街道（直筒子市）', String(rgDg.body.items.length));
  ok(rgDg.body.items.every((it) => /[镇街道]$/.test(it.name)), '东莞下级都是镇/街道', rgDg.body.items[0].name);
  // 普通 4 级链路
  const sz = rgGd.body.items.find((it) => it.name === '深圳市');
  const rgSz = await get('/api/regions?parent=' + sz.code);
  const ft = rgSz.body.items.find((it) => it.name === '福田区');
  ok(!!ft, '深圳市 → 福田区 链路通', ft && ft.code);
  const rgFt = await get('/api/regions?parent=' + ft.code);
  ok(rgFt.body.items.length > 0 && rgFt.body.items.every((it) => /[街道社区村]$/.test(it.name)), '福田区下辖街道', String(rgFt.body.items.length));
  // 写回与持久化
  await send('/api/projects/' + pid, 'PATCH', { params: { regionP: '广东省', regionC: '深圳市', regionA: '福田区', regionT: rgFt.body.items[0].name } });
  const pAfter = await get('/api/projects/' + pid);
  ok(pAfter.body.params.regionP === '广东省' && pAfter.body.params.regionC === '深圳市' && pAfter.body.params.regionA === '福田区' && pAfter.body.params.regionT === rgFt.body.items[0].name,
    '地区 4 字段持久化', `${pAfter.body.params.regionP}/${pAfter.body.params.regionC}/${pAfter.body.params.regionA}/${pAfter.body.params.regionT}`);
  // 直筒子市回归
  await send('/api/projects/' + pid, 'PATCH', { params: { regionP: '广东省', regionC: '东莞市', regionA: '', regionT: '' } });

  console.log('\n=== 5. 业态切换 ===');
  const frIndustrial = cp2.body.rows[0].share;
  const r5 = await send('/api/projects/' + pid, 'PATCH', { fmt: 'community' });
  const cp3 = await get('/api/projects/' + pid + '/compute');
  ok(cp3.body.fmt === 'community', '业态切换为社区生鲜超市');
  ok(Math.abs(cp3.body.rows.reduce((a, r) => a + r.share, 0) - 100) < 0.5, '新业态占比合计 100%');
  ok(cp3.body.rows[0].share > frIndustrial,
    '业态占比已切换', `蔬菜水果 ${frIndustrial}% → ${cp3.body.rows[0].share}%`);
  await send('/api/projects/' + pid, 'PATCH', { fmt: 'industrial' });

  console.log('\n=== 6. 趋势 ===');
  const cpBase = await get('/api/projects/' + pid + '/compute');
  const tr = await get('/api/projects/' + pid + '/trends');
  ok(tr.body.cat.length === 15, '15 个品类趋势');
  ok(tr.body.brand.length > 0, '品牌趋势已聚合');
  await send('/api/projects/' + pid + '/trends', 'PATCH', { brand: { [tr.body.brand[0].name]: 1.2 } });
  const cp4 = await get('/api/projects/' + pid + '/compute');
  const b0 = tr.body.brand[0].name;
  const beforeSum = cpBase.body.item.filter((i) => i.brand === b0).reduce((a, b) => a + b._day, 0);
  const afterSum = cp4.body.item.filter((i) => i.brand === b0).reduce((a, b) => a + b._day, 0);
  ok(afterSum > beforeSum, `品牌趋势 ${b0} 1.20× 生效`, `${beforeSum.toFixed(0)} → ${afterSum.toFixed(0)}`);
  await send('/api/projects/' + pid + '/trends', 'PATCH', { op: 'resetAllBrand' });

  console.log('\n=== 7. 单品筛选 / 编辑 ===');
  const q1 = await get('/api/projects/' + pid + '/items?cat=veg&size=100');
  ok(q1.body.count === 15, '选中类 veg 筛出全部 15 条', String(q1.body.count));
  const q2 = await get('/api/projects/' + pid + '/items?dept=' + encodeURIComponent('生鲜部') + '&size=500');
  ok(q2.body.count === 75, '生鲜部 75 条', String(q2.body.count));
  const one = q1.body.rows[0];
  await send('/api/projects/' + pid + '/items/' + one.id, 'PATCH', { price: 99 });
  const q3 = await get('/api/projects/' + pid + '/items?cat=veg&size=100');
  ok(q3.body.rows.find((r) => r.id === one.id).price === 99, '单品改价已持久化');
  await send('/api/projects/' + pid + '/items/' + one.id, 'PATCH', { price: one.price });

  console.log('\n=== 8. 陈列道具 ===');
  const fxr = await get('/api/projects/' + pid + '/fx');
  ok(fxr.body.report.zones.length === 3, '3 个区域');
  ok(fxr.body.report.total.bays > 0, '总节数 ' + fxr.body.report.total.bays);
  const fxKeep = JSON.parse(JSON.stringify(fxr.body.state));
  const sc = await send('/api/projects/' + pid + '/fx/scale', 'POST', { zone: 'op', target: 300 });
  ok(Math.abs(sc.body.report.zones[0].bays - 300) <= 1, '缩放到 300 节误差 ≤1', String(sc.body.report.zones[0].bays));
  const sp = await send('/api/projects/' + pid + '/fx/same-spec', 'POST', { course: 'op.food' });
  ok(sp.body.ok, '同规格按钮执行成功');
  await send('/api/projects/' + pid, 'PATCH', { fx: fxKeep });
  const cp5 = await get('/api/projects/' + pid + '/compute');
  ok(Math.abs(cp5.body.fx.total.bays - fxr.body.report.total.bays) < 0.6, '道具状态已还原');

  console.log('\n=== 9. 分类增删改 ===');
  const add = await send('/api/projects/' + pid + '/cat5', 'POST', { parent: '11', name: '测试叶菜' });
  ok(add.body.ok && add.body.code, '新增处级子节点 ' + add.body.code);
  const rn = await send('/api/projects/' + pid + '/cat5/' + add.body.code, 'PATCH', { name: '测试叶菜改' });
  ok(rn.body.ok, '重命名成功');
  const del = await send('/api/projects/' + pid + '/cat5/' + add.body.code, 'DELETE');
  ok(del.body.ok, '删除成功');
  const st2 = await get('/api/projects/' + pid + '/cat5/stat');
  ok(st2.body.da === 136, '删除后大类回到 136', String(st2.body.da));

  console.log('\n=== 10. 导出 ===');
  for (const [n, u] of [
    ['单品明细', `/api/projects/${pid}/items/export`],
    ['分类结构', `/api/projects/${pid}/cat5/export`],
    ['陈列道具', `/api/projects/${pid}/fx/export`],
    ['品类趋势', `/api/projects/${pid}/trends/export?type=cat`],
    ['品牌趋势', `/api/projects/${pid}/trends/export?type=brand`],
    ['测算汇总', `/api/projects/${pid}/summary/export`]
  ]) {
    const r = await fetch(BASE + u);
    const buf = Buffer.from(await r.arrayBuffer());
    const bom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    ok(r.status === 200 && bom && buf.length > 60, n + ' CSV（含 BOM）', buf.length + ' bytes');
  }

  console.log('\n=== 11. 多项目 ===');
  const np = await send('/api/projects', 'POST', { name: '测试二号店', fmt: 'standard' });
  ok(np.body.id, '新建项目 ' + np.body.id);
  const ps2 = await get('/api/projects');
  ok(ps2.body.length === ps.body.length + 1, '项目数 +1');
  const npc = await get('/api/projects/' + np.body.id + '/compute');
  ok(npc.status === 200 && npc.body.rows.length === 15, '新项目可计算');
  await fetch(BASE + '/api/projects/' + np.body.id, { method: 'DELETE' });

  console.log('\n══════════════════════════════');
  console.log(`  通过 ${pass} / 失败 ${fail}`);
  console.log('══════════════════════════════\n');
  process.exit(fail ? 1 : 0);
})();
