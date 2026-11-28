# 镜头配方表

> 由 `recipes.json`（v1.2.0，2026-11-28）生成，不要手改：`python3 tools/recipes_md.py`。
>
> 镜头配方表（P6）：一张知识卡片 = 排版 + 信息卡 / 图解 + 图片 + 动效。每条配方写明用来讲什么、场景、焦点、图片类别、用到的组件、动效节奏和一个示例镜头（example，可直接交给 engine/shot.js / tools/cards_preview.js / ae/build_ae.py）。示例内容是示意，图片是风格样张（不进正片）。

选配方的顺序：先看这句口播要讲的是什么（「用来讲」一列），再看场景和焦点；示例镜头直接改文字和图片就能用。

| 配方 | 名称 | 用来讲 | 场景 | 焦点 | 图片 | 组件 | 预览 |
|---|---|---|---|---|---|---|---|
| `L-K01` | 票据档位 | 有档位、有价格（3–5 档） | B | c2 | 1 实物贴纸 | tier、title | [看图](../../docs/previews/cards/L-K01.jpg) |
| `L-K02` | 圆环定义 | 由哪几类组成（3–6 类） | A | c1 | 1 实物贴纸 | keyword、ring、title | [看图](../../docs/previews/cards/L-K02.jpg) |
| `L-K03` | 目标档案 | 定目标、定范围 | B | l1 | 证据截图、1 实物贴纸 | list、shot、tag、title | [看图](../../docs/previews/cards/L-K03.jpg) |
| `L-K04` | 徽章关系 | 谁和谁之间发生了什么（3 个角色） | A | c1 | — | flow、title | [看图](../../docs/previews/cards/L-K04.jpg) |
| `L-K05` | 手持关键词 | 一个名词是什么 | A | — | 2 意象插画、3 氛围装饰 | keyword | [看图](../../docs/previews/cards/L-K05.jpg) |
| `L-K06` | 原文 + 译文 | 引用原文、公告 | B | [[ ]] 色块 | 证据截图、1 实物贴纸 | quote、shot | [看图](../../docs/previews/cards/L-K06.jpg) |
| `L-K07` | 取景框大数字 | 一个关键数字或状态 | A | — | 证据截图 | — | [看图](../../docs/previews/cards/L-K07.jpg) |
| `L-K08` | 编号网格 | 步骤、流程（3–6 步） | A | c3 | 1 实物贴纸 | step、title、vtrack | [看图](../../docs/previews/cards/L-K08.jpg) |
| `L-K09` | 证据墙 | 证据、截图（3–5 张） | A | — | 证据截图 | title、wall | [看图](../../docs/previews/cards/L-K09.jpg) |
| `L-K10` | 对比双芯片 | 二选一对比 | A | c2 | 1 实物贴纸、3 氛围装饰 | chip | [看图](../../docs/previews/cards/L-K10.jpg) |
| `L-K11` | 侧向跟读大字 | 一句话分左右两半说完 | A | {{ }} 重点字 | 2 意象插画、3 氛围装饰 | — | [看图](../../docs/previews/cards/L-K11.jpg) |
| `L-K12` | 引语短标签 | 复述一句原话（2–4 条） | A | — | 2 意象插画、3 氛围装饰 | tag | [看图](../../docs/previews/cards/L-K12.jpg) |
| `L-K13` | 反转大字 | 反差：你以为 A，其实是 B | A | lines 橙分割线 | 3 氛围装饰 | — | [看图](../../docs/previews/cards/L-K13.jpg) |
| `L-K14` | 暗底三连字 | 递进三步 | A | {{ }} 重点字 | 证据截图 | — | [看图](../../docs/previews/cards/L-K14.jpg) |
| `L-K21` | 侧板关系链 | 谁 → 做了什么 → 结果（主体不离开画面） | A | — | 1 实物贴纸、3 氛围装饰 | list | [看图](../../docs/previews/cards/L-K21.jpg) |
| `L-K22` | 前后对照板 | 修复前 / 后、改动前 / 后（同一个输入） | B | [[ ]] 色块 | — | term、title | [看图](../../docs/previews/cards/L-K22.jpg) |
| `L-K23` | 并排证据板 | 看完证据，下判断 | A | [[ ]] 色块 | 2 意象插画 | tag、term、title | [看图](../../docs/previews/cards/L-K23.jpg) |
| `L-K24` | 嵌套归属 | 归属、权限边界（租户 / 项目 / 资源） | A | {{ }} 重点字 | — | nest、title | [看图](../../docs/previews/cards/L-K24.jpg) |
| `L-K25` | 排除法收束 | 排查原因、误区纠正（先排除，再给答案） | A | c1 | 2 意象插画、3 氛围装饰 | verdict | [看图](../../docs/previews/cards/L-K25.jpg) |
| `L-K26` | 透视卡片队列 | 列举：能做什么、有几种方法（3–7 项） | A | c3 | 1 实物贴纸 | chip、keyword | [看图](../../docs/previews/cards/L-K26.jpg) |
| `L-K27` | 开场三拍海报 | 设问式开场：主题 → 疑问 → 原文 | A | {{ }} 重点字 | 1 实物贴纸 | quote、title | [看图](../../docs/previews/cards/L-K27.jpg) |
| `L-K28` | 原件分层摘录 | 一份报告 / 公告里有多条重点 | B | [[ ]] 色块 | 证据截图、1 实物贴纸 | quote、shot、stat | [看图](../../docs/previews/cards/L-K28.jpg) |
| `L-K29` | 素材关键词戳 | 在录屏、截图上点名一个概念 | A | — | 证据截图、1 实物贴纸 | keyword、shot | [看图](../../docs/previews/cards/L-K29.jpg) |
| `L-K30` | 抓包字段放大 | 抓包、响应字段讲解 | A | [[ ]] 色块 | — | lens、tag、term | [看图](../../docs/previews/cards/L-K30.jpg) |
| `L-N01` | 角色立牌 | 角色介绍（3 个角色） | B | — | 2 意象插画 | step、title | [看图](../../docs/previews/cards/L-N01.jpg) |
| `L-N02` | 章节大图 | 章节开场 | A | — | 1 实物贴纸 | title | [看图](../../docs/previews/cards/L-N02.jpg) |
| `L-N03` | 手机屏幕 | 证据、通知、截图放进手机 | A | — | 1 实物贴纸、3 氛围装饰 | chip、title | [看图](../../docs/previews/cards/L-N03.jpg) |
| `L-N04` | 照片扇形 | 口播时补画面（3 张照片） | A | — | 1 实物贴纸、3 氛围装饰、证据截图 | shot | [看图](../../docs/previews/cards/L-N04.jpg) |
| `L-N05` | 类型墙 | 由哪几类组成 / 一期的全貌（6 类） | A | c4 | 证据截图、1 实物贴纸 | step、title | [看图](../../docs/previews/cards/L-N05.jpg) |
| `L-N06` | 剪报 | 案例速写（必须标「示意」或注明出处） | B | l2 | 证据截图 | shot、tag、title | [看图](../../docs/previews/cards/L-N06.jpg) |
| `L-N07` | 插画海报 | 比喻：用一张插画讲一个名词 | A | — | 2 意象插画、3 氛围装饰 | — | [看图](../../docs/previews/cards/L-N07.jpg) |
| `L-N08` | 爆炸分层 | 结构、原理、藏在哪层 | B | m1 | — | layers、title | [看图](../../docs/previews/cards/L-N08.jpg) |
| `L-N09` | 斜面板时间线 | 步骤、流程（4 步，带图） | A | l4 | 证据截图 | shot、tag、title | [看图](../../docs/previews/cards/L-N09.jpg) |
| `L-N10` | 英雄物件 | 门槛、配置、一个关键物件 | A | — | 1 实物贴纸、3 氛围装饰 | tag、title | [看图](../../docs/previews/cards/L-N10.jpg) |
| `L-N11` | 同侧叠牌 | 先给对象，下一拍再给判断 | A | c2 | 1 实物贴纸、3 氛围装饰 | keyword、tag、verdict | [看图](../../docs/previews/cards/L-N11.jpg) |
| `L-N12A` | 槽位标签 · 口播态 | 先在主体周围固定几个标签，再切全屏讲 | A | l6 | 1 实物贴纸、3 氛围装饰 | tag | [看图](../../docs/previews/cards/L-N12A.jpg) |
| `L-N12B` | 槽位标签 · 换底态 | 标签原位不动，换底后中心展开 | B | l5、[[ ]] 色块 | 1 实物贴纸 | tag、verdict | [看图](../../docs/previews/cards/L-N12B.jpg) |
| `L-N13` | 提问条 + 维度 | 一个问题拆成几个维度（3–6 个） | A | {{ }} 重点字 | 2 意象插画 | tag | [看图](../../docs/previews/cards/L-N13.jpg) |
| `L-N14` | 让半屏证据板 | 边看主体边看证据（复盘） | A | c2 | 2 意象插画 | keyword、title | [看图](../../docs/previews/cards/L-N14.jpg) |
| `L-N15` | 问号章节 | 第 N 步章节开场（几章共用一个容器） | A | {{ }} 重点字、bar 橙短线 | 1 实物贴纸、3 氛围装饰 | tag、title | [看图](../../docs/previews/cards/L-N15.jpg) |
| `L-N16` | 主句 + 四角 | 一句结论 + 旁人的反应 | A | {{ }} 重点字 | 证据截图 | tag | [看图](../../docs/previews/cards/L-N16.jpg) |
| `L-N17` | 主干 → 分支 | 先讲主线，再展开出事的分支 | B | l3 | — | keyword、step、tag、title | [看图](../../docs/previews/cards/L-N17.jpg) |
| `L-N18` | 来源 → 分类 → 聚焦 | 引用标准 / 公告，并在分类里定位本期 | A | c2 | 1 实物贴纸 | tag、title | [看图](../../docs/previews/cards/L-N18.jpg) |
| `L-N19` | 中轴物件串联 | 两个容易混的概念之间的关系 | B | [[ ]] 色块 | 1 实物贴纸 | tag | [看图](../../docs/previews/cards/L-N19.jpg) |
| `L-N20` | 对象 + 两侧判断 | 一个对象，两个判断 | B | [[ ]] 色块 | 1 实物贴纸 | — | [看图](../../docs/previews/cards/L-N20.jpg) |
| `L-N21` | 弧线清单 | 准备清单、门槛（5–6 项） | A | c2 | 1 实物贴纸 | step、title | [看图](../../docs/previews/cards/L-N21.jpg) |
| `L-N22` | 一群里的一个 | 比喻：一群里有一个不一样 | A | — | — | crowd、tag、title、zoom | [看图](../../docs/previews/cards/L-N22.jpg) |
| `L-N23` | 框选取证 | 证据只看一行 | B | {{ }} 重点字 | 证据截图 | shot、title、verdict | [看图](../../docs/previews/cards/L-N23.jpg) |
| `L-N24` | 输入 → 输出 | 修复前后、关系式收尾 | B | [[ ]] 色块 | 1 实物贴纸 | term、title、tag | [看图](../../docs/previews/cards/L-N24.jpg) |
| `L-N25` | 噪音 → 收束 | 一堆噪音，最后只剩一个结论 | B | — | 1 实物贴纸 | stat | [看图](../../docs/previews/cards/L-N25.jpg) |
| `R-AI-CHAT` | AI 对话 | 演示怎么问 AI、AI 怎么答（提示词 → 回答 → 人来确认） | A | {{ }} 重点字 | 1 实物贴纸、3 氛围装饰 | chat | [看图](../../docs/previews/cards/R-AI-CHAT.jpg) |
| `R-AI-REVIEW` | AI 输出 vs 人工复核 | 讲 AI 的结论哪些要人确认（逐条核对，划掉误报） | A | {{ }} 重点字 | — | review、title、tag | [看图](../../docs/previews/cards/R-AI-REVIEW.jpg) |
| `R-SKILL` | 技能树 / 学习路线 | 就业、入门路线：已会 / 正在学 / 未解锁 | B | — | 1 实物贴纸 | skill、title、vtrack | [看图](../../docs/previews/cards/R-SKILL.jpg) |
| `R-JD` | 岗位 JD 拆解 | 网安就业：一份 JD 拆成几条硬要求，标出最关键的一条 | A | [[ ]] 色块 | 2 意象插画、3 氛围装饰 | jd、tag、title | [看图](../../docs/previews/cards/R-JD.jpg) |
| `R-TOOLS` | 工具对比 | AI 工具 / 安全工具横评：两样东西各适合干什么 | A | c2 | 1 实物贴纸、3 氛围装饰 | chip | [看图](../../docs/previews/cards/R-TOOLS.jpg) |
| `R-INTERVIEW` | 面试题 | 就业：一道高频面试题 + 一句答题要点 | A | {{ }} 重点字 | 2 意象插画、3 氛围装饰 | quote、title | [看图](../../docs/previews/cards/R-INTERVIEW.jpg) |
| `R-STEP3` | 三步大卡片流转（配贴纸） | 三步总览 / 复盘：大号步骤卡必须内嵌实物贴纸，避免大卡片只有小图标显空 | A | l3、lines 橙线 | 1 实物贴纸 | step | [看图](../../docs/previews/cards/R-STEP3.jpg) |
| `R-DECL` | 权威声明横幅 + 引用卡 | 合规声明、底线强调（无原文截图时用克莱因蓝横幅卡填满上半屏） | B | [[ ]] 色块 | 1 实物贴纸 | keyword、quote | [看图](../../docs/previews/cards/R-DECL.jpg) |

## 动效节奏

- **`L-K01` 票据档位**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K02` 圆环定义**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K03` 目标档案**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K04` 徽章关系**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K05` 手持关键词**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K06` 原文 + 译文**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K07` 取景框大数字**：贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K08` 编号网格**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K09` 证据墙**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K10` 对比双芯片**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K11` 侧向跟读大字**：贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K12` 引语短标签**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K13` 反转大字**：文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K14` 暗底三连字**：贴纸 drop（落定回弹 2%） → 文字 rise → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K21` 侧板关系链**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K22` 前后对照板**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K23` 并排证据板**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K24` 嵌套归属**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K25` 排除法收束**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K26` 透视卡片队列**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K27` 开场三拍海报**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K28` 原件分层摘录**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K29` 素材关键词戳**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-K30` 抓包字段放大**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N01` 角色立牌**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N02` 章节大图**：标题逐行 maskUp → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N03` 手机屏幕**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N04` 照片扇形**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N05` 类型墙**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N06` 剪报**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N07` 插画海报**：贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N08` 爆炸分层**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N09` 斜面板时间线**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N10` 英雄物件**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N11` 同侧叠牌**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N12A` 槽位标签 · 口播态**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N12B` 槽位标签 · 换底态**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N13` 提问条 + 维度**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N14` 让半屏证据板**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N15` 问号章节**：标题逐行 maskUp → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N16` 主句 + 四角**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N17` 主干 → 分支**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N18` 来源 → 分类 → 聚焦**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N19` 中轴物件串联**：贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N20` 对象 + 两侧判断**：贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N21` 弧线清单**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N22` 一群里的一个**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N23` 框选取证**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N24` 输入 → 输出**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`L-N25` 噪音 → 收束**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 引线 / 标注在最后一个元素之后 0.15–0.25s 出现 → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-AI-CHAT` AI 对话**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-AI-REVIEW` AI 输出 vs 人工复核**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-SKILL` 技能树 / 学习路线**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-JD` 岗位 JD 拆解**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-TOOLS` 工具对比**：卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 文字 rise → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-INTERVIEW` 面试题**：标题逐行 maskUp → 卡片 / 图解按槽位顺序 rise（错开 0.12s） → 贴纸 drop（落定回弹 2%） → 焦点（朱橙）在强调拍 blockSweep；类别 3 和背景动态常驻
- **`R-STEP3` 三步大卡片流转（配贴纸）**：三张大步骤卡依次 rise（错开 0.15s）→ 右上贴纸 drop → 串联引线画出 → 末卡 hot 朱橙焦点
- **`R-DECL` 权威声明横幅 + 引用卡**：顶部克莱因蓝横幅 rise → 下方引用卡 rise → 重点色块 blockSweep → 贴纸 drop

## 怎么用

```bash
node tools/cards_preview.js L-K08 R-AI-CHAT   # 只出这几条的预览
node tools/cards_preview.js                  # 全部 + 总览板 docs/previews/cards/sheet_*.jpg
```
- 一期的镜头表（episode.json）里每个镜头写 `recipe: "L-K08"`，再覆盖 `fill` / `cue` 等字段；`ae/build_ae.py` 和网页渲染读同一份镜头描述。
