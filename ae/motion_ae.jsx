/* ae/motion_ae.jsx — 艾唯白帽志动效库 · AE 端（ES3，全新编写，不含 lieflat code video 的任何代码）
 *
 * 数值来自 ae/motion_data.jsx（由 tokens/motion.json 生成），和网页 engine/motion/motion.js 是同一组曲线：
 * 三次贝塞尔缓动换算成 AE 关键帧的「速度 + 影响」，一维属性上两边的曲线完全一致（node tools/test_motion.js 会验证）。
 *
 * 用法（在 AE 脚本里）：
 *   #include "motion_ae.jsx"
 *   BMAE.rise(layer, 1.2);                 // 和网页 BM.rise(t, 1.2) 同一个动作
 *   BMAE.key(prop, 0, 0, 0.55, 100, "out");
 *
 * 约定：
 *  - 位置一律拆成 X / Y 两个属性（ADBE Position_0 / _1）再加关键帧，这样时间缓动和网页逐维一致。
 *  - 色块扫入、下划线：AE 里用形状层「锚点放在左边缘 + 缩放 X 0→100」，视觉上等于网页的从左往右露出。
 *  - 擦除效果（线性擦除、径向擦除）参数按序号访问；方向需要在真 AE 里核对一次（探测报告里没有这两个效果）。
 */
#include "motion_data.jsx"

var BMAE = (function () {
  var M = BM_MOTION;

  function dur(d) { return (typeof d === "number") ? d : M.dur[d]; }
  function P(n) { var p = M.preset[n]; if (!p) { throw new Error("BMAE：没有这个预设 " + n); } return p; }
  function opt(o, k, n) { return (o && o[k] !== undefined) ? o[k] : P(n)[k]; }
  function tr(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }
  // 轨道遮罩：AE 2023 起用 setTrackMatte；老版本把遮罩层挪到正上方再设 trackMatteType
  function alphaMatte(layer, matte) {
    if (layer.setTrackMatte) { layer.setTrackMatte(matte, TrackMatteType.ALPHA); }
    else { matte.moveBefore(layer); layer.trackMatteType = TrackMatteType.ALPHA; }
  }
  // 加效果后，之前拿到的属性引用会失效：一律从图层重新获取刚加的那一个
  function addEffect(layer, mn) {
    layer.property("ADBE Effect Parade").addProperty(mn);
    var fx = layer.property("ADBE Effect Parade");
    return fx.property(fx.numProperties);
  }
  function posY(layer) {
    var pos = tr(layer, "ADBE Position");
    if (!pos.dimensionsSeparated) { pos.dimensionsSeparated = true; }
    return tr(layer, "ADBE Position_1");
  }

  /* 在 [t0, t1] 加两帧关键帧，并把贝塞尔曲线换算成时间缓动：
   *   出点（t0）：影响 = x1 × 100，速度 = y1·Δv / (x1·Δt)
   *   入点（t1）：影响 = (1 − x2) × 100，速度 = (1 − y2)·Δv / ((1 − x2)·Δt)
   * 数组属性（缩放等）逐维给一组缓动。 */
  function key(prop, t0, v0, t1, v1, easeName) {
    var name = easeName || "out", k0, k1, b, x1, y1, x2, y2, dt, isArr, n, outE, inE, i, dv;
    prop.setValueAtTime(t0, v0);
    prop.setValueAtTime(t1, v1);
    k0 = prop.nearestKeyIndex(t0);
    k1 = prop.nearestKeyIndex(t1);
    if (name === "linear") {
      prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), KeyframeInterpolationType.LINEAR);
      prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.LINEAR, prop.keyOutInterpolationType(k1));
      return;
    }
    b = M.ease[name].bezier; x1 = b[0]; y1 = b[1]; x2 = b[2]; y2 = b[3]; dt = t1 - t0;
    isArr = (v0 instanceof Array); n = isArr ? v0.length : 1; outE = []; inE = [];
    for (i = 0; i < n; i++) {
      dv = isArr ? (v1[i] - v0[i]) : (v1 - v0);
      outE.push(new KeyframeEase((y1 * dv) / (x1 * dt), x1 * 100));
      inE.push(new KeyframeEase(((1 - y2) * dv) / ((1 - x2) * dt), (1 - x2) * 100));
    }
    prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), KeyframeInterpolationType.BEZIER);
    prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, prop.keyOutInterpolationType(k1));
    prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), outE);
    prop.setTemporalEaseAtKey(k1, inE, prop.keyOutTemporalEase(k1));
  }

  /* ---------- 入场 ---------- */
  function rise(layer, at, o) {
    var d = dur(opt(o, "dur", "rise")), e = opt(o, "ease", "rise"), dy = opt(o, "dy", "rise");
    var py = posY(layer), y = py.valueAtTime(at, false);
    key(py, at, y + dy, at + d, y, e);
    key(tr(layer, "ADBE Opacity"), at, 0, at + d, 100, e);
  }
  // 遮罩逐行上移：matte 是盖住这一行静止位置的形状层，放在行图层正上方，作为 Alpha 遮罩
  function maskUp(lineLayer, matteLayer, at, i, o) {
    var d = dur(opt(o, "dur", "maskUp")), e = opt(o, "ease", "maskUp"), st = opt(o, "stagger", "maskUp");
    var t0 = at + (i || 0) * st, py = posY(lineLayer), y = py.valueAtTime(t0, false);
    var h = lineLayer.sourceRectAtTime(t0, false).height * (lineLayer.property("ADBE Transform Group").property("ADBE Scale").value[1] / 100);
    alphaMatte(lineLayer, matteLayer);
    key(posY(lineLayer), t0, y + h * 1.2, t0 + d, y, e);
  }
  function drop(layer, at, o) {
    var d = dur(opt(o, "dur", "drop")), e = opt(o, "ease", "drop"), dy = opt(o, "dy", "drop");
    var s0 = opt(o, "scale_from", "drop") * 100, f = opt(o, "fade", "drop");
    var py = posY(layer), y = py.valueAtTime(at, false);
    key(py, at, y + dy, at + d, y, e);
    key(tr(layer, "ADBE Scale"), at, [s0, s0, 100], at + d, [100, 100, 100], e);
    key(tr(layer, "ADBE Opacity"), at, 0, at + f, 100, "linear");
  }
  function unfold(layer, at, o) {       // 锚点请先放在图层顶边
    var d = dur(opt(o, "dur", "unfold")), e = opt(o, "ease", "unfold");
    var s0 = opt(o, "scale_from", "unfold") * 100, f = opt(o, "fade", "unfold");
    key(tr(layer, "ADBE Scale"), at, [100, s0, 100], at + d, [100, 100, 100], e);
    key(tr(layer, "ADBE Opacity"), at, 0, at + f, 100, "linear");
  }

  /* ---------- 强调 ---------- */
  function scaleXIn(layer, at, d, e) {   // 锚点请先放在图层左边缘
    key(tr(layer, "ADBE Scale"), at, [0, 100, 100], at + d, [100, 100, 100], e);
  }
  function underline(barLayer, at, o) { scaleXIn(barLayer, at, dur(opt(o, "dur", "underline")), opt(o, "ease", "underline")); }
  function blockSweep(blockLayer, at, o) { scaleXIn(blockLayer, at, dur(opt(o, "dur", "blockSweep")), opt(o, "ease", "blockSweep")); }
  function ringDraw(shapeLayer, at, i, o) {
    var d = dur(opt(o, "dur", "ringDraw")), e = opt(o, "ease", "ringDraw"), st = opt(o, "stagger", "ringDraw");
    if (!shapeLayer.property("ADBE Root Vectors Group").property("ADBE Vector Filter - Trim")) {
      shapeLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
    }
    var t0 = at + (i || 0) * st;
    key(shapeLayer.property("ADBE Root Vectors Group").property("ADBE Vector Filter - Trim").property("ADBE Vector Trim End"), t0, 0, t0 + d, 100, e);
  }
  // 数字滚动：加一个滑块控制做关键帧，源文本用表达式取整显示
  function countUp(textLayer, at, from, to, o, suffix) {
    var d = dur(opt(o, "dur", "countUp")), e = opt(o, "ease", "countUp");
    addEffect(textLayer, "ADBE Slider Control").name = "BM 计数";
    key(textLayer.property("ADBE Effect Parade").property("BM 计数").property("ADBE Slider Control-0001"), at, from, at + d, to, e);
    textLayer.property("ADBE Text Properties").property("ADBE Text Document").expression =
      'Math.round(effect("BM 计数")("ADBE Slider Control-0001")) + "' + (suffix || "") + '"';
  }

  /* ---------- 退场 ---------- */
  function sink(layer, at, o) {
    var d = dur(opt(o, "dur", "sink")), e = opt(o, "ease", "sink"), dy = opt(o, "dy", "sink");
    var py = posY(layer), y = py.valueAtTime(at, false);
    key(py, at, y, at + d, y + dy, e);
    key(tr(layer, "ADBE Opacity"), at, 100, at + d, 0, e);
  }
  function maskDown(lineLayer, matteLayer, at, i, o) {
    var d = dur(opt(o, "dur", "maskDown")), e = opt(o, "ease", "maskDown"), st = opt(o, "stagger", "maskDown");
    var t0 = at + (i || 0) * st, py = posY(lineLayer), y = py.valueAtTime(t0, false);
    var h = lineLayer.sourceRectAtTime(t0, false).height * (lineLayer.property("ADBE Transform Group").property("ADBE Scale").value[1] / 100);
    alphaMatte(lineLayer, matteLayer);
    key(posY(lineLayer), t0, y, t0 + d, y + h * 1.2, e);
  }

  /* ---------- 转场 ---------- */
  // 闪切：色板图层只在这几帧可见（入点 / 出点卡死帧数）
  function flash(plateLayer, at, o) {
    var n = opt(o, "frames", "flash");
    if (n > P("flash").max_frames) { throw new Error("BMAE：闪切最多 " + P("flash").max_frames + " 帧"); }
    plateLayer.inPoint = at;
    plateLayer.outPoint = at + n / M.fps;
  }
  // 色场擦除：给「新场景」图层加线性擦除，过渡完成度 100 → 0（参数 1 过渡完成度、2 擦除角度）
  function fieldWipe(newLayer, at, o) {
    var d = dur(opt(o, "dur", "fieldWipe")), e = opt(o, "ease", "fieldWipe");
    var w = addEffect(newLayer, "ADBE Linear Wipe");
    w.property(2).setValue(opt(o, "angle", "fieldWipe"));
    key(w.property(1), at, 100, at + d, 0, e);
  }
  // 雷达扫掠：给「新场景」图层加径向擦除，中心在雷达中心（参数 1 过渡完成度、2 起始角度、3 擦除中心、4 擦除方向）
  function radarSweep(newLayer, at, o) {
    var R = P("radarSweep"), d = dur(opt(o, "dur", "radarSweep")), e = opt(o, "ease", "radarSweep");
    var w = addEffect(newLayer, "ADBE Radial Wipe");
    w.property(2).setValue(R.start_deg);
    w.property(3).setValue([R.cx, R.cy]);
    w.property(4).setValue(1);            // 1 = 顺时针
    key(w.property(1), at, 100, at + d, 0, e);
  }
  function stickerPush(layer, at, o) {
    var d = dur(opt(o, "dur", "stickerPush")), e = opt(o, "ease", "stickerPush");
    var s1 = opt(o, "scale_to", "stickerPush") * 100, f = opt(o, "fade_from", "stickerPush");
    var sc = tr(layer, "ADBE Scale"), s = sc.valueAtTime(at, false);
    key(sc, at, [s[0], s[1], 100], at + d, [s[0] * s1 / 100, s[1] * s1 / 100, 100], e);
    key(tr(layer, "ADBE Opacity"), at + f * d, 100, at + d, 0, "linear");
  }

  /* ---------- 常驻与镜头 ---------- */
  function sweepSpin(layer, at, tEnd) {   // 锚点 / 位置请先放在雷达中心
    var r = tr(layer, "ADBE Rotate Z");
    key(r, at, 0, tEnd, (tEnd - at) * P("sweepSpin").deg_per_s, "linear");
  }
  function slowPush(layer, at, tEnd, o) { // 镜头图层（预合成 / 空对象）锚点放在画面中心
    var k = 100 * (1 + (tEnd - at) * opt(o, "rate", "slowPush"));
    key(tr(layer, "ADBE Scale"), at, [100, 100, 100], tEnd, [k, k, 100], "linear");
  }

  return {
    data: M, dur: dur, key: key,
    rise: rise, maskUp: maskUp, drop: drop, unfold: unfold,
    underline: underline, blockSweep: blockSweep, ringDraw: ringDraw, countUp: countUp,
    sink: sink, maskDown: maskDown,
    flash: flash, fieldWipe: fieldWipe, radarSweep: radarSweep, stickerPush: stickerPush,
    sweepSpin: sweepSpin, slowPush: slowPush
  };
})();
