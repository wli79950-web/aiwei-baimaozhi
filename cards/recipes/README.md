# 镜头配方表（P6）

「这句口播要讲什么 → 用哪个排版 + 哪些信息卡 / 图解 + 哪类图片 + 什么动效节奏 + 哪个场景」。

| 文件 | 作用 |
|---|---|
| `recipes.json` | 配方表（机器读，**唯一来源**）：56 条 = 挖洞号 49 张卡的构图改成的 50 个排版各一条 + 白帽志新增 6 种叙事功能（AI 对话、AI 输出 vs 人工复核、技能树、岗位 JD、工具对比、面试题） |
| `recipes.md` | 给人看的总表（`python3 tools/recipes_md.py` 生成） |
| 预览 | `docs/previews/cards/<配方 id>.jpg`、总览 `sheet_1–6.jpg`（`node tools/cards_preview.js`） |

每条配方：`id`、`layout`（排版）、`name`、`function`（用来讲什么）、`scene`、`focus`（朱橙焦点在哪）、`images`（图片类别）、`components`（信息卡 / 图解）、`motion`（动效节奏）、`example`（示例镜头，字段见 `engine/shot.js` 开头）。

- 示例镜头可以直接交给镜头运行时 `engine/shot.js`（网页预览 / 渲染）和 `ae/build_ae.py`（AE 包）。
- 一期的镜头表里写 `recipe: "<配方 id>"`，再覆盖本期的 `fill` / `cue` / `sub`。
- 新增叙事功能：先加排版（`cards/layouts/`）或用已有排版，再在 `recipes.json` 里加一条，跑预览检查。
