// 透明底逐帧渲染（贴片素材用）：node render_alpha.js "page.html?参数" 时长秒 输出目录 [fps=60]
// 页面需要提供 window.renderAt(t) 且背景透明；输出 RGBA PNG 序列 f_00001.png …
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [, , page, durS, out, fpsS = '60'] = process.argv; const dur = +durS, FPS = +fpsS;
  fs.mkdirSync(out, { recursive: true });
  const [file, q] = page.split('?');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(file) + (q ? '?' + q : '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const n = Math.round(dur * FPS);
  for (let f = 0; f < n; f++) { await p.evaluate(t => window.renderAt(t), f / FPS); await p.screenshot({ path: `${out}/f_${String(f + 1).padStart(5, '0')}.png`, omitBackground: true }); }
  if (errs.length) console.log('ERR', errs.slice(0, 3)); console.log('frames', n);
  await b.close();
})();
