#!/usr/bin/env python3
"""统一调色（候选）：让不同风格的图片和白帽志画面接得上。不改物件本来的颜色，只统一「调子」。
用法：python3 -I grade.py 输入.png 输出.png
  1. 朱橙附近的色相（红—橙）保留 90% 饱和度，其他色相降到 50%：绿灯、紫光这类杂色被压下去，朱橙仍然是唯一的高饱和点。
  2. 色调范围映射：纯黑 → 炭黑 #16130F，纯白 → 奶油白 #F5EEDF。暗部和炭黑底接得上，亮部偏暖，不出现冷白。
透明通道原样保留。"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1:3]
im = Image.open(src).convert('RGBA')
alpha = im.getchannel('A')
hsv = np.array(im.convert('RGB').convert('HSV')).astype(np.float32)
h = hsv[:, :, 0] / 255 * 360
d = np.minimum(np.abs(h - 16), 360 - np.abs(h - 16))          # 离朱橙色相（约 16°）的角距离
w = np.clip(1 - (d - 14) / 20, 0, 1)                          # 14° 以内完全保留，34° 以外按其他色相处理
hsv[:, :, 1] *= 0.9 * w + 0.5 * (1 - w)
rgb = np.array(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float32) / 255
lo, hi = np.array([22, 19, 15]) / 255, np.array([245, 238, 223]) / 255
rgb = lo + rgb * (hi - lo)
out = Image.fromarray((rgb * 255 + .5).clip(0, 255).astype(np.uint8), 'RGB')
out.putalpha(alpha)
out.save(dst)
print(dst)
