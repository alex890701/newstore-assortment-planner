import './shell.js';
import { boot, S, DICT, h, $, clear, fmt, card, btn, api, toast } from './core.js';

boot('catmanage').then(render);

const CH = new Map();
const EXP = {};
let STAT = null;
let SEL = '';

async function kids(parent, level) {
  const key = (parent || '@') + '#' + level;
  if (CH.has(key)) return CH.get(key);
  const r = await api.get(`/api/projects/${S.pid}/cat5?level=${level}&parent=${encodeURIComponent(parent || '')}`);
  CH.set(key, r);
  return r;
}
const flush = () => CH.clear();

async function render() {
  const app = clear($('#app'));
  STAT = await api.get(`/api/projects/${S.pid}/cat5/stat`);

  app.appendChild(h('div', { class: 'pagehead' },
    h('h1', {}, '模块 11 · 商品分类管理'),
    h('span', { class: 'desc' }, '标准 5 级分类：部门 → 处级 → 大类 → 中类 → 小类，编码逐级嵌套 1/2/4/6/8 位'),
    h('span', { class: 'sp' }),
    btn('展开至大类', '', async () => {
      const r1 = await kids('', 1);
      for (const d of r1) { EXP[d.code] = 1; const c2 = await kids(d.code, 2); for (const c of c2) EXP[c.code] = 1; }
      render();
    }),
    btn('折叠全部', '', () => { Object.keys(EXP).forEach((k) => delete EXP[k]); render(); }),
    btn('导出分类结构 CSV', '', () => { location.href = `/api/projects/${S.pid}/cat5/export`; }),
    btn('一键重置', 'warn', async () => {
      if (!confirm('将丢弃全部分类改动，恢复到标准初始结构。确认？')) return;
      await api.post(`/api/projects/${S.pid}/cat5/reset`, {});
      flush(); await boot(); render(); toast('已重置');
    })));

  /* 统计 */
  const c0 = card(null, '统计总览');
  const sg = h('div', { class: 'statgrid' });
  [['部门', STAT.dept], ['处级', STAT.chu], ['大类', STAT.da], ['中类', STAT.zhong], ['小类', STAT.xiao], ['已归类单品', STAT.items]]
    .forEach(([l, v]) => sg.appendChild(h('div', { class: 'stat' }, h('div', { class: 'n' }, fmt.n(v)), h('div', { class: 'l' }, l))));
  c0.bodyEl.appendChild(sg);
  app.appendChild(c0);

  /* 搜索 */
  const c1 = card(null, '分类树维护',
    h('span', { class: 'small muted' }, '悬停节点显示 ＋新增子级 / ✎重命名 / ×删除'));
  const si = h('input', { type: 'text', placeholder: '输入关键词 → 逐级展开并定位', id: 'cmk' });
  si.onkeydown = async (e) => { if (e.key === 'Enter') await find(si.value.trim()); };
  c1.bodyEl.appendChild(h('div', { class: 'fl' }, h('label', {}, '搜索定位'), si,
    btn('定位', 'pri', () => find(si.value.trim()))));
  const tree = h('div', { class: 'tree', id: 'cmtree' });
  const r1 = await kids('', 1);
  for (const n of r1) tree.appendChild(await nodeEl(n, 1));
  c1.bodyEl.appendChild(h('div', { class: 'scroll', style: 'max-height:640px' }, tree));
  app.appendChild(c1);
}

async function find(kw) {
  if (!kw) return;
  const r1 = await kids('', 1);
  let hit = null;
  const walk = async (parent, level) => {
    const list = await kids(parent, level);
    for (const n of list) {
      if (n.name.includes(kw)) { hit = n; return true; }
      if (level < 5 && await walk(n.code, level + 1)) return true;
    }
    return false;
  };
  // 逐级展开：先把所有层级的数据抓下来会较慢，这里只展开到命中为止
  const openPath = async (parent, level) => {
    const list = await kids(parent, level);
    for (const n of list) {
      if (n.name.includes(kw)) { EXP[n.code] = 1; hit = n; return n; }
    }
    for (const n of list) {
      if (level >= 5) continue;
      const sub = await kids(n.code, level + 1);
      if (sub.some((s) => s.name.includes(kw))) {
        EXP[n.code] = 1;
        return await openPath(n.code, level + 1);
      }
    }
    return null;
  };
  const r = await openPath('', 1);
  if (!r) return toast('未找到「' + kw + '」');
  SEL = r.code;
  render();
  setTimeout(() => {
    const e = document.querySelector('[data-code="' + r.code + '"]');
    if (e) { e.scrollIntoView({ block: 'center' }); e.style.outline = '2px solid #e0813c'; setTimeout(() => { e.style.outline = ''; }, 2200); }
  }, 60);
  toast('已定位：' + r.name);
}

async function nodeEl(n, level) {
  const box = h('div', {});
  const open = !!EXP[n.code];
  const row = h('div', { class: 'tnode' + (SEL === n.code ? ' sel' : ''), 'data-code': n.code });
  row.appendChild(h('span', {
    class: 'tw caret', onclick: async (e) => {
      e.stopPropagation();
      if (!open && level < 5) { await kids(n.code, level + 1); EXP[n.code] = 1; } else delete EXP[n.code];
      render();
    }
  }, level < 5 ? (open ? '▾' : '▸') : '·'));
  row.appendChild(h('span', { class: 'lv lv' + level }, ['部', '处', '大', '中', '小'][level - 1]));
  row.appendChild(h('span', { class: 'tname' }, n.name));
  row.appendChild(h('span', { class: 'tcnt' }, '#' + n.code));
  if (n.items) row.appendChild(h('span', { class: 'tcnt' }, '· ' + n.items + ' 单品'));
  const ops = h('span', { class: 'sp', style: 'flex:1' });
  row.appendChild(ops);
  const ob = h('span', { style: 'display:flex;gap:4px;opacity:.35' });
  row.onmouseenter = () => { ob.style.opacity = '1'; };
  row.onmouseleave = () => { ob.style.opacity = '.35'; };
  if (level < 5) ob.appendChild(btn('＋', 'sm', async (e) => {
    e.stopPropagation();
    const name = prompt('在「' + n.name + '」下新增子级名称');
    if (!name) return;
    const r = await api.post(`/api/projects/${S.pid}/cat5`, { parent: n.code, name });
    flush(); EXP[n.code] = 1; await boot(); render(); toast('已新增 ' + r.code);
  }));
  ob.appendChild(btn('✎', 'sm', async (e) => {
    e.stopPropagation();
    const name = prompt('重命名为', n.name);
    if (!name) return;
    await api.patch(`/api/projects/${S.pid}/cat5/${n.code}`, { name });
    flush(); await boot(); render(); toast('已重命名');
  }));
  if (level > 1) ob.appendChild(btn('×', 'sm warn', async (e) => {
    e.stopPropagation();
    if (!confirm(`删除「${n.name}」及其全部子级？` + (n.items ? `\n该节点关联 ${n.items} 条单品，删除后这些单品的分类路径会失效并回滚到上级。` : ''))) return;
    const r = await api.del(`/api/projects/${S.pid}/cat5/${n.code}`);
    flush(); await boot(); render(); toast(`已删除 ${r.removed} 个节点`);
  }));
  row.appendChild(ob);
  box.appendChild(row);

  if (open && level < 5) {
    const ch = await kids(n.code, level + 1);
    if (level + 1 === 5) {
      const chips = h('div', { class: 'chips' });
      ch.forEach((c) => {
        const chip = h('span', { class: 'chip', 'data-code': c.code },
          c.name, c.items ? h('b', {}, ' ' + c.items) : '');
        chip.onclick = () => { SEL = c.code; render(); };
        chips.appendChild(chip);
      });
      box.appendChild(chips);
    } else {
      const wrap = h('div', { style: 'padding-left:16px' });
      for (const c of ch) wrap.appendChild(await nodeEl(c, level + 1));
      box.appendChild(wrap);
    }
  }
  return box;
}
