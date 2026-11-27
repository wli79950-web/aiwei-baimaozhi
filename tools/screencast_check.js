// 录屏组件自检 + 预览：node tools/screencast_check.js [--video]
//  1. 纯数学：时间重映射、帧号、推镜（聚焦区域留边距放进视口、原片不露边）、光标插值、validate 能拦住的错误
//  2. 3 个演示镜头（背景板库 + 录屏窗口 + 推镜 / 标注 / 光标 / 打码 / 联动信息卡），在多个时间点检查：
//     标签字号 ≥ 52、字色 / 底色（tools/lib/pagecheck.js）、同一时刻最多一处强调、逐帧确定性（乱序渲染）
//  3. 预览：docs/previews/screencast/S1–S3（终态）+ _mid（过程中）+ phone.jpg；--video 另渲染 S1 的 6 秒样片（带运动模糊）
// 原片用 tools/make_demo_recording.js 生成的示意录屏（out/screencast/demo_rec/，不进 git；没有就先生成）。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/previews/screencast'), TMP = path.join(ROOT, 'out/screencast');
const REC = path.join(TMP, 'demo_rec');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/motion.json'), 'utf8'));
global.self = global; global.BM = require(path.join(ROOT, 'engine/motion/motion.js')).init(M);
const SC = require(path.join(ROOT, 'libs/screencast/screencast.js'));
const pageCheck = require('./lib/pagecheck.js');
const video = process.argv.includes('--video');
if (!fs.existsSync(path.join(REC, 'rects.json'))) execFileSync('node', [path.join(ROOT, 'tools/make_demo_recording.js')], { stdio: 'inherit' });
const R = JSON.parse(fs.readFileSync(path.join(REC, 'rects.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0; const errs = [], warns = [];
const ok = (c, m) => { if (c) passes++; else { fails++; errs.push(m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}：${a} ≠ ${b}`);

/* ---------- 演示镜头 ---------- */
const SRC = { type: 'frames', url: 'demo_rec/%05d.jpg', fps: R.fps, count: R.count, w: R.w, h: R.h };
const OWNER = [1140, 458, 300, 44], JSONBLK = [1110, 380, 780, 220], PHONE = [84, 404, 560, 72];
const SHOTS = [
  { id: 'S1', bg: 'BG1', sub: '改一个数字，返回的就是<em>别人的订单</em>', keys: [1.05, 3.9], mid: 2.6, spec: {
      rect: [64, 56, 1792, 968], src: SRC, enter: { at: 0 },
      push: [{ at: 2.2, rect: JSONBLK, dur: 0.8 }],
      ann: [{ type: 'mark', rect: OWNER, at: 3.05, label: '别人的订单', side: 'right', leader: true }],
      cursor: [{ at: 0.5, x: 700, y: 400 }, { at: 1.0, x: 560, y: 88, click: true }, { at: 1.9, x: 1500, y: 640 }],
      mask: [{ rect: [1124, 300, 600, 40], mode: 'blur' }] } },
  { id: 'S2', bg: 'BG1', sub: '问题出在这一步：<em>没核对归属</em>', keys: [3.9], mid: 3.2, ic: { rect: [1264, 232, 592, 400], type: 'keyword', tone: 'lit', data: { word: '归属校验', exp: '这一步[[没做]]' }, cue: { in: 3.3, emph: 3.9 } }, spec: {
      rect: [64, 56, 1632, 968], src: SRC, remap: [[0, 0], [2.6, 2.6], [6, 2.6]],
      ann: [{ type: 'underline', rect: PHONE, at: 2.7 }],
      mask: [{ rect: [1124, 300, 600, 40], mode: 'blur' }],
      links: [{ from: PHONE, to: '.ic', at: 2.95 }] } },
  { id: 'S3', bg: 'BG2', sub: '页面上直接显示了<em>别人的手机号</em>', keys: [3.6], mid: 2.75, ic: { rect: [1408, 56, 448, 816], type: 'list', tone: 'card', data: { title: '复现三步', items: [{ text: '登录 A', state: 'done' }, { text: '改订单号', state: 'done' }, { text: '看到 B', state: 'now' }] }, cue: { in: 0.4, emph: 2.6 } }, spec: {
      rect: [64, 56, 1312, 816], narrow: true, src: SRC, remap: [[0, 0], [2.0, 2.0], [4.0, 2.4]],
      ann: [{ type: 'spot', rect: PHONE, at: 2.4, label: '别人的手机号', side: 'below' }],
      mask: [{ rect: [264, 476, 420, 72], mode: 'block' }] } }
];

/* ---------- 1. 纯数学 ---------- */
console.log('1. 时间重映射 / 推镜 / 光标 / 检查规则');
const S0 = { src: SRC, rect: [64, 56, 1792, 968] };
near(SC.srcTime(S0, 1.5), 1.5, 1e-9, '默认重映射 = 合成时间');
near(SC.srcTime({ ...S0, remap: [[0, 0], [2, 2], [4, 2]] }, 3.3), 2, 1e-9, '重映射定格');
near(SC.srcTime({ ...S0, remap: [[0, 0], [2, 1]] }, 1), 0.5, 1e-9, '重映射慢放');
near(SC.frameIndex(S0, 0), 0, 0, '第 0 秒是第 1 帧'); near(SC.frameIndex(S0, 99), R.count - 1, 0, '超出时长停在最后一帧');
const VW = 1792 - 24, VH = 968 - 64;
const full = SC.camFull(VW, VH, R.w, R.h);
ok(full.tx <= 0 && full.ty <= 0 && R.w * full.s >= VW - 1e-6 && R.h * full.s >= VH - 1e-6, '全景铺满视口（不露边）');
for (const r of [JSONBLK, OWNER, PHONE, [0, 0, 300, 200], [1700, 900, 220, 180]]) {
  const c = SC.camFocus(VW, VH, R.w, R.h, r), x0 = c.tx + r[0] * c.s, y0 = c.ty + r[1] * c.s, x1 = x0 + r[2] * c.s, y1 = y0 + r[3] * c.s;
  ok(x0 >= -1e-6 && y0 >= -1e-6 && x1 <= VW + 1e-6 && y1 <= VH + 1e-6, `推镜到 ${r}：区域完整在视口里`);
  ok(c.tx <= 1e-6 && c.ty <= 1e-6 && c.tx + R.w * c.s >= VW - 1e-6 && c.ty + R.h * c.s >= VH - 1e-6, `推镜到 ${r}：原片不露边`);
  ok(c.s >= full.s - 1e-9, `推镜到 ${r}：不会比全景更小`);
}
const sp = { ...S0, push: [{ at: 1, rect: JSONBLK, dur: 0.8 }] }, ce = SC.camAt(sp, 5, VW, VH), cf = SC.camFocus(VW, VH, R.w, R.h, JSONBLK);
near(ce.s, cf.s, 1e-9, '推镜结束 = 聚焦状态'); near(SC.camAt(sp, 0.5, VW, VH).s, full.s, 1e-9, '推镜前 = 全景');
const cu = { cursor: [{ at: 1, x: 10, y: 20 }, { at: 2, x: 110, y: 220, move: 0.5 }] };
ok(SC.cursorAt(cu, 0.2) === null, '光标出现前隐藏'); near(SC.cursorAt(cu, 1.4).x, 10, 1e-9, '光标等待'); near(SC.cursorAt(cu, 3).y, 220, 1e-9, '光标到达');
ok(SC.validate({ ...S0, rect: [0, 0, 1200, 700] }).some(e => /录屏窗口宽/.test(e)), 'validate：窗口太窄');
ok(SC.validate({ ...S0, ann: [{ rect: OWNER, at: 1 }, { rect: PHONE, at: 1.5 }] }).some(e => /两处强调/.test(e)), 'validate：同时两处强调');
ok(SC.validate({ ...S0, ann: [{ rect: OWNER, at: 1, out: 1.4 }, { rect: PHONE, at: 1.5 }] }).length === 0, 'validate：前一处写了 out 就通过');
ok(SC.validate({ ...S0, mask: [{ rect: [1800, 1000, 300, 200] }] }).some(e => /超出原片/.test(e)), 'validate：区域超出原片');
SHOTS.forEach(s => ok(SC.validate(s.spec).length === 0, `${s.id} 的 spec：${SC.validate(s.spec).join('；')}`));

/* ---------- 2. 浏览器里渲染 ---------- */
const HEAD = `<meta charset="utf-8"><base href="file://${TMP}/">
<link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<link rel="stylesheet" href="file://${ROOT}/engine/motion/motion.css"><link rel="stylesheet" href="file://${ROOT}/cards/infocards/infocards.css">
<link rel="stylesheet" href="file://${ROOT}/libs/screencast/screencast.css">
<script src="file://${ROOT}/engine/motion/tokens.js"></script><script src="file://${ROOT}/engine/motion/motion.js"></script>
<script src="file://${ROOT}/cards/infocards/infocards.js"></script><script src="file://${ROOT}/libs/backgrounds/backgrounds.js"></script>
<script src="file://${ROOT}/libs/screencast/screencast.js"></script>`;
const pageHTML = s => `<!doctype html><html><head>${HEAD}</head><body><section class="frame" id="fr"><div class="sub" id="sub" style="z-index:50">${s.sub}</div></section>
<script>
const fr = document.getElementById('fr'), bg = BGLIB.mount(fr, '${s.bg}', 'file://${ROOT}/libs/backgrounds/');
const IC1 = ${JSON.stringify(s.ic || null)};
let card = null;
if (IC1) { card = IC.render(IC1.type, IC1.data, { rect: IC1.rect, tone: IC1.tone }); fr.insertBefore(card, document.getElementById('sub')); }
const h = SC.shot(fr, ${JSON.stringify(s.spec)}, { base: '' });
fr.appendChild(document.getElementById('sub'));
if (card) { fr.insertBefore(card, document.getElementById('sub')); IC.fit(card); }
window.renderAt = async t => { BGLIB.animate(bg, t); if (card) IC.animate(card, t, IC1.cue); await SC.render(h, t); };
</script></body></html>`;

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errs.push('页面报错：' + e.message));
  const ARGS = [Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex])), BRAND.contrast.forbidden, BRAND.type.meaningful_min, BRAND.type.decor_min, BRAND.contrast.text_min];
  const diff = async (a1, a2) => p.evaluate(async ([x, y]) => {
    const load = b64 => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64; });
    const [A, B] = await Promise.all([load(x), load(y)]), c = document.createElement('canvas'); c.width = A.width; c.height = A.height;
    const g = c.getContext('2d'); g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data; g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, mx = 0; for (let i = 0; i < da.length; i += 4) { const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (m) { n++; mx = Math.max(mx, m); } }
    return { n, mx };
  }, [a1.toString('base64'), a2.toString('base64')]);
  console.log('2. 演示镜头');
  for (const s of SHOTS) {
    const f = path.join(TMP, `shot_${s.id}.html`); fs.writeFileSync(f, pageHTML(s));
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    let n0 = errs.length;
    for (const t of [...s.keys, s.mid]) {
      await p.evaluate(t => renderAt(t), t);
      const r = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
      r.errs.forEach(e => errs.push(`[${s.id} t=${t}] ${e}`));
      // 同一时刻最多一处强调：看得见的标注框 / 下划线 / 聚光
      const vis = await p.evaluate(t => [...document.querySelectorAll('.sc-ann path')].filter(e => e.getAttribute('d') && +getComputedStyle(e).opacity > 0.05 && getComputedStyle(e).strokeDashoffset !== getComputedStyle(e).strokeDasharray.split(' ')[0] + 'px').length, t);
      ok(vis <= 2, `[${s.id} t=${t}] 同时有 ${vis} 处标注在画`);
    }
    // 打码必须真的看不清：在每个关键时间点（含推镜放大后），打码区域的边缘能量要远低于同画面里清晰的文字区域
    if ((s.spec.mask || []).length) for (const t of s.keys) {
      await p.evaluate(t => renderAt(t), t);
      // 量之前先藏起压在上面的信息卡、引线、字幕（只量录屏本身）
      await p.evaluate(() => document.querySelectorAll('.ic, .sc-links, .sub, .sc-labels, .sc-ann').forEach(e => e.style.visibility = 'hidden'));
      const png = (await p.screenshot({ type: 'png' })).toString('base64');
      await p.evaluate(t => { document.querySelectorAll('.ic, .sc-links, .sub, .sc-labels, .sc-ann').forEach(e => e.style.visibility = ''); return renderAt(t); }, t);
      const res = await p.evaluate(async b64 => {
        const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const energy = r => { const x0 = Math.max(1, Math.round(r.left)), y0 = Math.max(1, Math.round(r.top)), x1 = Math.min(1918, Math.round(r.right)), y1 = Math.min(1078, Math.round(r.bottom));
          if (x1 - x0 < 8 || y1 - y0 < 8) return null; const d = g.getImageData(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2).data, W = x1 - x0 + 2; let e = 0, n = 0;
          const L = i => .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
          for (let y = 1; y < y1 - y0 + 1; y++) for (let x = 1; x < x1 - x0 + 1; x++) { const i = (y * W + x) * 4; e += Math.abs(4 * L(i) - L(i - 4) - L(i + 4) - L(i - W * 4) - L(i + W * 4)); n++; }
          return e / n; };
        const view = document.querySelector('.sc-view').getBoundingClientRect();
        const clipV = r => ({ left: Math.max(r.left, view.left), top: Math.max(r.top, view.top), right: Math.min(r.right, view.right), bottom: Math.min(r.bottom, view.bottom) });
        // 参照：录屏里同样大小的一块清晰文字（打码框往下挪两行，落在 JSON / 表格文字上）
        return [...document.querySelectorAll('.sc-mask.blur')].map(m => { const r = m.getBoundingClientRect(), h = r.bottom - r.top;
          return { mask: energy(clipV(r)), ref: energy(clipV({ left: r.left, right: r.right, top: r.top + 3 * h, bottom: r.bottom + 3 * h })) }; });
      }, png);
      res.forEach((e, i) => { if (e.mask != null && e.ref != null) ok(e.mask < e.ref * 0.25, `[${s.id} t=${t}] 打码 ${i + 1} 还看得清：边缘能量 ${e.mask.toFixed(1)}，清晰文字 ${e.ref.toFixed(1)}（要求 < 25%）`);
        console.log(`    ${s.id} t=${t} 打码 ${i + 1}：边缘能量 ${e.mask == null ? '—' : e.mask.toFixed(1)} / 清晰文字 ${e.ref == null ? '—' : e.ref.toFixed(1)}`); });
    }
    // 逐帧确定性
    const shot = async t => { await p.evaluate(t => renderAt(t), t); return p.screenshot({ type: 'png' }); };
    const a1 = await shot(s.keys[0]); await shot(4.7); await shot(0.3); await shot(s.mid); const a2 = await shot(s.keys[0]);
    if (!a1.equals(a2)) { const d = await diff(a1, a2); if (d.mx <= 8) warns.push(`[${s.id}] 乱序渲染 ${d.n} 颗像素边缘抖动（最大 ${d.mx} 色阶）`); else errs.push(`[${s.id}] 乱序渲染不一致：${d.n} 颗像素，最大 ${d.mx} 色阶`); }
    // 预览
    for (const [i, t] of s.keys.entries()) { await p.evaluate(t => renderAt(t), t); await p.screenshot({ path: path.join(OUT, `${s.id}${s.keys.length > 1 ? '_' + (i + 1) : ''}.jpg`), type: 'jpeg', quality: 90 }); }
    await p.evaluate(t => renderAt(t), s.mid); await p.screenshot({ path: path.join(OUT, `${s.id}_mid.jpg`), type: 'jpeg', quality: 86 });
    console.log(`  ${s.id}：${errs.length > n0 ? '✗' : '✓'}`);
  }
  // 手机竖屏模拟
  const imgs = fs.readdirSync(OUT).filter(n => /^S\d(_1)?\.jpg$/.test(n)).sort();
  const ph = await b.newPage({ viewport: { width: 1600, height: 1060 }, deviceScaleFactor: 2 });
  await ph.setContent(`<html><body style="margin:0;width:1600px;height:1060px;background:#D9D3C7;display:flex;gap:60px;justify-content:center;align-items:center;font-family:sans-serif">${imgs.map(n => `<div style="width:420px;height:880px;border-radius:64px;background:#0b0b0c;padding:16px;position:relative"><div style="width:100%;height:100%;border-radius:50px;background:#000;display:flex;align-items:center;overflow:hidden"><img src="file://${OUT}/${n}" style="width:100%"></div><b style="position:absolute;bottom:-50px;left:0;right:0;text-align:center;font-size:22px;color:#16130F">${n.replace('.jpg', '')}</b></div>`).join('')}</body></html>`);
  await ph.waitForTimeout(400); await ph.screenshot({ path: path.join(OUT, 'phone.jpg'), type: 'jpeg', quality: 90 });
  await b.close();

  // 3. 样片（可选）：S1 六秒，运动模糊 5 个子帧，3 个进程
  if (video) {
    const f = path.join(TMP, 'shot_S1.html'), fr = path.join(TMP, 'frames_S1');
    fs.rmSync(fr, { recursive: true, force: true });
    await Promise.all([0, 1, 2].map(w => new Promise((res, rej) => { const cp = require('child_process').spawn('node', [path.join(ROOT, 'engine/render_mb.js'), f, '0', '6', fr, '5', String(w), '3'], { stdio: 'inherit' }); cp.on('exit', c => c ? rej(new Error('render ' + c)) : res()); })));
    execFileSync('bash', [path.join(ROOT, 'engine/mb_encode.sh'), fr, '5', path.join(OUT, 'screencast_demo.mp4')], { stdio: 'inherit' });
    console.log('docs/previews/screencast/screencast_demo.mp4');
  }
  if (warns.length) console.log('\n! 提醒：\n  ' + warns.join('\n  '));
  if (errs.length) { console.error(`\n✗ ${errs.length} 项不通过：\n  ` + errs.join('\n  ')); process.exit(1); }
  console.log(`\n✓ 录屏组件全部通过（纯数学 ${passes} 项 + 3 个演示镜头）`);
})();
