// 线性图标库：从 Lucide（ISC 许可）挑一批和网安 / 挖洞相关的图标，生成 libs/icons/icons.js（全局 ICONS，name → SVG 字符串）
// 用法：node tools/make_icons.js     （先 npm i；要加图标就往 LIST 里加名字再跑一次）
// 图标描边跟随 currentColor，线宽 1.75；网页里内联使用，AE 包里导出单个 SVG（P6）。
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'node_modules/lucide-static/icons'), OUT = path.join(ROOT, 'libs/icons');
const LIST = ['lock', 'lock-open', 'key-round', 'shield', 'shield-check', 'shield-alert', 'bug', 'cpu', 'server', 'database', 'globe', 'monitor', 'laptop',
  'smartphone', 'file', 'file-text', 'file-check', 'folder', 'search', 'search-check', 'scan-search', 'radar', 'terminal', 'code', 'braces', 'link', 'wifi',
  'user-round', 'users', 'user-x', 'building-2', 'hourglass', 'clock', 'bell', 'mail', 'flag', 'target', 'crosshair', 'eye', 'eye-off', 'fingerprint',
  'ticket', 'coins', 'badge-check', 'check', 'x', 'circle-x', 'circle-check', 'triangle-alert', 'arrow-right', 'git-branch', 'layers', 'network', 'cloud',
  'zap', 'sparkles', 'bot', 'list-checks', 'clipboard-check', 'camera', 'image', 'message-square', 'package', 'wrench', 'door-open', 'repeat', 'pencil', 'award'];
const out = {}, miss = [];
for (const n of LIST) {
  const f = path.join(SRC, n + '.svg'); if (!fs.existsSync(f)) { miss.push(n); continue; }
  const inner = fs.readFileSync(f, 'utf8').replace(/<!--.*?-->/s, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  out[n] = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}
if (miss.length) { console.error('Lucide 里没有：' + miss.join('、')); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'icons.js'), `/* libs/icons/icons.js — 自动生成：node tools/make_icons.js。不要手改。
 * 图标来自 Lucide（ISC 许可，见 LICENSE-lucide.txt），描边跟随 currentColor。共 ${Object.keys(out).length} 个。 */
(function (root) { var ICONS = ${JSON.stringify(out, null, 1)};
  if (typeof module === 'object' && module.exports) module.exports = ICONS; else root.ICONS = ICONS; })(typeof self !== 'undefined' ? self : this);
`);
fs.copyFileSync(path.join(ROOT, 'node_modules/lucide-static/LICENSE'), path.join(OUT, 'LICENSE-lucide.txt'));
console.log('libs/icons/icons.js：' + Object.keys(out).length + ' 个图标');
