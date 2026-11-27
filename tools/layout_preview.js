// 排版库线框预览：把 layout.json 画成线框图（A 炭黑场配色），并拼一张总览板。
// 用法：node tools/layout_preview.js                       全部 cards/layouts/*.json → cards/layouts/previews/<id>.jpg + docs/previews/layouts/sheet.jpg
//       node tools/layout_preview.js a.json b.json --out 目录   只画指定文件，输出到指定目录（不生成总览板时加 --no-sheet）
// 先跑 python3 tools/layout_lint.py；预览里每个槽位标 id、类型和 need，主体槽位四角加朱橙括角，字幕安全区画斜线。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const LY = BRAND.layout, C = Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex]));

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; };
const outDir = opt('--out'), noSheet = args.includes('--no-sheet');
const files = args.filter(a => !a.startsWith('--'));
const LDIR = path.join(ROOT, 'cards/layouts');
const list = files.length ? files.map(f => path.resolve(f))
  : fs.readdirSync(LDIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().map(f => path.join(LDIR, f));
const OUT = outDir ? path.resolve(outDir) : path.join(LDIR, 'previews');
const SHEET = outDir ? path.join(OUT, 'sheet.jpg') : path.join(ROOT, 'docs/previews/layouts/sheet.jpg');
if (!list.length) { console.log('（没有排版文件）'); process.exit(0); }

// lint 结果（字幕区、利用率）直接用 layout_lint.py 算，保证两边口径一致
const lint = JSON.parse(execFileSync('python3', [path.join(ROOT, 'tools/layout_lint.py'), '--json', ...list], { encoding: 'utf8', maxBuffer: 1 << 26 }).toString() || '[]');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FILL = { card: ['slate', 'cream'], card_lit: ['paper', 'char'], accent: ['orange', 'char'], aux: ['klein', 'cream'] };

function slotHTML(s) {
  const [x, y, w, h] = s.rect;
  // 大字（≥104）按「一行放得下 need」缩小，只为线框好看；小字按真实字号画，方便判断手机上看不看得清
  const units = [...String(s.need || '')].reduce((n, c) => n + (/[\u0000-\u00ff]/.test(c) ? 0.6 : 1), 0) || 1;
  let fp = Math.max(18, Math.min(s.font_px || 52, h * 0.8));
  if ((s.font_px || 0) >= 104) fp = Math.max(40, Math.min(fp, Math.floor((w - 24) / units)));
  const tag = `<i class="tag">${esc(s.id)} · ${esc(s.type)}${s.size ? ' ' + esc(s.size) : ''}${s.font_px ? ' · ' + s.font_px + 'px' : ''}${s.count ? ' · ×' + s.count.join('–') : ''}</i>`;
  const need = esc(s.need) + (s.person_optional ? '<br><small>（素材位 · 可切回人物）</small>' : '');
  const st = `left:${x}px;top:${y}px;width:${w}px;height:${h}px` + (s.shape === 'circle' ? ';border-radius:50%;overflow:hidden' : '');
  const corners = s.subject ? '<b class="cn tl"></b><b class="cn tr"></b><b class="cn bl"></b><b class="cn br"></b>' : '';
  let body = '', cls = s.type;
  if (s.type === 'title' || s.type === 'label') {
    const [bg, fg] = FILL[s.fill] || [null, 'cream'];
    const ff = s.type === 'title' ? 'var(--f-disp)' : (s.decor ? 'var(--f-mono)' : 'var(--f-cn)');
    body = `<div class="txt" style="font-family:${ff};font-size:${fp}px;color:${C[fg]};${bg ? 'background:' + C[bg] : ''}">${esc(s.need)}</div>`;
  } else if (s.type === 'card') {
    const [bg, fg] = FILL[s.fill || 'card'];
    const circ = s.shape === 'circle' ? ';display:flex;align-items:center;justify-content:center;text-align:center;padding:12%' : '';
    body = `<div class="cardb" style="background:${C[bg]};color:${C[fg]}${circ}"><div style="font-size:${fp}px">${esc(s.need)}</div></div>`;
  } else if (s.type === 'group') {
    body = `<div class="gname">${esc(s.need)}</div>`;
  } else if (s.type === 'screen') {
    body = `<div class="win"><div class="bar"><u style="background:${C.orange}"></u><u></u><u></u><span>录屏</span></div><div class="shot">${need}</div></div>`;
  } else {  // media / person
    body = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="0" x2="${w}" y2="${h}"/><line x1="${w}" y1="0" x2="0" y2="${h}"/></svg><div class="mneed">${need}</div>`;
  }
  if (s.type === 'group') return `<div class="slot group" style="${st};z-index:0">${body}${corners}</div>`;
  return `<div class="slot ${cls}${s.bleed ? ' bleed' : ''}" style="${st}">${body}${corners}${tag}</div>`;
}

function pageHTML(L, R) {
  const [W, H] = L.canvas || [BRAND.spec.w, BRAND.spec.h], mx = LY.margin_x, my = LY.margin_y ?? mx, cb = LY.chapter_bar || { h: 0, gap: 0 }, top = cb.h + cb.gap;
  const [sx, sy, sw, sh] = R.stats.subtitle_zone || [0, 0, 0, 0];
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:radial-gradient(ellipse at 60% 45%,var(--char-hi),var(--char) 60%,var(--char-lo));font-family:var(--f-cn);color:var(--cream)}
.guide{position:absolute;left:${mx}px;top:${top}px;width:${W - 2 * mx}px;height:${H - top - my}px;border:2px dashed rgba(245,238,223,.16)}
.subz{position:absolute;left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;border:2px solid rgba(245,238,223,.35);
  background:repeating-linear-gradient(135deg,rgba(245,238,223,.10) 0 10px,transparent 10px 22px);display:flex;align-items:center;justify-content:center;
  font-size:26px;color:rgba(245,238,223,.6);z-index:50}
.slot{position:absolute}
.tag{position:absolute;left:0;top:-30px;font:500 18px/26px var(--f-mono);letter-spacing:.08em;color:rgba(245,238,223,.75);white-space:nowrap;font-style:normal;z-index:60}
.txt{width:100%;height:100%;outline:2px solid rgba(245,238,223,.45);line-height:1.08;overflow:hidden;padding:4px 8px}
.cardb{width:100%;height:100%;padding:28px 32px;overflow:hidden;font-weight:700;line-height:1.2}
.media svg,.person svg{position:absolute;inset:0;width:100%;height:100%}
.media svg line,.person svg line{stroke:rgba(245,238,223,.28);stroke-width:2}
.media,.person{border:3px dashed rgba(245,238,223,.55);background:rgba(245,238,223,.04)}
.mneed{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;font-size:28px;line-height:1.3;color:rgba(245,238,223,.8)}
.mneed small{font-size:22px;opacity:.75}
.bleed{outline:3px dotted var(--orange);outline-offset:-3px}
.win{width:100%;height:100%;background:var(--slate);display:flex;flex-direction:column}
.bar{height:48px;display:flex;align-items:center;gap:12px;padding:0 20px;font:500 20px var(--f-mono);color:rgba(245,238,223,.6)}
.bar u{width:16px;height:16px;border-radius:50%;background:rgba(245,238,223,.5)} .bar span{margin-left:12px}
.shot{flex:1;margin:0 8px 8px;background:var(--char-lo);display:flex;align-items:center;justify-content:center;text-align:center;font-size:32px;color:rgba(245,238,223,.7)}
.group{border:2px dashed rgba(255,90,31,.55);background:rgba(255,90,31,.04)}
.gname{position:absolute;right:12px;bottom:8px;font-size:22px;color:rgba(245,238,223,.7);text-align:right;max-width:90%}
.cn{position:absolute;width:40px;height:40px;border:0 solid var(--orange);z-index:55}
.tl{left:-6px;top:-6px;border-width:6px 0 0 6px}.tr{right:-6px;top:-6px;border-width:6px 6px 0 0}
.bl{left:-6px;bottom:-6px;border-width:0 0 6px 6px}.br{right:-6px;bottom:-6px;border-width:0 6px 6px 0}
</style></head><body><div class="chapter-zone"></div><div class="guide"></div><div class="subz">字幕安全区</div>${(L.slots || []).map(slotHTML).join('')}</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), errs = [], done = [];
  for (let i = 0; i < list.length; i++) {
    const L = JSON.parse(fs.readFileSync(list[i], 'utf8')), R = lint[i];
    const [W, H] = L.canvas || [BRAND.spec.w, BRAND.spec.h];
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 0.5 });
    p.on('pageerror', e => errs.push(`${L.id}：${e.message}`));
    const tmp = path.join(OUT, `_${L.id}.html`); fs.writeFileSync(tmp, pageHTML(L, R));
    await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    const out = path.join(OUT, `${L.id}.jpg`);
    await p.screenshot({ path: out, type: 'jpeg', quality: 82 }); fs.unlinkSync(tmp); await p.close();
    done.push({ L, R, out }); console.log(path.relative(ROOT, out) + (R.errors.length ? `  ✗ lint ${R.errors.length} 项` : ''));
  }
  if (!noSheet) {
    fs.mkdirSync(path.dirname(SHEET), { recursive: true });
    const cells = done.map(({ L, R, out }) => `<figure><img src="file://${out}"><figcaption><b>${esc(L.id)}</b> ${esc(L.name)}<br>
      <span>${esc(L.function)} · 场景 ${esc((L.scene || []).join('/'))} · 主体 ${Math.round(R.stats.subject * 100)}% · 内容 ${Math.round(R.stats.content * 100)}%${R.errors.length ? ' · <em>✗ lint</em>' : ''}</span><br>
      <span class="from">迁自：${esc(L.from)}</span></figcaption></figure>`).join('');
    const sh = path.join(OUT, '_sheet.html');
    fs.writeFileSync(sh, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>html,body{width:2040px;height:auto;overflow:visible;background:var(--cream)}body{padding:56px 64px;font-family:var(--f-cn);color:var(--char)}
h1{font:400 72px var(--f-disp);margin-bottom:36px}.g{display:grid;grid-template-columns:repeat(3,608px);gap:40px 28px}
figure img{width:608px;display:block;box-shadow:0 10px 24px rgba(90,40,10,.14)}figcaption{font-size:22px;line-height:1.45;margin-top:12px;font-weight:700}
figcaption span{font-weight:500;font-size:19px;opacity:.8}figcaption .from{opacity:.55}figcaption em{font-style:normal;background:var(--orange);padding:0 6px}</style></head>
<body><h1>排版库 · ${done.length} 个</h1><div class="g">${cells}</div></body></html>`);
    const s = await b.newPage({ viewport: { width: 2040, height: 800 } });
    await s.goto('file://' + sh); await s.evaluate(() => document.fonts.ready);
    await s.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await s.waitForTimeout(200);
    await s.screenshot({ path: SHEET, fullPage: true, type: 'jpeg', quality: 85 }); fs.unlinkSync(sh);
    console.log(path.relative(ROOT, SHEET));
  }
  await b.close();
  if (errs.length) { console.error('✗ 页面报错：\n' + errs.join('\n')); process.exit(1); }
  const bad = done.filter(d => d.R.errors.length);
  console.log(bad.length ? `! 预览已生成，但 ${bad.length} 个排版没过 lint：${bad.map(d => d.L.id).join('、')}` : '✓ 预览全部生成');
})();
