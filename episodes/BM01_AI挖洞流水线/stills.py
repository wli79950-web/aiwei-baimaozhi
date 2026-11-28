#!/usr/bin/env python3
"""BM01 实拍 / 录屏静帧：从 footage/stills/ 裁切 + 打码（马赛克）→ assets/photos/。
（用户实拍的动态版在渲染阶段换回；Logo、烧录字幕、真实域名按《打码清单》处理。）"""
import os
from PIL import Image
EP = os.path.dirname(os.path.abspath(__file__)); I = os.path.join(EP, 'footage', 'stills'); O = os.path.join(EP, 'assets', 'photos'); os.makedirs(O, exist_ok=True)
def mosaic(im, b, k=18):
    r = im.crop(b); w, h = r.size; r = r.resize((max(1, w // k), max(1, h // k)), Image.BILINEAR).resize((w, h), Image.NEAREST); im.paste(r, b)
JOBS = {  # 名字: (裁切框 或 None, [马赛克框])
    'sleep': ((0, 150, 1080, 1530), []),
    'devapp': ((0, 120, 720, 1160), [(150, 435, 255, 480), (560, 840, 670, 885)]),
    'grad': ((0, 200, 720, 1240), [(0, 430, 95, 480)]),
    'college': ((0, 120, 1080, 1380), []),
    'laptop': ((420, 0, 1700, 960), [(880, 450, 1120, 640)]),
    'progday': ((0, 120, 720, 1180), [(190, 540, 330, 595)]),
    'rec021939': ((0, 0, 1916, 940), [(733, 150, 1030, 940), (355, 355, 610, 382)]),
}
for n, (crop, boxes) in JOBS.items():
    im = Image.open(os.path.join(I, n + '.png')).convert('RGB')
    for b in boxes: mosaic(im, b)
    if crop: im = im.crop(crop)
    im.save(os.path.join(O, n + '.jpg'), quality=90); print(n, im.size)
