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
 *
 * 1.8 丰富度：多数组件加了 en（英文副标，装饰小字）和 icon（libs/icons 的线性图标，先引入 libs/icons/icons.js）；
 * 新增图解组件 ring / flow / nest / wall / vtrack / layers / crowd / zoom；IC.callout(镜头, {from, to, label, en, hot}) 画引线标注；
 * render 的 o.tilt = 倾斜角度（度）。
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
  // 1.8 丰富度：英文副标（装饰小字，data-role=decor，每张卡 ≤ 6 处）和线性图标（libs/icons，全局 ICONS）
  function enl(s, cls) { return s ? '<div class="ic-en' + (cls ? ' ' + cls : '') + '" data-role="decor">' + esc(s) + '</div>' : ''; }
  function svgOf(n) { var I = (typeof self !== 'undefined' && self.ICONS) || (typeof window !== 'undefined' && window.ICONS) || {}; return I[n] || ''; }
  function ico(n, box, cls) {
    if (!n) return '';
    return '<div class="ic-icon' + (cls ? ' ' + cls : '') + '" data-role="stk" style="left:' + r8(box[0]) + 'px;top:' + r8(box[1]) + 'px;width:' + r8(box[2]) + 'px;height:' + r8(box[2]) + 'px">' + svgOf(n) + '</div>';
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
    fields: { title: '标题（\\n 换行，[[ ]] 色块）', kicker: '英文小标注（可省；属于装饰小字层）', sub: '副标题一行（可省）', bar: '标题下的朱橙短线（true / false）', fs: '标题字号（默认 120，104–280）' },
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
    fields: { word: '关键词（2–6 字）', exp: '一句白话解释（[[ ]] 色块）', idx: '编号（可省，如 01）', img: '贴纸路径（可省，放右侧）', en: '英文副标（可省，装饰小字）', icon: '线性图标名（可省，libs/icons；放右上，有贴纸时不用）' },
    beats: { in: '卡片 rise → 关键词 maskUp → 解释 rise → 贴纸 drop', emph: '解释里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var hasImg = d.img || d.imgPh, tw = hasImg ? w * 0.6 : w;
      var wf = clamp(Math.min(h * 0.36, (tw - 2 * pad) / units(d.word) * 0.98), 72, 200);
      return '<div class="ic-body"' + (hasImg ? ' style="padding-right:' + r8(w * 0.4) + 'px"' : '') + '>' +
        (d.idx ? part('ic-num ic-idx', esc(d.idx), clamp(h * 0.14, MIN, 72), MIN, ' data-role="text"') : '') +
        part('ic-heavy ic-word', masked(d.word), wf, 72) + enl(d.en) +
        (d.exp ? part('ic-text ic-exp', rich(d.exp), clamp(h * 0.13, MIN, 68), MIN, ' data-role="text"') : '') +
        '</div>' + stk(d, [w * 0.6, h * 0.12, w * 0.36, h * 0.76]) +
        (!hasImg && d.icon ? ico(d.icon, [w - pad - Math.min(h * 0.24, 96), pad, Math.min(h * 0.24, 96)]) : '');
    }
  };

  C.define = {
    name: '定义卡', tone: 'card', sizes: 'L / XL（或不小于 720×384 的槽位）',
    fields: { term: '名词', def: '定义（1–3 行，[[ ]] 色块）', eq: '连接词（默认「是」）', en: '英文副标（可省）' },
    beats: { in: '左侧竖条 unfold → 名词 maskUp → 连接词、定义 rise', emph: '定义里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      return '<div class="ic-rule" data-role="rule"></div><div class="ic-body">' +
        part('ic-heavy ic-term', masked(d.term), clamp(h * 0.2, 64, 132), MIN) + enl(d.en) +
        part('ic-text ic-eq', esc(d.eq || '是'), clamp(h * 0.12, MIN, 64), MIN, ' data-role="text"') +
        part('ic-text ic-def', rich(d.def), clamp(h * 0.13, MIN, 68), MIN, ' data-role="text"') +
        '</div>';
    }
  };

  C.stat = {
    name: '数字卡', tone: 'card', sizes: 'S / M / L（或任意槽位，数字随高度放大）',
    fields: { value: '数字（字符串，如 "12,000" "0.3" "403"）', unit: '单位（可省）', label: '这个数字是什么', note: '补充一行（可省，示意数据要标）', en: '英文副标（可省）' },
    beats: { in: '卡片 rise → 数字 countUp → 说明 rise', emph: '色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var rows = 1 + (d.label ? 1 : 0) + (d.note ? 1 : 0);
      var nf = clamp(Math.min((h - 2 * pad) * (rows === 1 ? 0.8 : rows === 2 ? 0.6 : 0.5), (w - 2 * pad) / (String(d.value).length * 0.62 + (d.unit ? 0.9 * String(d.unit).length * 0.5 : 0))), 72, 320);
      return '<div class="ic-body">' +
        '<div class="ic-row">' + part('ic-num', esc(d.value), nf, MIN, ' data-role="num" data-to="' + esc(d.value) + '"') +
        (d.unit ? part('ic-unit', esc(d.unit), Math.max(MIN, nf * 0.36), MIN) : '') + '</div>' +
        (d.label ? part('ic-text ic-lab', rich(d.label), clamp(h * 0.12, MIN, 68), MIN, ' data-role="text"') : '') + enl(d.en) +
        (d.note ? part('ic-text ic-note', rich(d.note), MIN, MIN, ' data-role="text"') : '') +
        '</div>';
    }
  };

  C.step = {
    name: '步骤卡', tone: 'card', sizes: 'S / M / L（或任意槽位；当前步 tone: hot）',
    fields: { idx: '编号（01）', name: '步骤名（2–6 字）', desc: '一句说明（可省）', img: '贴纸路径（可省，放右上）', en: '英文副标（可省）', icon: '线性图标名（可省，放右上，有贴纸时不用）', step: '把编号写成装饰小字「STEP 01 / 06」（可省，写总数，如 6）' },
    beats: { in: '卡片 rise（多张按编号错开 0.12s）→ 贴纸 drop', emph: '当前步：朱橙底 blockSweep（hot 卡）', out: 'sink' },
    html: function (d, w, h, pad) {
      var hasImg = d.img || d.imgPh, iw = Math.min(w * 0.42, h * 0.58), is = Math.min(h * 0.28, 84);   // 贴纸在右上，名字在底部，可以从贴纸下面穿过
      var idx = d.step ? enl('STEP ' + d.idx + ' / ' + String(d.step).padStart(2, '0'), 'ic-stepno') : part('ic-num ic-idx', esc(d.idx), clamp(h * 0.18, MIN, 80), MIN, ' data-role="text"');
      return '<div class="ic-body">' + idx +
        '<div>' + part('ic-heavy ic-name', masked(d.name), clamp(h * 0.24, 56, 100), MIN) + enl(d.en) +
        (d.desc ? part('ic-text ic-desc', rich(d.desc), MIN, MIN, ' data-role="text"') : '') + '</div>' +
        '</div>' + stk(d, [w - iw - pad * 0.6, pad * 0.6, iw, iw]) + (!hasImg && d.icon ? ico(d.icon, [w - is - pad * 0.8, pad * 0.8, is]) : '');
    }
  };

  C.chip = {
    name: '对比芯片', tone: 'card', sizes: 'M / L（两片并排，中间放「VS」标注）。判断那一片用 hot；aux（克莱因蓝）只用在 B 场或 S / M 小片——炭黑场里不放大块蓝色',
    fields: { name: '概念名（2–6 字）', sub: '一句话（可省）', img: '贴纸路径（可省，放在芯片上方探出）', en: '英文副标（可省）', icon: '线性图标名（可省，放在名字上方）' },
    beats: { in: '左片 rise，右片晚 0.15s rise；贴纸 drop', emph: '判断那一片 hot 底 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      return '<div class="ic-body">' + (d.icon ? '<div class="ic-icon ic-inl" data-role="stk" style="width:' + r8(Math.min(h * 0.2, 76)) + 'px;height:' + r8(Math.min(h * 0.2, 76)) + 'px">' + svgOf(d.icon) + '</div>' : '') +
        part('ic-heavy ic-name', masked(d.name), clamp(Math.min(h * 0.34, (w - 2 * pad) / units(d.name)), 64, 136), MIN) + enl(d.en) +
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
        winBar(d.title) +
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

  /* ---------- 第二批 ---------- */
  function winBar(title) {   // 窗口标题栏：朱橙 + 两个奶油白圆点 + 等宽标题（终端卡、截图框共用）
    return '<div class="ic-bar"><i></i><i></i><i></i>' + (title ? '<span data-fs="' + MIN + '" data-min="' + MIN + '" style="font-size:' + MIN + 'px">' + esc(title) + '</span>' : '') + '</div>';
  }
  // 图标用 SVG 画（不是文字，不受 52px 下限约束）；描边跟随文字色
  var ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/></svg>'
  };
  function isHl(s) { return /^\[\[.*\]\]$/.test(String(s)); }
  function unHl(s) { return String(s).replace(/^\[\[|\]\]$/g, ''); }

  C.quote = {
    name: '引用卡', tone: 'card', sizes: 'M / L / XL（L：原话 2 行 + 出处一行 ≤ 12 字）',
    fields: { text: '引用的原话（1–3 行，[[ ]] 色块）', src: '出处（可省；新闻公告类标「示意」）' },
    beats: { in: '卡片 rise → 引号、原话、出处依次 rise', emph: '原话里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-body">' +
        part('ic-qm', '“', clamp(h * 0.24, 80, 180), 80, ' data-role="text"') +
        part('ic-text ic-qt', rich(d.text), clamp(h * 0.14, MIN, 80), MIN, ' data-role="text"') +
        (d.src ? part('ic-text ic-src', '— ' + rich(d.src), MIN, MIN, ' data-role="text"') : '') + '</div>';
    }
  };

  C.list = {
    name: '清单卡', tone: 'card', sizes: 'L / XL（3–6 项）',
    fields: { title: '清单标题（可省）', items: '项目数组：字符串，或 {text, state}；state = done 打勾 / now 当前项（整行朱橙）/ 省略为未做' },
    beats: { in: '卡片 rise → 标题 maskUp → 各项依次 rise（错开 0.08s）', emph: '当前项的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var items = (d.items || []).map(function (x) { return typeof x === 'string' ? { text: x } : x; });
      var th = d.title ? clamp(Math.min(h * 0.13, (w - 2 * pad) / (units(d.title) + 0.4)), 56, 88) : 0;
      var mu = items.reduce(function (m, it) { return Math.max(m, units(String(it.text).replace(/\[\[|\]\]|\{\{|\}\}/g, ''))); }, 2);
      var fs = clamp(Math.min((h - 2 * pad - th * 1.4) / Math.max(1, items.length) / 1.55, (w - 2 * pad) / (mu + 1.6)), MIN, 72);
      return '<div class="ic-body">' + (d.title ? part('ic-heavy ic-lt', masked(d.title), th, MIN) : '') +
        '<div class="ic-items">' + items.map(function (it) {
          var st = it.state || 'todo', mk = st === 'done' ? ICON.check : st === 'now' ? ICON.arrow : '';
          return part('ic-it st-' + st + (st === 'now' ? ' bm-sweep' : ''), '<i class="mk">' + mk + '</i><span>' + rich(it.text) + '</span>', fs, MIN, ' data-role="' + (st === 'now' ? 'hl' : 'text') + '"');
        }).join('') + '</div></div>';
    }
  };

  C.tag = {
    name: '标签 / 胶囊', tone: 'lit', sizes: '高 72–120（排版里的 label 槽位）',
    fields: { text: '标签文字（2–8 字）', dot: '前面加一个重点色圆点（true / false）', icon: '前面加一个线性图标（可省）', en: '英文副标（可省，标签高 ≥ 104 时才放得下）' },
    beats: { in: 'rise（多个标签错开 0.1s）', emph: '—', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-body">' + part('ic-text ic-tg', (d.dot ? '<i class="dot"></i>' : '') + (d.icon ? '<i class="tico">' + svgOf(d.icon) + '</i>' : '') + rich(d.text), clamp(h * (d.en ? 0.4 : 0.56), MIN, 72), MIN, ' data-role="text"') + enl(d.en) + '</div>';
    }
  };

  C.shot = {
    name: '截图框', tone: 'dark', sizes: 'L / XL 或任意窗口槽位（核心录屏用 libs/screencast 的录屏窗口）',
    fields: { img: '截图路径（用户素材，保留原色）', title: '窗口标题（可省）', mark: '框选区域 [x, y, w, h]（0–1，相对截图区，可省）', note: '框选处的标注（可省）' },
    beats: { in: '窗口 rise → 框选 drop → 标注 rise', emph: '—', out: 'sink' },
    html: function (d) {
      var m = d.mark, mk = m ? '<div class="ic-mark" data-role="mk" style="left:' + m[0] * 100 + '%;top:' + m[1] * 100 + '%;width:' + m[2] * 100 + '%;height:' + m[3] * 100 + '%"></div>' : '';
      var note = d.note && m ? '<div class="ic-note" data-role="text" style="left:' + m[0] * 100 + '%;top:calc(' + (m[1] + m[3]) * 100 + '% + 14px)">' + part('', rich(d.note), MIN, MIN) + '</div>' : '';
      return '<div class="ic-body">' + winBar(d.title) + '<div class="ic-area">' +
        (d.img ? '<img src="' + esc(d.img) + '" alt="">' : '<div class="ph" data-role="decor">截图位</div>') + mk + note + '</div></div>';
    }
  };

  C.phone = {
    name: '手机屏幕', tone: 'none', sizes: '竖条槽位，宽 : 高 ≈ 1 : 2（如 432×816）',
    fields: { img: '屏幕截图（可省）', notes: '通知数组 [{app, text}]（没有截图时用，2–3 条）', time: '锁屏时间（可省，如 21:36）' },
    beats: { in: '手机 rise → 通知依次 rise（错开 0.25s）', emph: '通知里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h) {
      var pw = Math.min(w, Math.round(h * 0.5)), left = Math.round((w - pw) / 2);
      var inner = d.img ? '<img class="ic-scrimg" src="' + esc(d.img) + '" alt="">' :
        (d.time ? part('ic-num ic-time', esc(d.time), clamp(pw * 0.26, 72, 140), MIN, ' data-role="text"') : '') +
        (d.notes || []).map(function (n) {
          return '<div class="ic-noti" data-role="row">' + (n.app ? part('ic-text ic-app', esc(n.app), MIN, MIN) : '') + part('ic-text', rich(n.text), MIN, MIN) + '</div>';
        }).join('');
      return '<div class="ic-ph" data-role="box" style="left:' + left + 'px;width:' + pw + 'px"><div class="ic-scr">' + inner + '</div></div>';
    }
  };

  C.review = {
    name: 'AI 输出 vs 人工复核', tone: 'card', sizes: 'L / XL（2–4 行）',
    fields: { rows: '[{ai: "AI 的结论", human: "复核结果", ok: true | false}]；ok=false 时 AI 那句划掉', head: '表头（默认 ["AI 说", "人工复核"]）' },
    beats: { in: '卡片 rise → 表头 → 每行依次 rise（错开 0.25s）', emph: '—', out: 'sink' },
    html: function (d, w, h, pad) {
      var rows = d.rows || [], hd = d.head || ['说', '人工复核'];
      var fs = clamp((h - 2 * pad) / (rows.length + 1) / 1.7, MIN, 72);
      return '<div class="ic-body"><div class="ic-rv-head" data-role="text">' + part('ic-text', '<b class="ic-who">AI</b> ' + esc(hd[0]), MIN, MIN) + part('ic-text', esc(hd[1]), MIN, MIN) + '</div>' +
        rows.map(function (r) {
          return '<div class="ic-rv-row' + (r.ok === false ? ' no' : '') + '" data-role="row">' + part('ic-text ic-ai', rich(r.ai), fs, MIN) +
            part('ic-text ic-pill ' + (r.ok === false ? 'ghost' : 'hot'), (r.ok === false ? '✗ ' : '✓ ') + esc(r.human), fs, MIN) + '</div>';
        }).join('') + '</div>';
    }
  };

  C.jd = {
    name: '岗位 / JD 卡', tone: 'card', sizes: 'L 放 2 个短要求、XL 放 4–6 个（要求胶囊放不下会报溢出）',
    fields: { role: '岗位名', meta: '薪资 / 城市 / 年限一行（可省，示意数据要标）', reqs: '要求数组；用 [[ ]] 包住整条的那项高亮' },
    beats: { in: '卡片 rise → 岗位名 maskUp → 要求胶囊依次 rise（错开 0.06s）', emph: '高亮那项本来就是朱橙底', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-body">' + part('ic-heavy ic-role', masked(d.role), clamp(h * 0.15, 64, 104), MIN) +
        (d.meta ? part('ic-text ic-meta', rich(d.meta), MIN, MIN, ' data-role="text"') : '') +
        '<div class="ic-pills">' + (d.reqs || []).map(function (r) {
          return part('ic-text ic-pill ' + (isHl(r) ? 'hot' : 'ghost'), esc(unHl(r)), MIN, MIN, ' data-role="pill"');
        }).join('') + '</div></div>';
    }
  };

  C.skill = {
    name: '技能树节点', tone: 'card', sizes: 'S / M（节点之间的连线在配方里画）',
    fields: { name: '技能名（2–6 字）', lv: '编号 / 等级（可省）', state: 'done 已会（打勾）/ now 正在学（朱橙）/ lock 未解锁（虚线框）', pct: '进度 0–100（可省）' },
    beats: { in: '节点 rise', emph: '进度条从左画出 underline', out: 'sink' },
    html: function (d, w, h) {
      var st = d.state || 'done', glyph = st === 'done' ? '✓' : st === 'lock' ? '' : '';
      return '<div class="ic-body"><div class="ic-sk-top">' + (d.lv ? part('ic-num', esc(d.lv), clamp(h * 0.2, MIN, 72), MIN, ' data-role="text"') : '<span></span>') +
        (glyph ? part('ic-num ic-glyph', glyph, clamp(h * 0.2, MIN, 72), MIN, ' data-role="text"') : '') + '</div>' +
        part('ic-heavy ic-name', masked(d.name), clamp(h * 0.24, 56, 96), MIN) +
        (d.pct != null ? '<div class="ic-prog"><div class="ic-fill" data-role="bar" style="width:' + clamp(+d.pct, 0, 100) + '%"></div></div>' : '') + '</div>';
    }
  };

  var RISK = { '严重': 'r4', '高危': 'r3', '中危': 'r2', '低危': 'r1' };
  C.risk = {
    name: '风险卡', tone: 'card', sizes: 'M / L',
    fields: { level: '严重 / 高危 / 中危 / 低危', title: '风险名', impact: '影响一句话（可省）', score: '分数（可省，如 9.8）' },
    beats: { in: '卡片 rise → 顶部等级条 unfold → 风险名 maskUp → 影响 rise', emph: '分数 countUp', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-strip ' + (RISK[d.level] || 'r3') + '" data-role="rule">' + part('ic-heavy', esc(d.level || '高危'), MIN, MIN) +
        (d.score ? part('ic-num', esc(d.score), MIN, MIN, ' data-role="num" data-to="' + esc(d.score) + '"') : '') + '</div>' +
        '<div class="ic-body">' + part('ic-heavy ic-rt', masked(d.title), clamp(h * 0.17, 56, 96), MIN) +
        (d.impact ? part('ic-text ic-imp', rich(d.impact), clamp(h * 0.11, MIN, 64), MIN, ' data-role="text"') : '') + '</div>';
    }
  };

  C.verdict = {
    name: '结论卡', tone: 'lit', sizes: 'M / L / XL',
    fields: { text: '结论（1–2 行，[[ ]] 色块）', why: '理由一句（可省）', mark: '✓ / ✗ / !（默认 ✓）', en: '英文副标（可省）' },
    beats: { in: '卡片 rise → 圆形记号 drop → 结论 maskUp → 理由 rise', emph: '结论里的色块 blockSweep', out: 'sink' },
    html: function (d, w, h, pad) {
      var ms = Math.round(clamp(Math.min(h - 2 * pad, w * 0.26), 88, 220));
      return '<div class="ic-body"><div class="ic-mk" data-role="mk" style="width:' + ms + 'px;height:' + ms + 'px">' + part('ic-num', esc(d.mark || '✓'), ms * 0.56, MIN) + '</div>' +
        '<div class="ic-vt">' + part('ic-heavy', masked(d.text), clamp(h * 0.17, 56, 112), MIN) + enl(d.en) +
        (d.why ? part('ic-text ic-why', rich(d.why), MIN, MIN, ' data-role="text"') : '') + '</div></div>';
    }
  };

  C.tier = {
    name: '档位卡', tone: 'card', sizes: '宽条：高 160–240，宽 ≥ 720（多档竖排，讲到的那档换 hot）',
    fields: { level: '档名', desc: '说明一句（可省）', value: '数值（如 9.0–10）', band: '左侧色带 hot / aux / lit / card / dark（默认 hot）', img: '贴纸（可省，压在色带上）', en: '档名的英文（可省，跟在档名后）', score: '刻度条 0–10（可省，画在数值下面，带「CVSS」装饰小字）' },
    beats: { in: '票从下 rise（多张错开 0.12s）→ 贴纸 drop', emph: '讲到的那张换 hot', out: 'sink' },
    html: function (d, w, h, pad) {
      var bw = Math.round(Math.min(w * 0.2, h * 1.1));
      return '<div class="ic-band b-' + (d.band || 'hot') + '" style="width:' + bw + 'px"></div>' +
        '<div class="ic-body" style="padding-left:' + (bw + pad) + 'px"><div class="ic-mid">' +
        '<div class="ic-lvrow">' + part('ic-heavy', masked(d.level), clamp(h * 0.3, 56, 88), MIN) + enl(d.en) + '</div>' + (d.desc ? part('ic-text ic-desc', rich(d.desc), MIN, MIN, ' data-role="text"') : '') + '</div>' +
        '<div class="ic-right">' + (d.value ? part('ic-num ic-val', esc(d.value), clamp(h * 0.34, 56, 104), MIN, ' data-role="text"') : '') +
        (d.score != null ? '<div class="ic-scale">' + enl('CVSS') + '<div class="ic-ticks" data-role="bar">' + Array.from({ length: 10 }, function (_, k) { return '<i' + (k < Math.round(d.score) ? ' class="on"' : '') + '></i>'; }).join('') + '</div></div>' : '') + '</div></div>' +
        stk(d, [bw * 0.1, h * 0.1, bw * 0.8, h * 0.8]);
    }
  };

  C.lens = {
    name: '放大镜', tone: 'dark', shape: 'circle', sizes: '正方形槽位（≥ 384×384），圆形',
    fields: { text: '放大的字段（等宽，[[ ]] 色块）', label: '上方一句说明（可省）', note: '下方一句（可省）' },
    beats: { in: '圆 rise → 字段 maskUp', emph: '字段色块 blockSweep', out: 'sink' },
    html: function (d, w, h) {
      return '<div class="ic-body">' + (d.label ? part('ic-text ic-lb', rich(d.label), MIN, MIN, ' data-role="text"') : '') +
        part('ic-lt', masked(d.text), clamp(h * 0.14, 64, 150), MIN) + (d.note ? part('ic-text ic-nt', rich(d.note), MIN, MIN, ' data-role="text"') : '') + '</div>';
    }
  };

  /* ---------- 1.8 图解组件（知识可视化）：圆环、流转、嵌套、证据墙、竖向进度、分层、一群里的一个、局部放大 ---------- */
  // 都是 tone none（局部放大除外），在槽位矩形里用 SVG 画线 + 绝对定位的文字部件；有意义的字 ≥ 52px，英文副标是装饰小字
  var NS = 'http://www.w3.org/2000/svg';
  function svgWrap(w, h, inner) { return '<svg class="ic-svg" width="' + r8(w) + '" height="' + r8(h) + '" viewBox="0 0 ' + r8(w) + ' ' + r8(h) + '">' + inner + '</svg>'; }
  function at(x, y, html, cls) { return '<div class="ic-at' + (cls ? ' ' + cls : '') + '" style="left:' + r8(x) + 'px;top:' + r8(y) + 'px">' + html + '</div>'; }
  function head(x, y, ang, L) { L = L || 16; return 'M' + x + ' ' + y + ' L' + (x - L * Math.cos(ang - .45)) + ' ' + (y - L * Math.sin(ang - .45)) + ' M' + x + ' ' + y + ' L' + (x - L * Math.cos(ang + .45)) + ' ' + (y - L * Math.sin(ang + .45)); }
  function pillBox(text, en, cls) { return '<div class="ic-pillbox' + (cls ? ' ' + cls : '') + '">' + part('ic-text', rich(text), MIN, MIN, ' data-role="text"') + enl(en) + '</div>'; }
  function tico(n) { return n ? '<i class="tico">' + svgOf(n) + '</i>' : ''; }
  function winBar2(t) { return '<div class="ic-bar sm"><i></i><i></i><i></i>' + (t ? '<span class="ic-en" data-role="decor">' + esc(t) + '</span>' : '') + '</div>'; }

  C.ring = {
    name: '圆环图', tone: 'none', sizes: '宽 ≥ 1000、高 ≥ 600（左右各约 300px 放标签）',
    fields: { center: '中心名词', centerEn: '中心英文（可省）', items: '[{name, en, pct, hot}]，3–6 类；pct 可省（等分）；hot = 本期那一类（朱橙、外移）' },
    beats: { in: '整体 rise → 标签依次 rise', emph: '本期那一段是朱橙（唯一焦点）', out: 'sink' },
    html: function (d, w, h) {
      var it = d.items || [], sum = it.reduce(function (s, x) { return s + (+x.pct || 0); }, 0);
      var Ro = Math.min(h / 2 - 24, w / 2 - 280), Ri = Ro * 0.6, cx = w / 2, cy = h / 2, a0 = -90, g = '', out = '';   // 两侧各留约 280px 给标签（标签可以略出槽位）
      it.forEach(function (x) {
        var share = sum ? (+x.pct || 0) / sum : 1 / it.length, a1 = a0 + share * 360, am = (a0 + a1) / 2, mid = am * Math.PI / 180, off = x.hot ? 16 : 0;
        var ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
        var P = function (r, a) { return [r8(cx + ox + r * Math.cos(a * Math.PI / 180)), r8(cy + oy + r * Math.sin(a * Math.PI / 180))]; };
        var s0 = a0 + 1.1, s1 = a1 - 1.1, big = s1 - s0 > 180 ? 1 : 0;
        g += '<path class="seg' + (x.hot ? ' hot' : '') + '" d="M' + P(Ro, s0) + ' A' + r8(Ro) + ' ' + r8(Ro) + ' 0 ' + big + ' 1 ' + P(Ro, s1) + ' L' + P(Ri, s1) + ' A' + r8(Ri) + ' ' + r8(Ri) + ' 0 ' + big + ' 0 ' + P(Ri, s0) + 'Z"/>';
        var right = Math.cos(mid) >= -0.01, l1 = P(Ro + 10, am), l2 = P(Ro + 44, am), hx = l2[0] + (right ? 24 : -24);
        g += '<polyline class="ln' + (x.hot ? ' hot' : '') + '" points="' + l1 + ' ' + l2 + ' ' + hx + ',' + l2[1] + '"/><circle class="dt' + (x.hot ? ' hot' : '') + '" cx="' + l1[0] + '" cy="' + l1[1] + '" r="5"/>';
        out += at(right ? hx + 10 : hx - 10, l2[1] - 32, '<div class="ic-rl">' + part('ic-heavy', esc(x.name), MIN, MIN, ' data-role="text"') + (x.pct ? part('ic-pct' + (x.hot ? ' now' : ''), esc(x.pct) + '%', MIN, MIN) : '') + enl(x.en) + '</div>', right ? '' : 'rt');
        a0 = a1;
      });
      out += at(cx, cy, part('ic-heavy', esc(d.center), clamp(Ri * 0.38, 56, 96), MIN) + enl(d.centerEn), 'ctr');
      return '<div class="ic-dia">' + svgWrap(w, h, g) + out + '</div>';
    }
  };

  C.flow = {
    name: '徽章流转', tone: 'none', sizes: '宽条，高 ≥ 560（2–4 个节点横排；去程画在上沿，回程画在下沿虚线）',
    fields: { nodes: '[{name, en, icon, hot}]', links: '[{from, to, label, en, back}]；back = true 画在下沿（虚线）' },
    beats: { in: '节点依次 rise → 连线 → 胶囊 rise', emph: 'hot 节点是朱橙（唯一焦点）', out: 'sink' },
    html: function (d, w, h) {
      var ns = d.nodes || [], n = ns.length || 1, cy = h / 2, r = Math.min(w / n * 0.27, h / 2 - 130, 170);   // 上下各留约 130px 给连线胶囊
      var xs = ns.map(function (_, i) { return w * (i + 0.5) / n; }), g = '', out = '';
      ns.forEach(function (x, i) {
        g += '<circle class="ring" cx="' + r8(xs[i]) + '" cy="' + r8(cy) + '" r="' + r8(r + 24) + '"/>';
        var is = r * 0.4;
        out += '<div class="ic-node' + (x.hot ? ' hot' : '') + '" style="left:' + r8(xs[i] - r) + 'px;top:' + r8(cy - r) + 'px;width:' + r8(2 * r) + 'px;height:' + r8(2 * r) + 'px">' +
          (x.icon ? '<div class="ic-icon ic-inl" style="width:' + r8(is) + 'px;height:' + r8(is) + 'px">' + svgOf(x.icon) + '</div>' : '') +
          part('ic-heavy', esc(x.name), clamp(r * 0.4, MIN, 72), MIN) + enl(x.en) + '</div>';
      });
      (d.links || []).forEach(function (l) {
        var a = xs[l.from], b = xs[l.to], dir = b > a ? 1 : -1, back = !!l.back, y = back ? cy + r * 0.72 : cy - r * 0.72, qy = back ? cy + r + 150 : cy - r - 150;
        var x1 = a + dir * r * 0.72, x2 = b - dir * r * 0.72, qx = (x1 + x2) / 2, ang = Math.atan2(y - qy, x2 - qx);
        g += '<path class="ln' + (back ? ' dash' : '') + '" d="M' + r8(x1) + ' ' + r8(y) + ' Q' + r8(qx) + ' ' + r8(qy) + ' ' + r8(x2) + ' ' + r8(y) + '"/><path class="ln hd" d="' + head(r8(x2), r8(y), ang) + '"/>';
        out += at(qx, back ? cy + r + 66 : cy - r - 66, pillBox(l.label, l.en), 'ctr');
      });
      return '<div class="ic-dia">' + svgWrap(w, h, g) + out + '</div>';
    }
  };

  C.nest = {
    name: '嵌套归属', tone: 'none', sizes: '宽 ≥ 1000、高 ≥ 600（外框里 2 个区域）',
    fields: { outer: '外框 {name, en}', zones: '[{name, en, session: {text, icon}, items: [{text, icon}]}]', cross: '越界箭头 {from: 会话所在区域号, to: [区域号, 资源号], label, en}（朱橙，唯一焦点）' },
    beats: { in: '外框 → 区域 → 资源依次 rise', emph: '越界箭头画出 + 边界打叉', out: 'sink' },
    html: function (d, w, h) {
      var Z = d.zones || [], n = Z.length || 1, top = 96, gap = 64, zw = (w - 80 - gap * (n - 1)) / n, zh = h - top - 40, out = '', g = '', pos = {}, o = d.outer || {};
      g += '<rect class="outer" x="2" y="2" width="' + r8(w - 4) + '" height="' + r8(h - 4) + '" rx="36"/>';
      out += at(40, 24, '<div class="ic-hrow">' + part('ic-heavy', esc(o.name || ''), MIN, MIN) + enl(o.en) + '</div>');
      Z.forEach(function (z, i) {
        var x = 40 + i * (zw + gap), items = z.items || [];
        out += '<div class="ic-zone" style="left:' + r8(x) + 'px;top:' + top + 'px;width:' + r8(zw) + 'px;height:' + r8(zh) + 'px"><div class="ic-zh">' + part('ic-heavy', esc(z.name), MIN, MIN) + enl(z.en) + '</div></div>';
        if (z.session) {
          var sx = x + 32, sy = top + 160, sw = units(z.session.text) * 52 + (z.session.icon ? 60 : 0) + 64;
          out += at(sx, sy, '<div class="ic-pillbox row">' + tico(z.session.icon) + part('ic-text', esc(z.session.text), MIN, MIN) + '</div>');
          pos['s' + i] = [sx + sw, sy + 48];
        }
        items.forEach(function (it, k) {
          var ih = 120, iy = top + zh - 32 - (items.length - k) * (ih + 20) + 20, ix = x + 32, iw = zw - 64;
          out += '<div class="ic-res" style="left:' + r8(ix) + 'px;top:' + r8(iy) + 'px;width:' + r8(iw) + 'px;height:' + ih + 'px">' + tico(it.icon) + part('ic-text', esc(it.text), MIN, MIN) + '</div>';
          pos['r' + i + '_' + k] = [ix, iy + ih / 2, iw, iy];
        });
      });
      var c = d.cross, s = c && pos['s' + c.from], t = c && pos['r' + c.to[0] + '_' + c.to[1]];
      if (s && t) {
        var fwd = t[0] > s[0], x1 = s[0] + 8, y1 = s[1], x2 = fwd ? t[0] : t[0] + t[2], y2 = t[1], bx = 40 + zw + gap / 2;
        var mx = 0.125 * (x1 + x2) + 0.75 * bx, my = (y1 + y2) / 2;
        g += '<rect class="mk" x="' + r8(t[0]) + '" y="' + r8(t[3]) + '" width="' + r8(t[2]) + '" height="120" rx="22"/>' +
             '<path class="ln hot thick" d="M' + r8(x1) + ' ' + r8(y1) + ' C' + r8(bx) + ' ' + r8(y1) + ' ' + r8(bx) + ' ' + r8(y2) + ' ' + r8(x2) + ' ' + r8(y2) + '"/><path class="ln hot thick" d="' + head(r8(x2), r8(y2), fwd ? 0 : Math.PI, 20) + '"/>' +
             '<circle class="xmk" cx="' + r8(mx) + '" cy="' + r8(my) + '" r="24"/><path class="xmkx" d="M' + r8(mx - 9) + ' ' + r8(my - 9) + ' l18 18 M' + r8(mx + 9) + ' ' + r8(my - 9) + ' l-18 18"/>';
        out += at(mx + 34, my - 60, enl('BOUNDARY'));
        if (c.label) out += at(t[0] + t[2] / 2, top + 150, pillBox(c.label, c.en), 'ctr-x');
      }
      return '<div class="ic-dia">' + svgWrap(w, h, g) + out + '</div>';
    }
  };

  C.wall = {
    name: '证据墙', tone: 'none', sizes: '宽 ≥ 1000、高 ≥ 600（3–5 张截图，倾斜叠放）',
    fields: { shots: '[{img, title}]（最后一张在最上面、不倾斜，是焦点）', mark: '焦点截图上的框选 [x, y, w, h]（0–1，可省）', note: '框选处的标注（可省，朱橙胶囊 + 引线）' },
    beats: { in: '截图依次 rise（错开 0.12s）→ 框选 drop → 标注 rise', emph: '—', out: 'sink' },
    html: function (d, w, h) {
      var S = d.shots || [], n = S.length, ww = w * 0.46, hh = Math.min(ww * 0.62, h * 0.48), out = '', g = '';
      var spots = [[0, 0.02, -4], [0.54, 0, 3], [0.02, 0.5, 3], [0.54, 0.46, -3]];
      S.forEach(function (s, i) {
        var last = i === n - 1, sw = last ? ww * 1.14 : ww, sh = last ? hh * 1.14 : hh, x, y, r;
        if (last) { x = (w - sw) / 2; y = (h - sh) / 2 - h * 0.05; r = 0; } else { var sp = spots[i % 4]; x = sp[0] * w; y = sp[1] * h; r = sp[2]; }
        out += '<div class="ic-sw" style="left:' + r8(x) + 'px;top:' + r8(y) + 'px;width:' + r8(sw) + 'px;height:' + r8(sh) + 'px;rotate:' + r + 'deg">' + winBar2(s.title) + '<div class="ic-area">' + (s.img ? '<img src="' + esc(s.img) + '" alt="">' : '') + '</div></div>';
        if (last && d.mark) {
          var m = d.mark, bx = x + m[0] * sw, by = y + 44 + m[1] * (sh - 44), bw = m[2] * sw, bh = m[3] * (sh - 44);
          g += '<rect class="mk" x="' + r8(bx) + '" y="' + r8(by) + '" width="' + r8(bw) + '" height="' + r8(bh) + '" rx="8"/>';
          if (d.note) {
            var ex = Math.min(w - 160, bx + bw + 90), ey = h - 46;
            g += '<polyline class="ln hot" points="' + r8(bx + bw) + ',' + r8(by + bh / 2) + ' ' + r8(ex) + ',' + r8(by + bh / 2) + ' ' + r8(ex) + ',' + r8(ey - 44) + '"/><circle class="dt hot" cx="' + r8(ex) + '" cy="' + r8(ey - 44) + '" r="7"/>';
            out += at(ex, ey, '<div class="ic-pillbox hot">' + part('ic-text', rich(d.note), MIN, MIN) + '</div>', 'ctr');
          }
        }
      });
      return '<div class="ic-dia">' + out + svgWrap(w, h, g) + '</div>';
    }
  };

  C.vtrack = {
    name: '竖向进度', tone: 'none', sizes: '竖条，宽 ≥ 400，每项约 88px',
    fields: { items: '步骤名数组', now: '当前项序号（从 0 起）', en: '顶部装饰小字（可省，如 PROGRESS · 03 / 06）' },
    beats: { in: '节点自上而下依次 rise', emph: '当前项朱橙（炭黑场字也是朱橙，奶油白场字保持炭黑）', out: 'sink' },
    html: function (d, w, h) {
      var it = d.items || [], n = it.length, top = d.en ? 60 : 8, gap = Math.min(96, (h - top - 60) / Math.max(1, n - 1)), g = '', out = d.en ? at(0, 0, enl(d.en)) : '';
      it.forEach(function (s, i) {
        var y = top + 30 + i * gap, st = i < d.now ? 'done' : i === d.now ? 'now' : 'next';
        if (i < n - 1) g += '<line class="tk' + (i < d.now ? ' on' : '') + '" x1="14" y1="' + r8(y) + '" x2="14" y2="' + r8(y + gap) + '"/>';
        if (st === 'now') g += '<circle class="glow" cx="14" cy="' + r8(y) + '" r="26"/>';
        g += '<circle class="nd ' + st + '" cx="14" cy="' + r8(y) + '" r="' + (st === 'now' ? 14 : 8) + '"/>';
        out += at(52, y - 31, part('ic-heavy' + (st === 'now' ? ' ic-now' : ' dim'), esc(s), MIN, MIN, ' data-role="text"'));
      });
      return '<div class="ic-dia">' + svgWrap(w, h, g) + out + '</div>';
    }
  };

  C.layers = {
    name: '分层结构', tone: 'none', sizes: '宽 ≥ 900、高 ≥ 600（2–4 层，从上到下；左边是等距层板，右边是引线标签）',
    fields: { layers: '[{name, en, icon, hit, desc}]；hit = 出问题的那层（朱橙）' },
    beats: { in: '层板自下而上依次 rise（炸开）→ 引线 → 标签', emph: 'hit 那层朱橙', out: 'sink' },
    html: function (d, w, h) {
      var L = d.layers || [], n = L.length, pw = Math.min(w * 0.46, h * 0.66), ph = pw * 0.5, th = 22, cx = pw / 2 + 20;
      var step = n > 1 ? (h - ph - th - 40) / (n - 1) : 0, g = '', out = '', lx = pw + 140;
      var pts = function (a) { return a.map(function (p) { return r8(p[0]) + ',' + r8(p[1]); }).join(' '); };
      for (var i = n - 1; i >= 0; i--) {   // 从下往上画，上层压住下层
        var y = 20 + i * step, x = L[i];
        g += '<polygon class="side" points="' + pts([[cx - pw / 2, y + ph / 2], [cx, y + ph], [cx, y + ph + th], [cx - pw / 2, y + ph / 2 + th]]) + '"/>' +
             '<polygon class="side r" points="' + pts([[cx, y + ph], [cx + pw / 2, y + ph / 2], [cx + pw / 2, y + ph / 2 + th], [cx, y + ph + th]]) + '"/>' +
             '<polygon class="face' + (x.hit ? ' hot' : '') + '" points="' + pts([[cx, y], [cx + pw / 2, y + ph / 2], [cx, y + ph], [cx - pw / 2, y + ph / 2]]) + '"/>';
        var ly = y + ph / 2;
        g += '<polyline class="ln' + (x.hit ? ' hot' : '') + '" points="' + r8(cx + pw / 2 + 10) + ',' + r8(ly) + ' ' + r8(lx - 24) + ',' + r8(ly) + '"/><circle class="dt' + (x.hit ? ' hot' : '') + '" cx="' + r8(cx + pw / 2 + 10) + '" cy="' + r8(ly) + '" r="5"/>';
        if (x.icon) out += at(cx, ly, '<div class="ic-icon ic-inl' + (x.hit ? ' on-hot' : '') + '" style="width:' + r8(ph * 0.34) + 'px;height:' + r8(ph * 0.34) + 'px">' + svgOf(x.icon) + '</div>', 'ctr');
        out += at(lx, ly - 34, '<div class="ic-rl">' + part('ic-heavy', x.hit ? '<span class="blk">' + esc(x.name) + '</span>' : esc(x.name), MIN, MIN, ' data-role="text"') + enl(x.en) + (x.desc ? part('ic-text dim', rich(x.desc), MIN, MIN, ' data-role="text"') : '') + '</div>');
      }
      return '<div class="ic-dia">' + svgWrap(w, h, g) + out + '</div>';
    }
  };

  C.crowd = {
    name: '一群里的一个', tone: 'none', sizes: '任意，网格自动排',
    fields: { rows: '行数（默认 4）', cols: '列数（默认 7）', odd: '不一样的那个的序号', icon: '普通图标（默认 user-round）', oddIcon: '不一样那个的图标（默认同 icon）' },
    beats: { in: '方块依次 rise（自左上到右下）', emph: '不一样的那个变朱橙', out: 'sink' },
    html: function (d, w, h) {
      var R = d.rows || 4, Cn = d.cols || 7, gp = 18, s = Math.min((w - gp * (Cn - 1)) / Cn, (h - gp * (R - 1)) / R), ox = (w - (s * Cn + gp * (Cn - 1))) / 2, oy = (h - (s * R + gp * (R - 1))) / 2, out = '';
      for (var i = 0; i < R * Cn; i++) {
        var odd = i === d.odd;
        out += '<div class="ic-tile' + (odd ? ' hot' : '') + '" style="left:' + r8(ox + (i % Cn) * (s + gp)) + 'px;top:' + r8(oy + Math.floor(i / Cn) * (s + gp)) + 'px;width:' + r8(s) + 'px;height:' + r8(s) + 'px">' +
          '<div class="ic-icon ic-inl" style="width:' + r8(s * 0.5) + 'px;height:' + r8(s * 0.5) + 'px">' + svgOf(odd ? (d.oddIcon || d.icon || 'user-round') : (d.icon || 'user-round')) + '</div></div>';
      }
      return '<div class="ic-dia">' + out + '</div>';
    }
  };

  C.zoom = {
    name: '局部放大', tone: 'dark', shape: 'circle', sizes: '正方形槽位（≥ 320×320），圆形',
    fields: { icon: '放大的图标', label: '一句说明（可省）', en: '英文副标（可省）' },
    beats: { in: '圆 rise → 图标 drop', emph: '—', out: 'sink' },
    html: function (d, w, h) {
      var s = Math.min(w, h) * 0.34;
      return '<div class="ic-body ic-zoomb"><div class="ic-icon ic-inl" data-role="stk" style="width:' + r8(s) + 'px;height:' + r8(s) + 'px">' + svgOf(d.icon) + '</div>' + (d.label ? part('ic-heavy', rich(d.label), MIN, MIN) : '') + enl(d.en) + '</div>';
    }
  };

  // 引线标注：从画面里的一个点拉折线到标签胶囊（不是卡片，直接挂到镜头上）。o = { from: [x, y], to: [x, y], label, en, hot }
  function callout(frame, o) {
    var f = o.from, t = o.to, right = t[0] >= f[0], knee = [t[0] - (right ? 40 : -40), t[1]], hot = !!o.hot;
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'ic-co-svg'); s.setAttribute('width', 1920); s.setAttribute('height', 1080);
    s.innerHTML = '<polyline class="ln' + (hot ? ' hot' : '') + '" points="' + f[0] + ',' + f[1] + ' ' + knee[0] + ',' + knee[1] + ' ' + t[0] + ',' + t[1] + '"/><circle class="dt' + (hot ? ' hot' : '') + '" cx="' + f[0] + '" cy="' + f[1] + '" r="6"/>';
    frame.appendChild(s);
    var p = document.createElement('div');
    p.className = 'ic ic-callout t-' + (hot ? 'hot' : 'card') + (right ? '' : ' rt');
    p.dataset.ic = 'callout'; p.dataset.fit = 'ok'; p.dataset.label = 'callout ' + o.label;
    p.style.cssText = 'left:' + t[0] + 'px;top:' + t[1] + 'px';
    p.innerHTML = part('ic-text', rich(o.label), MIN, MIN, ' data-role="text"') + enl(o.en);
    frame.appendChild(p);
    return p;
  }

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
    var w = rect[2], h = rect[3], tone = o.tone || (type === 'skill' ? ({ now: 'hot', lock: 'ghost' }[d.state] || 'card') : c.tone);
    var pad = tone === 'none' ? 0 : r8(clamp(Math.min(w, h) * 0.1, 24, 48));
    var el = document.createElement('div');
    el.className = 'ic ic-' + type + ' t-' + tone;
    el.dataset.ic = type; el.dataset.tone = tone;
    el.style.cssText = 'left:' + rect[0] + 'px;top:' + rect[1] + 'px;width:' + w + 'px;height:' + h + 'px;--pad:' + pad + 'px;--r:' + radius(w, h) + 'px';
    if (o.shape === 'circle' || c.shape === 'circle') el.classList.add('shape-circle');
    if (c.shape === 'circle') el.style.setProperty('--pad', r8(Math.min(w, h) * 0.15) + 'px');
    if (o.tilt) el.style.rotate = o.tilt + 'deg';   // 倾斜（1.8）：用独立的 rotate 属性，和动效写的 transform 叠加，不会被覆盖
    el.innerHTML = c.html(d, w, h, pad);
    return el;
  }

  // 自动缩放：所有 data-fs 部件同比缩小，直到卡片里放得下；每个部件不低于自己的 data-min。放不下就标 data-fit="overflow"
  function overflowing(el) {
    // 图解组件（.ic-dia）本来就有倾斜、外侧标签，允许略出槽位；只查每个文字部件自己放不放得下（画面边界由预览脚本另查）
    var b = el.querySelector('.ic-dia') ? null : (el.querySelector('.ic-body') || el);
    if (b && (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1)) return true;
    if (!b) b = el;
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
  // 入场时间表：卡片里每个会动的元素什么时候、用哪个动效入场。网页（animate）和 AE 导出（ae/export_shots.js）都读这一份。
  // 返回 [{el, fx, at, o, i}]：第一项是卡片本身（fx 为 null 表示不动，如无底卡的标题）
  function plan(el, cue) {
    var t0 = cue.in || 0, te = cue.emph != null ? cue.emph : t0 + 0.5, boxed = el.dataset.tone !== 'none';
    var q = function (s) { return [].slice.call(el.querySelectorAll(s)); }, P = [{ el: el, fx: boxed ? 'rise' : null, at: t0 }];
    var add = function (s, fx, at, o) { q(s).forEach(function (e, i) { P.push({ el: e, fx: fx, at: typeof at === 'function' ? at(i) : at, o: o || null, i: i }); }); };
    var lt = t0 + (boxed ? 0.1 : 0), nd = q('[data-role="decor"]').length;
    add('[data-role="decor"]', 'rise', t0, { dy: 24 });
    add('[data-role="line"]', 'maskUp', lt + (nd ? 0.12 : 0));
    add('[data-role="text"]', 'rise', function (i) { return lt + 0.18 + i * 0.08; }, { dy: 24 });
    add('[data-role="tline"]', 'rise', function (i) { return lt + 0.15 + i * 0.08; }, { dy: 16 });
    add('[data-role="msg"]', 'rise', function (i) { return t0 + i * (cue.gap || 0.7); });
    add('[data-role="stk"]', 'drop', t0 + 0.15);
    add('[data-role="row"]', 'rise', function (i) { return lt + 0.2 + i * 0.25; }, { dy: 24 });
    add('[data-role="pill"]', 'rise', function (i) { return lt + 0.25 + i * 0.06; }, { dy: 16 });
    add('[data-role="mk"]', 'drop', lt + 0.2);
    add('[data-role="box"]', 'rise', t0);
    add('[data-role="rule"]', 'unfold', t0);
    add('[data-role="bar"]', 'underline', te);
    add('[data-role="hl"]', 'blockSweep', function (i) { return te + i * 0.15; });
    add('[data-role="num"]', 'countUp', lt + 0.1);
    return P;
  }
  function animate(el, t, cue) {
    var BM = (typeof self !== 'undefined' && self.BM) || (typeof window !== 'undefined' && window.BM);
    if (!BM) throw new Error('IC：先引入 engine/motion/motion.js');
    plan(el, cue).forEach(function (p, k) {
      if (k === 0) { BM.set(el, p.fx ? BM.rise(t, p.at) : {}, cue.out != null ? BM.sink(t, cue.out) : {}); return; }
      if (p.fx === 'countUp') { var to = p.el.dataset.to, v = parseFloat(String(to).replace(/,/g, '')); BM.text(p.el, isNaN(v) ? to : fmtNum(BM.countUp(t, p.at, 0, v), to)); return; }
      BM.set(p.el, p.fx === 'maskUp' ? BM.maskUp(t, p.at, p.i) : BM[p.fx](t, p.at, p.o || undefined));
    });
    return el;
  }

  function spec() {
    var out = {};
    Object.keys(C).forEach(function (k) { var c = C[k]; out[k] = { name: c.name, tone: c.tone, shape: c.shape || 'rect', sizes: c.sizes, fields: c.fields, beats: c.beats }; });
    return out;
  }

  return { render: render, fit: fit, animate: animate, plan: plan, spec: spec, types: Object.keys(C), SIZE: SIZE, MIN: MIN, rich: rich, callout: callout };
});
