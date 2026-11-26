/* 注入到 HTML 页面里：字体名映射、颜色转换、文字块提取（html_capture.js 用） */
  window.__psName = (fam, w) => { fam = (fam || '').toLowerCase(); w = parseInt(w) || 400;
    /* 2.2 新字体：按字体栈第一项判断（栈里都带 Noto 回退，所以必须排在 Noto 判断前面） */
    if (fam.indexOf('youshebiaotihei') >= 0) return 'YouSheBiaoTiHei';
    if (fam.indexOf('tinos') >= 0) return w >= 700 ? 'Tinos-BoldItalic' : 'Tinos-Italic';
    if (fam.indexOf('arimo') >= 0) return 'Arimo-BoldItalic';
    if (fam.indexOf('courier prime') >= 0) return 'CourierPrime-Bold';
    if (fam.indexOf('caveat') >= 0) return 'Caveat-Bold';
    if (fam.indexOf('jetbrains') >= 0) return w >= 700 ? 'JetBrainsMono-Bold' : (w >= 500 ? 'JetBrainsMono-Medium' : 'JetBrainsMono-Regular');
    if (fam.indexOf('space grotesk') >= 0) return w >= 700 ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Medium';
    if (fam.indexOf('serif') >= 0 && fam.indexOf('sans') < 0 && fam.indexOf('noto serif') >= 0) return w >= 800 ? 'NotoSerifSC-Black' : 'NotoSerifSC-Bold';
    return w >= 800 ? 'NotoSansSC-Black' : (w >= 600 ? 'NotoSansSC-Bold' : (w >= 450 ? 'NotoSansSC-Medium' : 'NotoSansSC-Regular')); };
  window.__hex = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return ['#141414', 1]; const v = m[1].split(',').map(x => parseFloat(x));
    return ['#' + v.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join(''), v.length > 3 ? v[3] : 1]; };
  /* 提取 E 内的文字块：返回 [{text, align, size, lead, x, y, rot, pivot, op, runs:[{s,e,font,color,size,track}]}] */
  window.__texts = (E, inner) => {
    const isInl = el => { const d = getComputedStyle(el).display; if (!d.startsWith('inline')) return false; if (/^(IMG|SVG|CANVAS|VIDEO)$/i.test(el.tagName)) return false;
      return ![...el.querySelectorAll('*')].some(c => { const dd = getComputedStyle(c).display; return !dd.startsWith('inline') && dd !== 'none'; }); };
    const blocks = [];
    /* 被截图的元素本身总是文字块的根（即使它是行内 span，如逐字浮现的标题） */
    const rootInl = isInl(E);
    const all = [E, ...(rootInl ? [] : [...E.querySelectorAll('*')].filter(el => !el.closest('[data-capx]') && !isInl(el) && !/^(svg|SVG|IMG|path|g|text)$/.test(el.tagName)))];
    const units = [];
    all.forEach(B => { const d = getComputedStyle(B).display;
      if (/flex|grid/.test(d)) { [...B.childNodes].forEach(c => { if (c.nodeType === 3 && c.textContent.trim()) units.push([B, [c]]); }); }
      else units.push([B, null]); });
    units.forEach(([B, only]) => {
      if (!(B === E || B.parentElement)) return;
      const chars = []; let hasText = false;
      const walk = n => { [...(only || n.childNodes)].forEach(c => {
        if (c.nodeType === 3) { if (c.textContent.trim()) hasText = true; [...c.textContent].forEach((ch, k) => chars.push({ node: c, k, ch, el: c.parentElement })); }
        else if (c.nodeType === 1) { if (c.tagName === 'BR') chars.push({ br: true }); else if (isInl(c) && !c.closest('[data-capx]')) walk(c); } }); };
      if (!B.getClientRects().length) return;   /* display:none（如参考线模式才显示的提示）不导出 */
      walk(B); if (!hasText) return;
      const cs = getComputedStyle(B); if (cs.visibility === 'hidden') return;
      /* 去掉旋转再量：记下累计角度和旋转中心 */
      let ang = 0, pivot = null; const undo = [];
      for (let x = B; x && x !== inner; x = x.parentElement) { const t = getComputedStyle(x).transform; if (!t || t === 'none') continue;
        const m = new DOMMatrix(t); const a = Math.atan2(m.b, m.a) * 180 / Math.PI; if (Math.abs(a) < 0.05) continue;
        if (!pivot) { const R = x.getBoundingClientRect(); pivot = [R.left + R.width / 2, R.top + R.height / 2]; }
        ang += a; const sc = Math.hypot(m.a, m.b); undo.push([x, x.style.transform]); x.style.transform = 'translate(' + m.e + 'px,' + m.f + 'px) scale(' + sc + ')'; }
      if (pivot && undo.length) { /* 旋转中心以最外层旋转元素为准 */ const R = undo[undo.length - 1][0].getBoundingClientRect(); pivot = [R.left + R.width / 2, R.top + R.height / 2]; }
      /* 基线 = 第一个字的字形框顶 + 该字体的上行高度（不往 DOM 里插元素，弹性布局里也不会改排版） */
      const first = chars.find(c => !c.br && c.ch.trim()); if (!first) return;
      const fr = document.createRange(); fr.setStart(first.node, first.k); fr.setEnd(first.node, first.k + 1); const FR = fr.getBoundingClientRect();
      const fst = getComputedStyle(first.el); const cv = window.__cv || (window.__cv = document.createElement('canvas').getContext('2d'));
      cv.font = fst.fontWeight + ' ' + fst.fontSize + ' ' + fst.fontFamily; const base0 = FR.top + cv.measureText(first.ch).fontBoundingBoxAscent;
      const alphas = []; let text = '', lines = [], prevTop = null, runs = [], lineLeft = null, lineRight = null, lefts = [], rights = [];
      const size0 = parseFloat(cs.fontSize);
      chars.forEach(c => {
        if (c.br) { text += '\r'; lefts.push(lineLeft); rights.push(lineRight); lineLeft = lineRight = null; prevTop = null; return; }
        const r = document.createRange(); r.setStart(c.node, c.k); r.setEnd(c.node, c.k + 1); const R = r.getBoundingClientRect();
        if (c.ch === ' ' && (R.width === 0 || R.height === 0)) { text += ' '; return; }
        const st = getComputedStyle(c.el); const fs = parseFloat(st.fontSize);
        if (prevTop !== null && R.height > 0 && R.top > prevTop + fs * 0.6) { text = text.replace(/ $/, ''); text += '\r'; lefts.push(lineLeft); rights.push(lineRight); lineLeft = lineRight = null; }
        if (R.height > 0) { prevTop = R.top; lineLeft = lineLeft === null ? R.left : Math.min(lineLeft, R.left); lineRight = lineRight === null ? R.right : Math.max(lineRight, R.right); }
        let ch = c.ch; if (st.textTransform === 'uppercase') ch = ch.toUpperCase();
        /* 行内元素此刻不可见（透明度为 0 / visibility:hidden，例如还没轮到出现的字）：输出空格占位，等宽排版下后面的字位置不变 */
        for (let x = c.el; x && x !== B; x = x.parentElement) { const xs = getComputedStyle(x); if (xs.visibility === 'hidden' || parseFloat(xs.opacity) < 0.02) { ch = ' '; break; } }
        let fillC = st.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)/.test(st.webkitTextFillColor) ? st.webkitTextFillColor : st.color;
        if (/rgba\(0, 0, 0, 0\)/.test(fillC)) fillC = 'rgb(230,227,221)';
        const [col, ca] = window.__hex(fillC); alphas.push(ca); const ls = st.letterSpacing === 'normal' ? 0 : parseFloat(st.letterSpacing);
        const run = { font: window.__psName(st.fontFamily, st.fontWeight), color: col, size: Math.round(fs * 10) / 10, track: Math.round(ls / fs * 1000) };
        const i = text.length; text += ch; const last = runs[runs.length - 1];
        if (last && last.e === i && last.font === run.font && last.color === run.color && last.size === run.size && last.track === run.track) last.e = i + 1; else runs.push(Object.assign({ s: i, e: i + 1 }, run));
      });
      lefts.push(lineLeft); rights.push(lineRight);
      undo.reverse().forEach(([x, t]) => x.style.transform = t);
      text = text.replace(/\s+$/, ''); if (!text.trim()) return;
      runs = runs.filter(r => r.s < text.length); runs.forEach(r => { if (r.e > text.length) r.e = text.length; });  /* 末尾空白裁掉后，分段同步裁剪 */
      let op = 1; for (let x = B; x && x !== E; x = x.parentElement) op *= parseFloat(getComputedStyle(x).opacity);
      if (alphas.length && alphas.every(v => Math.abs(v - alphas[0]) < 0.01)) op *= alphas[0]; if (op < 0.02) return;
      const lh = cs.lineHeight === 'normal' ? size0 * 1.2 : parseFloat(cs.lineHeight);
      const align = cs.textAlign === 'center' ? 'center' : (cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left');
      const L0 = lefts[0] ?? 0, R0 = rights[0] ?? L0; const x = align === 'center' ? (L0 + R0) / 2 : (align === 'right' ? R0 : L0);
      blocks.push({ text, align, size: size0, lead: Math.round(lh * 10) / 10, x: Math.round(x * 10) / 10, y: Math.round(base0 * 10) / 10, rot: Math.round(ang * 100) / 100, pivot, op: Math.round(op * 100) / 100, runs });
    });
    return blocks; };
  