"""Per-character font coverage for AE text layers.
annotate(layers): adds o['runs']=[[start,end,fallbackFont],...] for characters the layer font cannot render,
and raises if even the fallback cannot render a character (so a missing glyph can never reach AE)."""
import glob, json, os
from fontTools.ttLib import TTFont
HERE = os.path.dirname(os.path.abspath(__file__))
FS = os.path.join(HERE, '../engine/node_modules/@fontsource')
JB = os.path.join(HERE, '../fonts')
CACHE = os.path.join(HERE, 'fontcov_cache.json')
SRC = {
 'NotoSansSC-Black': glob.glob(f'{FS}/noto-sans-sc/files/*-900-normal.woff2'),
 'NotoSansSC-Bold': glob.glob(f'{FS}/noto-sans-sc/files/*-700-normal.woff2'),
 'NotoSansSC-Medium': glob.glob(f'{FS}/noto-sans-sc/files/*-500-normal.woff2'),
 'NotoSansSC-Regular': glob.glob(f'{FS}/noto-sans-sc/files/*-400-normal.woff2'),
 'NotoSerifSC-Black': glob.glob(f'{FS}/noto-serif-sc/files/*-900-normal.woff2'),
 'NotoSerifSC-Bold': glob.glob(f'{FS}/noto-serif-sc/files/*-700-normal.woff2'),
 'JetBrainsMono-Regular': [f'{JB}/JetBrainsMono_400Regular.ttf'],
 'SpaceGrotesk-Medium': [f'{JB}/SpaceGrotesk_500Medium.ttf'],
 'JetBrainsMono-Bold': [f'{JB}/JetBrainsMono_700Bold.ttf'],
 'JetBrainsMono-Medium': [f'{JB}/JetBrainsMono_500Medium.ttf'],
 'SpaceGrotesk-Bold': [f'{JB}/SpaceGrotesk_700Bold.ttf'],
 # 2.2 新字体（拉丁字体随包附带；优设标题黑只用网页切片算覆盖，AE 端需用户自行安装）
 'YouSheBiaoTiHei': glob.glob(os.path.join(HERE, '../engine/node_modules/@chinese-fonts/ysbth/dist/*/*.woff2')),
 'Tinos-Italic': [f'{JB}/Tinos_400Italic.ttf'],
 'Tinos-BoldItalic': [f'{JB}/Tinos_700BoldItalic.ttf'],
 'Arimo-BoldItalic': [f'{JB}/Arimo_700BoldItalic.ttf'],
 'CourierPrime-Bold': [f'{JB}/CourierPrime_700Bold.ttf'],
 'Caveat-Bold': [f'{JB}/Caveat_700Bold.ttf'],
}
FALLBACK = {'JetBrainsMono-Bold': 'NotoSansSC-Bold', 'JetBrainsMono-Medium': 'NotoSansSC-Medium', 'JetBrainsMono-Regular': 'NotoSansSC-Regular',
            'SpaceGrotesk-Bold': 'NotoSansSC-Black', 'SpaceGrotesk-Medium': 'NotoSansSC-Medium', 'NotoSerifSC-Black': 'NotoSansSC-Black', 'NotoSerifSC-Bold': 'NotoSansSC-Bold',
            'YouSheBiaoTiHei': 'NotoSansSC-Black', 'Tinos-Italic': 'NotoSerifSC-Bold', 'Tinos-BoldItalic': 'NotoSerifSC-Bold', 'Arimo-BoldItalic': 'NotoSansSC-Bold',
            'CourierPrime-Bold': 'NotoSansSC-Bold', 'Caveat-Bold': 'NotoSansSC-Bold'}
def _load():
    if os.path.exists(CACHE):
        c = json.load(open(CACHE))
        if set(c) >= set(SRC): return {k: set(v) for k, v in c.items()}
    m = {}
    for k, paths in SRC.items():
        s = set()
        for p in paths: s |= set(TTFont(p).getBestCmap().keys())
        if not s: raise RuntimeError('font source missing: ' + k)
        m[k] = s
    json.dump({k: sorted(v) for k, v in m.items()}, open(CACHE, 'w')); return m
CMAP = _load()
SKIP = set('\r\n ')
def covered(font, ch): return ch in SKIP or ord(ch) in CMAP[font]
def annotate(layers, where=''):
    for o in layers:
        if o.get('k') != 'txt': continue
        f, txt, runs, cur = o['font'], o['text'], [], None
        for i, ch in enumerate(txt):
            need = not covered(f, ch)
            if need:
                fb = FALLBACK.get(f)
                if not fb or not covered(fb, ch):
                    raise SystemExit(f'缺字形: {where}/{o["name"]} 字符「{ch}」U+{ord(ch):04X} 字体 {f} 及其备用字体都没有')
                if cur and cur[1] == i and cur[2] == fb: cur[1] = i + 1
                else: cur = [i, i + 1, fb]; runs.append(cur)
        if runs: o['runs'] = runs
    return layers

def fix_runs(text, runs, where=''):
    """多字体文字块：逐字检查 run 的字体有没有这个字，没有就切到备用字体（拆分 run）；备用也没有就报错"""
    out = []
    for r in runs:
        for i in range(r['s'], r['e']):
            ch = text[i]; f = r['font']
            if not covered(f, ch):
                fb = FALLBACK.get(f)
                if not fb or not covered(fb, ch): raise SystemExit(f'缺字形: {where} 字符「{ch}」U+{ord(ch):04X} 字体 {f} 及其备用字体都没有')
                f = fb
            nr = dict(r, s=i, e=i + 1, font=f)
            if out and out[-1]['e'] == i and all(out[-1][k] == nr[k] for k in ('font', 'color', 'size', 'track')): out[-1]['e'] = i + 1
            else: out.append(nr)
    return out
