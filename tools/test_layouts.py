#!/usr/bin/env python3
"""排版检查工具的自检：python3 tools/test_layouts.py
拿 tools/fixtures/layouts/L-T01.json（合格样例）逐条改坏，确认 layout_lint 每条规则都能拦住；
最后检查 cards/layouts/ 下的正式排版全部通过。"""
import copy, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout_lint as LL

ROOT = LL.ROOT
GOOD = json.load(open(os.path.join(ROOT, 'tools/fixtures/layouts/L-T01.json'), encoding='utf-8'))
fails = passes = 0
TMP = tempfile.mkdtemp()


def run(L, name='L-T01'):
    p = os.path.join(TMP, name + '.json'); json.dump(L, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    return LL.lint(p)


def ok(cond, msg):
    global fails, passes
    if cond: passes += 1
    else: fails += 1; print('  ✗ ' + msg)


def slot(L, sid): return next(s for s in L['slots'] if s['id'] == sid)


def expect(desc, mutate, needle, name='L-T01'):
    L = copy.deepcopy(GOOD); mutate(L); r = run(L, name)
    ok(any(needle in e for e in r['errors']), f'{desc}：应报「{needle}」，实际 {r["errors"]}')


print('1. 合格样例')
r = run(GOOD)
ok(not r['errors'], f'L-T01 应全部通过，实际 {r["errors"]}')
ok(r['stats']['subject'] >= 0.45 and r['stats']['content'] >= 0.70, f'利用率 {r["stats"]}')
P = copy.deepcopy(GOOD); P['canvas'] = [1080, 1920]
ok(any('只出横屏' in e for e in run(P, '竖屏')['errors']), '竖屏 canvas 应报错（本仓库只出横屏）')

print('2. 每条规则都能拦住')
expect('标题字号', lambda L: slot(L, 't1').update(font_px=96), '标题字号')
expect('标题没写字号', lambda L: slot(L, 't1').pop('font_px'), '标题要写 font_px')
expect('正文字号', lambda L: slot(L, 'c1').update(font_px=40), '有意义的文字')
expect('压字幕区', lambda L: slot(L, 'c2').update(rect=[672, 208, 576, 720]), '字幕安全区')
expect('超页边距', lambda L: slot(L, 'm3').update(rect=[1700, 192, 240, 240]), '超出页边距')
expect('出血太多', lambda L: slot(L, 'm3').update(rect=[1840, 192, 240, 240], bleed=True), '出血过多')
expect('带字出血', lambda L: slot(L, 't1').update(bleed=True), '不能出血')
expect('两个标题', lambda L: L['slots'].append({'id': 't2', 'type': 'title', 'rect': [64, 900, 600, 120], 'font_px': 104, 'need': 'x', 'bleed': False}), '一屏只放一个标题')
expect('人物小窗', lambda L: L['slots'].append({'id': 'p1', 'type': 'person', 'rect': [1536, 600, 320, 320], 'need': '人物'}), '人物小窗')
expect('尺寸档不符', lambda L: slot(L, 'c1').update(size='L'), 'size L 应为')
expect('custom 不是 8 倍数', lambda L: slot(L, 'c1').update(rect=[64, 208, 564, 672]), '8 的倍数')
expect('group 缺 contains', lambda L: L['slots'].append({'id': 'g1', 'type': 'group', 'rect': [64, 208, 1792, 672], 'need': '步骤组'}), 'group 要写 contains')
expect('group 子槽位越界', lambda L: L['slots'].append({'id': 'g1', 'type': 'group', 'rect': [64, 208, 1200, 672], 'contains': ['c1', 'c3'], 'need': '步骤组'}), '超出组的范围')
expect('group 写字号', lambda L: L['slots'].append({'id': 'g1', 'type': 'group', 'rect': [64, 208, 1792, 672], 'contains': ['c1'], 'font_px': 56, 'need': '步骤组'}), '不写 font_px')
expect('label 压在不带底的 label 上', lambda L: L['slots'].append({'id': 'l9', 'type': 'label', 'rect': [1300, 96, 300, 60], 'font_px': 52, 'need': 'x'}), '不能重叠')
expect('没写尺寸档', lambda L: slot(L, 'c1').pop('size'), '要写 size')
expect('朱橙块配奶油白字', lambda L: slot(L, 'c1').update(fill='accent', ink='cream'), '朱橙块一律配炭黑字')
expect('奶油白场朱橙字', lambda L: slot(L, 't1').update(ink='orange'), '奶油白场里朱橙只做色块')
expect('炭黑场蓝字', lambda L: slot(L, 't1').update(ink='klein'), '炭黑场里蓝色只做色块')
expect('炭黑场蓝细线', lambda L: slot(L, 'm1').update(stroke='klein'), '描线')
expect('没有主体', lambda L: [s.pop('subject', None) for s in L['slots']], '没有标出主体')
expect('主体太小', lambda L: [slot(L, c).pop('subject') for c in ('c2', 'c3')], '主体只占画面')
expect('内容铺不开', lambda L: L.update(slots=[s for s in L['slots'] if s['id'] in ('c1', 'm1')]), '全部内容只铺开')
expect('录屏太窄', lambda L: L['slots'].append({'id': 's1', 'type': 'screen', 'rect': [64, 208, 960, 540], 'need': '录屏'}), '录屏窗口宽')
expect('装饰小字超量', lambda L: L['slots'].extend({'id': f'k{i}', 'type': 'label', 'rect': [64 + i * 220, 900, 200, 40], 'decor': True, 'font_px': 20, 'need': 'x'} for i in range(2, 18)), '装饰小字每屏最多')
expect('色块面积超限', lambda L: [slot(L, c).update(fill='accent') for c in ('c1', 'c2')], '朱橙块 + 蓝块')
expect('文字重叠', lambda L: slot(L, 'k1').update(rect=[1200, 144, 576, 40]), '不能重叠')
expect('压到章节进度条区', lambda L: slot(L, 'm1').update(rect=[400, 40, 240, 240], bleed=True), '章节进度条区')
expect('over 指向不存在', lambda L: slot(L, 'm1').update(over=['zz']), 'over 指向不存在')
expect('person_optional 用错', lambda L: slot(L, 'c1').update(person_optional=True), 'person_optional 只用在 media')
expect('id 格式', lambda L: L.update(id='K8'), 'id「K8」格式', name='K8')
expect('文件名与 id 不符', lambda L: L.update(id='L-T02'), '应与 id')
expect('场景取值', lambda L: L.update(scene=['C']), 'scene 只能取')
expect('画布尺寸', lambda L: L.update(canvas=[1280, 720]), 'canvas 只能是')
expect('缺 need', lambda L: slot(L, 'm2').pop('need'), '缺少 need')

L = copy.deepcopy(GOOD); L['slots'].append({'id': 'g1', 'type': 'group', 'rect': [64, 232, 1792, 640], 'contains': ['c1', 'c2', 'c3', 'm1', 'm2', 'm3'], 'subject': True, 'need': '步骤组'})
for s in L['slots']:
    if s['id'] in ('c1', 'c2', 'c3'): s.pop('subject')
r = run(L); ok(not r['errors'] and r['stats']['subject'] >= 0.45, f'用 group 当主体应通过：{r["errors"]} {r["stats"]}')
ok(not any('重叠' in w for w in r['warnings'] if 'g1' in w), f'组和组内槽位重叠不该提醒：{r["warnings"]}')

print('3. 正式排版 cards/layouts/')
d = os.path.join(ROOT, 'cards/layouts')
files = sorted(f for f in os.listdir(d) if f.endswith('.json') and not f.startswith('_'))
for f in files:
    r = LL.lint(os.path.join(d, f)); ok(not r['errors'], f'{f}：{r["errors"]}')
print(f'   {len(files)} 个正式排版')

print(f'\n{"✗" if fails else "✓"} {passes} 项通过，{fails} 项失败')
sys.exit(1 if fails else 0)
