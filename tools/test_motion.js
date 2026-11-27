// 动效库自动测试：node tools/test_motion.js        （在仓库根目录运行；AE 语法检查需要先 cd ae && npm i）
//  1. 缓动曲线：起止点、单调、回弹上限
//  2. 预设：起止状态、纯函数（同一个 t 结果一致）、闪切帧数
//  3. 网页 ↔ AE 一致：在模拟的 AE 环境里运行 ae/motion_ae.jsx，把关键帧还原成曲线，逐点对比网页的值
//  4. AE 脚本只用 ES3 语法
//  5. 演示页逐帧确定性（docs/previews/src/motion_demo.html 存在时）：同一时间点、不同渲染顺序，像素完全一致
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/motion.json'), 'utf8'));
const BM = require(path.join(ROOT, 'engine/motion/motion.js')).init(M);
let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg}：${a} ≠ ${b}（容差 ${tol}）`); }

/* ---------- 1. 缓动 ---------- */
console.log('1. 缓动曲线');
for (const [k, e] of Object.entries(M.ease)) {
  const f = BM.ease(k), [x1, , x2] = e.bezier;
  near(f(0), 0, 1e-9, `${k} 起点`); near(f(1), 1, 1e-9, `${k} 终点`);
  if (k !== 'linear') ok(x1 > 0 && x1 <= 1 && x2 >= 0 && x2 < 1, `${k} 控制点必须满足 0<x1≤1、0≤x2<1（AE 才能精确还原）`);
  let mx = 0, mono = true, prev = -1;
  for (let i = 0; i <= 2000; i++) { const y = f(i / 2000); mx = Math.max(mx, y); if (y < prev - 1e-9) mono = false; prev = y; }
  if (k === 'settle') ok(mx > 1 && mx <= 1.03, `settle 过冲应在 0–3% 之间，实际 ${((mx - 1) * 100).toFixed(2)}%`);
  else ok(mono && mx <= 1 + 1e-9, `${k} 应单调且不过冲`);
}

/* ---------- 2. 预设 ---------- */
console.log('2. 预设');
const D = n => BM.dur(M.preset[n].dur);
const at = 1.0;
ok(BM.rise(at - 0.1, at).o === 0 && BM.rise(at + D('rise') + 0.01, at).o === 1, 'rise 起止不透明度');
near(BM.rise(at, at).y, M.preset.rise.dy, 1e-9, 'rise 起始位移'); near(BM.rise(at + 5, at).y, 0, 1e-9, 'rise 结束位移');
near(BM.maskUp(at, at, 0).yp, 120, 1e-9, 'maskUp 起点藏在遮罩下'); near(BM.maskUp(at + 5, at, 2).yp, 0, 1e-9, 'maskUp 结束');
near(BM.drop(at + 5, at).y, 0, 1e-9, 'drop 结束位移'); near(BM.drop(at + 5, at).s, 1, 1e-9, 'drop 结束缩放');
near(BM.sink(at + 5, at).o, 0, 1e-9, 'sink 结束透明'); near(BM.underline(at + 5, at).clipR, 0, 1e-9, 'underline 画完');
near(BM.blockSweep(at + 5, at).size, 1, 1e-9, 'blockSweep 扫满'); near(BM.countUp(at + 5, at, 0, 80), 80, 1e-9, 'countUp 到目标');
near(BM.radarSweep(at + 5, at).cone, 360, 1e-9, 'radarSweep 扫满'); near(BM.fieldWipe(at + 5, at).clipR, 0, 1e-9, 'fieldWipe 擦满');
near(BM.stickerPush(at + 5, at).s, M.preset.stickerPush.scale_to, 1e-9, 'stickerPush 结束缩放');
near(BM.sweepSpin(at + 10, at).r, 360, 1e-9, 'sweepSpin 10 秒一圈');
let fl = 0; for (let f = 0; f < 120; f++) if (BM.flash(f / 60, 1.0)) fl++;
ok(fl === M.preset.flash.frames, `flash 应显示 ${M.preset.flash.frames} 帧，实际 ${fl}`);
let threw = false; try { BM.flash(1, 1, { frames: 7 }); } catch (e) { threw = true; } ok(threw, 'flash 超过 6 帧应报错');
const ts = [0.37, 1.234, 2.5, 4.99];
for (const name of ['rise', 'drop', 'unfold', 'sink', 'stickerPush', 'blockSweep', 'radarSweep'])
  for (const t of ts) ok(JSON.stringify(BM[name](t, 1.0)) === JSON.stringify(BM[name](t, 1.0)), `${name} 不是纯函数（t=${t}）`);

/* ---------- 3. 网页 ↔ AE 一致 ---------- */
console.log('3. 网页 ↔ AE 曲线一致');
const KIT = { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 };
class Prop {
  constructor(name, value) { this.name = name; this.value = value; this.keys = []; this.expression = ''; this.dimensionsSeparated = false; this.kids = []; }
  property(n) { return typeof n === 'number' ? this.kids[n - 1] : this.kids.find(k => k.matchName === n || k.name === n) || null; }
  get numProperties() { return this.kids.length; }
  add(mn, value) { const p = new Prop(mn, value); p.matchName = mn; this.kids.push(p); return p; }
  addProperty(mn) {
    const p = this.add(mn);
    if (mn === 'ADBE Linear Wipe') { p.add('ADBE Linear Wipe-0001', 0); p.add('ADBE Linear Wipe-0002', 0); p.add('ADBE Linear Wipe-0003', 0); }
    if (mn === 'ADBE Radial Wipe') { for (let i = 1; i <= 5; i++) p.add('ADBE Radial Wipe-000' + i, 0); }
    if (mn === 'ADBE Slider Control') p.add('ADBE Slider Control-0001', 0);
    if (mn === 'ADBE Vector Filter - Trim') { p.add('ADBE Vector Trim Start', 0); p.add('ADBE Vector Trim End', 100); }
    return p;
  }
  setValue(v) { this.value = v; }
  setValueAtTime(t, v) {
    const i = this.keys.findIndex(k => Math.abs(k.t - t) < 1e-9);
    const k = { t, v, inE: null, outE: null, inI: KIT.LINEAR, outI: KIT.LINEAR };
    if (i >= 0) this.keys[i].v = v; else { this.keys.push(k); this.keys.sort((a, b) => a.t - b.t); }
  }
  nearestKeyIndex(t) { let b = 0; this.keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(this.keys[b].t - t)) b = i; }); return b + 1; }
  keyInTemporalEase(k) { return this.keys[k - 1].inE; } keyOutTemporalEase(k) { return this.keys[k - 1].outE; }
  keyInInterpolationType(k) { return this.keys[k - 1].inI; } keyOutInterpolationType(k) { return this.keys[k - 1].outI; }
  setTemporalEaseAtKey(k, i, o) { this.keys[k - 1].inE = i; this.keys[k - 1].outE = o; }
  setInterpolationTypeAtKey(k, i, o) { this.keys[k - 1].inI = i; this.keys[k - 1].outI = o; }
  // 按 AE 的一维时间贝塞尔模型求值：手柄 = (影响 × Δt, 速度 × 影响 × Δt)
  valueAtTime(t) {
    const K = this.keys; if (!K.length) return this.value;
    if (t <= K[0].t) return K[0].v; if (t >= K[K.length - 1].t) return K[K.length - 1].v;
    let i = 0; while (K[i + 1].t < t) i++;
    const a = K[i], b = K[i + 1], dt = b.t - a.t, arr = Array.isArray(a.v), n = arr ? a.v.length : 1, out = [];
    for (let d = 0; d < n; d++) {
      const v0 = arr ? a.v[d] : a.v, v1 = arr ? b.v[d] : b.v;
      if (a.outI === KIT.HOLD) { out.push(v0); continue; }
      if (a.outI === KIT.LINEAR && b.inI === KIT.LINEAR) { out.push(v0 + (v1 - v0) * (t - a.t) / dt); continue; }
      const eo = a.outE[d] || a.outE[0], ei = b.inE[d] || b.inE[0];
      const P1 = [a.t + eo.influence / 100 * dt, v0 + eo.speed * eo.influence / 100 * dt];
      const P2 = [b.t - ei.influence / 100 * dt, v1 - ei.speed * ei.influence / 100 * dt];
      let lo = 0, hi = 1, s = 0.5;                       // 按时间求曲线参数 s，再求值
      for (let it = 0; it < 80; it++) {
        s = (lo + hi) / 2; const x = (1 - s) ** 3 * a.t + 3 * (1 - s) ** 2 * s * P1[0] + 3 * (1 - s) * s * s * P2[0] + s ** 3 * b.t;
        if (x < t) lo = s; else hi = s;
      }
      out.push((1 - s) ** 3 * v0 + 3 * (1 - s) ** 2 * s * P1[1] + 3 * (1 - s) * s * s * P2[1] + s ** 3 * v1);
    }
    return arr ? out : out[0];
  }
}
function mkLayer(opts = {}) {
  const L = new Prop('layer'); L.inPoint = 0; L.outPoint = 10; L.trackMatteType = null; L.matte = null;
  const T = L.add('ADBE Transform Group');
  const pos = T.add('ADBE Position', [960, 500, 0]); T.add('ADBE Position_0', 960); T.add('ADBE Position_1', 500);
  T.add('ADBE Scale', [100, 100, 100]); T.add('ADBE Opacity', 100); T.add('ADBE Rotate Z', 0); T.add('ADBE Anchor Point', [0, 0, 0]);
  L.add('ADBE Effect Parade'); L.add('ADBE Root Vectors Group'); L.add('ADBE Text Properties').add('ADBE Text Document', '');
  L.sourceRectAtTime = () => ({ left: 0, top: 0, width: 600, height: opts.h || 100 });
  L.setTrackMatte = (m, type) => { L.matte = m; L.trackMatteType = type; };
  L.moveBefore = () => {};
  return L;
}
const ctx = { KeyframeEase: function (speed, influence) { this.speed = speed; this.influence = influence; },
  KeyframeInterpolationType: KIT, TrackMatteType: { ALPHA: 5012 }, Error, Math };
vm.createContext(ctx);
const strip = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^#include.*$/m, '');
vm.runInContext(strip('ae/motion_data.jsx') + '\n' + strip('ae/motion_ae.jsx') + '\nthis.BMAE = BMAE;', ctx);
const AE = ctx.BMAE;
const TT = []; for (let t = 0.9; t <= 3.0; t += 1 / 240) TT.push(t);
function cmp(label, aeFn, webFn, tol) { let mx = 0; for (const t of TT) mx = Math.max(mx, Math.abs(aeFn(t) - webFn(t))); ok(mx <= tol, `${label} 网页与 AE 最大偏差 ${mx.toExponential(2)}（容差 ${tol}）`); return mx; }
const tp = (L, mn) => L.property('ADBE Transform Group').property(mn);
let worst = 0;
for (const k of Object.keys(M.ease)) {           // 每条缓动：一维关键帧
  const p = new Prop('x', 0); AE.key(p, 1, 0, 1.6, 100, k);
  worst = Math.max(worst, cmp(`缓动 ${k}`, t => p.valueAtTime(t), t => BM.tween(t, 1, 0.6, 0, 100, k), 1e-4));
}
{ const L = mkLayer(); AE.rise(L, at);
  cmp('rise 不透明度', t => tp(L, 'ADBE Opacity').valueAtTime(t), t => BM.rise(t, at).o * 100, 1e-4);
  cmp('rise 位置 Y', t => tp(L, 'ADBE Position_1').valueAtTime(t), t => 500 + BM.rise(t, at).y, 1e-4); }
{ const L = mkLayer(); AE.drop(L, at);
  cmp('drop 位置 Y', t => tp(L, 'ADBE Position_1').valueAtTime(t), t => 500 + BM.drop(t, at).y, 1e-4);
  cmp('drop 缩放', t => tp(L, 'ADBE Scale').valueAtTime(t)[0], t => BM.drop(t, at).s * 100, 1e-4);
  cmp('drop 不透明度', t => tp(L, 'ADBE Opacity').valueAtTime(t), t => BM.drop(t, at).o * 100, 1e-4); }
{ const L = mkLayer(); AE.unfold(L, at);
  cmp('unfold 缩放 Y', t => tp(L, 'ADBE Scale').valueAtTime(t)[1], t => BM.unfold(t, at).sy * 100, 1e-4); }
{ const L = mkLayer(); AE.sink(L, at);
  cmp('sink 不透明度', t => tp(L, 'ADBE Opacity').valueAtTime(t), t => BM.sink(t, at).o * 100, 1e-4);
  cmp('sink 位置 Y', t => tp(L, 'ADBE Position_1').valueAtTime(t), t => 500 + BM.sink(t, at).y, 1e-4); }
{ const L = mkLayer({ h: 100 }), m = mkLayer(); AE.maskUp(L, m, at, 1);
  ok(L.trackMatteType === ctx.TrackMatteType.ALPHA && L.matte === m, 'maskUp 设置 Alpha 遮罩');
  cmp('maskUp 位置 Y（行高 100）', t => tp(L, 'ADBE Position_1').valueAtTime(t), t => 500 + BM.maskUp(t, at, 1).yp, 1e-4); }
{ const L = mkLayer(); AE.underline(L, at);
  cmp('underline 缩放 X', t => tp(L, 'ADBE Scale').valueAtTime(t)[0], t => (1 - BM.underline(t, at).clipR) * 100, 1e-4); }
{ const L = mkLayer(); AE.blockSweep(L, at);
  cmp('blockSweep 缩放 X', t => tp(L, 'ADBE Scale').valueAtTime(t)[0], t => BM.blockSweep(t, at).size * 100, 1e-4); }
{ const L = mkLayer(); AE.ringDraw(L, at, 2);
  const end = () => L.property('ADBE Root Vectors Group').property('ADBE Vector Filter - Trim').property('ADBE Vector Trim End');
  cmp('ringDraw 修剪终点', t => end().valueAtTime(t), t => BM.ringDraw(t, at, 2).dash * 100, 1e-4); }
{ const L = mkLayer(); AE.countUp(L, at, 0, 80, null, '%');
  const sl = L.property('ADBE Effect Parade').property('BM 计数').property('ADBE Slider Control-0001');
  cmp('countUp 滑块', t => sl.valueAtTime(t), t => BM.countUp(t, at, 0, 80), 1e-4);
  ok(/Math\.round/.test(L.property('ADBE Text Properties').property('ADBE Text Document').expression), 'countUp 源文本表达式'); }
{ const L = mkLayer(); AE.fieldWipe(L, at);
  const c = L.property('ADBE Effect Parade').property(1).property(1);
  cmp('fieldWipe 过渡完成度', t => c.valueAtTime(t), t => BM.fieldWipe(t, at).clipR * 100, 1e-4); }
{ const L = mkLayer(); AE.radarSweep(L, at);
  const w = L.property('ADBE Effect Parade').property(1);
  cmp('radarSweep 过渡完成度', t => w.property(1).valueAtTime(t), t => (1 - BM.radarSweep(t, at).cone / 360) * 100, 1e-4);
  ok(JSON.stringify(w.property(3).value) === JSON.stringify([M.preset.radarSweep.cx, M.preset.radarSweep.cy]), 'radarSweep 擦除中心 = 雷达中心'); }
{ const L = mkLayer(); AE.stickerPush(L, at);
  cmp('stickerPush 缩放', t => tp(L, 'ADBE Scale').valueAtTime(t)[0], t => BM.stickerPush(t, at).s * 100, 1e-3);
  cmp('stickerPush 不透明度', t => tp(L, 'ADBE Opacity').valueAtTime(t), t => BM.stickerPush(t, at).o * 100, 1e-4); }
{ const L = mkLayer(); AE.sweepSpin(L, at, 3.0);
  cmp('sweepSpin 旋转', t => tp(L, 'ADBE Rotate Z').valueAtTime(t), t => BM.sweepSpin(Math.min(t, 3.0), at).r, 1e-6); }
{ const L = mkLayer(); AE.slowPush(L, at, 3.0);
  cmp('slowPush 缩放', t => tp(L, 'ADBE Scale').valueAtTime(t)[0], t => BM.slowPush(Math.min(t, 3.0), at).s * 100, 1e-6); }
{ const L = mkLayer(); AE.flash(L, at);
  ok(Math.abs(L.inPoint - at) < 1e-9 && Math.abs(L.outPoint - (at + M.preset.flash.frames / M.fps)) < 1e-9, 'flash 入点 / 出点 = 帧数'); }
console.log(`   一维缓动最大偏差 ${worst.toExponential(2)}`);

/* ---------- 4. ES3 语法 ---------- */
console.log('4. AE 脚本 ES3 语法');
let acorn = null; try { acorn = require(path.join(ROOT, 'ae/node_modules/acorn')); } catch (e) { console.log('  （跳过：先 cd ae && npm i 安装 acorn）'); }
if (acorn) for (const f of ['ae/motion_data.jsx', 'ae/motion_ae.jsx']) {
  try { acorn.parse(strip(f), { ecmaVersion: 3 }); ok(true); } catch (e) { ok(false, `${f} 不是 ES3：${e.message}`); }
}

/* ---------- 5. 演示页逐帧确定性 ---------- */
(async () => {
  const demo = path.join(ROOT, 'docs/previews/src/motion_demo.html');
  if (fs.existsSync(demo)) {
    console.log('5. 演示页逐帧确定性');
    const { chromium } = require('playwright');
    const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + demo); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));   // 隐藏的图片也先解码，避免首次出现那一帧还没画出来
    await p.waitForTimeout(800);
    const shot = async t => { await p.evaluate(t => window.renderAt(t), t); return (await p.screenshot()).toString('base64'); };
    for (const t of [0.517, 2.3456, 3.62, 4.8]) {
      const a = await shot(t); await shot(4.95 - t); await shot(0.01); const c = await shot(t);
      ok(a === c, `演示页 t=${t} 两次渲染像素不一致（乱序渲染后）`);
    }
    ok(errs.length === 0, '演示页报错：' + errs.join('; '));
    await b.close();
  }
  console.log(`\n${fails ? '✗' : '✓'} 通过 ${passes} 项${fails ? `，失败 ${fails} 项` : ''}`);
  process.exit(fails ? 1 : 0);
})();
