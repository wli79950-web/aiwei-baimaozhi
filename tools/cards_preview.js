// 知识卡片预览：50 个排版 × 信息卡 × 样张图片，同一个话题（AI 挖越权漏洞）填满，出 1920×1080 预览 + 总览板
// 用法：node tools/cards_preview.js        → docs/previews/cards/<排版 id>.jpg、sheet_1…5.jpg
// 这是配方表（P6）之前的预览：内容是示意，图片是风格样张（不进正片）。库里还没有的图形用「待补组件」虚线框标出来，不硬凑。
// 规则照常：一屏一个朱橙焦点；写实和 SC02 漫画不在同一镜头；类别 3 氛围道具只配写实主体、每屏 ≤ 3。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/previews/cards'), TMP = path.join(ROOT, 'out/cards_preview');
const pageCheck = require('./lib/pagecheck.js');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });

/* ---------- 素材简写 ---------- */
const S = 'cards/images/samples/';
const R = n => ({ img: S + `bmz_${n}.png` });                         // 类别 1 · 写实
const AN = n => ({ img: S + `anime/anime_${n}.png` });                 // 类别 1 · 动漫高光版
const SC = n => ({ img: S + `sc02/${n}.png`, cls: 'stk diecut' });     // 类别 2 · SC02 模切贴纸
const DEV = { img: S + 'device/device_hand_示例贴图.png' };             // 类别 1 · 手持手机（透明）
const EVI = S + 'evidence/shop_order_教学示例.jpg';                      // 证据（教学示例截图，保留原色）
const EV = (title, mark, note) => ({ ic: 'shot', data: { img: EVI, title, mark, note } });
const PH = (dim) => ({ img: EVI, cls: 'photo' + (dim ? ' dim' : '') });
const T = (t, fs, cls) => ({ t, fs, cls: cls || '' });                // 文字：[[色块]] {{重点字}} ~~划掉~~ <small>英文</small>
const IC = (ic, data, tone) => ({ ic, data, tone });
const TAG = (text, tone, dot) => IC('tag', { text, dot }, tone || 'card');
const TODO = what => ({ todo: what });
const MIC = t => ({ t, fs: 20, cls: 'mic' });
const OWNER = [0.6, 0.42, 0.18, 0.05];                                  // 截图里 owner 那一行（相对坐标）

/* ---------- 50 个排版的填充 ---------- */
const FILL = {
  'L-K01': { t1: IC('title', { title: '提交之前，\n先定个级', fs: 104 }), l1: T('平台按危害分档，档位越高，赏金越高', 52, 'wrap dim'),
    c1: IC('tier', { level: '严重', desc: '能控制服务器', value: '9.0–10' }, 'lit'), c2: IC('tier', { level: '高危', desc: '能读别人的数据', value: '7.0–8.9' }, 'lit'),
    c3: IC('tier', { level: '中危', desc: '要一定条件', value: '4.0–6.9', band: 'aux' }, 'lit'), c4: IC('tier', { level: '低危', desc: '影响有限', value: '0.1–3.9', band: 'card' }, 'lit'),
    m1: R('lock_open'), m2: R('bug'), m3: R('key'), m4: R('lock_closed') },
  'L-K02': { c1: TODO('圆环定义图：中心名词 + 3–6 个扇区'), k1: MIC('ACCESS CONTROL'), t1: IC('title', { title: '越权，\n分三种', fs: 104 }),
    c2: TAG('本期：水平越权', 'hot') },
  'L-K03': { t1: IC('title', { title: '目标档案', fs: 112 }), c1: IC('list', { items: [{ text: '目标：shop.test', state: 'done' }, { text: '范围：Web / API', state: 'done' }, { text: '授权书编号', state: 'now' }, '测试时间窗'] }),
    m1: IC('shot', { title: '授权书.pdf（示意）' }), m2: EV('shop.test'), l1: TAG('已授权', 'hot', true) },
  'L-K04': { t1: IC('title', { title: '漏洞从发现到奖励', fs: 112 }),
    c1: IC('chip', { name: '白帽', sub: '发现并提交', img: S + 'bmz_whitehat.png' }, 'hot'), c2: IC('chip', { name: '平台', sub: '审核定级', img: S + 'bmz_shield.png' }, 'card'),
    c3: IC('chip', { name: '厂商', sub: '修复、发奖励', img: S + 'bmz_building.png' }, 'card'),
    l1: T('提交报告 →', 52, 'c'), l2: T('转交厂商 →', 52, 'c'), l3: T('← 反馈结果', 52, 'c dim'), l4: T('← 发放奖励', 52, 'c dim') },
  'L-K05': { p1: SC('sc02_magnifier'), c1: IC('keyword', { word: '越权', exp: '看了不该你看的数据' }, 'card'), m1: null },
  'L-K06': { m1: EV('平台规则（示意）'), c1: IC('quote', { text: '同一个漏洞拆成多份提交，\n算[[刷洞]]，要扣分', src: '平台规则（示意）' }) },
  'L-K07': { m1: PH(true), l1: T('返回状态码', 56, 'c'), l2: T('200', 320, 'num c'), l3: T('GET /api/orders/1002', 52, 'mono c dim') },
  'L-K08': { t1: IC('title', { title: 'AI 挖洞，按顺序来', fs: 112 }),
    c1: IC('step', { idx: '01', name: '确认授权', img: S + 'bmz_key.png' }), c2: IC('step', { idx: '02', name: '信息收集', img: S + 'bmz_radar.png' }),
    c3: IC('step', { idx: '03', name: 'AI 扫描', img: S + 'bmz_aichip.png' }, 'hot'), c4: IC('step', { idx: '04', name: '人工复核', img: S + 'bmz_shield.png' }),
    c5: IC('step', { idx: '05', name: '写报告', img: S + 'bmz_laptop.png' }), c6: IC('step', { idx: '06', name: '等审核', img: S + 'bmz_coin.png' }),
    c7: IC('list', { items: [{ text: '确认授权', state: 'done' }, { text: '信息收集', state: 'done' }, 'AI 扫描', '人工复核', '写报告', '等审核'] }) },
  'L-K09': { t1: IC('title', { title: '证据，\n摆一墙', fs: 104 }), k1: MIC('05 EVIDENCE'),
    m1: EV('orders/1002'), m2: EV('orders/1003'), m3: EV('Network', OWNER, 'owner'), m4: EV('Response'), m5: EV('user_b') },
  'L-K10': { p1: R('whitehat'), c1: IC('chip', { name: 'AI 能做', sub: '批量扫接口' }, 'card'), l1: T('VS', 96, 'num c'), c2: IC('chip', { name: '必须人来', sub: '判断真假' }, 'hot'),
    l2: T('速度快，会误报', 52, 'c'), l3: T('慢，但要负责', 52, 'c') },
  'L-K11': { p1: SC('sc02_boundary'), l1: T('先授权<small>AUTHORIZE</small>', 120, 'disp r'), l2: T('再{{动手}}<small>THEN TEST</small>', 120, 'disp') },
  'L-K12': { p1: SC('sc02_waiting'), l1: TAG('“审核要多久？”'), l2: TAG('“报告写了一晚上”'), l3: TAG('“又被判重复了”'), l4: TAG('“终于通过了”') },
  'L-K13': { l1: T('~~挖洞靠运气~~', 120, 'c'), k1: MIC('LUCK?'), l2: T('靠方法', 440, 'disp c') },
  'L-K14': { s1: PH(true), l1: T('抓包<small>CAPTURE</small>', 140, 'c'), l2: T('改包<small>TAMPER</small>', 140, 'c'), l3: T('{{重放}}<small>REPLAY</small>', 140, 'c') },
  'L-K21': { p1: R('aichip'), c1: IC('list', { title: '发生了什么', items: [{ text: 'AI 扫到接口', state: 'done' }, { text: '改了 uid', state: 'done' }, { text: '读到别人手机号', state: 'now' }] }, 'card'),
    amb: [['keycaps', 820, 760, 420, 330, 'near']] },
  'L-K22': { t1: IC('title', { title: '补一步校验，结果完全不同', fs: 104 }),
    c1: IC('term', { title: '修复前 · 200', lines: ['$ GET /api/user/1002', '# 只查了登录', '{', '  "uid": 1002,', '  "phone": [["138****"]]', '}'] }), l1: T('→', 64, 'blkcell'),
    c2: IC('term', { title: '修复后 · 403', lines: ['$ GET /api/user/1002', '# 加了归属校验', '{', '  "error":', '    "not owner"', '}'] }) },
  'L-K23': { p1: SC('sc02_magnifier'), t1: IC('title', { title: '只看这几个字段', fs: 104 }), c1: T('GET /api/orders/1002', 52, 'mono'),
    c2: IC('term', { title: 'Response · 200', lines: ['"owner": [["user_b"]],', '"phone": "138****0012"'] }), l1: TAG('越权成立', 'card', true) },
  'L-K24': { t1: IC('title', { title: 'A 的钥匙，\n开了 B 的门', fs: 104 }), l1: T('箭头＝动作，框＝归属', 52, 'dim'), l2: T('越权：{{成立}}', 56),
    c1: TODO('嵌套归属图：外框 → 两个内框 → 资源，越界箭头 + 打叉') },
  'L-K25': { p1: SC('sc02p_report'), l1: T('~~服务器挂了~~', 56), l2: T('~~参数写错了~~', 56), l3: T('~~缓存没清~~', 56),
    c1: IC('verdict', { text: '没做归属校验', mark: '!' }, 'hot') },
  'L-K26': { p1: AN('radar'), l1: T('常见越权 · 03 / 05', 52, 'c'), c1: IC('chip', { name: '改 uid' }, 'card'), c2: IC('chip', { name: '改订单号' }, 'card'),
    c3: IC('keyword', { word: '改角色字段', exp: '普通用户变管理员' }, 'hot'), c4: IC('chip', { name: '改租户 ID' }, 'card'), c5: IC('chip', { name: '越权下载' }, 'card') },
  'L-K27': { p1: AN('chip'), t1: IC('title', { title: 'AI 能帮你挖洞吗？', fs: 112 }),
    c1: IC('quote', { text: 'AI 找到的线索，\n要人来{{签字确认}}', src: '白帽工作守则（示意）' }, 'card') },
  'L-K28': { m1: EV('漏洞报告（示意）'), c1: T('上一条：影响范围是全部订单', 52, 'dim'), c2: IC('quote', { text: '任意登录用户\n可读取[[他人订单]]' }),
    c3: IC('stat', { value: '12,000', unit: '条', label: '可读订单', note: '示意数据' }) },
  'L-K29': { s1: EV('shop.test/orders/1002', OWNER, '别人的订单'), c1: IC('keyword', { word: '越权', exp: '改个号，就看到了' }, 'card') },
  'L-K30': { c1: IC('term', { title: 'Request', lines: ['$ PUT /api/me', '"role": "admin"'] }), c2: IC('term', { title: 'Response · 200', lines: ['{', '  "uid": 1002,', '  "role": [["admin"]]', '}'] }),
    c3: IC('lens', { label: '第 3 行', text: '[["admin"]]', note: '普通用户自己改的' }), l1: TAG('普通用户'), l2: T('≠', 56, 'num c'), l3: TAG('admin') },
  'L-N01': { t1: IC('title', { title: '三个角色', fs: 104 }), l1: T('一次测试里，谁在做什么', 52, 'wrap dim'),
    c1: IC('step', { idx: '01', name: '白帽', desc: '写报告' }), c2: IC('step', { idx: '02', name: '复核', desc: '逐条核' }), c3: IC('step', { idx: '03', name: '审核', desc: '等结果' }),
    m1: SC('sc02p_report'), m2: SC('sc02_magnifier'), m3: SC('sc02_waiting') },
  'L-N02': { m1: AN('lock'), l1: T('第 2 章', 52, 'dim'), t1: IC('title', { title: '越权', fs: 240 }), k1: MIC('CHAPTER 02 · ACCESS CONTROL'), l2: T('改一个数字，就看到了别人的东西', 52) },
  'L-N03': { t1: IC('title', { title: '审核通过，\n会收到通知', fs: 104 }), c1: IC('chip', { name: '报告已通过', sub: '定级：高危（示意）' }, 'card'), m1: DEV },
  'L-N04': { p1: R('laptop'), m1: EV('orders/1002'), m2: EV('orders/1003'), m3: EV('Response', OWNER, 'owner') },
  'L-N05': { t1: IC('title', { title: '常见的六类漏洞', fs: 112 }), m1: PH(false),
    c1: IC('step', { idx: '01', name: '注入', img: S + 'bmz_bug.png' }), c2: IC('step', { idx: '02', name: 'XSS', img: S + 'bmz_laptop.png' }),
    c3: IC('step', { idx: '03', name: 'SSRF', img: S + 'bmz_radar.png' }), c4: IC('step', { idx: '04', name: '越权', img: S + 'bmz_key.png' }, 'hot'),
    c5: IC('step', { idx: '05', name: '信息泄露', img: S + 'bmz_briefcase.png' }), c6: IC('step', { idx: '06', name: '逻辑漏洞', img: S + 'bmz_lock_open.png' }) },
  'L-N06': { c1: { box: 'paper' }, t1: IC('title', { title: '某平台通报：越权读取订单', fs: 104 }), m1: EV('案例配图（示意）'),
    l1: T('有用户发现，改一下订单号\n就能看到别人的收货信息。\n平台已修复，并给提交者\n发放了奖励。', 52, 'wrap'), l2: TAG('示意案例', 'hot') },
  'L-N07': { p1: null, m1: { ...SC('sc02_borrowed_key'), pos: '82% 50%' }, l1: T('越权，就像拿别人的钥匙开门', 64), k1: null },
  'L-N08': { t1: IC('title', { title: '漏洞藏在\n哪一层？', fs: 104 }), m1: TODO('分层结构图：前端 / 接口 / 数据库 层层拆开（iso 已停用，改用矢量分层组件）'),
    l1: T('前端：只是藏了按钮', 56, 'wrap'), l2: T('[[接口]]：没校验归属', 56, 'wrap'), l3: T('数据库：数据没问题', 56, 'wrap') },
  'L-N09': { t1: IC('title', { title: '复现四步', fs: 104 }), m1: EV('登录 A'), m2: EV('抓包'), m3: EV('改单号'), m4: EV('看到 B'),
    l1: TAG('登录 A'), l2: TAG('抓包'), l3: TAG('改单号'), l4: TAG('看到 B', 'hot') },
  'L-N10': { t1: IC('title', { title: '入门只要\n一台电脑', fs: 104 }), m1: R('laptop'), l1: TAG('8G 内存就够'), l2: TAG('抓包工具'), l3: TAG('浏览器插件'),
    amb: [['keycaps', 1500, 820, 460, 340, 'near'], ['cable', 640, 760, 260, 200, 'far']] },
  'L-N11': { p1: R('shield'), m1: null, c1: IC('keyword', { word: 'owner 字段', exp: '这单是谁的' }, 'card'), c2: IC('verdict', { text: '没校验，\n就是越权' }, 'hot'),
    l1: TAG('单主：B'), l2: TAG('我：A') },
  'L-N12A': { p1: R('aichip'), l1: TAG('抓包'), l2: TAG('改参数'), l3: TAG('重放'), l4: TAG('比对'), l5: TAG('截图'), l6: TAG('归属？', 'hot'),
    amb: [['usbc', 1500, 860, 300, 220, 'far']] },
  'L-N12B': { c1: IC('verdict', { text: '每一步\n都留证据' }), m1: null, l1: TAG('抓包'), l2: TAG('改参数'), l3: TAG('重放'), l4: TAG('比对'), l5: TAG('截图'), l6: TAG('归属？', 'hot'), k1: MIC('KEEP EVIDENCE') },
  'L-N13': { p1: SC('sc02_magnifier'), c1: TAG('这个漏洞值几级？', 'card', true), m1: null,
    l1: T('影响面', 88), l2: T('利用难度', 88), l3: T('数据敏感', 88), l4: T('要不要登录', 88), l5: T('{{能否批量}}', 88) },
  'L-N14': { p1: SC('sc02p_report'), t1: IC('title', { title: '复盘：\n三条证据', fs: 104 }),
    c1: IC('keyword', { idx: '01', word: '请求', exp: '改了单号' }), c2: IC('keyword', { idx: '02', word: '响应', exp: 'owner 变了' }, 'hot'), c3: IC('keyword', { idx: '03', word: '页面', exp: '别人信息' }),
    m1: null, m2: null, m3: null },
  'L-N15': { l1: T('共 4 步 · 第 3 步', 52, 'dim'), l2: T('✓ 抓包', 56, 'dim'), t1: IC('title', { title: '改包', fs: 240 }), k1: MIC('STEP 03 · TAMPER'), l3: T('下一步：？？？', 56, 'dim'), m1: R('key'),
    amb: [['screws', 1560, 820, 300, 220, 'far']] },
  'L-N16': { m1: PH(true), l1: T('{{没校验}}，\n就是越权', 120, 'c wrap'), l2: TAG('“改个号就行？”'), l3: TAG('“这也算漏洞？”'), l4: TAG('“我以为有校验”'), l5: TAG('“赶紧提交”') },
  'L-N17': { t1: IC('title', { title: '一次请求，\n五种走向', fs: 104 }), c1: IC('step', { idx: '01', name: '登录' }), c2: IC('step', { idx: '02', name: '发请求' }),
    c3: IC('keyword', { word: '服务器', exp: '查不查归属？', img: S + 'bmz_building.png' }), m1: null,
    l1: TAG('查了 · 403'), l2: TAG('没查 · 200'), l3: TAG('读到别人订单', 'hot'), l4: TAG('改了别人订单'), l5: TAG('删了别人订单') },
  'L-N18': { m1: R('briefcase'), t1: IC('title', { title: '漏洞分类', fs: 104 }), l1: T('参考 OWASP 2021', 52, 'dim'),
    c1: TAG('访问控制'), l2: T('注入', 52, 'c dim'), l3: T('加密失效', 52, 'c dim'), l4: T('错误配置', 52, 'c dim'),
    c2: TAG('本期：越权（IDOR）', 'hot'), l5: T('水平越权', 52, 'c'), l6: T('{{垂直越权}}', 64, 'c') },
  'L-N19': { l1: T('认证<small>AUTHN · 你是谁</small>', 140, 'c'), m1: R('key'), l2: T('[[授权]]<small>AUTHZ · 你能做什么</small>', 140, 'c'),
    l3: T('“我登录了”', 52, 'c dim'), l4: T('“但这不是我的”', 52, 'c dim'), k1: MIC('AUTHN ≠ AUTHZ') },
  'L-N20': { l1: T('能用<small>WORKS</small>', 160, 'c'), m1: R('lock_open'), l2: T('[[不安全]]<small>UNSAFE</small>', 160, 'c'), k1: MIC('SAME LOCK') },
  'L-N21': { m1: R('laptop'), t1: IC('title', { title: '动手前备齐', fs: 104 }), k1: MIC('CHECKLIST'),
    c1: IC('step', { idx: '01', name: '授权书' }), c2: IC('step', { idx: '02', name: '测试账号' }, 'hot'), c3: IC('step', { idx: '03', name: '抓包工具' }),
    c4: IC('step', { idx: '04', name: 'AI 助手' }), c5: IC('step', { idx: '05', name: '记录模板' }) },
  'L-N22': { t1: IC('title', { title: '一百个里\n只有\n一个是真', fs: 104 }), m1: TODO('一群里的一个：程序化图形（flat 已停用）'),
    l1: TAG('都一样'), m2: TODO('局部放大框'), l2: T('{{这一个}}', 52) },
  'L-N23': { t1: IC('title', { title: '证据只看\n这一行', fs: 104 }), l1: T('详情接口里\n{{owner}} 变了', 52, 'wrap'),
    m1: EV('订单列表（示意）'), m2: EV('Response', OWNER, 'owner'), m3: null, c1: IC('verdict', { text: '越权成立', why: 'owner ≠ 当前用户' }) },
  'L-N24': { t1: IC('title', { title: '补一行校验', fs: 112 }), l1: T('修复前', 64, 'c'), l2: T('修复后', 64, 'c'),
    m1: R('lock_open'), m2: IC('term', { title: '修复前 · 200', lines: ['GET /orders/1002', '"owner": "user_b"'] }),
    m3: IC('term', { title: '修复后 · 403', lines: ['GET /orders/1002', '[["not owner"]]'] }), m4: R('lock_closed'),
    l3: T('+ 归属校验', 52, 'c'), l4: T('owner ≠ 我 → 403', 52, 'c') },
  'L-N25': { m1: R('radar'), l1: T('~~版本泄露~~', 56), l2: T('~~缺少头部~~', 56), l3: T('~~弱密码？~~', 56), l4: T('~~XSS？~~', 56),
    l5: T('~~端口开放~~', 56), l6: T('~~重复报告~~', 56), l7: T('~~误报~~', 56), l8: T('~~低危~~', 56),
    c1: IC('stat', { value: '1', unit: '个', label: '能提交（示意）' }) }
};

/* ---------- 页面 ---------- */
const HEAD = `<meta charset="utf-8"><base href="file://${ROOT}/">
<link rel="stylesheet" href="engine/tokens.css"><link rel="stylesheet" href="engine/base.css">
<link rel="stylesheet" href="engine/motion/motion.css"><link rel="stylesheet" href="cards/infocards/infocards.css">
<script src="engine/motion/tokens.js"></script><script src="engine/motion/motion.js"></script><script src="cards/infocards/infocards.js"></script>
<script src="libs/backgrounds/backgrounds.js"></script>
<style>
.lab{position:absolute;z-index:5;display:flex;flex-direction:column;justify-content:center;font-family:var(--f-cn);font-weight:700;line-height:1.08;color:var(--s-title);white-space:nowrap}
.lab.c{align-items:center;text-align:center}.lab.r{align-items:flex-end;text-align:right}
.lab.wrap{white-space:pre-line;line-height:1.32}.lab.dim{opacity:.64}
.lab.disp{font-family:var(--f-disp);font-weight:400}.lab.num{font-family:var(--f-num);font-weight:900;line-height:1}.lab.mono{font-family:var(--f-mono);font-weight:600}
.lab small{display:block;margin-top:.35em;font:500 22px/1 var(--f-mono);letter-spacing:.18em;opacity:.5}
.lab .strk{text-decoration:line-through;text-decoration-thickness:.08em;opacity:.5}
.lab.mic{font:500 20px/1 var(--f-mono);letter-spacing:.18em;opacity:.45;text-transform:uppercase}
.blkcell{position:absolute;display:flex;align-items:center;justify-content:center;background:var(--orange);color:var(--char);border-radius:var(--r-sm);font-family:var(--f-num);font-weight:900}
.photo{position:absolute;object-fit:cover;border-radius:var(--r-win,36px);box-shadow:0 30px 60px rgba(0,0,0,.35)}
.photo.dim{filter:brightness(.32) saturate(.4)}
.todo{position:absolute;border:3px dashed rgba(255,90,31,.7);border-radius:var(--r-card);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;
  font:700 40px/1.35 var(--f-cn);color:var(--s-title);background:rgba(255,90,31,.05)}
.todo b{font:600 22px/1 var(--f-mono);letter-spacing:.18em;color:var(--orange);margin-bottom:18px}
.scene-B .todo b{color:var(--char)}
.box{position:absolute;background:var(--paper);border-radius:var(--r-card);box-shadow:0 18px 40px rgba(90,40,10,.12)}
.idtag{position:absolute;right:64px;bottom:20px;font:500 18px/1 var(--f-mono);letter-spacing:.16em;color:var(--s-title);opacity:.38;z-index:70}
</style>`;

function pageHTML(L, F) {
  const scene = (L.scene || ['A'])[0];
  return `<!doctype html><html><head>${HEAD}</head><body><section class="frame" id="fr"></section><script>
  const L = ${JSON.stringify(L)}, F = ${JSON.stringify(F)}, fr = document.getElementById('fr'), errs = [];
  const md = s => s.replace(/\\[\\[(.+?)\\]\\]/g, '<span class="blk">$1</span>').replace(/\\{\\{(.+?)\\}\\}/g, '<span class="accent">$1</span>').replace(/~~(.+?)~~/g, '<span class="strk">$1</span>');
  // 焦点：A 场里第一个填了贴纸的主体媒体槽位
  let focus = null;
  if ('${scene}' === 'A') for (const s of L.slots) { const f = F[s.id]; if (s.type !== 'group' && f && f.img && /stk|^$/.test(f.cls || '') && !String(f.cls || '').includes('photo') && (s.subject || s.type === 'media')) { const [x, y, w, h] = s.rect; focus = [x + w / 2, y + h / 2, Math.max(.6, Math.min(1.5, Math.min(w, h) / 560))]; break; } }
  BGLIB.mount(fr, '${scene === 'A' ? 'BG3' : 'BG2'}', 'libs/backgrounds/', focus ? { focus } : {});
  const put = el => fr.appendChild(el);
  // 类别 3：氛围道具（先放，压在内容下面）
  (F.amb || []).forEach(([n, x, y, w, h, d]) => { const e = document.createElement('img'); e.className = 'amb ' + d; e.src = 'cards/images/samples/ambient/amb_' + n + '.png'; e.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px'; put(e); });
  L.slots.forEach(s => {
    const f = F[s.id]; if (!f || s.type === 'group') return;
    const [x, y, w, h] = s.rect, pos = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    let e;
    if (f.ic) { e = IC.render(f.ic, f.data, { rect: s.rect, tone: f.tone, shape: s.shape }); e.dataset.label = s.id; put(e); IC.fit(e); return; }
    if (f.todo) { e = document.createElement('div'); e.className = 'todo'; e.style.cssText = pos; e.innerHTML = '<b>待补组件</b>' + f.todo; put(e); return; }
    if (f.box) { e = document.createElement('div'); e.className = 'box'; e.style.cssText = pos; put(e); return; }
    if (f.img) { e = document.createElement('img'); e.className = f.cls === undefined ? 'stk' : f.cls; e.src = f.img; e.style.cssText = pos + (f.pos ? ';object-position:' + f.pos : ''); put(e); return; }
    if (f.t != null) {
      e = document.createElement('div'); e.className = 'lab ' + (f.cls || ''); e.style.cssText = pos + ';font-size:' + f.fs + 'px';
      if ((f.cls || '').includes('blkcell')) { e.className = 'blkcell'; e.textContent = f.t; put(e); return; }
      e.innerHTML = '<div>' + md(f.t) + '</div>'; put(e);
      if (e.scrollWidth > w + 2 || e.scrollHeight > h + 2) errs.push(s.id + ' 文字溢出：' + f.t.slice(0, 12));
    }
  });
  const tag = document.createElement('div'); tag.className = 'idtag'; tag.textContent = L.id + ' · ' + L.name; put(tag);
  const cz = document.createElement('div'); cz.className = 'chapter-zone'; put(cz);
  window.ERRS = errs;
  </script></body></html>`;
}

(async () => {
  const ids = fs.readdirSync(path.join(ROOT, 'cards/layouts')).filter(n => /^L-.*\.json$/.test(n)).map(n => n.slice(0, -5)).sort();
  const b = await chromium.launch(), report = [];
  const ARGS = [Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex])), BRAND.contrast.forbidden, BRAND.type.meaningful_min, BRAND.type.decor_min, BRAND.contrast.text_min, BRAND.type.decor.per_card_max];
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const id of ids) {
    const F = FILL[id]; if (!F) { report.push(`${id}：没有填充`); continue; }
    const f = path.join(TMP, id + '.html'); fs.writeFileSync(f, pageHTML(LAYOUT(id), F));
    const errs = [];
    p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push('页面错误 ' + e.message));
    await p.goto('file://' + f);
    await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]));
    await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelectorAll('.ic').forEach(el => { el.querySelectorAll('[data-fs]').forEach(x => x.style.fontSize = x.dataset.fs + 'px'); IC.fit(el); }));
    const r = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
    errs.push(...r.errs, ...(await p.evaluate(() => window.ERRS)));
    const todo = await p.evaluate(() => [...document.querySelectorAll('.todo')].map(t => t.textContent.replace('待补组件', '')));
    report.push(`${id}：${errs.length ? '✗ ' + errs.join('；') : '✓'}${todo.length ? '　｜ 待补：' + todo.join(' / ') : ''}`);
    await p.screenshot({ path: path.join(OUT, id + '.jpg'), type: 'jpeg', quality: 82 });
  }
  // 总览板：每张 10 个（2 列 × 5 行）
  const per = 10;
  for (let g = 0; g * per < ids.length; g++) {
    const cells = ids.slice(g * per, g * per + per).map(id => `<div class="c"><img src="file://${OUT}/${id}.jpg"><b>${id} · ${LAYOUT(id).name}</b><i>${LAYOUT(id).function || ''}</i></div>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>html,body{width:2000px;height:auto;overflow:visible;background:#E9E3D6}body{padding:40px;font-family:var(--f-cn);color:var(--char)}
h1{font:400 56px/1 var(--f-disp);margin:0 0 8px}p{margin:0 0 28px;font-size:22px;opacity:.6}
.g{display:grid;grid-template-columns:1fr 1fr;gap:34px 40px}.c img{width:100%;display:block;border-radius:14px}.c b{display:block;font-size:26px;margin-top:10px}.c i{display:block;font-style:normal;font-size:20px;opacity:.6;margin-top:4px}</style></head>
<body><h1>知识卡片预览 ${g + 1} / ${Math.ceil(ids.length / per)}</h1><p>排版 + 信息卡 + 样张图片 · 内容为示意，图片为风格样张（不进正片）· 橙色虚线框 = 库里还没有的组件</p><div class="g">${cells}</div></body></html>`;
    const hf = path.join(TMP, `sheet_${g + 1}.html`); fs.writeFileSync(hf, html);
    const sp = await b.newPage({ viewport: { width: 2000, height: 800 } }); await sp.goto('file://' + hf); await sp.waitForTimeout(300);
    await sp.screenshot({ path: path.join(OUT, `sheet_${g + 1}.jpg`), fullPage: true, type: 'jpeg', quality: 80 }); await sp.close();
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n');
  console.log(report.join('\n'));
})();
