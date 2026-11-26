// 从 HTML 时间轴截取 AE 素材：每个镜头的背景板（整张 1920×1080）+ 指定元素的透明 PNG 和它在画面里的位置。
// 用法（在 engine/ 目录下运行，才能找到 playwright）：node ../ae/html_capture.js jobs.json
// jobs.json: {page, out, jobs:[{shot, plate:{t,file}|null, items:[{id|sel, t, file, excl:[id...], flat:[id...], keep:bool}]}]}
// 输出 <out>/capture.json：{ file: {x,y,w,h} }，坐标为 1920×1080 画面坐标（镜头运动已去掉，元素自身的入场位移已去掉）。
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); fs.mkdirSync(J.out, { recursive: true });
  const metaPath = path.join(J.out, 'capture.json'); const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(J.page)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  await p.addScriptTag({ path: path.join(__dirname, 'page_text.js') });
  for (const job of J.jobs) {
    if (job.plate) {
      await p.evaluate(t => window.renderAt(t), job.plate.t);
      await p.evaluate(shot => {
        const st = document.createElement('style'); st.id = 'capst';
        st.textContent = `#hud,#px{visibility:hidden!important} .shot .inner > *:not(.grid):not(.contours):not(.grain):not(.pattern){visibility:hidden!important}`;
        document.head.appendChild(st);
        document.querySelectorAll('.shot').forEach(s => { s.style.visibility = s.id === shot ? 'visible' : 'hidden'; s.style.clipPath = 'none'; s.style.zIndex = s.id === shot ? 50 : 1; });
        document.getElementById(shot).querySelector('.inner').style.transform = 'none';
      }, job.shot);
      await p.screenshot({ path: path.join(J.out, job.plate.file), type: 'jpeg', quality: 92 });
      await p.evaluate(() => { document.getElementById('capst').remove(); });
    }
    for (const it of job.items || []) {
      await p.evaluate(t => window.renderAt(t), it.t);
      const r = await p.evaluate(([shot, it]) => {
        const $ = id => document.getElementById(id);
        const st = document.createElement('style'); st.id = 'capst';
        st.textContent = `html,body,#stage{background:transparent!important} #hud,#px{visibility:hidden!important} .shot{background:transparent!important}
          .shot *{visibility:hidden!important} [data-cap],[data-cap] *{visibility:visible!important} [data-capx],[data-capx] *{visibility:hidden!important}`;
        document.head.appendChild(st);
        document.querySelectorAll('.shot').forEach(s => { s.style.visibility = s.id === shot ? 'visible' : 'hidden'; s.style.clipPath = 'none'; s.style.zIndex = s.id === shot ? 50 : 1; });
        const S = $(shot), inner = S.querySelector('.inner'); inner.style.transform = 'none';
        const E = it.id ? $(it.id) : (it.sel === '.inner' ? inner : S.querySelector(it.sel)); if (!E) return { err: 'missing ' + (it.id || it.sel) };
        E.setAttribute('data-cap', ''); (it.excl || []).forEach(x => $(x) && $(x).setAttribute('data-capx', '')); (it.exclSel || []).forEach(q => S.querySelectorAll(q).forEach(e => e.setAttribute('data-capx', '')));
        const saved = [];
        for (let x = E; x && x !== inner; x = x.parentElement) {
          // 元素保持截图时刻的静止姿态（含设计里的旋转、居中位移），只把透明度 / 模糊去掉
          saved.push([x, x.style.transform, x.style.opacity, x.style.filter]);
          x.style.opacity = '1'; x.style.filter = 'none';
        }
        /* flat：截图时把这些元素的变换去掉（2.5D 场景的摄像机变换、弹窗自身的 z 位移），截到的是正对镜头的平面图，3D 交给 AE 的摄像机 */
        (it.flat || []).forEach(id => { const f = $(id); if (!f) return; saved.push([f, f.style.transform, f.style.opacity, f.style.filter]); f.style.transform = 'none'; f.style.opacity = '1'; });
        E.querySelectorAll('.ch').forEach(c => { c.style.opacity = 1; c.style.filter = 'none'; c.style.transform = 'none'; });
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        [E, ...E.querySelectorAll('*')].forEach(el => {
          if (el.closest('[data-capx]')) return; const R = el.getBoundingClientRect(); if (R.width < 1 || R.height < 1) return;
          x0 = Math.min(x0, R.left); y0 = Math.min(y0, R.top); x1 = Math.max(x1, R.right); y1 = Math.max(y1, R.bottom); });
        let texts = [];
        if (!it.rasterText) { texts = window.__texts(E, inner); const st2 = document.createElement('style'); st2.id = 'capst2';
          st2.textContent = '[data-cap],[data-cap] *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}'; document.head.appendChild(st2); }
        const pad = it.pad === undefined ? 40 : it.pad;
        x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(1920, Math.ceil(x1 + pad)); y1 = Math.min(1080, Math.ceil(y1 + pad));
        window.__capUndo = () => { st.remove(); const s2 = document.getElementById('capst2'); if (s2) s2.remove(); E.removeAttribute('data-cap'); document.querySelectorAll('[data-capx]').forEach(e => e.removeAttribute('data-capx'));
          saved.forEach(([el, tf, op, fl]) => { el.style.transform = tf; el.style.opacity = op; el.style.filter = fl; }); };
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, texts };
      }, [job.shot, it]);
      if (r.err) { console.log('ERR', r.err); errs.push(r.err); continue; }
      if (!(r.w > 0 && r.h > 0)) { console.log('ERR empty box', job.shot, it.id || it.sel, it.t); errs.push('empty ' + (it.id || it.sel)); await p.evaluate(() => window.__capUndo()); continue; }
      await p.screenshot({ path: path.join(J.out, it.file), omitBackground: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
      await p.evaluate(() => window.__capUndo());
      meta[it.file] = r;
    }
    console.log('shot', job.shot, (job.items || []).length, 'items');
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 0));
  if (errs.length) console.log('ERRORS', errs.slice(0, 5));
  await b.close();
})();
