# 动效库（P2 · 全新编写）

**不含 lieflat code video 的任何代码或派生代码**（PolyForm 非商业许可）。缓动、贝塞尔求解都是按公式自己写的。样片：`docs/previews/motion/motion_demo.mp4`。

## 原则
- **纯函数**：每个预设都是时间 t（秒）的函数，同一个 t 永远得到同一画面，可以逐帧、乱序、多进程渲染（`tools/test_motion.js` 会验证像素级一致）。
- **网页和 AE 同一组数值**：全部参数在 `tokens/motion.json`；缓动一律是三次贝塞尔曲线，AE 端换算成关键帧的「速度 + 影响」，一维属性上和网页是**同一条曲线**（测试里最大偏差约 2×10⁻⁵）。
- **性格：精准、克制**。快进慢停的减速曲线，0.4–0.7 秒；贴纸落定回弹 2%（上限 3%）；不做手持晃动，镜头静止或极慢推（每秒 0.4%）。

## 文件
| 文件 | 作用 |
|---|---|
| `tokens/motion.json` | **唯一数值来源**：帧率、缓动曲线、时长档、每个预设的参数 |
| `engine/motion/motion.js` | 网页端动效库（浏览器里是全局 `BM`，Node 里 `require` 后 `BM.init(json)`） |
| `engine/motion/motion.css` | 配套样式：遮罩行 `.bm-mask`、色块扫入 `.bm-sweep`、镜头 `.bm-camera`、旋转中心 `.bm-spin` |
| `engine/motion/tokens.js` | 自动生成（`python3 tools/gen_tokens.py`），浏览器里注入 `window.BM_MOTION` |
| `ae/motion_ae.jsx` | AE 端动效库（ES3，全局 `BMAE`），`#include "motion_data.jsx"` |
| `ae/motion_data.jsx` | 自动生成，AE 端的 `BM_MOTION` 数值 |
| `tools/test_motion.js` | 自动测试：曲线、预设、网页↔AE 一致、ES3 语法、演示页逐帧确定性 |
| `docs/previews/src/motion_demo.html` | 5 秒样片的源文件（用了大部分预设） |

页面引入顺序：`engine/tokens.css` → `engine/base.css` → `engine/motion/motion.css` → `engine/motion/tokens.js` → `engine/motion/motion.js`。

## 缓动
| 名称 | 贝塞尔控制点 | 用途 |
|---|---|---|
| `out` | 0.22, 1, 0.36, 1 | 默认入场：快进慢停 |
| `outExpo` | 0.16, 1, 0.3, 1 | 更利落：大字、色块扫入 |
| `inOut` | 0.65, 0, 0.35, 1 | 画线、转场 |
| `in` | 0.32, 0, 0.67, 0 | 退场、冲镜 |
| `settle` | 0.34, 1.25, 0.64, 1 | 贴纸落定，过冲 2.0% |
| `linear` | 0, 0, 1, 1 | 扇区旋转、慢推 |

新增缓动的约束：x1 在 (0, 1]、x2 在 [0, 1)，否则 AE 关键帧缓动无法精确还原（`gen_tokens.py` 会拦截）。

## 预设
网页：`BM.预设(t, 开始时间, …)` 返回一个状态，`BM.set(元素, 状态1, 状态2…)` 合并后写进元素。AE：`BMAE.预设(图层, 开始时间, …)` 直接加关键帧 / 效果。

| 预设 | 类 | 默认 | 网页写法 | AE 写法 |
|---|---|---|---|---|
| `rise` | 入场 | 0.55s · out · 上移 48px | 位移 + 不透明度 | 位置 Y（拆分维度）+ 不透明度 |
| `maskUp` | 入场 | 0.55s · outExpo · 每行错开 0.08s | `.bm-mask` 里那一层从 120% 升到 0 | 行图层位置 Y + 形状层作 Alpha 轨道遮罩 |
| `drop` | 入场 | 0.7s · settle · 从上方 90px 落下，缩放 0.94→1 | 位移 + 缩放 + 0.18s 线性淡入 | 位置 Y + 缩放 + 不透明度（线性） |
| `unfold` | 入场 | 0.55s · out · 缩放 Y 0.86→1 | 元素设 `transform-origin: top` | 缩放 Y（锚点放顶边） |
| `underline` | 强调 | 0.4s · inOut | 从左往右裁切露出 | 形状层锚点放左边缘 + 缩放 X 0→100 |
| `blockSweep` | 强调 | 0.4s · outExpo | `.bm-sweep` 背景从左扫满 | 形状层锚点放左边缘 + 缩放 X 0→100 |
| `countUp` | 强调 | 1.0s · out | 返回数值，用 `BM.text` 写入 | 滑块控制关键帧 + 源文本表达式取整 |
| `ringDraw` | 强调 | 1.0s · inOut · 每圈错开 0.1s | SVG 描边虚线 | 路径修剪「结束」0→100 |
| `sink` | 退场 | 0.4s · in · 下移 32px | 位移 + 淡出 | 位置 Y + 不透明度 |
| `maskDown` | 退场 | 0.4s · in · 每行错开 0.05s | 遮罩里那一层落到 120% | 同 maskUp 反向 |
| `flash` | 转场 | 4 帧（上限 6 帧） | `BM.flash(t, at)` 返回这一帧是否显示 | 色板图层入点 / 出点卡死帧数 |
| `fieldWipe` | 转场 | 0.55s · inOut | 新场景从左往右裁切露出 | 新场景加「线性擦除」，过渡完成度 100→0 |
| `radarSweep` | 转场 | 0.7s · inOut · 中心 (1440,540) | 新场景用锥形渐变遮罩顺时针扫出 | 新场景加「径向擦除」，中心 (1440,540)，顺时针，100→0 |
| `stickerPush` | 转场 | 0.55s · in · 放大到 5 倍，最后 25% 时长线性淡出 | 缩放 + 淡出 | 缩放 + 不透明度（线性） |
| `sweepSpin` | 常驻 | 36°/s（10 秒一圈）· linear | 旋转（`.bm-spin` 以雷达中心为轴） | 旋转线性关键帧（锚点放雷达中心） |
| `slowPush` | 镜头 | 每秒 +0.4% · linear | `.bm-camera` 以画面中心缩放 | 镜头预合成 / 空对象缩放线性关键帧 |
| `hold` | 镜头 | — | 不动 | 不动 |

## 网页用法
```html
<div class="abs disp"><span class="bm-mask"><span id="title">AI 挖洞</span></span></div>
<span class="blk bm-sweep" id="hl">前 80%</span>
<script>
window.renderAt = function (t) {
  BM.set(title, BM.maskUp(t, 0.25, 0));
  BM.set(hl, BM.blockSweep(t, 0.9));
  BM.set(card, BM.rise(t, 1.2), BM.sink(t, 3.0));   // 多个状态会合并
  BM.set(plate, BM.flash(t, 1.6) ? {} : false);      // false = 隐藏
};
</script>
```
## AE 用法
```js
#include "motion_ae.jsx"
BMAE.rise(cardLayer, 1.2);
BMAE.maskUp(lineLayer, matteLayer, 0.25, 0);
BMAE.key(prop, 0, 0, 0.55, 100, "out");   // 任意属性用同一条曲线
```

## 注意事项（逐帧确定性）
- **不要用 `will-change`**：它会让 Chromium 按「第一次画出来时的缩放」缓存图层，之前渲染过哪些帧会影响后面的像素（P2 测试中实际踩到）。
- 不要用 CSS `transition` / `animation`、`Date`、`Math.random`；所有变化都从 t 算出来。
- 渲染前先把所有图片解码（`render_mb.js` 和测试已经这样做），否则图片第一次出现的那一帧可能还没画出来。
- 写进样式的数值统一保留 3 位小数（`BM.set` 内部处理）。

## 新增一个预设
1. `tokens/motion.json` 的 `preset` 里加参数；
2. `engine/motion/motion.js` 加网页写法（返回状态）；
3. `ae/motion_ae.jsx` 加 AE 写法（用 `key()` 加关键帧）；
4. `tools/test_motion.js` 加起止状态和网页↔AE 对比；
5. `python3 tools/gen_tokens.py && node tools/test_motion.js` 全部通过。

## 还没在真 AE 里验证的
AE 端只在模拟的 AE 环境里测过（关键帧值、缓动、遮罩设置），**没在真 AE 里跑过**。其中「线性擦除 / 径向擦除」不在用户 AE 的探测报告里，参数按序号访问，擦除方向需要在真 AE 里核对一次；建议下次让用户重跑 AE 探测脚本时把这两个效果加进去。
