#!/usr/bin/env python3
"""抠图成透明底 PNG。迁自 aiwei-vs2/tools/cutout.py，加了「补洞」和「清残影」。

用法：python3 -I tools/cutout.py object|person 输入.png 输出.png [--largest] [--fill-holes]
  object        物件 / 贴纸（isnet-general-use）
  person        人像（u2net_human_seg，对深色衣服更稳）
  --largest     只保留最大的一块（去掉多余的小物件、碎片）；默认保留 ≥ 最大块 3% 的块
  --fill-holes  把物件内部被误抠成透明的区域补回来（盾牌、徽章这类实心物件用）
                ⚠ 锁、钥匙、甜甜圈这类本来就有镂空的物件不要加，否则镂空会被填成灰色
处理完会清掉低透明度的残影（例如投影的淡灰色），并按内容裁边。"""
import sys
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

mode, src, dst = sys.argv[1:4]
largest, fill = '--largest' in sys.argv, '--fill-holes' in sys.argv
rgb = Image.open(src).convert('RGB')
a = np.array(remove(rgb, session=new_session('u2net_human_seg' if mode == 'person' else 'isnet-general-use')))

solid = a[:, :, 3] > 128
lab, k = ndimage.label(solid)
if k > 1:
    sz = ndimage.sum(solid, lab, range(1, k + 1))
    keep = [i + 1 for i, v in enumerate(sz) if v >= sz.max() * (0.999 if largest else 0.03)]
    solid = np.isin(lab, keep)
if fill:
    full = ndimage.binary_fill_holes(solid)
    a[:, :, :3][full & ~solid] = np.array(rgb)[full & ~solid]
    a[:, :, 3][full & ~solid] = 255
    solid = full
a[:, :, 3][~ndimage.binary_dilation(solid, iterations=3)] = 0   # 清残影：只保留主体及其 3px 羽化边

o = Image.fromarray(a)
o = o.crop(o.split()[3].getbbox())
o.save(dst)
print(dst, o.size)
