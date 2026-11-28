#!/usr/bin/env python3
"""根据 episode.json 的镜头切点与入场时间表生成事件音效轨（无背景音乐，只留画面事件音效）。"""
import json, os, subprocess, sys

EP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(EP))
EP_DATA = json.load(open(os.path.join(EP, 'episode.json'), encoding='utf-8'))

CHAPTER_IDS = {'S01', 'S08', 'S15A', 'S21', 'S26', 'S31A'}
cues = []

def add(t, k):
    # 避免极近时间内叠加同种音效导致刺耳
    if t < 0 or t >= EP_DATA['shots'][-1]['t0'] + EP_DATA['shots'][-1]['dur'] - 0.1:
        return
    for c in cues[-6:]:
        if c['k'] == k and abs(c['t'] - t) < 0.14:
            return
    cues.append({'t': round(t, 3), 'k': k})

for idx, s in enumerate(EP_DATA['shots']):
    t0 = s['t0']
    sid = s['id']
    # 1) 镜头切换音效（开场第一镜不加切换声）
    if idx > 0:
        add(t0, 'whoosh' if sid in CHAPTER_IDS else 'swipe')

    # 2) 按显式 cue 给主要画面元素配轻音效
    cue_map = s.get('cue') or {}
    fill = s.get('fill') or {}
    # 按时间排序，同一镜头最多触发 5 个事件音效，避免太吵
    evts = sorted((dt, slot) for slot, dt in cue_map.items() if fill.get(slot))
    used = 0
    for dt, slot in evts:
        if used >= 5:
            break
        item = fill.get(slot)
        if not item:
            continue
        t = t0 + dt
        if dt < 0.05 and idx > 0:
            continue  # 紧贴切镜点已经有切换声，不再叠加
        if item.get('ic') in ('verdict', 'stat', 'quote'):
            add(t, 'stamp')
        elif item.get('img'):
            add(t, 'drop')
        elif item.get('ic') in ('tag', 'chip', 'keyword', 'list', 'wall', 'shot'):
            add(t, 'pop')
        else:
            add(t, 'tick')
        used += 1

    # 3) 录屏推镜与标注音效
    sc = s.get('sc')
    if sc and sc.get('spec'):
        sp = sc['spec']
        for p in sp.get('push') or []:
            add(t0 + p['at'], 'fly')
        for a in sp.get('ann') or []:
            add(t0 + a['at'], 'tick')

cues.sort(key=lambda x: x['t'])
total = round(sum(s['dur'] for s in EP_DATA['shots']), 3)
cues_path = os.path.join(EP, 'footage', 'sfx_cues.json')
os.makedirs(os.path.dirname(cues_path), exist_ok=True)
json.dump(cues, open(cues_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# 调用仓库自带的 engine/sfx.py 在期目录下生成 sfx/sfx_mix.wav
r = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'engine', 'sfx.py'), cues_path, str(total)], cwd=EP, capture_output=True, text=True, encoding='utf-8', errors='replace')
if r.returncode != 0:
    print(r.stdout, r.stderr)
    sys.exit(r.returncode)
print(f'已生成事件音效：{len(cues)} 个事件，总长 {total}s → {os.path.join(EP, "sfx", "sfx_mix.wav")}')
