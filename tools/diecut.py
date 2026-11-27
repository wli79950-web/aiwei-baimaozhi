#!/usr/bin/env python3
"""模切贴纸：把纸底漫画（SC02）做成带奶油白描边的透明贴纸，放在炭黑场上也立得住（类别 2 · 意象插画）。
用法：python3 -I tools/diecut.py 原图.png 输出.png [--border 10] [--tone none|klein|ink] [--crop x0,y0,x1,y1] [--close 12]
  1. 找墨迹：比纸色暗一截的像素 + 有颜色的像素（朱橙点缀、蓝色网点）
  2. 轮廓：闭运算把排线连起来 → 填洞 → 去掉碎点 → 平滑，得到人物 / 物件的剪影
  3. 描边：剪影外扩 --border px（圆角），描边区填奶油白；边缘抗锯齿，输出透明 PNG
  4. 调色（默认 --tone none，1.7 用户确认）：铅笔灰原样保留，只把纸白映射成奶油白、墨黑映射成炭黑；有颜色的像素（克莱因蓝点缀、朱橙光）保留原色。
     --tone klein 蓝调（灰阶按 炭黑 → 克莱因蓝 → 奶油白 映射，只给冷色情绪的极少数画面）；--tone ink 蓝黑墨（对比用，不推荐）
  --crop 先裁掉画面里伸到边上的部分（例如贯穿全图的地平线），再做模切
投影不烘焙：网页用 filter: drop-shadow，AE 用图层样式「投影」，方便调。"""
import json, os, sys
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
C = {k: np.array([int(v['hex'][i:i + 2], 16) for i in (1, 3, 5)], np.float32) for k, v in B['color'].items()}
args = sys.argv[1:]
pos_args, i = [], 0
while i < len(args):
    if args[i].startswith('--'): i += 2; continue
    pos_args.append(args[i]); i += 1
src, dst = pos_args[:2]
opt = lambda k, d: type(d)(args[args.index(k) + 1]) if k in args else d
BORDER, TONE, CLOSE, CROP = opt('--border', 10), opt('--tone', 'none'), opt('--close', 12), opt('--crop', '')

img = Image.open(src).convert('RGB')
if CROP: img = img.crop(tuple(int(v) for v in CROP.split(',')))
P = np.asarray(img).astype(np.float32)
lum = P.mean(2); sat = P.max(2) - P.min(2)
paper = np.percentile(lum, 90)
ink = (lum < paper - 28) | (sat > 48)

# 剪影：闭运算连排线 → 填洞 → 去碎点 → 平滑
st = ndimage.generate_binary_structure(2, 1)
sil = ndimage.binary_closing(np.pad(ink, CLOSE), st, iterations=CLOSE)[CLOSE:-CLOSE, CLOSE:-CLOSE]
sil = ndimage.binary_fill_holes(sil)
lab, n = ndimage.label(sil)
if not n: sys.exit('没找到墨迹：原图是不是纯白？')
sz = ndimage.sum(sil, lab, range(1, n + 1))
sil = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= sz.max() * 0.02])
sil = ndimage.gaussian_filter(sil.astype(np.float32), 3) > 0.5
sil = ndimage.binary_fill_holes(sil)

# 外扩描边（圆角）：到剪影的距离 ≤ BORDER 的范围；抗锯齿
pad = BORDER + 4
silp = np.pad(sil, pad)
dist = ndimage.distance_transform_edt(~silp)
alpha = np.clip(BORDER + 0.5 - dist, 0, 1)
inner = np.clip(1.5 - dist, 0, 1)                       # 剪影本身（1px 过渡）

# 调色
g = np.asarray(ImageOps.autocontrast(img.convert('L'), cutoff=0.5), np.float32) / 255
if TONE == 'klein':
    stops = B['imagery']['duotone']['klein']
    pos = np.array([s[0] for s in stops], np.float32); cols = np.stack([C[s[1]] for s in stops])
    mapped = np.stack([np.interp(g, pos, cols[:, k]) for k in range(3)], -1)
elif TONE == 'ink':      # 蓝黑墨：只有最深的墨线偏克莱因蓝，中间调保持中性的铅笔灰，纸是奶油白
    navy = C['char'] * 0.5 + C['klein'] * 0.5; grey = np.array([150, 145, 136], np.float32)
    pos = np.array([0, .18, .6, 1], np.float32); cols = np.stack([navy, navy * .6 + grey * .4, grey, C['cream']])
    mapped = np.stack([np.interp(g, pos, cols[:, k]) for k in range(3)], -1)
else:
    mapped = C['char'] + g[..., None] * (C['cream'] - C['char'])
w = np.clip((sat - 40) / 40, 0, 1)[..., None]            # 有颜色的像素（朱橙点缀）保留原色
rgb = mapped * (1 - w) + P * w
rgbp = np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)), mode='edge')
out = rgbp * inner[..., None] + C['cream'] * (1 - inner[..., None])
o = Image.fromarray(np.dstack([out, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
o = o.crop(o.getchannel('A').getbbox())
o.save(dst)
print(dst, o.size)
