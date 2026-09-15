/**
 * 全局数据字典 —— 唯一数据源（前端通过 GET /api/dict 拉取）
 * 对应 PRD 第五部分数据字典 + §5.9 陈列道具 + 第十节视觉规范
 */

/* ── 15 个测算中类：[id, 名称, 部门, 默认占比%, 毛利率%, 每节SKU数, 周转天数] ── */
export const CAT_DEF = [
  ['veg', '蔬菜水果', '生鲜部', 13, 17, 22, 3],
  ['meat', '肉禽蛋品', '生鲜部', 9, 15, 20, 3],
  ['aqua', '水产海鲜', '生鲜部', 5, 16, 18, 2],
  ['deli', '面点熟食', '生鲜部', 5, 35, 24, 1.5],
  ['bake', '烘焙糕点', '生鲜部', 3, 32, 30, 1.5],
  ['dairy', '乳制品冷藏', '食品部', 6, 20, 40, 7],
  ['froz', '冷冻速食', '食品部', 5, 25, 45, 20],
  ['snack', '休闲零食', '食品部', 13, 28, 50, 25],
  ['oil', '粮油调味', '食品部', 11, 18, 40, 30],
  ['bev', '酒水饮料', '食品部', 12, 22, 42, 25],
  ['chem', '洗化用品', '非食品部', 7, 30, 30, 40],
  ['home', '家用百货', '非食品部', 5, 35, 40, 45],
  ['paper', '纸品一次性', '非食品部', 3, 28, 32, 35],
  ['text', '针织家纺', '非食品部', 2, 40, 35, 60],
  ['stat', '文具玩具', '非食品部', 1, 38, 60, 60]
];
export const CAT_IDS = CAT_DEF.map((r) => r[0]);
export const CAT_MAP = Object.fromEntries(CAT_DEF.map((r) => [r[0], {
  id: r[0], name: r[1], dept: r[2], base: r[3], gm: r[4], skuPerBay: r[5], turn: r[6]
}]));

/* ── 6 套业态销售占比预设（合计 100）── */
export const PRESET = {
  industrial: [11, 8, 3, 7, 2, 4, 7, 14, 14, 16, 5, 4, 3, 1, 1],
  community: [21, 14, 8, 7, 5, 7, 5, 8, 7, 6, 4, 2, 3, 2, 1],
  standard: [13, 9, 5, 5, 3, 6, 5, 13, 11, 12, 7, 5, 3, 2, 1],
  cvs: [2, 1, 0, 6, 5, 10, 6, 22, 3, 28, 6, 2, 5, 1, 3],
  discount: [6, 4, 1, 3, 2, 5, 8, 18, 18, 18, 7, 5, 4, 1, 0],
  premium: [12, 8, 5, 5, 8, 10, 6, 15, 6, 12, 8, 3, 2, 0, 0]
};
export const FMT_NAME = {
  industrial: '工业区综合超市',
  community: '社区生鲜超市',
  standard: '标准综合超市',
  cvs: '便利店',
  discount: '折扣量贩店',
  premium: '精品进口超市'
};

/**
 * 陈列资源占比预设（节数结构）
 * 独立于销售占比 —— 二者的偏离正是「陈列匹配度诊断/蝴蝶图」要暴露的问题
 */
export const BAY_MIX = {
  industrial: [12, 8, 4, 8, 3, 5, 7, 15, 12, 16, 4, 2, 2, 1, 1],
  community: [20, 13, 8, 8, 5, 8, 5, 9, 6, 7, 4, 2, 3, 1, 1],
  standard: [14, 9, 5, 6, 3, 7, 6, 13, 10, 12, 6, 4, 3, 1, 1],
  cvs: [2, 1, 0, 5, 5, 12, 8, 22, 3, 26, 6, 2, 5, 1, 2],
  discount: [7, 4, 1, 3, 2, 5, 8, 18, 17, 18, 6, 5, 4, 1, 1],
  premium: [13, 8, 5, 5, 9, 11, 6, 15, 5, 11, 7, 3, 2, 0, 0]
};

/* ── 生鲜策略 / 单节综合占地 ── */
export const FRESH_DEF = {
  industrial: { a: 22, s: 26 },
  community: { a: 40, s: 48 },
  standard: { a: 30, s: 33 },
  cvs: { a: 15, s: 18 },
  discount: { a: 18, s: 20 },
  premium: { a: 28, s: 31 }
};
/** 单节综合占地（㎡/节，含通道分摊） */
export const DENSITY = {
  industrial: 2.6, community: 2.9, standard: 2.7, cvs: 1.6, discount: 2.5, premium: 3.0
};
export const BAY_MM = 1200;

/* ── 商圈类型系数 ── */
export const ZONE_K = {
  industrial: 1.08, residential: 1.00, mixed: 1.12, campus: 0.95, transport: 0.88
};
export const ZONE_NAME = {
  industrial: '工业区', residential: '居住区', mixed: '混合区', campus: '文教区', transport: '交通枢纽'
};

/* ── 8 种商品角色 w权重 f面位 g目标毛利 c颜色 ── */
export const ROLES = [
  { id: 'traffic', n: '引流爆品', w: 3.5, f: 4, g: 10, c: '#c8483f' },
  { id: 'main', n: '走量主力', w: 2.0, f: 3, g: 16, c: '#1f7a5c' },
  { id: 'profit', n: '毛利品', w: 1.0, f: 2, g: 32, c: '#b8862b' },
  { id: 'image', n: '形象品', w: 0.5, f: 1, g: 38, c: '#8a5fbf' },
  { id: 'season', n: '季节品', w: 0.8, f: 2, g: 26, c: '#e0813c' },
  { id: 'fill', n: '结构补充', w: 0.4, f: 1, g: 24, c: '#5b8bd8' },
  { id: 'pl', n: '自有品牌', w: 1.2, f: 2, g: 30, c: '#2e9e7b' },
  { id: 'new', n: '新品试销', w: 0.3, f: 1, g: 26, c: '#8d99a6' }
];
export const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.id, r]));

/* ── 规格带 ── */
export const SPEC = ['小规格', '标准规格', '大规格', '家庭装', '量贩装', '组合装'];
export const SPEC_K = [0.55, 1.0, 1.55, 2.2, 3.2, 2.6];

/* ── 价格带 6 档 ── */
export const BANDS = ['超低价', '低价位', '中低价', '中高价', '高价位', '超高端'];
export const BAND_C = ['#a8dad2', '#57bfa4', '#8ec96f', '#e2c552', '#e0813c', '#b8452f'];
export const PB_EDGE = [0.60, 0.85, 1.00, 1.30, 1.80];
export const PB_RG = ['≤0.60×', '0.60–0.85×', '0.85–1.00×', '1.00–1.30×', '1.30–1.80×', '>1.80×'];
export const PB_MIDR = [0.46, 0.72, 0.92, 1.14, 1.52, 2.30];
export const PB_PRESET = [
  { n: '平价走量', v: [15, 30, 28, 15, 8, 4] },
  { n: '大众主流', v: [8, 22, 30, 22, 12, 6] },
  { n: '品质升级', v: [4, 14, 26, 28, 18, 10] },
  { n: '高端精选', v: [2, 8, 18, 28, 26, 18] }
];
export function bandOf(r) {
  for (let b = 0; b < PB_EDGE.length; b++) if (r <= PB_EDGE[b]) return b;
  return PB_EDGE.length;
}

/* ── 趋势分层 ── */
export const TIERS = [
  { k: 'A', n: '支柱品类', c: '#1f7a5c', d: '占比≥10%', min: 0.85, max: 1.15, step: 0.01 },
  { k: 'B', n: '主力品类', c: '#3a6cb0', d: '5%~10%', min: 0.75, max: 1.30, step: 0.02 },
  { k: 'C', n: '补充品类', c: '#e0813c', d: '2%~5%', min: 0.60, max: 1.45, step: 0.05 },
  { k: 'D', n: '长尾品类', c: '#8b95a0', d: '<2%', min: 0.50, max: 1.80, step: 0.05 }
];
export const BRAND_TIERS = [
  { k: 'A', n: '头部品牌', c: '#1f7a5c', d: '份额≥5%', min: 0.85, max: 1.15, step: 0.01 },
  { k: 'B', n: '主力品牌', c: '#3a6cb0', d: '2%~5%', min: 0.75, max: 1.30, step: 0.02 },
  { k: 'C', n: '补充品牌', c: '#e0813c', d: '0.5%~2%', min: 0.60, max: 1.45, step: 0.05 },
  { k: 'D', n: '长尾品牌', c: '#8b95a0', d: '<0.5%', min: 0.50, max: 1.80, step: 0.05 }
];
export function tierIdx(p) { return p >= 10 ? 0 : (p >= 5 ? 1 : (p >= 2 ? 2 : 3)); }
export function brandTierIdx(p) { return p >= 5 ? 0 : (p >= 2 ? 1 : (p >= 0.5 ? 2 : 3)); }

/* ── 15 中类 → 标准处级映射 ── */
export const CAT5_LINK = {
  veg: ['1', '11'], meat: ['1', '13'], aqua: ['1', '14'], deli: ['1', '15'], bake: ['1', '16'],
  dairy: ['2', '21'], froz: ['2', '21'], snack: ['2', '23'], oil: ['2', '24'], bev: ['2', '22'],
  chem: ['3', '31'], home: ['3', '37'], paper: ['3', '33'], text: ['3', '34'], stat: ['3', '38']
};
export const DEPT_COLOR = { 生鲜部: '#2e9e7b', 食品部: '#e0813c', 非食品部: '#3a6cb0', 耗材: '#8b95a0' };
export const DEPTS = ['生鲜部', '食品部', '非食品部', '耗材'];

/* ── 参考价与单位 ── */
export const REF_PRICE = {
  veg: 8, meat: 25, aqua: 35, deli: 12, bake: 15, dairy: 18, froz: 20,
  snack: 12, oil: 35, bev: 12, chem: 30, home: 25, paper: 18, text: 45, stat: 20
};
export const CAT_UNIT = {
  veg: 'G', meat: 'G', aqua: 'G', deli: 'G', bake: 'G', dairy: 'ML',
  froz: 'G', snack: 'G', oil: 'L', bev: 'ML', chem: 'ML',
  home: 'PC', paper: 'PC', text: 'PC', stat: 'PC'
};

/* ── 视觉规范 ── */
export const THEME = {
  bg: '#f4f6f8', card: '#ffffff', ink: '#1b2430', sub: '#69747f', line: '#e4e8ed',
  brand: '#1f7a5c', brandL: '#e8f3ef', accent: '#e0813c', accentL: '#fdf0e5',
  info: '#3a6cb0', infoL: '#eaf1fa', warn: '#c8483f', warnL: '#fceceb',
  gold: '#b8862b', up: '#c8483f', down: '#1f7a5c'
};

/* ══════════ 陈列道具 47 项 / 12 课 ══════════ */
export const FX_SPEC3 = {
  shelf: [[1200, 600, 2000], [1000, 500, 1800], [900, 450, 1600], [1500, 600, 2200], [1800, 600, 2200]],
  endcap: [[1200, 600, 1800], [1000, 500, 1600], [800, 450, 1500], [600, 400, 1400]],
  stack: [[1200, 1200, 900], [1000, 1000, 800], [1200, 800, 900], [1500, 1200, 900]],
  upright: [[1200, 800, 2200], [1800, 800, 2200], [2500, 900, 2200], [900, 700, 2000]],
  island: [[1800, 900, 900], [2100, 1000, 900], [2500, 1000, 950], [1250, 900, 900]],
  islend: [[900, 900, 900], [1000, 950, 900], [1200, 1000, 900]],
  bulk: [[1200, 600, 1800], [1000, 500, 1600], [900, 450, 1400]],
  fshlf: [[1200, 800, 1600], [1000, 700, 1500], [1500, 900, 1700], [1800, 900, 1700]],
  fcase: [[1200, 800, 2200], [1800, 800, 2200], [2500, 900, 2200], [900, 700, 2000]],
  fflat: [[1800, 1000, 900], [2100, 1100, 900], [2500, 1200, 950], [1500, 1000, 900]],
  pool: [[1500, 1000, 900], [2000, 1200, 900], [2500, 1200, 950]],
  icecase: [[1800, 1000, 850], [2100, 1100, 850], [2500, 1200, 900]],
  shell: [[1200, 800, 800], [1500, 900, 850], [1800, 1000, 850]],
  bakeshlf: [[1200, 600, 1800], [1000, 500, 1600], [900, 450, 1500]],
  cakecase: [[1200, 800, 1400], [1500, 900, 1500], [1800, 900, 1500]],
  hotcase: [[1200, 800, 1400], [1500, 900, 1400], [1800, 900, 1500]],
  posend: [[1200, 600, 1500], [1000, 500, 1400], [800, 450, 1300], [600, 400, 1200]],
  counter: [[1000, 600, 2000], [1200, 600, 2200], [1500, 650, 2200]],
  wine: [[900, 450, 1800], [1000, 500, 2000], [1200, 550, 2000]]
};

/** 规格组基准宽 & 单节占地（㎡，含操作间距） */
export const FX_BASE = {
  shelf: { bw: 600, sqm: 0.62 }, endcap: { bw: 600, sqm: 0.62 }, stack: { bw: 1200, sqm: 1.15 },
  upright: { bw: 800, sqm: 0.85 }, island: { bw: 900, sqm: 1.20 }, islend: { bw: 900, sqm: 1.05 },
  bulk: { bw: 600, sqm: 0.62 }, fshlf: { bw: 800, sqm: 0.90 }, fcase: { bw: 800, sqm: 0.95 },
  fflat: { bw: 1000, sqm: 1.30 }, pool: { bw: 1000, sqm: 1.45 }, icecase: { bw: 1000, sqm: 1.35 },
  shell: { bw: 800, sqm: 0.95 }, bakeshlf: { bw: 600, sqm: 0.62 }, cakecase: { bw: 800, sqm: 0.95 },
  hotcase: { bw: 800, sqm: 0.95 }, posend: { bw: 600, sqm: 0.55 }, counter: { bw: 600, sqm: 0.60 },
  wine: { bw: 450, sqm: 0.40 }
};
export const FX_GROUP = Object.keys(FX_SPEC3);
export const BK_NAME = { main: '主货架', end: '端架堆头', fresh: '生鲜台位', cold: '冷柜卧柜' };

/** fx(id, 名称, 规格组, 默认层数(0=无), 默认数量, 节数归集) */
const _fx = (id, n, sp, lay, dq, bk) => ({ id, n, sp, lay: lay, dq: dq, bk: bk });

export const ZONES = [
  {
    id: 'op', name: '营运区', chu: '营运处', courses: [
      {
        id: 'op.food', name: '食品课', items: [
          _fx('op.food.1', '中间货架', 'shelf', 5, 40, 'main'),
          _fx('op.food.2', '靠墙货架', 'shelf', 6, 24, 'main'),
          _fx('op.food.3', '突出端头', 'endcap', 4, 6, 'end'),
          _fx('op.food.4', '端架', 'endcap', 5, 12, 'end'),
          _fx('op.food.5', '堆头', 'stack', 0, 6, 'end')
        ]
      }, {
        id: 'op.chem', name: '化工课', items: [
          _fx('op.chem.1', '中间货架', 'shelf', 5, 30, 'main'),
          _fx('op.chem.2', '靠墙货架', 'shelf', 6, 16, 'main'),
          _fx('op.chem.3', '突出端头', 'endcap', 4, 4, 'end'),
          _fx('op.chem.4', '端架', 'endcap', 5, 8, 'end'),
          _fx('op.chem.5', '堆头', 'stack', 0, 4, 'end')
        ]
      }, {
        id: 'op.home', name: '家百课', items: [
          _fx('op.home.1', '中间货架', 'shelf', 5, 32, 'main'),
          _fx('op.home.2', '靠墙货架', 'shelf', 6, 18, 'main'),
          _fx('op.home.3', '突出端头', 'endcap', 4, 4, 'end'),
          _fx('op.home.4', '端架', 'endcap', 5, 8, 'end'),
          _fx('op.home.5', '堆头', 'stack', 0, 5, 'end')
        ]
      }, {
        id: 'op.bulk', name: '散装课', items: [
          _fx('op.bulk.1', '散装货架', 'bulk', 3, 14, 'main'),
          _fx('op.bulk.2', '靠墙货架', 'bulk', 4, 8, 'main'),
          _fx('op.bulk.3', '突出端头', 'bulk', 3, 2, 'end'),
          _fx('op.bulk.4', '端架', 'bulk', 3, 4, 'end'),
          _fx('op.bulk.5', '堆头', 'stack', 0, 3, 'end')
        ]
      }, {
        id: 'op.daily', name: '日配课', items: [
          _fx('op.daily.1', '中间货架', 'shelf', 5, 30, 'main'),
          _fx('op.daily.2', '靠墙货架', 'shelf', 6, 14, 'main'),
          _fx('op.daily.3', '突出端头', 'endcap', 4, 4, 'end'),
          _fx('op.daily.4', '端架', 'endcap', 5, 6, 'end'),
          _fx('op.daily.5', '立式冷柜', 'upright', 5, 8, 'cold')
        ]
      }
    ]
  },
  {
    id: 'fr', name: '生鲜区', chu: '生鲜处', courses: [
      {
        id: 'fr.veg', name: '蔬菜课', items: [
          _fx('fr.veg.1', '生鲜货架', 'fshlf', 3, 16, 'fresh'),
          _fx('fr.veg.2', '生鲜平台', 'fflat', 0, 10, 'fresh'),
          _fx('fr.veg.3', '组合台', 'pool', 0, 8, 'fresh')
        ]
      }, {
        id: 'fr.fruit', name: '水果课', items: [
          _fx('fr.fruit.1', '生鲜货架', 'fshlf', 3, 16, 'fresh'),
          _fx('fr.fruit.2', '生鲜平台', 'fflat', 0, 10, 'fresh'),
          _fx('fr.fruit.3', '组合台', 'pool', 0, 10, 'fresh')
        ]
      }, {
        id: 'fr.meat', name: '鲜肉课', items: [
          _fx('fr.meat.1', '生鲜冷柜', 'fcase', 4, 12, 'cold'),
          _fx('fr.meat.2', '生鲜平台', 'fflat', 0, 8, 'fresh'),
          _fx('fr.meat.3', '岛柜', 'islend', 0, 6, 'cold')
        ]
      }, {
        id: 'fr.aqua', name: '水产课', items: [
          _fx('fr.aqua.1', '生鲜货架', 'fshlf', 3, 8, 'fresh'),
          _fx('fr.aqua.2', '冰台', 'icecase', 0, 8, 'fresh'),
          _fx('fr.aqua.3', '组合池', 'pool', 0, 6, 'fresh')
        ]
      }, {
        id: 'fr.deli', name: '熟食课', items: [
          _fx('fr.deli.1', '热柜', 'hotcase', 2, 10, 'fresh'),
          _fx('fr.deli.2', '生鲜货架', 'fshlf', 3, 8, 'fresh')
        ]
      }, {
        id: 'fr.bake', name: '烘焙课', items: [
          _fx('fr.bake.1', '烘焙架', 'bakeshlf', 4, 12, 'fresh'),
          _fx('fr.bake.2', '蛋糕柜', 'cakecase', 3, 8, 'cold')
        ]
      }
    ]
  },
  {
    id: 'cs', name: '收银区', chu: '前台处', courses: [
      {
        id: 'cs.pos', name: '前台陈列', items: [
          _fx('cs.pos.1', '端架', 'posend', 3, 8, 'end'),
          _fx('cs.pos.2', '收银柜台', 'counter', 0, 3, 'end'),
          _fx('cs.pos.3', '名酒柜', 'wine', 4, 4, 'main'),
          _fx('cs.pos.4', '中岛架', 'islend', 0, 4, 'end'),
          _fx('cs.pos.5', '促销堆头', 'stack', 0, 8, 'end'),
          _fx('cs.pos.6', '立式冷柜', 'upright', 5, 7, 'cold')
        ]
      }
    ]
  }
];

/** 全部 47 项扁平索引 */
export const FX_FLAT = [];
ZONES.forEach((zn) => zn.courses.forEach((co) => co.items.forEach((it) => {
  FX_FLAT.push({ ...it, zone: zn.id, zoneName: zn.name, course: co.id, courseName: co.name });
})));

export const DEFAULT_PARAMS = {
  proj: '东莞工业区店',
  date: new Date().toISOString().slice(0, 10),
  regionP: '广东省',
  regionC: '东莞市',
  regionA: '',
  regionT: '',
  zone: 'industrial',
  corePop: 25000, corePen: 35, secPop: 60000, secPen: 12,
  conv: 26, ticket: 36.74, freq: 4.2,
  comp: 3, compArea: 1800,
  area: 3000, util: 75,
  freshArea: 22, freshSales: 26,
  tgtGm: 22
};

export const DICT_VERSION = 'v16-multi';
