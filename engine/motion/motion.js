/* engine/motion/motion.js — 艾唯白帽志动效库（全新编写，不含 lieflat code video 的任何代码）
 *
 * 原则
 *  - 每个函数都是时间 t（秒）的纯函数：同一个 t 永远得到同一个结果，可以逐帧确定性渲染、乱序渲染。
 *  - 数值全部来自 tokens/motion.json：浏览器里由 engine/motion/tokens.js 注入 window.BM_MOTION，
 *    Node 里用 BM.init(require('../../tokens/motion.json'))。AE 端（ae/motion_ae.jsx）读同一份数值。
 *  - 缓动一律是三次贝塞尔曲线，AE 用关键帧缓动（速度 + 影响）能精确还原同一条曲线。
 *
 * 用法
 *  每个预设返回一个「状态」{o 不透明度, x/y 位移 px, yp 位移 %, s/sx/sy 缩放, r 旋转, clipR 右侧裁切,
 *  size 背景扫入, dash 描线, cone 扇形遮罩, vis 可见}；多个状态用 BM.set(el, 状态1, 状态2…) 合并后写进元素。
 *    BM.set(card, BM.rise(t, 1.2), BM.sink(t, 3.0));
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BM = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var T = null;
  var cache = {};

  function init(tokens) { T = tokens; cache = {}; return api; }
  function tok() {
    if (!T) {
      if (typeof window !== 'undefined' && window.BM_MOTION) T = window.BM_MOTION;
      else throw new Error('BM：动效参数没有加载（浏览器先引入 engine/motion/tokens.js）');
    }
    return T;
  }

  /* ---------- 基础数学 ---------- */
  function clamp(x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  // 三次贝塞尔缓动：控制点 (0,0) (x1,y1) (x2,y2) (1,1)，输入时间进度 x，输出数值进度 y。
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function X(s) { return ((ax * s + bx) * s + cx) * s; }
    function Y(s) { return ((ay * s + by) * s + cy) * s; }
    function dX(s) { return (3 * ax * s + 2 * bx) * s + cx; }
    function solve(x) {
      var s = x, i, e, d, lo = 0, hi = 1;
      for (i = 0; i < 8; i++) {                       // 牛顿法
        e = X(s) - x; if (Math.abs(e) < 1e-7) return s;
        d = dX(s); if (Math.abs(d) < 1e-6) break;
        s -= e / d;
      }
      s = x;
      for (i = 0; i < 60; i++) {                      // 二分法兜底
        e = X(s); if (Math.abs(e - x) < 1e-7) break;
        if (e < x) lo = s; else hi = s;
        s = (lo + hi) / 2;
      }
      return s;
    }
    return function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : Y(solve(x)); };
  }

  function ease(name) {
    if (typeof name === 'function') return name;
    var k = name || 'out';
    if (!cache[k]) {
      var e = tok().ease[k]; if (!e) throw new Error('BM：没有这个缓动 ' + k);
      cache[k] = bezier(e.bezier[0], e.bezier[1], e.bezier[2], e.bezier[3]);
    }
    return cache[k];
  }
  function dur(d) { return typeof d === 'number' ? d : tok().dur[d]; }
  function P(name) { var p = tok().preset[name]; if (!p) throw new Error('BM：没有这个预设 ' + name); return p; }
  function opt(o, k, name) { return (o && o[k] !== undefined) ? o[k] : P(name)[k]; }

  // 进度：t 在 [at, at+d] 之间按缓动从 0 走到 1（settle 会略超过 1）
  function prog(t, at, d, e) { return ease(e)(clamp((t - at) / d)); }
  function tween(t, at, d, from, to, e) { return lerp(from, to, prog(t, at, d, e)); }
  // 分段关键帧：[[时间, 值], [时间, 值, 进入这一段的缓动], …]
  function keys(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        var a = ks[i - 1], b = ks[i];
        return lerp(a[1], b[1], ease(b[2] || 'out')((t - a[0]) / (b[0] - a[0])));
      }
    }
    return ks[ks.length - 1][1];
  }
  function frame(t) { return Math.floor(t * tok().fps + 1e-6); }
  function inRange(t, a, b) { return t >= a && t < b; }

  /* ---------- 预设：全部返回状态 ---------- */
  function pp(name, t, at, o) { return prog(t, at, dur(opt(o, 'dur', name)), opt(o, 'ease', name)); }

  // 入场
  function rise(t, at, o) { var p = pp('rise', t, at, o); return { o: clamp(p), y: (1 - p) * opt(o, 'dy', 'rise') }; }
  function maskUp(t, at, i, o) {     // 用在 .bm-mask 里面那一层；i 是第几行
    var st = opt(o, 'stagger', 'maskUp'); var p = pp('maskUp', t, at + (i || 0) * st, o);
    return { yp: (1 - p) * 120 };   // 120%：连遮罩底部的内边距一起藏住
  }
  function drop(t, at, o) {
    var p = pp('drop', t, at, o), f = opt(o, 'fade', 'drop');
    return { o: clamp((t - at) / f), y: (1 - p) * opt(o, 'dy', 'drop'), s: lerp(opt(o, 'scale_from', 'drop'), 1, p) };
  }
  function unfold(t, at, o) {        // 元素自己设 transform-origin: top
    var p = pp('unfold', t, at, o), f = opt(o, 'fade', 'unfold');
    return { o: clamp((t - at) / f), sy: lerp(opt(o, 'scale_from', 'unfold'), 1, p) };
  }
  // 强调
  function underline(t, at, o) { return { clipR: 1 - clamp(pp('underline', t, at, o)) }; }
  function blockSweep(t, at, o) { return { size: clamp(pp('blockSweep', t, at, o)) }; }
  function countUp(t, at, from, to, o) { return lerp(from, to, clamp(pp('countUp', t, at, o))); }
  function ringDraw(t, at, i, o) {
    var st = opt(o, 'stagger', 'ringDraw');
    return { dash: clamp(pp('ringDraw', t, at + (i || 0) * st, o)) };
  }
  // 退场
  function sink(t, at, o) { var p = pp('sink', t, at, o); return { o: 1 - clamp(p), y: p * opt(o, 'dy', 'sink') }; }
  function maskDown(t, at, i, o) {
    var st = opt(o, 'stagger', 'maskDown'); var p = pp('maskDown', t, at + (i || 0) * st, o);
    return { yp: p * 120 };
  }
  // 转场
  function flash(t, at, o) {         // 返回 true 表示这一帧显示闪切板
    var n = opt(o, 'frames', 'flash'), mx = P('flash').max_frames;
    if (n > mx) throw new Error('BM：闪切最多 ' + mx + ' 帧');
    var f = frame(t), f0 = frame(at);
    return f >= f0 && f < f0 + n;
  }
  function fieldWipe(t, at, o) { return { clipR: 1 - clamp(pp('fieldWipe', t, at, o)) }; }   // 给「新场景」那一层
  function radarSweep(t, at, o) { return { cone: 360 * clamp(pp('radarSweep', t, at, o)) }; } // 给「新场景」那一层
  function stickerPush(t, at, o) {    // 放大按缓动走；淡出按时间线性走（最后 1 - fade_from 的时长），AE 用两帧线性关键帧即可还原
    var d = dur(opt(o, 'dur', 'stickerPush')), p = pp('stickerPush', t, at, o), f = opt(o, 'fade_from', 'stickerPush');
    var x = clamp((t - at) / d);
    return { s: lerp(1, opt(o, 'scale_to', 'stickerPush'), p), o: 1 - clamp((x - f) / (1 - f)) };
  }
  // 常驻与镜头
  function sweepSpin(t, at) { return { r: Math.max(0, t - (at || 0)) * P('sweepSpin').deg_per_s }; }
  function slowPush(t, at, o) { return { s: 1 + Math.max(0, t - (at || 0)) * opt(o, 'rate', 'slowPush') }; }
  function hold() { return {}; }

  /* ---------- 状态合并与写入 ---------- */
  function merge(list) {
    var m = { o: 1, x: 0, y: 0, yp: 0, s: 1, sx: 1, sy: 1, r: 0, clipR: 0, size: null, dash: null, cone: null, vis: true };
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s === false) { m.vis = false; continue; }   // 例：BM.set(板, BM.flash(t, at) ? {} : false)
      if (!s || s === true) continue;
      if (s.o != null) m.o *= s.o;
      if (s.x) m.x += s.x; if (s.y) m.y += s.y; if (s.yp) m.yp += s.yp;
      if (s.s != null) m.s *= s.s; if (s.sx != null) m.sx *= s.sx; if (s.sy != null) m.sy *= s.sy;
      if (s.r) m.r += s.r;
      if (s.clipR) m.clipR = Math.max(m.clipR, s.clipR);
      if (s.size != null) m.size = s.size;
      if (s.dash != null) m.dash = s.dash;
      if (s.cone != null) m.cone = s.cone;
      if (s.vis === false) m.vis = false;
    }
    return m;
  }
  function num(v) { return Math.round(v * 1000) / 1000; }   // 写进样式前统一精度，保证逐帧结果稳定
  function set(el) {
    var m = merge(Array.prototype.slice.call(arguments, 1)), st = el.style;
    st.visibility = m.vis ? '' : 'hidden';
    st.opacity = num(m.o);
    st.transform = 'translate(' + num(m.x) + 'px, calc(' + num(m.y) + 'px + ' + num(m.yp) + '%)) ' +
                   'scale(' + num(m.s * m.sx) + ', ' + num(m.s * m.sy) + ') rotate(' + num(m.r) + 'deg)';
    st.clipPath = m.clipR > 0 ? 'inset(0 ' + num(m.clipR * 100) + '% 0 0)' : '';
    if (m.size != null) st.backgroundSize = num(m.size * 100) + '% 100%';
    if (m.dash != null) {
      var L = el.__bmLen || (el.__bmLen = el.getTotalLength ? el.getTotalLength() : 0);
      st.strokeDasharray = num(L) + ' ' + num(L);
      st.strokeDashoffset = num(L * (1 - m.dash));
    }
    if (m.cone != null) {
      var R = P('radarSweep'), c = m.cone >= 360 ? '' :
        'conic-gradient(from ' + R.start_deg + 'deg at ' + R.cx + 'px ' + R.cy + 'px, #000 ' + num(m.cone) + 'deg, transparent ' + num(m.cone) + 'deg)';
      st.webkitMaskImage = c; st.maskImage = c;
    }
    return el;
  }
  function text(el, s) { if (el.textContent !== s) el.textContent = s; return el; }

  var api = {
    init: init, tokens: tok,
    bezier: bezier, ease: ease, dur: dur, clamp: clamp, lerp: lerp, prog: prog, tween: tween, keys: keys, frame: frame, inRange: inRange,
    rise: rise, maskUp: maskUp, drop: drop, unfold: unfold,
    underline: underline, blockSweep: blockSweep, countUp: countUp, ringDraw: ringDraw,
    sink: sink, maskDown: maskDown,
    flash: flash, fieldWipe: fieldWipe, radarSweep: radarSweep, stickerPush: stickerPush,
    sweepSpin: sweepSpin, slowPush: slowPush, hold: hold,
    merge: merge, set: set, text: text
  };
  return api;
});
