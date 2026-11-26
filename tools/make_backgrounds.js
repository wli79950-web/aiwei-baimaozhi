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

// 底板
const plates = {
  'BG1_char_plate.png': `radial-gradient(circle at 72% 46%,${C.char_hi} 0,${C.char} 58%,${C.char_lo} 100%)`,
  'BG2_cream_plate.png': C.cream,
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
  console.log('layers/BG1_radar_lines.svg, BG1_radar_sweep.svg, BG2_radar_lines.svg');
})();
