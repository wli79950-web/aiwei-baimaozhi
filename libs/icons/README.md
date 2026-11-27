# 线性图标库

`icons.js`（全局 `ICONS`，name → SVG 字符串）由 `node tools/make_icons.js` 从 [Lucide](https://lucide.dev)（ISC 许可，见 `LICENSE-lucide.txt`，可商用）生成，挑了和网安 / 挖洞相关的一批。描边跟随文字颜色（`currentColor`），线宽 1.75。

- 信息卡里用 `icon` 字段（如 `IC.render('step', { name: 'AI 扫描', icon: 'cpu' }, …)`）；图解组件（流转、嵌套、分层、一群里的一个）也用这里的名字。
- 要加图标：把名字加进 `tools/make_icons.js` 的 `LIST`，重跑。
- 图标是图形，不是文字，不受 52px 下限约束；一屏一个朱橙焦点照常（图标默认奶油白 / 炭黑，焦点卡里跟着变色）。
- AE 包（P6）里每个图标导出成单独的 SVG 图层。
