// 贴纸风格对比：node docs/previews/explore/src/styles_board.js
// 1. styles_sheet.jpg：三个物件 × 四种做法，放在质感版炭黑底上
// 2. styles_D1v.jpg / styles_D1h.jpg：同一个 D1 镜头分别换成三种风格的芯片
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const DIR = path.resolve(__dirname, '..'), TMP = path.resolve(DIR, '../../../out/explore'), SRC = path.join(__dirname, 'texture.html');
const U = p => 'file://' + p, IMG = n => U(path.join(DIR, 'img', n + '.png'));
const ROWS = [['clay', '粘土 / 陶瓷（现版做法）'], ['real', '写实 · 原色'], ['real_g', '写实 · 统一调色'], ['anime2_g', '动漫 · 统一调色']];
const im = (row, k) => row.endsWith('_g') ? IMG(row.replace('_g', '') + '_' + k + '_g') : IMG(row + '_' + k);
const css = `<style>@import url("${U(path.resolve(DIR, '../../../node_modules/misans/lib/Normal/MiSans-Bold.min.css'))}");
@import url("${U(path.resolve(DIR, '../../../node_modules/@fontsource/ibm-plex-mono/500.css'))}");body{margin:0;font-family:MiSans,sans-serif}</style>`;
const sheet = `<html><head>${css}<style>
body{width:1920px;background:#16130F radial-gradient(ellipse at 50% 40%,#241F19,#0F0D0A);color:#F5EEDF;position:relative}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(245,238,223,.13) 1.5px,transparent 2.2px);background-size:48px 48px}
.row{position:relative;display:grid;grid-template-columns:420px repeat(3,1fr);align-items:center;height:400px;border-top:1.5px solid rgba(245,238,223,.07)}
.lab{padding-left:64px;font-size:40px;line-height:1.25}.lab small{display:block;font:500 19px/1 "IBM Plex Mono";letter-spacing:.18em;opacity:.45;margin-top:14px;text-transform:uppercase}
.cell{height:340px;display:flex;align-items:center;justify-content:center}.cell img{max-width:420px;max-height:300px;filter:drop-shadow(0 30px 38px rgba(0,0,0,.45))}</style></head>
<body><div class="dots"></div>${ROWS.map(([r, l]) => `<div class="row"><div class="lab">${l}<small>${r}</small></div>${['chip', 'lock', 'server'].map(k => `<div class="cell"><img src="${im(r, k)}"></div>`).join('')}</div>`).join('')}</body></html>`;
const phones = (list, w, h) => `<html><head>${css}<style>body{background:#E9E3D6;width:${48 + list.length * (w + 48)}px;color:#16130F}
.phs{display:flex;gap:48px;padding:40px 48px 28px}.cap{font-size:30px;text-align:center;margin-top:16px}.f img{width:${w}px;display:block;border-radius:22px}</style></head>
<body><div class="phs">${list.map(([f, l]) => `<div class="f"><img src="${U(f)}"><div class="cap">${l}</div></div>`).join('')}</div></body></html>`;
(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch();
  const page = async (file, vw, vh) => { const p = await b.newPage({ viewport: { width: vw, height: vh } }); await p.goto(U(file)); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await p.waitForTimeout(250); return p; };
  fs.writeFileSync(path.join(TMP, 'styles_sheet.html'), sheet);
  let p = await page(path.join(TMP, 'styles_sheet.html'), 1920, 1600); await p.screenshot({ path: path.join(DIR, 'styles_sheet.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await p.close();
  const V = [['clay_chip', '粘土（现版做法 · 同批新生成）'], ['real_chip_g', '写实 · 统一调色'], ['anime2_chip_g', '动漫 · 统一调色']];
  for (const o of ['v', 'h']) {
    const shots = [];
    for (const [img, l] of V) {
      p = await page(SRC + '?f=D1' + o + (img ? '&img=' + img : ''), o === 'v' ? 1080 : 1920, o === 'v' ? 1920 : 1080);
      await p.evaluate(() => window.layout()); const f = path.join(TMP, `D1${o}_${img}.jpg`);
      await p.screenshot({ path: f, type: 'jpeg', quality: 90 }); await p.close(); shots.push([f, l]);
    }
    fs.writeFileSync(path.join(TMP, `styles_D1${o}.html`), o === 'v' ? phones(shots, 560) : phones(shots, 900));
    p = await page(path.join(TMP, `styles_D1${o}.html`), 800, 600); await p.screenshot({ path: path.join(DIR, `styles_D1${o}.jpg`), fullPage: true, type: 'jpeg', quality: 86 }); await p.close();
  }
  await b.close();
})();
