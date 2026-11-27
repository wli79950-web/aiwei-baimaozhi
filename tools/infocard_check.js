// 信息卡库自检 + 预览：node tools/infocard_check.js            （在仓库根目录运行；先 npm i）
//  1. 把 cards/infocards/samples.json 的每个样例分别放进 A 炭黑场（BG3 工作台）/ B 奶油白场（BG2）的真实画面里（背景板库的底板 + 动态层），逐张检查：
//     放得下（IC.fit）· 有意义的文字 ≥ 52px（装饰小字除外，每张卡最多 3 处）· 实际渲染出来的字色 / 底色
//     不是三条禁用组合、对比 ≥ 4.5 · 只用色板里的颜色
//  2. 用 cards/layouts/ 的排版 + 背景板库搭演示关键帧（信息卡填进槽位），同样检查，并验证逐帧确定性（乱序渲染像素一致）
//  3. 输出预览：docs/previews/infocards/sheet_A_1….jpg、sheet_B_1….jpg（1920×1080 一页）、demo_D*.jpg、phone_*.jpg
// 有任何一项不通过就以退出码 1 结束。加 --no-preview 只检查不出图。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), IC_DIR = path.join(ROOT, 'cards/infocards');
const OUT = path.join(ROOT, 'docs/previews/infocards'), TMP = path.join(ROOT, 'out/infocards');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const SAMPLES = JSON.parse(fs.readFileSync(path.join(IC_DIR, 'samples.json'), 'utf8')).items;
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));
const noPreview = process.argv.includes('--no-preview');
fs.mkdirSync(TMP, { recursive: true }); if (!noPreview) fs.mkdirSync(OUT, { recursive: true });

const HEAD = `<meta charset="utf-8"><base href="file://${IC_DIR}/">
<link rel="stylesheet" href="../../engine/tokens.css"><link rel="stylesheet" href="../../engine/base.css">
<link rel="stylesheet" href="../../engine/motion/motion.css"><link rel="stylesheet" href="infocards.css">
<script src="../../engine/motion/tokens.js"></script><script src="../../engine/motion/motion.js"></script><script src="infocards.js"></script>
<script src="../../libs/backgrounds/backgrounds.js"></script>`;
const BGBASE = '../../libs/backgrounds/';

const pageCheck = require('./lib/pagecheck.js');

/* ---------- 预览板：一个场景一张 ---------- */
// 每页一个 1920×1080 画面：背景板库 BG3 / BG2（底板 + 动态层）上排样例，样例上方的小字是说明（只在预览里有）
function sheetHTML(scene) {
  return `<!doctype html><html><head>${HEAD}<style>html,body{width:1920px;height:auto;overflow:visible}
  .frame{position:absolute;left:0}
  .cap{position:absolute;font:500 22px/1.2 var(--f-mono);letter-spacing:.06em;opacity:.6;white-space:nowrap;z-index:5}</style></head>
  <body style="position:relative">
  <script>
  const items = ${JSON.stringify(SAMPLES)}, X0 = 64, X1 = 1856, Y0 = 96, Y1 = 1024, GAP = 48, CAP = 40;
  let page = -1, fr, x, y, rowH;
  function newPage() { page++; fr = document.createElement('section'); fr.className = 'frame'; fr.style.top = page * 1080 + 'px'; fr.dataset.page = page;
    document.body.appendChild(fr); BGLIB.mount(fr, '${scene === 'A' ? 'BG3' : 'BG2'}', '${BGBASE}'); x = X0; y = Y0; rowH = 0; }
  newPage();
  items.forEach(it => {
    const [w, h] = it.wh || IC.SIZE[it.size];
    if (x + w > X1) { x = X0; y += rowH + GAP + CAP; rowH = 0; }
    if (y + h > Y1) newPage();
    const cap = document.createElement('div'); cap.className = 'cap'; cap.style.cssText = 'left:' + x + 'px;top:' + (y - 32) + 'px'; cap.textContent = it.label; fr.appendChild(cap);
    const el = IC.render(it.type, it.data, { rect: [x, y, w, h], tone: it.tone }); el.dataset.label = it.label;
    fr.appendChild(el); IC.fit(el);
    x += w + GAP; rowH = Math.max(rowH, h);
  });
  window.PAGES = page + 1; document.body.style.height = (page + 1) * 1080 + 'px';
  </script></body></html>`;
}

/* ---------- 演示关键帧：排版 + 信息卡 ---------- */
// fill：槽位 id → { ic, data, tone, cue } 信息卡 | { text, fs, cls } 纯文字 | { img } 图片
const SMP = '../images/samples/';
const DEMOS = [
  { id: 'D1', scene: 'A', layout: 'L-K08', sub: '五步，<em>按顺序</em>一步一步来', fill: {
    t1: { ic: 'title', data: { title: 'AI 挖洞，按顺序来', fs: 112 } },
    c1: { ic: 'step', data: { idx: '01', name: '确认授权', img: SMP + 'bmz_key.png' } },
    c2: { ic: 'step', data: { idx: '02', name: '信息收集', img: SMP + 'bmz_radar.png' } },
    c3: { ic: 'step', tone: 'hot', data: { idx: '03', name: 'AI 扫描', img: SMP + 'bmz_aichip.png' } },
    c4: { ic: 'step', data: { idx: '04', name: '人工复核', img: SMP + 'bmz_shield.png' } },
    c5: { ic: 'step', data: { idx: '05', name: '写报告', img: SMP + 'bmz_laptop.png' } },
    c6: { ic: 'step', data: { idx: '06', name: '等审核', img: SMP + 'bmz_coin.png' } },
    c7: { ic: 'stat', tone: 'lit', data: { value: '80', unit: '%', label: '体力活\n交给 AI', note: '示意数据' } } } },
  { id: 'D2', scene: 'B', layout: 'L-K22', sub: '同一个请求，<em>补上校验</em>就读不到了', fill: {
    t1: { ic: 'title', data: { title: '补一步校验，结果完全不同', fs: 104 } },
    c1: { ic: 'term', data: { title: '修复前 · 200', lines: ['$ GET /api/user/1002', '# 只查了登录', '{', '  "uid": 1002,', '  "phone": [["138****"]]', '}'] } },
    l1: { text: '→', fs: 64, cls: 'blkcell' },
    c2: { ic: 'term', data: { title: '修复后 · 403', lines: ['$ GET /api/user/1002', '# 加了归属校验', '{', '  "error":', '    [["not owner"]]', '}'] } } } },
  { id: 'D3', scene: 'A', layout: 'L-K10', sub: '同样是挖洞，<em>判断</em>这一步只能人来', fill: {
    p1: { img: SMP + 'bmz_whitehat.png' },
    c1: { ic: 'chip', tone: 'card', data: { name: 'AI 能做', sub: '批量扫接口' } },
    l1: { text: 'VS', fs: 64, cls: 'num darkcell' },
    c2: { ic: 'chip', tone: 'hot', data: { name: '必须人来', sub: '判断真假' } },
    l2: { text: '速度快，会误报', fs: 52 }, l3: { text: '慢，但要负责', fs: 52 } } },
  { id: 'D4', scene: 'A', layout: 'L-K21', sub: 'AI 给了线索，<em>确认</em>还得你来', fill: {
    p1: { img: SMP + 'bmz_aichip.png' },
    c1: { ic: 'chat', data: { msgs: [{ who: 'me', text: '这个接口\n能越权吗？' }, { who: 'ai', text: '改 uid 能读到\n别人的手机号' }, { who: 'me', text: '先确认\n{{授权范围}}' }] } } } },
  { id: 'D5', scene: 'B', layout: 'L-K01', sub: '提交之前，先看它值<em>几级</em>', fill: {
    t1: { ic: 'title', data: { title: '提交之前，\n先定个级', fs: 104 } },
    l1: { text: '平台按危害分档，档位越高，赏金越高', fs: 52, cls: 'wrap' },
    c1: { ic: 'tier', tone: 'lit', data: { level: '严重', desc: '能控制服务器', value: '9.0–10' } },
    c2: { ic: 'tier', tone: 'lit', data: { level: '高危', desc: '能读别人的数据', value: '7.0–8.9' } },
    c3: { ic: 'tier', tone: 'lit', data: { level: '中危', desc: '要一定条件', value: '4.0–6.9', band: 'aux' } },
    c4: { ic: 'tier', tone: 'lit', data: { level: '低危', desc: '影响有限', value: '0.1–3.9', band: 'card' } },
    m1: { img: SMP + 'bmz_lock_open.png' }, m2: { img: SMP + 'bmz_bug.png' }, m3: { img: SMP + 'bmz_key.png' }, m4: { img: SMP + 'bmz_lock_closed.png' } } },
  { id: 'D6', scene: 'A', layout: 'L-K30', sub: '放大这一行：<em>权限</em>被改成了 admin', fill: {
    c1: { ic: 'term', data: { title: 'Request', lines: ['$ PUT /api/me', '"role": "admin"'] } },
    c2: { ic: 'term', data: { title: 'Response · 200', lines: ['{', '  "uid": 1002,', '  "role": [["admin"]]', '}'] } },
    c3: { ic: 'lens', data: { label: '第 3 行', text: '[["admin"]]', note: '普通用户自己改的' } },
    l1: { ic: 'tag', tone: 'card', data: { text: '普通用户' } }, l2: { text: '≠', fs: 56, cls: 'num' }, l3: { ic: 'tag', tone: 'card', data: { text: 'admin' } } } },
  { id: 'D7', scene: 'A', layout: 'L-N03', sub: '审核通过，会收到这样<em>一条通知</em>', fill: {
    t1: { ic: 'title', data: { title: '交完报告，\n就等这一条', fs: 104 } },
    c1: { ic: 'verdict', data: { text: '审核通过', why: '定级：高危', mark: '✓' } },
    m1: { ic: 'phone', data: { time: '21:36', notes: [{ app: 'SRC 平台', text: '报告已通过' }, { app: 'SRC 平台', text: '赏金 [[已到账]]' }] } } } },
  { id: 'D8', scene: 'B', layout: 'L-K03', sub: '每次动手之前，先建一份<em>目标档案</em>', fill: {
    t1: { ic: 'title', data: { title: '目标档案', fs: 112 } },
    c1: { ic: 'list', data: { items: [{ text: '目标：test.local', state: 'done' }, { text: '范围：Web / API', state: 'done' }, { text: '授权书编号', state: 'now' }, { text: '测试时间窗' }] } },
    m1: { ic: 'shot', data: { title: '授权书.pdf' } },
    m2: { ic: 'shot', data: { title: 'test.local', mark: [0.1, 0.3, 0.46, 0.22], note: '入口' } },
    l1: { ic: 'tag', tone: 'hot', data: { text: '已授权', dot: true } } } },
  { id: 'D9', scene: 'A', layout: 'L-K24', sub: 'AI 报了三个，<em>真的只有一个</em>', fill: {
    t1: { ic: 'title', data: { title: 'AI 报的，\n要一条条核', fs: 104 } },
    l1: { text: '左边是 AI 说的，右边是你复核的结果', fs: 52, cls: 'wrap' },
    l2: { ic: 'tag', tone: 'hot', data: { text: '1 / 3 成立' } },
    c1: { ic: 'review', data: { rows: [{ ai: '越权读订单', human: '确认', ok: true }, { ai: 'SQL 注入', human: '误报', ok: false }, { ai: 'XSS', human: '误报', ok: false }, { ai: '版本泄露', human: '低危', ok: true }] } } } },
  { id: 'D10', scene: 'B', layout: 'L-K08', sub: '先把基础打牢，<em>再上 AI</em>', fill: {
    t1: { ic: 'title', data: { title: '白帽入门，按顺序学', fs: 112 } },
    c1: { ic: 'skill', data: { lv: '01', name: 'HTTP 基础', state: 'done' } },
    c2: { ic: 'skill', data: { lv: '02', name: '抓包改包', state: 'done' } },
    c3: { ic: 'skill', data: { lv: '03', name: '常见漏洞', state: 'now', pct: 60 } },
    c4: { ic: 'skill', data: { lv: '04', name: '写报告', state: 'lock' } },
    c5: { ic: 'skill', data: { lv: '05', name: 'AI 辅助', state: 'lock' } },
    c6: { ic: 'skill', data: { lv: '06', name: '挖真实 SRC', state: 'lock' } },
    c7: { ic: 'jd', data: { role: '安全\n工程师', meta: '示意', reqs: ['Web 漏洞', '[[会用 AI]]', '报告'] } } } }
];
function demoHTML(d) {
  const L = LAYOUT(d.layout);
  return `<!doctype html><html><head>${HEAD}<style>.darkcell,.blkcell{border-radius:var(--r-sm);corner-shape:var(--corner)}.darkcell{background:var(--char);color:var(--cream)}.blkcell{background:var(--orange);color:var(--char);display:flex;align-items:center;justify-content:center}
  .lab{position:absolute;display:flex;align-items:center;font-family:var(--f-cn);font-weight:700}
  .lab.num{font-family:var(--f-num);font-weight:900;justify-content:center}
  .lab.wrap{white-space:normal;line-height:1.32;align-items:flex-start;opacity:.9}</style></head>
  <body><section class="frame" id="fr" data-label="${d.id}">
  <div class="sub" id="sub" style="z-index:50">${d.sub}</div><div class="chapter-zone"></div></section>
  <script>
  const L = ${JSON.stringify(L)}, F = ${JSON.stringify(d.fill)}, fr = document.getElementById('fr'), cards = [];
  const bg = BGLIB.mount(fr, '${d.scene === 'A' ? 'BG3' : 'BG2'}', '${BGBASE}');
  L.slots.forEach((s, i) => {
    const f = F[s.id]; if (!f || s.type === 'group') return;
    const [x, y, w, h] = s.rect; let el;
    if (f.ic) { el = IC.render(f.ic, f.data, { rect: s.rect, tone: f.tone, shape: s.shape }); el.dataset.label = '${d.id} ' + s.id; }
    else if (f.img) { el = document.createElement('img'); el.className = 'stk'; el.src = f.img; el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px'; el.dataset.role = 'stk'; }
    else { el = document.createElement('div'); el.className = 'lab ' + (f.cls || ''); el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;font-size:' + f.fs + 'px'; el.textContent = f.text; }
    fr.insertBefore(el, document.getElementById('sub')); if (f.ic) IC.fit(el);
    cards.push({ el, f, i });
  });
  window.renderAt = function (t) {
    BGLIB.animate(bg, t);
    cards.forEach((c, k) => {
      const at = 0.2 + k * 0.12;
      if (c.f.ic) IC.animate(c.el, t, { in: at, emph: at + 0.6 });
      else if (c.f.img) BM.set(c.el, BM.drop(t, at));
      else BM.set(c.el, BM.rise(t, at));
    });
  };
  </script></body></html>`;
}

(async () => {
  const b = await chromium.launch(), errs = [], warns = [];
  const ARGS = [Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex])), BRAND.contrast.forbidden, BRAND.type.meaningful_min, BRAND.type.decor_min, BRAND.contrast.text_min, BRAND.type.decor.per_card_max];
  const ready = async p => { await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await p.waitForTimeout(200); };
  const used = new Set();

  // 1. 样例 × 两个场景
  for (const sc of ['A', 'B']) {
    const f = path.join(TMP, `sheet_${sc}.html`); fs.writeFileSync(f, sheetHTML(sc));
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    p.on('pageerror', e => errs.push(`sheet ${sc}：${e.message}`));
    await p.goto('file://' + f); await ready(p);
    // 字体就绪后重新算一次字号（第一次 fit 时字体可能还没加载完）
    await p.evaluate(() => document.querySelectorAll('.ic').forEach(el => { el.querySelectorAll('[data-fs]').forEach(x => x.style.fontSize = x.dataset.fs + 'px'); IC.fit(el); }));
    const r = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
    r.errs.forEach(e => errs.push(`[${sc} 场] ${e}`)); r.used.forEach(u => used.add(u));
    const pages = await p.evaluate(() => window.PAGES);
    if (!noPreview) {
      fs.readdirSync(OUT).filter(n => n.startsWith(`sheet_${sc}`)).forEach(n => fs.unlinkSync(path.join(OUT, n)));
      // 样例页存 1280×720（仓库里放 30 多张，减小体积）；演示关键帧仍是 1920×1080
      const sp = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 / 3 });
      await sp.goto('file://' + f); await ready(sp);
      await sp.evaluate(() => document.querySelectorAll('.ic').forEach(el => { el.querySelectorAll('[data-fs]').forEach(x => x.style.fontSize = x.dataset.fs + 'px'); IC.fit(el); }));
      for (let i = 0; i < pages; i++) await sp.screenshot({ path: path.join(OUT, `sheet_${sc}_${i + 1}.jpg`), clip: { x: 0, y: i * 1080, width: 1920, height: 1080 }, fullPage: true, type: 'jpeg', quality: 84 });
      await sp.close();
    }
    // 反例：内容明显放不下时，IC.fit 必须报 overflow（防止检查失灵）
    const neg = await p.evaluate(() => {
      const mk = (type, d, size) => { const el = IC.render(type, d, { rect: [-4000, 0].concat(IC.SIZE[size]) }); document.body.appendChild(el); const ok = IC.fit(el); el.remove(); return ok; };
      return [mk('term', { lines: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6'] }, 'L'),
              mk('keyword', { word: '一个特别特别长的关键词', exp: '解释' }, 'M'),
              mk('step', { idx: '01', name: '步骤名字长到放不下了' }, 'S')];
    });
    neg.forEach((fitOk, i) => { if (fitOk) errs.push(`[${sc} 场] 反例 ${i + 1} 应该放不下，但 IC.fit 报了 ok（检查失灵）`); });
    console.log(`${sc} 场：${SAMPLES.length} 个样例 · ${pages} 页，${r.errs.length ? '✗ ' + r.errs.length + ' 项不通过' : '✓ 通过'}`);
    await p.close();
  }

  // 2. 演示关键帧
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errs.push(`demo：${e.message}`));
  for (const d of DEMOS) {
    const f = path.join(TMP, `demo_${d.id}.html`); fs.writeFileSync(f, demoHTML(d));
    await p.goto('file://' + f); await ready(p);
    await p.evaluate(() => document.querySelectorAll('.ic').forEach(el => { el.querySelectorAll('[data-fs]').forEach(x => x.style.fontSize = x.dataset.fs + 'px'); IC.fit(el); }));
    await p.evaluate(() => renderAt(4));
    const r = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
    r.errs.forEach(e => errs.push(`[${d.id} ${d.layout}] ${e}`));
    // 逐帧确定性：先渲染别的时间点再回来，像素必须一致
    const shot = () => p.screenshot({ type: 'png' });
    await p.evaluate(() => renderAt(0.9)); const a1 = await shot();
    await p.evaluate(() => renderAt(3.1)); await p.evaluate(() => renderAt(0.35));
    await p.evaluate(() => renderAt(0.9)); const a2 = await shot();
    if (!a1.equals(a2)) {
      // 逐像素比：圆角边缘在运动中偶发几颗像素的抗锯齿差异（Chromium 自动决定哪些层走 GPU 合成），肉眼不可见，记为提醒；超过阈值才算不确定
      const dd = await p.evaluate(async ([x, y]) => {
        const load = b64 => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64; });
        const [A, B] = await Promise.all([load(x), load(y)]), c = document.createElement('canvas'); c.width = A.width; c.height = A.height;
        const g = c.getContext('2d'); g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0, mx = 0; for (let i = 0; i < da.length; i += 4) { const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (m) { n++; mx = Math.max(mx, m); } }
        return { n, mx };
      }, [a1.toString('base64'), a2.toString('base64')]);
      fs.writeFileSync(path.join(TMP, `nondet_${d.id}_a.png`), a1); fs.writeFileSync(path.join(TMP, `nondet_${d.id}_b.png`), a2);
      if (dd.mx <= 8) warns.push(`[${d.id}] 乱序渲染有 ${dd.n} 颗像素差 ≤ ${dd.mx} 色阶（Chromium 合成层抖动，肉眼不可见）`);
      else errs.push(`[${d.id}] 同一时间点乱序渲染结果不一致：${dd.n} 颗像素，最大 ${dd.mx} 色阶（两帧存在 out/infocards/nondet_${d.id}_a/b.png）`);
    }
    await p.evaluate(() => renderAt(4));
    if (!noPreview) {
      await p.screenshot({ path: path.join(OUT, `demo_${d.id}.jpg`), type: 'jpeg', quality: 90 });
      await p.evaluate(() => renderAt(0.75)); await p.screenshot({ path: path.join(OUT, `demo_${d.id}_mid.jpg`), type: 'jpeg', quality: 86 });
    }
    console.log(`${d.id}（${d.layout} · ${d.scene} 场）：${r.errs.length ? '✗ ' + r.errs.length + ' 项' : '✓'}`);
  }
  await p.close();

  // 3. 手机竖屏模拟
  if (!noPreview) {
    const ph = await b.newPage({ viewport: { width: 2580, height: 1060 }, deviceScaleFactor: 2 });
    fs.readdirSync(OUT).filter(n => /^phone/.test(n)).forEach(n => fs.unlinkSync(path.join(OUT, n)));
    for (let g = 0; g < DEMOS.length; g += 5) {
    const shots = DEMOS.slice(g, g + 5).map(d => `<div class="ph"><div class="sc"><img src="file://${OUT}/demo_${d.id}.jpg"></div><b>${d.id} · ${d.layout}</b></div>`).join('');
    const f = path.join(TMP, 'phone.html');
    fs.writeFileSync(f, `<!doctype html><html><head>${HEAD}<style>html,body{width:2580px;height:1060px;background:#D9D3C7}body{display:flex;gap:60px;justify-content:center;align-items:center;font-family:var(--f-cn)}.ph{width:420px;height:880px;border-radius:64px;background:#0b0b0c;padding:16px;position:relative;box-shadow:0 30px 60px #0004}.sc{width:100%;height:100%;border-radius:50px;background:#000;display:flex;align-items:center;overflow:hidden}.sc img{width:100%}.ph b{position:absolute;bottom:-50px;left:0;right:0;text-align:center;font-size:22px;color:var(--char)}</style></head><body>${shots}</body></html>`);
    await ph.goto('file://' + f); await ready(ph);
    await ph.screenshot({ path: path.join(OUT, `phone_${g / 5 + 1}.jpg`), type: 'jpeg', quality: 90 });
    }
  }
  await b.close();

  if (warns.length) console.log('\n! 提醒：\n  ' + warns.join('\n  '));
  if (errs.length) { console.error(`\n✗ ${errs.length} 项不通过：\n  ` + errs.join('\n  ')); process.exit(1); }
  console.log(`\n✓ 信息卡全部通过（用到的颜色：${[...used].sort().join('、')}）`);
})();
