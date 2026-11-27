// 信息卡库自检 + 预览：node tools/infocard_check.js            （在仓库根目录运行；先 npm i）
//  1. 把 cards/infocards/samples.json 的每个样例分别放进 A 炭黑场 / B 奶油白场，逐张检查：
//     放得下（IC.fit）· 有意义的文字 ≥ 52px（英文小标注除外，每张卡最多一处）· 实际渲染出来的字色 / 底色
//     不是三条禁用组合、对比 ≥ 4.5 · 只用色板里的颜色
//  2. 用 cards/layouts/ 的排版搭 4 张演示关键帧（信息卡填进槽位），同样检查，并验证逐帧确定性（乱序渲染像素一致）
//  3. 输出预览：docs/previews/infocards/sheet_A.jpg、sheet_B.jpg、demo_D1–D4.jpg、phone.jpg
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
<script src="../../engine/motion/tokens.js"></script><script src="../../engine/motion/motion.js"></script><script src="infocards.js"></script>`;

/* ---------- 在页面里跑的检查（颜色按实际渲染结果算） ---------- */
function pageCheck(palette, forbidden, textMin, decorMin, contrastMin) {
  const P = Object.fromEntries(Object.entries(palette).map(([k, h]) => [k, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]));
  const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const parseCol = s => { s = String(s).trim(); if (s[0] === '#') return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat(1); return rgba(s); };
  const blend = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3]));
  const lum = c => { const l = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * l[0] + .7152 * l[1] + .0722 * l[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const near = (c, k) => P[k].every((v, i) => Math.abs(v - c[i]) <= 3);
  const nameOf = c => Object.keys(P).find(k => near(c, k));
  const opac = (e, stop) => { let o = 1; for (let x = e; x && x !== stop.parentElement; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  function bgOf(e) {   // 实际底色：往上找第一个不透明的底；色块（.blk）用它的扫入色
    const stack = [];
    for (let x = e; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (x.classList && x.classList.contains('blk')) { stack.push(parseCol(cs.getPropertyValue('--s-blk'))); break; }
      const c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.999) break; }
      if (x.classList && (x.classList.contains('scene-A') || x.classList.contains('scene-B'))) {
        stack.push(parseCol(palette[x.classList.contains('scene-A') ? 'char' : 'cream'])); break;
      }
    }
    let b = stack.pop().slice(0, 3);
    while (stack.length) b = blend(stack.pop(), b);
    return b;
  }
  const errs = [], used = new Set();
  document.querySelectorAll('.ic').forEach(ic => {
    const who = ic.dataset.label || ic.dataset.ic;
    if (ic.dataset.fit !== 'ok') errs.push(`${who}：放不下（字号缩到下限仍溢出，内容太长或槽位太小）`);
    let decor = 0;
    const els = [ic, ...ic.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    els.forEach(e => {
      const cs = getComputedStyle(e), fsz = parseFloat(cs.fontSize), isDecor = !!e.closest('[data-role="decor"]');
      const txt = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').slice(0, 12);
      if (isDecor) { decor++; if (fsz < decorMin) errs.push(`${who}「${txt}」：装饰字 ${fsz}px < ${decorMin}`); }
      else if (fsz < textMin - 0.5) errs.push(`${who}「${txt}」：${fsz}px < ${textMin}px`);
      const fc = rgba(cs.color); if (!fc) return;
      const a = fc[3] * opac(e, ic), bg = bgOf(e), fg = blend([fc[0], fc[1], fc[2], a], bg);
      const fn = nameOf(fc), bn = nameOf(bg);
      if (fn) used.add(fn); if (bn) used.add(bn);
      if (!bn) errs.push(`${who}「${txt}」：底色 rgb(${bg.map(Math.round)}) 不在色板里`);
      if (!fn) errs.push(`${who}「${txt}」：字色 ${cs.color} 不在色板里`);
      for (const [f, b, why] of forbidden) if (fn === f && bn === b) errs.push(`${who}「${txt}」：禁用组合 —— ${why}`);
      const r = ratio(fg, bg); if (!isDecor && r < contrastMin) errs.push(`${who}「${txt}」：对比 ${r.toFixed(2)} < ${contrastMin}`);
    });
    if (decor > 1) errs.push(`${who}：英文小标注 ${decor} 处，每屏最多 1 处`);
  });
  return { errs, used: [...used] };
}

/* ---------- 预览板：一个场景一张 ---------- */
function sheetHTML(scene) {
  return `<!doctype html><html><head>${HEAD}<style>html,body{width:2400px;height:auto;overflow:visible}
  .cap{position:absolute;font:500 24px/1.2 var(--f-mono);letter-spacing:.06em;opacity:.6;white-space:nowrap}
  h1{position:absolute;left:64px;top:40px;font:400 72px var(--f-disp)}</style></head>
  <body class="scene-${scene}" style="position:relative"><h1>信息卡库 · 第一批 · ${scene === 'A' ? 'A 炭黑场' : 'B 奶油白场'}</h1>
  <script>
  const items = ${JSON.stringify(SAMPLES)};
  let x = 64, y = 230, rowH = 0; const W = 2400;
  items.forEach((it, i) => {
    const [w, h] = it.wh || IC.SIZE[it.size];
    if (x + w > W - 64) { x = 64; y += rowH + 120; rowH = 0; }
    const cap = document.createElement('div'); cap.className = 'cap'; cap.style.cssText = 'left:' + x + 'px;top:' + (y - 48) + 'px'; cap.textContent = it.label; document.body.appendChild(cap);
    const el = IC.render(it.type, it.data, { rect: [x, y, w, h], tone: it.tone }); el.dataset.label = it.label;
    document.body.appendChild(el); IC.fit(el);
    x += w + 64; rowH = Math.max(rowH, h);
  });
  document.body.style.height = (y + rowH + 80) + 'px';
  </script></body></html>`;
}

/* ---------- 演示关键帧：排版 + 信息卡 ---------- */
// fill：槽位 id → { ic, data, tone, cue } 信息卡 | { text, fs, cls } 纯文字 | { img } 图片
const SMP = '../images/samples/';
const DEMOS = [
  { id: 'D1', scene: 'A', layout: 'L-K08', sub: '五步，<em>按顺序</em>一步一步来', fill: {
    t1: { ic: 'title', data: { title: 'AI 挖洞，[[按顺序]]来', fs: 112 } },
    c1: { ic: 'step', data: { idx: '01', name: '确认授权', img: SMP + 'bmz_key.png' } },
    c2: { ic: 'step', data: { idx: '02', name: '信息收集', img: SMP + 'bmz_radar.png' } },
    c3: { ic: 'step', tone: 'hot', data: { idx: '03', name: 'AI 扫描', img: SMP + 'bmz_aichip.png' } },
    c4: { ic: 'step', data: { idx: '04', name: '人工复核', img: SMP + 'bmz_shield.png' } },
    c5: { ic: 'step', data: { idx: '05', name: '写报告', img: SMP + 'bmz_laptop.png' } },
    c6: { ic: 'step', data: { idx: '06', name: '等审核', img: SMP + 'bmz_coin.png' } },
    c7: { ic: 'stat', tone: 'lit', data: { value: '80', unit: '%', label: '体力活\n交给 AI', note: '示意数据' } } } },
  { id: 'D2', scene: 'B', layout: 'L-K22', sub: '同一个请求，<em>补上校验</em>就读不到了', fill: {
    t1: { ic: 'title', data: { title: '补一步校验，结果[[完全不同]]', fs: 104 } },
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
    c1: { ic: 'chat', data: { msgs: [{ who: 'me', text: '这个接口\n能越权吗？' }, { who: 'ai', text: '改 uid 能读到\n别人的手机号' }, { who: 'me', text: '先确认\n{{授权范围}}' }] } } } }
];
function demoHTML(d) {
  const L = LAYOUT(d.layout);
  return `<!doctype html><html><head>${HEAD}<style>.darkcell{background:var(--char);color:var(--cream)}.blkcell{background:var(--orange);color:var(--char);display:flex;align-items:center;justify-content:center}
  .lab{position:absolute;display:flex;align-items:center;font-family:var(--f-cn);font-weight:700}
  .lab.num{font-family:var(--f-num);font-weight:900;justify-content:center}</style></head>
  <body><section class="frame scene-${d.scene}" id="fr" data-label="${d.id}">
  <img class="bg-layer" src="../../libs/backgrounds/layers/${d.scene === 'A' ? 'BG1_radar_lines' : 'BG2_radar_lines'}.svg">
  <div class="sub" id="sub" style="z-index:50">${d.sub}</div></section>
  <script>
  const L = ${JSON.stringify(L)}, F = ${JSON.stringify(d.fill)}, fr = document.getElementById('fr'), cards = [];
  L.slots.forEach((s, i) => {
    const f = F[s.id]; if (!f || s.type === 'group') return;
    const [x, y, w, h] = s.rect; let el;
    if (f.ic) { el = IC.render(f.ic, f.data, { rect: s.rect, tone: f.tone }); el.dataset.label = '${d.id} ' + s.id; if (s.shape === 'circle') el.style.borderRadius = '50%'; }
    else if (f.img) { el = document.createElement('img'); el.className = 'stk'; el.src = f.img; el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px'; el.dataset.role = 'stk'; }
    else { el = document.createElement('div'); el.className = 'lab ' + (f.cls || ''); el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;font-size:' + f.fs + 'px'; el.textContent = f.text; }
    fr.insertBefore(el, document.getElementById('sub')); if (f.ic) IC.fit(el);
    cards.push({ el, f, i });
  });
  window.renderAt = function (t) {
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
  const b = await chromium.launch(), errs = [];
  const ARGS = [Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex])), BRAND.contrast.forbidden, BRAND.type.meaningful_min, BRAND.type.decor_min, BRAND.contrast.text_min];
  const ready = async p => { await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await p.waitForTimeout(200); };
  const used = new Set();

  // 1. 样例 × 两个场景
  for (const sc of ['A', 'B']) {
    const f = path.join(TMP, `sheet_${sc}.html`); fs.writeFileSync(f, sheetHTML(sc));
    const p = await b.newPage({ viewport: { width: 2400, height: 1200 } });
    p.on('pageerror', e => errs.push(`sheet ${sc}：${e.message}`));
    await p.goto('file://' + f); await ready(p);
    // 字体就绪后重新算一次字号（第一次 fit 时字体可能还没加载完）
    await p.evaluate(() => document.querySelectorAll('.ic').forEach(el => { el.querySelectorAll('[data-fs]').forEach(x => x.style.fontSize = x.dataset.fs + 'px'); IC.fit(el); }));
    const r = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
    r.errs.forEach(e => errs.push(`[${sc} 场] ${e}`)); r.used.forEach(u => used.add(u));
    if (!noPreview) await p.screenshot({ path: path.join(OUT, `sheet_${sc}.jpg`), fullPage: true, type: 'jpeg', quality: 86 });
    // 反例：内容明显放不下时，IC.fit 必须报 overflow（防止检查失灵）
    const neg = await p.evaluate(() => {
      const mk = (type, d, size) => { const el = IC.render(type, d, { rect: [-4000, 0].concat(IC.SIZE[size]) }); document.body.appendChild(el); const ok = IC.fit(el); el.remove(); return ok; };
      return [mk('term', { lines: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6'] }, 'L'),
              mk('keyword', { word: '一个特别特别长的关键词', exp: '解释' }, 'M'),
              mk('step', { idx: '01', name: '步骤名字长到放不下了' }, 'S')];
    });
    neg.forEach((fitOk, i) => { if (fitOk) errs.push(`[${sc} 场] 反例 ${i + 1} 应该放不下，但 IC.fit 报了 ok（检查失灵）`); });
    console.log(`${sc} 场：${SAMPLES.length} 个样例，${r.errs.length ? '✗ ' + r.errs.length + ' 项不通过' : '✓ 通过'}`);
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
    if (!a1.equals(a2)) errs.push(`[${d.id}] 同一时间点乱序渲染结果不一致（逐帧不确定）`);
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
    const ph = await b.newPage({ viewport: { width: 1980, height: 1060 }, deviceScaleFactor: 2 });
    const shots = DEMOS.map(d => `<div class="ph"><div class="sc"><img src="file://${OUT}/demo_${d.id}.jpg"></div><b>${d.id} · ${d.layout}</b></div>`).join('');
    const f = path.join(TMP, 'phone.html');
    fs.writeFileSync(f, `<!doctype html><html><head>${HEAD}<style>html,body{width:1980px;height:1060px;background:#D9D3C7}body{display:flex;gap:60px;justify-content:center;align-items:center;font-family:var(--f-cn)}.ph{width:420px;height:880px;border-radius:64px;background:#0b0b0c;padding:16px;position:relative;box-shadow:0 30px 60px #0004}.sc{width:100%;height:100%;border-radius:50px;background:#000;display:flex;align-items:center;overflow:hidden}.sc img{width:100%}.ph b{position:absolute;bottom:-50px;left:0;right:0;text-align:center;font-size:22px;color:var(--char)}</style></head><body>${shots}</body></html>`);
    await ph.goto('file://' + f); await ready(ph);
    await ph.screenshot({ path: path.join(OUT, 'phone.jpg'), type: 'jpeg', quality: 90 });
  }
  await b.close();

  if (errs.length) { console.error(`\n✗ ${errs.length} 项不通过：\n  ` + errs.join('\n  ')); process.exit(1); }
  console.log(`\n✓ 信息卡全部通过（用到的颜色：${[...used].sort().join('、')}）`);
})();
