# 信息卡片库（P4 建设中 · 第一批 8 个）

信息输出的关键组件，放进排版库（`cards/layouts/`）的 `card` / `title` 槽位，常搭配贴纸和用户素材。全新编写，不含挖洞号卡片样式或 lieflat 代码。

## 文件
| 文件 | 作用 |
|---|---|
| `infocards.css` | 外壳、底色（tone）、各组件版式。只用场景变量和色板变量 |
| `infocards.js` | 组件库（浏览器里是全局 `IC`）：`IC.render` 出卡、`IC.fit` 自动缩字、`IC.animate` 逐帧动效、`IC.spec()` 组件说明 |
| `samples.json` | 样例内容（示意文案 + 风格样张贴纸），只给预览和自检用 |
| `../../tools/infocard_check.js` | 自检 + 预览：`node tools/infocard_check.js` |

页面引入顺序：`engine/tokens.css` → `engine/base.css` → `engine/motion/motion.css` → `cards/infocards/infocards.css` → `engine/motion/tokens.js` → `engine/motion/motion.js` → `cards/infocards/infocards.js`。

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
- **英文小标注**只有标题组的 `kicker` 一处（每屏最多一处）；其他组件不放小号英文。
- **动效**只用 `engine/motion/` 的预设，cue 的 `in / emph / out` 对应入场、强调、退场三个拍点（下表）。

## 组件（第一批）
| id | 名称 | 默认 tone | 尺寸 | 内容字段 | 动效拍点：入场 ／ 强调 ／ 退场 |
|---|---|---|---|---|---|
| `title` | 标题组 | none | 宽 ≥ 480；高 ≥ 128 | `title` 标题（\\n 换行，[[ ]] 色块）；`kicker` 英文小标注（可省；每屏最多一处）；`sub` 副标题一行（可省）；`bar` 标题下的朱橙短线（true / false）；`fs` 标题字号（默认 120，104–280） | 小标注 rise → 标题逐行 maskUp → 副标题 rise ／ [[ ]] 色块扫入 blockSweep；朱橙短线 underline ／ 整体 sink |
| `keyword` | 关键词卡 | card | M / L / XL（或不小于 528×288 的槽位） | `word` 关键词（2–6 字）；`exp` 一句白话解释（[[ ]] 色块）；`idx` 编号（可省，如 01）；`img` 贴纸路径（可省，放右侧） | 卡片 rise → 关键词 maskUp → 解释 rise → 贴纸 drop ／ 解释里的色块 blockSweep ／ sink |
| `define` | 定义卡 | card | L / XL（或不小于 720×384 的槽位） | `term` 名词；`def` 定义（1–3 行，[[ ]] 色块）；`eq` 连接词（默认「是」） | 左侧竖条 unfold → 名词 maskUp → 连接词、定义 rise ／ 定义里的色块 blockSweep ／ sink |
| `stat` | 数字卡 | card | S / M / L（或任意槽位，数字随高度放大） | `value` 数字（字符串，如 "12,000" "0.3" "403"）；`unit` 单位（可省）；`label` 这个数字是什么；`note` 补充一行（可省，示意数据要标） | 卡片 rise → 数字 countUp → 说明 rise ／ 色块 blockSweep ／ sink |
| `step` | 步骤卡 | card | S / M / L（或任意槽位；当前步 tone: hot） | `idx` 编号（01）；`name` 步骤名（2–6 字）；`desc` 一句说明（可省）；`img` 贴纸路径（可省，放右上） | 卡片 rise（多张按编号错开 0.12s）→ 贴纸 drop ／ 当前步：朱橙底 blockSweep（hot 卡） ／ sink |
| `chip` | 对比芯片 | card | M / L（两片并排，中间放「VS」标注）。判断那一片用 hot；aux（克莱因蓝）只用在 B 场或 S / M 小片——炭黑场里不放大块蓝色 | `name` 概念名（2–6 字）；`sub` 一句话（可省）；`img` 贴纸路径（可省，放在芯片上方探出） | 左片 rise，右片晚 0.15s rise；贴纸 drop ／ 判断那一片 hot 底 blockSweep ／ sink |
| `term` | 终端卡 | dark | L 放 3 行、XL 放 5 行（等宽 52px，L 一行约 21 字符、XL 约 34 字符；放不下就截短，不缩到 52px 以下） | `title` 窗口标题（可省，如 Response · 200）；`lines` 行数组；行首 "$ " 是命令提示符，行首 "# " 变淡；[[ ]] 标重点字段 | 窗口 rise → 逐行 rise（每行错开 0.08s） ／ 重点字段色块 blockSweep ／ sink |
| `chat` | AI 对话卡 | none | L / XL（2–4 条消息） | `msgs` 消息数组 [{who:"me"|"ai", text}]；AI 那条左侧带「AI」标 | 消息依次 rise（间隔 cue.gap，默认 0.7s） ／ 回答里的色块 blockSweep ／ sink |

## 检查：`node tools/infocard_check.js`
每个样例分别放进 A / B 两个场景，再用排版库搭 4 张演示关键帧，逐张检查：
- 放得下（`IC.fit`）；另有 3 个故意放不下的反例，确认检查没失灵。
- 有意义的文字 ≥ 52px，装饰字 ≥ 18px，英文小标注每张 ≤ 1 处。
- **按实际渲染结果**取字色和底色（含透明度、色块扫入色）：不是三条禁用组合，对比 ≥ 4.5，颜色都在色板里。
- 演示关键帧乱序渲染，同一时间点像素一致（逐帧确定性）。

预览输出到 `docs/previews/infocards/`：`sheet_A.jpg` / `sheet_B.jpg`（全部样例）、`demo_D1–D4.jpg`（排版 + 信息卡的关键帧，`_mid` 是入场途中）、`phone.jpg`（手机竖屏模拟）。

## 还没做（第二批，第一批风格确认后做）
引用卡 · 清单卡 · 标签 / 胶囊 · 截图框 · 手机屏幕 · 「AI 输出 vs 人工复核」卡 · 岗位 / JD 卡 · 技能树节点 · 风险卡 · 结论卡 · 档位卡 · 放大镜（圆形字段放大）。AE 端的同款组件在 P6 做（`ae/` 新组件库），本库只管网页端。

录屏相关的组件（窗口、推镜、标注、光标、打码、联动）单独放在 `libs/screencast/`，P4 第二部分。
