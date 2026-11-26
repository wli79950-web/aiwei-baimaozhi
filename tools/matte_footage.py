#!/usr/bin/env python3
"""口播视频逐帧抠像（人像专用模型 u2net_human_seg）。
用法：python3 -I tools/matte_footage.py 帧目录 输出目录 起始帧 结束帧 [x0 y0 x1 y1 裁切框]
帧目录里是 ffmpeg 抽出的 a_00001.jpg…（30fps 原片：ffmpeg -i aroll.mp4 -q:v 2 帧目录/a_%05d.jpg）"""
import os, sys
from rembg import remove, new_session
from PIL import Image
fd, od, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
box = tuple(map(int, sys.argv[5:9])) if len(sys.argv) >= 9 else None
os.makedirs(od, exist_ok=True); s = new_session('u2net_human_seg')
for i in range(a, b + 1):
    out = f'{od}/c_{i:05d}.png'
    if os.path.exists(out): continue
    im = Image.open(f'{fd}/a_{i:05d}.jpg').convert('RGB')
    if box: im = im.crop(box)
    remove(im, session=s).save(out); print(i, flush=True)
