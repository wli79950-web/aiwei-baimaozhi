# AE 包工具

## 现状（P1）
从「艾唯说挖洞」迁来的 AE 工具（全部是自有代码，不含 lieflat 代码）**不在 `main` 上**，放在分支 `ref/ae-from-aiwei-vs2` 的 `ae/_from_aiwei-vs2/`：里面还写死了挖洞号的颜色、字体、HUD 和左上角 IP 区检查，不要直接运行。P6 按白帽志改造后再进 `main`。

| 文件 | 作用 | P6 要改的 |
|---|---|---|
| `build_ae.py` | 一键生成 AE 包：脚本 → 音效 → 收集素材 → 模拟测试 → zip | 素材查找路径（只查本期 → 同期分段，不设品牌素材层）、字体清单 |
| `ae_lib.jsx` | AE 运行库（ES3）：图层、形状、文字、关键帧、窗口预合成 | 色值改读 brand.json；删除 HUD / 时间码 / PiP 描边；换成新动效库的 AE 写法 |
| `fontcov.py` | 中英混排逐字设字体 | 字体表换成得意黑 / MiSans / Archivo / IBM Plex Mono |
| `page_text.js` | 从 HTML 提取文字块和字体映射 | 字体映射 |
| `mock_ae_test.js` | 模拟 AE 对象模型的测试 | 删除 IP 区检查；保留整帧烘焙检查 |
| `html_capture.js` · `crop_alpha.py` | 截取背景板和元素透明 PNG | 基本可直接用 |
| `bake_windows.js` · `sample_windows.js` | 录屏窗口逐帧烘焙 / 采样动画数据 | 基本可直接用 |
| `AE_接口探测.jsx` | 导出用户 AE 的真实接口，用来核对 matchName | 标题文字 |

- `probe/AE_probe_24.6.2.txt`：用户 AE 24.6.2 的探测报告，核对 matchName 时以它为准。
- 测试依赖：`cd ae && npm i`（acorn）。
- 规范见 `docs/rules/AE包规范.md`。
