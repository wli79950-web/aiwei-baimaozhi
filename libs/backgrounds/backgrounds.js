/* libs/backgrounds/backgrounds.js — 背景板库的网页挂载器（全局 BGLIB）
 *
 * 画面一律用背景板库的底板 + 动态层，不另写背景：
 *   BG1 炭黑·雷达（A 场）= plates/BG1_char_plate.png + layers/BG1_radar_lines.svg + layers/BG1_radar_sweep.svg（扫描扇区，常驻旋转）
 *   BG2 奶油白·纸面（B 场）= plates/BG2_cream_plate.png + layers/BG2_radar_lines.svg
 *   BG3 炭黑·工作台（A 场默认，1.5）= plates/BG3_bench_plate.png + layers/BG3_dots.svg（点阵）+ layers/BG3_marks.svg（十字标）
 *       + 焦点组件（可选，放在本镜头主体后面）：BG3_focus_glow.svg（朱橙光晕）+ BG3_focus_rings.svg（刻度环）+ BG3_focus_ticks.svg（刻度，缓慢转动）
 *       BGLIB.mount(section, 'BG3', base, { focus: [x, y, scale] })   // (x, y) = 主体中心；scale 1 ≈ 420px 宽的主体
 *
 *   const bg = BGLIB.mount(section, 'BG1', 'libs/backgrounds/');   // 第三个参数：本目录相对页面的路径
 *   window.renderAt = t => { BGLIB.animate(bg, t); ... };            // 扇区按 BM.sweepSpin 旋转（纯函数）
 *
 * 和 AE 包一一对应：底板 = 图片层「背景板_BG1」，动态层 = 「背景动态_雷达线」「背景动态_扫描扇区」；
 * BG3 = 「背景板_BG3」+「背景动态_点阵」「背景动态_十字标」+「背景动态_焦点光晕 / 焦点刻度环 / 焦点刻度」（docs/rules/AE包规范.md）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BGLIB = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PLATES = {
    BG1: { scene: 'A', plate: 'plates/BG1_char_plate.png', layers: [['layers/BG1_radar_lines.svg', 'lines'], ['layers/BG1_radar_sweep.svg', 'sweep']] },
    BG2: { scene: 'B', plate: 'plates/BG2_cream_plate.png', layers: [['layers/BG2_radar_lines.svg', 'lines']] },
    BG3: { scene: 'A', plate: 'plates/BG3_bench_plate.png', layers: [['layers/BG3_dots.svg', 'dots'], ['layers/BG3_marks.svg', 'marks']],
           focus: [['layers/BG3_focus_glow.svg', 'glow'], ['layers/BG3_focus_rings.svg', 'rings'], ['layers/BG3_focus_ticks.svg', 'ticks']] }
  };
  var SCENE_DEFAULT = { A: 'BG3', B: 'BG2' };
  var FOCUS_CANVAS = 1000, FOCUS_DRIFT = 4;   // tokens/brand.json → background.bench.focus.canvas / drift_deg_per_s

  function img(src, cls, role) {
    var el = document.createElement('img');
    el.className = 'bg-layer ' + cls; el.src = src; el.alt = ''; el.dataset.bg = role;
    return el;
  }
  // 挂到 frame（section）最底下；同时给 frame 加对应的场景类（scene-A / scene-B）
  function mount(frame, id, base, opt) {
    id = PLATES[id] ? id : SCENE_DEFAULT[id] || 'BG3';
    base = base == null ? 'libs/backgrounds/' : base; opt = opt || {};
    var P = PLATES[id], first = frame.firstChild, h = { id: id, scene: P.scene, els: [], sweep: null, ticks: null, sweepAt: opt.sweepAt || 0 };
    frame.classList.remove('scene-A', 'scene-B'); frame.classList.add('scene-' + P.scene);
    var add = function (el) { frame.insertBefore(el, first); h.els.push(el); return el; };
    add(img(base + P.plate, 'bg-plate', 'plate'));
    P.layers.forEach(function (l) {
      if (opt.hide && opt.hide.indexOf(l[1]) >= 0) return;
      var el = add(img(base + l[0], l[1] === 'sweep' ? 'bm-spin' : '', l[1]));
      if (l[1] === 'sweep') h.sweep = el;
    });
    // 焦点组件：只有 BG3 有；opt.focus = [x, y, scale]，放在主体正后方
    if (P.focus && opt.focus) {
      var fx = opt.focus[0], fy = opt.focus[1], fs = opt.focus[2] || 1, side = FOCUS_CANVAS * fs;
      P.focus.forEach(function (l) {
        if (opt.hide && opt.hide.indexOf(l[1]) >= 0) return;
        var el = add(img(base + l[0], 'bg-focus', 'focus-' + l[1]));
        el.style.cssText = 'left:' + (fx - side / 2) + 'px;top:' + (fy - side / 2) + 'px;width:' + side + 'px;height:' + side + 'px';
        if (l[1] === 'ticks') h.ticks = el;
      });
    }
    return h;
  }
  function animate(h, t) {
    var BM = (typeof self !== 'undefined' && self.BM) || (typeof window !== 'undefined' && window.BM);
    if (h && h.sweep && BM) BM.set(h.sweep, BM.sweepSpin(t, h.sweepAt));
    if (h && h.ticks && BM) BM.set(h.ticks, BM.sweepSpin(t, h.sweepAt, { deg_per_s: FOCUS_DRIFT }));   // 刻度缓慢转动，每秒 4°
  }
  return { mount: mount, animate: animate, PLATES: PLATES };
});
