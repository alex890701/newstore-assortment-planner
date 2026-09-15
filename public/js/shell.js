/* 顶部框架：导航条 + 门店项目切换 */
import { h, $, api, S, DICT, toast, btn, refresh, recompute, fmt } from './core.js';

const PAGES = [
  { k: 'index', n: '概览', u: '/index.html', d: '核心指标与结论' },
  { k: 'biz', n: '商圈测算', u: '/biz.html', d: 'STEP 01 · 客流与日销推演' },
  { k: 'format', n: '业态定位', u: '/format.html', d: 'STEP 02 · 品类结构与陈列配比' },
  { k: 'fixture', n: '陈列道具', u: '/fixture.html', d: 'STEP 03 · 47 项道具换算' },
  { k: 'trend-cat', n: '品类趋势', u: '/trend-cat.html', d: 'STEP 04 · 商圈品类修正' },
  { k: 'trend-brand', n: '品牌趋势', u: '/trend-brand.html', d: 'STEP 05 · 品牌份额修正' },
  { k: 'category', n: '品类分析', u: '/category.html', d: '5 级分类 + 单品明细' },
  { k: 'catmanage', n: '分类管理', u: '/catmanage.html', d: '分类树维护' },
  { k: 'analysis', n: '结构与建议', u: '/analysis.html', d: '角色/价格带/决策建议' }
];

function render(page) {
  const host = $('#shell');
  if (!host) return;
  host.innerHTML = '';

  const bar = h('div', { class: 'topbar' });

  /* 第一行 */
  const r1 = h('div', { class: 'row1' });
  r1.appendChild(h('div', { class: 'logo' }, h('span', { class: 'dot' }, '选'), '新店选品测算系统'));
  r1.appendChild(h('span', { class: 'badge-fmt', id: 'fmtBadge' }, DICT.FMT_NAME[S.proj.fmt] || S.proj.fmt));

  const right = h('div', { class: 'tb-right' });
  const sel = h('select', {
    onchange: async (e) => {
      S.pid = e.target.value;
      await refresh();
      location.reload();
    }
  });
  (S.projects || []).forEach((p) => sel.appendChild(h('option', { value: p.id, selected: p.id === S.pid ? 'selected' : null }, p.name)));
  right.appendChild(h('span', { class: 'small' }, '门店'));
  right.appendChild(sel);
  right.appendChild(btn('＋ 新建', '', async () => {
    const n = prompt('新门店名称', '新建门店 ' + ((S.projects || []).length + 1));
    if (!n) return;
    const r = await api.post('/api/projects', { name: n, fmt: S.proj.fmt });
    S.pid = r.id; await refresh(); location.reload();
  }));
  right.appendChild(btn('重置初始', 'warn', async () => {
    if (!confirm('将清空当前门店的全部参数、单品与分类改动，恢复到初始样板状态。确认？')) return;
    await api.post('/api/projects/' + S.pid + '/reset', {});
    await refresh(); location.reload();
  }));
  right.appendChild(btn('导出汇总', '', () => {
    const a = h('a', { href: '/api/projects/' + S.pid + '/summary/export' }); document.body.appendChild(a); a.click(); a.remove();
  }));
  right.appendChild(btn('删除门店', 'warn', async () => {
    if ((S.projects || []).length <= 1) return toast('至少保留 1 个门店');
    if (!confirm('删除当前门店及其全部数据？')) return;
    await api.del('/api/projects/' + S.pid);
    location.href = '/index.html';
  }));
  r1.appendChild(right);
  bar.appendChild(r1);

  /* 导航 */
  const nav = h('div', { class: 'navrow' });
  PAGES.forEach((p) => {
    const a = h('a', { href: p.u, class: p.k === page ? 'on' : '', title: p.d }, p.n);
    nav.appendChild(a);
  });
  bar.appendChild(nav);
  host.appendChild(bar);

  document.title = (PAGES.find((p) => p.k === page) || { n: '' }).n + ' · 新店选品测算系统';
}

/** 业态等全局信息变化后，同步顶部而不重建整页 */
function sync() {
  const b = $('#fmtBadge');
  if (b) b.textContent = DICT.FMT_NAME[S.proj.fmt] || S.proj.fmt;
}

window.Shell = { render, sync, PAGES };
