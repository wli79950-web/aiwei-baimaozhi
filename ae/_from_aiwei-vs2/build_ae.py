#!/usr/bin/env python3
"""一键生成某一期的 AE 重建包：生成脚本 → 合成音效 → 收集素材/字体 → 模拟测试 → 打 zip。

用法：python3 ae/build_ae.py "episodes/EP01-下_规矩与五招"
产物：<期目录>/build/<包名>/ 和 <期目录>/build/<包名>.zip
需要真实口播的素材（aroll.mp4、抠像序列 cut_sX/）放在 <期目录>/footage/ 下（不进 git）。
"""
import json, os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ep = os.path.abspath(sys.argv[1])
build = os.path.join(ep, 'build'); os.makedirs(build, exist_ok=True)

# 1) generate jsx
subprocess.run([sys.executable, os.path.join(ep, 'ae_gen.py')], check=True, cwd=ep)
jsx = [f for f in os.listdir(build) if f.endswith('.jsx')][0]
src = open(os.path.join(build, jsx), encoding='utf-8').read()
spec = json.loads(src[src.index('var SPEC = ') + 11:src.index(';\n', src.index('var SPEC = '))])
# 硬检查（2026-11-12 用户要求）：AE 包必须分层。① 不许出现整帧烘焙视频层（背景 + 窗口 + 录屏烘成一条 MP4）；
# ② 每个镜头都要有单独的背景层（背景板图片 / 背景动态 SVG·MP4 / AE 原生背景形状 / 人物画面）。翻修旧期临时重出可设 AE_ALLOW_FULL_BAKE=1 放行。
def _flat_layers(layers):
    for L in layers:
        yield L
        if L.get('k') == 'comp3d': yield from _flat_layers(L.get('layers', []))
_bad = []
for _sh in spec['shots']:
    _ls = list(_flat_layers(_sh['layers']))
    for L in _ls:
        if L['k'] == 'vid' and L.get('x', 0) == 0 and L.get('y', 0) == 0 and L.get('w', 0) >= 1920 and not L.get('name', '').startswith('背景动态_'):
            _bad.append(f"{_sh['name']} / {L.get('name')}：整帧烘焙视频，背景和窗口没有分开")
    if not any(L.get('name', '').startswith(('背景', '人物')) or L['k'] in ('bg', 'grid', 'contour', 'aroll', 'seq') for L in _ls):
        _bad.append(f"{_sh['name']}：没有单独的背景层")
if _bad and os.environ.get('AE_ALLOW_FULL_BAKE') != '1':
    print('✗ 拒绝打包：AE 包必须分层（docs/rules/AE包规范.md）')
    for b in _bad[:30]: print('  -', b)
    print('改法：背景用「背景板_」图片层（动态背景用「背景动态_」SVG / MP4 层），录屏用 win 图层（原片 + 时间重映射 + 推镜 + 形状层），参照 EP02 的 ae_windows.py。')
    sys.exit(1)
pkg = os.path.join(build, spec['prefix'] + '_AE重建包')
shutil.rmtree(pkg, ignore_errors=True); os.makedirs(os.path.join(pkg, 'assets', 'sfx'))
shutil.copy(os.path.join(build, jsx), pkg)

# 2) sfx
subprocess.run([sys.executable, os.path.join(ROOT, 'engine', 'sfx.py'), os.path.join(ep, 'cues.json'), str(spec['dur'])], check=True, cwd=build)
for k in sorted({c['k'] for c in spec['sfx']}):
    shutil.copy(os.path.join(build, 'sfx', k + '.wav'), os.path.join(pkg, 'assets', 'sfx'))

# 3) assets
# 2.1 素材隔离：只查 本期目录 → 同一期号的其他分段（如 EP02-1 之于 EP02 全片）→ 品牌素材 assets/brand。
# 其他期的素材一律查不到，避免跨期复用（见 CLAUDE.md 九）。
import glob as _g, re as _re
index = {}
_m = _re.match(r'(EP\d+)', os.path.basename(ep))
_dirs = [os.path.join(ep, 'assets')]
if _m: _dirs += sorted(d for d in _g.glob(os.path.join(ROOT, 'episodes', _m.group(1) + '*', 'assets')) if os.path.abspath(d) != os.path.join(ep, 'assets'))
_dirs.append(os.path.join(ROOT, 'assets', 'brand'))
for base in _dirs:
    for d, _, fs in os.walk(base):
        for f in fs: index.setdefault(f, os.path.join(d, f))
footage = os.path.join(ep, 'footage')
missing = []
def need(name):
    for cand in [os.path.join(footage, name), os.path.join(footage, 'ae', name), os.path.join(ep, name), index.get(name)]:
        if cand and os.path.exists(cand):
            shutil.copy(cand, os.path.join(pkg, 'assets', name)); return
    missing.append(name)
for sh in spec['shots']:
    for L in sh['layers']:
        if L['k'] in ('img', 'vid', 'grp'): need(L['file'])
        if L['k'] == 'pre3d':  # 3D 预合成：边框截图 + 录屏视口素材
            need(L['chrome']['file'])
            if L.get('view') and L['view']['file'] not in [os.path.basename(x) for x in os.listdir(os.path.join(pkg, 'assets'))]: need(L['view']['file'])
        if L['k'] == 'win' and L['w']['file'] not in [os.path.basename(x) for x in os.listdir(os.path.join(pkg, 'assets'))]: need(L['w']['file'])
        if L['k'] == 'aroll': need(L.get('file') or 'aroll.mp4')
        if L['k'] == 'seq':
            s = os.path.join(footage, L['folder'])
            if os.path.isdir(s): shutil.copytree(s, os.path.join(pkg, 'assets', L['folder']))
            else: missing.append(L['folder'] + '/（抠像序列）')
need(spec['voice'])
shutil.copytree(os.path.join(ROOT, 'fonts'), os.path.join(pkg, 'fonts'))
open(os.path.join(pkg, 'fonts', 'fonts.txt'), 'w').write('JetBrainsMono-Bold\nJetBrainsMono-Medium\nJetBrainsMono-Regular\nSpaceGrotesk-Bold\nSpaceGrotesk-Medium\n'
    'Tinos-Italic\nTinos-BoldItalic\nArimo-BoldItalic\nCourierPrime-Bold\nCaveat-Bold\n')
tpl = open(os.path.join(ROOT, 'ae', 'README_AE包模板.txt'), encoding='utf-8').read()
readme = tpl.replace('{TITLE}', spec['title']).replace('{MAIN}', spec['mainName']).replace('{DUR}', str(spec['dur'])).replace('{JSX}', jsx)
if os.path.exists(os.path.join(ep, 'AE_本期说明.txt')): readme += '\n' + open(os.path.join(ep, 'AE_本期说明.txt'), encoding='utf-8').read()
open(os.path.join(pkg, 'README.txt'), 'w', encoding='utf-8').write(readme)

# 4) mock test (against the user's real AE property tree)
r = subprocess.run(['node', os.path.join(ROOT, 'ae', 'mock_ae_test.js'), os.path.join(pkg, jsx), os.path.join(ROOT, 'ae', 'probe', 'AE_probe_24.6.2.txt')], capture_output=True, text=True)
open(os.path.join(pkg, '模拟测试报告.txt'), 'w', encoding='utf-8').write(r.stdout + r.stderr)
print(r.stdout[-1200:])

# 5) zip
z = pkg + '.zip'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for d, _, fs in os.walk(pkg):
        for f in fs: zf.write(os.path.join(d, f), os.path.relpath(os.path.join(d, f), build))
print('PACKAGE', z)
if missing: print('缺少素材（放进 footage/ 后重新运行）:', ', '.join(missing))
sys.exit(0 if r.returncode == 0 and not missing else 1)
