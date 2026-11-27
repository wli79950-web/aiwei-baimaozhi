// 在页面里跑的检查（信息卡 .ic 和录屏标签 .sc-label 共用）：放得下、字号、实际渲染的字色 / 底色
// 用法：await page.evaluate(`(${pageCheck})(${args.map(a => JSON.stringify(a)).join(',')})`)，args = [色板, 禁用组合, 文字下限, 装饰下限, 对比下限, 每张卡装饰小字上限]
function pageCheck(palette, forbidden, textMin, decorMin, contrastMin, decorPerCard) {
  const P = Object.fromEntries(Object.entries(palette).map(([k, h]) => [k, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]));
  const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const parseCol = s => { s = String(s).trim(); if (s[0] === '#') return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat(1); return rgba(s); };
  const blend = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3]));
  const lum = c => { const l = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * l[0] + .7152 * l[1] + .0722 * l[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const near = (c, k) => P[k].every((v, i) => Math.abs(v - c[i]) <= 3);
  const nameOf = c => Object.keys(P).find(k => near(c, k));
  const opac = (e, stop) => { let o = 1; for (let x = e; x && x !== stop.parentElement; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  function bgOf(e) {   // 实际底色：往上找第一个不透明的底；色块（.blk）用它的扫入色
    const stack = [];
    for (let x = e; x; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (x.classList && (x.classList.contains('blk') || x.classList.contains('bm-sweep'))) { stack.push(parseCol((cs.getPropertyValue('--sweep') || '').trim() || cs.getPropertyValue('--s-blk'))); break; }
      const c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.999) break; }
      if (x.classList && (x.classList.contains('scene-A') || x.classList.contains('scene-B'))) {
        stack.push(parseCol(palette[x.classList.contains('scene-A') ? 'char' : 'cream'])); break;
      }
    }
    let b = stack.pop().slice(0, 3);
    while (stack.length) b = blend(stack.pop(), b);
    return b;
  }
  // 正在入场 / 退场的元素（BM.set 写的行内 opacity < 1，或 visibility: hidden）不查颜色：它们只在过渡中；CSS 里设计好的淡色仍然要查
  const inTransition = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { if (x.style && x.style.opacity !== '' && +x.style.opacity < 0.999) return true; if (getComputedStyle(x).visibility === 'hidden') return true; } return false; };
  const errs = [], used = new Set();
  document.querySelectorAll('.ic, .sc-label').forEach(ic => {
    const who = ic.dataset.label || ic.dataset.ic || ('录屏标签「' + ic.textContent.slice(0, 8) + '」');
    if (ic.classList.contains('ic') && ic.dataset.fit !== 'ok') errs.push(`${who}：放不下（字号缩到下限仍溢出，内容太长或槽位太小）`);
    let decor = 0;
    const els = [ic, ...ic.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    els.forEach(e => {
      const cs = getComputedStyle(e), fsz = parseFloat(cs.fontSize), isDecor = !!e.closest('[data-role="decor"]');
      const txt = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').slice(0, 12);
      if (isDecor) { decor++; if (fsz < decorMin) errs.push(`${who}「${txt}」：装饰字 ${fsz}px < ${decorMin}`); }
      else if (fsz < textMin - 0.5) errs.push(`${who}「${txt}」：${fsz}px < ${textMin}px`);
      const fc = rgba(cs.color); if (!fc || inTransition(e)) return;
      const a = fc[3] * opac(e, ic), bg = bgOf(e), fg = blend([fc[0], fc[1], fc[2], a], bg);
      const fn = nameOf(fc), bn = nameOf(bg);
      if (fn) used.add(fn); if (bn) used.add(bn);
      if (!bn) errs.push(`${who}「${txt}」：底色 rgb(${bg.map(Math.round)}) 不在色板里`);
      if (!fn) errs.push(`${who}「${txt}」：字色 ${cs.color} 不在色板里`);
      for (const [f, b, why] of forbidden) if (fn === f && bn === b) errs.push(`${who}「${txt}」：禁用组合 —— ${why}`);
      const r = ratio(fg, bg); if (!isDecor && r < contrastMin) errs.push(`${who}「${txt}」：对比 ${r.toFixed(2)} < ${contrastMin}`);
    });
    // 图解组件（.ic-dia）是一组元素，只算进每屏上限（由预览脚本查），不按单张卡算
    if (!ic.querySelector('.ic-dia') && decor > (decorPerCard || 1)) errs.push(`${who}：装饰小字 ${decor} 处，每张卡最多 ${decorPerCard || 1} 处`);
  });
  return { errs, used: [...used] };
}

module.exports = pageCheck;
