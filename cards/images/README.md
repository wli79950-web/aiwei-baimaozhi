# 知识卡片 · 图片

知识卡片 = **图片 + 排版 + 信息卡**（+ 动效）。这里管「图片」：风格提示词、后期处理方法和风格样张。

**不设品牌素材层，每期的图片都不一样。** 每期按口播写画面内容，配上这里的风格后缀现生成；用户也可以自己生成后交来。图片只用于本期，同一张生图不得出现在两期。白帽志用自己的风格，**不得使用挖洞号的 SC-01、黑白雕塑、黏土角色或任何挖洞号素材**。

## 风格一览（`styles.json`，后续继续扩充）
| preset | 风格 | 用来讲什么 | 后期 | 样张 |
|---|---|---|---|---|
| **`real`** | **写实产品摄影（核心）** | 名词实物化：芯片、服务器、锁、钥匙、手机…… | 抠透明底 → `tools/grade.py` | `docs/previews/explore/img/real_*` |
| `anime` | 动漫光效（辅助） | 主角镜头、高光时刻，一屏最多一个 | 抠透明底 → `tools/grade.py` | `docs/previews/explore/img/anime2_*` |
| `sc02-line` | **SC02 · 蓝调漫画** · 做法一 蓝线漫画 | 角色、情境、人物反应 | 直接用 / 抠透明底 | `docs/previews/styles/SC02.jpg` |
| `sc02-duo` | **SC02 · 蓝调漫画** · 做法二 黑白漫画 → 蓝调 | 物件、场景、情绪节点 | `tools/duotone.py --map klein --grain 0` | 同上 |
| `tone` | 双色调摄影 | 章节卡、反转、金句 | `tools/duotone.py` | 提交 `adbbc35` |
| `device` | 手持设备实拍 | 把用户截图放进手机屏幕 | 截图透视贴进白屏 | 暂无 |
| `flat` | 几何平面插画 | 比喻、类比 | 放进卡片 | 暂无，首次使用先出 2 张确认 |

每个风格的完整提示词后缀、放法、示例主题和注意事项都在 `styles.json`。

**停用**（2026-11-27，视觉系统 1.4）：`sticker` 陶瓷贴纸、`toy` 设计师玩具、`iso` 等距微缩。三者同为粘土 / 陶瓷质感，显得廉价、像模板；`styles.json` 里保留条目（`status: 停用`）作记录，`tools/genimg.py` 默认拒绝。

### 新增风格的格式
在 `styles.json` 的 `styles` 里加一项：`name`、`use`、`prompt_suffix`、`post`、`placement`、`subjects`、`rules`、`samples`。一个风格有几种做法时，用 `variants`（每种做法各自的 `prompt_suffix` / `post`），preset 写成 `风格-做法`（如 `sc02-line`）。加完 `tools/genimg.py` 就能直接用；再在上表加一行，样张预览放 `docs/previews/styles/`。

## 怎么用
```bash
# jobs.json：prompt 只写本期的画面内容，preset 写风格
# [{"name":"bm01_vault","preset":"sc02-duo","prompt":"a hand holding a key in front of a huge vault door"}]
python3 tools/genimg.py jobs.json footage/gen
python3 -I tools/cutout.py object footage/gen/chip.png footage/cut/chip.png                      # 写实 / 动漫：先抠图
python3 -I tools/grade.py footage/cut/chip.png episodes/BM01_xxx/assets/bm01_chip.png             # 再统一调色
python3 -I tools/duotone.py footage/gen/bm01_vault.png episodes/BM01_xxx/assets/bm01_vault.jpg --map klein --grain 0
python3 -I tools/cutout.py object footage/gen/x.png episodes/BM01_xxx/assets/x.png              # 有镂空的物件（锁、钥匙）
python3 -I tools/cutout.py object footage/gen/x.png episodes/BM01_xxx/assets/x.png --fill-holes # 实心物件（盾牌、徽章）
```
- 生图清单（剪辑思路汇报的附件）里每张写明：preset、用在哪个镜头、对应哪句口播、文件名、本期的画面描述。
- **写实为核心，动漫为辅**。一期尽量只用 2–3 种风格；写实（`real`）、动漫（`anime`）、漫画（`sc02-*`）、平面（`flat`）不在同一个镜头里混用。
- **统一调色，不统一配色**：生图保留物件本来的颜色，抠图后一律过 `tools/grade.py`；画面里高饱和的点只有朱橙（提示词里状态灯、发光写 warm orange）。
- 挑图检查：没有文字 / Logo / 水印 / 乱码标签，硬件结构没有明显错误，暗色物件有完整的轮廓光，抠图边缘干净、没有残影。

## 用户提供的素材
截图、图片、录屏一律**保留原色**，放进窗口 / 卡片 / 手机屏幕里，不重新调色；需要强调时只加朱橙标注（框、下划线、标签）。

## 目录
| 位置 | 内容 | 能否用进正片 |
|---|---|---|
| `styles.json` | 全部风格提示词 | — |
| `samples/` | 旧的陶瓷贴纸风格样张 12 张（2026-11-26，金色点缀版；1.4 起该风格停用），提示词 `samples/prompts.json` | ❌ 只作历史参考 |
| `docs/previews/explore/img/` | 2026-11-27 风格对比样张：粘土 / 写实 / 动漫 × 芯片、锁、服务器（原色和统一调色后） | ❌ 只作参考 |
| `docs/previews/styles/` | 各风格的样张预览图 | ❌ 只作参考 |
| 提交 `adbbc35` | `toy` / `tone` 样张：`git fetch --depth=10 origin main && git checkout adbbc35 -- libs/imagery/candidates` | ❌ 只作参考 |
| 每期素材 | `episodes/<本期>/assets/` | ✅ 只用于本期 |
