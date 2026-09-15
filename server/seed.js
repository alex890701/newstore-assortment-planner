/**
 * 单品样板生成（默认 15 中类 × 15 = 225 条）
 * 关键：cat5Of 用「大类/中类按 catId 固定（哈希寻址）+ 小类按序号轮转」，
 * 保证同一测算中类的单品聚集在同一大类+中类下（PRD §6.5 / 7.15 筛选 BUG 修复）
 */
import { CAT_DEF, CAT_IDS, CAT_MAP, REF_PRICE, CAT_UNIT, ROLES, PB_MIDR, SPEC, CAT5_LINK } from './dict.js';
import { cat5Nodes } from './db.js';

/* ── 品牌池（每中类 6 家） ── */
export const BRANDS = {
  veg: ['田园优选', '绿源农场', '晨露鲜', '菜篮子', '惠农直供', '家常优选'],
  meat: ['牧歌牧场', '黑土牧业', '家佳康', '草原颂', '鲜汇食堂', '家常鲜'],
  aqua: ['海纳百川', '渔港小镇', '深蓝渔业', '鲜活源', '舟山海味', '每日鲜渔'],
  deli: ['卤香世家', '妈妈味', '灶王灶', '面点坊', '即食到家', '巷子口'],
  bake: ['麦香颂', '焙时光', '法式工坊', '甜屿烘焙', '朝阳饼家', '麦田故事'],
  dairy: ['牧场时光', '优倍滋', '纯享', '每日鲜乳', '高钙世家', '悦活'],
  froz: ['速享家', '冰厨', '零度工坊', '快食集', '鲜冻仓', '冷链优选'],
  snack: ['乐享零食铺', '闲趣食光', '咔滋脆', '果缤纷', '小食代', '悠享家'],
  oil: ['金穗粮仓', '油匠世家', '酱心源', '味本料理', '和味堂', '山海干货'],
  bev: ['沁凉谷', '气泡派', '茶时光', '醒咖源', '醇酿坊', '悦饮'],
  chem: ['净柔保养', '洁福祥', '柔丝宝', '除菌大师', '洁净家', '护卫狮'],
  home: ['居家良品', '百纳仓储', '佰利好', '五金世家', '亮宅能手', '智储王国'],
  paper: ['柔风纸品', '亲肤宝', '洁云家', '一次性优选', '日洁优选', '绵柔世家'],
  text: ['暖棉工坊', '丝柔家居', '安睡宝', '足尚袜业', '窗帘故事', '床品优选'],
  stat: ['学优文具', '智玩宝', '童年录', '笔墨世家', '桌面管家', '创想家']
};

/* ── 单品名池（每中类 ≥18 条） ── */
export const PRODUCTS = {
  veg: ['小白菜 300G', '上海青 300G', '菠菜 250G', '土豆 500G', '胡萝卜 400G', '黄瓜 400G',
    '番茄 400G', '茄子 350G', '洋葱 500G', '西兰花 400G', '生菜 250G', '韭菜 200G',
    '豆角 300G', '香菇 200G', '金针菇 150G', '莲藕 400G', '南瓜 500G', '娃娃菜 300G',
    '新鲜水果拼装 500G', '时令蔬菜组合 800G'],
  meat: ['冷鲜五花肉 500G', '猪里脊 400G', '精排骨 500G', '牛腩块 500G', '牛里脊 300G',
    '肥牛卷 400G', '羊腿肉 500G', '羊肉卷 400G', '白条鸡 1只', '鸡胸肉 400G',
    '鸡翅中 400G', '鲜鸡蛋 10枚', '土鸡蛋 15枚', '鸭掌 300G', '猪蹄 400G',
    '香肠 300G', '培根 200G', '午餐肉 340G', '牛肉馅 400G', '酱牛肉 250G'],
  aqua: ['鲜活基围虾 400G', '南美白虾 500G', '冰冻虾仁 300G', '鲜活鲈鱼 1条', '草鱼 1条',
    '带鱼段 400G', '黄花鱼 400G', '花甲 500G', '生蚝 6只', '扇贝 500G',
    '鱿鱼 300G', '巴沙鱼柳 400G', '三文鱼腩 300G', '龙利鱼柳 400G', '虾滑 200G',
    '大闸蟹 2只', '冷鲜蟹棒 200G', '虾皮干货 150G', '紫菜 100G', '海带结 300G'],
  deli: ['卤鸭脖 200G', '卤鸡爪 200G', '酱香猪蹄 250G', '凉拌海带丝 200G', '泡椒凤爪 150G',
    '卤豆干 200G', '鲜肉包 6只', '豆沙包 6只', '手工水饺 500G', '烧麦 8只',
    '馒头 6只', '两荤一素盒饭', '扬州炒饭 420G', '凉面 300G', '嫩豆腐 400G',
    '油豆皮 200G', '现磨豆浆 500ML', '炸鸡腿 2只', '盐焗鸡 半只', '烤鸭 半只'],
  bake: ['吐司面包 400G', '全麦吐司 350G', '牛角包 4只', '红豆面包 3只', '毛毛虫面包 2只',
    '贝果 2只', '法棍 1条', '瑞士卷 240G', '提拉米苏 200G', '水果蛋糕 6寸',
    '芝士蛋糕 200G', '纸杯蛋糕 4只', '蛋挞 6只', '曲奇饼干 200G', '老婆饼 4只',
    '桃酥 200G', '泡芙 4只', '麻薯 180G', '千层蛋糕 300G', '拿破仑酥 220G'],
  dairy: ['纯牛奶 250ML', '高钙奶 250ML', '低脂牛奶 250ML', '有机奶 250ML', '儿童成长奶 200ML',
    '原味酸奶 200G', '希腊酸奶 150G', '炭烧酸奶 200G', '乳酸菌饮品 100ML', '奶酪棒 100G',
    '早餐奶 250ML', '香蕉牛奶 200ML', '常温酸奶 200G', '家庭装酸奶 900G', '淡奶油 250ML',
    '芝士片 144G', '黄油 227G', '配方奶粉 400G', '豆奶 250ML', '燕麦奶 250ML'],
  froz: ['速冻水饺 500G', '速冻汤圆 400G', '手抓饼 5片', '冷冻披萨 300G', '冷冻牛肉饼 300G',
    '冷冻薯条 500G', '鸡米花 400G', '盐酥鸡 350G', '冷冻虾仁 300G', '冷冻巴沙鱼 400G',
    '酸菜鱼预制 450G', '宫保鸡丁预制 400G', '冷冻玉米粒 300G', '冷冻混合杂菜 400G',
    '冷冻鸡翅 500G', '冷冻牛腩 500G', '冷冻面包胚 300G', '冰淇淋 500G', '棒冰 10支', '冷冻春卷 300G'],
  snack: ['薯片原味 104G', '薯片番茄味 104G', '虾条 90G', '锅巴 180G', '苏打饼 200G',
    '威化饼 200G', '夹心饼干 120G', '曲奇 200G', '牛轧糖 200G', '软糖 150G',
    '黑巧克力 100G', '牛奶巧克力 50G', '瓜子 200G', '花生酥 180G', '每日坚果 175G',
    '腰果 200G', '开心果 200G', '牛肉干 100G', '猪肉脯 200G', '芒果干 100G'],
  oil: ['东北大米 5KG', '五常大米 5KG', '泰国香米 5KG', '小米 1KG', '中筋面粉 2.5KG',
    '鸡蛋挂面 900G', '意大利面 500G', '花生油 5L', '玉米油 5L', '橄榄油 1L',
    '调和油 5L', '生抽酱油 500ML', '老抽酱油 500ML', '蚝油 500G', '陈醋 500ML',
    '料酒 500ML', '食用盐 400G', '白砂糖 1KG', '香菇干货 200G', '方便面 5连包'],
  bev: ['可乐 330ML', '可乐 2L', '柠檬汽水 500ML', '苏打气泡水 500ML', '橙汁 1L',
    '苹果汁 1L', '冰红茶 500ML', '绿茶 500ML', '乌龙茶 500ML', '罐装咖啡 240ML',
    '能量饮料 250ML', '电解质水 500ML', '饮用水 550ML', '箱装饮用水 24瓶', '豆奶 250ML',
    '啤酒 500ML', '精酿小麦 330ML', '白酒 500ML', '干红葡萄酒 750ML', '预调鸡尾酒 330ML'],
  chem: ['去屑洗发水 500ML', '柔顺洗发水 750ML', '护发素 500ML', '沐浴露 1L', '身体乳 400ML',
    '香皂 115G', '含氟牙膏 120G', '软毛牙刷 2支', '漱口水 500ML', '洗手液 500ML',
    '氨基酸洁面 120G', '保湿面膜 5片', '防晒霜 50ML', '洗衣液 3KG', '洗衣粉 2KG',
    '洗衣凝珠 52颗', '洗洁精 1.5KG', '洁厕灵 500G', '杀虫气雾 600ML', '垃圾袋 100只'],
  home: ['收纳箱 55L', '塑料收纳盒 3只', '真空压缩袋 5只', '不锈钢炒锅 32CM', '汤锅 22CM',
    '菜刀 1把', '竹木砧板 40CM', '陶瓷碗 4只', '玻璃杯 6只', '保温壶 1.8L',
    'LED球泡 9W', '台灯 1台', '五号电池 4粒', '多孔排插 6位', '螺丝刀套装 8件',
    '扳手活动款 10寸', '水桶 18L', '塑料凳 1张', '晾衣架 10只', '保鲜盒 800ML'],
  paper: ['卷纸 10卷', '无芯卷纸 12卷', '抽纸 3包', '手帕纸 12包', '厨房纸 2卷',
    '擦手纸 200抽', '湿厕纸 40抽', '洁面巾 80抽', '纸尿裤 L码 40片', '拉拉裤 XL 30片',
    '婴儿湿巾 80抽', '成人护理垫 10片', '一次性纸杯 50只', '保鲜膜 30CM', '保鲜袋 100只',
    '垃圾袋加厚 50只', '一次性手套 100只', '牙线棒 50支', '铝箔纸 10M', '烘焙油纸 30张'],
  text: ['纯棉袜 5双', '男士背心 2件', '保暖内衣套装', '文胸无痕款', '四件套 1.8M',
    '空调被 200×230', '荞麦枕 1只', '毛巾 2条', '浴巾 1条', '珊瑚绒睡袍',
    '棉拖鞋 1双', '遮光窗帘 2片', '浴室防滑垫', '吸湿地毯 60×90', '收纳防尘罩',
    '儿童毛巾 3条', '运动巾 1条', '冰丝凉席 1.5M', '家居拖鞋 1双', '防螨保护套'],
  stat: ['中性笔 0.5MM', '2B铅笔 12支', '橡皮 4块', '直尺 15CM', '订书机 1台',
    '固体胶 2支', '笔记本 A5', '文件夹 3只', '便利贴 100页', '文件袋 5只',
    '积木益智套装', '拼图 500片', '遥控车 1台', '彩泥套装 12色', '绘画套装 24色',
    '跳绳 1根', '毛绒玩具 40CM', '泡泡机 1台', '桌面收纳盒', '错题打印机 A4']
};

/* ── EAN-13 ── */
export function ean13Check(s12) {
  let a = 0, b = 0;
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) a += +s12[i]; else b += +s12[i];
  }
  return String((10 - ((a + b * 3) % 10)) % 10);
}
export function makeBarcode(catIdx, seq) {
  const s = String(690000000000 + catIdx * 10000 + seq * 17 + 31).slice(0, 12);
  return s + ean13Check(s);
}

/* ── 稳定槽位：同一 catId 恒落在同一槽位（PRD §6.5）── */
export function catSlot(key, len) {
  if (!len) return 0;
  const s = String(key || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % len;
}

/** cat5 树缓存（按 pid） */
const _tree = new Map();
export function treeOf(pid) {
  if (_tree.has(pid)) return _tree.get(pid);
  const rows = cat5Nodes(pid);
  const map = new Map(rows.map((r) => [r.code, r]));
  const out = { map, byParent: new Map(), all: rows };
  for (const r of rows) {
    if (!out.byParent.has(r.parent)) out.byParent.set(r.parent, []);
    out.byParent.get(r.parent).push(r);
  }
  for (const v of out.byParent.values()) v.sort((a, b) => a.ord - b.ord);
  _tree.set(pid, out);
  return out;
}
export function treeFlush(pid) { _tree.delete(pid); }

/** 按测算中类求 cat5 路径（大类/中类固定，小类轮转） */
export function cat5Of(pid, catId, seq) {
  const link = CAT5_LINK[catId] || ['1', '11'];
  const t = treeOf(pid);
  const kids = (p) => t.byParent.get(p) || [];
  const depts = kids('').length ? kids('') : [t.map.get(link[0])].filter(Boolean);
  const d = link[0];
  const chus = kids(d);
  if (!chus.length) return { d, c: '', a: '', m: '', x: '' };
  const chu = t.map.get(link[1]) || chus[0];
  const das = kids(chu.code);
  if (!das.length) return { d, c: chu.code, a: '', m: '', x: '' };
  const da = das[catSlot(catId, das.length)];
  const ms = kids(da.code);
  if (!ms.length) return { d, c: chu.code, a: da.code, m: '', x: '' };
  const zhong = ms[catSlot(catId + '#m', ms.length)];
  const xs = kids(zhong.code);
  const x = xs.length ? xs[(seq || 0) % xs.length] : null;
  return { d, c: chu.code, a: da.code, m: zhong.code, x: x ? x.code : '' };
}

/** 最大余数法分配商品角色（避免小权重角色恒为 0，PRD §7.4） */
export function allocRoles(n) {
  const w = ROLES.map((r) => r.w);
  const tw = w.reduce((a, b) => a + b, 0);
  const ideal = w.map((x) => (n * x) / tw);
  const cnt = ideal.map((x) => Math.floor(x));
  let used = cnt.reduce((a, b) => a + b, 0);
  const rem = ideal.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f);
  let k = 0;
  while (used < n && rem.length) {
    cnt[rem[k % rem.length].i] += 1;
    used += 1; k += 1;
  }
  return cnt;
}

/** 生成某中类的样板单品 */
export function genForCat(pid, catIdx, perCat) {
  const catId = CAT_IDS[catIdx];
  const def = CAT_MAP[catId];
  const names = PRODUCTS[catId] || ['待补充单品'];
  const brands = BRANDS[catId] || ['通用'];
  const unit = CAT_UNIT[catId] || 'PC';
  const ref = REF_PRICE[catId] || 20;
  const counts = allocRoles(perCat);
  const roleList = [];
  counts.forEach((c, i) => { for (let j = 0; j < c; j++) roleList.push(ROLES[i].id); });

  const out = [];
  let seq = 0;
  for (let i = 0; i < perCat; i++) {
    const roleId = roleList[i] || 'main';
    const role = ROLES.find((r) => r.id === roleId);
    // 价格带轮转铺满 6 档
    const band = i % 6;
    const pk = PB_MIDR[band];
    let price = +(ref * pk).toFixed(2);
    if (price <= 0) price = 1;
    const gm = role.g / 100;
    const cost = +(price * (1 - gm)).toFixed(2);
    const baseName = names[i % names.length];
    const name = baseName + (i >= names.length ? '（同款第' + (Math.floor(i / names.length) + 1) + '组）' : '');
    const c5 = cat5Of(pid, catId, seq);
    out.push({
      seq: seq,
      cat: catId,
      brand: brands[(band + i) % brands.length],
      name: name,
      barcode: makeBarcode(catIdx, seq),
      spec: unit + '-' + baseName.split(' ').pop(),
      sb: SPEC[band],
      price: price,
      cost: cost,
      role: roleId,
      faces: role.f,
      qty: null,
      cat5: c5
    });
    seq += 1;
  }
  return out;
}

/** 生成整店样板：15 中类 × perCat */
export function genItems(pid, perCat) {
  const out = [];
  CAT_IDS.forEach((_, i) => {
    genForCat(pid, i, perCat).forEach((it, j) => {
      it.ord = i * 1000 + j;
      out.push(it);
    });
  });
  return out;
}
