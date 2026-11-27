# 更新记录

## 1.10.0 · 2026-11-27 · 视觉系统 1.5：高质感版、只出横屏、装饰小字层、BG3 工作台
- 用户确认：**本仓库暂时只出横屏**；**目前都用高质感版**；**装饰小字可以有**；「工作台」背景收进背景板库作 **BG3**。
- 背景板库新增 **BG3 炭黑·工作台**（A 场默认，BG1 改为备用）：底板 `BG3_bench_plate.png` + 点阵 `BG3_dots.svg` + 十字标 `BG3_marks.svg`；焦点组件 `BG3_focus_glow / rings / ticks.svg`（1000×1000），`BGLIB.mount(..., 'BG3', base, { focus: [x, y, scale] })` 放在主体后面，刻度每秒转 4°。参数在 `brand.json` → `background.bench`，`tools/make_backgrounds.js` 生成。
- 动效：`sweepSpin` 加可选参数 `deg_per_s`（网页 `BM` 和 AE `BMAE` 同步），焦点刻度用 4°/s；默认值不变，动效测试 102 项通过。
- 装饰小字层：`brand.json` → `type.decor`（替代 `type.kicker`）：每屏 ≤ 8 处、每张卡 ≤ 3 处，18–24px，不透明度 0.35–0.6；`base.css` 新增 `.mic`。`layout_lint`、`pagecheck`（信息卡 / 录屏共用）按新上限检查，自检改成「9 处装饰小字应报错」。
- 只出横屏：`brand.json` → `spec` 去掉 `portrait`，`layout_lint` 只接受 1920×1080 画布（自检加「竖屏应报错」）。
- 信息卡高质感化：炭黑场的炭灰卡 / 卡片白卡加细描边 + 深投影；炭灰卡里的编号、数字改奶油白（一屏一个朱橙焦点）。演示关键帧去掉标题色块、D6 的 admin 胶囊改炭灰，重出全部信息卡 / 录屏预览（背景改 BG3）。
- 规则：`CLAUDE.md`、`STYLE.md`、`AE包规范.md`、`制作流程.md`、`素材与视觉系统.md`、`用户要求汇总.md`、各库 README 同步。
- 未完成：演示关键帧里的贴纸仍是停用的陶瓷样张（等 P5 出写实样张后替换）；`docs/previews/demo_F1–F4` 是 1.0 时期的演示帧，仍用 BG1。

## 1.9.0 · 2026-11-27 · 视觉系统 1.4：图片风格改为写实为核心、动漫为辅
- 用户认为粘土 / 陶瓷元素拉低高级感。出了粘土 / 写实 / 动漫 × 芯片、锁、服务器的风格对比（`docs/previews/explore/styles_sheet.jpg`、`styles_D1v.jpg`、`styles_D1h.jpg`）后，用户确定：**写实为核心，动漫为辅**。
- `cards/images/styles.json`：新增 `real` 写实产品摄影（核心，名词实物化）和 `anime` 动漫光效（辅助，高光时刻，一屏最多一个）；`sticker` 陶瓷贴纸、`toy` 设计师玩具、`iso` 等距微缩标记为停用（同为粘土 / 陶瓷质感），保留条目和停用原因。
- 贴纸不再限制奶油白 / 克莱因蓝 / 朱橙三色，改为「统一调色」：新增 `tools/grade.py`（参数在 `brand.json` → `imagery.grade`），朱橙附近色相保留饱和度、其他色相压到一半，纯黑 → 炭黑、纯白 → 奶油白；用户素材仍保留原色。
- `tokens/brand.json` 1.4.0：删除 `sticker`（三色陶瓷规则），`imagery` 新增 `core` / `aux` / `retired` / `grade`。`gen_tokens.py`、`contrast_check.py`（17 项）通过。
- `tools/genimg.py`：默认拒绝停用的 preset（加 `--allow-retired` 才放行），说明里改成 real / anime 优先，并写明生成后抠图 + 统一调色。
- 写实的暗色物件放在炭黑场会被吃掉轮廓：`real` 提示词固定加暖色轮廓光，挑图时检查。
- 同期还出了「质感版」关键帧探索（`docs/previews/explore/compare_D1.jpg`、`compare_D6.jpg`、`phone_texture.jpg`），方向待用户拍板，未进视觉系统。
- 同步更新 `STYLE.md`、`cards/images/README.md`、`cards/README.md`、`README.md`（P5 进行中）、`SETUP.md`、`docs/rules/`。

## 1.8.0 · 2026-11-27 · P4 录屏组件（网页端）
- 新增 `libs/screencast/screencast.js` + `screencast.css`（全局 `SC`）：窗口、原片帧序列 + 时间重映射（慢放 / 定格）、推镜（聚焦区域留 10% 边距、原片不露边、全景顶对齐）、标注（框 / 下划线 / 聚光 + 标签 + 引线，屏幕坐标绘制，推镜时线宽字号不变）、放大光标 + 点击涟漪、打码（模糊 / 斜纹块）、联动引线到信息卡。全部是时间的函数，结构和 AE「窗口边框层 + 录屏预合成」一一对应，`SC.keyframes` 输出给 P6。
- 打码不用 `backdrop-filter`：实测推镜放大后会失效、露出原文；改成同一帧原片的模糊副本裁到该区域。自检量打码区边缘能量（< 同尺寸清晰文字的 25%，实测 3–12%），关掉模糊时这项会失败。
- 新增 `tools/make_demo_recording.js`（示意录屏，标「教学示例」，输出到 out/）和 `tools/screencast_check.js`（纯数学 43 项 + 3 个演示镜头 + 打码可读性 + 逐帧确定性；`--video` 渲染 6 秒带运动模糊的样片 `docs/previews/screencast/screencast_demo.mp4`）。
- 页面颜色检查抽成 `tools/lib/pagecheck.js`，信息卡和录屏标签共用；正在入场 / 退场的元素不查颜色。
- 逐帧确定性的容差统一为「最大差 ≤ 8 色阶记提醒」（运动中的文字偶发 Chromium 合成层抖动，实测最大 6 色阶）。
- 清单卡：字号同时按卡片宽度限制，窄卡里不再把短项目挤成两行。

## 1.7.0 · 2026-11-27 · P4 信息卡库（第二批，共 20 个）+ 背景板挂载器
- 新增 12 个信息卡：引用卡、清单卡、标签 / 胶囊、截图框、手机屏幕、AI 输出 vs 人工复核、岗位 / JD 卡、技能树节点、风险卡、结论卡、档位卡、放大镜（圆形）。清单打勾 / 箭头用 SVG 图标画；技能树节点按 state 自动选底色（now = 朱橙、lock = 虚线框新底色 `ghost`）。
- 用户要求：信息卡演示必须用白帽志固定的背景板。新增 `libs/backgrounds/backgrounds.js`（`BGLIB.mount` 挂底板 PNG + 雷达线 + 扫描扇区并加场景类，`BGLIB.animate` 让扇区按 `sweepSpin` 旋转）。演示关键帧和样例页全部改用它；之前只用了 CSS 渐变 + 雷达线，缺底板和扫描扇区。
- 样例页改成一页一个 1920×1080 真实画面（BG1 / BG2），共 44 个样例；存成 1280×720 控制体积。演示关键帧增加到 10 张（D5–D10 覆盖新组件），手机竖屏模拟分两张。
- 自检：色块扫入的底色按 `--sweep` 取；L 号卡的容量写进组件说明（引用卡出处 ≤ 12 字、JD 卡 L 放 2 个要求），放不下照样报错。

## 1.6.0 · 2026-11-27 · 视觉系统 1.3：苹果式圆角
- 用户要求信息卡加苹果式圆角。`tokens/brand.json` 新增 `shape`（v1.3.0），`gen_tokens.py` 生成 `--r-*` 变量：信息卡半径 = 短边 × 12%（28–64px），窗口 / 终端 36px，小块 20px，字幕底板 18px，行内色块 0.22em，对话气泡 0.72em。
- 应用到：信息卡（`infocards.css` / `infocards.js` 按槽位算半径）、`base.css` 的 `.card` `.blk` `.aux` 和字幕底板 `.sub`，全片统一。贴纸、录屏原片、背景板不加圆角。
- 试过真正的连续曲率（CSS `corner-shape: squircle`）：Chromium 逐帧渲染不稳定（同一时间点乱序渲染差 6–8 个色阶，4 次里有 3 次不一致），换成圆弧圆角后 4 次全部一致；AE 圆角矩形本来就是圆弧，网页和 AE 能对上。所以 `shape.corner = round`。
- 圆弧圆角在运动中偶发几颗像素的抗锯齿差异（实测 6 颗、≤ 8 色阶，肉眼不可见）：`infocard_check.js` 改为逐像素比，≤ 64 颗且 ≤ 32 色阶记提醒，超过算失败。
- 终端卡用窗口圆角 36px（比信息卡小一档）。
- 对比度 17 项、动效 104 项、排版 89 项、信息卡全部检查仍然通过；预览图（含 1.0 演示帧 F1–F4）已重出。

## 1.5.0 · 2026-11-27 · P4 信息卡库（第一批）
- 新增信息卡库 `cards/infocards/`（全新编写）：`infocards.css` + `infocards.js`（`IC.render` / `IC.fit` / `IC.animate` / `IC.spec`）。第一批 8 个：标题组、关键词卡、定义卡、数字卡、步骤卡、对比芯片、终端卡、AI 对话卡。
- 6 种底色（card / lit / hot / aux / dark / none），每种自带重点字和色块配色；行内标记 `[[色块]]` `{{重点字}}` `` `等宽` ``。
- 字号按槽位算、自动缩到放得下，下限 52px（标题 104）；动效只用 P2 预设，三个拍点 in / emph / out。
- 新增 `tools/infocard_check.js`：A/B 两场景逐张检查放得下、字号、实际渲染的字色 / 底色（禁用组合、对比 ≥ 4.5、色板内）、逐帧确定性，含反例；输出样例板、4 张演示关键帧（L-K08 / L-K22 / L-K10 / L-K21）和手机竖屏模拟。
- `engine/base.css`：`.bg-layer` 加 `transform: translateZ(0)`。背景线稿层上面的卡片动起来时，会按渲染历史重新栅格化，同一时间点乱序渲染差 1–8 个色阶；固定成独立合成层后一致（`test_motion` 104 项仍全部通过）。
- 对比芯片默认 tone 为 card；克莱因蓝大色块只用在 B 场或小片（用户偏好：炭黑场里不放大块蓝色）。

## 1.4.0 · 2026-11-27 · P3 排版库
- 挖洞号 49 张卡的构图全部迁成白帽志排版：`cards/layouts/L-K01…L-K30`、`L-N01…L-N25`（N12 拆成口播态 `L-N12A` / 换底态 `L-N12B`），共 50 个，全部通过 `layout_lint`，零提醒。只借构图，没有带挖洞号的样式、素材、样例文案和角色。
- 迁移做法：删掉 IP 角标区、HUD、人物小窗；标题移到左上或左侧中线；主体 ≥ 45%、内容铺开 ≥ 70%；带字槽位底边停在 y = 872；原 A-roll 人物位改成大素材位 `person_optional`；原「品牌固定角色」改成本期现生成。
- 线框预览 `cards/layouts/previews/*.jpg` + 总览板 `docs/previews/layouts/sheet.jpg`。
- `layout_lint`：新增 `group`（一组元素的范围，可整体当主体）、`shape: circle`；信息卡默认带底；`custom` 尺寸改为 8 的倍数（1792 宽不能被 48 整除）；`over` 指向后面的槽位时提醒；内容利用率按外接范围算（用户确认）。自检扩到 89 项。

## 1.3.1 · 2026-11-27 · P3 排版库（第一步：工具）
- 新增 `tools/layout_lint.py`：边界 / 出血、字幕安全区（底部居中 1560×84，距底 104）、字号（标题 ≥ 104、文字 ≥ 52）、一屏一个标题、英文小标注 ≤ 1、尺寸档、录屏宽度、人物小窗、配色禁用组合与对比度、色块面积、利用率（主体并集 ≥ 45%，内容外接范围 ≥ 70%）。数值全部从 `brand.json` 读。
- 新增 `tools/layout_preview.js`：线框预览（A 炭黑场配色，字按真实字号画）+ 总览板。
- 新增 `tools/test_layouts.py` 自检（33 项）和测试夹具 `tools/fixtures/layouts/L-T01.json`。
- `cards/layouts/README.md`：写清 `layout.json` 全部字段、检查规则、预览图例；新增槽位类型 `screen`（录屏窗口）。
- 49 个构图在 1.4.0 迁入。

## 1.3.0 · 2026-11-27 · P2 动效库
- 新增动效参数 `tokens/motion.json`（唯一数值来源）：6 条贝塞尔缓动、5 档时长、17 个预设参数。`tools/gen_tokens.py` 同时生成 `engine/motion/tokens.js`（网页）和 `ae/motion_data.jsx`（AE），并拦截 AE 无法精确还原的曲线。
- 新增网页动效库 `engine/motion/motion.js` + `motion.css`（全新编写，不含 lieflat 代码）：入场 rise / maskUp / drop / unfold，强调 underline / blockSweep / countUp / ringDraw，退场 sink / maskDown，转场 flash / fieldWipe / radarSweep / stickerPush，常驻与镜头 sweepSpin / slowPush / hold。
- 新增 AE 动效库 `ae/motion_ae.jsx`（ES3）：每个预设都有 AE 写法；贝塞尔曲线精确换算成关键帧速度 + 影响。
- 新增自动测试 `tools/test_motion.js`（104 项）：曲线、预设、网页↔AE 一致（最大偏差约 2×10⁻⁵）、ES3 语法、演示页逐帧确定性。
- 新增 5 秒样片 `docs/previews/motion/motion_demo.mp4`（源文件 `docs/previews/src/motion_demo.html`）和关键帧对照。
- `engine/render_mb.js`：渲染前先解码全部图片，保证逐帧确定。
- 踩坑记录：`will-change` 会让逐帧结果依赖渲染历史，已写进动效库说明。

## 1.2.0 · 2026-11-26 · 知识卡片板块、SC02
- 知识卡片板块 `cards/`：排版 `cards/layouts/`、信息卡 `cards/infocards/`、图片 `cards/images/`（原 `libs/imagery` + `libs/stickers`）、配方 `cards/recipes/` 放在同一个文件夹；新增 `cards/README.md` 说明三者关系和与挖洞号卡片的对应。
- 新增图片风格 **SC02 · 蓝调漫画**（`sc02-line` 蓝线漫画、`sc02-duo` 黑白漫画 → 蓝调双色），样张预览 `docs/previews/styles/SC02.jpg`；风格支持 `variants`，preset 写成 `风格-做法`。
- 陶瓷贴纸后缀从 `brand.json` 移入 `cards/images/styles.json`；`tools/genimg.py` 全部风格从 `styles.json` 读。
- 修复：被误清空的贴纸说明从历史找回，合并进 `cards/images/README.md`。

## 1.1.3 · 2026-11-26 · 图片风格提示词库、期号 BM、MiSans 入库
- 图片素材库改为风格提示词库 `libs/imagery/styles.json`：`toy` 设计师玩具角色、`tone` 双色调摄影、`iso` 等距微缩场景、`device` 手持设备实拍、`flat` 几何平面插画；不定固定角色，图片每期现生成。`tools/genimg.py` 的 preset 直接读这些风格。`brand.json` → `imagery.styles_file`。
- 期号前缀 `BM`（`BM01`），`EPISODES.md`、归档标签示例同步。
- MiSans Medium / Bold / Heavy TTF 放进 `fonts/`（用户确认商用授权，附 `MiSans_授权说明.md`）；`brand.json` → `font.cn.bundled = true`。

## 1.1.2 · 2026-11-26 · 分支清理
- PR #1 合并后删除分支 `ref/ae-from-aiwei-vs2`、`candidate/imagery`；其内容保存在提交 `adbbc35`（`main` 历史中）。文档里的分支名改为指向该提交，并附取回命令。

## 1.1.1 · 2026-11-26 · 仓库结构
- 不设品牌素材层：删除 `libs/stickers/brand/`、`libs/imagery/wh/` 和「品牌贴纸可跨期」的规则；图片素材每期由用户提供或现生成。`brand.json` 去掉 `sticker.brand`。
- `main` 只保留最新两期工程，更早的打标签 `ep/<期号>` 归档（`制作流程.md`、`EPISODES.md`）。
- 挖洞号 AE 参考实现移到分支 `ref/ae-from-aiwei-vs2`；图片素材库候选样张、演示帧 F5 / F6、图片素材库预览板移到分支 `candidate/imagery`。演示页回到 F1–F4。

## 1.1.0 · 2026-11-26 · 空间利用率 + 图片素材库 + 录屏组件
- 核心目标写进 `CLAUDE.md` / `STYLE.md`：知识可视化（图片 + 动效 + 录屏的综合动画）。
- 版式：页边距 96 → 64px（左右）/ 56px（上下），允许出血；明确不做人物小窗；新增利用率底线（主体 ≥ 45%，内容 ≥ 70%，录屏宽 85–94%）。`brand.json` → `layout.margin_y / bleed / pip / utilization`。
- 新增图片素材库 `libs/imagery/`：WH 白帽角色线 + TONE 双色调摄影线（候选样张 5 张 + 黑白原图 2 张，待用户确认）。`brand.json` → `imagery`。
- 新增 `tools/duotone.py`（渐变映射：炭黑 → 朱橙 / 克莱因蓝 → 奶油白）。
- 新增录屏组件规划 `libs/screencast/`。
- 排版库：A-roll 人物位默认改为素材位（`person_optional`）。
- 演示页加 F5（双色调章节卡）、F6（录屏 + 标注 + 白帽角色），原有 4 帧改为 64px 页边距；新增图片素材库预览板。
- 主页背景板：用户选方案 A（自行按新配色修改），视频不引入酒红 + 金。

## 1.0.0 · 2026-11-26 · P1 骨架
- 建仓：目录结构、`CLAUDE.md`、`STYLE.md` 1.0、`docs/rules/`（4 份细则）、决策记录。
- 视觉系统定稿：
  - 配色：炭黑 `#16130F` 主场 + 朱橙 `#FF5A1F` 核心 + 克莱因蓝 `#002FA7` 辅助；奶油白 `#F5EEDF`、炭灰 `#2B2520`、卡片白 `#FFFBF3`。
  - 两种场景（A 炭黑场 / B 奶油白场）+ 闪切；三条禁用组合。
  - 字体：得意黑、MiSans、Archivo Black、IBM Plex Mono。
  - 简约版式：不留角标位，不做 HUD / 时间码 / 编号 / 进度条。
- `tokens/brand.json` 作为唯一数值来源；`tools/gen_tokens.py` 生成 `engine/tokens.css`；`tools/contrast_check.py` 检查 17 项配色组合（全部通过）。
- 背景板库：BG1 炭黑·雷达、BG2 奶油白·纸面、FX 朱橙 / 蓝闪切（底板 PNG + 动态层 SVG），`tools/make_backgrounds.js` 生成。
- 字体文件：得意黑、Archivo Black（由可变字体固定为 900）、IBM Plex Mono Medium / SemiBold，附 OFL 许可。MiSans 待确认授权，暂不随仓库分发。
- 迁移自 `aiwei-vs2` 的自有工具：渲染（`render.js`、`render_mb.js`、`render_alpha.js`、`mb_encode.sh`、`boardshot.js`、`shots_v2.js`）、音效合成（`sfx.py`）、语音识别、口播抠像；`genimg.py` 改成白帽志贴纸预设；`cutout.py` 加了 `--fill-holes` 和残影清理。AE 工具放在 `ae/_from_aiwei-vs2/`，待 P6 改造。
- 贴纸样张 12 张（`libs/stickers/samples/`，金色点缀版，不进正片）。
- 预览：配色、背景板、贴纸预览板，4 张演示关键帧，手机竖屏模拟（`tools/build_previews.js` 生成）。
