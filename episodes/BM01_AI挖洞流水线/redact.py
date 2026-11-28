#!/usr/bin/env python3
"""BM01 截图打码：按《打码清单.md》把要遮的区域盖成炭灰实色块（遮死，不透原文），输出到 assets/shots/。
原图不动（footage/src/ 不进 git）；坐标是原图像素 (x0, y0, x1, y1)。
用法（仓库根目录）：python -I episodes/BM01_AI挖洞流水线/redact.py"""
import json, os
from PIL import Image, ImageDraw

EP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(EP))
SRC = os.path.join(EP, 'footage', 'src', '图片和附件')
OUT = os.path.join(EP, 'assets', 'shots'); os.makedirs(OUT, exist_ok=True)
SLATE = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))['color']['slate']['hex']

# 输出名: (原文件名, [遮挡框])
JOBS = {
    'bounty_3000': ('image 1.png', [(176, 316, 538, 384)]),                                    # 对方户名 + 账号
    'bounty_5000_notice': ('image 2.png', [(120, 100, 260, 230)]),                             # 平台图标
    'bounty_800': ('image 4.png', []), 'bounty_1000': ('image 10.png', []),
    'bounty_3500': ('image 12.png', []), 'bounty_4000': ('image 14.png', []), 'bounty_10000': ('image 6.png', []),
    'src_risk_levels': ('image 13.png', []),
    'src_template': ('image 5.png', [(270, 0, 650, 117), (2935, 822, 3040, 930), (625, 1466, 1020, 1518), (446, 1512, 1565, 1662)]),
    'python_tool': ('image.png', []),
    'python_keys': ('lQLPKINDUVhx7QXNA3nNA--wJvLNASyRKXMK12WPKbhqAA_1007_889.png', [(88, 529, 470, 551), (88, 551, 395, 573), (140, 617, 620, 639), (140, 639, 620, 661)]),
    'payload_74cms': ('局部截取_20261126_161329.png', [(600, 12, 870, 70), (1090, 1105, 2620, 1152), (1040, 1380, 2620, 1426)]),
    'payload_weblogic': ('image 8.png', [(0, 0, 600, 46), (1225, 0, 1660, 64), (395, 331, 900, 363), (395, 362, 875, 393), (493, 391, 1672, 423)]),
    'ask_how_to_hack': ('Doubao.exe_20261127_172215.png', [(580, 1704, 852, 1778), (2966, 572, 3072, 1460)]),
    'refuse_baidu': ('Doubao.exe_20261126_221158.png', [(1628, 1155, 1906, 1210), (698, 1347, 920, 1402), (580, 1704, 852, 1778), (3040, 885, 3072, 1010)]),
    'refuse_lan': ('1795771002608_局部截取_20261127_171638.png', [(196, 1093, 443, 1161)]),
    'refuse_scope': ('局部截取_20261126_221351.png', [(197, 691, 476, 767)]),
    'recon_scope': ('image 3.png', [(330, 340, 625, 388), (713, 398, 1856, 440), (713, 453, 1856, 477), (676, 488, 1362, 518), (713, 658, 1110, 680), (713, 680, 1856, 738), (713, 766, 1856, 792)]),
    'match_list': ('image 9.png', [(733, 222, 1022, 642), (1432, 276, 1645, 600), (347, 357, 600, 383)]),
    'report_req': ('局部截取_20261126_164655.png', []), 'report_resp': ('局部截取_20261126_164706.png', []),
    'report_shots': ('局部截取_20261126_164729.png', []), 'report_full': ('局部截取_20261126_164741.png', []),
    'report_fix': ('局部截取_20261126_164918.png', []),
}
for name, (src, boxes) in JOBS.items():
    im = Image.open(os.path.join(SRC, src)).convert('RGB'); d = ImageDraw.Draw(im)
    for b in boxes: d.rounded_rectangle(b, radius=6, fill=SLATE)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print(name, im.size, len(boxes))
