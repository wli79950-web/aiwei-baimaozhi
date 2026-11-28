#!/usr/bin/env python3
"""一键生成一期的 AE 重建包（P6）：字体覆盖表 → 导出镜头（网页同一份镜头描述）→ 裁 PNG → 拼脚本 → 分层检查 → 收素材 / 字体 → 模拟 AE 测试 → zip。

用法：python3 ae/build_ae.py <期目录或 episode.json>     （示例：python3 ae/build_ae.py ae/examples/demo）
产物：<期目录>/build/<前缀>_AE重建包/ 和 同名 .zip（build/ 不进 git）
  · <前缀>_AE重建.jsx：在 AE 里「文件 → 脚本 → 运行脚本文件」
  · assets/：背景板、背景动态层（PNG，SVG 原件在 assets/svg/）、每个画面元素的透明 PNG、录屏原片
  · fonts/：随包字体（得意黑 / MiSans / Archivo / IBM Plex Mono）· 还原对比/：用导出的图层拼回去和原画面的对比
  · 模拟测试报告.txt：按你的 AE 24.6.2 探测报告模拟运行的结果（没有在真 AE 里跑过）
episode.json：{id, title, prefix, voice?, sfx?: [{name, file, t}], shots: [{id, layout, dur, …镜头描述（engine/shot.js）}]}
"""
import json, os, re, shutil, subprocess, sys, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arg = os.path.abspath(sys.argv[1])
EPF = arg if arg.endswith('.json') else os.path.join(arg, 'episode.json')
EPDIR = os.path.dirname(EPF)
EP = json.load(open(EPF, encoding='utf-8'))
PREFIX = EP.get('prefix') or EP['id']
BUILD = os.path.join(EPDIR, 'build'); WORK = os.path.join(BUILD, 'ae_work'); os.makedirs(WORK, exist_ok=True)
BRAND = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
BAR = BRAND['layout']['chapter_bar']['h']
OPA_FX = {'rise', 'drop', 'unfold'}
errs, warns = [], []

def run(cmd, **kw):
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, **kw)
    if r.returncode: print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit('✗ 失败：' + ' '.join(cmd[:3]))
    return r.stdout

# 1) 字体覆盖表 + 导出
cover = os.path.join(WORK, 'fontcover.json')
run([sys.executable, '-I', os.path.join(ROOT, 'ae', 'lib', 'fontmap.py'), cover])
if os.environ.get('AE_SKIP_EXPORT') != '1':     # 调试打包步骤时可跳过导出（复用上次的 ae_work）
    print(run(['node', os.path.join(ROOT, 'ae', 'export_shots.js'), EPF, WORK, cover]).strip())
X = json.load(open(os.path.join(WORK, 'export.json'), encoding='utf-8'))
A = os.path.join(WORK, 'assets'); TR = os.path.join(WORK, 'trimmed'); shutil.rmtree(TR, ignore_errors=True); os.makedirs(TR)

# 2) 裁 PNG：去掉透明边（抠图时外扩了 120px 留投影），记下「实心」范围用来查章节进度条区
def trim(png):
    if not png: return None
    p = os.path.join(A, png['file']); im = Image.open(p); al = im.getchannel('A'); bb = al.getbbox()
    if not bb: return None
    k = im.width / png['w']                       # 2 倍像素
    im.crop(bb).save(os.path.join(TR, png['file']), optimize=True)
    solid = al.point(lambda v: 255 if v >= 26 else 0).getbbox() or bb
    out = dict(png, x=round(png['x'] + bb[0] / k, 2), y=round(png['y'] + bb[1] / k, 2), w=round((bb[2] - bb[0]) / k, 2), h=round((bb[3] - bb[1]) / k, 2))
    out['solid_top'] = round(png['y'] + solid[1] / k, 1)
    return out

def clean(s): return re.sub(r'[\r\n"\\]', ' ', s).strip()

# 3) SPEC
shots, fonts, used = [], set(), set()
for sh in X['shots']:
    names = {}
    def uniq(n, scope):
        n = clean(n)[:60]; k = (scope, n); c = names.get(k, 0); names[k] = c + 1
        return n if not c else f'{n} #{c + 1}'
    bg = [dict(L) for L in sh['bg']['layers']]
    for L in bg: used.add(L['file'])
    if not any(L['name'].startswith('背景板_') for L in bg): errs.append(f"{sh['name']}：没有单独的背景板层")
    units = []
    for u in sh['units']:
        if u['kind'] == 'sc':
            s = u['sc']; s['chrome'] = trim(s['chrome']); used.update([s['chrome']['file'], s['src']['file']])
            for l in s['labels']:
                l['png'] = trim(l['png']); used.add(l['png']['file']) if l['png'] else None
                for t in l['texts']: t['layer'] = uniq('标签·字：' + t['text'][:10], s['name']); [fonts.add(r['font']) for r in t['runs']]
                l['layer'] = uniq('标签', s['name'])
            if s['chrome']['solid_top'] < BAR - 1: errs.append(f"{sh['name']}：录屏窗口压到章节进度条区（y={s['chrome']['solid_top']}）")
            warns.extend(f"{sh['name']}：{w}" for w in s.pop('warn', []))
            units.append({'kind': 'sc', 'name': '录屏窗口', 'sc': s}); continue
        nodes = u['nodes']; kids = {n['parent'] for n in nodes if n['parent']}
        for n in nodes: n['png'] = trim(n['png'])
        nodes = [n for n in nodes if n['png'] or n['texts'] or n['id'] in kids or nodes.index(n) == 0]
        ids = {n['id']: n for n in nodes}
        pre = bool(u['tilt']) or len(nodes) > 1
        scope = sh['name'] + '·' + u['name'] if pre else sh['name']
        for j, n in enumerate(nodes):
            if n['parent'] and n['parent'] not in ids: n['parent'] = None
            # 图层名：page_aex 给的中文部件名（卡_c1_tier·行1 …）；文字层加上前几个字。同一个合成里不重名（表达式按名字找主层）
            base = clean(n['name'])[:48]
            if n['png']: n['layer'] = uniq(base, scope)
            elif n['texts']: n['layer'] = uniq(base + '：' + clean(n['texts'][0]['text'])[:10], scope)
            else: n['layer'] = uniq(base + '（空对象）', scope)
            for k, t in enumerate(n['texts']):
                t['layer'] = n['layer'] if (not n['png'] and k == 0) else uniq(base + '·字' + str(k + 1) + '：' + clean(t['text'])[:10], scope)
                for r in t['runs']: fonts.add(r['font'])
                if t['box'][1] < BAR - 1: errs.append(f"{sh['name']} / {u['name']}：文字「{t['text'][:10]}」压到章节进度条区（顶 y={t['box'][1]}）")
            if n['png']:
                used.add(n['png']['file'])
                if n['png']['solid_top'] < BAR - 1 and u['kind'] not in ('bokeh',): errs.append(f"{sh['name']} / {u['name']}：画面压到章节进度条区（顶 y={n['png']['solid_top']}）")
            n['rest'] = 100 if n['png'] else round(n['texts'][0]['op'] * 100) if n['texts'] else 100
            root = j == 0 and not n['sibling']
            n['fade'] = bool(n['fx'] in OPA_FX or (root and not pre and (u['fx'] in OPA_FX or sh['out'] is not None))
                             or (n['sibling'] and sh['out'] is not None) or (n['parent'] and ids[n['parent']].get('fade')))
        units.append({'kind': u['kind'], 'name': u['name'], 'pre': pre, 'tilt': u['tilt'], 'pivot': u['pivot'], 'fx': u['fx'], 'at': u['at'], 'o': u['o'], 'nodes': nodes})
    shots.append({'name': sh['name'], 'start': sh['start'], 'dur': sh['dur'], 'out': sh['out'], 'bg': bg, 'units': units})
    if sh['recon']['bad'] > 0.02: warns.append(f"{sh['name']}：还原对比有 {sh['recon']['bad'] * 100:.1f}% 的像素明显不同，看一下 还原对比/{sh['name']}.jpg")

SPEC = {'title': X['title'], 'prefix': PREFIX, 'mainName': PREFIX + '_主合成', 'dur': X['dur'], 'fps': BRAND['spec']['fps'],
        'fonts': sorted(fonts), 'shots': shots, 'voice': None, 'sfx': []}
for L in SPEC['shots']:
    for b in L['bg']: b.pop('svg', None)
if X['errs']: errs.extend(X['errs'])

# 4) 硬检查：分层（docs/rules/AE包规范.md）
for sh in shots:
    for u in sh['units']:
        for n in u.get('nodes', []):
            p = n['png']
            if p and p['x'] <= 0 and p['y'] <= 0 and p['w'] >= 1920 and p['h'] >= 1080 and u['kind'] not in ('bokeh',):
                errs.append(f"{sh['name']} / {u['name']}：整帧大小的图层（背景和内容没有分开？）")
if errs:
    print('✗ 拒绝打包：'); [print('  -', e) for e in errs]; sys.exit(1)

# 5) 拼脚本
def body(f):
    s = open(os.path.join(ROOT, 'ae', f), encoding='utf-8').read()
    return re.sub(r'^#include .*$', '', s, flags=re.M)
js = json.dumps(SPEC, ensure_ascii=False).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
jsx_name = PREFIX + '_AE重建.jsx'
src = (f'/* {X["title"]} · AE 重建脚本（白帽志 P6 生成器：python3 ae/build_ae.py）\n'
       f' * 用法：先装好 fonts/ 里的字体 → AE「文件 → 脚本 → 运行脚本文件」选本文件。素材在同目录 assets/ 下。\n'
       f' * 没有在真 AE 里测过：只在模拟 AE 对象模型（按你的 AE 24.6.2 探测报告）里跑通。 */\n'
       f'var SPEC = {js};\n' + body('motion_data.jsx') + '\n' + body('motion_ae.jsx') + '\n' + body('ae_lib.jsx'))
PKG = os.path.join(BUILD, PREFIX + '_AE重建包')
shutil.rmtree(PKG, ignore_errors=True); os.makedirs(os.path.join(PKG, 'assets', 'svg'))
open(os.path.join(PKG, jsx_name), 'w', encoding='utf-8').write(src)
for f in sorted(used): shutil.copy(os.path.join(TR, f) if os.path.exists(os.path.join(TR, f)) else os.path.join(A, f), os.path.join(PKG, 'assets', f))
for f in os.listdir(os.path.join(A, 'svg')): shutil.copy(os.path.join(A, 'svg', f), os.path.join(PKG, 'assets', 'svg', f))
shutil.copytree(os.path.join(WORK, '还原对比'), os.path.join(PKG, '还原对比'))
os.makedirs(os.path.join(PKG, 'fonts'))
for f in os.listdir(os.path.join(ROOT, 'fonts')): shutil.copy(os.path.join(ROOT, 'fonts', f), os.path.join(PKG, 'fonts', f))
open(os.path.join(PKG, 'fonts', 'fonts.txt'), 'w').write('\n'.join(sorted(json.load(open(cover))['faces'] and {f['ps'] for f in json.load(open(cover))['faces']})) + '\n')
tpl = open(os.path.join(ROOT, 'ae', 'README_AE包模板.txt'), encoding='utf-8').read()
readme = (tpl.replace('{TITLE}', X['title']).replace('{MAIN}', SPEC['mainName']).replace('{DUR}', str(SPEC['dur'])).replace('{JSX}', jsx_name)
          .replace('{SHOTS}', str(len(shots))).replace('{FONTS}', '、'.join(SPEC['fonts']))
          .replace('{WARN}', '\n'.join('  - ' + w for w in warns) if warns else '  （无）'))
open(os.path.join(PKG, 'README.txt'), 'w', encoding='utf-8').write(readme)

# 6) 模拟 AE 测试（用户 AE 24.6.2 的真实属性树）
r = subprocess.run(['node', os.path.join(ROOT, 'ae', 'mock_ae_test.js'), os.path.join(PKG, jsx_name), os.path.join(ROOT, 'ae', 'probe', 'AE_probe_24.6.2.txt')], capture_output=True, text=True, cwd=ROOT)
open(os.path.join(PKG, '模拟测试报告.txt'), 'w', encoding='utf-8').write(r.stdout + r.stderr)
print(r.stdout[-2500:] + r.stderr[-1500:])

# 7) zip
z = PKG + '.zip'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for d, _, fs in os.walk(PKG):
        for f in fs: zf.write(os.path.join(d, f), os.path.relpath(os.path.join(d, f), BUILD))
if warns: print('需要留意：\n' + '\n'.join('  - ' + w for w in warns))
print('PACKAGE', z, f'{os.path.getsize(z) / 1e6:.1f} MB')
sys.exit(r.returncode)
