/* cards/infocards/infocards.js — 信息卡库（P4，全新编写，不含 lieflat / 挖洞号代码）
 *
 * 一张信息卡 = 一个组件函数：吃内容（data）+ 槽位矩形（rect，来自 cards/layouts/*.json 或尺寸档 S–XL）+ 底色（tone），
 * 吐出一个 div.ic。字号按槽位大小算，再用 IC.fit 自动缩到放得下（每个文字部件有下限，有意义的文字 ≥ 52px）。
 * 动效只用 engine/motion/ 的 BM 预设，IC.animate(el, t, cue) 是时间 t 的纯函数，可逐帧确定性渲染。
 *
 *   const el = IC.render('keyword', { word: '提示词注入', exp: '让 AI [[听错话]]' }, { rect: [64, 216, 720, 384], tone: 'card' });
 *   scene.appendChild(el); IC.fit(el);
 *   window.renderAt = t => IC.animate(el, t, { in: 0.3, emph: 1.0, out: 4.2 });
 *
 * 行内标记：[[重点色块]]（朱橙块 + 炭黑字，色块扫入）  {{重点字}}（场景重点色）  `等宽`
 * tone：card 场景默认卡 · lit 亮卡（卡片白）· hot 当前项（朱橙）· aux 辅助（克莱因蓝）· dark 深色（终端）· none 无底
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IC = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MIN = 52, TITLE_MIN = 104, DECOR_MIN = 18;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rich(s) {
    return esc(s)
      .replace(/\[\[(.+?)\]\]/g, '<span class="blk bm-sweep" data-role="hl">$1</span>')
      .replace(/\{\{(.+?)\}\}/g, '<span class="acc">$1</span>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // 字宽估算：汉字算 1 个字宽，拉丁字母 / 数字 / 空格算 0.6（只用来定初始字号，最终由 IC.fit 量实际宽度）
  function units(s) { return Math.max(2, [].slice.call(String(s == null ? '' : s)).reduce(function (n, c) { return n + (/[\u0000-\u00ff]/.test(c) ? 0.6 : 1); }, 0)); }
  function r8(v) { return Math.round(v); }
  // 一个可缩放的文字部件：data-fs = 最大字号，data-min = 下限
  function part(cls, html, fs, min, extra) {
    return '<div class="' + cls + '" data-fs="' + r8(fs) + '" data-min="' + (min || MIN) + '"' + (extra || '') + ' style="font-size:' + r8(fs) + 'px">' + html + '</div>';
  }
  function lines(s) { return String(s == null ? '' : s).split('\n'); }
  function masked(s, cls) {   // 每行包一层遮罩，入场用 maskUp
    return lines(s).map(function (l) { return '<span class="bm-mask"><span data-role="line"' + (cls ? ' class="' + cls + '"' : '') + '>' + rich(l) + '</span></span>'; }).join('');
  }
  function stk(d, box) {      // 贴纸 / 图片位：d.img = 路径；没有图时画占位框（只在预览里出现）
    if (!d.img && !d.imgPh) return '';
    var st = 'left:' + r8(box[0]) + 'px;top:' + r8(box[1]) + 'px;width:' + r8(box[2]) + 'px;height:' + r8(box[3]) + 'px';
    return d.img ? '<img class="ic-stk" data-role="stk" src="' + esc(d.img) + '" style="' + st + '">'
                 : '<div class="ic-stk ph" data-role="stk" style="' + st + '">' + esc(d.imgPh) + '</div>';
  }
  function fmtNum(v, like) {  // 按目标值的格式（小数位、千分位）写数字
    var s = String(like), dec = (s.split('.')[1] || '').replace(/[^0-9]/g, '').length, comma = s.indexOf(',') >= 0;
    var out = v.toFixed(dec);
    if (comma) { var p = out.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); out = p.join('.'); }
    return out;
  }

  /* ---------- 组件 ---------- */
  // 每个组件：spec（给文档和配方用）+ html(d, w, h) 返回内部 HTML
  var C = {};

  C.title = {
    name: '标题组', tone: 'none', sizes: '宽 ≥ 480；高 ≥ 128',
    fields: { title: '标题（\\n 换行，[[ ]] 色块）', kicker: '英文小标注（可省；每屏最多一处）', sub: '副标题一行（可省）', bar: '标题下的朱橙短线（true / false）', fs: '标题字号（默认 120，104–280）' },
    beats: { in: '小标注 rise → 标题逐行 maskUp → 副标题 rise', emph: '[[ ]] 色块扫入 blockSweep；朱橙短线 underline', out: '整体 sink' },
    html: function (d, w, h) {
      var fs = clamp(d.fs || 120, TITLE_MIN, 280);
      return '<div class="ic-body">' +
        (d.kicker ? '<div class="kick" data-role="decor">' + esc(d.kicker) + '</div>' : '') +
        part('ic-t', masked(d.title), fs, TITLE_MIN) +
        (d.sub ? part('ic-sub', rich(d.sub), clamp(fs * 0.5, MIN, 72), MIN, ' data-role="text"') : '') +
        (d.bar ? '<div class="ic-bar" data-role="bar" style="width:' + r8(Math.min(w, fs * 4)) + 'px"></div>' : '') +
        '</div>';
    }
  };

  C.keyword = {
    name: '关键词卡', tone: 'card', sizes: 'M / L / XL（或不小于 528×288 的槽位）',
    fields: { word: '关键词（2–6 字）', exp: '一句白话解释（[[ ]] 色块）', idx: '编号（可省，如 01）', img: '贴纸路径（可省，放右侧）' },
    beats: { in: '卡片 rise → 关键词 maskUp → 解释 rise → 贴纸 drop', emph: '解释里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var hasImg = d.img || d.imgPh, tw = hasImg ? w * 0.6 : w;
      var wf = clamp(Math.min(h * 0.36, (tw - 2 * pad) / units(d.word) * 0.98), 72, 200);
      return '<div class="ic-body"' + (hasImg ? ' style="padding-right:' + r8(w * 0.4) + 'px"' : '') + '>' +
        (d.idx ? part('ic-num ic-idx', esc(d.idx), clamp(h * 0.14, MIN, 72), MIN, ' data-role="text"') : '') +
        part('ic-heavy ic-word', masked(d.word), wf, 72) +
        (d.exp ? part('ic-text ic-exp', rich(d.exp), clamp(h * 0.13, MIN, 68), MIN, ' data-role="text"') : '') +
        '</div>' + stk(d, [w * 0.6, h * 0.12, w * 0.36, h * 0.76]);
    }
  };

  C.define = {
    name: '定义卡', tone: 'card', sizes: 'L / XL（或不小于 720×384 的槽位）',
    fields: { term: '名词', def: '定义（1–3 行，[[ ]] 色块）', eq: '连接词（默认「是」）' },
    beats: { in: '左侧竖条 unfold → 名词 maskUp → 连接词、定义 rise', emph: '定义里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      return '<div class="ic-rule" data-role="rule"></div><div class="ic-body">' +
        part('ic-heavy ic-term', masked(d.term), clamp(h * 0.2, 64, 132), MIN) +
        part('ic-text ic-eq', esc(d.eq || '是'), clamp(h * 0.12, MIN, 64), MIN, ' data-role="text"') +
        part('ic-text ic-def', rich(d.def), clamp(h * 0.13, MIN, 68), MIN, ' data-role="text"') +
        '</div>';
    }
  };

  C.stat = {
    name: '数字卡', tone: 'card', sizes: 'S / M / L（或任意槽位，数字随高度放大）',
    fields: { value: '数字（字符串，如 "12,000" "0.3" "403"）', unit: '单位（可省）', label: '这个数字是什么', note: '补充一行（可省，示意数据要标）' },
    beats: { in: '卡片 rise → 数字 countUp → 说明 rise', emph: '色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var rows = 1 + (d.label ? 1 : 0) + (d.note ? 1 : 0);
      var nf = clamp(Math.min((h - 2 * pad) * (rows === 1 ? 0.8 : rows === 2 ? 0.6 : 0.5), (w - 2 * pad) / (String(d.value).length * 0.62 + (d.unit ? 0.9 * String(d.unit).length * 0.5 : 0))), 72, 320);
      return '<div class="ic-body">' +
        '<div class="ic-row">' + part('ic-num', esc(d.value), nf, MIN, ' data-role="num" data-to="' + esc(d.value) + '"') +
        (d.unit ? part('ic-unit', esc(d.unit), Math.max(MIN, nf * 0.36), MIN) : '') + '</div>' +
        (d.label ? part('ic-text ic-lab', rich(d.label), clamp(h * 0.12, MIN, 68), MIN, ' data-role="text"') : '') +
        (d.note ? part('ic-text ic-note', rich(d.note), MIN, MIN, ' data-role="text"') : '') +
        '</div>';
    }
  };

  C.step = {
    name: '步骤卡', tone: 'card', sizes: 'S / M / L（或任意槽位；当前步 tone: hot）',
    fields: { idx: '编号（01）', name: '步骤名（2–6 字）', desc: '一句说明（可省）', img: '贴纸路径（可省，放右上）' },
    beats: { in: '卡片 rise（多张按编号错开 0.12s）→ 贴纸 drop', emph: '当前步：朱橙底 blockSweep（hot 卡）', out: 'sink' },
    html: function (d, w, h, pad) {
      var hasImg = d.img || d.imgPh, iw = Math.min(w * 0.42, h * 0.58);   // 贴纸在右上，名字在底部，可以从贴纸下面穿过
      return '<div class="ic-body">' +
        part('ic-num ic-idx', esc(d.idx), clamp(h * 0.18, MIN, 80), MIN, ' data-role="text"') +
        '<div>' + part('ic-heavy ic-name', masked(d.name), clamp(h * 0.24, 56, 100), MIN) +
        (d.desc ? part('ic-text ic-desc', rich(d.desc), MIN, MIN, ' data-role="text"') : '') + '</div>' +
        '</div>' + stk(d, [w - iw - pad * 0.6, pad * 0.6, iw, iw]);
    }
  };

  C.chip = {
    name: '对比芯片', tone: 'card', sizes: 'M / L（两片并排，中间放「VS」标注）。判断那一片用 hot；aux（克莱因蓝）只用在 B 场或 S / M 小片——炭黑场里不放大块蓝色',
    fields: { name: '概念名（2–6 字）', sub: '一句话（可省）', img: '贴纸路径（可省，放在芯片上方探出）' },
    beats: { in: '左片 rise，右片晚 0.15s rise；贴纸 drop', emph: '判断那一片 hot 底 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      return '<div class="ic-body">' +
        part('ic-heavy ic-name', masked(d.name), clamp(Math.min(h * 0.34, (w - 2 * pad) / units(d.name)), 64, 136), MIN) +
        (d.sub ? part('ic-text ic-sub', rich(d.sub), clamp(h * 0.14, MIN, 64), MIN, ' data-role="text"') : '') +
        '</div>';
    }
  };

  C.term = {
    name: '终端卡', tone: 'dark', sizes: 'L 放 3 行、XL 放 5 行（等宽 52px，L 一行约 21 字符、XL 约 34 字符；放不下就截短，不缩到 52px 以下）',
    fields: { title: '窗口标题（可省，如 Response · 200）', lines: '行数组；行首 "$ " 是命令提示符，行首 "# " 变淡；[[ ]] 标重点字段' },
    beats: { in: '窗口 rise → 逐行 rise（每行错开 0.08s）', emph: '重点字段色块 blockSweep', out: 'sink' },
    html: function (d, w, h) {
      var fs = 56;
      var ls = (d.lines || []).map(function (l) {
        var dim = /^# /.test(l), pr = /^\$ /.test(l);
        var body = pr ? '<span class="pr">$</span> ' + rich(l.slice(2)) : rich(l);
        return '<div class="ic-ln' + (dim ? ' dim' : '') + '" data-role="tline">' + body + '</div>';
      }).join('');
      return '<div class="ic-body">' +
        '<div class="ic-bar"><i></i><i></i><i></i>' + (d.title ? '<span data-fs="' + MIN + '" data-min="' + MIN + '" style="font-size:' + MIN + 'px">' + esc(d.title) + '</span>' : '') + '</div>' +
        part('ic-lines', ls, fs, MIN) + '</div>';
    }
  };

  C.chat = {
    name: 'AI 对话卡', tone: 'none', sizes: 'L / XL（2–4 条消息）',
    fields: { msgs: '消息数组 [{who:"me"|"ai", text}]；AI 那条左侧带「AI」标' },
    beats: { in: '消息依次 rise（间隔 cue.gap，默认 0.7s）', emph: '回答里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-body">' + (d.msgs || []).map(function (m) {
        return part('ic-msg ' + (m.who === 'ai' ? 'ai' : 'me'), (m.who === 'ai' ? '<b class="who">AI</b>' : '') + rich(m.text), 56, MIN, ' data-role="msg"');
      }).join('') + '</div>';
    }
  };

  /* ---------- 渲染 ---------- */
  var SIZE = { S: [336, 192], M: [528, 288], L: [720, 384], XL: [1104, 576] };
  // 圆角半径：min(宽,高) × 比例，夹在上下限之间（数值来自 tokens/brand.json → shape，经 engine/tokens.css 注入）
  function radius(w, h) {
    var cs = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    var g = function (k, d) { var v = cs && parseFloat(cs.getPropertyValue(k)); return isNaN(v) || v == null ? d : v; };
    return Math.round(clamp(Math.min(w, h) * g('--r-card-ratio', 0.12), g('--r-card-min', 28), g('--r-card-max', 64)));
  }
  function render(type, d, o) {
    var c = C[type]; if (!c) throw new Error('IC：没有这个信息卡 ' + type);
    o = o || {}; d = d || {};
    var rect = o.rect || [0, 0].concat(SIZE[o.size || 'L']);
    var w = rect[2], h = rect[3], tone = o.tone || c.tone;
    var pad = tone === 'none' ? 0 : r8(clamp(Math.min(w, h) * 0.1, 24, 48));
    var el = document.createElement('div');
    el.className = 'ic ic-' + type + ' t-' + tone;
    el.dataset.ic = type; el.dataset.tone = tone;
    el.style.cssText = 'left:' + rect[0] + 'px;top:' + rect[1] + 'px;width:' + w + 'px;height:' + h + 'px;--pad:' + pad + 'px;--r:' + radius(w, h) + 'px';
    if (o.shape === 'circle') el.classList.add('shape-circle');
    el.innerHTML = c.html(d, w, h, pad);
    return el;
  }

  // 自动缩放：所有 data-fs 部件同比缩小，直到卡片里放得下；每个部件不低于自己的 data-min。放不下就标 data-fit="overflow"
  function overflowing(el) {
    var b = el.querySelector('.ic-body') || el;
    if (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) return true;
    var ps = el.querySelectorAll('[data-fs]');
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].scrollWidth > ps[i].clientWidth + 1) return true;
      // 纵向只查会裁切的部件（如终端行区）；不裁切的部件字形上沿超出 1–2px 不算溢出
      if (getComputedStyle(ps[i]).overflowY !== 'visible' && ps[i].scrollHeight > ps[i].clientHeight + 1) return true;
    }
    var ls = el.querySelectorAll('.ic-ln,[data-role="line"]');
    for (i = 0; i < ls.length; i++) if (ls[i].scrollWidth > ls[i].clientWidth + 1) return true;
    return false;
  }
  function fit(el) {
    var ps = [].slice.call(el.querySelectorAll('[data-fs]'));
    var k = 1, ok = !overflowing(el);
    while (!ok && k > 0.2) {
      k -= 0.02;
      var floor = true;
      ps.forEach(function (p) {
        var v = Math.max(+p.dataset.min, Math.round(+p.dataset.fs * k));
        if (v > +p.dataset.min) floor = false;
        p.style.fontSize = v + 'px';
      });
      ok = !overflowing(el);
      if (floor) break;
    }
    el.dataset.fit = ok ? 'ok' : 'overflow';
    return ok;
  }

  /* ---------- 动效：纯函数 ---------- */
  // cue = { in: 入场时间, emph: 强调时间（可省，默认 in + 0.5）, out: 退场时间（可省）, gap: 消息间隔（chat） }
  function animate(el, t, cue) {
    var BM = (typeof self !== 'undefined' && self.BM) || (typeof window !== 'undefined' && window.BM);
    if (!BM) throw new Error('IC：先引入 engine/motion/motion.js');
    var t0 = cue.in || 0, te = cue.emph != null ? cue.emph : t0 + 0.5, type = el.dataset.ic, boxed = el.dataset.tone !== 'none';
    var q = function (s) { return [].slice.call(el.querySelectorAll(s)); };
    BM.set(el, boxed ? BM.rise(t, t0) : {}, cue.out != null ? BM.sink(t, cue.out) : {});
    var lt = t0 + (boxed ? 0.1 : 0);
    q('[data-role="decor"]').forEach(function (e) { BM.set(e, BM.rise(t, t0, { dy: 24 })); });
    q('[data-role="line"]').forEach(function (e, i) { BM.set(e, BM.maskUp(t, lt + (q('[data-role="decor"]').length ? 0.12 : 0), i)); });
    q('[data-role="text"]').forEach(function (e, i) { BM.set(e, BM.rise(t, lt + 0.18 + i * 0.08, { dy: 24 })); });
    q('[data-role="tline"]').forEach(function (e, i) { BM.set(e, BM.rise(t, lt + 0.15 + i * 0.08, { dy: 16 })); });
    q('[data-role="msg"]').forEach(function (e, i) { BM.set(e, BM.rise(t, t0 + i * (cue.gap || 0.7))); });
    q('[data-role="stk"]').forEach(function (e) { BM.set(e, BM.drop(t, t0 + 0.15)); });
    q('[data-role="rule"]').forEach(function (e) { BM.set(e, BM.unfold(t, t0)); });
    q('[data-role="bar"]').forEach(function (e) { BM.set(e, BM.underline(t, te)); });
    q('[data-role="hl"]').forEach(function (e, i) { BM.set(e, BM.blockSweep(t, te + i * 0.15)); });
    q('[data-role="num"]').forEach(function (e) {
      var to = e.dataset.to, v = parseFloat(String(to).replace(/,/g, ''));
      BM.text(e, isNaN(v) ? to : fmtNum(BM.countUp(t, lt + 0.1, 0, v), to));
    });
    return el;
  }

  function spec() {
    var out = {};
    Object.keys(C).forEach(function (k) { var c = C[k]; out[k] = { name: c.name, tone: c.tone, sizes: c.sizes, fields: c.fields, beats: c.beats }; });
    return out;
  }

  return { render: render, fit: fit, animate: animate, spec: spec, types: Object.keys(C), SIZE: SIZE, MIN: MIN, rich: rich };
});
