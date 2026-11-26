# 背景板库

由 `node tools/make_backgrounds.js` 根据 `tokens/brand.json` 生成，不要手改图片。预览：`docs/previews/sheet_backgrounds.jpg`。

| 编号 | 底板（`plates/`，1920×1080 PNG） | 动态层（`layers/`，透明 SVG） | 场景 |
|---|---|---|---|
| BG1 炭黑·雷达 | `BG1_char_plate.png` | `BG1_radar_lines.svg`（奶油白 13%）、`BG1_radar_sweep.svg`（朱橙扇区 38%） | A 炭黑场 |
| BG2 奶油白·纸面 | `BG2_cream_plate.png` | `BG2_radar_lines.svg`（炭黑 6%，可关） | B 奶油白场 |
| FX 朱橙闪切 | `FX_orange.png` | — | 重拍 / 反转，≤ 6 帧 |
| FX 克莱因蓝闪切 | `FX_klein.png` | — | 对照 / 切话题，≤ 6 帧 |

- 雷达中心 (1440, 540)，圆环半径 170 / 270 / 370 / 470。扫描扇区单独一层，AE 里把锚点设在雷达中心、旋转即可做扫掠。
- 网页里：`<img class="bg-layer" src="libs/backgrounds/layers/...svg">` 叠在场景类 `scene-A` / `scene-B` 的 section 上（场景类自带底色渐变，和底板 PNG 一致）。
- AE 里：底板做图片层 `背景板_BG1`；动态层图层名以 `背景动态_` 开头。
