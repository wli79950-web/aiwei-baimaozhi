// 采样录屏窗口的动画数据（不截图）：每帧读出 录屏当前帧号 → 原视频时间、推镜的位移 / 缩放、窗口里各圈画元素（红框 / 荧光笔 / 脱敏条）的位置尺寸透明度。
// 供 AE 包生成「时间重映射 + 缩放位置关键帧 + 形状层」用。
// 用法（在 engine/ 目录下运行）：node ../ae/sample_windows.js job.json
// job.json: {page, out, fps, fams:[{name, shots:[id...], t0, t1}]}
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const J = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const FPS = J.fps || 30;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(J.page)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const res = fs.existsSync(J.out) ? JSON.parse(fs.readFileSync(J.out, 'utf8')) : {};
  for (const F of J.fams) {
    const S = { t: [], src: [], still: null, tx: [], ty: [], s: [], ov: {} };
    const n = Math.round((F.t1 - F.t0) * FPS);
    for (let f = 0; f <= n; f++) {
      const t = F.t0 + f / FPS;
      await p.evaluate(t => window.renderAt(t), t);
      const d = await p.evaluate(ids => {
        const vis = ids.filter(id => document.getElementById(id).style.visibility === 'visible'); const cur = vis.length ? vis[vis.length - 1] : ids[0];
        const w = document.getElementById(cur + 'win'), img = w.querySelector('img.v'), src = img.getAttribute('src');
        const m = src.match(/\/(\d+)\.jpg$/); const tf = img.style.transform || '';
        const tt = tf.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/), sc = tf.match(/scale\(([-\d.e]+)\)/);
        const ov = {};
        [...w.children].forEach(c => { if (c === img || !c.id) return; const cs = getComputedStyle(c); const st = c.style;
          const key = c.id.slice(cur.length); const tfm = st.transform || ''; const sx = tfm.match(/scaleX\(([-\d.e]+)\)/), s1 = tfm.match(/scale\(([-\d.e]+)\)/);
          ov[key] = { cls: c.className, x: parseFloat(st.left) || 0, y: parseFloat(st.top) || 0, w: parseFloat(st.width) || 0, h: parseFloat(st.height) || 0,
            o: parseFloat(cs.opacity), sx: sx ? parseFloat(sx[1]) : 1, s: s1 ? parseFloat(s1[1]) : 1, bg: cs.backgroundColor, bd: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth) || 0 }; });
        return { frame: m ? parseInt(m[1]) : null, still: m ? null : src, tx: tt ? +tt[1] : 0, ty: tt ? +tt[2] : 0, s: sc ? +sc[1] : 1, ov };
      }, F.shots);
      S.t.push(+(f / FPS).toFixed(4)); S.src.push(d.frame === null ? null : (d.frame - 1) / 30); if (d.still) S.still = d.still;
      S.tx.push(d.tx); S.ty.push(d.ty); S.s.push(d.s);
      Object.entries(d.ov).forEach(([k, v]) => { const O = S.ov[k] || (S.ov[k] = { cls: v.cls, bg: v.bg, bd: v.bd, bw: v.bw, t: [], x: [], y: [], w: [], h: [], o: [], sx: [], s: [] });
        O.t.push(+(f / FPS).toFixed(4)); ['x', 'y', 'w', 'h', 'o', 'sx', 's'].forEach(q => O[q].push(v[q])); });
    }
    res[F.name] = S; console.log(F.name, n + 1, 'samples', Object.keys(S.ov).join(','));
  }
  fs.writeFileSync(J.out, JSON.stringify(res)); await b.close();
})();
