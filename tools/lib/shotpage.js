// 生成一个镜头页面（engine/shot.js 挂载）：预览、渲染、AE 导出共用。页面以仓库根目录为 base。
// const html = shotPage(ROOT, spec, layout, { extra: '<style>…</style>', chapterZone: true, idtag: 'L-K01 · 票据档位' })
// 页面上：window.H = 镜头句柄；window.renderAt(t)；window.SETTLED = 全部入场完成的时间点；window.ERRS = 放不下 / 溢出
module.exports = function shotPage(ROOT, spec, layout, o) {
  o = o || {};
  return `<!doctype html><html><head><meta charset="utf-8"><base href="file://${ROOT}/">
<link rel="stylesheet" href="engine/tokens.css"><link rel="stylesheet" href="engine/base.css">
<link rel="stylesheet" href="engine/motion/motion.css"><link rel="stylesheet" href="cards/infocards/infocards.css"><link rel="stylesheet" href="engine/shot.css">
${spec.sc ? '<link rel="stylesheet" href="libs/screencast/screencast.css">' : ''}
<script src="engine/motion/tokens.js"></script><script src="engine/motion/motion.js"></script><script src="libs/icons/icons.js"></script>
<script src="cards/infocards/infocards.js"></script><script src="libs/backgrounds/backgrounds.js"></script>${spec.sc ? '<script src="libs/screencast/screencast.js"></script>' : ''}
<script src="engine/shot.js"></script>
<style>.idtag{position:absolute;right:64px;bottom:20px;font:500 18px/1 var(--f-mono);letter-spacing:.16em;color:var(--s-title);opacity:.38;z-index:70}</style>${o.extra || ''}
</head><body><section class="frame" id="fr"></section><script>
const fr = document.getElementById('fr');
window.H = SHOT.mount(fr, ${JSON.stringify(spec)}, ${JSON.stringify(layout)});
window.renderAt = t => SHOT.renderAt(H, t);
window.SETTLED = SHOT.settled(H);
${o.idtag ? `{ const e = document.createElement('div'); e.className = 'idtag'; e.textContent = ${JSON.stringify(o.idtag)}; fr.appendChild(e); }` : ''}
${o.chapterZone ? `{ const e = document.createElement('div'); e.className = 'chapter-zone'; fr.appendChild(e); }` : ''}
window.ERRS = H.errs;
window.ready = async () => { await Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]); window.ERRS = SHOT.check(H); };
</script></body></html>`;
};
