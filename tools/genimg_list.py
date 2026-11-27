#!/usr/bin/env python3
"""把生图清单（docs/templates/生图清单模板.md 的表格）转成 tools/genimg.py 的任务文件。
用法：python3 tools/genimg_list.py 生图清单.md > jobs.json
读取表头含「preset」「文件名」「画面描述」的表格，每行一个任务；文件名为空或 preset 为空的行跳过。
停用的风格（styles.json 里 status = 停用）直接报错。"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STY = json.load(open(os.path.join(ROOT, 'cards/images/styles.json'), encoding='utf-8'))['styles']
OK = {k for k, v in STY.items() if v.get('status') != '停用'} | {f'{k}-{vk}' for k, v in STY.items() if v.get('status') != '停用' for vk in v.get('variants', {})} | {'photo', 'raw'}
cells = lambda l: [c.strip() for c in l.strip().strip('|').split('|')]
jobs, head, errs = [], None, []
for line in open(sys.argv[1], encoding='utf-8'):
    if not line.strip().startswith('|'): head = None if not line.strip() else head; continue
    c = cells(line)
    if head is None:
        if 'preset' in c and '文件名' in c and any(x.startswith('画面描述') for x in c): head = c
        continue
    if set(''.join(c)) <= set('-: '): continue
    row = dict(zip(head, c)); name, preset = row.get('文件名', ''), row.get('preset', '').strip('`')
    prompt = next((v for k, v in row.items() if k.startswith('画面描述')), '')
    if not name or not preset: continue
    if preset not in OK: errs.append(f'{name}：preset「{preset}」不可用（停用或不存在）'); continue
    if not prompt: errs.append(f'{name}：缺画面描述'); continue
    j = {'name': name, 'preset': preset, 'prompt': prompt}
    if preset == 'anime-scene': j['size'] = '1536x1024'
    jobs.append(j)
if errs: sys.exit('\n'.join(errs))
names = [j['name'] for j in jobs]
if len(names) != len(set(names)): sys.exit('文件名有重复')
print(json.dumps(jobs, ensure_ascii=False, indent=1))
print(f'{len(jobs)} 张', file=sys.stderr)
