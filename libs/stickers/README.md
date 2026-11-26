# 素材库 · 透明底贴纸

## 风格
哑光陶瓷 / 磨砂树脂质感的 3D 物件，只用 **奶油白 `#F5EEDF` / 克莱因蓝 `#002FA7` / 朱橙 `#FF5A1F`**，浅灰底生成后抠成透明底。
提示词后缀在 `tokens/brand.json` → `sticker.prompt_suffix`，`tools/genimg.py` 的 `sticker` 预设会自动带上。

## 生成与抠图
```bash
python3 tools/genimg.py jobs.json footage/gen          # jobs.json 里 preset 写 "sticker"，prompt 只写物件本身
python3 -I tools/cutout.py object footage/gen/x.png episodes/<本期>/assets/x.png              # 有镂空的物件（锁、钥匙）
python3 -I tools/cutout.py object footage/gen/x.png episodes/<本期>/assets/x.png --fill-holes # 实心物件（盾牌、徽章）
```
- 提示词只写物件和配色分工（例：`a closed padlock, Klein blue body with a cream white shackle and a small orange keyhole, front three-quarter view`）。
- 炭黑场优先用奶油白为主的贴纸；蓝色为主的贴纸要垫一张卡片白卡。
- 挑图时检查：没有文字 / Logo / 水印；颜色不超出三色（模型偶尔会加灰、加金，重生）；抠图边缘干净、没有残影。

## 目录
| 目录 | 内容 | 能否用进正片 |
|---|---|---|
| `brand/` | 品牌贴纸（白帽等），P5 按朱橙配色生成 | ✅ 可跨期复用 |
| `samples/` | 2026-11-26 风格样张 12 张（金色点缀版），提示词见 `samples/prompts.json` | ❌ 只作参考 |
| 每期素材 | 放在 `episodes/<本期>/assets/` | ✅ 只用于本期，不得出现在两期 |
