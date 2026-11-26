#!/usr/bin/env python3
"""由 tokens/brand.json 生成 engine/tokens.css（CSS 变量 + 场景类）。
用法：python3 tools/gen_tokens.py        改了 brand.json 之后必须重新运行，tokens.css 不要手改。"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
C = {k: v['hex'] for k, v in B['color'].items()}
F, T, LY = B['font'], B['type'], B['layout']

out = ['/* 自动生成：python3 tools/gen_tokens.py ← tokens/brand.json（v%s）。不要手改。 */' % B['version'], ':root{']
for k, v in B['color'].items():
    out.append(f'  --{k.replace("_", "-")}:{v["hex"]};  /* {v["name"]} */')
out += [
    f'  --f-disp:"{F["display"]["family"]}","{F["cn"]["family"]}",sans-serif;',
    f'  --f-cn:"{F["cn"]["family"]}",sans-serif;',
    f'  --f-num:"{F["num"]["family"]}","{F["cn"]["family"]}",sans-serif;',
    f'  --f-mono:"{F["mono"]["family"]}","{F["cn"]["family"]}",monospace;',
    f'  --t-subtitle:{T["subtitle"]}px; --t-min:{T["meaningful_min"]}px; --t-title-min:{T["title_min"]}px; --t-decor-min:{T["decor_min"]}px;',
    f'  --margin-x:{LY["margin_x"]}px; --grid:{LY["grid"]}px; --sub-bottom:{LY["subtitle"]["bottom"]}px;',
]
for k, (w, h) in LY['size_class'].items():
    out.append(f'  --sz-{k}-w:{w}px; --sz-{k}-h:{h}px;')
out.append('}')


def var(name): return f'var(--{name.replace("_", "-")})'


for sid, s in B['scene'].items():
    if sid == 'FX': continue
    bg = s['bg']
    grad = (f'radial-gradient(circle at 72% 46%,{var("char_hi")} 0,{var("char")} 58%,{var("char_lo")} 100%)'
            if bg == 'char' else var(bg))
    sub = s['subtitle']
    out += [
        f'/* 场景 {sid} · {s["name"]}：{s["usage"]} */',
        f'.scene-{sid}{{background:{grad};color:{var(s["text"]["body"])};'
        f'--s-title:{var(s["text"]["title"])};--s-accent:{var(s["text"]["accent"])};'
        f'--s-blk:{var(s["block"]["accent"][0])};--s-blk-fg:{var(s["block"]["accent"][1])};'
        f'--s-aux:{var(s["block"]["aux"][0])};--s-aux-fg:{var(s["block"]["aux"][1])};'
        f'--s-card:{var(s["card"][0])};--s-card-fg:{var(s["card"][1])};'
        f'--s-sub:{var(sub["bg"])};--s-sub-fg:{var(sub["fg"])};--s-sub-em:{var(sub["em"])};'
        f'--s-line:{var(s["line"]["color"])};--s-line-op:{s["line"]["opacity"]};--s-focus:{var(s["focus"])}}}',
    ]
open(os.path.join(ROOT, 'engine', 'tokens.css'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('engine/tokens.css 已生成')
