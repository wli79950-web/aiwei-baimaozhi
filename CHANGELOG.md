# 更新记录

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
