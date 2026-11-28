// BM01 分镜关键帧：每个镜头取「全部入场完成」那一帧（和 AE 导出同一帧），另出总览板和手机竖屏模拟。
// 用法（仓库根目录）：node episodes/BM01_AI挖洞流水线/storyboard.js [镜头号…]
// 产物：episodes/BM01_AI挖洞流水线/out/storyboard/（不进 git）
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const EP = __dirname, ROOT = path.resolve(EP, '../..');
const shotPage = require(path.join(ROOT, 'tools/lib/shotpage.js'));
const E = JSON.parse(fs.readFileSync(path.join(EP, 'episode.json'), 'utf8'));
const OUT = path.join(EP, 'out', 'storyboard'), TMP = path.join(OUT, 'html'); fs.mkdirSync(TMP, { recursive: true });
const only = process.argv.slice(2);
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));
const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
(async () => {
  const b = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--disable-gpu'] } : {}), report = [];
  for (const s of E.shots) {
    if (only.length && !only.includes(s.id)) continue;
    let html = shotPage(ROOT, s, LAYOUT(s.layout), { chapterZone: true, idtag: `${s.id} · ${s.layout} · ${fmt(s.t0)}–${fmt(s.t0 + s.dur)}` });
    html = html.replace(/<base href="[^"]*">/, `<base href="${pathToFileURL(ROOT).href}/">`);
    const f = path.join(TMP, s.id + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }), pe = [], fails = [];
    p.on('pageerror', e => pe.push(e.message));
    p.on('requestfailed', r => fails.push(decodeURIComponent(r.url()).slice(-90)));
    await p.goto(pathToFileURL(f).href); await p.evaluate(() => window.ready());
    const errs = await p.evaluate(() => window.ERRS); let T = await p.evaluate(() => window.SETTLED);
    // 录屏镜头：关键帧取推镜 / 标注都出现之后（AE 导出仍取 settled）
    if (s.sc) { const S = s.sc.spec, ats = [...(S.push || []).map(k => k.at + k.dur), ...(S.ann || []).map(a => a.at + 0.6)]; if (ats.length) T = Math.min(s.dur - 0.05, Math.max(T, ...ats)); }
    await p.evaluate(t => window.renderAt(t), T); await p.waitForTimeout(120);
    await p.screenshot({ path: path.join(OUT, s.id + '.png') });
    await p.close();
    const all = [...errs, ...pe.map(e => '页面错误 ' + e), ...fails.map(u => '加载失败 ' + u)];
    report.push(`${s.id}\t${s.layout}\t${fmt(s.t0)}\t${s.dur}s\tsettled ${T.toFixed(2)}s\t${all.length ? '✗ ' + all.join('；') : '✓'}`);
    console.log(report[report.length - 1]);
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n'));
})();
