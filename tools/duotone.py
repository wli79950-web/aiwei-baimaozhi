#!/usr/bin/env python3
"""双色调（渐变映射）：把任意照片按亮度映射到品牌色，保证照片类素材的颜色落在配色体系里。
色标从 tokens/brand.json → imagery.duotone 读取（默认 炭黑 → 朱橙 → 奶油白）。

用法：python3 -I tools/duotone.py 输入.png 输出.png [--map orange|klein] [--contrast 1.15] [--grain 0.04]
  --map orange   炭黑 → 朱橙 → 奶油白（默认，情绪节点、章节卡、金句）
  --map klein    炭黑 → 克莱因蓝 → 奶油白（对照、冷静、防守主题）
  --contrast     先拉一点对比再映射，默认 1.15
  --grain        叠一层细颗粒，默认 0.04（0 关闭）"""
import json, os, sys
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
C = {k: v['hex'] for k, v in B['color'].items()}
args = sys.argv[1:]
src, dst = args[0], args[1]
opt = lambda k, d: type(d)(args[args.index(k) + 1]) if k in args else d
which, contrast, grain = opt('--map', 'orange'), opt('--contrast', 1.15), opt('--grain', 0.04)
stops = B['imagery']['duotone'][which]            # [[位置 0–1, 颜色名], ...]

rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
img = Image.open(src).convert('RGB')
g = np.asarray(ImageOps.autocontrast(img.convert('L'), cutoff=0.5), dtype=np.float32) / 255
g = np.clip((g - .5) * contrast + .5, 0, 1)
if grain > 0:
    g = np.clip(g + np.random.default_rng(7).normal(0, grain, g.shape), 0, 1)

pos = np.array([s[0] for s in stops], dtype=np.float32)
cols = np.stack([rgb(C[s[1]]) for s in stops])
out = np.stack([np.interp(g, pos, cols[:, c]) for c in range(3)], axis=-1)
Image.fromarray(out.astype(np.uint8)).save(dst)
print(dst, img.size, which)
