#!/usr/bin/env python3
"""把截图透视贴进 device 风格照片的白屏里（P5）。
用法：python3 -I tools/device_paste.py 照片.png 截图.png 输出.png [--white 232] [--feather 1]
  1. 找屏幕：亮度 ≥ --white、饱和度低的像素里最大的一块（device 提示词要求「纯白空屏」）
  2. 四个角：x+y 最小 / x−y 最大 / x+y 最大 / x−y 最小 → 左上 / 右上 / 右下 / 左下
  3. 截图按四个角做透视变换贴上去，再用屏幕本身的形状做遮罩：圆角、刘海、手指压住的地方都保留照片原样
截图保留原色（用户素材不调色）；照片本身要过 tools/grade.py 的话，先调色再贴截图。"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
photo_p, shot_p, out_p = args[:3]
WHITE, FEATHER = opt('--white', 225), opt('--feather', 1)

photo = Image.open(photo_p).convert('RGB'); P = np.asarray(photo).astype(np.int16)
lum = P.mean(axis=2); sat = P.max(axis=2) - P.min(axis=2)
cand = (lum >= WHITE) & (sat <= 30)   # 调过色的照片白屏是奶油白（饱和差约 22）
lab, n = ndimage.label(cand)
if not n: sys.exit('没找到白屏：调低 --white，或确认照片是纯白空屏')
sizes = ndimage.sum(cand, lab, range(1, n + 1))
screen = ndimage.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
if screen.sum() < 0.02 * screen.size: sys.exit('白色区域太小，不像手机屏幕')
ys, xs = np.nonzero(screen)
s, d = xs + ys, xs - ys
rough = np.array([[xs[s.argmin()], ys[s.argmin()]], [xs[d.argmax()], ys[d.argmax()]],
                  [xs[s.argmax()], ys[s.argmax()]], [xs[d.argmin()], ys[d.argmin()]]], float)
# 圆角会让极值点落在角的内侧：对四条边各自拟合直线（只用边中段 15%–85% 的边界点），再求相邻两边的交点当真正的角
edge = screen & ~ndimage.binary_erosion(screen)
ey, ex = np.nonzero(edge); E = np.stack([ex, ey], 1).astype(float)
lines = []
for i in range(4):
    p0, p1 = rough[i], rough[(i + 1) % 4]; v = p1 - p0; L = np.linalg.norm(v); u = v / L; nrm = np.array([-u[1], u[0]])
    t = (E - p0) @ u / L; dist = np.abs((E - p0) @ nrm)
    pts = E[(t > .15) & (t < .85) & (dist < max(6, .04 * L))]
    if len(pts) < 10: lines.append((p0, u)); continue
    c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c); lines.append((c, vt[0]))
def meet(a, b):
    (c1, d1), (c2, d2) = a, b
    t = np.linalg.solve(np.array([d1, -d2]).T, c2 - c1); return c1 + t[0] * d1
quad = np.array([meet(lines[(i - 1) % 4], lines[i]) for i in range(4)])

shot = Image.open(shot_p).convert('RGB'); w, h = shot.size
src = np.array([[0, 0], [w, 0], [w, h], [0, h]], float)
# PIL 的 PERSPECTIVE 系数：把输出（照片）坐标映射回输入（截图）坐标
A, b = [], []
for (x, y), (u, v) in zip(quad, src):
    A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
coef = np.linalg.solve(np.array(A), np.array(b))
warped = shot.transform(photo.size, Image.PERSPECTIVE, tuple(coef), Image.BICUBIC)
mask = Image.fromarray((ndimage.binary_dilation(screen, iterations=2) * 255).astype(np.uint8))
if FEATHER: mask = mask.filter(ImageFilter.GaussianBlur(FEATHER))
out = photo.copy(); out.paste(warped, (0, 0), mask)
out.save(out_p)
print(out_p, '屏幕四角', quad.astype(int).tolist())
