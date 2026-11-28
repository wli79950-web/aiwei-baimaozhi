// 知识卡片预览：配方表（cards/recipes/recipes.json）里每条配方的示例镜头，用镜头运行时（engine/shot.js）挂出来，取「全部入场完成」那一帧
// 用法：node tools/cards_preview.js [配方 id …]     → docs/previews/cards/<配方 id>.jpg、sheet_1….jpg、report.txt
// 检查：信息卡放得下 / 字号 / 颜色（tools/lib/pagecheck.js）· 文字标签不溢出 · 每屏装饰小字 ≤ 16 · 图解 / 标注 / 倾斜卡不出画面、不进章节进度条区
// 示例内容是示意，图片是风格样张（不进正片）。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/previews/cards'), TMP = path.join(ROOT, 'out/cards_preview');
const pageCheck = require('./lib/pagecheck.js'), shotPage = require('./lib/shotpage.js');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const RECIPES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/recipes/recipes.json'), 'utf8')).recipes;
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));
const DECOR_MAX = BRAND.type.decor.per_frame_max, BAR = BRAND.layout.chapter_bar.h;
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const only = process.argv.slice(2);

(async () => {
  const b = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--disable-gpu'] } : {}), report = [];
  const ARGS = [Object.fromEntries(Object.entries(BRAND.color).map(([k, v]) => [k, v.hex])), BRAND.contrast.forbidden, BRAND.type.meaningful_min, BRAND.type.decor_min, BRAND.contrast.text_min, BRAND.type.decor.per_card_max];
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const list = RECIPES.filter(r => !only.length || only.includes(r.id));
  for (const r of list) {
    const f = path.join(TMP, r.id + '.html');
    fs.writeFileSync(f, shotPage(ROOT, { id: r.id, ...r.example }, LAYOUT(r.layout), { chapterZone: true, idtag: r.id + ' · ' + r.name }));
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push('页面错误 ' + e.message));
    await p.goto('file://' + f); await p.evaluate(() => window.ready()); await p.waitForTimeout(120);
    await p.evaluate(() => window.renderAt(window.SETTLED));
    const chk = await p.evaluate(`(${pageCheck})(${ARGS.map(a => JSON.stringify(a)).join(',')})`);
    errs.push(...chk.errs, ...(await p.evaluate(() => window.ERRS)));
    errs.push(...await p.evaluate(([max, bar]) => {
      const e = [], fr = document.getElementById('fr'), nd = fr.querySelectorAll('[data-role="decor"]').length;
      if (nd > max) e.push('装饰小字 ' + nd + ' 处，每屏最多 ' + max + ' 处');
      fr.querySelectorAll('.ic-at,.ic-node,.ic-sw,.ic-zone,.ic-tile,.ic-callout,.ic-pillbox').forEach(x => { const r = x.getBoundingClientRect(); if (r.left < -2 || r.right > 1922 || r.top < bar - 2 || r.bottom > 1082) e.push((x.closest('.ic') || x).dataset.label + ' 的「' + x.textContent.slice(0, 8) + '」出画面或压到章节进度条区'); });
      return e;
    }, [DECOR_MAX, BAR]));
    const todo = await p.evaluate(() => [...document.querySelectorAll('.todo')].map(t => t.textContent.replace('待补组件', '')));
    report.push(`${r.id}：${errs.length ? '✗ ' + errs.join('；') : '✓'}${todo.length ? '　｜ 待补：' + todo.join(' / ') : ''}`);
    await p.screenshot({ path: path.join(OUT, r.id + '.jpg'), type: 'jpeg', quality: 82 });
  }
  // 总览板：每张 10 个（2 列 × 5 行）
  if (!only.length) {
    const per = 10, pages = Math.ceil(RECIPES.length / per);
    fs.readdirSync(OUT).filter(n => /^sheet_\d+\.jpg$/.test(n)).forEach(n => fs.unlinkSync(path.join(OUT, n)));
    for (let g = 0; g < pages; g++) {
      const cells = RECIPES.slice(g * per, g * per + per).map(r => `<div class="c"><img src="file://${OUT}/${r.id}.jpg"><b>${r.id} · ${r.name}</b><i>${r.function || ''}</i></div>`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>html,body{width:2000px;height:auto;overflow:visible;background:#E9E3D6}body{padding:40px;font-family:var(--f-cn);color:var(--char)}
h1{font:400 56px/1 var(--f-disp);margin:0 0 8px}p{margin:0 0 28px;font-size:22px;opacity:.6}
.g{display:grid;grid-template-columns:1fr 1fr;gap:34px 40px}.c img{width:100%;display:block;border-radius:14px}.c b{display:block;font-size:26px;margin-top:10px}.c i{display:block;font-style:normal;font-size:20px;opacity:.6;margin-top:4px}</style></head>
<body><h1>知识卡片 · 配方预览 ${g + 1} / ${pages}</h1><p>配方表 cards/recipes/recipes.json 的示例镜头 · 内容为示意，图片为风格样张（不进正片）</p><div class="g">${cells}</div></body></html>`;
      const hf = path.join(TMP, `sheet_${g + 1}.html`); fs.writeFileSync(hf, html);
      const sp = await b.newPage({ viewport: { width: 2000, height: 800 } }); await sp.goto('file://' + hf); await sp.waitForTimeout(300);
      await sp.screenshot({ path: path.join(OUT, `sheet_${g + 1}.jpg`), fullPage: true, type: 'jpeg', quality: 80 }); await sp.close();
    }
    fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n');
  }
  await b.close();
  console.log(report.join('\n'));
  if (report.some(l => l.includes('✗'))) process.exit(1);
})();
