/* 前端核心：API 客户端 / 格式化 / DOM 助手 / 全局状态 */
export const DICT = {};
export const S = { pid: null, proj: null, R: null, cat5: null };

/* ── API ── */
async function req(url, opt) {
  const r = await fetch(url, opt);
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch (e) { /* 非 JSON */ }
  if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return { json: j, text: t };
}
export const api = {
  get: (u) => req(u).then((r) => r.json),
  raw: (u) => req(u).then((r) => r.text),
  post: (u, b) => req(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json),
  patch: (u, b) => req(u, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json),
  del: (u) => req(u, { method: 'DELETE' }).then((r) => r.json)
};

/* ── 格式化（中国区约定：货币 ¥、千分位） ── */
const nf = (d) => new Intl.NumberFormat('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt = {
  n: (v, d = 0) => (v == null || !isFinite(v) ? '—' : nf(d).format(v)),
  y: (v, d = 0) => (v == null || !isFinite(v) ? '—' : '¥' + nf(d).format(v)),
  w: (v) => (v == null || !isFinite(v) ? '—' : (Math.abs(v) >= 1e8 ? (v / 1e8).toFixed(2) + ' 亿' : Math.abs(v) >= 1e4 ? (v / 1e4).toFixed(1) + ' 万' : nf(0).format(v))),
  yw: (v) => '¥' + fmt.w(v),
  p: (v, d = 1) => (v == null || !isFinite(v) ? '—' : nf(d).format(v) + '%'),
  x: (v, d = 2) => (v == null || !isFinite(v) ? '—' : nf(d).format(v) + '×'),
  sign: (v, d = 1) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + nf(d).format(v))
};

/* ── DOM ── */
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k === 'style') e.setAttribute('style', attrs[k]);
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  }
  kids.flat(4).forEach((c) => {
    if (c == null || c === false) return;
    e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  });
  return e;
}
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function clear(e) { while (e && e.firstChild) e.removeChild(e.firstChild); return e; }
export const pid = () => S.pid;

let _toast;
export function toast(msg) {
  if (!_toast) { _toast = h('div', { class: 'toast' }); document.body.appendChild(_toast); }
  _toast.textContent = msg;
  _toast.classList.add('on');
  clearTimeout(_toast._t);
  _toast._t = setTimeout(() => _toast.classList.remove('on'), 1900);
}

/* ── 下载（服务端返回带 BOM 的 CSV） ── */
export function dl(url, name) {
  const a = h('a', { href: url, download: name || 'export.csv' });
  document.body.appendChild(a); a.click(); a.remove();
}

/* ── 引导 ── */
export async function boot(page) {
  DICT.ALL = await api.get('/api/dict');
  Object.assign(DICT, DICT.ALL);
  const ps = await api.get('/api/projects');
  S.projects = ps;
  if (!ps.length) throw new Error('没有可用项目');
  const saved = localStorage.getItem('xd_pid');
  S.pid = (saved && ps.some((p) => p.id === saved)) ? saved : ps[0].id;
  await refresh();
  await window.Shell.render(page);
  return S;
}

export async function refresh() {
  S.proj = await api.get('/api/projects/' + S.pid);
  S.R = await api.get('/api/projects/' + S.pid + '/compute');
  localStorage.setItem('xd_pid', S.pid);
  return S;
}

/**
 * 重算。注意：必须连项目一起刷新 —— 否则 S.proj.params / S.proj.fmt 仍是旧值，
 * 页面会拿旧参数渲染（典型症状：切业态后表格仍显示上一个业态的预设）。
 */
export async function recompute() {
  await refresh();
  return S.R;
}

/** 改参数 → 重算 → 重渲染 回调 */
export async function patchAndRerun(body, cb) {
  await api.patch('/api/projects/' + S.pid, body);
  await recompute();
  if (cb) cb();
}

export function card(no, title, ...right) {
  const head = h('div', { class: 'cardhead' });
  if (no) head.appendChild(h('span', { class: 'no' }, no));
  head.appendChild(h('span', {}, title));
  head.appendChild(h('span', { class: 'sp' }));
  (right || []).forEach((r) => r != null && head.appendChild(r));
  const card = h('div', { class: 'card' }, head, h('div', { class: 'cardbody' }));
  card.bodyEl = card.lastChild;
  return card;
}
export function btn(label, cls, fn) { return h('button', { class: 'btn ' + (cls || ''), onclick: (e) => { e.stopPropagation(); fn(e); } }, label); }

/** 可编辑单元格 */
export function cell(value, disp, onSave, type) {
  const td = h('td', { class: 'editable' }, disp == null ? value : disp);
  td.onclick = (ev) => {
    ev.stopPropagation();
    if (td.querySelector('input')) return;
    const inp = h('input', { class: 'incell', type: type || 'text', value: value == null ? '' : value });
    clear(td).appendChild(inp);
    inp.focus(); inp.select();
    const done = async (ok) => {
      const v = inp.value;
      let out = v;
      if (type === 'number') out = v === '' ? null : Number(v);
      clear(td).appendChild(document.createTextNode(disp == null ? value : disp));
      if (ok && String(v) !== String(value == null ? '' : value)) { try { await onSave(out); } catch (e) { toast('保存失败：' + e.message); } }
    };
    inp.onblur = () => done(true);
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp._esc = 1; clear(td).appendChild(document.createTextNode(disp == null ? value : disp)); }
    };
  };
  return td;
}

/** 数值输入（带步进器） */
export function numInput(value, onchange, opts) {
  const o = opts || {};
  const inp = h('input', {
    type: 'number', value: value, step: o.step == null ? 1 : o.step,
    min: o.min, max: o.max, class: o.cls || ''
  });
  let t;
  inp.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => { const v = inp.value === '' ? 0 : Number(inp.value); onchange(isFinite(v) ? v : 0); }, o.delay == null ? 320 : o.delay);
  };
  if (o.immediate) inp.oninput = () => onchange(inp.value === '' ? 0 : Number(inp.value));
  return inp;
}

/** 字段行 */
export function field(label, ctrl, hint) {
  const wrap = h('div', { class: 'fl' }, h('label', {}, label));
  const v = h('div', { class: 'val' }, ctrl);
  wrap.appendChild(v);
  if (hint) wrap.appendChild(h('span', { class: 'small muted' }, hint));
  return wrap;
}

export function group(title, desc, ...kids) {
  const g = h('div', { class: 'fgrp' }, h('div', { class: 'gh' }, title), h('div', { class: 'gd' }, desc));
  kids.forEach((k) => g.appendChild(k));
  return g;
}
