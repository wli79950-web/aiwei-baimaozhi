# 艾唯白帽志 · 视觉系统 1.2

「艾唯白帽志」（AI 挖洞、攻防技术、网安就业）的视频视觉系统和制作工具链：横屏 1920×1080 · 60fps · HTML 逐帧渲染 + AE 分层重建包。

核心目标：**知识可视化** —— 把抽象知识用「图片（贴纸 / 图片素材库 / 用户素材）+ 动效 + 用户录屏」的综合动画讲清楚，并带来惊艳的视觉体验。

- 规范：`CLAUDE.md`（硬规则）· `STYLE.md`（视觉系统）· `docs/rules/`（制作细则，按需读）· `docs/decisions/`（决策记录）
- 唯一数值来源：`tokens/brand.json`（改完跑 `python3 tools/gen_tokens.py` 和 `python3 tools/contrast_check.py`）
- 上手：`SETUP.md`；预览：`docs/previews/`；版本：`CHANGELOG.md`；作品台账：`EPISODES.md`

## 新会话开场白（复制即用）
> 按「艾唯白帽志 · 视觉系统 1.2」制作第 BM0N 期。先读 CLAUDE.md、STYLE.md、docs/rules/用户要求汇总.md、EPISODES.md，运行 SETUP.md 装好环境，再看我发的口播和脚本。

## 目录
| 目录 | 内容 |
|---|---|
| `tokens/` | `brand.json`：色值、场景配色、字体、字号、网格、背景板、贴纸预设 |
| `engine/` | `tokens.css`（自动生成）、`base.css`、渲染与运动模糊、音效合成；`motion/` 动效库（P2） |
| `libs/backgrounds/` | 背景板库：底板 PNG + 动态层 SVG |
| `cards/` | **知识卡片板块** = 图片 + 排版 + 信息卡（见 `cards/README.md`） |
| `cards/images/` | 图片：风格提示词 `styles.json`（sticker、SC02、toy、tone、iso、device、flat……持续扩充）、贴纸样张；图片每期现生成 |
| `cards/layouts/` | 排版（P3）：由挖洞号 49 张卡的构图迁来，只含构图和槽位，持续扩充 |
| `cards/infocards/` | 信息卡（P4），持续扩充 |
| `cards/recipes/` | 配方（P6）：一张卡 = 排版 + 信息卡 + 图片 + 动效 |
| `libs/screencast/` | 录屏组件（P4）：窗口、推镜、标注、光标、打码、联动 |
| `ae/` | AE 包工具：探测报告、说明；挖洞号迁来的参考实现在提交 `adbbc35` 的 `ae/_from_aiwei-vs2/`，P6 改造后进 `main` |
| `tools/` | 生图、抠图、双色调、对比度检查、生成 tokens / 背景板 / 预览、语音识别、口播抠像 |
| `fonts/` | 得意黑、Archivo Black、IBM Plex Mono（SIL OFL 1.1，附许可）；MiSans Medium / Bold / Heavy（小米许可，用户已确认商用） |
| `episodes/` | 每期一个目录；`main` 只保留最新两期，更早的打标签 `ep/<期号>` 归档 |
| `docs/` | 规则、决策、预览 |

## 建设进度
| 阶段 | 内容 | 状态 |
|---|---|---|
| P1 骨架 | 目录、规范、`brand.json`、背景板库、字体、迁移工具、对比度检查、预览 | ✅ 2026-11-26 |
| P1.1 | 空间利用率规则、图片素材库候选、录屏组件规划、双色调工具 | ✅ 2026-11-26 |
| P2 动效库 | 自写动效预设 + AE 对应写法 + 5 秒样片 | 待做 |
| P3 排版库 | 49 张卡构图 → `layout.json` + 线框预览 + `layout_lint` | 待做 |
| P4 信息卡库 + 录屏组件 | 首批约 20 个组件 × A/B 场景；录屏窗口 / 推镜 / 标注 / 打码 / 联动 | 待做 |
| P5 素材库 | 朱橙版贴纸样张、`iso` / `flat` / `device` 风格出样张确认、生图清单模板 | 待做 |
| P6 配方表 + AE | 配方表、新 AE 组件库、`build_ae.py` 分层检查 | 待做 |
| P7 试做一期 | 30–60 秒完整流程 | 待做 |

## 不在 main 当前版本里、但保存在历史中的内容
`main` 上只有已确认的东西。下面两项暂时不用，保存在提交 `adbbc35`（`main` 的历史里），需要时取回（浅克隆先 `git fetch --depth=10 origin main`）：

| 内容 | 位置 | 取回命令 | 什么时候进 main |
|---|---|---|---|
| 挖洞号 AE 工具的参考实现（写死了挖洞号的颜色、字体、HUD） | `ae/_from_aiwei-vs2/` | `git checkout adbbc35 -- ae/_from_aiwei-vs2` | P6 改造完 |
| 图片素材库 `toy` / `tone` 样张、演示帧 F5 / F6、图片素材库预览板 | `libs/imagery/candidates/`、`docs/previews/` | `git checkout adbbc35 -- libs/imagery/candidates` | 不再进 main（不设品牌层），需要参考时取回 |

> 本仓库不含 lieflat code video 的任何代码；所有动效自写。与「艾唯说挖洞」（`aiwei-vs2`）的素材完全隔离。不设品牌素材层，图片素材每期由用户提供或现生成。
