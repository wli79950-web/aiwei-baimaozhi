#!/usr/bin/env python3
"""统一调色：让写实、动漫等不同风格的生图和白帽志画面接得上（视觉系统 1.4）。
物件保留本来的颜色，只统一「调子」；参数在 tokens/brand.json → imagery.grade。
用法：python3 -I tools/grade.py 输入.png 输出.png [--sat 0.3]      （一般接在 tools/cutout.py 之后）
  --sat     所有色相统一用这个饱和度系数（类别 3 · 氛围装饰用 0.3：不带朱橙，不抢焦点）
  1. 朱橙附近的色相保留饱和度（keep_sat），其他色相压低（other_sat）：绿灯、蓝光、紫光这类杂色被压下去，朱橙仍是唯一的高饱和点。
  2. 色调范围映射：纯黑 → 炭黑，纯白 → 奶油白。暗部和炭黑底接得上，亮部偏暖，不出现冷白。
透明通道原样保留。用户提供的截图、录屏不要过这一步（保留原色）。"""
import colorsys, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
G, C = B['imagery']['grade'], {k: v['hex'] for k, v in B['color'].items()}
rgb01 = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
HUE = colorsys.rgb_to_hsv(*rgb01(C[G['keep_hue']]))[0] * 360

src, dst = sys.argv[1:3]
SAT = float(sys.argv[sys.argv.index('--sat') + 1]) if '--sat' in sys.argv else None
im = Image.open(src).convert('RGBA')
alpha = im.getchannel('A')
hsv = np.array(im.convert('RGB').convert('HSV')).astype(np.float32)
h = hsv[:, :, 0] / 255 * 360
d = np.minimum(np.abs(h - HUE), 360 - np.abs(h - HUE))                     # 离朱橙色相的角距离
w = np.clip(1 - (d - G['keep_within_deg']) / G['feather_deg'], 0, 1)
hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (SAT if SAT is not None else (G['keep_sat'] * w + G['other_sat'] * (1 - w))), 0, 255)
rgb = np.array(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float32) / 255
lo, hi = rgb01(C[G['black']]), rgb01(C[G['white']])
out = Image.fromarray(((lo + rgb * (hi - lo)) * 255 + .5).clip(0, 255).astype(np.uint8), 'RGB')
out.putalpha(alpha)
out.save(dst)
print(dst)
