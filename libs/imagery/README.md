# 图片素材库 · 风格提示词

**不设品牌素材层，每期的图片都不一样。** 本库只放**风格提示词**和后期处理方法：每期按口播写画面内容，配上这里的风格后缀现生成；用户也可以自己生成后交来。图片只用于本期，同一张生图不得出现在两期。

作用类似「艾唯说挖洞」的 SC-01 和黑白雕塑，但用白帽志自己的风格，**不得使用 SC-01、黑白雕塑、黏土角色或任何挖洞号素材**。

## 风格一览（`styles.json`）
| id | 风格 | 用来讲什么 | 后期 | 样张 |
|---|---|---|---|---|
| `sticker` | 陶瓷贴纸（在 `tokens/brand.json`） | 名词实物化：芯片、钥匙、锁、盾牌…… | 抠透明底 | `libs/stickers/samples/` |
| `toy` | 设计师玩具角色 | 情境、讲故事、角色做动作、指向录屏 | 抠透明底 | 提交 `adbbc35` |
| `tone` | 双色调摄影 | 情绪节点：章节卡、反转、金句 | `tools/duotone.py` 映射成炭黑 → 朱橙 / 蓝 → 奶油白 | 提交 `adbbc35` |
| `iso` | 等距微缩场景 | 结构、系统、流程、攻击链 | 抠透明底 | 暂无，首次使用先出 2 张确认 |
| `device` | 手持设备实拍 | 把用户截图放进手机屏幕 | 截图透视贴进白屏 | 暂无 |
| `flat` | 几何平面插画 | 比喻、类比 | 直接用，放进卡片 | 暂无，首次使用先出 2 张确认 |

每个风格的完整提示词后缀、放法、示例主题和注意事项都在 `styles.json` 里。

## 怎么用
```bash
# jobs.json：prompt 只写本期的画面内容，preset 写风格 id
# [{"name":"bm01_vault","preset":"iso","prompt":"a vault room behind a series of doors, the last door wide open"}]
python3 tools/genimg.py jobs.json footage/gen
python3 -I tools/cutout.py object footage/gen/bm01_vault.png episodes/BM01_xxx/assets/bm01_vault.png
# 双色调：preset 用 tone，生成黑白照后再映射
python3 -I tools/duotone.py footage/gen/bm01_corridor.png episodes/BM01_xxx/assets/bm01_corridor.jpg
```
- 生图清单（剪辑思路汇报的附件）里每张写明：用哪个风格、用在哪个镜头、对应哪句口播、文件名、本期的画面描述。
- 一期里尽量只用 2–3 种风格，3D（`sticker` / `toy` / `iso`）和平面（`flat`）不要在同一个镜头里混用。
- 配色只能是奶油白 / 克莱因蓝 / 朱橙（加炭黑阴影）；模型偶尔会加灰、加金，挑图时重生。

## 用户提供的素材
截图、图片、录屏一律**保留原色**，放进窗口 / 卡片 / 手机屏幕里，不重新调色；需要强调时只加朱橙标注（框、下划线、标签）。

## 样张取回
`toy` 和 `tone` 的样张（2 张角色、3 张双色调照片 + 黑白原图）保存在提交 `adbbc35`（`main` 历史中）：
```bash
git fetch --depth=10 origin main   # 浅克隆先补历史
git checkout adbbc35 -- libs/imagery/candidates
```
