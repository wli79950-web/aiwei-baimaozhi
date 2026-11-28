# AE 包工具（P6）

一句话：**网页和 AE 吃同一份镜头描述**。镜头运行时 `engine/shot.js` 把一个镜头（排版 + 信息卡 + 图片 + 文字 + 背景 + 入场时间）搭成网页画面，导出器把「全部入场完成」那一帧拆成 AE 图层：PNG 管形状和图片，AE 文字层管字，入场关键帧取自网页同一份时间表（`SHOT.plan` / `IC.plan`）、同一条缓动曲线（`BMAE`）。

```bash
cd ae && npm i && cd ..
```

```bash
python3 ae/build_ae.py ae/examples/demo
```

第一条只需跑一次（装模拟测试要用的 acorn）。演示包需要的录屏原片先用 `node tools/make_demo_recording.js` 生成。产物在 `<期目录>/build/<前缀>_AE重建包/` 和同名 `.zip`（`build/` 不进 git）。

## 流程（`build_ae.py`）
1. **字体覆盖表** `ae/lib/fontmap.py`：网页每个字实际用哪个字体渲染（npm 网页分片的 unicode-range ∩ 随包 .ttf 的字形）→ AE 里逐字设成同一个字体的 PostScript 名。
   `--patch engine/fonts_patch.css` 同时生成补字规则：MiSans 的网页分片缺一部分字（全角？～＝＋％、部分生僻字），用随包 .ttf 补上，网页和 AE 是同一个字形，不会落到系统字体。
2. **导出** `ae/export_shots.js`（Playwright）：每个镜头挂出来 → 取 settled 那一帧 → `ae/lib/page_aex.js` 在页面里拆：
   - unit（镜头运行时登记的每个画面元素）→ node（unit 本身 + 卡片里每个单独入场的部件 `data-role`）；
   - 每个 node 抠一张透明 PNG（2 倍像素，画面外扩 240px，投影不截断；字抠掉、子部件藏掉）+ 若干文字层描述（文本、对齐、第一行基线、行距、逐段字体 / 字号 / 颜色 / 字距）；
   - 倾斜先去掉再量，AE 里由预合成图层绕同一个中心转回去；
   - 背景：库里的背景板 PNG 原样，动态层 SVG 栅格化成 PNG（SVG 原件一起附上）；
   - 录屏：窗口边框 PNG + 录屏数据（原片、时间重映射、推镜、打码、标注、标签），数学和网页 `SC.keyframes` / `SC.camAt` 同一套；
   - **还原对比**：只用导出的图层在浏览器里拼回 settled 那一帧（文字用 canvas 从基线画，和 AE 点文字同一个定位方式），和原画面逐像素比，出三联图。
3. **裁 PNG**、拼 `SPEC`、图层命名（同一个合成里不重名，表达式按名字找主层）。
4. **硬检查**（不过就拒绝打包）：每个镜头有单独的背景板；没有整帧大小的内容图层；文字 / 图片不压到顶部 76px 章节进度条区；缺字形（字不在随包字体里）。
5. **拼脚本**：`SPEC` + `motion_data.jsx` + `motion_ae.jsx`（BMAE）+ `ae_lib.jsx` 拼成一个 `.jsx`（不用 `#include`，单文件）。
6. **收素材、字体**（`fonts/` 全部随包）、README（`README_AE包模板.txt`）、还原对比图。
7. **模拟 AE 测试** `ae/mock_ae_test.js`，报告写进包里的 `模拟测试报告.txt`。
8. 打 zip。

## 文件
| 文件 | 作用 |
|---|---|
| `build_ae.py` | 一键打包（上面的流程）；`AE_SKIP_EXPORT=1` 复用上次的导出，只重跑打包步骤 |
| `export_shots.js` | 导出：镜头 → 图层描述 + PNG + 还原对比 |
| `lib/page_aex.js` | 注入镜头页面的拆分逻辑（node、文字、字体回退、抠图隔离） |
| `lib/fontmap.py` | 字体覆盖表 + MiSans 补字规则 |
| `ae_lib.jsx` | AE 运行库（ES3）：背景、PNG 层、文字层（CharacterRange 逐段字体）、父子 + 透明度跟随、部件预合成、录屏预合成 |
| `motion_ae.jsx` / `motion_data.jsx` | BMAE 动效库 / 数值（`tokens/motion.json` 生成） |
| `mock_ae_test.js` | 模拟 AE 对象模型测试（用户 AE 24.6.2 的探测报告 + 官方文档副本） |
| `README_AE包模板.txt` | 包里的 README |
| `examples/demo/` | 演示期：5 个配方镜头 + 1 个录屏镜头 |
| `probe/AE_probe_24.6.2.txt` | 用户 AE 24.6.2 的接口探测报告，核对属性名以它为准 |
| `aedocs/` | 官方脚本文档副本（不进 git：`git clone https://github.com/docsforadobe/after-effects-scripting-guide.git ae/aedocs`） |

## AE 里的图层结构
- 镜头合成（1920×1080，60fps）从下往上：`背景板_BG3` → `背景动态_点阵 / 十字标 / 焦点光晕 / 焦点刻度环 / 焦点刻度`（刻度每秒转 4°）→ 画面元素 → 录屏窗口 → 字幕。
- 画面元素：单部件的（贴纸、文字标签、装饰小字）直接放在镜头合成里；多部件的（信息卡、图解、引线标注）或倾斜的放进「部件预合成」，预合成图层的锚点 = 倾斜中心。
- 部件：PNG 是主层，文字层挂在主层下面（父子关系），透明度用表达式跟主层；子部件的主层挂在父部件的主层下面。父子关系全部挂好之后才加关键帧。
- 入场：`rise` / `drop` / `unfold` / `underline` / `blockSweep` 直接调 BMAE；`maskUp` 用一个矩形形状层做轨道遮罩（遮罩层自动隐藏）；`countUp` 用滑块控制 + 源文本表达式（只对纯整数，千分位保留）。统一退场 `out` → `BMAE.sink`。
- 录屏：`录屏窗口_边框`（PNG）+ `录屏窗口_画面（预合成）`（圆角蒙版）。预合成里 `录屏原片` 锚点在左上角，缩放 / X / Y 位置关键帧 = 推镜；视频原片开时间重映射；`打码_N（实色块）`、`标注_N_框 / 下划线` 挂在原片层下面跟着推镜动；聚光是压暗层 + 反转蒙版；标签 = PNG + 文字层。

## 没有在 AE 里重建的（打包时写进 README 的「需要留意」）
- 录屏的**光标、点击涟漪、标签引线、联动引线**；**模糊打码**做成实色块（遮死，不透原文）。
- `tabular-nums`（等宽数字）在 AE 里是普通数字，数字串宽度会差几个像素。
- 卡片部件之间若 DOM 里文字被别的元素压住，AE 里文字层一律在 PNG 层上面。

## 检查到什么程度（如实说）
- **没有在真 AE 里运行过**。模拟测试用用户 AE 24.6.2 的探测报告做对象模型：每次添加属性后旧引用失效、值类型 / 数组长度 / 颜色范围、关键帧时间、缓动参数个数和范围、表达式逐条在 5 个时间点求值、父层已有关键帧时挂子层会报错、位置拆维以后不能写整体位置、开启时间重映射自带首尾关键帧、ES3 语法、matchName 都在官方文档里。
- 探测报告没覆盖、按官方文档补的：修剪路径（`ADBE Vector Filter - Trim`）、滑块控制（`ADBE Slider Control`）、`TextDocument.fauxBold` 写入（AE 24.0+）、`characterRange`（AE 24.3+）、`setTrackMatte`（AE 23.0+）、蒙版 `inverted`。第一次在真 AE 里跑时重点看这几处。
- 还原对比只验证 settled 那一帧的位置和样子；入场过程的曲线由 `node tools/test_motion.js` 验证（BMAE 和网页 BM 同一条曲线）。
