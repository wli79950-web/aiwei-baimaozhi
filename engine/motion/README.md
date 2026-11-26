# 动效库（P2 建设 · 全新编写）

**不得引入 lieflat code video 的代码或其派生代码**（PolyForm 非商业许可）。弹簧、缓动这类通用数学可以按公式自己实现。

## 原则
- 每个动效都是时间（秒）的纯函数：`f(t) → 样式值`，同一时间渲染两次像素一致（P2 带自动测试）。
- 每个动效都有 AE 对应写法（关键帧 + 缓动影响值，或表达式），网页和 AE 用同一组数值。
- 性格：精准、克制。入场用快进慢停的减速曲线，0.4–0.7s；贴纸落定回弹 ≤ 3%；不做手持晃动，镜头静止或极慢推。

## 首批预设（计划）
| 类 | 预设 |
|---|---|
| 缓动 | `easeOutQuint`、`easeOutExpo`、`easeInOutCubic`、轻回弹 `settle`（≤ 3%） |
| 入场 | 上移淡入 `rise`、遮罩逐行上移 `maskUp`、贴纸落定 `drop`、卡片展开 `unfold` |
| 强调 | 朱橙下划线画出 `underline`、朱橙块扫入 `blockSweep`、数字滚动 `countUp`、雷达圈描线 `ringDraw` |
| 退场 | 下移淡出 `sink`、遮罩收起 `maskDown` |
| 转场 | 雷达扫掠 `radarSweep`、色场擦除 `fieldWipe`、朱橙 / 蓝闪切 `flash`（≤ 6 帧）、贴纸冲镜 `stickerPush` |
| 镜头 | 静止 `hold`、慢推 `slowPush` |

验收：一段 5 秒样片 MP4 + 确定性测试 + AE 对照说明。
