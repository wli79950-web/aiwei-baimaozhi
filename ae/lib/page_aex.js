/* ae/lib/page_aex.js — 注入到镜头页面里（ae/export_shots.js 用），把「全部入场完成」那一帧拆成 AE 图层描述。
 *
 * 拆法（和网页同一份入场时间表：SHOT.plan + IC.plan）：
 *   unit（镜头运行时登记的每个画面元素）→ 若干 node：unit 本身 + 卡片里每个会单独入场的元素（data-role）
 *   每个 node = 一张透明 PNG（它自己的底卡 / 描边 / 图标 / 图片，文字抠掉，子 node 藏掉）+ 若干 AE 文字层
 *   文字层：一段文字一层，逐字记录实际渲染的字体（按字体覆盖表判断回退）、字号、颜色、字距，基线坐标
 * 坐标一律是 1920×1080 画面坐标；倾斜（CSS rotate）先去掉再量，AE 里由预合成图层转回去。
 * 抠图时画面外扩 M px（画面边上的投影、出血不被截断）。
 */
window.AEX = (function () {
  'use strict';
  var M = 240, PAD = 120, FACES = [], cv = null, ASC = {};
  var GRAPHIC_FX = { blockSweep: 1, underline: 1 };          // 只动底色 / 线条，里面的字不跟着动
  var ROLE_CN = { decor: '装饰字', line: '行', text: '文字', tline: '行', msg: '消息', stk: '贴纸', row: '行', pill: '胶囊', mk: '标记', box: '框', rule: '色条', bar: '进度', hl: '色块', num: '数字' };
  var KIND_CN = { ic: '卡', title: '标题', img: '贴纸', photo: '图片', lab: '文字', deco: '装饰字', amb: '氛围', bokeh: '氛围_光斑', lines: '引线', co: '标注', box: '底卡', sub: '字幕', todo: '待补', sc: '录屏' };
  var fr = function () { return document.getElementById('fr'); };

  // ---------- 字体：网页实际用哪个字体渲染这个字 ----------
  function setCover(c) { FACES = c.faces; }
  function covered(f, cp) {
    var r = f.ranges, lo = 0, hi = r.length - 1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (cp < r[m][0]) hi = m - 1; else if (cp > r[m][1]) lo = m + 1; else return true; }
    return false;
  }
  function pickWeight(ws, w) {           // CSS Fonts 4 §5.2 字重匹配
    if (ws.indexOf(w) >= 0) return w;
    var up = ws.filter(function (x) { return x > w; }).sort(function (a, b) { return a - b; });
    var dn = ws.filter(function (x) { return x < w; }).sort(function (a, b) { return b - a; });
    if (w >= 400 && w <= 500) { var mid = up.filter(function (x) { return x <= 500; }); if (mid.length) return mid[0]; return dn.length ? dn[0] : up[0]; }
    if (w < 400) return dn.length ? dn[0] : up[0];
    return up.length ? up[0] : dn[0];
  }
  function faceFor(ff, w, ch) {
    var cp = ch.codePointAt(0), fams = ff.split(',').map(function (s) { return s.trim().replace(/^["']|["']$/g, '').toLowerCase(); });
    for (var i = 0; i < fams.length; i++) {
      var fs = FACES.filter(function (f) { return f.family === fams[i]; }); if (!fs.length) continue;
      var pw = pickWeight(fs.map(function (f) { return f.weight; }), w), f = fs.filter(function (x) { return x.weight === pw; })[0];
      if (covered(f, cp)) return f;
    }
    return null;
  }
  // 基线 = 字框顶 + 首选字体的上行高度（Chrome 的文字框高度按元素字体栈的首选字体算，回退字也一样）
  function ascent(st) {
    var k = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily; if (ASC[k] != null) return ASC[k];
    cv = cv || document.createElement('canvas').getContext('2d'); cv.font = k;
    return (ASC[k] = cv.measureText('H').fontBoundingBoxAscent);
  }
  function hex(c) {
    var m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return ['#000000', 1];
    var v = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return ['#' + v.slice(0, 3).map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join('').toUpperCase(), v.length > 3 ? v[3] : 1];
  }
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  // ---------- 抠图模式：画面外扩 M，背景透明 ----------
  function captureMode() {
    var st = document.createElement('style'); st.id = 'aex-mode';
    st.textContent = 'html,body{width:' + (1920 + 2 * M) + 'px!important;height:' + (1080 + 2 * M) + 'px!important;background:transparent!important}' +
      '.frame{left:' + M + 'px!important;top:' + M + 'px!important;right:auto!important;bottom:auto!important;overflow:visible!important;background:transparent!important}';
    document.head.appendChild(st);
  }
  function box(el) { var R = el.getBoundingClientRect(); return [R.left - M, R.top - M, R.width, R.height]; }

  // ---------- 文字 ----------
  var isInline = function (el) { var d = getComputedStyle(el).display; return d === 'inline' || d === 'contents'; };
  function blockOf(tn) { var e = tn.parentElement; while (e && isInline(e) && e !== fr()) e = e.parentElement; return e; }
  function hiddenIn(el, stop) {
    for (var x = el; x && x !== stop.parentElement; x = x.parentElement) { var s = getComputedStyle(x); if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.02) return true; }
    return false;
  }
  function opOf(el) { var o = 1; for (var x = el; x && x !== fr(); x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; }
  // 一组字（同一个块、同一个 node）→ 一个或几个 AE 文字层描述
  function layoutGroup(chars, blk, errs) {
    var lines = [], cur = null, cs = getComputedStyle(blk);
    chars.forEach(function (c) {
      var rg = document.createRange(); rg.setStart(c.tn, c.k); rg.setEnd(c.tn, c.k + c.len); var R = rg.getBoundingClientRect();
      if (R.width === 0 && R.height === 0) return;                       // 折叠掉的空白
      var st = getComputedStyle(c.el), fs = parseFloat(st.fontSize), b = R.top + ascent(st) - M;
      if (!cur || Math.abs(b - cur.base) > fs * 0.4) { cur = { base: b, chars: [], l: R.left - M, r: R.right - M }; lines.push(cur); }
      cur.l = Math.min(cur.l, R.left - M); cur.r = Math.max(cur.r, R.right - M);
      var ch = c.ch; if (st.textTransform === 'uppercase') ch = ch.toUpperCase();
      var w = parseInt(st.fontWeight, 10) || 400, f = /\s/.test(ch) ? null : faceFor(st.fontFamily, w, ch);
      if (!f && !/\s/.test(ch)) errs.push('缺字形：「' + ch + '」（' + st.fontFamily + ' ' + w + '）不在随包字体里，AE 会换成别的字体');
      var fill = st.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)/.test(st.webkitTextFillColor) ? st.webkitTextFillColor : st.color, col = hex(fill);
      var ls = st.letterSpacing === 'normal' ? 0 : parseFloat(st.letterSpacing);
      cur.chars.push({ ch: ch, f: f, size: r1(fs), color: col[0], a: col[1], track: Math.round(ls / fs * 1000), faux: !!(f && w >= 600 && f.weight < 600), el: c.el });
    });
    lines = lines.filter(function (L) { while (L.chars.length && /\s/.test(L.chars[L.chars.length - 1].ch)) L.chars.pop(); while (L.chars.length && /\s/.test(L.chars[0].ch)) L.chars.shift(); return L.chars.length; });
    if (!lines.length) return [];
    var near = function (a) { return a.every(function (v) { return Math.abs(v - a[0]) <= 1.5; }); };
    var gaps = lines.slice(1).map(function (L, i) { return L.base - lines[i].base; });
    var ta = cs.textAlign, jAlign = ta === 'center' ? 'center' : (ta === 'right' || ta === 'end') ? 'right' : 'left', align;
    if (lines.length === 1) align = jAlign;
    else if (!near(gaps)) align = null;
    else if (jAlign === 'center' && near(lines.map(function (L) { return (L.l + L.r) / 2; }))) align = 'center';
    else if (near(lines.map(function (L) { return L.l; }))) align = 'left';
    else if (near(lines.map(function (L) { return L.r; }))) align = 'right';
    else if (near(lines.map(function (L) { return (L.l + L.r) / 2; }))) align = 'center';
    else align = null;
    var groups = align ? [lines] : lines.map(function (L) { return [L]; });
    return groups.map(function (ls) {
      var text = '', runs = [], alphas = [];
      ls.forEach(function (L, li) {
        if (li) text += '\r';
        L.chars.forEach(function (c) {
          var ps = c.f ? c.f.ps : (runs.length ? runs[runs.length - 1].font : FACES[0].ps), i = text.length, last = runs[runs.length - 1];
          text += c.ch; alphas.push(c.a);
          if (last && last.e === i && last.font === ps && last.size === c.size && last.color === c.color && last.track === c.track && last.faux === c.faux) last.e = text.length;
          else runs.push({ s: i, e: text.length, font: ps, size: c.size, color: c.color, track: c.track, faux: c.faux });
        });
      });
      var a = ls.length === 1 ? (align || 'left') : align, L0 = ls[0];
      var x = a === 'center' ? (L0.l + L0.r) / 2 : a === 'right' ? L0.r : L0.l;
      var op = opOf(ls[0].chars[0].el) * (alphas.every(function (v) { return Math.abs(v - alphas[0]) < 0.01; }) ? alphas[0] : 1);
      return { text: text, align: a, x: r1(x), y: r1(L0.base), lead: ls.length > 1 ? r1(ls[1].base - ls[0].base) : 0, runs: runs, op: Math.round(op * 100) / 100,
        box: [r1(Math.min.apply(null, ls.map(function (L) { return L.l; }))), r1(L0.base - L0.chars[0].size), r1(Math.max.apply(null, ls.map(function (L) { return L.r - L.l; }))), r1(ls[ls.length - 1].base - L0.base + L0.chars[0].size * 1.3)] };
    });
  }
  // root 下的所有文字，按（块，所属 node）分组
  function textsOf(roots, nodeOf, errs) {
    var groups = [], key = new Map();
    roots.forEach(function (root) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), tn;
      while ((tn = w.nextNode())) {
        if (!tn.data.trim() || !tn.parentElement || tn.parentElement.closest('svg,style,script')) continue;
        if (hiddenIn(tn.parentElement, root)) continue;
        var blk = blockOf(tn), d = getComputedStyle(blk).display, gk = /flex|grid/.test(d) && tn.parentElement === blk ? tn : blk;
        var nd = nodeOf(tn.parentElement), k = key.get(gk); if (!k) { k = new Map(); key.set(gk, k); }
        var g = k.get(nd); if (!g) { g = { blk: blk, node: nd, chars: [] }; k.set(nd, g); groups.push(g); }
        var s = tn.data, i = 0;
        while (i < s.length) { var cp = s.codePointAt(i), len = cp > 0xFFFF ? 2 : 1; g.chars.push({ tn: tn, k: i, len: len, ch: s.substr(i, len), el: tn.parentElement }); i += len; }
      }
    });
    var out = [];
    groups.forEach(function (g) { layoutGroup(g.chars, g.blk, errs).forEach(function (t) { t.node = g.node; out.push(t); }); });
    return out;
  }

  // ---------- 拆镜头 ----------
  function describe(cover) {
    setCover(cover); captureMode();
    var H = window.H, P = SHOT.plan(H), errs = [], units = [], seq = 0;
    P.forEach(function (p, ui) {
      var u = p.u; if (u.kind === 'sc') { units.push({ ui: ui, kind: 'sc', id: u.id, name: '录屏窗口', z: parseInt(getComputedStyle(u.el).zIndex, 10) || 0, nodes: [] }); return; }   // 录屏另导（export_shots.js）
      if (u.kind === 'todo') { errs.push(u.id + '：待补组件不能进 AE 包'); return; }
      var root = u.el, tilt = 0, cs = getComputedStyle(root);
      if (cs.rotate && cs.rotate !== 'none') { tilt = parseFloat(cs.rotate) || 0; root.style.rotate = '0deg'; }
      var uname = (KIND_CN[u.kind] || u.kind) + (u.kind === 'amb' ? '_' + (u.name || u.id) : u.kind === 'bokeh' || u.kind === 'lines' || u.kind === 'sub' ? '' : '_' + u.id) + (u.ic && u.kind === 'ic' ? '_' + u.ic : '');
      var nodes = [{ el: root, fx: null, at: p.at, o: null, i: 0, name: uname }];
      p.parts.forEach(function (q) { nodes.push({ el: q.el, fx: q.fx, at: q.at, o: q.o, i: q.i || 0, sibling: !!q.sibling, role: q.el.dataset ? q.el.dataset.role : '' }); });
      var cnt = {};
      nodes.forEach(function (n, j) {
        n.id = 'n' + (seq++); n.el.dataset.aexn = n.id;
        if (j) { var rn = n.sibling ? '引线' : (ROLE_CN[n.role] || n.role || '部件'); cnt[rn] = (cnt[rn] || 0) + 1; n.name = uname + '·' + rn + cnt[rn]; }
      });
      var byEl = new Map(nodes.map(function (n) { return [n.el, n]; }));
      var nearest = function (el, skipGraphic) {
        for (var x = el; x; x = x.parentElement) { var n = byEl.get(x); if (n && !(skipGraphic && GRAPHIC_FX[n.fx])) return n; if (x === root) break; }
        return nodes[0];
      };
      nodes.forEach(function (n, j) {
        n.parent = j && !n.sibling ? nearest(n.el.parentElement, false).id : null;
        if (n.fx === 'maskUp') { var mk = n.el.closest('.bm-mask'); if (mk) n.matte = box(mk).map(r1); }
        if (n.fx === 'countUp') n.to = n.el.dataset.to;
      });
      var roots = [root].concat(nodes.filter(function (n) { return n.sibling; }).map(function (n) { return n.el; }));
      var texts = textsOf(roots, function (el) { return byEl.get(el) && !GRAPHIC_FX[byEl.get(el).fx] ? byEl.get(el) : nearest(el, true); }, errs);
      nodes.forEach(function (n) {
        n.texts = texts.filter(function (t) { return t.node === n; }).map(function (t) { delete t.node; return t; });
        // 抠图范围：自己 + 不属于子 node 的后代，外扩 PAD（投影）
        var rs = [n.el].concat([].slice.call(n.el.querySelectorAll('*')).filter(function (x) { return nearest(x, false) === n; })).map(function (x) { return x.getBoundingClientRect(); }).filter(function (R) { return R.width > 0 && R.height > 0; });
        if (!rs.length) { n.clip = null; return; }
        var x0 = Math.min.apply(null, rs.map(function (R) { return R.left; })) - PAD, y0 = Math.min.apply(null, rs.map(function (R) { return R.top; })) - PAD;
        var x1 = Math.max.apply(null, rs.map(function (R) { return R.right; })) + PAD, y1 = Math.max.apply(null, rs.map(function (R) { return R.bottom; })) + PAD;
        x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(1920 + 2 * M, Math.ceil(x1)); y1 = Math.min(1080 + 2 * M, Math.ceil(y1));
        n.clip = x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
      });
      var rb = box(root), z = parseInt(cs.zIndex, 10) || 0;
      units.push({ ui: ui, kind: u.kind, id: u.id, name: uname, src: u.src || null, z: z, tilt: tilt, pivot: [r1(rb[0] + rb[2] / 2), r1(rb[1] + rb[3] / 2)], fx: p.fx, at: p.at, o: p.o,
        nodes: nodes.map(function (n) { return { id: n.id, name: n.name, box: box(n.el).map(r1), parent: n.parent, sibling: !!n.sibling, fx: n.fx, at: n.at, o: n.o, i: n.i, matte: n.matte || null, to: n.to || null, clip: n.clip, texts: n.texts }; }) });
    });
    units.sort(function (a, b) { return a.z - b.z || a.ui - b.ui; });
    return { units: units, errs: errs, M: M, out: H.spec.out != null ? H.spec.out : null };
  }

  // 只露出一个 node：别的全藏，子 node 藏，字抠掉
  // hide：再额外藏掉的后代（选择器，如录屏窗口里的原片和标注，只留边框）
  function isolate(id, hide) {
    var st = document.getElementById('aex-iso') || document.head.appendChild(document.createElement('style')); st.id = 'aex-iso';
    [].forEach.call(document.querySelectorAll('[data-aexx]'), function (k) { k.removeAttribute('data-aexx'); });   // 上一个 node 留下的标记先清掉
    var el = document.querySelector('[data-aexn="' + id + '"]'), kids = [].slice.call(el.querySelectorAll('[data-aexn]' + (hide ? ',' + hide : '')));
    kids.forEach(function (k) { k.setAttribute('data-aexx', ''); });
    var me = '#fr [data-aexn="' + id + '"]';       // 带上 #fr：选择器优先级要高过「#fr * 全藏」
    st.textContent = '#fr *{visibility:hidden!important}' + me + ',' + me + ' *{visibility:visible!important}' +
      '#fr [data-aexx],#fr [data-aexx] *{visibility:hidden!important}' + me + ',' + me + ' *{-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}';
  }
  function restore() { var st = document.getElementById('aex-iso'); if (st) st.textContent = ''; [].forEach.call(document.querySelectorAll('[data-aexx]'), function (k) { k.removeAttribute('data-aexx'); }); }
  // 单个元素（录屏标签、联动引线）：{texts, clip, box}，不拆部件
  function single(el, id) {
    el.dataset.aexn = id; var errs = [];
    var texts = textsOf([el], function () { return id; }, errs).map(function (t) { delete t.node; return t; });
    var R = el.getBoundingClientRect();
    var x0 = Math.max(0, Math.floor(R.left - PAD)), y0 = Math.max(0, Math.floor(R.top - PAD)), x1 = Math.min(1920 + 2 * M, Math.ceil(R.right + PAD)), y1 = Math.min(1080 + 2 * M, Math.ceil(R.bottom + PAD));
    return { texts: texts, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, box: box(el).map(r1), errs: errs };
  }
  return { describe: describe, isolate: isolate, restore: restore, single: single, box: box, M: M };
})();
