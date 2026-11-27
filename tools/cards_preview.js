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

/* ---------- 50 个排版的填充（1.8 丰富度版）---------- */
// 额外字段：scene 覆盖场景 · rect（槽位里）覆盖矩形 · tilt 倾斜 · deco [[x, y, 装饰小字]] · lines [[x1, y1, x2, y2, hot]] 引线
//           co [{from, to, label, en, hot}] 引线标注 · amb 氛围道具 · bokeh [[x, y, r]] 光斑
const TT = (title, fs) => IC('title', { title, fs: fs || 104 });
const TAGX = (text, o, tone) => IC('tag', { text, ...(o || {}) }, tone || 'card');
const STEP = (idx, name, en, icon, tone, o) => IC('step', { idx, name, en, icon, ...(o || {}) }, tone);
const EVT = (title, tilt, mark, note) => ({ ...EV(title, mark, note), tilt });
const FILL = {
  'L-K01': { t1: TT('提交之前，\n先定个级'), l1: T('平台按危害分档，\n档位越高，赏金越高', 52, 'wrap dim'), deco: [[64, 120, 'SEVERITY · 漏洞定级'], [64, 836, 'CVSS v3.1 · 0.0 – 10.0']],
    c1: IC('tier', { level: '严重', en: 'CRITICAL', desc: '能控制服务器', value: '9.0–10', score: 9.5, band: 'dark' }, 'lit'),
    c2: IC('tier', { level: '高危', en: 'HIGH', desc: '能读别人的数据', value: '7.0–8.9', score: 8, band: 'hot' }, 'lit'),
    c3: IC('tier', { level: '中危', en: 'MEDIUM', desc: '要一定条件', value: '4.0–6.9', score: 5.5, band: 'dark' }, 'lit'),
    c4: IC('tier', { level: '低危', en: 'LOW', desc: '影响有限', value: '0.1–3.9', score: 2, band: 'dark' }, 'lit'),
    m1: R('lock_open'), m2: R('bug'), m3: R('key'), m4: R('lock_closed') },
  'L-K02': { c1: IC('ring', { center: '越权', centerEn: 'IDOR', items: [{ name: '水平越权', en: 'HORIZONTAL', pct: 40, hot: true }, { name: '垂直越权', en: 'VERTICAL', pct: 25 }, { name: '未授权', en: 'UNAUTH', pct: 20 }, { name: '越权下载', en: 'FILE ACCESS', pct: 15 }] }),
    k1: MIC('ACCESS CONTROL · 越权分类'), t1: TT('越权，\n分四种'), c2: IC('keyword', { word: '水平越权', en: 'THIS EPISODE · 本期', icon: 'target' }, 'card') },
  'L-K03': { t1: TT('目标档案', 112), deco: [[1000, 150, 'TARGET DOSSIER · 授权测试']],
    c1: IC('list', { items: [{ text: '目标：shop.test', state: 'done' }, { text: '范围：Web / API', state: 'done' }, { text: '授权书编号', state: 'now' }, '测试时间窗'] }),
    m1: { ...IC('shot', { title: '授权书.pdf（示意）' }), tilt: -4 }, m2: EVT('shop.test', 3), l1: TAGX('已授权', { icon: 'badge-check' }, 'hot') },
  'L-K04': { t1: TT('漏洞从发现到奖励', 112), deco: [[68, 236, 'FLOW · 赏金流转']],
    c1: { ...IC('flow', { nodes: [{ name: '白帽', en: 'WHITE HAT', icon: 'user-round', hot: true }, { name: '平台', en: 'PLATFORM', icon: 'shield-check' }, { name: '厂商', en: 'VENDOR', icon: 'building-2' }],
      links: [{ from: 0, to: 1, label: '提交报告', en: 'REPORT' }, { from: 1, to: 2, label: '转交厂商', en: 'FORWARD' }, { from: 2, to: 1, label: '确认修复', en: 'FIXED', back: true }, { from: 1, to: 0, label: '发放奖励', en: 'BOUNTY', back: true }] }), rect: [64, 248, 1792, 640] },
    c2: null, c3: null, l1: null, l2: null, l3: null, l4: null },
  'L-K05': { p1: SC('sc02_magnifier'), c1: IC('keyword', { word: '越权', en: 'IDOR · BROKEN ACCESS CONTROL', exp: '看了不该你看的数据', icon: 'key-round' }, 'card'), m1: null,
    deco: [[160, 150, 'TERM 01 · 名词']], bokeh: [[1700, 260, 110], [240, 900, 90]] },
  'L-K06': { m1: { ...EV('平台规则（示意）'), tilt: -2 }, c1: IC('quote', { text: '同一个漏洞拆成多份提交，\n算[[刷洞]]，要扣分', src: '平台规则（示意）' }), deco: [[64, 120, 'ADVISORY · 原文 + 译文']] },
  'L-K07': { m1: PH(true), l1: T('返回状态码<small>HTTP STATUS</small>', 56, 'c'), l2: T('200', 320, 'num c'), l3: T('GET /api/orders/1002', 52, 'mono c dim') },
  'L-K08': { scene: 'A', t1: TT('AI 挖洞，按顺序来', 112), deco: [[68, 236, 'WORKFLOW · 06 STEPS']],
    c1: STEP('01', '确认授权', 'AUTHORIZE', 'file-check', 'card', { step: 6 }), c2: STEP('02', '信息收集', 'RECON', 'radar', 'card', { step: 6 }),
    c3: STEP('03', 'AI 扫描', 'AI SCAN', 'cpu', 'hot', { step: 6 }), c4: STEP('04', '人工复核', 'VERIFY', 'search-check', 'card', { step: 6 }),
    c5: STEP('05', '写报告', 'REPORT', 'file-text', 'card', { step: 6 }), c6: STEP('06', '等审核', 'TRIAGE', 'hourglass', 'card', { step: 6 }),
    c7: IC('vtrack', { en: 'PROGRESS · 03 / 06', items: ['确认授权', '信息收集', 'AI 扫描', '人工复核', '写报告', '等审核'], now: 2 }) },
  'L-K09': { t1: TT('一个发现，\n一张截图'), k1: MIC('05 FILES · ARCHIVED'), deco: [[64, 200, 'EVIDENCE · 证据墙']],
    g1: IC('wall', { shots: [{ img: EVI, title: 'EV-01 · ORDER 1002' }, { img: EVI, title: 'EV-02 · ORDER 1003' }, { img: EVI, title: 'EV-03 · NETWORK' }, { img: EVI, title: 'EV-04 · RESPONSE' }, { img: EVI, title: 'EV-05 · OWNER' }], mark: [0.58, 0.41, 0.2, 0.05], note: '别人的订单' }),
    m1: null, m2: null, m3: null, m4: null, m5: null },
  'L-K10': { p1: R('whitehat'), c1: IC('chip', { name: 'AI 能做', en: 'MACHINE', sub: '批量扫接口', icon: 'bot' }, 'card'), l1: T('VS', 96, 'num c'),
    c2: IC('chip', { name: '必须人来', en: 'HUMAN', sub: '判断真假', icon: 'user-round' }, 'hot'), l2: T('速度快，会误报', 52, 'c'), l3: T('慢，但要负责', 52, 'c'),
    amb: [['cable', 1580, 130, 260, 200, 'far'], ['screws', 120, 150, 200, 150, 'far']] },
  'L-K11': { p1: SC('sc02_boundary'), l1: T('先授权<small>AUTHORIZE</small>', 120, 'disp r'), l2: T('再{{动手}}<small>THEN TEST</small>', 120, 'disp'), bokeh: [[1700, 900, 110], [220, 220, 90]], deco: [[860, 960, 'SCOPE · 授权边界']] },
  'L-K12': { p1: SC('sc02_waiting'), l1: TAGX('“审核要多久？”', { icon: 'clock' }), l2: TAGX('“报告写了一晚上”', { icon: 'pencil' }), l3: TAGX('“又被判重复了”', { icon: 'repeat' }), l4: TAGX('“终于通过了”', { icon: 'badge-check' }),
    bokeh: [[1780, 860, 100], [120, 180, 80]] },
  'L-K13': { l1: T('~~挖洞靠运气~~', 120, 'c'), k1: MIC('LUCK?'), l2: T('靠方法<small>METHOD, NOT LUCK</small>', 440, 'disp c'), bokeh: [[300, 820, 130], [1650, 300, 110]] },
  'L-K14': { s1: PH(true), l1: T('抓包<small>CAPTURE</small>', 140, 'c'), l2: T('改包<small>TAMPER</small>', 140, 'c'), l3: T('{{重放}}<small>REPLAY</small>', 140, 'c'),
    lines: [[652, 508, 676, 508], [1244, 508, 1268, 508]], deco: [[96, 140, '01 → 02 → 03 · 递进']] },
  'L-K21': { p1: R('aichip'), c1: IC('list', { title: '发生了什么', items: [{ text: 'AI 扫到接口', state: 'done' }, { text: '改了 uid', state: 'done' }, { text: '读到别人手机号', state: 'now' }] }, 'card'),
    amb: [['keycaps', 820, 760, 420, 330, 'near']], co: [{ from: [600, 420], to: [860, 210], label: 'AI 扫描', en: 'STEP 03 · AI-ASSISTED' }] },
  'L-K22': { t1: TT('补一步校验，结果完全不同'), deco: [[68, 236, 'BEFORE / AFTER · 同一个请求']],
    c1: IC('term', { title: '修复前 · 200', lines: ['$ GET /api/user/1002', '# 只查了登录', '{', '  "uid": 1002,', '  "phone": [["138****"]]', '}'] }), l1: T('→', 64, 'blkcell'),
    c2: IC('term', { title: '修复后 · 403', lines: ['$ GET /api/user/1002', '# 加了归属校验', '{', '  "error":', '    "not owner"', '}'] }) },
  'L-K23': { p1: SC('sc02_magnifier'), t1: TT('只看这几个字段'), deco: [[740, 236, 'EVIDENCE · 3 FIELDS']], c1: T('GET /api/orders/1002', 52, 'mono'),
    c2: IC('term', { title: 'Response · 200', lines: ['"owner": [["user_b"]],', '"phone": "138****0012"'] }), l1: TAGX('越权成立', { dot: true, en: 'CONFIRMED' }) },
  'L-K24': { t1: TT('A 的钥匙，\n开了 B 的门'), l1: T('箭头＝动作，框＝归属', 52, 'dim'), l2: T('越权：{{成立}}', 56), deco: [[68, 210, 'OWNERSHIP · 归属']],
    c1: IC('nest', { outer: { name: '平台', en: 'PLATFORM' }, zones: [{ name: '用户 A 的空间', en: 'TENANT A', session: { text: '会话 A', icon: 'key-round' }, items: [{ text: '订单 1002', icon: 'file' }] }, { name: '用户 B 的空间', en: 'TENANT B', items: [{ text: '订单 1003', icon: 'file' }] }], cross: { from: 0, to: [1, 0], label: '改单号 · 越界' } }) },
  'L-K25': { p1: SC('sc02p_report'), l1: T('~~服务器挂了~~<small>SERVER DOWN</small>', 56), l2: T('~~参数写错了~~<small>TYPO</small>', 56), l3: T('~~缓存没清~~<small>CACHE</small>', 56),
    c1: IC('verdict', { text: '没做归属校验', en: 'ROOT CAUSE', mark: '!' }, 'hot'), bokeh: [[1700, 260, 100]] },
  'L-K26': { p1: AN('radar'), l1: T('常见越权 · 03 / 05', 52, 'c'),
    c1: { ...IC('chip', { name: '改 uid', icon: 'user-round' }, 'card'), tilt: -6 }, c2: { ...IC('chip', { name: '改订单号', icon: 'file' }, 'card'), tilt: -3 },
    c3: IC('keyword', { word: '改角色字段', en: 'ROLE TAMPERING', exp: '普通用户变管理员' }, 'hot'),
    c4: { ...IC('chip', { name: '改租户 ID', icon: 'building-2' }, 'card'), tilt: 3 }, c5: { ...IC('chip', { name: '越权下载', icon: 'folder' }, 'card'), tilt: 6 } },
  'L-K27': { p1: AN('chip'), t1: TT('AI 能帮你挖洞吗？', 112), deco: [[68, 236, 'OPENING · Q&A']],
    c1: IC('quote', { text: 'AI 找到的线索，\n要人来{{签字确认}}', src: '白帽工作守则（示意）' }, 'card') },
  'L-K28': { m1: { ...EV('漏洞报告（示意）'), tilt: -2 }, c1: T('上一条：影响范围是全部订单', 52, 'dim'), c2: IC('quote', { text: '任意登录用户\n可读取[[他人订单]]' }),
    c3: IC('stat', { value: '12,000', unit: '条', label: '可读订单', en: 'ORDERS EXPOSED', note: '示意数据' }), deco: [[912, 90 + 30, 'REPORT · 第 2 节']] },
  'L-K29': { s1: EV('shop.test/orders/1002', OWNER, '别人的订单'), c1: IC('keyword', { word: '越权', en: 'IDOR', exp: '改个号，就看到了', icon: 'key-round' }, 'card') },
  'L-K30': { c1: IC('term', { title: 'Request', lines: ['$ PUT /api/me', '"role": "admin"'] }), c2: IC('term', { title: 'Response · 200', lines: ['{', '  "uid": 1002,', '  "role": [["admin"]]', '}'] }),
    c3: IC('lens', { label: '第 3 行', text: '[["admin"]]', note: '普通用户自己改的' }), l1: TAGX('普通用户'), l2: T('≠', 56, 'num c'), l3: TAGX('admin') },
  'L-N01': { t1: TT('三个角色'), l1: T('一次测试里，\n谁在做什么', 52, 'wrap dim'), deco: [[64, 200, 'ROLES · 角色']],
    c1: STEP('01', '白帽', 'HUNTER', null, 'card', { desc: '写报告' }), c2: STEP('02', '复核', 'REVIEWER', null, 'card', { desc: '逐条核' }), c3: STEP('03', '审核', 'TRIAGE', null, 'card', { desc: '等结果' }),
    m1: SC('sc02p_report'), m2: SC('sc02_magnifier'), m3: SC('sc02_waiting') },
  'L-N02': { m1: AN('lock'), l1: T('第 2 章', 52, 'dim'), t1: TT('越权', 240), k1: MIC('CHAPTER 02 · ACCESS CONTROL'), l2: T('改一个数字，就看到了别人的东西', 52),
    deco: [[64, 800, '03 CASES · 12 MIN']] },
  'L-N03': { t1: TT('审核通过，\n会收到通知'), c1: IC('chip', { name: '报告已通过', sub: '定级：高危（示意）' }, 'card'), m1: DEV,
    deco: [[64, 200, 'NOTIFY · 通知']], bokeh: [[1760, 220, 110], [900, 940, 80]] },
  'L-N04': { p1: R('laptop'), m1: EVT('orders/1002', -6), m2: EVT('orders/1003', 6), m3: EVT('Response', 0, OWNER, 'owner'), amb: [['keycaps', 1500, 120, 360, 260, 'far']] },
  'L-N05': { scene: 'A', t1: TT('常见的六类漏洞', 112), deco: [[68, 236, 'VULN TYPES · 06']], m1: PH(false),
    c1: STEP('01', '注入', 'INJECTION', 'braces'), c2: STEP('02', 'XSS', 'SCRIPT', 'code'), c3: STEP('03', 'SSRF', 'SERVER FETCH', 'globe'),
    c4: STEP('04', '越权', 'IDOR', 'key-round', 'hot'), c5: STEP('05', '信息泄露', 'EXPOSURE', 'eye'), c6: STEP('06', '逻辑漏洞', 'LOGIC', 'git-branch') },
  'L-N06': { c1: { box: 'paper' }, t1: TT('某平台通报：越权读取订单'), m1: { ...EV('案例配图（示意）'), tilt: -2 },
    l1: T('有用户发现，改一下订单号\n就能看到别人的收货信息。\n平台已修复，并给提交者\n发放了奖励。', 52, 'wrap'), l2: TAGX('示意案例', { icon: 'triangle-alert' }, 'hot'), deco: [[128, 290, 'CASE STUDY · 示意']] },
  'L-N07': { p1: null, m1: { ...SC('sc02_borrowed_key'), pos: '82% 50%' }, l1: T('越权，就像拿别人的钥匙开门<small>METAPHOR · 意象</small>', 64), k1: null, bokeh: [[300, 300, 120], [1700, 880, 100]] },
  'L-N08': { t1: TT('漏洞藏在\n哪一层？'), deco: [[64, 200, 'ANATOMY · 网站三层']],
    m1: { ...IC('layers', { layers: [{ name: '前端', en: 'FRONTEND', icon: 'monitor', desc: '只是藏了按钮' }, { name: '接口', en: 'API', icon: 'server', hit: true, desc: '没校验归属' }, { name: '数据库', en: 'DATABASE', icon: 'database', desc: '数据没问题' }] }), rect: [576, 104, 1280, 768] },
    l1: null, l2: null, l3: null },
  'L-N09': { t1: TT('复现四步'), deco: [[64, 520, 'REPRO · 04 STEPS']], m1: EVT('登录 A', -3), m2: EVT('抓包', -1), m3: EVT('改单号', 1), m4: EVT('看到 B', 3),
    l1: TAGX('登录 A', { en: 'STEP 01' }), l2: TAGX('抓包', { en: 'STEP 02' }), l3: TAGX('改单号', { en: 'STEP 03' }), l4: TAGX('看到 B', { en: 'STEP 04' }, 'hot') },
  'L-N10': { t1: TT('入门只要\n一台电脑'), deco: [[64, 200, 'GEAR · 入门配置']], m1: R('laptop'),
    l1: TAGX('8G 内存就够'), l2: TAGX('抓包工具', { icon: 'scan-search' }), l3: TAGX('浏览器插件', { icon: 'globe' }),
    lines: [[1010, 380, 904, 272], [1330, 400, 1408, 300], [1300, 620, 1376, 764]], amb: [['keycaps', 1520, 860, 420, 300, 'near'], ['cable', 620, 780, 260, 200, 'far']] },
  'L-N11': { p1: R('shield'), m1: null, c1: IC('keyword', { word: 'owner 字段', exp: '这单是谁的', icon: 'file' }, 'card'), c2: IC('verdict', { text: '没校验，\n就是越权', en: 'VERDICT' }, 'hot'),
    l1: TAGX('单主：B'), l2: TAGX('我：A'), amb: [['screws', 120, 860, 240, 170, 'far']] },
  'L-N12A': { p1: R('aichip'), l1: TAGX('抓包', { icon: 'scan-search' }), l2: TAGX('改参数', { icon: 'pencil' }), l3: TAGX('重放', { icon: 'repeat' }),
    l4: TAGX('比对', { icon: 'git-branch' }), l5: TAGX('截图', { icon: 'camera' }), l6: TAGX('归属？', { icon: 'triangle-alert' }, 'hot'),
    lines: [[740, 470, 512, 332], [720, 560, 560, 556], [740, 650, 512, 780], [1180, 460, 1408, 300], [1200, 540, 1408, 524], [1180, 640, 1408, 748, 1]], amb: [['usbc', 1500, 860, 300, 220, 'far']] },
  'L-N12B': { c1: IC('verdict', { text: '每一步\n都留证据', en: 'KEEP EVIDENCE' }), m1: null, l1: TAGX('抓包', { icon: 'scan-search' }), l2: TAGX('改参数', { icon: 'pencil' }), l3: TAGX('重放', { icon: 'repeat' }),
    l4: TAGX('比对', { icon: 'git-branch' }), l5: TAGX('截图', { icon: 'camera' }), l6: TAGX('归属？', { icon: 'triangle-alert' }, 'hot'), k1: MIC('NOTE · 先存证'),
    lines: [[580, 400, 512, 332], [560, 500, 560, 556], [600, 640, 512, 780], [1340, 400, 1408, 300], [1360, 500, 1408, 524], [1330, 640, 1408, 748, 1]] },
  'L-N13': { p1: SC('sc02_magnifier'), c1: TAGX('这个漏洞值几级？', { dot: true }), m1: null,
    l1: T('影响面<small>IMPACT</small>', 88), l2: T('利用难度<small>COMPLEXITY</small>', 88), l3: T('数据敏感<small>SENSITIVITY</small>', 88), l4: T('要不要登录<small>AUTH REQUIRED</small>', 88), l5: T('{{能否批量}}<small>SCALE</small>', 88) },
  'L-N14': { p1: SC('sc02p_report'), t1: TT('复盘：\n三条证据'), c1: IC('keyword', { idx: '01', word: '请求', en: 'REQUEST', exp: '改了单号' }), c2: IC('keyword', { idx: '02', word: '响应', en: 'RESPONSE', exp: 'owner 变了' }, 'hot'),
    c3: IC('keyword', { idx: '03', word: '页面', en: 'PAGE', exp: '别人信息' }), m1: null, m2: null, m3: null, deco: [[880, 360, 'REVIEW · 复盘']] },
  'L-N15': { l1: T('共 4 步 · 第 3 步', 52, 'dim'), l2: T('✓ 抓包', 56, 'dim'), t1: TT('改包', 240), k1: MIC('STEP 03 · TAMPER'), l3: T('下一步：？？？', 56, 'dim'), m1: R('key'),
    amb: [['screws', 1560, 820, 300, 220, 'far'], ['cable', 1600, 130, 240, 180, 'far']] },
  'L-N16': { m1: PH(true), l1: T('{{没校验}}，\n就是越权', 120, 'c wrap'), l2: TAGX('“改个号就行？”', { icon: 'message-square' }), l3: TAGX('“这也算漏洞？”', { icon: 'message-square' }),
    l4: TAGX('“我以为有校验”', { icon: 'message-square' }), l5: TAGX('“赶紧提交”', { icon: 'message-square' }) },
  'L-N17': { t1: TT('一次请求，\n五种走向'), c1: STEP('01', '登录', 'LOGIN', 'user-round'), c2: STEP('02', '发请求', 'REQUEST', 'arrow-right'),
    c3: IC('keyword', { word: '服务器', en: 'SERVER', exp: '查不查归属？', icon: 'server' }), m1: null,
    l1: TAGX('查了 · 403'), l2: TAGX('没查 · 200'), l3: TAGX('读到别人订单', {}, 'hot'), l4: TAGX('改了别人订单'), l5: TAGX('删了别人订单'),
    lines: [[1248, 556, 1440, 388], [1248, 556, 1440, 496], [1248, 556, 1440, 600, 1], [1248, 556, 1440, 708], [1248, 556, 1440, 812], [400, 728, 432, 640], [768, 640, 800, 556]] },
  'L-N18': { m1: R('briefcase'), t1: TT('漏洞分类'), l1: T('参考 OWASP 2021', 52, 'dim'), c1: TAGX('访问控制', { icon: 'shield' }),
    l2: T('注入', 52, 'c dim'), l3: T('加密失效', 52, 'c dim'), l4: T('错误配置', 52, 'c dim'), c2: TAGX('本期：越权（IDOR）', {}, 'hot'), l5: T('水平越权', 52, 'c'), l6: T('{{垂直越权}}', 64, 'c'),
    lines: [[1280, 256, 1280, 192], [1104, 320, 1056, 332], [1456, 320, 1504, 332], [1280, 384, 1280, 464], [1100, 568, 960, 688], [1460, 568, 1600, 680, 1]] },
  'L-N19': { l1: T('认证<small>AUTHN · 你是谁</small>', 140, 'c'), m1: R('key'), l2: T('[[授权]]<small>AUTHZ · 你能做什么</small>', 140, 'c'),
    l3: T('“我登录了”', 52, 'c dim'), l4: T('“但这不是我的”', 52, 'c dim'), k1: MIC('AUTHN ≠ AUTHZ') },
  'L-N20': { l1: T('能用<small>WORKS</small>', 160, 'c'), m1: R('lock_open'), l2: T('[[不安全]]<small>UNSAFE</small>', 160, 'c'), k1: null, deco: [[64, 860, 'SAME LOCK · 同一把锁']] },
  'L-N21': { m1: R('laptop'), t1: TT('动手前备齐'), k1: MIC('CHECKLIST · 05'),
    c1: STEP('01', '授权书', 'AUTH', 'file-check'), c2: STEP('02', '测试账号', 'ACCOUNTS', 'users', 'hot'), c3: STEP('03', '抓包工具', 'PROXY', 'scan-search'),
    c4: STEP('04', 'AI 助手', 'AI', 'bot'), c5: STEP('05', '记录模板', 'NOTES', 'clipboard-check'),
    lines: [[800, 300, 232, 312], [860, 420, 568, 600], [1120, 420, 1352, 600], [1120, 300, 1688, 312]] },
  'L-N22': { t1: TT('一百个里\n只有\n一个是真'), deco: [[64, 200, 'NOISE · 100 : 1']],
    m1: { ...IC('crowd', { rows: 4, cols: 5, odd: 13, icon: 'bug' }), rect: [544, 104, 880, 768] }, l1: TAGX('都一样'),
    m2: IC('zoom', { icon: 'bug', label: '这一个', en: 'REAL ONE' }), l2: null, lines: [[1250, 578, 1460, 640, 1]] },
  'L-N23': { t1: TT('证据只看\n这一行'), l1: T('详情接口里\n{{owner}} 变了', 52, 'wrap'), deco: [[64, 200, 'PROOF · 1 LINE']],
    m1: { ...EV('订单列表（示意）'), tilt: -3 }, m2: { ...EV('Response', OWNER, 'owner'), tilt: 2 }, m3: null, c1: IC('verdict', { text: '越权成立', why: 'owner ≠ 当前用户' }) },
  'L-N24': { t1: TT('补一行校验', 112), deco: [[68, 236, 'PATCH · 修复']], l1: T('修复前', 64, 'c'), l2: T('修复后', 64, 'c'),
    m1: R('lock_open'), m2: IC('term', { title: '修复前 · 200', lines: ['GET /orders/1002', '"owner": "user_b"'] }),
    m3: IC('term', { title: '修复后 · 403', lines: ['GET /orders/1002', '[["not owner"]]'] }), m4: R('lock_closed'),
    l3: T('+ 归属校验', 52, 'c'), l4: T('owner ≠ 我 → 403', 52, 'c') },
  'L-N25': { m1: R('radar'), l1: T('~~版本泄露~~', 56), l2: T('~~缺少头部~~', 56), l3: T('~~弱密码？~~', 56), l4: T('~~XSS？~~', 56),
    l5: T('~~端口开放~~', 56), l6: T('~~重复报告~~', 56), l7: T('~~误报~~', 56), l8: T('~~低危~~', 56),
    c1: IC('stat', { value: '1', unit: '个', label: '能提交（示意）', en: 'SIGNAL' }), deco: [[96, 128, 'NOISE · 扫描器输出']], lines: [[992, 488, 1040, 488, 1]] }
};

/* ---------- 页面 ---------- */
const HEAD = `<meta charset="utf-8"><base href="file://${ROOT}/">
<link rel="stylesheet" href="engine/tokens.css"><link rel="stylesheet" href="engine/base.css">
<link rel="stylesheet" href="engine/motion/motion.css"><link rel="stylesheet" href="cards/infocards/infocards.css">
<script src="engine/motion/tokens.js"></script><script src="engine/motion/motion.js"></script><script src="cards/infocards/infocards.js"></script>
<script src="libs/backgrounds/backgrounds.js"></script><script src="libs/icons/icons.js"></script>
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
.deco{position:absolute;font:500 19px/1 var(--f-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--s-title);opacity:.45;white-space:nowrap;z-index:6}
.bokeh{position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(245,238,223,.14),rgba(245,238,223,0) 70%)}
svg.lines{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:2;color:var(--s-title)}
svg.lines line{stroke:currentColor;stroke-opacity:.45;stroke-width:2.5}svg.lines line.hot{stroke:var(--orange);stroke-opacity:1}svg.lines circle{fill:currentColor;opacity:.7}svg.lines circle.hot{fill:var(--orange);opacity:1}
.idtag{position:absolute;right:64px;bottom:20px;font:500 18px/1 var(--f-mono);letter-spacing:.16em;color:var(--s-title);opacity:.38;z-index:70}
</style>`;

function pageHTML(L, F) {
  const scene = F.scene || (L.scene || ['A'])[0];
  return `<!doctype html><html><head>${HEAD}</head><body><section class="frame" id="fr"></section><script>
  const L = ${JSON.stringify(L)}, F = ${JSON.stringify(F)}, fr = document.getElementById('fr'), errs = [];
  const md = s => s.replace(/\\[\\[(.+?)\\]\\]/g, '<span class="blk">$1</span>').replace(/\\{\\{(.+?)\\}\\}/g, '<span class="accent">$1</span>').replace(/~~(.+?)~~/g, '<span class="strk">$1</span>');
  // 焦点：A 场里第一个填了贴纸的主体媒体槽位
  let focus = null;
  if ('${scene}' === 'A') for (const s of L.slots) { const f = F[s.id]; if (s.type !== 'group' && f && f.img && /stk|^$/.test(f.cls || '') && !String(f.cls || '').includes('photo') && (s.subject || s.type === 'media')) { const [x, y, w, h] = s.rect; focus = [x + w / 2, y + h / 2, Math.max(.6, Math.min(1.5, Math.min(w, h) / 560))]; break; } }
  BGLIB.mount(fr, '${scene === 'A' ? 'BG3' : 'BG2'}', 'libs/backgrounds/', focus ? { focus } : {});
  const put = el => fr.appendChild(el);
  // 类别 3：氛围道具（先放，压在内容下面）
  (F.bokeh || []).forEach(([x, y, r]) => { const e = document.createElement('div'); e.className = 'bokeh'; e.style.cssText = 'left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + 2 * r + 'px;height:' + 2 * r + 'px'; put(e); });
  if (F.lines) { const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('class', 'lines'); sv.setAttribute('width', 1920); sv.setAttribute('height', 1080);
    sv.innerHTML = F.lines.map(([a, b, c, d, h]) => '<line class="' + (h ? 'hot' : '') + '" x1="' + a + '" y1="' + b + '" x2="' + c + '" y2="' + d + '"/><circle class="' + (h ? 'hot' : '') + '" cx="' + a + '" cy="' + b + '" r="5"/>').join(''); put(sv); }
  (F.amb || []).forEach(([n, x, y, w, h, d]) => { const e = document.createElement('img'); e.className = 'amb ' + d; e.src = 'cards/images/samples/ambient/amb_' + n + '.png'; e.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px'; put(e); });
  L.slots.forEach(s => {
    const f = F[s.id]; if (!f) return;
    const [x, y, w, h] = f.rect || s.rect, pos = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    let e;
    if (f.ic) { e = IC.render(f.ic, f.data, { rect: f.rect || s.rect, tone: f.tone, shape: s.shape, tilt: f.tilt }); e.dataset.label = s.id; put(e); IC.fit(e); return; }
    if (f.todo) { e = document.createElement('div'); e.className = 'todo'; e.style.cssText = pos; e.innerHTML = '<b>待补组件</b>' + f.todo; put(e); return; }
    if (f.box) { e = document.createElement('div'); e.className = 'box'; e.style.cssText = pos; put(e); return; }
    if (f.img) { e = document.createElement('img'); e.className = f.cls === undefined ? 'stk' : f.cls; e.src = f.img; e.style.cssText = pos + (f.pos ? ';object-position:' + f.pos : '') + (f.tilt ? ';rotate:' + f.tilt + 'deg' : ''); put(e); return; }
    if (f.t != null) {
      e = document.createElement('div'); e.className = 'lab ' + (f.cls || ''); e.style.cssText = pos + ';font-size:' + f.fs + 'px';
      if ((f.cls || '').includes('blkcell')) { e.className = 'blkcell'; e.textContent = f.t; put(e); return; }
      e.innerHTML = '<div>' + md(f.t) + '</div>'; put(e);
      if (e.scrollWidth > w + 2 || e.scrollHeight > h + 2) errs.push(s.id + ' 文字溢出：' + f.t.slice(0, 12));
    }
  });
  (F.deco || []).forEach(([x, y, t]) => { const e = document.createElement('div'); e.className = 'deco'; e.dataset.role = 'decor'; e.style.cssText = 'left:' + x + 'px;top:' + y + 'px'; e.textContent = t; put(e); });
  (F.co || []).forEach(o => IC.callout(fr, o));
  const tag = document.createElement('div'); tag.className = 'idtag'; tag.textContent = L.id + ' · ' + L.name; put(tag);
  const cz = document.createElement('div'); cz.className = 'chapter-zone'; put(cz);
  // 每屏装饰小字 ≤ 16；图解组件、标注、倾斜卡不出画面、不进章节进度条区
  const nd = fr.querySelectorAll('[data-role="decor"]').length; if (nd > 16) errs.push('装饰小字 ' + nd + ' 处，每屏最多 16 处');
  fr.querySelectorAll('.ic-at,.ic-node,.ic-sw,.ic-zone,.ic-tile,.ic-callout,.ic-pillbox').forEach(e => { const r = e.getBoundingClientRect(); if (r.left < -2 || r.right > 1922 || r.top < 74 || r.bottom > 1082) errs.push((e.closest('.ic') || e).dataset.label + ' 的「' + e.textContent.slice(0, 8) + '」出画面或压到章节进度条区'); });
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
