# 更新记录

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
