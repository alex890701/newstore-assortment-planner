/**
 * 行政区划懒加载模块
 * 数据源 server/data/regions.json（民政部公开数据，4 级：省/市/区/镇）
 *
 * 树形结构不规则 —— 直辖市（如北京）和直筒子市（如东莞、中山）只有 3 层；
 * 前端按 parent code 拉取 children 时，本模块会从扁平索引命中。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'data', 'regions.json');

let _tree = null;
let _byCode = null;

function load() {
  if (_tree) return;
  _tree = JSON.parse(readFileSync(FILE, 'utf8'));
  _byCode = new Map();
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      _byCode.set(n.code, { node: n, depth });
      if (n.children) walk(n.children, depth + 1);
    }
  };
  walk(_tree, 1);
}

/** parent='' → 返回全部省份 */
export function list(parentCode) {
  load();
  if (!parentCode) {
    return _tree.map((n) => ({ code: n.code, name: n.name, depth: 1, hasChild: !!(n.children && n.children.length) }));
  }
  const ent = _byCode.get(parentCode);
  if (!ent || !ent.node.children) return [];
  return ent.node.children.map((n) => {
    // 6 位编码 = 区/县级；9 位编码 = 镇/街道级
    const kind = (n.code.length === 6) ? '区/县' : (n.code.length === 9 ? '镇/街道' : '');
    return {
      code: n.code, name: n.name, depth: ent.depth + 1, kind,
      hasChild: !!(n.children && n.children.length)
    };
  });
}

/** 通过 name 反查 code（首条匹配；同名取省/市/区/镇最浅的） */
export function findByName(name, parentCode) {
  if (!name) return null;
  load();
  const nodes = parentCode ? ((_byCode.get(parentCode) || {}).node || {}).children || [] : _tree;
  const hit = nodes.find((n) => n.name === name);
  return hit ? { code: hit.code, name: hit.name } : null;
}

/** 给定一条 path（4 段 name），依次反查各层 code */
export function resolveCodes(p, c, a, t) {
  load();
  const r = {};
  const pc = _tree.find((n) => n.name === p);
  if (!pc) return r;
  r.p = { code: pc.code, name: pc.name };
  if (c) {
    const cc = (pc.children || []).find((n) => n.name === c);
    if (cc) {
      r.c = { code: cc.code, name: cc.name };
      if (a) {
        const ac = (cc.children || []).find((n) => n.name === a);
        if (ac) {
          r.a = { code: ac.code, name: ac.name };
          if (t) {
            const tc = (ac.children || []).find((n) => n.name === t);
            if (tc) r.t = { code: tc.code, name: tc.name };
          }
        }
      }
    }
  }
  return r;
}

export const REGION_VERSION = 'v1-202509';