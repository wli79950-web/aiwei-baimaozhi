// AE 导出（P6）：把一期的镜头（episode.json）按网页同一份镜头描述拆成 AE 图层描述 + 透明 PNG。
// 用法：node ae/export_shots.js <episode.json> <输出目录> <字体覆盖表.json>    （一般由 python3 ae/build_ae.py 调用）
// 输出：<输出目录>/export.json、<输出目录>/assets/*.png、<输出目录>/还原对比/*.jpg（用导出的图层在浏览器里拼回去，和原画面逐像素比）
//
// 每个镜头：背景板（库里的 PNG 原样）+ 背景动态层（库里的 SVG 栅格化成 PNG，SVG 原件一起附上）+ 焦点组件（刻度层每秒转 4°）
//          + 每个 unit 的 node（透明 PNG + AE 文字层）+ 入场时间表（SHOT.plan / IC.plan，和网页同一份）
// 录屏窗口另走 libs/screencast 的 SC.keyframes：窗口边框 PNG + 录屏预合成（原片 + 时间重映射 + 推镜 + 标注 / 打码形状层）。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const shotPage = require(path.join(ROOT, 'tools/lib/shotpage.js'));
const [EPF, OUT, COVERF] = process.argv.slice(2).map(p => path.resolve(p));
const EP = JSON.parse(fs.readFileSync(EPF, 'utf8')), EPDIR = path.dirname(EPF), COVER = JSON.parse(fs.readFileSync(COVERF, 'utf8'));
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));
const ASSETS = path.join(OUT, 'assets'), TMP = path.join(OUT, 'tmp'), RECON = path.join(OUT, '还原对比');
[ASSETS, path.join(ASSETS, 'svg'), TMP, RECON].forEach(d => fs.mkdirSync(d, { recursive: true }));
const BGNAME = { plate: '背景板', dots: '背景动态_点阵', marks: '背景动态_十字标', lines: '背景动态_雷达线', sweep: '背景动态_扫描扇区', 'focus-glow': '背景动态_焦点光晕', 'focus-rings': '背景动态_焦点刻度环', 'focus-ticks': '背景动态_焦点刻度' };
const FOCUS_RES = 1500;   // 焦点组件栅格化边长（scale 最大 1.5 × 画布 1000）

(async () => {
  const b = await chromium.launch(), errs = [], shots = [], bgDone = {};
  let start = 0;
  for (const [si, s0] of EP.shots.entries()) {
    const spec = Object.assign({}, s0), name = (EP.prefix || EP.id) + '_' + (spec.id || 'S' + String(si + 1).padStart(2, '0'));
    if (spec.sc && spec.sc.spec && spec.sc.base == null) spec.sc = Object.assign({}, spec.sc, { base: path.relative(ROOT, EPDIR) + '/' });
    const html = path.join(TMP, name + '.html');
    fs.writeFileSync(html, shotPage(ROOT, spec, LAYOUT(spec.layout), {}));
    // 1) 原画面（还原对比的基准）
    const p0 = await b.newPage({ viewport: { width: 1920, height: 1080 } }), pe = [];
    p0.on('pageerror', e => pe.push(e.message));
    await p0.goto('file://' + html); await p0.evaluate(() => window.ready());
    const fit = await p0.evaluate(() => window.ERRS); fit.forEach(e => errs.push(name + '：' + e));
    const T = await p0.evaluate(() => window.SETTLED);
    await p0.evaluate(t => window.renderAt(t), T); await p0.waitForTimeout(80);
    const orig = path.join(TMP, name + '_orig.png'); await p0.screenshot({ path: orig });
    const bgInfo = await p0.evaluate(() => ({ id: H.bg.id, focus: H.focus, layers: H.bg.els.map(e => ({ role: e.dataset.bg, src: e.getAttribute('src'), style: e.getAttribute('style') || '' })) }));
    await p0.close();
    // 2) 抠图页：画面外扩、2 倍像素
    const p = await b.newPage({ viewport: { width: 2400, height: 1560 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => pe.push(e.message));
    await p.goto('file://' + html); await p.evaluate(() => window.ready());
    await p.evaluate(t => window.renderAt(t), T);
    await p.addScriptTag({ path: path.join(__dirname, 'lib/page_aex.js') });
    const D = await p.evaluate(c => AEX.describe(c), COVER);
    D.errs.forEach(e => errs.push(name + '：' + e));
    for (const u of D.units) for (const n of u.nodes) {
      if (!n.clip) { n.png = null; continue; }
      await p.evaluate(id => AEX.isolate(id), n.id);
      const f = `${name}_${n.id}.png`;
      await p.screenshot({ path: path.join(ASSETS, f), clip: n.clip, omitBackground: true });
      n.png = { file: f, x: n.clip.x - D.M, y: n.clip.y - D.M, w: n.clip.width, h: n.clip.height };
      delete n.clip;
    }
    await p.evaluate(() => AEX.restore());
    // 录屏窗口（task：libs/screencast → AE 预合成）
    let sc = null;
    if (spec.sc) { sc = await exportScreencast(p, spec, name, D.M, T, errs); D.units.filter(u => u.kind === 'sc').forEach(u => { u.sc = sc; }); }
    await p.close();
    pe.forEach(e => errs.push(name + '：页面错误 ' + e));
    // 3) 背景：板 + 动态层（SVG → PNG，每个文件只栅格化一次）+ 焦点
    const bg = { id: bgInfo.id, layers: [] };
    for (const L of bgInfo.layers) {
      const src = path.join(ROOT, L.src), base = path.basename(L.src), role = L.role;
      if (role === 'plate') { fs.copyFileSync(src, path.join(ASSETS, base)); bg.layers.push({ name: '背景板_' + bgInfo.id, file: base, x: 0, y: 0, w: 1920, h: 1080 }); continue; }
      const focus = /^focus-/.test(role), png = base.replace(/\.svg$/, '.png');
      if (!bgDone[png]) { await rasterSvg(b, src, path.join(ASSETS, png), focus ? FOCUS_RES : 1920, focus ? FOCUS_RES : 1080); fs.copyFileSync(src, path.join(ASSETS, 'svg', base)); bgDone[png] = 1; }
      if (focus) {
        const [fx, fy, fsc] = bgInfo.focus; const side = 1000 * (fsc || 1);
        bg.layers.push({ name: BGNAME[role] || '背景动态_' + role, file: png, x: fx - side / 2, y: fy - side / 2, w: side, h: side, spin: role === 'focus-ticks' ? 4 : 0, svg: 'svg/' + base });
      } else bg.layers.push({ name: BGNAME[role] || '背景动态_' + role, file: png, x: 0, y: 0, w: 1920, h: 1080, svg: 'svg/' + base, spin: role === 'sweep' ? 'radar' : 0 });
    }
    const shot = { name, id: spec.id || name, layout: spec.layout, start: +start.toFixed(3), dur: spec.dur, settled: T, out: D.out, bg, units: D.units, sc, sub: spec.sub || null };
    shots.push(shot); start += spec.dur;
    // 4) 还原对比：只用导出的图层在浏览器里拼回 settled 那一帧
    if (sc) { const S = spec.sc.spec, SCm = require(path.join(ROOT, 'libs/screencast/screencast.js')); let fu = S.src.url;
      if (S.src.type === 'frames') fu = fu.replace(/%0(\d)d/, (_, n) => String(SCm.frameIndex(S, T) + 1).padStart(+n, '0'));
      shot.scFrame = 'file://' + path.resolve(EPDIR, fu); }
    const r = await recon(b, shot, orig, T); delete shot.scFrame;
    shot.recon = r; console.log(`${name}：${D.units.length} 个元素，${D.units.reduce((a, u) => a + u.nodes.length, 0)} 个 node，还原差异 ${r.mean.toFixed(2)} 色阶 / 明显不同像素 ${(r.bad * 100).toFixed(2)}%`);
  }
  fs.writeFileSync(path.join(OUT, 'export.json'), JSON.stringify({ id: EP.id, title: EP.title, prefix: EP.prefix || EP.id, dur: +start.toFixed(3), shots, errs }, null, 1));
  await b.close();
  if (errs.length) { console.log('✗ 导出问题 ' + errs.length + ' 项：\n  - ' + errs.join('\n  - ')); process.exit(1); }
  console.log('✓ 导出完成 → ' + path.join(OUT, 'export.json'));
})();

async function rasterSvg(b, src, out, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const f = path.join(TMP, 'raster_' + path.basename(out, '.png') + '.html');
  fs.writeFileSync(f, `<html><body style="margin:0;background:transparent"><img id="i" src="file://${src}" style="width:${w}px;height:${h}px;display:block"></body></html>`);
  await p.goto('file://' + f);
  await p.evaluate(() => document.getElementById('i').decode());
  await p.screenshot({ path: out, omitBackground: true }); await p.close();
}

// 录屏：窗口边框 PNG + 录屏预合成的数据（原片 + 时间重映射 + 推镜 + 打码 / 标注 / 标签）
//   推镜、标注都是 SC 同一套数学（SC.keyframes / SC.camAt）；打码在 AE 里一律做成实色块（模糊打码在 AE 里不重建，宁可遮死）
//   光标、点击涟漪、标签引线、联动引线没有在 AE 里重建（WARN 写进本期说明）
async function exportScreencast(p, spec, name, M, T, errs) {
  const S = spec.sc.spec, K = await p.evaluate(s => SC.keyframes(s), S), out = { name: name + '·录屏画面', warn: [] };
  const BR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8')).color, C = k => BR[k].hex;
  await p.evaluate(t => window.renderAt(t), T);
  // 1) 窗口边框：只留窗口底、标题栏、视口底色
  const win = await p.evaluate(() => { const w = H.sc.win; w.dataset.aexn = 'scwin'; const v = w.querySelector('.sc-view'), R = v.getBoundingClientRect(), W2 = w.getBoundingClientRect();
    return { view: AEX.box(v), radius: parseFloat(getComputedStyle(v).borderTopLeftRadius) || 0, clip: { x: Math.max(0, Math.floor(W2.left - 120)), y: Math.max(0, Math.floor(W2.top - 120)), width: Math.ceil(W2.width + 240), height: Math.ceil(W2.height + 240) } }; });
  await p.evaluate(() => AEX.isolate('scwin', '.sc-cam,.sc-ann,.sc-labels,.sc-cursor,.sc-ripple'));
  const cf = name + '_sc_win.png'; await p.screenshot({ path: path.join(ASSETS, cf), clip: win.clip, omitBackground: true });
  out.chrome = { file: cf, x: win.clip.x - M, y: win.clip.y - M, w: win.clip.width, h: win.clip.height };
  out.vx = K.view.x; out.vy = K.view.y; out.vw = K.view.w; out.vh = K.view.h; out.radius = win.radius;
  // 2) 原片：有 video（本期目录下的原始录屏）就用它；帧序列就合成一条 MP4；单张截图原样
  const src = S.src;
  if (spec.sc.video) { const v = path.resolve(EPDIR, spec.sc.video), f = name + '_录屏原片' + path.extname(v); fs.copyFileSync(v, path.join(ASSETS, f)); out.src = { file: f, video: true }; }
  else if (src.type === 'frames') {
    const f = name + '_录屏原片.mp4', pat = path.resolve(EPDIR, src.url);
    require('child_process').execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(src.fps), '-i', pat, '-frames:v', String(src.count), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', path.join(ASSETS, f)]);
    out.src = { file: f, video: true };
  } else { const f = name + '_录屏原片' + path.extname(src.url); fs.copyFileSync(path.resolve(EPDIR, src.url), path.join(ASSETS, f)); out.src = { file: f, video: false }; }
  out.mw = src.w; out.mh = src.h;
  // 时间重映射：分段线性；没写 remap 就是 max(0, t − start)
  const R = S.remap && S.remap.length ? S.remap.map(k => [k[0], k[1]]) : [[0, 0], [S.start || 0, 0], [spec.dur, Math.max(0, spec.dur - (S.start || 0))]];
  out.remap = R.filter((k, i) => !i || Math.abs(k[0] - R[i - 1][0]) > 1e-4);
  // 推镜：依次从上一个状态推到这个区域
  let cur = K.full; out.cam0 = [cur.s, cur.tx, cur.ty]; out.push = [];
  K.push.forEach(k => { out.push.push([k.at, k.at + k.dur, cur.s, cur.tx, cur.ty, k.cam.s, k.cam.tx, k.cam.ty, k.ease]); cur = k.cam; });
  const camS = t => p.evaluate(([s, t, w, h]) => SC.camAt(s, t, w, h), [S, t, K.view.w, K.view.h]);
  out.mask = (S.mask || []).map(m => ({ r: m.rect, fill: C((m.mode || 'blur') === 'block' ? 'slate' : 'char_lo') }));
  if ((S.mask || []).some(m => (m.mode || 'blur') === 'blur')) out.warn.push('模糊打码在 AE 里做成了实色块（遮死，不透原文）');
  out.ann = []; out.labels = [];
  for (const [i, a] of (S.ann || []).entries()) {
    const c = await camS(a.at + 0.3), s = c.s, pad = 10 / s;
    const r = [a.rect[0] - pad, a.rect[1] - pad, a.rect[2] + 2 * pad, a.rect[3] + 2 * pad], o = a.out == null ? null : a.out;
    if (a.type === 'spot') out.ann.push({ type: 'spot', vr: [c.tx + r[0] * s, c.ty + r[1] * s, r[2] * s, r[3] * s], at: a.at, out: o, fill: C('char'), op: 62, radius: 14 });
    else if (a.type === 'underline') out.ann.push({ type: 'underline', r: [r[0], r[1] + r[3] - 3 / s, r[2], 6 / s], at: a.at, out: o, fill: C('orange') });
    else out.ann.push({ type: 'mark', r, at: a.at, out: o, stroke: C('orange'), sw: 6 / s, radius: 14 / s });
    if (a.label) {
      let t = a.at + 1.0; if (o != null && t > o - 0.02) t = o - 0.02;
      await p.evaluate(t => window.renderAt(t), t);
      const L = await p.evaluate(([i, id]) => AEX.single(H.sc.ann[i].label, id), [i, 'sclab' + i]);
      L.errs.forEach(e => errs.push(name + '：' + e));
      await p.evaluate(id => AEX.isolate(id), 'sclab' + i);
      const f = `${name}_sc_label${i + 1}.png`; await p.screenshot({ path: path.join(ASSETS, f), clip: L.clip, omitBackground: true });
      const vo = await p.evaluate(() => AEX.box(H.sc.view));
      const sh = (x, y) => [x - vo[0], y - vo[1]];
      const [px, py] = sh(L.clip.x - M, L.clip.y - M);
      out.labels.push({ png: { file: f, x: px, y: py, w: L.clip.width, h: L.clip.height }, texts: L.texts.map(tx => Object.assign(tx, { x: tx.x - vo[0], y: tx.y - vo[1] })), at: a.at + 0.35, out: o });
      if (a.leader) out.warn.push('标签「' + a.label + '」的引线没有在 AE 里重建');
    }
  }
  if ((S.cursor || []).length) out.warn.push('光标和点击涟漪没有在 AE 里重建');
  if ((S.links || []).length) out.warn.push('录屏到信息卡的联动引线没有在 AE 里重建');
  out.enter = S.enter ? (S.enter.at || 0) : null;
  await p.evaluate(t => window.renderAt(t), T);
  return out;
}

// 录屏窗口的还原：边框 + 原片在 settled 时刻的那一帧（按推镜相机）+ 打码实色块 + 已出现的标签 PNG（标签文字由 canvas 画）
function reconSc(sc, shot, T, k) {
  const url = f => 'file://' + path.join(ASSETS, f);
  let cam = { s: sc.cam0[0], tx: sc.cam0[1], ty: sc.cam0[2] };
  sc.push.forEach(q => { if (T >= q[1]) cam = { s: q[5], tx: q[6], ty: q[7] }; });
  const frame = shot.scFrame ? `<img src="${shot.scFrame}" style="position:absolute;left:0;top:0;width:${sc.mw}px;height:${sc.mh}px">` : '';
  const masks = sc.mask.map(m => `<div style="position:absolute;left:${m.r[0]}px;top:${m.r[1]}px;width:${m.r[2]}px;height:${m.r[3]}px;background:${m.fill}"></div>`).join('');
  const labs = sc.labels.filter(l => T >= l.at + 0.6 && (l.out == null || T < l.out)).map(l => `<img src="${url(l.png.file)}" style="position:absolute;left:${l.png.x}px;top:${l.png.y}px;width:${l.png.w}px;height:${l.png.h}px">`).join('');
  return `<div class="u"><img src="${url(sc.chrome.file)}" style="position:absolute;left:${sc.chrome.x}px;top:${sc.chrome.y}px;width:${sc.chrome.w}px;height:${sc.chrome.h}px">
<div style="position:absolute;left:${sc.vx}px;top:${sc.vy}px;width:${sc.vw}px;height:${sc.vh}px;overflow:hidden;border-radius:${sc.radius}px"><div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:translate(${cam.tx}px,${cam.ty}px) scale(${cam.s})">${frame}${masks}</div>${labs}</div><canvas id="c${k}" width="1920" height="1080"></canvas></div>`;
}

// 用导出的图层拼回去：背景板 + 动态层 + 焦点（刻度按 settled 时刻的角度）+ 每个 unit（倾斜按 pivot 转）+ 文字（canvas 从基线画，和 AE 点文字同一个定位方式）
async function recon(b, shot, origPng, T) {
  const FACES = COVER.faces, url = f => 'file://' + path.join(ASSETS, f);
  const layers = shot.bg.layers.map(L => `<img src="${url(L.file)}" style="position:absolute;left:${L.x}px;top:${L.y}px;width:${L.w}px;height:${L.h}px;${L.spin === 4 ? `rotate:${(4 * T).toFixed(3)}deg` : ''}">`).join('');
  const units = shot.units.map((u, k) => {
    if (u.kind === 'sc') return reconSc(u.sc, shot, T, k);
    const imgs = u.nodes.filter(n => n.png).map(n => `<img src="${url(n.png.file)}" style="position:absolute;left:${n.png.x}px;top:${n.png.y}px;width:${n.png.w}px;height:${n.png.h}px">`).join('');
    return `<div class="u" style="transform-origin:${u.pivot[0]}px ${u.pivot[1]}px;rotate:${u.tilt}deg">${imgs}<canvas id="c${k}" width="1920" height="1080"></canvas></div>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="file://${ROOT}/"><link rel="stylesheet" href="engine/tokens.css"><link rel="stylesheet" href="engine/base.css">
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000}.u{position:absolute;inset:0}.u canvas{position:absolute;left:0;top:0}#o{display:none}</style></head><body>${layers}${units}
<script>
const FACES=${JSON.stringify(FACES.map(f => ({ ps: f.ps, family: f.family, weight: f.weight })))}, U=${JSON.stringify(shot.units.map(u => u.kind === 'sc' ? u.sc.labels.filter(l => T >= l.at + 0.6 && (l.out == null || T < l.out)).flatMap(l => l.texts.map(t => Object.assign({}, t, { x: t.x + u.sc.vx, y: t.y + u.sc.vy }))) : u.nodes.flatMap(n => n.texts)))};
const face = ps => FACES.find(f => f.ps === ps) || FACES[0];
window.draw = async () => {
  const need = new Set(); U.flat().forEach(t => t.runs.forEach(r => { const f = face(r.font); need.add(f.weight + ' ' + r.size + 'px "' + f.family + '"|' + t.text.slice(r.s, r.e)); }));
  await Promise.all([...need].map(k => { const [fn, tx] = k.split('|'); return document.fonts.load(fn, tx).catch(() => {}); }));
  U.forEach((ts, k) => { const c = document.getElementById('c' + k).getContext('2d');
    ts.forEach(t => { c.globalAlpha = t.op; const lines = t.text.split('\\r'); let off = 0;
      lines.forEach((ln, li) => {
        const segs = t.runs.filter(r => r.e > off && r.s < off + ln.length).map(r => ({ r, s: Math.max(r.s, off) - off, e: Math.min(r.e, off + ln.length) - off }));
        const setF = r => { const f = face(r.font); c.font = f.weight + ' ' + r.size + 'px "' + f.family + '"'; c.letterSpacing = (r.track * r.size / 1000) + 'px'; c.fillStyle = r.color; };
        let w = 0; segs.forEach(g => { setF(g.r); w += c.measureText(ln.slice(g.s, g.e)).width; });
        let x = t.align === 'center' ? t.x - w / 2 : t.align === 'right' ? t.x - w : t.x; const y = t.y + li * t.lead;
        segs.forEach(g => { setF(g.r); const s = ln.slice(g.s, g.e); c.fillText(s, x, y); x += c.measureText(s).width; });
        off += ln.length + 1; }); }); });
};
</script></body></html>`;
  const f = path.join(TMP, shot.name + '_recon.html'); fs.writeFileSync(f, html);
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + f); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  await p.evaluate(() => window.draw()); await p.waitForTimeout(80);
  const rec = path.join(TMP, shot.name + '_recon.png'); await p.screenshot({ path: rec });
  // 比较 + 出对比图（左原画面 · 中还原 · 右差异）
  const cmp = await p.evaluate(async ([a, c]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [A, C] = await Promise.all([load(a), load(c)]), cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const x = cv.getContext('2d'); x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, 1920, 1080).data; x.drawImage(C, 0, 0); const dc = x.getImageData(0, 0, 1920, 1080).data;
    const out = x.createImageData(1920, 1080); let sum = 0, bad = 0;
    for (let i = 0; i < da.length; i += 4) { const d = (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2])) / 3; sum += d; if (d > 40) bad++;
      const v = Math.min(255, d * 4); out.data[i] = v; out.data[i + 1] = v * 0.45; out.data[i + 2] = 0; out.data[i + 3] = 255; }
    x.putImageData(out, 0, 0); const diff = cv.toDataURL('image/png');
    const big = document.createElement('canvas'); big.width = 1920 * 3 / 2; big.height = 1080 / 2 + 40; const g = big.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, big.width, big.height);
    const Dimg = await load(diff); g.drawImage(A, 0, 40, 960, 540); g.drawImage(C, 960, 40, 960, 540); g.drawImage(Dimg, 1920, 40, 960, 540);
    g.fillStyle = '#eee'; g.font = '22px sans-serif'; g.fillText('原画面（网页）', 16, 28); g.fillText('用导出的图层拼回去（AE 同一套位置）', 976, 28); g.fillText('差异（越亮越不同）', 1936, 28);
    return { mean: sum / (da.length / 4), bad: bad / (da.length / 4), jpg: big.toDataURL('image/jpeg', 0.85) };
  }, [origPng, rec].map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')));
  fs.writeFileSync(path.join(RECON, shot.name + '.jpg'), Buffer.from(cmp.jpg.split(',')[1], 'base64'));
  await p.close();
  return { mean: cmp.mean, bad: cmp.bad };
}
