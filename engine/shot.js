/* engine/shot.js — 镜头运行时（P6，全局 SHOT）
 *
 * 一个镜头 = 排版（cards/layouts）+ 填充（信息卡 / 图片 / 文字）+ 背景板 + 丰富度元素 + 入场时间。
 * 网页预览、MP4 渲染、AE 导出都从同一份镜头描述出发，保证三者一致：
 *
 *   const h = SHOT.mount(section, spec, layout);       // spec 见下；layout = cards/layouts/<id>.json 的内容
 *   window.renderAt = t => SHOT.renderAt(h, t);         // 时间 t（秒）的纯函数（录屏镜头返回 Promise）
 *
 * spec = {
 *   id, layout: 'L-K08', scene: 'A' | 'B'（默认取排版的第一个场景）, dur: 4.0, out: 3.7（可省，统一退场）,
 *   fill: { 槽位 id: 填充 },     // {ic, data, tone, tilt, rect} 信息卡 / 图解 · {img, cls, pos, tilt} 图片 · {t, fs, cls} 文字 · {box} 纸面底卡 · null 空着
 *   cue: { 槽位 id: 入场秒 },   // 可省：按排版槽位顺序自动错开（0.2s 起，每个 +0.12s）
 *   deco: [[x, y, 装饰小字]], lines: [[x1, y1, x2, y2, hot]], co: [{from, to, label, en, hot}], amb: [[名, x, y, w, h, near|far]], bokeh: [[x, y, r]],
 *   sc: { slot: 's1', spec: 录屏组件 spec, base }（可省，录屏镜头）, focus: [x, y, scale]（可省，默认取第一个贴纸主体）, sub: '字幕（<em>关键词</em>）'
 * }
 * 每个画面元素登记成一个 unit（{el, kind, id, at}），AE 导出按 unit 拆层、按 at 加入场关键帧。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SHOT = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', T0 = 0.2, STEP = 0.12;
  var g = function (n) { return (typeof self !== 'undefined' && self[n]) || (typeof window !== 'undefined' && window[n]); };
  function md(s) {
    return String(s).replace(/\[\[(.+?)\]\]/g, '<span class="blk">$1</span>').replace(/\{\{(.+?)\}\}/g, '<span class="accent">$1</span>').replace(/~~(.+?)~~/g, '<span class="strk">$1</span>');
  }
  function add(frame, tag, cls, css, html) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; frame.appendChild(e); return e;
  }

  function mount(frame, spec, layout, opts) {
    var IC = g('IC'), BGLIB = g('BGLIB'), SC = g('SC'); opts = opts || {};
    var F = spec.fill || {}, scene = spec.scene || (layout.scene || ['A'])[0], units = [], errs = [];
    var reg = function (el, kind, id, at, extra) { var u = { el: el, kind: kind, id: id, at: at }; for (var k in extra || {}) u[k] = extra[k]; el.dataset.unit = units.length; units.push(u); return u; };
    // 焦点：A 场里第一个填了贴纸的媒体槽位（光晕 + 刻度环放在它后面）
    var focus = spec.focus || null;
    if (!focus && scene === 'A') layout.slots.some(function (s) {
      var f = F[s.id]; if (!f || !f.img || /photo/.test(f.cls || '') || s.type === 'group') return false;
      var r = f.rect || s.rect; focus = [r[0] + r[2] / 2, r[1] + r[3] / 2, Math.max(0.6, Math.min(1.5, Math.min(r[2], r[3]) / 560))]; return true;
    });
    var bg = BGLIB.mount(frame, scene === 'A' ? 'BG3' : 'BG2', opts.bgBase || 'libs/backgrounds/', focus ? { focus: focus } : {});
    // 入场时间：显式 cue，否则按槽位顺序错开
    var order = 0, at = {};
    layout.slots.forEach(function (s) { if (F[s.id]) at[s.id] = (spec.cue && spec.cue[s.id] != null) ? spec.cue[s.id] : T0 + STEP * order++; });
    var last = Math.max.apply(null, [T0].concat(Object.keys(at).map(function (k) { return at[k]; })));

    // 类别 3：光斑、氛围道具（压在内容下面）
    if (spec.bokeh && spec.bokeh.length) {
      var bw = add(frame, 'div', 'shot-bokeh', 'position:absolute;inset:0;pointer-events:none');
      spec.bokeh.forEach(function (b) { add(bw, 'div', 'bokeh', 'left:' + (b[0] - b[2]) + 'px;top:' + (b[1] - b[2]) + 'px;width:' + 2 * b[2] + 'px;height:' + 2 * b[2] + 'px'); });
      reg(bw, 'bokeh', 'bokeh', 0);
    }
    (spec.amb || []).forEach(function (a, i) {
      var e = add(frame, 'img', 'amb ' + a[5], 'left:' + a[1] + 'px;top:' + a[2] + 'px;width:' + a[3] + 'px;height:' + a[4] + 'px');
      e.src = (opts.imgBase || 'cards/images/samples/ambient/') + 'amb_' + a[0] + '.png'; reg(e, 'amb', 'amb' + (i + 1), 0, { name: a[0] });
    });
    if (spec.lines && spec.lines.length) {
      var sv = document.createElementNS(NS, 'svg'); sv.setAttribute('class', 'lines'); sv.setAttribute('width', 1920); sv.setAttribute('height', 1080);
      sv.innerHTML = spec.lines.map(function (l) { var lc = l[4] === 'aux' ? 'aux' : l[4] ? 'hot' : ''; return '<line class="' + lc + '" x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/><circle class="' + lc + '" cx="' + l[0] + '" cy="' + l[1] + '" r="5"/>'; }).join('');
      frame.appendChild(sv); reg(sv, 'lines', 'lines', last + 0.15);
    }

    // 槽位
    layout.slots.forEach(function (s) {
      var f = F[s.id]; if (!f) return;
      var r = f.rect || s.rect, pos = 'left:' + r[0] + 'px;top:' + r[1] + 'px;width:' + r[2] + 'px;height:' + r[3] + 'px', e;
      if (f.ic) {
        e = IC.render(f.ic, f.data, { rect: r, tone: f.tone, shape: s.shape, tilt: f.tilt }); e.dataset.label = s.id; frame.appendChild(e); IC.fit(e);
        reg(e, f.ic === 'title' ? 'title' : 'ic', s.id, at[s.id], { ic: f.ic, tilt: f.tilt || 0 }); return;
      }
      if (f.todo) { e = add(frame, 'div', 'todo', pos, '<b>待补组件</b>' + f.todo); reg(e, 'todo', s.id, at[s.id]); return; }
      if (f.box) { e = add(frame, 'div', 'box', pos); reg(e, 'box', s.id, at[s.id]); return; }
      if (f.img) {
        e = add(frame, 'img', f.cls === undefined ? 'stk' : f.cls, pos + (f.pos ? ';object-position:' + f.pos : '') + (f.tilt ? ';rotate:' + f.tilt + 'deg' : ''));
        e.src = f.img; reg(e, /photo/.test(f.cls || '') ? 'photo' : 'img', s.id, at[s.id], { tilt: f.tilt || 0, src: f.img }); return;
      }
      if (f.t != null) {
        if (/blkcell/.test(f.cls || '')) { e = add(frame, 'div', f.cls, pos + ';font-size:' + f.fs + 'px', ''); e.textContent = f.t; reg(e, 'lab', s.id, at[s.id]); return; }
        e = add(frame, 'div', 'lab ' + (f.cls || ''), pos + ';font-size:' + f.fs + 'px', '<div>' + md(f.t) + '</div>'); e.dataset.w = r[2]; e.dataset.h = r[3];
        reg(e, /\bmic\b/.test(f.cls || '') ? 'deco' : 'lab', s.id, at[s.id]);
      }
    });
    // 录屏
    var sch = null;
    if (spec.sc && SC) { sch = SC.shot(frame, spec.sc.spec, { base: spec.sc.base || '' }); reg(sch.win || frame.lastChild, 'sc', spec.sc.slot || 'sc', (spec.sc.spec.enter || {}).at || 0, { sc: spec.sc.spec }); }
    // 装饰小字、引线标注、字幕
    (spec.deco || []).forEach(function (d, i) { var e = add(frame, 'div', 'deco', 'left:' + d[0] + 'px;top:' + d[1] + 'px', null); e.dataset.role = 'decor'; e.textContent = d[2]; reg(e, 'deco', 'deco' + (i + 1), T0 + 0.1); });
    (spec.co || []).forEach(function (o, i) {
      var n0 = frame.childNodes.length, pill = IC.callout(frame, o), svg = frame.childNodes[n0];
      reg(pill, 'co', 'co' + (i + 1), last + 0.25, { svg: svg });
    });
    if (spec.sub) { var sb = add(frame, 'div', 'sub', 'z-index:50', spec.sub); reg(sb, 'sub', 'sub', 0); }
    return { frame: frame, spec: spec, layout: layout, bg: bg, units: units, sc: sch, errs: errs, scene: scene, focus: focus, last: last };
  }

  // 入场时间表：每个 unit 的入场动效（卡片内部的逐项入场由 IC.plan 给出）。网页 renderAt 和 AE 导出都读这一份。
  // 返回 [{u, fx, at, o, parts}]：fx 为 null 表示不动（氛围道具、光斑、字幕、录屏窗口自己管）；out 是统一退场时间（可无）
  function plan(h) {
    var IC = g('IC');
    return h.units.map(function (u) {
      if (u.kind === 'ic' || u.kind === 'title') { var P = IC.plan(u.el, { in: u.at, emph: u.at + 0.6 }); return { u: u, fx: P[0].fx, at: u.at, o: null, parts: P.slice(1) }; }
      if (u.kind === 'img') return { u: u, fx: 'drop', at: u.at, o: null, parts: [] };
      if (u.kind === 'amb' || u.kind === 'bokeh' || u.kind === 'sub' || u.kind === 'sc') return { u: u, fx: null, at: u.at, o: null, parts: [] };
      return { u: u, fx: 'rise', at: u.at, o: { dy: 24 }, parts: u.svg ? [{ el: u.svg, fx: 'rise', at: u.at, o: { dy: 0 }, i: 0, sibling: true }] : [] };
    });
  }
  // 时间 t 的画面：背景动态层 + 每个 unit 的入场 / 退场
  function renderAt(h, t) {
    var BM = g('BM'), IC = g('IC'), BGLIB = g('BGLIB'), SC = g('SC'), out = h.spec.out;
    BGLIB.animate(h.bg, t);
    plan(h).forEach(function (p) {
      var e = p.u.el, o = out != null ? BM.sink(t, out) : {};
      if (p.u.kind === 'ic' || p.u.kind === 'title') { IC.animate(e, t, { in: p.at, emph: p.at + 0.6, out: out }); return; }
      if (!p.fx) { if (out != null) BM.set(e, o); return; }
      BM.set(e, BM[p.fx](t, p.at, p.o || undefined), o);
      p.parts.forEach(function (q) { BM.set(q.el, BM[q.fx](t, q.at, q.o || undefined), o); });
    });
    if (h.sc && SC) return SC.render(h.sc, t);
  }
  // 字体加载完以后再查：信息卡重新缩字、文字标签有没有溢出（挂载时字体可能还没到，量出来不准）
  function check(h) {
    var IC = g('IC'), errs = [];
    h.units.forEach(function (u) {
      var e = u.el;
      if (u.kind === 'ic' || u.kind === 'title') { [].forEach.call(e.querySelectorAll('[data-fs]'), function (x) { x.style.fontSize = x.dataset.fs + 'px'; }); if (!IC.fit(e)) errs.push(u.id + '：放不下'); }
      if (u.kind === 'lab' && e.dataset.w && (e.scrollWidth > +e.dataset.w + 2 || e.scrollHeight > +e.dataset.h + 2)) errs.push(u.id + ' 文字溢出：' + e.textContent.slice(0, 12));
    });
    return errs;
  }
  // 全部入场完成、还没退场的时间点（预览 / AE 导出取这一帧）
  function settled(h) { var m = 0; h.units.forEach(function (u) { m = Math.max(m, u.at || 0); }); return Math.min(m + 1.6, h.spec.out != null ? h.spec.out - 0.01 : 1e9); }

  return { mount: mount, renderAt: renderAt, plan: plan, settled: settled, check: check, md: md };
});
