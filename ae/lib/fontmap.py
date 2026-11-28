#!/usr/bin/env python3
"""字体覆盖表（AE 导出用）：网页上每个字实际用哪个字体渲染，AE 里就设成同一个字体的 PostScript 名。
用法：python3 -I ae/lib/fontmap.py 输出.json
  · 网页字体来自 engine/base.css 的 @import（npm 包里的 @font-face，按 unicode-range 分片）
  · AE 字体是 fonts/ 里随包附带的 .ttf，PostScript 名直接从字体文件读（不手写）
  · 覆盖范围 = 网页分片声明的 unicode-range ∩ .ttf 实际有的字形：两边都有的字，网页和 AE 才是同一个字体
输出：{faces: [{family, weight, ps, file, ranges: [[起, 止], …]}]}，family 一律小写。
--patch engine/fonts_patch.css：同时生成补字规则——MiSans 的 npm 网页分片缺一部分字（全角？～＝＋％、生僻字等，网页会落到系统字体），
  用随包 .ttf 补上（unicode-range 只列缺的字），网页和 AE 就是同一个字形。补上以后 MiSans 的覆盖范围 = .ttf 全部字形。"""
import json, os, re, sys
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))['font']
# 网页 family + 字重 → 随包 .ttf（从 brand.json 的 font 节读）
TTF = {}
for k, f in B.items():
    fam = f['family'].lower()
    if 'weights' in f:
        for w, ps in f['weights'].items():
            TTF[(fam, int(w))] = next(x for x in f['files'] if ps.split('-')[-1].lower() in x.lower())
    else:
        TTF[(fam, int(f.get('weight', 400)))] = f['file']

def css_faces(css_path, seen):
    if css_path in seen or not os.path.exists(css_path) or os.path.basename(css_path) == 'fonts_patch.css': return []
    seen.add(css_path); txt = open(css_path, encoding='utf-8').read(); out = []
    for imp in re.findall(r'@import\s+(?:url\()?["\']([^"\']+)["\']', txt):
        out += css_faces(os.path.normpath(os.path.join(os.path.dirname(css_path), imp)), seen)
    for blk in re.findall(r'@font-face\s*{([^}]*)}', txt):
        fam = re.search(r'font-family:\s*["\']?([^;"\']+)', blk).group(1).strip().lower()
        wm = re.search(r'font-weight:\s*(\d+)', blk); w = int(wm.group(1)) if wm else 400
        um = re.search(r'unicode-range:\s*([^;]+)', blk)
        rngs = []
        if um:
            for part in um.group(1).split(','):
                part = part.strip().upper().replace('U+', '')
                if '?' in part: a, b = int(part.replace('?', '0'), 16), int(part.replace('?', 'F'), 16)
                elif '-' in part: a, b = (int(x, 16) for x in part.split('-'))
                else: a = b = int(part, 16)
                rngs.append((a, b))
        else: rngs.append((0, 0x10FFFF))
        out.append((fam, w, rngs))
    return out

faces = {}
for fam, w, rngs in css_faces(os.path.join(ROOT, 'engine', 'base.css'), set()):
    faces.setdefault((fam, w), []).extend(rngs)
def to_ranges(cps):
    ranges, s = [], None
    for c in sorted(cps):
        if s is None: s = p = c
        elif c == p + 1: p = c
        else: ranges.append([s, p]); s = p = c
    if s is not None: ranges.append([s, p])
    return ranges

PATCH = sys.argv[sys.argv.index('--patch') + 1] if '--patch' in sys.argv else None
res, patch = [], []
for (fam, w), rngs in sorted(faces.items()):
    f = TTF.get((fam, w))
    if not f: sys.exit(f'网页字体 {fam} {w} 在 brand.json 的 font 节里没有对应的随包 .ttf')
    t = TTFont(os.path.join(ROOT, f)); ps = t['name'].getDebugName(6); cmap = set(t.getBestCmap())
    web = set(c for c in cmap if any(a <= c <= b for a, b in rngs))
    if fam == 'misans':
        miss = to_ranges(cmap - web)
        patch.append(f"@font-face{{font-family:MiSans;font-weight:{w};font-style:normal;font-display:block;src:url(../{f}) format('truetype');"
                     f"unicode-range:{','.join(('U+%X' % a) if a == b else ('U+%X-%X' % (a, b)) for a, b in miss)}}}")
        web = cmap
    res.append({'family': fam, 'weight': w, 'ps': ps, 'file': f, 'ranges': to_ranges(web)})
if PATCH:
    open(os.path.join(ROOT, PATCH), 'w', encoding='utf-8').write(
        '/* 自动生成：python3 -I ae/lib/fontmap.py <输出.json> --patch engine/fonts_patch.css。不要手改。\n'
        '   MiSans 的 npm 网页分片缺的字（全角？～＝＋％、部分生僻字等）用随包 .ttf 补上：网页和 AE 是同一个字形，不会落到系统字体。 */\n' + '\n'.join(patch) + '\n')
json.dump({'faces': res}, open(sys.argv[1], 'w'), ensure_ascii=False)
print(sys.argv[1], ', '.join(f"{r['family']} {r['weight']} → {r['ps']}（{sum(b - a + 1 for a, b in r['ranges'])} 字）" for r in res))
