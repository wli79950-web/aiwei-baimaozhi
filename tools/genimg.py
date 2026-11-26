#!/usr/bin/env python3
"""生图（apihub.agnes-ai.com，密钥由云环境的网络代理自动注入，脚本里不写真密钥）。
迁自 aiwei-vs2/tools/genimg.py，预设改成白帽志的：全部风格后缀从 cards/images/styles.json 读取。

用法：python3 tools/genimg.py jobs.json 输出目录
jobs.json: [{"name":"bm01_xxx","preset":"iso","prompt":"本期的画面内容","size":"1024x1024"}, ...]
preset（风格提示词在 cards/images/styles.json）:
  sticker 陶瓷贴纸 · sc02-line / sc02-duo SC02 蓝调漫画 · toy · tone · iso · device · flat ……（新风格加进 styles.json 即可用）
  photo    写实照片（只放进手机屏幕、窗口、卡片里，不整屏铺底）
  raw      不加后缀
注意：
- 必须用 response_format=b64_json；返回的图片 URL 域名会被网络策略拦截。
- 免费额度约连续 10 张后限流，本脚本串行执行，失败后等 65 秒重试，最多 3 次。
- 同一张生图不得出现在两期；不设品牌素材层，每期素材都新生成或由用户提供。
"""
import base64, json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = json.load(open(os.path.join(ROOT, 'tokens', 'brand.json'), encoding='utf-8'))
STYLES = json.load(open(os.path.join(ROOT, BRAND['imagery']['styles_file']), encoding='utf-8'))['styles']
PRESET = {
    **{k: v['prompt_suffix'] for k, v in STYLES.items() if 'prompt_suffix' in v},
    **{f'{k}-{vk}': vv['prompt_suffix'] for k, v in STYLES.items() for vk, vv in v.get('variants', {}).items()},
    'photo': "realistic photograph, cinematic, shallow depth of field, no readable text, no logos, no brand names",
    'raw': "",
}
jobs = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
for j in jobs:
    path = os.path.join(out, j['name'] + '.png')
    if os.path.exists(path): print(j['name'], 'exists'); continue
    prompt = (j['prompt'] + ', ' + PRESET[j.get('preset', 'raw')]).strip(', ')
    body = json.dumps({"model": "agnes-image-2.5-flash", "prompt": prompt, "n": 1, "size": j.get('size', '1024x1024'), "response_format": "b64_json"})
    for attempt in range(3):
        r = subprocess.run(["curl", "-sS", "--max-time", "300", "https://apihub.agnes-ai.com/v1/images/generations",
                            "-H", "Authorization: Bearer proxy-injected", "-H", "Content-Type: application/json", "-d", body],
                           capture_output=True, text=True)
        try:
            data = base64.b64decode(json.loads(r.stdout)['data'][0]['b64_json']); open(path, 'wb').write(data); print(j['name'], 'ok', flush=True); break
        except Exception:
            print(j['name'], 'retry', r.stdout[:160], flush=True); time.sleep(65)
