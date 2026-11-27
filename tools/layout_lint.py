#!/usr/bin/env python3
"""排版库检查：逐个核对 cards/layouts/*.json 是否符合白帽志的版式硬规则。

用法：python3 tools/layout_lint.py                 检查 cards/layouts/ 下全部排版
      python3 tools/layout_lint.py a.json b.json   只检查指定文件
      python3 tools/layout_lint.py --json …        结果按 JSON 输出（给预览 / 测试用）
数值全部从 tokens/brand.json 读（画布、页边距、字幕、字号、尺寸档、利用率、配色）。
有任何「✗ 错误」以退出码 1 结束；「! 提醒」不影响退出码。字段说明见 cards/layouts/README.md。"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
LY, T, CT = B['layout'], B['type'], B['contrast']
MX, MY = LY['margin_x'], LY.get('margin_y', LY['margin_x'])
BAR = LY.get('chapter_bar', {'h': 0, 'gap': 0}); TOP = BAR['h'] + BAR['gap']   # 顶部章节进度条区（1.6）：内容从 TOP 开始
SIZE = {k: tuple(v) for k, v in LY['size_class'].items()}
UT = LY['utilization']
HEX = {k: v['hex'] for k, v in B['color'].items()}
FORBID = {(fg, bg): why for fg, bg, why in CT['forbidden']}

TYPES = {'title', 'card', 'media', 'screen', 'person', 'label', 'group'}
TEXT_TYPES = {'title', 'card', 'label'}          # 带字的槽位：不许压字幕区、要写字号
FILLS = {'none', 'card', 'card_lit', 'accent', 'aux'}
LAYOUT_KEYS = {'id', 'name', 'from', 'function', 'scene', 'canvas', 'notes', 'slots'}
SLOT_KEYS = {'id', 'type', 'rect', 'size', 'need', 'subject', 'bleed', 'font_px', 'decor',
             'fill', 'ink', 'stroke', 'over', 'person_optional', 'count', 'contains', 'shape', 'notes'}
PIP_MAX = 0.25         # 人物槽位小于画面 25% 视为人物小窗（白帽志不做）
INSIDE_MIN = 0.5       # 出血槽位至少一半留在画面内


def subtitle_zone(W, H):
    """字幕安全区：底部居中，距底 subtitle.bottom，高 = 字号 + 上下内边距；宽按一行约 30 字留出。"""
    s = LY['subtitle']; pt, pr, pb, pl = s['padding']
    h = T['subtitle'] + pt + pb
    w = min(W - 2 * MX, 30 * T['subtitle'] + pl + pr)
    return [(W - w) // 2, H - s['bottom'] - h, w, h]


def area(r): return max(0, r[2]) * max(0, r[3])


def clip(r, W, H):
    x0, y0 = max(0, r[0]), max(0, r[1]); x1, y1 = min(W, r[0] + r[2]), min(H, r[1] + r[3])
    return [x0, y0, max(0, x1 - x0), max(0, y1 - y0)]


def inter(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    return max(0, x1 - x0) * max(0, y1 - y0)


def union_area(rects, W, H):
    """矩形并集面积（坐标压缩，精确值）。"""
    rs = [clip(r, W, H) for r in rects]; rs = [r for r in rs if area(r)]
    if not rs: return 0
    xs = sorted({v for r in rs for v in (r[0], r[0] + r[2])}); tot = 0
    for i in range(len(xs) - 1):
        xa, xb = xs[i], xs[i + 1]; spans = sorted((r[1], r[1] + r[3]) for r in rs if r[0] <= xa and r[0] + r[2] >= xb)
        cov, cur = 0, None
        for a, b in spans:
            if cur is None or a > cur[1]:
                if cur: cov += cur[1] - cur[0]
                cur = [a, b]
            else: cur[1] = max(cur[1], b)
        if cur: cov += cur[1] - cur[0]
        tot += cov * (xb - xa)
    return tot


def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def ratio(a, b):
    la, lb = lum(HEX[a]), lum(HEX[b]); return (max(la, lb) + .05) / (min(la, lb) + .05)


def resolve_fill(scene, fill):
    """槽位的底色和默认字色（按场景定义）。返回 (底色 key, 默认字色 key)。"""
    s = B['scene'][scene]
    if fill in (None, 'none'): return s['bg'], s['text']['body']
    if fill == 'card': return tuple(s['card'])
    if fill == 'card_lit': return tuple(s.get('card_lit', s['card']))
    if fill in ('accent', 'aux'): return tuple(s['block'][fill])
    return None, None


def resolve_ink(scene, ink, default):
    """字色：title / body / accent 走场景定义；其余必须是色板里的 key。"""
    s = B['scene'][scene]
    if ink is None: return default
    if ink in s['text']: return s['text'][ink]
    return ink


def lint(path):
    errs, warns = [], []
    E = lambda m: errs.append(m)
    Wn = lambda m: warns.append(m)
    try: L = json.load(open(path, encoding='utf-8'))
    except Exception as e: return {'file': path, 'errors': [f'JSON 读不出来：{e}'], 'warnings': [], 'stats': {}}

    # ---- 排版字段 ----
    for k in ('id', 'name', 'from', 'function', 'scene', 'slots'):
        if k not in L: E(f'缺少字段 {k}')
    for k in set(L) - LAYOUT_KEYS: Wn(f'未知字段 {k}（拼错了？）')
    lid = L.get('id', '')
    if lid and not re.fullmatch(r'L-[A-Z][A-Z0-9]*(-[A-Z0-9]+)*', lid): E(f'id「{lid}」格式应为 L-K08 / L-N04 / L-W01 这类')
    stem = os.path.splitext(os.path.basename(path))[0]
    if lid and stem != lid and not stem.startswith('_'): E(f'文件名 {stem}.json 应与 id「{lid}」一致')
    SP = B['spec']; land = [SP['w'], SP['h']]
    W, H = L.get('canvas', land)
    if [W, H] != land: E(f'canvas 只能是 {land[0]}×{land[1]}（本仓库只出横屏），实际 {W}×{H}')
    scenes = L.get('scene', [])
    if not scenes or any(s not in ('A', 'B') for s in scenes): E(f'scene 只能取 A / B，实际 {scenes}')
    scenes = [s for s in scenes if s in ('A', 'B')]
    slots = L.get('slots', [])
    if not isinstance(slots, list) or not slots: E('slots 不能为空'); slots = []

    safe = [MX, TOP, W - 2 * MX, H - TOP - MY]
    subz = subtitle_zone(W, H)
    ids, by_id = set(), {}
    for i, s in enumerate(slots):
        sid = s.get('id', f'#{i}')
        if sid in ids: E(f'槽位 id「{sid}」重复')
        ids.add(sid); by_id[sid] = s

    # ---- 逐个槽位 ----
    titles = kickers = 0
    for s in slots:
        sid, ty, r = s.get('id', '?'), s.get('type'), s.get('rect')
        P = f'[{sid}] '
        for k in set(s) - SLOT_KEYS: Wn(P + f'未知字段 {k}')
        if ty not in TYPES: E(P + f'type「{ty}」不在 {sorted(TYPES)} 里'); continue
        if not (isinstance(r, list) and len(r) == 4 and all(isinstance(v, (int, float)) for v in r)):
            E(P + 'rect 必须是 [x, y, 宽, 高]'); continue
        if r[2] <= 0 or r[3] <= 0: E(P + '宽高必须为正'); continue
        if not s.get('need'): E(P + '缺少 need（这个位置放什么）')
        if any(v % 8 for v in r): Wn(P + f'rect {r} 不是 8 的倍数，对齐会发虚')

        # 边界：不出血的必须在页边距内；出血的至少一半在画面内
        inside = area(clip(r, W, H)) / area(r)
        if s.get('bleed'):
            if ty in TEXT_TYPES: E(P + f'{ty} 带字，不能出血')
            if inside < INSIDE_MIN: E(P + f'出血过多：只有 {inside:.0%} 在画面内（至少 {INSIDE_MIN:.0%}）')
        else:
            if r[0] < safe[0] or r[1] < safe[1] or r[0] + r[2] > safe[0] + safe[2] or r[1] + r[3] > safe[1] + safe[3]:
                E(P + f'超出页边距（左右 {MX} / 顶部从 {TOP} 起 / 底部 {MY}px）；要出血就写 "bleed": true')
        if r[1] < BAR['h']: E(P + f'压到顶部章节进度条区（y < {BAR["h"]}），出血也不行')

        # 字幕安全区：带字的槽位不许压
        ov = inter(r, subz)
        if ov and ty in TEXT_TYPES: E(P + f'{ty} 压到字幕安全区 {subz}')

        # 组：一组元素（如图解的各个节点）的范围，可作主体；子槽位必须在组内
        if ty == 'group':
            kids = s.get('contains')
            if not kids: E(P + 'group 要写 contains（组里有哪些槽位）')
            for k in kids or []:
                if k not in by_id: E(P + f'contains 指向不存在的槽位「{k}」'); continue
                kr = by_id[k].get('rect')
                if isinstance(kr, list) and len(kr) == 4 and (kr[0] < r[0] or kr[1] < r[1] or kr[0] + kr[2] > r[0] + r[2] or kr[1] + kr[3] > r[1] + r[3]):
                    E(P + f'[{k}] 超出组的范围')
            for k in ('font_px', 'fill', 'ink', 'decor'):
                if k in s: E(P + f'group 不放内容，不写 {k}')
        elif 'contains' in s: E(P + 'contains 只用在 group 上')

        # 字号
        fp = s.get('font_px')
        if ty == 'title':
            titles += 1
            if fp is None: E(P + '标题要写 font_px')
            elif fp < T['title_min']: E(P + f'标题字号 {fp} < {T["title_min"]}')
        elif ty in ('card', 'label'):
            if s.get('decor'):
                if ty != 'label': E(P + 'decor（装饰小字）只能用在 label 上')
                kickers += 1
                if fp is not None and fp < T['decor_min']: E(P + f'装饰标注字号 {fp} < {T["decor_min"]}')
            elif fp is None: E(P + f'{ty} 要写 font_px（最小字号）')
            elif fp < T['meaningful_min']: E(P + f'有意义的文字 {fp}px < {T["meaningful_min"]}px（手机竖拿看不清）')
        elif s.get('decor'): E(P + 'decor 只能用在 label 上')

        # 尺寸档
        if ty == 'card':
            sz = s.get('size')
            if sz is None: E(P + '信息卡要写 size（S / M / L / XL / custom）')
            elif sz == 'custom':
                if r[2] % 8 or r[3] % 8: E(P + f'custom 尺寸的宽高要是 8 的倍数，实际 {r[2]}×{r[3]}')
            elif sz in SIZE:
                if (r[2], r[3]) != SIZE[sz]: E(P + f'size {sz} 应为 {SIZE[sz][0]}×{SIZE[sz][1]}，实际 {r[2]}×{r[3]}')
            else: E(P + f'size「{sz}」不在 S / M / L / XL / custom 里')
        elif 'size' in s: Wn(P + 'size 只对 card 有意义')

        # 录屏窗口宽度
        if ty == 'screen':
            fr = r[2] / W; lo, hi = UT['screencast_width']
            if not (lo <= fr <= hi) and not s.get('bleed'):
                (E if fr < 0.68 else Wn)(P + f'录屏窗口宽 {fr:.0%}，规则是画面宽 {lo:.0%}–{hi:.0%}（与角色 / 信息卡同框可缩到约 70%）')

        # 人物：不做人物小窗；人物位默认改成 media + person_optional
        if ty == 'person':
            if area(r) / (W * H) < PIP_MAX: E(P + f'人物槽位只占 {area(r) / (W * H):.0%}，这是人物小窗（白帽志不做）')
            Wn(P + '真人口播未确认：人物位默认用 media + "person_optional": true')
        if s.get('person_optional') and ty != 'media': E(P + 'person_optional 只用在 media 槽位上')

        # count（重复槽位，如 3–6 张步骤卡）只是说明，写成合法范围
        if 'count' in s and not (isinstance(s['count'], list) and len(s['count']) == 2 and 1 <= s['count'][0] <= s['count'][1]):
            E(P + 'count 写成 [最少, 最多]')

        for oid in s.get('over', []):
            if oid not in by_id: E(P + f'over 指向不存在的槽位「{oid}」')

        # 配色：fill / ink / stroke 按场景解析，检查禁用组合和对比度
        fill = s.get('fill')
        if s.get('shape', 'rect') not in ('rect', 'circle'): E(P + f'shape 只能是 rect / circle')
        if fill is not None and fill not in FILLS: E(P + f'fill「{fill}」不在 {sorted(FILLS)} 里')
        for sc in scenes:
            bg, dfg = resolve_fill(sc, fill)
            if bg is None: continue
            if ty in TEXT_TYPES:
                fg = resolve_ink(sc, s.get('ink'), dfg)
                if fg not in HEX: E(P + f'ink「{s.get("ink")}」不是色板里的颜色'); continue
                if (fg, bg) in FORBID: E(P + f'{sc} 场：{FORBID[(fg, bg)]}')
                elif ratio(fg, bg) < CT['text_min']: E(P + f'{sc} 场：{HEX[fg]} 字 / {HEX[bg]} 底 对比 {ratio(fg, bg):.2f} < {CT["text_min"]}')
            st = s.get('stroke')
            if st:
                if st not in HEX: E(P + f'stroke「{st}」不是色板里的颜色')
                elif (st, bg) in FORBID: E(P + f'{sc} 场：描线 {FORBID[(st, bg)]}')

    # 叠放：两个带字槽位不能重叠；其他重叠要在上层槽位用 over 声明
    good = [s for s in slots if s.get('type') in TYPES and isinstance(s.get('rect'), list) and len(s['rect']) == 4]
    has_bg = lambda s: s.get('fill', 'card' if s['type'] == 'card' else 'none') != 'none'
    order = {s.get('id'): i for i, s in enumerate(slots)}
    for s in good:
        for oid in s.get('over', []):
            if oid in order and order[oid] > order.get(s.get('id'), -1): Wn(f'[{s.get("id")}] over [{oid}]，但 [{oid}] 排在后面（数组顺序就是叠放顺序，下层写在前面）')
    for i, a in enumerate(good):
        for b in good[i + 1:]:
            if not inter(a['rect'], b['rect']): continue
            ia, ib = a.get('id', '?'), b.get('id', '?')
            if (a['type'] == 'group' and ib in a.get('contains', [])) or (b['type'] == 'group' and ia in b.get('contains', [])): continue
            if a['type'] == 'group' or b['type'] == 'group':
                Wn(f'[{ia}] 和 [{ib}] 重叠，但不在同一个组里（写进 contains，或挪开）'); continue
            if a['type'] in TEXT_TYPES and b['type'] in TEXT_TYPES and not (has_bg(a) or has_bg(b)):
                E(f'[{ia}] 和 [{ib}] 都是不带底的文字，不能重叠')
            elif ib not in a.get('over', []) and ia not in b.get('over', []):
                Wn(f'[{ia}] 和 [{ib}] 重叠；有意叠放就在上层槽位写 "over": ["下层 id"]')

    if titles > 1: E(f'一屏只放一个标题，现在有 {titles} 个 title 槽位')
    if kickers > T['decor']['per_frame_max']: E(f'装饰小字每屏最多 {T["decor"]["per_frame_max"]} 处，现在 {kickers} 处')

    # ---- 利用率 ----
    subj = [s['rect'] for s in good if s.get('subject')]
    full = W * (H - BAR['h'])   # 1.6：去掉顶部章节进度条区后的画面
    # 主体 = 主体槽位的并集面积；内容 = 全部槽位铺开的范围（外接矩形，裁到画面内），另记一个并集面积备查
    sa = union_area(subj, W, H) / full
    cu = union_area([s['rect'] for s in good], W, H) / full
    cb = 0
    if good:
        cl = [clip(s['rect'], W, H) for s in good]; cl = [c for c in cl if area(c)]
        if cl:
            x0, y0 = min(c[0] for c in cl), min(c[1] for c in cl)
            x1, y1 = max(c[0] + c[2] for c in cl), max(c[1] + c[3] for c in cl)
            cb = (x1 - x0) * (y1 - y0) / full
    if not subj: E('没有标出主体（给主体槽位写 "subject": true）')
    elif sa < UT['subject_min_area']: E(f'主体只占画面 {sa:.1%}，至少 {UT["subject_min_area"]:.0%}')
    if cb < UT['content_min_area']: E(f'全部内容只铺开了画面的 {cb:.1%}，至少 {UT["content_min_area"]:.0%}')

    # 色块面积：朱橙块 + 蓝块合计不超过单屏上限
    blk = union_area([s['rect'] for s in good if s.get('fill') in ('accent', 'aux')], W, H) / full
    if blk > B['area']['klein_max_per_frame']: E(f'朱橙块 + 蓝块占画面 {blk:.1%}，单屏上限 {B["area"]["klein_max_per_frame"]:.0%}')

    return {'file': os.path.relpath(path, ROOT) if os.path.isabs(path) else path, 'id': lid, 'errors': errs, 'warnings': warns,
            'stats': {'subject': round(sa, 4), 'content': round(cb, 4), 'content_union': round(cu, 4), 'blocks': round(blk, 4), 'subtitle_zone': subz}}


def main(argv):
    as_json = '--json' in argv
    files = [a for a in argv if not a.startswith('--')]
    if not files:
        d = os.path.join(ROOT, 'cards', 'layouts')
        files = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.json') and not f.startswith('_'))
    res = [lint(f) for f in files]
    if as_json: print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            st = r['stats']; mark = '✗' if r['errors'] else '✓'
            info = f'  主体 {st["subject"]:.0%} · 内容 {st["content"]:.0%}' if st else ''
            print(f'{mark} {r["file"]}{info}')
            for m in r['errors']: print('    ✗ ' + m)
            for m in r['warnings']: print('    ! ' + m)
        nbad = sum(1 for r in res if r['errors'])
        print(f'\n{"✗" if nbad else "✓"} {len(res)} 个排版，{nbad} 个不通过' if res else '（没有找到排版文件）')
    return 1 if any(r['errors'] for r in res) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
