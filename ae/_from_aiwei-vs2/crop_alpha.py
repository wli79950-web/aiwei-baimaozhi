#!/usr/bin/env python3
"""把 html_capture.js 截出的透明 PNG 按内容裁掉四周透明区（减少 AE 内存），同步改 capture.json 里的坐标。文字块坐标是画面绝对坐标，不受影响。
用法：python3 -I ae/crop_alpha.py <截图目录>"""
import json, os, sys
from PIL import Image
d = sys.argv[1]; M = json.load(open(os.path.join(d, 'capture.json'))); n = 0
for f, m in M.items():
    p = os.path.join(d, f)
    if not f.endswith('.png') or not os.path.exists(p): continue
    im = Image.open(p)
    if im.mode != 'RGBA': continue
    bb = im.split()[3].point(lambda v: 255 if v > 2 else 0).getbbox() or (0, 0, 2, 2)
    x0, y0, x1, y1 = max(0, bb[0] - 2), max(0, bb[1] - 2), min(im.width, bb[2] + 2), min(im.height, bb[3] + 2)
    if (x0, y0, x1, y1) != (0, 0, im.width, im.height):
        im.crop((x0, y0, x1, y1)).save(p); m['x'] += x0; m['y'] += y0; m['w'] = x1 - x0; m['h'] = y1 - y0; n += 1
json.dump(M, open(os.path.join(d, 'capture.json'), 'w'), ensure_ascii=False)
print('cropped', n, 'of', len(M))
