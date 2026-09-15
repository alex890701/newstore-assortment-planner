/**
 * 前端页面冒烟：用 Chromium 打开 9 个页面，捕获 console error / pageerror / 失败请求
 * 用法：node tools/uicheck.js
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.XD_BASE || 'http://127.0.0.1:3020';
const PAGES = ['index', 'biz', 'format', 'fixture', 'trend-cat', 'trend-brand', 'category', 'catmanage', 'analysis'];

function findChromium() {
  const base = (process.env.LOCALAPPDATA || '') + '/ms-playwright';
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium-'));
  for (const d of dirs.sort().reverse()) {
    for (const p of [`${base}/${d}/chrome-win/chrome.exe`, `${base}/${d}/chrome-win32/chrome.exe`]) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const exe = findChromium() || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-proxy-server', '--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

let fail = 0, pass = 0;
for (const p of PAGES) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errs.push('reqfail: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  const url = `${BASE}/${p}.html`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errs.push('goto: ' + e.message));
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({
    loading: !!document.querySelector('.loading'),
    cards: document.querySelectorAll('.card').length,
    svg: document.querySelectorAll('svg').length,
    nav: document.querySelectorAll('.navrow a').length,
    text: (document.querySelector('#app') || {}).innerText ? document.querySelector('#app').innerText.length : 0
  }));
  let extra = '';
  /* 交互抽查 */
  try {
    if (p === 'catmanage') {
      await page.click('text=展开至大类');
      await page.waitForTimeout(2500);
      const n = await page.evaluate(() => document.querySelectorAll('.tnode').length);
      extra = ` 展开后节点 ${n}`;
      if (n < 140) errs.push('展开至大类后节点数异常: ' + n);
    }
    if (p === 'category') {
      const before = await page.evaluate(() => document.querySelectorAll('#itholder tbody tr').length);
      await page.click('.deptcard:nth-child(2)');
      await page.waitForTimeout(2200);
      const after = await page.evaluate(() => document.querySelectorAll('#itholder tbody tr').length);
      extra = ` 明细行 ${before}→${after}`;
      if (!(after > 0 && after <= before)) errs.push('部门筛选后行数异常: ' + before + '→' + after);
    }
    if (p === 'format') {
      await page.click('.deptcard:nth-child(2)');
      await page.waitForTimeout(2000);
      const fmt = await page.evaluate(() => (document.querySelector('#fmtBadge') || {}).textContent);
      extra = ` 切换业态→${fmt}`;
      if (!fmt || fmt === '工业区综合超市') errs.push('业态切换未生效: ' + fmt);
    }
  } catch (e) { errs.push('interaction: ' + e.message); }

  const bad = errs.length || info.loading || info.nav !== 9;
  if (bad) { fail++; console.log(`✗ ${p}.html  cards=${info.cards} svg=${info.svg} nav=${info.nav}`); errs.slice(0, 6).forEach((e) => console.log('    ' + e)); }
  else { pass++; console.log(`✓ ${p}.html  cards=${info.cards} svg=${info.svg} 文本 ${info.text} 字${extra}`); }
  await page.close();
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail + '\n');
await browser.close();
process.exit(fail ? 1 : 0);
