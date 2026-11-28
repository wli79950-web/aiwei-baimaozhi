# AE 包演示期（P6，不是正片）

演示 `python3 ae/build_ae.py` 的完整流程：6 个镜头、26 秒。

| 镜头 | 配方 / 内容 | 演示什么 |
|---|---|---|
| S01 | L-N10 英雄物件 | 贴纸主体 + 焦点组件 + 引线标注 + 氛围道具 |
| S02 | L-K01 票据档位 | 多张信息卡（行逐个入场、遮罩上移、CVSS 刻度条）+ 统一退场 `out: 3.55` |
| S03 | L-K21 侧板关系链 | 图解 + 引线标注 + 氛围道具 |
| S04 | L-K26 透视卡片队列 | 倾斜卡片（部件预合成绕中心转） |
| S05 | 录屏 | 窗口边框 + 录屏预合成：时间重映射、推镜、模糊打码（AE 里是实色块）、标注框 + 标签 |
| S06 | R-AI-CHAT | AI 对话气泡 |

- 内容是示意，图片是风格样张（`cards/images/samples/`，不进正片）。
- 录屏原片是 `tools/make_demo_recording.js` 生成的示意录屏（`out/screencast/demo_rec/`，不进 git）：先运行 `node tools/make_demo_recording.js`，再打包。
- 产物在 `build/`（不进 git）：`DEMO_AE重建包/`、`DEMO_AE重建包.zip`，包里有 `还原对比/` 和 `模拟测试报告.txt`。
