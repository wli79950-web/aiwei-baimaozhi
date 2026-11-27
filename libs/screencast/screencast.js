/* libs/screencast/screencast.js — 录屏组件（全局 SC；全新编写，不含 lieflat / 挖洞号代码）
 *
 * 一个录屏镜头 = 窗口 + 原片（时间重映射）+ 推镜 + 标注 + 光标 + 打码 + 联动引线，全部是时间 t 的函数：
 *   const h = SC.shot(section, spec, { base: '…' });
 *   window.renderAt = async t => { BGLIB.animate(bg, t); await SC.render(h, t); };
 *
 * spec（坐标单位：原片像素，除 rect 外）
 *   rect   : [x, y, w, h]            窗口在画面里的位置（宽占画面 85–94%；和信息卡同框写 narrow: true，≥ 68%）
 *   src    : { type: 'frames', url: 'rec/%05d.jpg', fps: 30, count: 150, w: 1920, h: 1080 } 帧序列（原片转出来的）
 *          | { type: 'image', url: 'shot.png', w, h }                                         单张截图
 *   start  : 原片从合成的第几秒开始播（默认 0）；remap: [[合成秒, 原片秒], …] 分段线性（= AE 时间重映射，两点原片秒相同即定格）
 *   push   : [{ at, rect: [x, y, w, h] | null, dur: 0.7, ease: 'inOut' }]   推镜到某个区域（null = 回到全景）
 *   ann    : [{ type: 'mark' | 'underline' | 'spot', rect, at, out, label, side: 'right' | 'left' | 'above' | 'below', leader }]
 *            一个镜头同一时刻最多一处强调（SC.validate 会查）
 *   cursor : [{ at, x, y, move: 0.5, click }]   光标在 at 时刻到达 (x, y)；click 画点击涟漪
 *   mask   : [{ rect, mode: 'blur' | 'block' }]   打码（手机号、token、真实域名），全程都在
 *   links  : [{ from: rect, to: 元素 | 选择器 | [x, y, w, h]（画面坐标）, at, dur: 0.5 }]   从录屏里的一处拉出引线连到信息卡
 *   enter  : { at: 0 }   窗口入场（rise）
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SC = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BAR = 52, INSET = 12, FOCUS_MARGIN = 0.1;
  function BMx() { return (typeof self !== 'undefined' && self.BM) || (typeof window !== 'undefined' && window.BM); }
  function n3(v) { return Math.round(v * 1000) / 1000; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, parent, ns) {
    var e = ns ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    if (cls) e.setAttribute('class', cls); if (parent) parent.appendChild(e); return e;
  }

  /* ---------- 纯数学（Node 里也能测） ---------- */
  function srcTime(spec, t) {
    var R = spec.remap;
    if (!R || !R.length) return Math.max(0, t - (spec.start || 0));
    if (t <= R[0][0]) return R[0][1];
    for (var i = 1; i < R.length; i++) if (t <= R[i][0]) {
      var a = R[i - 1], b = R[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
    }
    return R[R.length - 1][1];
  }
  function frameIndex(spec, t) {
    var s = spec.src; if (s.type !== 'frames') return 0;
    return clamp(Math.floor(srcTime(spec, t) * s.fps + 1e-6), 0, s.count - 1);
  }
  // 相机状态：缩放 s、平移 tx / ty（视口坐标）。全景 = 铺满视口（cover）；聚焦 = 让 rect 留 10% 边距放进视口，且原片始终铺满不露边
  // 全景顶对齐：浏览器地址栏、标签页在最上面，裁切宁可裁底部
  function camFull(VW, VH, MW, MH) { var s = Math.max(VW / MW, VH / MH); return { s: s, tx: (VW - MW * s) / 2, ty: 0 }; }
  function camFocus(VW, VH, MW, MH, r) {
    var f = camFull(VW, VH, MW, MH);
    if (!r) return f;
    var s = Math.max(f.s, Math.min(VW / r[2], VH / r[3]) * (1 - FOCUS_MARGIN));
    var cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    return { s: s, tx: clamp(VW / 2 - cx * s, VW - MW * s, 0), ty: clamp(VH / 2 - cy * s, VH - MH * s, 0) };
  }
  function camAt(spec, t, VW, VH) {
    var BM = BMx(), MW = spec.src.w, MH = spec.src.h, cur = camFull(VW, VH, MW, MH);
    (spec.push || []).forEach(function (k) {
      if (t < k.at) return;
      var to = camFocus(VW, VH, MW, MH, k.rect), d = k.dur || 0.7, p = BM ? BM.prog(t, k.at, d, k.ease || 'inOut') : clamp((t - k.at) / d, 0, 1);
      cur = { s: cur.s + (to.s - cur.s) * p, tx: cur.tx + (to.tx - cur.tx) * p, ty: cur.ty + (to.ty - cur.ty) * p };
    });
    return cur;
  }
  function cursorAt(spec, t) {
    var K = spec.cursor || [], BM = BMx();
    if (!K.length || t < K[0].at - (K[0].move || 0.5)) return null;
    var pos = { x: K[0].x, y: K[0].y };
    for (var i = 1; i < K.length; i++) {
      var k = K[i], m = k.move || 0.5;
      if (t <= k.at - m) break;
      var p = BM ? BM.prog(t, k.at - m, m, 'inOut') : clamp((t - k.at + m) / m, 0, 1);
      pos = { x: pos.x + (k.x - pos.x) * p, y: pos.y + (k.y - pos.y) * p };
    }
    return pos;
  }
  // 检查：窗口宽度、一个镜头同一时刻最多一处强调、关键帧按时间排好、坐标在原片内
  function validate(spec, frameW) {
    var errs = [], W = frameW || 1920, fr = spec.rect[2] / W;
    if (spec.narrow ? fr < 0.68 : (fr < 0.85 || fr > 0.94)) errs.push('录屏窗口宽 ' + Math.round(fr * 100) + '%：核心录屏 85–94%（和信息卡同框写 narrow，≥ 68%）');
    var A = (spec.ann || []).map(function (a) { return [a.at, a.out == null ? Infinity : a.out]; }).sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 1; i < A.length; i++) if (A[i][0] < A[i - 1][1]) errs.push('同一时刻有两处强调（' + A[i - 1][0] + 's 和 ' + A[i][0] + 's 的标注重叠）：一个镜头最多一处，前一处写 out');
    ['push', 'cursor'].forEach(function (k) { var L = spec[k] || []; for (var j = 1; j < L.length; j++) if (L[j].at < L[j - 1].at) errs.push(k + ' 的关键帧没按时间排序'); });
    var inside = function (r) { return r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= spec.src.w && r[1] + r[3] <= spec.src.h; };
    (spec.ann || []).concat(spec.mask || []).concat((spec.push || []).filter(function (p) { return p.rect; })).forEach(function (a) { if (!inside(a.rect)) errs.push('区域 ' + JSON.stringify(a.rect) + ' 超出原片 ' + spec.src.w + '×' + spec.src.h); });
    if (spec.src.type === 'frames' && !(spec.src.fps > 0 && spec.src.count > 0)) errs.push('帧序列要写 fps 和 count');
    return errs;
  }

  /* ---------- 搭 DOM ---------- */
  function shot(frame, spec, opt) {
    opt = opt || {};
    var r = spec.rect, h = { spec: spec, frame: frame, base: opt.base || '', VW: r[2] - 2 * INSET, VH: r[3] - BAR - INSET, last: -1 };
    var win = h.win = el('div', 'sc-win', null); win.style.cssText = 'left:' + r[0] + 'px;top:' + r[1] + 'px;width:' + r[2] + 'px;height:' + r[3] + 'px';
    var bar = el('div', 'sc-bar', win); el('i', '', bar); el('i', '', bar); el('i', '', bar);
    var view = h.view = el('div', 'sc-view', win);
    var cam = h.cam = el('div', 'sc-cam', view); cam.style.width = spec.src.w + 'px'; cam.style.height = spec.src.h + 'px';
    var img = h.img = el('img', 'sc-media', cam); img.alt = ''; img.style.width = spec.src.w + 'px'; img.style.height = spec.src.h + 'px';
    h.masks = (spec.mask || []).map(function (m) {
      var d = el('div', 'sc-mask ' + (m.mode || 'blur'), cam);
      d.style.cssText = 'left:' + m.rect[0] + 'px;top:' + m.rect[1] + 'px;width:' + m.rect[2] + 'px;height:' + m.rect[3] + 'px';
      // 模糊打码 = 同一帧原片的模糊副本，裁到这块区域（不用 backdrop-filter：推镜放大后会失效，露出原文）
      if ((m.mode || 'blur') === 'blur') { var c = el('img', 'sc-mask-img', d); c.alt = ''; c.style.cssText = 'left:' + (-m.rect[0]) + 'px;top:' + (-m.rect[1]) + 'px;width:' + spec.src.w + 'px;height:' + spec.src.h + 'px'; d.copy = c; }
      return d;
    });
    var svg = h.svg = el('svg', 'sc-ann', view, true); svg.setAttribute('width', h.VW); svg.setAttribute('height', h.VH);
    var labels = el('div', 'sc-labels', view);
    h.ann = (spec.ann || []).map(function (a) {
      var o = { a: a };
      if (a.type === 'spot') { o.spot = el('path', 'spot', svg, true); o.spot.setAttribute('fill-rule', 'evenodd'); }
      o.path = el('path', '', svg, true);
      if (a.label) { o.label = el('div', 'sc-label' + (a.alt ? ' alt' : ''), labels); o.label.textContent = a.label; if (a.leader) o.leader = el('path', '', svg, true); }
      return o;
    });
    h.ripples = (spec.cursor || []).filter(function (k) { return k.click; }).map(function (k) { var d = el('div', 'sc-ripple', view); return { k: k, el: d }; });
    if ((spec.cursor || []).length) {
      h.cursor = el('svg', 'sc-cursor', view, true); h.cursor.setAttribute('viewBox', '0 0 22 30');
      el('path', '', h.cursor, true).setAttribute('d', 'M2 2 L2 24 L8 18.5 L12 27.5 L16 25.8 L12 17 L20 17 Z');
    }
    frame.appendChild(win);
    if ((spec.links || []).length) {
      var ls = h.lsvg = el('svg', 'sc-links', frame, true); ls.setAttribute('width', 1920); ls.setAttribute('height', 1080);
      h.links = spec.links.map(function (k) { var o = { k: k, path: el('path', '', ls, true), dot: el('path', '', ls, true) }; o.dot.style.fill = 'var(--orange)'; return o; });
    }
    return h;
  }

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return 'M' + n3(x + r) + ' ' + n3(y) + 'H' + n3(x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n3(x + w) + ' ' + n3(y + r) + 'V' + n3(y + h - r) +
      'A' + r + ' ' + r + ' 0 0 1 ' + n3(x + w - r) + ' ' + n3(y + h) + 'H' + n3(x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n3(x) + ' ' + n3(y + h - r) +
      'V' + n3(y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n3(x + r) + ' ' + n3(y) + 'Z';
  }
  function draw(path, d, len, p) {   // 描线：周长每帧重算（推镜时框的尺寸在变）
    path.setAttribute('d', d); path.style.strokeDasharray = n3(len) + ' ' + n3(len); path.style.strokeDashoffset = n3(len * (1 - p));
  }
  function targetRect(frame, to) {
    if (Array.isArray(to)) return to;
    var e = typeof to === 'string' ? frame.querySelector(to) : to;
    return e ? [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight] : null;
  }

  /* ---------- 渲染一帧（async：帧序列要等图片解码） ---------- */
  function render(h, t) {
    var BM = BMx(), S = h.spec, VW = h.VW, VH = h.VH;
    BM.set(h.win, S.enter ? BM.rise(t, S.enter.at || 0) : {});
    // 1. 相机（推镜）
    var c = camAt(S, t, VW, VH);
    h.cam.style.transform = 'translate(' + n3(c.tx) + 'px,' + n3(c.ty) + 'px) scale(' + n3(c.s) + ')';
    var mp = function (x, y) { return [c.tx + x * c.s, c.ty + y * c.s]; };
    var mr = function (r, pad) { var a = mp(r[0], r[1]); pad = pad || 0; return [a[0] - pad, a[1] - pad, r[2] * c.s + 2 * pad, r[3] * c.s + 2 * pad]; };
    // 2. 标注
    h.ann.forEach(function (o) {
      var a = o.a, on = t >= a.at, p = on ? BM.ringDraw(t, a.at).dash : 0;
      var fade = a.out != null ? 1 - BM.prog(t, a.out, 0.3, 'in') : 1, R = mr(a.rect, 10);
      if (a.type === 'spot') {
        var sp = BM.prog(t, a.at, 0.4, 'out') * fade;
        o.spot.setAttribute('d', 'M0 0H' + VW + 'V' + VH + 'H0Z ' + rrect(R[0], R[1], R[2], R[3], 14)); o.spot.style.opacity = n3(sp);
        o.path.style.opacity = 0;
      } else if (a.type === 'underline') {
        var y = R[1] + R[3]; draw(o.path, 'M' + n3(R[0]) + ' ' + n3(y) + 'H' + n3(R[0] + R[2]), R[2], BM.prog(t, a.at, 0.4, 'inOut'));
        o.path.style.opacity = n3(fade);
      } else {
        var rr = 14, per = 2 * (R[2] + R[3]) - (8 - 2 * Math.PI) * rr;
        draw(o.path, rrect(R[0], R[1], R[2], R[3], rr), per, p); o.path.style.opacity = n3(fade);
      }
      if (o.label) {
        var L = o.label, lw = L.offsetWidth, lh = L.offsetHeight, gap = a.leader ? 64 : 16, side = a.side || 'right', lx, ly;
        if (side === 'right') { lx = R[0] + R[2] + gap; ly = R[1] + R[3] / 2 - lh / 2; }
        else if (side === 'left') { lx = R[0] - gap - lw; ly = R[1] + R[3] / 2 - lh / 2; }
        else if (side === 'above') { lx = R[0]; ly = R[1] - gap - lh; }
        else { lx = R[0]; ly = R[1] + R[3] + gap; }
        lx = clamp(lx, 16, VW - lw - 16); ly = clamp(ly, 16, VH - lh - 16);
        L.style.left = n3(lx) + 'px'; L.style.top = n3(ly) + 'px';
        BM.set(L, BM.rise(t, a.at + 0.35, { dy: 24 }), a.out != null ? BM.sink(t, a.out) : {});
        if (o.leader) {
          var sx = side === 'left' ? R[0] : side === 'right' ? R[0] + R[2] : R[0] + R[2] / 2, sy = side === 'above' ? R[1] : side === 'below' ? R[1] + R[3] : R[1] + R[3] / 2;
          var ex = side === 'left' ? lx + lw : side === 'right' ? lx : lx + 40, ey = side === 'above' ? ly + lh : side === 'below' ? ly : ly + lh / 2;
          draw(o.leader, 'M' + n3(sx) + ' ' + n3(sy) + 'L' + n3(ex) + ' ' + n3(ey), Math.hypot(ex - sx, ey - sy), BM.prog(t, a.at + 0.25, 0.3, 'inOut'));
          o.leader.style.opacity = n3(fade);
        }
      }
    });
    // 3. 光标 + 点击涟漪
    if (h.cursor) {
      var cp = cursorAt(S, t);
      if (!cp) h.cursor.style.visibility = 'hidden';
      else {
        var q = mp(cp.x, cp.y), press = 1;
        (S.cursor || []).forEach(function (k) { if (k.click && t >= k.at && t < k.at + 0.3) press = 1 - 0.14 * Math.sin(Math.PI * (t - k.at) / 0.3); });
        h.cursor.style.visibility = ''; h.cursor.style.transform = 'translate(' + n3(q[0] - 3) + 'px,' + n3(q[1] - 3) + 'px) scale(' + n3(press) + ')';
      }
      h.ripples.forEach(function (rp) {
        var k = rp.k, p = BM.prog(t, k.at, 0.45, 'out'), live = t >= k.at && t < k.at + 0.45, q = mp(k.x, k.y), rad = 12 + 52 * p;
        var st = rp.el.style;
        st.visibility = live ? '' : 'hidden'; st.width = st.height = n3(rad * 2) + 'px';
        st.transform = 'translate(' + n3(q[0] - rad) + 'px,' + n3(q[1] - rad) + 'px)'; st.opacity = n3(1 - p);
      });
    }
    // 4. 联动引线：从录屏里的一处连到画面上的信息卡
    (h.links || []).forEach(function (o) {
      var k = o.k, R = mr(k.from, 8), ox = S.rect[0] + INSET, oy = S.rect[1] + BAR, T = targetRect(h.frame, k.to);
      if (!T) return;
      var sx = ox + R[0] + R[2], sy = oy + R[1] + R[3] / 2, toLeft = T[0] >= sx;
      if (!toLeft) sx = ox + R[0];
      var ex = toLeft ? T[0] : T[0] + T[2], ey = T[1] + Math.min(T[3] / 2, 80), mx = (sx + ex) / 2;
      var d = 'M' + n3(sx) + ' ' + n3(sy) + 'C' + n3(mx) + ' ' + n3(sy) + ' ' + n3(mx) + ' ' + n3(ey) + ' ' + n3(ex) + ' ' + n3(ey);
      var len = Math.hypot(ex - sx, ey - sy) * 1.15 + 40, p = BM.prog(t, k.at, k.dur || 0.5, 'inOut');
      o.path.setAttribute('d', d); o.path.style.strokeDasharray = n3(len) + ' ' + n3(len); o.path.style.strokeDashoffset = n3(len * (1 - p));
      o.dot.setAttribute('d', 'M' + n3(sx - 9) + ' ' + n3(sy) + 'a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'); o.dot.style.opacity = t >= k.at ? 1 : 0;
    });
    // 5. 原片这一帧
    var s = S.src, url = s.type === 'frames' ? s.url.replace(/%0(\d)d/, function (_, n) { return String(frameIndex(S, t) + 1).padStart(+n, '0'); }) : s.url;
    url = h.base + url;
    if (url === h.lastUrl) return Promise.resolve();
    h.lastUrl = url; h.img.src = url;
    var waits = [h.img.decode().catch(function () {})];
    h.masks.forEach(function (m) { if (m.copy) { m.copy.src = url; waits.push(m.copy.decode().catch(function () {})); } });
    return Promise.all(waits);
  }

  // 给 P6 AE 生成器用：视口几何 + 每个推镜关键帧的相机状态（AE：原片层缩放 / 位置关键帧）
  function keyframes(spec) {
    var VW = spec.rect[2] - 2 * INSET, VH = spec.rect[3] - BAR - INSET, MW = spec.src.w, MH = spec.src.h;
    return { view: { x: spec.rect[0] + INSET, y: spec.rect[1] + BAR, w: VW, h: VH }, full: camFull(VW, VH, MW, MH),
      push: (spec.push || []).map(function (k) { return { at: k.at, dur: k.dur || 0.7, ease: k.ease || 'inOut', cam: camFocus(VW, VH, MW, MH, k.rect) }; }),
      remap: spec.remap || [[spec.start || 0, 0]], ann: spec.ann || [], cursor: spec.cursor || [], mask: spec.mask || [] };
  }

  return { shot: shot, render: render, validate: validate, keyframes: keyframes,
           srcTime: srcTime, frameIndex: frameIndex, camAt: camAt, camFull: camFull, camFocus: camFocus, cursorAt: cursorAt, BAR: BAR, INSET: INSET };
});
