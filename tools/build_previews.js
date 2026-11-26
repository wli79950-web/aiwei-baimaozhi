// 重新生成 docs/previews/ 下的预览图：演示关键帧 + 手机竖屏模拟 + 配色 / 背景板 / 贴纸预览板
// 用法：node tools/build_previews.js      （先 npm i；改了 brand.json 要先跑 python3 tools/gen_tokens.py）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'docs/previews/src'), OUT = path.join(ROOT, 'docs/previews');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const url = (f, q) => 'file://' + path.join(SRC, f) + (q ? '?' + q : '');
const ready = async p => { await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await p.waitForTimeout(300); };

(async () => {
  const b = await chromium.launch(), errs = [];
  // 1. 演示关键帧（1920×1080，dpr 1 = 成片原尺寸）
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errs.push(e.message));
  for (let f = 1; f <= 6; f++) {
    await p.goto(url('demo.html', 'f=' + f)); await ready(p);
    const broken = await p.evaluate(() => [...document.querySelectorAll('.frame.on img')].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
    if (broken.length) errs.push(`demo F${f} 缺图：${broken.join(', ')}`);
    await p.screenshot({ path: path.join(OUT, `demo_F${f}.jpg`), type: 'jpeg', quality: 90 }); console.log(`docs/previews/demo_F${f}.jpg`);
  }
  // 2. 手机竖屏模拟（横屏成片放进竖拿的手机里）
  const ph = await b.newPage({ viewport: { width: 1980, height: 1060 }, deviceScaleFactor: 2 });
  const shots = [1, 3, 5, 6].map(f => `<div class="ph"><div class="sc"><img src="file://${path.join(OUT, `demo_F${f}.jpg`)}"></div><b>演示 F${f}</b></div>`).join('');
  fs.writeFileSync(path.join(SRC, '_phone.html'), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../../../engine/tokens.css"><link rel="stylesheet" href="../../../engine/base.css"><style>html,body{width:1980px;height:1060px;background:#D9D3C7}body{display:flex;gap:60px;justify-content:center;align-items:center;font-family:var(--f-cn)}.ph{width:420px;height:880px;border-radius:64px;background:#0b0b0c;padding:16px;position:relative;box-shadow:0 30px 60px #0004}.sc{width:100%;height:100%;border-radius:50px;background:#000;display:flex;align-items:center;overflow:hidden}.sc img{width:100%}.ph b{position:absolute;bottom:-50px;left:0;right:0;text-align:center;font-size:22px;color:var(--char)}</style></head><body>${shots}</body></html>`);
  await ph.goto(url('_phone.html')); await ready(ph);
  await ph.screenshot({ path: path.join(OUT, 'phone_demo.jpg'), type: 'jpeg', quality: 90 }); console.log('docs/previews/phone_demo.jpg');
  fs.unlinkSync(path.join(SRC, '_phone.html'));
  // 3. 预览板（数据从 brand.json 注入）
  const s = await b.newPage({ viewport: { width: 2240, height: 1000 } });
  await s.addInitScript(d => { window.BRAND = d; }, BRAND);
  s.on('pageerror', e => errs.push(e.message));
  for (const k of ['palette', 'backgrounds', 'stickers', 'imagery']) {
    await s.goto(url('sheets.html', 's=' + k)); await ready(s);
    await s.screenshot({ path: path.join(OUT, `sheet_${k}.jpg`), fullPage: true, type: 'jpeg', quality: 90 }); console.log(`docs/previews/sheet_${k}.jpg`);
  }
  await b.close();
  if (errs.length) { console.error('✗ 页面报错：\n' + errs.join('\n')); process.exit(1); }
  console.log('✓ 预览全部生成，无报错');
})();
