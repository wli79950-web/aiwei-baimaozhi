#!/usr/bin/env python3
"""BM01 镜头表生成器：按《剪辑思路.md》把每个镜头写成 engine/shot.js 的镜头描述 → episode.json。
网页预览、分镜关键帧、AE 包（ae/build_ae.py）都读这一份。改镜头改这里，再重跑：
    python -I episodes/BM01_AI挖洞流水线/make_episode.py
时间轴来自音频转写（footage/segs.json）；镜头 dur 由相邻切点相减，总长 = 口播 282.74s。
字幕不压进画面（用户在剪映里放），另出 SRT。"""
import json, os

EP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(EP))
REL = os.path.relpath(EP, ROOT).replace('\\', '/')            # episodes/BM01_AI挖洞流水线
G = lambda n: f'{REL}/assets/gen/bm01_{n}.png'               # 本期生图（抠图 / 调色 / 模切后）
P = lambda n: f'{REL}/assets/photos/{n}.jpg'                  # 实拍静帧（已裁切 / 打码）
SH = lambda n: f'{REL}/assets/shots/{n}.png'                  # 用户截图（已打码）
AMB = f'{REL}/assets/gen/bm01_'
TOTAL = 282.74
DIECUT = 'stk diecut'

def frames(name):
    d = os.path.join(EP, 'footage', 'frames', name)
    return len([f for f in os.listdir(d) if f.endswith('.jpg')]) if os.path.isdir(d) else 0

REC = {  # 录屏原片：尺寸、帧数（30fps；定格的只抽了用到的那一帧，count 写原片总帧数）
    '20261126_202538': (2528, 1396, 324), '20261126_202640': (2528, 1396, None), '20261126_202717': (2528, 1396, None),
    '20261126_202756': (2528, 1396, None), '20261127_014944': (1916, 984, 1188), '20261127_022646': (1916, 984, 462),
}
DS_TOP = [[0, 0, 2528, 150], [12, 174, 58, 46]]                   # DeepSeek 录屏：书签栏 + 自动化提示条、左上 Logo
DS_CENTER = [[1052, 572, 64, 56]]                                 # 新对话页中间的 Logo
ARTEX_SIDE = [[352, 352, 262, 30]]                                # 左栏会话标题里的域名
TASKBAR = [[0, 936, 1916, 48]]                                    # Windows 任务栏（微信等图标）

def sc(name, rect, remap=None, push=None, ann=None, mask=(), img=None):
    """录屏组件：name = 录屏文件名（footage/frames/<name>/）；img = 用打码截图当单张原片。"""
    base = {'rect': rect, 'enter': {'at': 0}}
    if img:
        from PIL import Image
        w, h = Image.open(os.path.join(ROOT, img)).size
        base['src'] = {'type': 'image', 'url': os.path.relpath(os.path.join(ROOT, img), EP).replace('\\', '/'), 'w': w, 'h': h}
        out = {'slot': 'sc', 'base': REL + '/', 'spec': base}
    else:
        w, h, n = REC[name]
        base['src'] = {'type': 'frames', 'url': f'footage/frames/{name}/%05d.jpg', 'fps': 30, 'count': n or frames(name), 'w': w, 'h': h}
        out = {'slot': 'sc', 'base': REL + '/', 'video': f'footage/src/图片和附件/{name}.mp4', 'spec': base}
    if remap: base['remap'] = remap
    if push: base['push'] = push
    if ann: base['ann'] = ann
    if mask: base['mask'] = [{'rect': list(r), 'mode': 'block'} for r in mask]
    return out

def tag(text, tone='card', **k): return dict({'ic': 'tag', 'data': dict({'text': text}, **{a: b for a, b in k.items() if a in ('icon', 'en', 'dot')}), 'tone': tone}, **({'rect': k['rect']} if 'rect' in k else {}))
def lab(t, fs=52, cls='', rect=None): return dict({'t': t, 'fs': fs, 'cls': cls}, **({'rect': rect} if rect else {}))
def title(t, fs=104, rect=None, bar=False, kicker=None):
    d = {'title': t, 'fs': fs}
    if bar: d['bar'] = True
    if kicker: d['kicker'] = kicker
    return dict({'ic': 'title', 'data': d}, **({'rect': rect} if rect else {}))
def shot(img, ttl, tilt=0, rect=None, **k): return dict({'ic': 'shot', 'data': dict({'img': img, 'title': ttl}, **k)}, **({'tilt': tilt} if tilt else {}), **({'rect': rect} if rect else {}))

# 还没生成出来的插画：图在就用（模切贴纸），不在就先空着（不放假图、不进 AE 包的待补框）
PENDING = lambda n, rect=None: (dict({'img': G(n), 'cls': DIECUT}, **({'rect': rect} if rect else {}))
                                if os.path.exists(os.path.join(ROOT, G(n))) else None)

STAGE_ROW = [[64, 104, 420, 96], [508, 104, 480, 96], [1012, 104, 436, 96], [1472, 104, 384, 96]]
WIN = [64, 224, 1792, 800]          # 录屏窗口：画面宽 93%，上面留一排阶段签

# 镜头：(id, 起点秒, spec)。dur = 下一个镜头起点 − 本镜头起点；cue 是镜头内的秒数（对口播拍点）。
S = []
def shotdef(sid, t0, spec): S.append((sid, t0, spec))

# ① 开场钩子 ------------------------------------------------------------------
shotdef('S01', 0.0, {'layout': 'L-N04', 'fill': {
    'p1': {'img': G('phone_bounty'), 'rect': [700, 104, 600, 920]},
    'm1': shot(P('sleep'), '人在睡', -5, [64, 300, 520, 640]),
    'm2': {'img': G('laptop_night'), 'rect': [1300, 600, 600, 300]},
    'm3': None},
    'cue': {'m1': 0.2, 'm2': 0.7, 'p1': 1.6},
    'co': [{'from': [1000, 330], 'to': [1340, 300], 'label': '睡醒到账 ¥3,000', 'en': 'SRC BOUNTY', 'hot': True}],
    'deco': [[64, 128, 'AUTOMATION · 01:00 → 08:00']], 'amb': [['usbc', 1560, 900, 300, 160, 'far']]})
shotdef('S02', 4.4, {'layout': 'L-K11', 'fill': {
    'p1': {'img': G('crowd_door'), 'cls': DIECUT, 'rect': [640, 232, 1216, 748]},
    'l1': shot(P('devapp'), '传统开发岗', -3, [64, 160, 480, 700]),
    'l2': lab('{{别再死磕}}<br>~~烂大街的开发岗~~<small>STOP GRINDING</small>', 72, 'disp', [600, 104, 1256, 188])},
    'cue': {'l1': 0.1, 'p1': 0.5, 'l2': 0.9}, 'bokeh': [[1780, 960, 90]]})
shotdef('S03', 7.0, {'layout': 'L-N19', 'fill': {
    'l1': lab('[[AI Agent]]<small>AGENT · 大脑</small>', 96, 'c'),
    'm1': {'img': G('agent_core')},
    'l2': lab('Skill 库<small>40 SKILLS · 工具箱</small>', 96, 'c'),
    'l3': tag('全自动挖洞拿赏金', 'lit', icon='bot', rect=[64, 704, 560, 96]),
    'l4': {'ic': 'chip', 'data': {'name': '40 个 Skill', 'en': 'WEB VULN SKILLS', 'img': G('skill_drawer')}, 'tone': 'card', 'rect': [1216, 640, 640, 232]},
    'k1': lab('AGENT × 40 SKILLS', 20, 'mic')},
    'cue': {'l1': 0.3, 'm1': 0.5, 'l2': 2.2, 'l4': 3.0, 'l3': 5.2, 'k1': 0.6},
    'lines': [[560, 420, 690, 420, 1], [1360, 420, 1230, 420, 'aux']],
    'deco': [[64, 128, 'AI AGENT + SKILL LIBRARY']], 'amb': [['cable', 1580, 150, 280, 160, 'far']]})
shotdef('S04', 13.7, {'layout': 'L-N07', 'fill': {
    'p1': None, 'm1': {'img': G('elevator'), 'cls': DIECUT, 'pos': '50% 50%', 'rect': [480, 120, 960, 740]},
    'l1': lab('降维打击<small>OVERMATCH · 别人爬楼梯，你坐电梯</small>', 72, '', [224, 868, 1472, 120]), 'k1': None},
    'bokeh': [[260, 240, 120], [1680, 220, 110]], 'deco': [[128, 136, 'METAPHOR · 降维打击']]})
shotdef('S05', 15.9, {'layout': 'L-N25', 'scene': 'B', 'fill': {
    'm1': {'img': G('cheatsheets'), 'rect': [700, 470, 300, 420]},
    'l1': shot(SH('python_tool'), '脚本', -4, [64, 120, 470, 300]),
    'l2': shot(SH('python_keys'), '密钥', 3, [520, 112, 430, 330]),
    'l3': shot(SH('payload_74cms'), 'POC', 2, [64, 450, 470, 300]),
    'l4': shot(SH('payload_weblogic'), 'payload', -3, [470, 480, 420, 300]),
    'l5': lab('~~复杂 Python 脚本~~', 52, '', [64, 800, 460, 72]),
    'l6': lab('~~几百条 payload~~', 52, '', [540, 800, 460, 72]),
    'l7': None, 'l8': None,
    'c1': {'ic': 'stat', 'data': {'value': '0', 'unit': '行', 'label': '要你自己写的脚本', 'en': 'ZERO SCRIPTING'}}},
    'cue': {'l1': 0.1, 'l2': 0.25, 'l5': 1.4, 'l3': 2.4, 'l4': 2.55, 'm1': 2.8, 'c1': 3.15, 'l6': 3.5},
    'deco': [[96, 108, 'NOISE · 不用再背的东西']], 'lines': [[1000, 488, 1040, 488, 1]]})
shotdef('S06', 20.3, {'layout': 'L-K10', 'fill': {
    'p1': {'img': G('grad_wall'), 'cls': DIECUT, 'rect': [1500, 104, 360, 450]},
    'c1': {'ic': 'chip', 'data': {'name': '程序员', 'en': 'SIDE HUSTLE', 'sub': '想搞技术副业', 'icon': 'laptop', 'img': P('grad')}, 'tone': 'card'},
    'l1': lab('/', 72, 'num c'),
    'c2': {'ic': 'chip', 'data': {'name': '计算机毕业生', 'en': 'NEW GRAD', 'sub': '找工作碰壁', 'icon': 'award', 'img': P('college')}, 'tone': 'hot'},
    'l2': lab('想多一份收入', 52, 'c'), 'l3': lab('投了简历没回音', 52, 'c')},
    'cue': {'c1': 1.3, 'l2': 1.6, 'c2': 3.0, 'l3': 3.3, 'p1': 3.6}})
shotdef('S07', 25.4, {'layout': 'L-N10', 'fill': {
    't1': title('一台\n{{普通办公本}}', 104, bar=True),
    'm1': {'img': G('office_laptop')},
    'l1': tag('不用独显', icon='cpu'), 'l2': tag('不用高配', icon='zap'),
    'l3': shot(P('laptop'), '实拍', 3, [1376, 640, 480, 360])},
    'deco': [[64, 200, 'GEAR · 门槛']], 'lines': [[1010, 380, 904, 272], [1330, 400, 1408, 300]],
    'amb': [['screws', 1560, 150, 240, 140, 'far']]})
shotdef('S08', 28.7, {'layout': 'L-K14', 'fill': {
    's1': None,
    'l1': {'ic': 'step', 'data': {'idx': '01', 'step': 3, 'name': '身份授权', 'en': 'IDENTITY & SCOPE', 'desc': '角色 · 权限 · 范围', 'img': G('id_badge')}, 'tone': 'card', 'rect': [64, 264, 560, 520]},
    'l2': {'ic': 'step', 'data': {'idx': '02', 'step': 3, 'name': '分阶段跑', 'en': '3-STAGE PIPELINE', 'desc': '收集 · 匹配 · 验证', 'img': G('gears')}, 'tone': 'card', 'rect': [680, 264, 560, 520]},
    'l3': {'ic': 'step', 'data': {'idx': '03', 'step': 3, 'name': '兜底规则', 'en': 'GUARDRAIL', 'desc': '容错 · 蜜罐 · 报告', 'img': G('turnstile')}, 'tone': 'hot', 'rect': [1296, 264, 560, 520]}},
    'cue': {'l1': 1.5, 'l2': 2.0, 'l3': 2.5},
    'lines': [[624, 524, 680, 524, 0], [1240, 524, 1296, 524, 1]],
    'deco': [[64, 144, '01 → 02 → 03 · 3 步全自动挖洞流水线'], [64, 864, 'PIPELINE · IDENTITY / STAGES / GUARDRAIL']]})
shotdef('S09', 36.9, {'layout': 'L-K06', 'fill': {
    'm1': {'ic': 'keyword', 'data': {'word': '郑重声明', 'en': 'LEGAL DISCLAIMER · WHITE-HAT ONLY', 'exp': '合规边界第一，不碰未授权目标', 'icon': 'shield-check'}, 'tone': 'aux', 'rect': [160, 148, 1600, 312]},
    'c1': {'ic': 'quote', 'data': {'text': '仅用于合法的白帽安全研究，\n禁止用于任何[[未授权]]站点测试', 'src': 'AUTHORIZED SECURITY RESEARCH ONLY', 'img': G('whitehat')}, 'rect': [160, 496, 1600, 416]}},
    'cue': {'m1': 0.2, 'c1': 0.6}, 'deco': [[160, 112, 'DISCLAIMER · 合法合规底线']], 'amb': [['screws', 1620, 900, 220, 130, 'near']]})

# ③ 误区纠正 ------------------------------------------------------------------
shotdef('S10', 47.6, {'layout': 'L-K25', 'fill': {
    'p1': {'img': G('wrong_use'), 'cls': DIECUT, 'rect': [600, 160, 760, 640]},
    'l1': lab('~~技术差~~<small>NOT YOUR SKILL</small>', 56),
    'l2': lab('~~AI 不行~~<small>NOT THE AI</small>', 56),
    'l3': shot(P('rec021939'), '跑了很久', -2, [64, 640, 520, 300]),
    'c1': {'ic': 'verdict', 'data': {'text': '用法错了', 'en': 'ROOT CAUSE', 'mark': '!'}, 'tone': 'hot'}},
    'cue': {'l3': 0.3, 'l1': 4.8, 'l2': 6.6, 'p1': 8.4, 'c1': 9.9}, 'bokeh': [[1700, 260, 100]]})
shotdef('S11', 58.9, {'layout': 'L-K29', 'fill': {
    's1': None,
    'c1': {'ic': 'keyword', 'data': {'word': '一问一答', 'en': 'BROWSER MODE', 'exp': '问一句，答一句，当然慢', 'icon': 'message-square'}, 'tone': 'card', 'rect': [1400, 360, 456, 376]}},
    'cue': {'c1': 1.6},
    'sc': sc('20261126_202538', [64, 104, 1312, 920], remap=[[0, 2.7], [3.9, 2.7]],
             push=[{'at': 0.4, 'rect': [700, 470, 1220, 560], 'dur': 0.8}],
             ann=[{'type': 'mark', 'rect': [1470, 505, 390, 80], 'at': 1.3}],
             mask=DS_TOP + [[1636, 520, 178, 40], [1550, 650, 174, 38], [700, 1200, 270, 50]])})
shotdef('S12', 62.8, {'layout': 'L-N12A', 'fill': {
    'p1': {'img': G('delegate'), 'cls': DIECUT},
    'l1': tag('分工', icon='users'), 'l2': tag('执行流程', icon='list-checks'), 'l3': None,
    'l4': tag('工具权限', icon='key-round'), 'l5': None, 'l6': tag('AI 自己干活', 'hot', icon='bot')},
    'cue': {'p1': 0.3, 'l1': 3.1, 'l2': 4.4, 'l4': 6.4, 'l6': 7.6},
    'lines': [[740, 470, 512, 332], [720, 560, 560, 556], [1180, 460, 1408, 300], [1180, 640, 1408, 748, 1]],
    'deco': [[64, 128, 'AI AS AN EMPLOYEE · 当员工用']]})
shotdef('S13', 72.0, {'layout': 'L-K22', 'fill': {
    't1': title('开奶茶店，也是一个道理'),
    'c1': {'ic': 'list', 'data': {'title': '天天追着问', 'items': [{'text': '珍珠奶茶怎么做？'}, {'text': '这一步呢？'}, {'text': '出餐慢', 'state': 'now'}], 'img': G('milktea')}},
    'l1': lab('→', 64, 'blkcell aux'),
    'c2': {'ic': 'list', 'data': {'title': '直接给系统', 'items': [{'text': '配方', 'state': 'done'}, {'text': '操作流程', 'state': 'done'}, {'text': '点单系统', 'state': 'done'}], 'img': G('pos')}, 'tone': 'hot'}},
    'cue': {'t1': 0.2, 'c1': 2.5, 'l1': 7.4, 'c2': 7.9}, 'deco': [[68, 224, 'BEFORE / AFTER · 同一家店']]})
shotdef('S14', 85.6, {'layout': 'L-K13', 'fill': {
    'l1': lab('~~AI 是浏览器~~', 104, 'c'), 'k1': lab('BROWSER?', 20, 'mic'),
    'l2': lab('AI 是 [[员工]]<small>AN AGENT, NOT A BROWSER</small>', 260, 'disp c')},
    'bokeh': [[300, 820, 130], [1650, 300, 110]], 'lines': [[240, 296, 1680, 296, 1]],
    'deco': [[64, 128, 'MYTH vs REALITY · 金句']], 'amb': [['ssd', 88, 720, 260, 120, 'far']]})

# ④ 第一步：身份与授权 ----------------------------------------------------------
shotdef('S15A', 88.3, {'layout': 'L-N15', 'fill': {
    'l1': tag('第 1 步 · 共 3 步', 'aux', icon='flag', rect=[64, 148, 580, 96]),
    'l2': lab('✓ 先改用法', 52, 'dim', [64, 272, 784, 72]),
    't1': title('{{身份}}与授权', 176, [64, 360, 800, 288], bar=True),
    'k1': lab('STEP 01 · IDENTITY & SCOPE', 22, 'mic', [64, 672, 784, 36]),
    'l3': lab('下一步 → 分阶段跑', 54, '', [64, 744, 784, 88]),
    'm1': {'img': G('id_badge')}},
    'cue': {'l1': 0.1, 'l2': 0.25, 't1': 2.3, 'l3': 2.7}, 'amb': [['screws', 1560, 840, 280, 170, 'far']]})
shotdef('S15B', 94.6, {'layout': 'L-K29', 'fill': {
    's1': shot(SH('ask_how_to_hack'), '直接问「怎么挖洞」', 0, None, mark=[0.765, 0.065, 0.088, 0.05], note='✕ 别这么问'),
    'c1': {'ic': 'keyword', 'data': {'word': '先给身份', 'en': 'ROLE FIRST', 'exp': '提示词直接套模板', 'icon': 'badge-check'}, 'tone': 'hot', 'rect': [1264, 540, 592, 392]}},
    'cue': {'s1': 0.1, 'c1': 2.4}})
TAGS1 = lambda cur: {f'l{i + 1}': tag(t, 'hot' if i == cur else 'card', rect=STAGE_ROW[i][:2] + [STAGE_ROW[i][2], 96]) for i, t in enumerate(['① 身份', '② 权限 + 范围', '③ 时效 + 输出'])}
shotdef('S16', 100.1, {'layout': 'L-N12A', 'fill': dict(TAGS1(0), p1=None, l4=None, l5=None, l6=None),
    'cue': {'l1': 0.1, 'l2': 0.2, 'l3': 0.3},
    'sc': sc('20261126_202640', WIN, remap=[[0, 1.8], [8.0, 6.3], [11.3, 6.3]],
             push=[{'at': 3.5, 'rect': [700, 660, 1180, 160], 'dur': 0.9}],
             ann=[{'type': 'underline', 'rect': [714, 688, 372, 34], 'at': 6.0}],
             mask=DS_TOP + DS_CENTER)})
shotdef('S17', 111.4, {'layout': 'L-N12A', 'fill': dict(TAGS1(1), p1=None, l4=None, l5=None, l6=None),
    'cue': {'l1': 0.1, 'l2': 0.2, 'l3': 0.3},
    'sc': sc('20261126_202717', WIN, remap=[[0, 1.5], [13.0, 7.0], [17.9, 7.0]],
             push=[{'at': 2.5, 'rect': [700, 680, 1180, 140], 'dur': 0.9}],
             ann=[{'type': 'mark', 'rect': [786, 758, 562, 38], 'at': 12.8, 'label': '合规范围', 'side': 'bottom'}],
             mask=DS_TOP + DS_CENTER)})
shotdef('S18', 129.3, {'layout': 'L-N12A', 'fill': dict(TAGS1(2), p1=None, l4=None, l5=None, l6=None),
    'cue': {'l1': 0.1, 'l2': 0.2, 'l3': 0.3},
    'sc': sc('20261126_202756', WIN, remap=[[0, 1.5], [12.0, 7.1], [17.3, 7.1]],
             push=[{'at': 2.5, 'rect': [700, 680, 1180, 180], 'dur': 0.9}],
             mask=DS_TOP + DS_CENTER),
    'amb': [['usbc', 1600, 40 + 900, 260, 100, 'far']]})
shotdef('S19A', 146.6, {'layout': 'L-N12B', 'fill': {
    'c1': {'ic': 'verdict', 'data': {'text': '[[三句]]就够', 'en': 'IDENTITY · SCOPE · DEADLINE', 'mark': '✓', 'markTone': 'aux', 'img': G('id_badge')}},
    'm1': None,
    'l1': tag('身份', 'lit', icon='badge-check'),
    'l2': tag('权限 + 范围', 'aux', icon='shield', rect=[80, 496, 480, 120]),
    'l3': tag('时效 + 输出', 'lit', icon='clock', rect=[48, 720, 480, 120]),
    'l4': tag('5 年白帽专家', 'lit', icon='user-round'),
    'l5': tag('仅限授权靶场', 'hot', icon='shield-alert'),
    'l6': tag('2 小时出报告', 'lit', icon='file-check'),
    'k1': lab('TEMPLATE · 3 SENTENCES', 22, 'mic')},
    'cue': {'l1': 0.05, 'l4': 0.1, 'l2': 0.15, 'l5': 0.2, 'l3': 0.25, 'l6': 0.3, 'c1': 0.35},
    'lines': [[580, 400, 512, 332, 0], [560, 500, 560, 556, 'aux'], [600, 640, 512, 780, 0],
              [1340, 380, 1408, 300, 0], [1360, 520, 1408, 524, 1], [1320, 660, 1408, 748, 0]]})
shotdef('S19B', 149.0, {'layout': 'L-N10', 'fill': {
    't1': title('{{90%}} 的人\n漏掉这一句', 104, bar=True),
    'm1': {'img': G('turnstile')},
    'l1': tag('合规范围', icon='shield'), 'l2': tag('没写就被拦', 'hot', icon='circle-x', rect=[1376, 256, 432, 88]), 'l3': None},
    'cue': {'t1': 0.2, 'm1': 0.6, 'l1': 1.2, 'l2': 3.6},
    'deco': [[64, 200, 'SAFETY REVIEW · 安全审核']], 'lines': [[1010, 380, 904, 272], [1330, 400, 1408, 300]]})
shotdef('S19C', 155.7, {'layout': 'L-K09', 'fill': {
    't1': title('问啥都回复\n{{无法提供}}', 104, bar=True), 'k1': lab('03 REFUSALS · 拒答', 20, 'mic'),
    'g1': {'ic': 'wall', 'data': {'shots': [
        {'img': SH('refuse_lan'), 'title': 'EV-01 · 没写范围'}, {'img': SH('refuse_baidu'), 'title': 'EV-02 · 没写范围'},
        {'img': SH('refuse_scope'), 'title': 'EV-03 · 无法提供相关内容'}]}},
    'm1': None, 'm2': None, 'm3': None, 'm4': None, 'm5': None},
    'deco': [[64, 200, 'EVIDENCE · 拒答']]})
shotdef('S20', 159.1, {'layout': 'L-N07', 'fill': {
    'p1': None, 'm1': PENDING('potholes', [460, 124, 1000, 680]),
    'l1': lab('踩坑 {{20+ 次}} 摸出来的<small>LEARNED THE HARD WAY</small>', 72, '', [224, 836, 1472, 132]), 'k1': None},
    'bokeh': [[260, 240, 120], [1680, 220, 110]], 'deco': [[128, 136, 'LESSONS · 踩坑']]})

# ⑤ 第二步：三阶段 -------------------------------------------------------------
shotdef('S21', 164.6, {'layout': 'L-N15', 'fill': {
    'l1': tag('第 2 步 · 共 3 步', 'aux', icon='flag', rect=[64, 148, 580, 96]),
    'l2': lab('✓ 身份与授权', 52, 'dim', [64, 272, 784, 72]),
    't1': title('{{分阶段}}跑', 192, [64, 360, 800, 288], bar=True),
    'k1': lab('STEP 02 · PIPELINE', 22, 'mic', [64, 672, 784, 36]),
    'l3': lab('收集 → 匹配 → 验证', 54, '', [64, 744, 784, 88]),
    'm1': {'img': G('gears')}},
    'cue': {'l1': 0.1, 'l2': 0.2, 't1': 0.3, 'l3': 0.5}, 'amb': [['cable', 1600, 860, 260, 150, 'far']]})
STAGE = lambda cur, rest: dict({'t1': None, 'm1': None, 'm2': None, 'm3': None, 'm4': None,
    'l1': tag(cur[0], 'hot', en=cur[1], rect=STAGE_ROW[0])}, **{f'l{i + 2}': tag(t, rect=STAGE_ROW[i + 1]) for i, t in enumerate(rest)})
shotdef('S22A', 170.8, {'layout': 'L-N09', 'fill': STAGE(('① 信息收集', 'STAGE 01 · RECON'), ['端口 · 子域名', '后台目录', '中间件指纹']),
    'cue': {'l1': 0.1, 'l2': 2.7, 'l3': 5.5, 'l4': 6.7},
    'sc': sc(None, WIN, img=SH('recon_scope'), push=[{'at': 0.6, 'rect': [400, 90, 1480, 470], 'dur': 0.9}])})
shotdef('S22B', 178.6, {'layout': 'L-N09', 'fill': STAGE(('① 信息收集', 'STAGE 01 · RECON'), ['端口 · 子域名', '后台目录', '中间件指纹']),
    'cue': {'l1': 0.0, 'l2': 0.0, 'l3': 0.0, 'l4': 0.0},
    'sc': sc('20261127_014944', WIN, remap=[[0, 36.5], [2.5, 36.5]],
             push=[{'at': 0.3, 'rect': [700, 320, 1180, 290], 'dur': 0.9}],
             ann=[{'type': 'mark', 'rect': [704, 318, 200, 28], 'at': 1.4, 'label': '汇总表', 'side': 'top'}],
             mask=ARTEX_SIDE + TASKBAR + [[712, 376, 142, 24], [903, 630, 290, 24], [726, 680, 108, 24], [726, 704, 138, 24]])})
shotdef('S23', 181.1, {'layout': 'L-N09', 'fill': STAGE(('② 漏洞匹配', 'STAGE 02 · MATCH'), ['指纹 → POC', '定制测试脚本', '赏金高的优先']),
    'cue': {'l1': 0.1, 'l2': 6.5, 'l3': 10.8, 'l4': 12.8},
    'sc': sc(None, WIN, img=SH('match_list'), push=[{'at': 0.8, 'rect': [690, 120, 1190, 540], 'dur': 0.9}],
             ann=[{'type': 'mark', 'rect': [1762, 196, 100, 446], 'at': 13.2}])})
shotdef('S24', 197.5, {'layout': 'L-N09', 'fill': STAGE(('③ 利用验证', 'STAGE 03 · VERIFY'), ['跑 POC 验证', '换 payload', '写进报告']),
    'cue': {'l1': 0.1, 'l2': 2.2, 'l3': 9.6, 'l4': 5.6},
    'sc': sc('20261127_022646', WIN, remap=[[0, 14.5], [16.8, 14.5]],
             push=[{'at': 0.6, 'rect': [700, 440, 1180, 330], 'dur': 0.9}],
             ann=[{'type': 'mark', 'rect': [704, 698, 1160, 52], 'at': 11.5}],
             mask=ARTEX_SIDE + TASKBAR + [[726, 540, 134, 24], [726, 564, 168, 24], [726, 588, 178, 24], [1176, 540, 82, 24], [726, 648, 134, 24], [1006, 648, 130, 24]])})
shotdef('S25', 214.3, {'layout': 'L-K10', 'fill': {
    'p1': None,
    'c1': {'ic': 'chip', 'data': {'name': '手动测', 'en': 'MANUAL', 'sub': '一个目标 4 小时', 'icon': 'hourglass', 'img': G('hourglass')}, 'tone': 'card'},
    'l1': lab('→', 72, 'num c'),
    'c2': {'ic': 'chip', 'data': {'name': 'AI 自己跑', 'en': 'AGENT', 'sub': '40 分钟搞定', 'icon': 'bot', 'img': G('stopwatch')}, 'tone': 'hot'},
    'l2': lab('4 小时', 52, 'c'), 'l3': lab('多出来的时间，再测 3 个目标', 52, 'c')},
    'cue': {'c1': 4.0, 'l2': 4.6, 'l1': 6.5, 'c2': 6.8, 'l3': 9.3},
    'deco': [[64, 128, 'EFFICIENCY · 4H → 40MIN']], 'amb': [['cable', 1580, 130, 260, 150, 'far']]})

# ⑥ 第三步：兜底规则 -----------------------------------------------------------
shotdef('S26', 227.3, {'layout': 'L-N15', 'fill': {
    'l1': tag('第 3 步 · 共 3 步', 'aux', icon='flag', rect=[64, 148, 580, 96]),
    'l2': lab('✓ 分阶段跑', 52, 'dim', [64, 272, 784, 72]),
    't1': title('{{兜底}}规则', 192, [64, 360, 800, 288], bar=True),
    'k1': lab('STEP 03 · GUARDRAIL', 22, 'mic', [64, 672, 784, 36]),
    'l3': lab('失败换 payload，最多 3 次<br>遇到蜜罐立即停', 52, '', [64, 744, 784, 148]),
    'm1': PENDING('guardrail')},
    'cue': {'l1': 0.1, 'l2': 0.2, 't1': 0.3, 'l3': 1.8}})
shotdef('S27', 233.0, {'layout': 'L-N10', 'fill': {
    't1': title('遇到{{蜜罐}}\n立即停', 104, bar=True), 'm1': {'img': G('honeypot')},
    'l1': tag('伪装成目标的陷阱', icon='triangle-alert', rect=[640, 150, 560, 96]), 'l2': tag('立即终止', 'hot', icon='circle-x', rect=[1408, 300, 400, 88]), 'l3': None},
    'cue': {'t1': 0.1, 'm1': 0.3, 'l1': 0.9, 'l2': 2.4},
    'deco': [[64, 200, 'HONEYPOT · 蜜罐']], 'lines': [[1010, 380, 904, 272], [1330, 400, 1408, 300]]})
shotdef('S28A', 236.6, {'layout': 'L-K28', 'fill': {
    'm1': shot(SH('report_full'), 'SRC 漏洞报告 · 证据页', -2),
    'c1': lab('必须保留原文', 52, 'dim'),
    'c2': shot(SH('report_req'), '请求包原文'),
    'c3': shot(SH('report_resp'), '响应包原文')},
    'cue': {'m1': 0.2, 'c1': 0.6, 'c2': 1.6, 'c3': 3.0}, 'deco': [[912, 120, 'REPORT · 请求 / 响应']]})
shotdef('S28B', 242.4, {'layout': 'L-K09', 'fill': {
    't1': title('截图指引\n{{对齐标准}}', 104, bar=True), 'k1': lab('03 FILES · SUBMIT READY', 20, 'mic'),
    'g1': {'ic': 'wall', 'data': {'shots': [
        {'img': SH('report_shots'), 'title': 'EV-01 · 截图清单'}, {'img': SH('src_template'), 'title': 'EV-02 · SRC 提交模板'},
        {'img': SH('report_full'), 'title': 'EV-03 · 完整报告'}]}},
    'm1': None, 'm2': None, 'm3': None, 'm4': None, 'm5': None},
    'deco': [[64, 200, 'SUBMIT · 提交标准']], 'amb': [['usbc', 64, 900, 280, 100, 'far']]})
shotdef('S29', 249.6, {'layout': 'L-N23', 'fill': {
    't1': title('风险等级\n[[修复建议]]'), 'l1': lab('修复建议要<br>具体到[[版本号]]', 52, 'wrap'),
    'm1': shot(SH('src_risk_levels'), '众测平台 · 风险等级', -3),
    'm2': shot(SH('report_fix'), '修复建议', 2, [832, 412, 1024, 520], mark=[0.0, 0.79, 0.52, 0.08]),
    'm3': None,
    'c1': {'ic': 'verdict', 'data': {'text': '具体到版本', 'why': '不写空话', 'markTone': 'aux'}, 'rect': [1328, 104, 528, 272]}},
    'cue': {'t1': 0.1, 'm1': 0.6, 'm2': 3.6, 'l1': 4.2, 'c1': 5.0}, 'deco': [[64, 200, 'SEVERITY · 定级']]})
shotdef('S30', 255.9, {'layout': 'L-K14', 'fill': {
    's1': None,
    'l1': {'ic': 'step', 'data': {'idx': '01', 'step': 3, 'name': '身份授权', 'en': 'DONE · STEP 01', 'desc': '✓ 三句定边界', 'img': G('id_badge')}, 'tone': 'lit', 'rect': [64, 264, 560, 520]},
    'l2': {'ic': 'step', 'data': {'idx': '02', 'step': 3, 'name': '分阶段跑', 'en': 'DONE · STEP 02', 'desc': '✓ 收集·匹配·验证', 'img': G('gears')}, 'tone': 'lit', 'rect': [680, 264, 560, 520]},
    'l3': {'ic': 'step', 'data': {'idx': '03', 'step': 3, 'name': '兜底规则', 'en': 'DONE · STEP 03', 'desc': '✓ 遇蜜罐即停', 'img': G('honeypot')}, 'tone': 'hot', 'rect': [1296, 264, 560, 520]}},
    'cue': {'l1': 0.1, 'l2': 0.25, 'l3': 0.4}, 'lines': [[624, 524, 680, 524, 1], [1240, 524, 1296, 524, 1]],
    'deco': [[64, 144, 'RECAP · 3 步流水线复盘'], [64, 864, 'ALL 3 STEPS READY · 照着做就行']], 'amb': [['ssd', 1600, 880, 240, 110, 'near']]})

# ⑦ 收尾 ------------------------------------------------------------------------
shotdef('S31A', 259.4, {'layout': 'L-N04', 'fill': {
    'p1': None,
    'm1': shot(SH('bounty_3500'), '¥3,500', -4, [64, 560, 540, 400]),
    'm2': shot(SH('bounty_4000'), '¥4,000', 0, [660, 400, 540, 400]),
    'm3': shot(SH('bounty_10000'), '¥10,000', 3, [1260, 200, 596, 440])},
    'cue': {'m1': 5.5, 'm2': 6.4, 'm3': 7.3},
    'co': [{'from': [1500, 330], 'to': [800, 250], 'label': '赏金规模一年比一年大', 'en': 'SRC BOUNTY ↑', 'hot': True}],
    'deco': [[64, 128, 'TREND · 赏金规模']]})
shotdef('S31B', 268.6, {'layout': 'L-K13', 'fill': {
    'l1': lab('市面上最缺的', 104, 'c'), 'k1': lab('WANTED', 20, 'mic'),
    'l2': lab('实战人才<small>INDEPENDENT BUG HUNTERS</small>', 300, 'disp c')},
    'cue': {'l1': 0.2, 'l2': 1.6}, 'bokeh': [[300, 820, 130], [1650, 300, 110]], 'lines': [[240, 296, 1680, 296, 1]],
    'deco': [[64, 128, 'DEMAND · 人才缺口']]})
shotdef('S32A', 273.5, {'layout': 'L-N03', 'fill': {
    't1': title('把漏洞玩法\n{{吃透}}', 104, bar=True),
    'c1': {'ic': 'chip', 'data': {'name': '愿意花时间', 'en': 'PUT IN THE HOURS', 'icon': 'clock'}, 'tone': 'lit'},
    'm1': {'img': P('progday'), 'cls': 'photo'}},
    'cue': {'t1': 0.3, 'c1': 1.0, 'm1': 0.1}, 'deco': [[64, 200, 'PRACTICE · 动手']]})
shotdef('S32B', 278.9, {'layout': 'L-K09', 'fill': {
    't1': title('放心大胆\n去做'), 'k1': lab('04 BOUNTIES · 赶上高峰期', 20, 'mic'),
    'g1': {'ic': 'wall', 'data': {'shots': [
        {'img': SH('bounty_800'), 'title': '¥800'}, {'img': SH('bounty_1000'), 'title': '¥1,000'},
        {'img': SH('bounty_5000_notice'), 'title': '漏洞通知 · ¥5,000'}, {'img': SH('bounty_3000'), 'title': '¥3,000'}]}},
    'm1': None, 'm2': None, 'm3': None, 'm4': None,
    'm5': {'img': G('whitehat_glow'), 'rect': [1460, 600, 420, 320]}},
    'cue': {'m5': 1.0}, 'deco': [[64, 200, 'NEXT WAVE · 下一波']], 'amb': [['ssd', 64, 880, 260, 110, 'near']]})

shots = []
for i, (sid, t0, spec) in enumerate(S):
    t1 = S[i + 1][1] if i + 1 < len(S) else TOTAL
    sp = dict(spec, id=sid, dur=round(t1 - t0, 3), ambBase=AMB)
    sp['t0'] = t0
    shots.append(sp)
assert abs(sum(s['dur'] for s in shots) - TOTAL) < 1e-6
json.dump({'id': 'BM01', 'prefix': 'BM01', 'title': 'AI 挖洞流水线：3 步让 AI 自己跑',
           'note': '镜头表由 make_episode.py 生成，不要手改。t0 = 镜头在成片里的起点（秒）。',
           'voice': 'footage/src/图片和附件/11月28日.mp3', 'shots': shots},
          open(os.path.join(EP, 'episode.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(shots), '个镜头，总长', round(sum(s['dur'] for s in shots), 2), 's')
