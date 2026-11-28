#!/usr/bin/env python3
"""BM01 字幕：脚本原文（按音频版本）+ 音频转写的说话时间段 → SRT（整片一份 + 分镜头一份）。
每个镜头的原文在 [t0, t1) 里按「有声时间」逐字摊开（静音段不分配字），再按标点切成 ≤ 16 字一条。
引导语（收藏 / 关注）不进字幕，但照样占时间。产物：out/BM01_字幕.srt、out/BM01_字幕_分镜头.srt。"""
import json, os, re
EP = os.path.dirname(os.path.abspath(__file__))
SEG = json.load(open(os.path.join(EP, 'footage', 'segs.json'), encoding='utf-8'))
E = json.load(open(os.path.join(EP, 'episode.json'), encoding='utf-8'))
TEXT = {  # [[...]] = 引导语：占时间，不出字幕
 'S01': '后台跑一晚自动化，睡醒拿下3000块SRC漏洞赏金？', 'S02': '别再去死磕烂大街的传统开发岗！',
 'S03': '现在聪明的技术人，都在用AI Agent+40个Web漏洞Skill库，全自动挖洞拿赏金，', 'S04': '到底有多降维打击？',
 'S05': '不需要你会写复杂的Python脚本，不需要死记硬背几百条payload，',
 'S06': '不管你是想搞技术副业的程序员，还是找工作碰壁的计算机毕业生，', 'S07': '只要有一台普通办公本就能直接开干。',
 'S08': '我把整套流水线拆解成了3步，照着做就行。[[建议先收藏，防止需要的时候找不到，]]接下来我们直接开始。',
 'S09': '郑重声明：本视频的所有内容仅用于合法的白帽安全研究，禁止用于任何未授权站点测试，违者后果自负。',
 'S10': '首先纠正大家一个误区：你用AI挖洞效率低，根本不是你技术差，也不是AI不行，而是你用AI的方式完全错了。',
 'S11': '你把AI当浏览器用，问一句答一句，当然慢；', 'S12': '别人是把AI当手下的员工用，给它分工、给执行流程、给它工具权限，AI自己就能干活。',
 'S13': '说白了就像你开奶茶店，你天天追着员工问怎么做珍珠奶茶，肯定出餐慢；你直接给他配方、操作流程、点单系统，他不用问你，自己就能接单出餐，',
 'S14': 'AI挖洞也是一样的道理。', 'S15A': '我们现在开始操作。第一步，你得先给AI做身份设定和授权，',
 'S15B': '别上来就问“怎么挖洞”。提示词直接按我给的模板套用就行：',
 'S16': '第一，明确身份：你是拥有5年实战经验的白帽黑客，精通Web漏洞挖掘、POC自动化漏洞测试脚本编写、漏洞报告输出；',
 'S17': '第二，给权限：你可以调用我本地安装的Nmap、Xray、SQLmap等扫描工具，有权读取本地的payload测试代码库和指纹库，所有操作仅在我提供的授权靶场/众测目标范围内执行；',
 'S18': '第三，给明确的时效和输出要求：你需要在2小时内完成目标站点的全流程漏洞探测，最终输出符合众测平台提交标准的漏洞报告，包含复现步骤、风险等级、修复建议。',
 'S19A': '看着简单对吧？', 'S19B': '但90%的人都会漏掉合规范围限制这一句，直接触发AI的安全审核机制，', 'S19C': '问啥都回复“无法提供相关内容”。',
 'S20': '这是我踩了二十多次坑摸出来的细节，[[你可以收藏起来慢慢看。]]', 'S21': '第二步，给AI拆分任务执行的顺序，让它自己按阶段自己跑。',
 'S22A': '第一阶段，先跑信息收集：自动扫描目标的端口、子域名、后台目录、以及中间件指纹，', 'S22B': '跑完输出汇总表，',
 'S23': '这一阶段跑完没有异常的话，自动进入第二阶段：漏洞匹配，根据扫出来的站点指纹，自动匹配对应的POC与payload，必要时自动生成定制化测试脚本，优先测试SRC赏金更高的漏洞类型；',
 'S24': '第三阶段，利用验证：自动跑POC验证漏洞是否存在，确认能成功复现的话，就整理进漏洞报告里面，验证不通过就换下一个payload继续测，直到所有指纹匹配的漏洞全都测完为止。',
 'S25': '就这一步，比你手动操作的效率高至少8倍，我之前手动测一个目标要4小时，AI自己跑40分钟就完事了，多出来的时间我再测3个目标不香吗？',
 'S26': '第三步，给AI加兜底的异常处理规则，避免它瞎跑浪费时间。', 'S27': '遇到蜜罐特征的测试目标就自动终止测试。',
 'S28A': '输出的漏洞报告必须保留完整的请求包、响应包原文，', 'S28B': '关键操作节点标注截图指引，最终格式直接对齐SRC提交标准。',
 'S29': '风险等级要按众测平台的标准来评估，修复建议要具体到版本号。', 'S30': '[[你记住了吗？记不住就收藏起来。]]',
 'S31A': '最后说句实在话，当下网络安全的行业趋势摆在这了，各大SRC平台的赏金规模一年比一年大，',
 'S31B': '现在市面上最缺的就是能独立挖漏洞的实战人才。', 'S32A': '只要你愿意花时间把各类漏洞的玩法全吃透，', 'S32B': '正好能赶上下一波行业高峰期，放心大胆去做就好。',
}
MAXC = 16
def voiced(t0, t1):
    out = [(max(s['s'], t0), min(s['e'], t1)) for s in SEG if s['e'] > t0 and s['s'] < t1]
    return [(a, b) for a, b in out if b - a > 0.02] or [(t0, t1)]
def at(iv, frac):  # 有声时间的比例位置 → 绝对秒
    tot = sum(b - a for a, b in iv); x = frac * tot
    for a, b in iv:
        if x <= b - a: return a + x
        x -= b - a
    return iv[-1][1]
W = lambda s: sum(0.55 if ord(ch) < 128 else 1 for ch in s)   # 显示宽度：英文数字约半个汉字
def chunks(text):
    parts = [p for p in re.split(r'(?<=[，。！？；：、,])', text) if p]
    out, cur = [], ''
    for p in parts:
        if W(cur) + W(p.rstrip('，。；：、,')) <= MAXC: cur += p; continue
        if cur: out.append(cur); cur = ''
        toks = re.findall(r'[A-Za-z0-9+%/.]+|.', p)                # 英文单词、数字不拆开
        for tk in toks:
            if W(cur) + W(tk) > MAXC and cur: out.append(cur); cur = ''
            cur += tk
    if cur: out.append(cur)
    return out
def ts(t): ms = round(t * 1000); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
def clean(c): return re.sub(r'[，。；：、,]$', '', c).strip()
full, per = [], []
for s in E['shots']:
    t0, t1 = s['t0'], s['t0'] + s['dur']; iv = voiced(t0, t1); raw = TEXT[s['id']]
    pieces = re.split(r'(\[\[.*?\]\])', raw); L = sum(len(p.strip('[]')) for p in pieces); pos = 0; k = 0
    for p in pieces:
        guide = p.startswith('[[')
        body = p[2:-2] if guide else p
        for c in ([body] if guide else chunks(body)):
            a, b = at(iv, pos / L), at(iv, (pos + len(c)) / L); pos += len(c)
            if guide or not clean(c): continue
            full.append((a, b, clean(c))); k += 1
            per.append((s['id'], a - t0, b - t0, clean(c)))
os.makedirs(os.path.join(EP, 'out'), exist_ok=True)
with open(os.path.join(EP, 'out', 'BM01_字幕.srt'), 'w', encoding='utf-8') as f:
    for i, (a, b, c) in enumerate(full, 1): f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n')
D = os.path.join(EP, 'out', 'srt_分镜头'); os.makedirs(D, exist_ok=True)
for sid in dict.fromkeys(x[0] for x in per):          # 每个镜头一份，时间归零，可直接配单镜头渲染 / 单镜头 AE 包
    with open(os.path.join(D, f'BM01_{sid}.srt'), 'w', encoding='utf-8') as f:
        for i, (_, a, b, c) in enumerate([x for x in per if x[0] == sid], 1): f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n')
print(len(full), '条字幕')
