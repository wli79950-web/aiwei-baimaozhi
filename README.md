# 艾唯白帽志 · 视觉系统 1.1

「艾唯白帽志」（AI 挖洞、攻防技术、网安就业）的视频视觉系统和制作工具链：横屏 1920×1080 · 60fps · HTML 逐帧渲染 + AE 分层重建包。

核心目标：**知识可视化** —— 把抽象知识用「图片（贴纸 / 图片素材库 / 用户素材）+ 动效 + 用户录屏」的综合动画讲清楚，并带来惊艳的视觉体验。

- 规范：`CLAUDE.md`（硬规则）· `STYLE.md`（视觉系统）· `docs/rules/`（制作细则，按需读）· `docs/decisions/`（决策记录）
- 唯一数值来源：`tokens/brand.json`（改完跑 `python3 tools/gen_tokens.py` 和 `python3 tools/contrast_check.py`）
- 上手：`SETUP.md`；预览：`docs/previews/`；版本：`CHANGELOG.md`；作品台账：`EPISODES.md`

## 新会话开场白（复制即用）
> 按「艾唯白帽志 · 视觉系统 1.1」制作第 N 期。先读 CLAUDE.md、STYLE.md、docs/rules/用户要求汇总.md、EPISODES.md，运行 SETUP.md 装好环境，再看我发的口播和脚本。

## 目录
| 目录 | 内容 |
|---|---|
| `tokens/` | `brand.json`：色值、场景配色、字体、字号、网格、背景板、贴纸预设 |
| `engine/` | `tokens.css`（自动生成）、`base.css`、渲染与运动模糊、音效合成；`motion/` 动效库（P2） |
| `libs/backgrounds/` | 背景板库：底板 PNG + 动态层 SVG |
| `libs/layouts/` | 排版库（P3）：由挖洞号 49 张卡的构图迁来，只含构图和槽位 |
| `libs/infocards/` | 信息卡库（P4） |
| `libs/screencast/` | 录屏组件（P4）：窗口、推镜、标注、光标、打码、联动 |
| `libs/stickers/` | 贴纸：生图预设说明、品牌贴纸（P5）、风格样张 |
| `libs/imagery/` | 图片素材库：WH 白帽角色线 + TONE 双色调摄影线（候选 ✅，定稿 P5） |
| `libs/recipes/` | 镜头配方表（P6） |
| `ae/` | AE 包工具；`_from_aiwei-vs2/` 是待 P6 改造的参考实现，现在不要直接运行 |
| `tools/` | 生图、抠图、双色调、对比度检查、生成 tokens / 背景板 / 预览、语音识别、口播抠像 |
| `fonts/` | 得意黑、Archivo Black、IBM Plex Mono（SIL OFL 1.1，附许可） |
| `episodes/` | 每期一个目录 |
| `docs/` | 规则、决策、预览 |

## 建设进度
| 阶段 | 内容 | 状态 |
|---|---|---|
| P1 骨架 | 目录、规范、`brand.json`、背景板库、字体、迁移工具、对比度检查、预览 | ✅ 2026-11-26 |
| P1.1 | 空间利用率规则、图片素材库候选、录屏组件规划、双色调工具 | ✅ 2026-11-26 |
| P2 动效库 | 自写动效预设 + AE 对应写法 + 5 秒样片 | 待做 |
| P3 排版库 | 49 张卡构图 → `layout.json` + 线框预览 + `layout_lint` | 待做 |
| P4 信息卡库 + 录屏组件 | 首批约 20 个组件 × A/B 场景；录屏窗口 / 推镜 / 标注 / 打码 / 联动 | 待做 |
| P5 素材库 | 朱橙版品牌贴纸、图片素材库两条线定稿（WH 角色设定）、生图清单模板 | 待做 |
| P6 配方表 + AE | 配方表、新 AE 组件库、`build_ae.py` 分层检查 | 待做 |
| P7 试做一期 | 30–60 秒完整流程 | 待做 |

> 本仓库不含 lieflat code video 的任何代码；所有动效自写。与「艾唯说挖洞」（`aiwei-vs2`）的素材完全隔离。
