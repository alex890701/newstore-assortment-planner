# 超市新开门店选品测算系统

> 由《超市新店选品测算模板 PRD v15》重构而来：**从 294KB 单文件 HTML → 后端服务 + SQLite 持久化 + 服务端计算引擎 + 9 个独立页面**。
> 已部署到飞牛 fnOS（Docker），端口 **3020**。

---

## 一、访问地址

| 项 | 值 |
|---|---|
| **公网地址** | **https://xp.palmscm.com**（HTTP 自动 301 跳 HTTPS） |
| 内网地址 | http://192.168.0.104:3020 |
| 容器（应用） | `xdxp`（`xdxp:1.0.0`，`restart: unless-stopped`，含 HEALTHCHECK） |
| 容器（穿透） | `xdxp-frpc`（`snowdreamtech/frpc:0.61.1`，host 网络，fnOS 开机自启） |
| 源码（fnOS） | `/vol1/1000/PATH/apps/xdxp`、`/vol1/1000/PATH/apps/xdxp-frpc` |
| 数据卷 | `/vol1/1000/PATH/data/xdxp/xdxp.db` |
| 本机开发 | `N:\AI\新店选品工具` → `node server/index.js`（默认 :3020） |

### 公网链路

```
浏览器 ──HTTPS──▶ 阿里云 8.148.212.41:443 (nginx)
                     │  反代 127.0.0.1:18901
                     ▼
                  frps :7000  ←──TLS 隧道──  fnOS xdxp-frpc
                                                  │
                                                  ▼
                                           xdxp 容器 :3020
```

- 隧道端口只绑 `127.0.0.1`（frps `proxyBindAddr`），公网不直接暴露 3020
- HTTPS 证书：Let's Encrypt ECC，acme.sh 自动续期（每天 4/10/16/22 点检查，续期后自动 `nginx -s reload`），证书落在 `/www/server/panel/vhost/cert/xp.palmscm.com`
- 一键重建穿透：`python tools/tunnel.py all`（可选单步 `frps` / `frpc` / `nginx` / `ssl`）

---

## 二、为什么不是单文件

| 原来（单文件 HTML） | 现在 |
|---|---|
| 一页塞 13 个模块，滚动条很长 | **9 个独立页面**，顶部常驻导航，每页聚焦一个决策环节 |
| 数据存 localStorage / 刷新即丢 | **SQLite 持久化**，多门店并存，异地也能打开同一份数据 |
| 全部计算在浏览器 | **服务端权威计算**（`/api/compute`），前后端口径唯一，可再加权限/审计 |
| CSV 导出靠浏览器 Blob | **服务端生成带 BOM 的 CSV**，Excel 直接打开不乱码 |

---

## 三、页面结构（9 页）

| # | 页面 | 内容 |
|---|---|---|
| 1 | **概览** `/index.html` | 6 张 KPI、预警区、品类占比环形图、日销×毛利双轴图、建议 Top6、下一步入口 |
| 2 | **商圈测算** `/biz.html` | STEP 01 参数（人口/渗透/客群/竞品/物业）、客流构成、日销敏感性矩阵、生鲜坪效指数 |
| 3 | **业态定位** `/format.html` | 6 套业态预设、15 中类占比微调、蝴蝶图、陈列匹配度、SKU TOP10、效率象限 |
| 4 | **陈列道具** `/fixture.html` | 47 项/12 课三级结构，节数/米数/占地/层板换算，规格下拉+自定义，同规格、按节数缩放 |
| 5 | **品类趋势** `/trend-cat.html` | 4 层分级滑块（A/B/C/D 不同范围与步进）、整组±1 档、导出 |
| 6 | **品牌趋势** `/trend-brand.html` | 从单品聚合品牌 → 4 层分级，跨品类共享系数、CR3/CR10 |
| 7 | **品类分析** `/category.html` | 4 部门卡 + 5 级分类树（懒加载）+ 17 列可编辑单品明细 + 级联筛选 + 分页 |
| 8 | **分类管理** `/catmanage.html` | 4/22/136/549/3904 分类树维护：新增/重命名/删除/搜索定位/导出/重置 |
| 9 | **结构与建议** `/analysis.html` | 角色结构、规格带、价格带（4 套目标预设）、品牌集中度、12 条决策建议 |

---

## 四、技术栈

- **后端**：Node.js 22 原生 `http`（零 npm 依赖）+ `node:sqlite`（内置，无需编译）
- **前端**：原生 ES Module + 手写 SVG 图表（无 CDN、无图表库）
- **部署**：Docker（基础镜像 `node:22-bookworm-slim`，fnOS 本地已有）

目录：

```
server/
  dict.js      全局数据字典（15 中类 / 6 业态 / 8 角色 / 47 道具 / 价格带 / 分层）—— 前端经 /api/dict 拉取，单一数据源
  db.js        SQLite 封装 + 5 级分类模板与克隆
  engine.js    服务端权威计算引擎（全部核心算法）
  seed.js      单品样板生成（EAN-13、最大余数法角色分配、cat5 固定槽位）
  index.js     HTTP 服务 + REST 路由 + 静态托管
  data/cat5.json  生成的标准 5 级分类（4615 节点）
public/        9 个页面 + css + js（core / shell / charts / page-*）
tools/         gen-cat5.js（分类生成）、smoke.js（API 冒烟 53 项）、uicheck.js（页面冒烟 9 页）、deploy.py（fnOS 部署）
```

---

## 五、核心算法实现要点（PRD 第六/七部分）

| 项 | 实现 |
|---|---|
| 客流 / 日销 | `(核心人口×渗透率 + 次级×0.3) × 商圈系数`；`日销 = 客流×转化率×客单价` |
| 陈列换算 | 节数 = 数量×长÷1200；米数 = 数量×长÷1000；占地 = 节数×单节占地×(宽÷基准宽)；层板 = 数量×层数×长×宽÷1e6 |
| 缩放 | **按节数贪心 ±1**（不按数量，否则 480 节会跑出 481） |
| 生鲜坪效指数 | 销售占比 ÷ 面积占比；≥1.30 驱动 / 1.05–1.30 均衡 / 0.80–1.05 配套 / <0.80 压缩 |
| 单品日销 | 金额口径，**不二次乘价**；`_day = 品类日销 × 角色权重/权重和 × 品牌趋势` |
| 角色分配 | **最大余数法**（round+slice 会让形象品/自有品牌/新品试销恒为 0） |
| cat5 聚集度 | 大类/中类按 `catSlot(catId)` 哈希固定，小类按序号轮转 → 同中类单品 100% 落在同一大类+中类 |
| 品牌聚合 | 用未叠加品牌趋势的 `_b` 估算，避免循环依赖 |
| 规格控件 | 命中预设走 `<select>`，选「自定义…」传强制标志位切 `<input>`（避免状态机死循环） |
| CSV | 服务端统一加 `\ufeff` BOM |

---

## 六、验收结果

```
node tools/smoke.js     # API + 引擎：53 项全通过
node tools/uicheck.js   # 9 个页面 + 交互抽查：9/9 通过（针对 http://192.168.0.104:3020）
```

关键数据校验：

- 分类数量 **4 / 22 / 136 / 549 / 3904**，分部核对与 PRD 完全一致
  （生鲜部 6/44/100/713、食品部 4/53/127/1158、非食品部 9/29/285/1915、耗材 3/10/37/118）
- 陈列道具 **47 项 / 12 课**，默认 510 节
- 默认单品 **225 条**（15 中类 × 15），单品聚集度 = 1
- 选中类可筛出**全部** 15 条（不是 1–2 条）
- 6 个 CSV 导出全部含 BOM

---

## 七、常用命令

```bash
# 本机开发
node server/index.js                 # http://127.0.0.1:3020
node tools/gen-cat5.js               # 重新生成 5 级分类
node tools/smoke.js                  # API 冒烟（XD_BASE 可指向线上）
node tools/uicheck.js                # 页面冒烟（需 playwright-core）

# 部署到 fnOS
python tools/deploy.py               # SFTP 上传 → 远程 docker build → compose up --force-recreate

# fnOS 上
docker logs -f xdxp
docker compose -f /vol1/1000/PATH/apps/xdxp/docker-compose.yml restart
```

---

## 八、已知说明

1. **Excel 源文件缺失**：PRD 提到用「临时借调品类结构表.xlsx」提取真实分类。源文件不在本机，已按 PRD 第九部分授权「按 4/22/136/549/3904 同等规模生成等价结构」生成，数量与层级完全对齐，名称按零售惯例构造。拿到 Excel 后只需替换 `server/data/cat5.json` 并重建库即可。
2. **陈列资源占比（BAY_MIX）**：PRD 只给了销售占比预设，但「陈列匹配度/蝴蝶图」需要一个独立的陈列占比向量，故新增 `BAY_MIX`（6 套业态 × 15 中类，合计 100%）。它是让偏离分析有意义的前提。
3. **商圈类型系数 / 单节综合占地**：PRD 未给数值，按行业经验设定并集中在 `dict.js`，可随时调。
4. 单品样板（225 条）是**结构先验**，用于跑通全链路；正式选品请在「品类分析」页补齐到规划 SKU 数。
