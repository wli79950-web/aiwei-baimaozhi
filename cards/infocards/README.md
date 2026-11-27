# 信息卡片库（P4 · 20 个 + 1.8 图解组件 8 个）

信息输出的关键组件，放进排版库（`cards/layouts/`）的 `card` / `title` 槽位，常搭配贴纸和用户素材。全新编写，不含挖洞号卡片样式或 lieflat 代码。

## 文件
| 文件 | 作用 |
|---|---|
| `infocards.css` | 外壳、底色（tone）、各组件版式。只用场景变量和色板变量 |
| `infocards.js` | 组件库（浏览器里是全局 `IC`）：`IC.render` 出卡、`IC.fit` 自动缩字、`IC.animate` 逐帧动效、`IC.spec()` 组件说明 |
| `samples.json` | 样例内容（示意文案 + 风格样张贴纸），只给预览和自检用 |
| `../../tools/infocard_check.js` | 自检 + 预览：`node tools/infocard_check.js` |

页面引入顺序：`engine/tokens.css` → `engine/base.css` → `engine/motion/motion.css` → `cards/infocards/infocards.css` → `engine/motion/tokens.js` → `engine/motion/motion.js` → `libs/icons/icons.js`（用到图标时）→ `cards/infocards/infocards.js`。

## 用法
```js
// rect 直接用排版槽位的 rect；也可以写 size: 'S' | 'M' | 'L' | 'XL'
const slot = layout.slots.find(s => s.id === 'c1');
const el = IC.render('keyword', { word: '提示词注入', exp: '让 AI [[听错话]]', img: 'assets/chip.png' }, { rect: slot.rect, tone: 'card' });
scene.appendChild(el);
IC.fit(el);                                   // 字体加载完再调；放不下会标 data-fit="overflow"
window.renderAt = t => IC.animate(el, t, { in: 0.3, emph: 1.0, out: 4.2 });   // 时间 t 的纯函数
```
- **行内标记**：`[[重点色块]]`（朱橙块 + 炭黑字，强调拍色块扫入）· `{{重点字}}`（场景重点色：A 朱橙 / B 克莱因蓝）· `` `等宽` `` · `\n` 换行。
- **底色 tone**：`card` 场景默认卡（A 炭灰 / B 卡片白）· `lit` 亮卡（卡片白）· `hot` 当前项 / 判断（朱橙 + 炭黑字）· `aux` 辅助（克莱因蓝 + 奶油白字）· `dark` 深色（终端）· `none` 无底。每种 tone 自带一套「重点字 / 色块」配色，保证不出现三条禁用组合。
- **炭黑场里不放大块蓝色**：`aux` 只用在 B 场，或 A 场里的 S / M 小片（用户偏好：蓝色像宝石一样小面积点缀）。
- **字号**：按槽位大小算初值，`IC.fit` 同比缩小直到放得下；有意义的文字下限 52px、标题 104px，到下限还放不下就报 overflow——**改短文案或换大一档的槽位，不许缩到 52 以下**。
- **圆角**：信息卡半径按短边 12% 自动算（28–64px），终端卡用窗口圆角 36px，色块 / 气泡 / 小标签按 em 比例；`shape: 'circle'` 出圆形（放大镜、圆盘）。数值在 `tokens/brand.json` → `shape`。
- **装饰小字**：标题组的 `kicker`、英文副标 `en`、截图框的占位等加 `data-role="decor"`，每张卡 ≤ 6 处、每屏 ≤ 16 处（1.8）；图解组件按一组元素算，只计入每屏上限。炭黑场的炭灰卡加细描边 + 深投影，编号 / 数字用奶油白（一屏一个朱橙焦点）。
- **动效**只用 `engine/motion/` 的预设，cue 的 `in / emph / out` 对应入场、强调、退场三个拍点（下表）。

## 组件（20 个）
| id | 名称 | 默认 tone | 尺寸 | 内容字段 | 动效拍点：入场 ／ 强调 ／ 退场 |
|---|---|---|---|---|---|
| `title` | 标题组 | none | 宽 ≥ 480；高 ≥ 128 | `title` 标题（\\n 换行，[[ ]] 色块）；`kicker` 英文小标注（可省；属于装饰小字）；`sub` 副标题一行（可省）；`bar` 标题下的朱橙短线（true / false）；`fs` 标题字号（默认 120，104–280） | 小标注 rise → 标题逐行 maskUp → 副标题 rise ／ [[ ]] 色块扫入 blockSweep；朱橙短线 underline ／ 整体 sink |
| `keyword` | 关键词卡 | card | M / L / XL（或不小于 528×288 的槽位） | `word` 关键词（2–6 字）；`exp` 一句白话解释（[[ ]] 色块）；`idx` 编号（可省，如 01）；`img` 贴纸路径（可省，放右侧） | 卡片 rise → 关键词 maskUp → 解释 rise → 贴纸 drop ／ 解释里的色块 blockSweep ／ sink |
| `define` | 定义卡 | card | L / XL（或不小于 720×384 的槽位） | `term` 名词；`def` 定义（1–3 行，[[ ]] 色块）；`eq` 连接词（默认「是」） | 左侧竖条 unfold → 名词 maskUp → 连接词、定义 rise ／ 定义里的色块 blockSweep ／ sink |
| `stat` | 数字卡 | card | S / M / L（或任意槽位，数字随高度放大） | `value` 数字（字符串，如 "12,000" "0.3" "403"）；`unit` 单位（可省）；`label` 这个数字是什么；`note` 补充一行（可省，示意数据要标） | 卡片 rise → 数字 countUp → 说明 rise ／ 色块 blockSweep ／ sink |
| `step` | 步骤卡 | card | S / M / L（或任意槽位；当前步 tone: hot） | `idx` 编号（01）；`name` 步骤名（2–6 字）；`desc` 一句说明（可省）；`img` 贴纸路径（可省，放右上） | 卡片 rise（多张按编号错开 0.12s）→ 贴纸 drop ／ 当前步：朱橙底 blockSweep（hot 卡） ／ sink |
| `chip` | 对比芯片 | card | M / L（两片并排，中间放「VS」标注）。判断那一片用 hot；aux（克莱因蓝）只用在 B 场或 S / M 小片——炭黑场里不放大块蓝色 | `name` 概念名（2–6 字）；`sub` 一句话（可省）；`img` 贴纸路径（可省，放在芯片上方探出） | 左片 rise，右片晚 0.15s rise；贴纸 drop ／ 判断那一片 hot 底 blockSweep ／ sink |
| `term` | 终端卡 | dark | L 放 3 行、XL 放 5 行（等宽 52px，L 一行约 21 字符、XL 约 34 字符；放不下就截短，不缩到 52px 以下） | `title` 窗口标题（可省，如 Response · 200）；`lines` 行数组；行首 "$ " 是命令提示符，行首 "# " 变淡；[[ ]] 标重点字段 | 窗口 rise → 逐行 rise（每行错开 0.08s） ／ 重点字段色块 blockSweep ／ sink |
| `chat` | AI 对话卡 | none | L / XL（2–4 条消息） | `msgs` 消息数组 [{who:"me"|"ai", text}]；AI 那条左侧带「AI」标 | 消息依次 rise（间隔 cue.gap，默认 0.7s） ／ 回答里的色块 blockSweep ／ sink |
| `quote` | 引用卡 | card | M / L / XL（L：原话 2 行 + 出处一行 ≤ 12 字） | `text` 引用的原话（1–3 行，[[ ]] 色块）；`src` 出处（可省；新闻公告类标「示意」） | 卡片 rise → 引号、原话、出处依次 rise ／ 原话里的色块 blockSweep ／ sink |
| `list` | 清单卡 | card | L / XL（3–6 项） | `title` 清单标题（可省）；`items` 项目数组：字符串，或 {text, state}；state = done 打勾 / now 当前项（整行朱橙）/ 省略为未做 | 卡片 rise → 标题 maskUp → 各项依次 rise（错开 0.08s） ／ 当前项的色块 blockSweep ／ sink |
| `tag` | 标签 / 胶囊 | lit | 高 72–120（排版里的 label 槽位） | `text` 标签文字（2–8 字）；`dot` 前面加一个重点色圆点（true / false） | rise（多个标签错开 0.1s） ／ — ／ sink |
| `shot` | 截图框 | dark | L / XL 或任意窗口槽位（核心录屏用 libs/screencast 的录屏窗口） | `img` 截图路径（用户素材，保留原色）；`title` 窗口标题（可省）；`mark` 框选区域 [x, y, w, h]（0–1，相对截图区，可省）；`note` 框选处的标注（可省） | 窗口 rise → 框选 drop → 标注 rise ／ — ／ sink |
| `phone` | 手机屏幕 | none | 竖条槽位，宽 : 高 ≈ 1 : 2（如 432×816） | `img` 屏幕截图（可省）；`notes` 通知数组 [{app, text}]（没有截图时用，2–3 条）；`time` 锁屏时间（可省，如 21:36） | 手机 rise → 通知依次 rise（错开 0.25s） ／ 通知里的色块 blockSweep ／ sink |
| `review` | AI 输出 vs 人工复核 | card | L / XL（2–4 行） | `rows` [{ai: "AI 的结论", human: "复核结果", ok: true | false}]；ok=false 时 AI 那句划掉；`head` 表头（默认 ["AI 说", "人工复核"]） | 卡片 rise → 表头 → 每行依次 rise（错开 0.25s） ／ — ／ sink |
| `jd` | 岗位 / JD 卡 | card | L 放 2 个短要求、XL 放 4–6 个（要求胶囊放不下会报溢出） | `role` 岗位名；`meta` 薪资 / 城市 / 年限一行（可省，示意数据要标）；`reqs` 要求数组；用 [[ ]] 包住整条的那项高亮 | 卡片 rise → 岗位名 maskUp → 要求胶囊依次 rise（错开 0.06s） ／ 高亮那项本来就是朱橙底 ／ sink |
| `skill` | 技能树节点 | card | S / M（节点之间的连线在配方里画） | `name` 技能名（2–6 字）；`lv` 编号 / 等级（可省）；`state` done 已会（打勾）/ now 正在学（朱橙）/ lock 未解锁（虚线框）；`pct` 进度 0–100（可省） | 节点 rise ／ 进度条从左画出 underline ／ sink |
| `risk` | 风险卡 | card | M / L | `level` 严重 / 高危 / 中危 / 低危；`title` 风险名；`impact` 影响一句话（可省）；`score` 分数（可省，如 9.8） | 卡片 rise → 顶部等级条 unfold → 风险名 maskUp → 影响 rise ／ 分数 countUp ／ sink |
| `verdict` | 结论卡 | lit | M / L / XL | `text` 结论（1–2 行，[[ ]] 色块）；`why` 理由一句（可省）；`mark` ✓ / ✗ / !（默认 ✓） | 卡片 rise → 圆形记号 drop → 结论 maskUp → 理由 rise ／ 结论里的色块 blockSweep ／ sink |
| `tier` | 档位卡 | card | 宽条：高 160–240，宽 ≥ 720（多档竖排，讲到的那档换 hot） | `level` 档名；`desc` 说明一句（可省）；`value` 数值（如 9.0–10）；`band` 左侧色带 hot / aux / lit / card（默认 hot）；`img` 贴纸（可省，压在色带上） | 票从下 rise（多张错开 0.12s）→ 贴纸 drop ／ 讲到的那张换 hot ／ sink |
| **1.8 新增字段** | — | — | — | `en` 英文副标（keyword / define / stat / step / chip / tag / verdict / tier）；`icon` 线性图标名（keyword / step / chip / tag，`libs/icons/`）；step 的 `step`（总数，编号写成「STEP 01 / 06」）；tier 的 `score`（0–10 的 CVSS 刻度条）；任意卡 `render(..., { tilt })` 倾斜 | — |
| `ring` | 圆环图 | none | 宽 ≥ 1000、高 ≥ 600（两侧各约 280px 放标签） | `center` 中心名词；`centerEn`；`items` [{name, en, pct, hot}]，3–6 类，hot = 本期那类（朱橙、外移） | 整体 rise → 标签 rise |
| `flow` | 徽章流转 | none | 宽条，高 ≥ 560 | `nodes` [{name, en, icon, hot}]（2–4 个）；`links` [{from, to, label, en, back}]（back 画在下沿虚线） | 节点 rise → 连线 → 胶囊 |
| `nest` | 嵌套归属 | none | 宽 ≥ 1000、高 ≥ 600 | `outer` {name, en}；`zones` [{name, en, session: {text, icon}, items: [{text, icon}]}]；`cross` {from, to: [区, 项], label}（越界箭头 + 边界打叉，朱橙） | 外框 → 区域 → 资源 → 越界箭头 |
| `wall` | 证据墙 | none | 宽 ≥ 1000、高 ≥ 600 | `shots` [{img, title}]（3–5 张，最后一张在最上面是焦点）；`mark` 框选；`note` 标注 | 截图依次 rise → 框选 → 标注 |
| `vtrack` | 竖向进度 | none | 竖条，宽 ≥ 400 | `items` 步骤名；`now` 当前序号；`en` 顶部装饰小字 | 自上而下 rise |
| `layers` | 分层结构 | none | 宽 ≥ 900、高 ≥ 600 | `layers` [{name, en, icon, hit, desc}]（2–4 层，hit 朱橙） | 层板自下而上 rise → 引线 → 标签 |
| `crowd` | 一群里的一个 | none | 任意 | `rows` / `cols`；`odd` 不一样的那个；`icon` / `oddIcon` | 方块依次 rise → 那一个变朱橙 |
| `zoom` | 局部放大 | dark（圆形） | 正方形 ≥ 320 | `icon`；`label`；`en` | 圆 rise → 图标 drop |
| `IC.callout` | 引线标注（挂在镜头上，不是卡片） | card / hot | — | `IC.callout(镜头, { from: [x, y], to: [x, y], label, en, hot })` | 引线画出 → 胶囊 rise |
| `lens` | 放大镜 | dark（圆形） | 正方形槽位（≥ 384×384），圆形 | `text` 放大的字段（等宽，[[ ]] 色块）；`label` 上方一句说明（可省）；`note` 下方一句（可省） | 圆 rise → 字段 maskUp ／ 字段色块 blockSweep ／ sink |

## 检查：`node tools/infocard_check.js`
每个样例分别放进 A 炭黑场（BG3 工作台）/ B 奶油白场（BG2）的真实画面里——**背景一律用背景板库**（`libs/backgrounds/backgrounds.js` 挂底板 + 动态层），再用排版库搭 10 张演示关键帧，逐张检查：
- 放得下（`IC.fit`）；另有 3 个故意放不下的反例，确认检查没失灵。
- 有意义的文字 ≥ 52px，装饰字 ≥ 18px，装饰小字每张 ≤ 6 处（图解组件不按单张算）。
- **按实际渲染结果**取字色和底色（含透明度、色块扫入色）：不是三条禁用组合，对比 ≥ 4.5，颜色都在色板里。
- 演示关键帧乱序渲染，同一时间点像素一致（逐帧确定性）。圆角边缘在运动中偶发几颗像素的抗锯齿差异（Chromium 自动决定哪些层走 GPU 合成；实测 6 颗像素、≤ 8 色阶，约 1/4 的运行出现一次），最大差 ≤ 8 色阶（3%，肉眼不可见）记为提醒，超过才算失败。运动中的文字偶尔也会这样（实测一次 1.2 万颗像素、最大 6 色阶）：Chromium 会按渲染历史决定哪些元素走 GPU 合成层，抗锯齿结果略有不同。

预览输出到 `docs/previews/infocards/`：`sheet_A_*.jpg` / `sheet_B_*.jpg`（全部样例，一页一个 1920×1080 画面，存成 1280×720）、`demo_D1–D10.jpg`（排版 + 背景板 + 信息卡的关键帧，`_mid` 是入场途中）、`phone_1/2.jpg`（手机竖屏模拟）。

| 演示 | 排版 | 场景 | 用到的信息卡 |
|---|---|---|---|
| D1 | L-K08 编号网格 | A | 标题组、步骤卡、数字卡 |
| D2 | L-K22 前后对照板 | B | 标题组、终端卡 |
| D3 | L-K10 对比双芯片 | A | 对比芯片 |
| D4 | L-K21 侧板关系链 | A | AI 对话卡 |
| D5 | L-K01 票据档位 | B | 标题组、档位卡 |
| D6 | L-K30 抓包字段放大 | A | 终端卡、放大镜、标签 |
| D7 | L-N03 手机屏幕 | A | 标题组、结论卡、手机屏幕 |
| D8 | L-K03 目标档案 | B | 标题组、清单卡、截图框、标签 |
| D9 | L-K24 嵌套归属（换成复核表） | A | 标题组、AI 输出 vs 人工复核、标签 |
| D10 | L-K08 编号网格 | B | 标题组、技能树节点、岗位 / JD 卡 |

## 之后
AE 端的同款组件在 P6 做（`ae/` 新组件库），本库只管网页端。风险卡目前只在样例页里，没有进演示关键帧。

录屏相关的组件（窗口、推镜、标注、光标、打码、联动）单独放在 `libs/screencast/`，P4 第二部分。
