// 由 tokens/brand.json 生成背景板库：底板（1920×1080 PNG）+ 动态层（SVG，透明底，AE 里可隐藏 / 替换 / 做动画）
// 用法：node tools/make_backgrounds.js      （在仓库根目录运行；改了 brand.json 的颜色或雷达参数后重跑）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens/brand.json'), 'utf8'));
const C = Object.fromEntries(Object.entries(B.color).map(([k, v]) => [k, v.hex]));
const R = B.background.radar, W = B.spec.w, H = B.spec.h;
const P = path.join(ROOT, 'libs/backgrounds/plates'), L = path.join(ROOT, 'libs/backgrounds/layers');
fs.mkdirSync(P, { recursive: true }); fs.mkdirSync(L, { recursive: true });

// 动态层：雷达线（圆环 + 十字轴）
const rings = (color, op) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g fill="none" stroke="${color}" stroke-width="2" opacity="${op}">
    ${R.rings.map(r => `<circle cx="${R.cx}" cy="${R.cy}" r="${r}"/>`).join('\n    ')}
    <line x1="${R.cx - 560}" y1="${R.cy}" x2="${R.cx + 560}" y2="${R.cy}"/>
    <line x1="${R.cx}" y1="${R.cy - 500}" x2="${R.cx}" y2="${R.cy + 500}"/>
  </g>
</svg>\n`;
// 动态层：扫描扇区（单独一层，AE 里绕 (cx,cy) 旋转即可做扫掠）
const rOut = Math.max(...R.rings), [a0, a1] = R.sweep_deg.map(d => (d - 90) * Math.PI / 180);
const pt = a => `${(R.cx + rOut * Math.cos(a)).toFixed(1)} ${(R.cy + rOut * Math.sin(a)).toFixed(1)}`;
const sweep = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <path d="M${R.cx} ${R.cy} L${pt(a0)} A${rOut} ${rOut} 0 0 1 ${pt(a1)} Z" fill="${C.orange}" fill-opacity="${R.sweep_opacity}"/>
</svg>\n`;
fs.writeFileSync(path.join(L, 'BG1_radar_lines.svg'), rings(C.cream, B.scene.A.line.opacity));
fs.writeFileSync(path.join(L, 'BG1_radar_sweep.svg'), sweep);
fs.writeFileSync(path.join(L, 'BG2_radar_lines.svg'), rings(C.char, B.scene.B.line.opacity));

// BG3 炭黑·工作台（1.5）：点阵（径向淡出）+ 十字标；焦点组件（光晕 / 刻度环 / 刻度）是可移动的独立层
const K = B.background.bench, F = K.focus, svgOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
const [frx, fry, fcx, fcy] = K.fade, ecx = W * fcx, ecy = H * fcy, erx = W * frx, ery = H * fry;   // 椭圆淡出：半径 75% × 70%，中心 (50%, 46%)
fs.writeFileSync(path.join(L, 'BG3_dots.svg'), `${svgOpen(W, H)}
  <defs>
    <pattern id="d" x="-${K.grid / 2}" y="-${K.grid / 2}" width="${K.grid}" height="${K.grid}" patternUnits="userSpaceOnUse"><circle cx="${K.grid / 2}" cy="${K.grid / 2}" r="${K.dot_r}" fill="${C.cream}" fill-opacity="${K.dot_opacity}"/></pattern>
    <radialGradient id="f" gradientUnits="userSpaceOnUse" cx="${ecx}" cy="${ecy}" r="${erx}" gradientTransform="translate(${ecx} ${ecy}) scale(1 ${(ery / erx).toFixed(4)}) translate(${-ecx} ${-ecy})"><stop offset="0.3" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/></mask>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#d)" mask="url(#m)"/>
</svg>\n`);
fs.writeFileSync(path.join(L, 'BG3_marks.svg'), `${svgOpen(W, H)}
  <g stroke="${C.cream}" stroke-opacity="${K.mark_opacity}" stroke-width="1.5">
    ${K.marks.map(([x, y]) => `<line x1="${x - K.mark_len / 2}" y1="${y}" x2="${x + K.mark_len / 2}" y2="${y}"/><line x1="${x}" y1="${y - K.mark_len / 2}" x2="${x}" y2="${y + K.mark_len / 2}"/>`).join('\n    ')}
  </g>
</svg>\n`);
const c0 = F.canvas / 2;
fs.writeFileSync(path.join(L, 'BG3_focus_glow.svg'), `${svgOpen(F.canvas, F.canvas)}
  <defs><radialGradient id="g">${F.glow_stops.map(([o, a]) => `<stop offset="${o * 0.7}" stop-color="${C.orange}" stop-opacity="${a}"/>`).join('')}</radialGradient></defs>
  <circle cx="${c0}" cy="${c0}" r="${F.glow_r / 0.7}" fill="url(#g)"/>
</svg>\n`);
fs.writeFileSync(path.join(L, 'BG3_focus_rings.svg'), `${svgOpen(F.canvas, F.canvas)}
  <g fill="none" stroke="${C.cream}" stroke-width="1.5">
    ${F.rings.map((r, i) => `<circle cx="${c0}" cy="${c0}" r="${r}" stroke-opacity="${(F.ring_opacity * (1 - i * 0.18)).toFixed(3)}"/>`).join('\n    ')}
  </g>
</svg>\n`);
fs.writeFileSync(path.join(L, 'BG3_focus_ticks.svg'), `${svgOpen(F.canvas, F.canvas)}
  <g stroke="${C.cream}" stroke-opacity="${F.tick_opacity}" stroke-width="1.5">
    ${Array.from({ length: F.ticks }, (_, i) => { const a = i / F.ticks * Math.PI * 2, L2 = i % F.tick_major_every ? F.tick_len : F.tick_len * 2, c = Math.cos(a), s = Math.sin(a);
      return `<line x1="${(c0 + c * F.ticks_r).toFixed(1)}" y1="${(c0 + s * F.ticks_r).toFixed(1)}" x2="${(c0 + c * (F.ticks_r - L2)).toFixed(1)}" y2="${(c0 + s * (F.ticks_r - L2)).toFixed(1)}"/>`; }).join('\n    ')}
  </g>
</svg>\n`);

// 底板
const plates = {
  'BG1_char_plate.png': `radial-gradient(circle at 72% 46%,${C.char_hi} 0,${C.char} 58%,${C.char_lo} 100%)`,
  'BG2_cream_plate.png': C.cream,
  'BG3_bench_plate.png': `radial-gradient(ellipse at 50% 42%,${C.char_hi} 0,${C.char} 62%,${C.char_lo} 100%)`,
  'FX_orange.png': C.orange,
  'FX_klein.png': C.klein,
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  for (const [f, bg] of Object.entries(plates)) {
    await p.setContent(`<html><body style="margin:0;width:${W}px;height:${H}px;background:${bg}"></body></html>`);
    await p.screenshot({ path: path.join(P, f) }); console.log('plates/' + f);
  }
  await b.close();
  console.log('layers/BG1_radar_lines.svg, BG1_radar_sweep.svg, BG2_radar_lines.svg, BG3_dots.svg, BG3_marks.svg, BG3_focus_glow.svg, BG3_focus_rings.svg, BG3_focus_ticks.svg');
})();
