// 质感版探索：node docs/previews/explore/src/render.js → docs/previews/explore/*.jpg
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const DIR = path.resolve(__dirname, '..'), SRC = path.join(__dirname, 'texture.html');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const f of ['D1h', 'D1v', 'D6h', 'D6v']) {
    const v = f.endsWith('v'), p = await b.newPage({ viewport: v ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
    p.on('pageerror', e => { console.log(f, 'pageerror', e.message); bad++; });
    await p.goto('file://' + SRC + '?f=' + f);
    await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await p.waitForTimeout(300); await p.evaluate(() => window.layout());
    const errs = await p.evaluate(() => window.check());
    console.log(f, errs.length ? '✗ ' + errs.join('；') : '✓ 字号 / 对比通过'); bad += errs.length;
    await p.screenshot({ path: path.join(DIR, `texture_${f}.jpg`), type: 'jpeg', quality: 90 });
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
