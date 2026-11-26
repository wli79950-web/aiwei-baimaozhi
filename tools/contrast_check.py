#!/usr/bin/env python3
"""配色对比度检查：读 tokens/brand.json，逐个场景核对「字 / 底」组合是否达标。

用法：python3 tools/contrast_check.py            （在仓库根目录运行）
规则：正文和小字 ≥ text_min（4.5）；≥ large_px 的粗体或色块 ≥ large_min（3.0）；
      contrast.forbidden 里的组合必须 < large_min，并且不得出现在任何场景定义里。
有任何一项不达标就以退出码 1 结束。"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
C = {k: v['hex'] for k, v in B['color'].items()}
TEXT, LARGE = B['contrast']['text_min'], B['contrast']['large_min']


def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def ratio(a, b):
    la, lb = lum(C[a]), lum(C[b])
    return (max(la, lb) + .05) / (min(la, lb) + .05)


rows, bad, used = [], [], set()


def check(scene, what, fg, bg, need):
    r = ratio(fg, bg); used.add((fg, bg))
    ok = r >= need; rows.append((scene, what, fg, bg, r, need, ok))
    if not ok: bad.append(rows[-1])


for sid, s in B['scene'].items():
    if sid == 'FX': continue
    bg = s['bg']
    check(sid, '标题', s['text']['title'], bg, TEXT)
    check(sid, '正文', s['text']['body'], bg, TEXT)
    check(sid, '重点字', s['text']['accent'], bg, TEXT)
    for k, (blk, fg) in s['block'].items():
        check(sid, {'accent': '重点色块上的字', 'aux': '辅助色块上的字'}.get(k, k), fg, blk, TEXT)
    check(sid, '信息卡', s['card'][1], s['card'][0], TEXT)
    if 'card_lit' in s: check(sid, '亮卡', s['card_lit'][1], s['card_lit'][0], TEXT)
    sub = s['subtitle']
    check(sid, '字幕', sub['fg'], sub['bg'], TEXT)
    check(sid, '字幕关键词', sub['em'], sub['bg'], TEXT)

for fg, bg, why in B['contrast']['forbidden']:
    r = ratio(fg, bg)
    if r >= LARGE: bad.append(('禁用', f'禁用组合反而达标，规则需复核：{why}', fg, bg, r, LARGE, False))
    if (fg, bg) in used: bad.append(('禁用', f'场景定义里用了禁用组合：{why}', fg, bg, r, LARGE, False))

name = {k: v['name'] for k, v in B['color'].items()}
print(f'{"场景":<4}{"用途":<14}{"字":<8}{"底":<8}{"对比":>6}  要求')
for sc, what, fg, bg, r, need, ok in rows:
    print(f'{sc:<5}{what:<13}{name[fg]:<7}{name[bg]:<7}{r:>6.2f}  ≥{need}  {"✓" if ok else "✗"}')
print('\n禁用组合：')
for fg, bg, why in B['contrast']['forbidden']:
    print(f'  ✕ {name[fg]} / {name[bg]}  {ratio(fg, bg):.2f}  {why}')
if bad:
    print(f'\n✗ {len(bad)} 项不通过：'); [print('  ', b[0], b[1], name.get(b[2], b[2]), '/', name.get(b[3], b[3]), f'{b[4]:.2f}') for b in bad]
    sys.exit(1)
print(f'\n✓ 全部 {len(rows)} 项通过')
