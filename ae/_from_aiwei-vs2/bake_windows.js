// 把录屏窗口（换帧 + 推镜 + 圈画 + 荧光笔 + 模糊脱敏）按 HTML 时间轴逐帧烘焙成窗口视频，供 AE 包使用。
// 用法（在 engine/ 目录下运行）：node ../ae/bake_windows.js job.json
// job.json: {page, out, fps, win:{x,y,w,h}, fams:[{file, shots:[id...], t0, t1}]}  —— 每个子镜头的窗口元素 id 为 <shot>win
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const { execFileSync } = require('child_process');
(async () => {
  const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const FPS = J.fps || 30, W = J.win || { x: 540, y: 250, w: 1120, h: 630 };
  fs.mkdirSync(J.out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(J.page)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1000);
  for (const F of J.fams) {
    const tmp = path.join(J.out, '_bake_' + F.file.replace(/\.mp4$/, '')); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    const n = Math.round((F.t1 - F.t0) * FPS);
    for (let f = 0; f < n; f++) {
      const t = F.t0 + f / FPS;
      await p.evaluate(t => window.renderAt(t), t);
      await p.evaluate(ids => {
        const vis = ids.filter(id => document.getElementById(id).style.visibility === 'visible'); const cur = vis.length ? vis[vis.length - 1] : ids[0];
        const st = document.createElement('style'); st.id = 'bkst';
        st.textContent = `#hud,#px{visibility:hidden!important} .shot *{visibility:hidden!important} #${cur}win,#${cur}win *{visibility:visible!important}`;
        document.head.appendChild(st);
        document.querySelectorAll('.shot').forEach(s => { s.dataset.v = s.style.visibility; s.style.visibility = s.id === cur ? 'visible' : 'hidden'; s.style.clipPath = 'none'; });
        const sh = document.getElementById(cur); sh.querySelector('.inner').style.transform = 'none';
        const w = document.getElementById(cur + 'win'); w.dataset.tf = w.style.transform; w.style.transform = 'none'; w.style.borderRadius = '0'; w.style.boxShadow = 'none';
      }, F.shots);
      await p.screenshot({ path: path.join(tmp, String(f + 1).padStart(5, '0') + '.png'), clip: { x: W.x, y: W.y, width: W.w, height: W.h } });
      await p.evaluate(() => { document.getElementById('bkst').remove(); document.querySelectorAll('.rwin').forEach(w => { w.style.borderRadius = ''; w.style.boxShadow = ''; }); });
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(tmp, '%05d.png'), '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', '-pix_fmt', 'yuv420p', path.join(J.out, F.file)]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(F.file, n, 'frames');
  }
  await b.close();
})();
