/* libs/backgrounds/backgrounds.js — 背景板库的网页挂载器（全局 BGLIB）
 *
 * 画面一律用背景板库的底板 + 动态层，不另写背景：
 *   BG1 炭黑·雷达（A 场）= plates/BG1_char_plate.png + layers/BG1_radar_lines.svg + layers/BG1_radar_sweep.svg（扫描扇区，常驻旋转）
 *   BG2 奶油白·纸面（B 场）= plates/BG2_cream_plate.png + layers/BG2_radar_lines.svg
 *
 *   const bg = BGLIB.mount(section, 'BG1', 'libs/backgrounds/');   // 第三个参数：本目录相对页面的路径
 *   window.renderAt = t => { BGLIB.animate(bg, t); ... };            // 扇区按 BM.sweepSpin 旋转（纯函数）
 *
 * 和 AE 包一一对应：底板 = 图片层「背景板_BG1」，动态层 = 「背景动态_雷达线」「背景动态_扫描扇区」（docs/rules/AE包规范.md）。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BGLIB = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PLATES = {
    BG1: { scene: 'A', plate: 'plates/BG1_char_plate.png', layers: [['layers/BG1_radar_lines.svg', 'lines'], ['layers/BG1_radar_sweep.svg', 'sweep']] },
    BG2: { scene: 'B', plate: 'plates/BG2_cream_plate.png', layers: [['layers/BG2_radar_lines.svg', 'lines']] }
  };
  var SCENE_DEFAULT = { A: 'BG1', B: 'BG2' };

  function img(src, cls, role) {
    var el = document.createElement('img');
    el.className = 'bg-layer ' + cls; el.src = src; el.alt = ''; el.dataset.bg = role;
    return el;
  }
  // 挂到 frame（section）最底下；同时给 frame 加对应的场景类（scene-A / scene-B）
  function mount(frame, id, base, opt) {
    id = PLATES[id] ? id : SCENE_DEFAULT[id] || 'BG1';
    base = base == null ? 'libs/backgrounds/' : base; opt = opt || {};
    var P = PLATES[id], first = frame.firstChild, h = { id: id, scene: P.scene, els: [], sweep: null, sweepAt: opt.sweepAt || 0 };
    frame.classList.remove('scene-A', 'scene-B'); frame.classList.add('scene-' + P.scene);
    var add = function (el) { frame.insertBefore(el, first); h.els.push(el); return el; };
    add(img(base + P.plate, 'bg-plate', 'plate'));
    P.layers.forEach(function (l) {
      if (opt.hide && opt.hide.indexOf(l[1]) >= 0) return;
      var el = add(img(base + l[0], l[1] === 'sweep' ? 'bm-spin' : '', l[1]));
      if (l[1] === 'sweep') h.sweep = el;
    });
    return h;
  }
  function animate(h, t) {
    var BM = (typeof self !== 'undefined' && self.BM) || (typeof window !== 'undefined' && window.BM);
    if (h && h.sweep && BM) BM.set(h.sweep, BM.sweepSpin(t, h.sweepAt));
  }
  return { mount: mount, animate: animate, PLATES: PLATES };
});
