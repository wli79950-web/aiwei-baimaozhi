#!/usr/bin/env python3
"""配方表（cards/recipes/recipes.json）→ 给人看的 cards/recipes/recipes.md。改了 recipes.json 后重跑：python3 tools/recipes_md.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, 'cards/recipes/recipes.json'), encoding='utf-8'))
L = ['# 镜头配方表', '', f'> 由 `recipes.json`（v{D["version"]}，{D["updated"]}）生成，不要手改：`python3 tools/recipes_md.py`。', '>',
     '> ' + D['note'], '', '选配方的顺序：先看这句口播要讲的是什么（「用来讲」一列），再看场景和焦点；示例镜头直接改文字和图片就能用。', '',
     '| 配方 | 名称 | 用来讲 | 场景 | 焦点 | 图片 | 组件 | 预览 |', '|---|---|---|---|---|---|---|---|']
for r in D['recipes']:
    L.append(f"| `{r['id']}` | {r['name']} | {r['function']} | {r['scene']} | {'、'.join(r['focus']) or '—'} | {'、'.join(r['images']) or '—'} | {'、'.join(r['components']) or '—'} | [看图](../../{r['preview']}) |")
L += ['', '## 动效节奏', '']
for r in D['recipes']:
    L.append(f"- **`{r['id']}` {r['name']}**：{r['motion']}")
L += ['', '## 怎么用', '', '```bash', 'node tools/cards_preview.js L-K08 R-AI-CHAT   # 只出这几条的预览', 'node tools/cards_preview.js                  # 全部 + 总览板 docs/previews/cards/sheet_*.jpg', '```',
      '- 一期的镜头表（episode.json）里每个镜头写 `recipe: "L-K08"`，再覆盖 `fill` / `cue` 等字段；`ae/build_ae.py` 和网页渲染读同一份镜头描述。', '']
open(os.path.join(ROOT, 'cards/recipes/recipes.md'), 'w', encoding='utf-8').write('\n'.join(L))
print('cards/recipes/recipes.md：', len(D['recipes']), '条')
