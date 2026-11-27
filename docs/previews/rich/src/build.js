// 丰富度改版（候选，未定稿）：6 张知识卡片按「每屏 10–15 个元素」重做，和现版对比
// node docs/previews/rich/src/build.js → docs/previews/rich/R-*.jpg、compare_1/2.jpg
// 用到的手段（白帽志自己的视觉语言，不搬挖洞号的纸纹 / 回形针 / 红黑配色）：
//   双语装饰小字 · 线性图标（Lucide，ISC 许可）· 引线标注 · 专属图形（圆环、徽章、嵌套框）· 倾斜叠放 · 焦点光晕 · 写实贴纸
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..'), OUT = path.resolve(__dirname, '..'), TMP = path.join(ROOT, 'out/rich');
fs.mkdirSync(TMP, { recursive: true });
const ICON = n => fs.readFileSync(path.join(ROOT, 'node_modules/lucide-static/icons', n + '.svg'), 'utf8').replace(/<!--.*?-->/s, '').replace(/class="[^"]*"/, '').replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
const ICONS = Object.fromEntries(['file-check', 'radar', 'cpu', 'search-check', 'file-text', 'hourglass', 'user-round', 'shield-check', 'building-2', 'file', 'x', 'key-round', 'circle-x', 'lock'].map(n => [n, ICON(n)]));

const HEAD = `<meta charset="utf-8"><base href="file://${ROOT}/">
<link rel="stylesheet" href="engine/tokens.css"><link rel="stylesheet" href="engine/base.css">
<script src="engine/motion/tokens.js"></script><script src="engine/motion/motion.js"></script><script src="libs/backgrounds/backgrounds.js"></script>
<style>
.a{position:absolute}
.t{font-family:var(--f-cn);font-weight:700;color:var(--s-title);white-space:nowrap;line-height:1.1}
.d{font-family:var(--f-disp);font-weight:400;color:var(--s-title);line-height:1.06;white-space:nowrap}
.n{font-family:var(--f-num);font-weight:900;line-height:1;white-space:nowrap}
.m{font-family:var(--f-mono);font-weight:600;white-space:nowrap}
.dim{opacity:.64}
.en{font:500 19px/1 var(--f-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--s-title);opacity:.45;white-space:nowrap}
.kick{font:500 22px/1 var(--f-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--s-title);opacity:.55;white-space:nowrap}
.card{background:var(--slate);border-radius:28px;box-shadow:inset 0 0 0 1.5px rgba(245,238,223,.09),0 36px 72px rgba(0,0,0,.38)}
.paper{background:var(--paper);border-radius:28px;box-shadow:0 18px 40px rgba(90,40,10,.12),0 0 0 1.5px rgba(22,19,15,.05)}
.hot{background:var(--orange)!important;color:var(--char)!important;box-shadow:0 36px 72px rgba(0,0,0,.38),0 0 0 10px rgba(255,90,31,.12)}
.hot .t,.hot .en,.hot .m,.hot .n{color:var(--char)}
.pill{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:999px;background:var(--slate);box-shadow:inset 0 0 0 1.5px rgba(245,238,223,.12),0 18px 36px rgba(0,0,0,.3)}
.ic{color:var(--cream)}.ic svg{display:block}
.win{background:var(--slate);border-radius:22px;overflow:hidden;box-shadow:inset 0 0 0 1.5px rgba(245,238,223,.1),0 36px 70px rgba(0,0,0,.45)}
.win .bar{height:44px;display:flex;align-items:center;gap:9px;padding:0 18px}.win .bar i{width:11px;height:11px;border-radius:50%;background:rgba(245,238,223,.25)}.win .bar i:first-child{background:var(--orange)}
.win .bar span{margin-left:10px;font:500 18px/1 var(--f-mono);letter-spacing:.14em;color:var(--cream);opacity:.5;text-transform:uppercase}
.win img{display:block;width:100%;height:calc(100% - 44px);object-fit:cover;object-position:0 0}
svg.ov{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.sub{z-index:50}
</style>`;

// 每张卡的画面（页面里执行）。约定：装饰小字一律 .en / .kick（data-role=decor），有意义的字 ≥ 52px
const FRAMES = {
/* ---------------- K01 票据档位（B 奶油白场）---------------- */
'K01': `
  BGLIB.mount(fr, 'BG2', 'libs/backgrounds/');
  T('kick', 64, 150, 'SEVERITY · 漏洞定级');
  T('d', 64, 190, '提交之前，<br>先定个级', 'font-size:104px');
  T('t dim', 64, 470, '平台按危害分档，<br>档位越高，赏金越高', 'font-size:52px;line-height:1.4');
  T('en', 64, 640, 'CVSS v3.1 · 0.0 – 10.0');
  const R = [['严重', 'CRITICAL', '能控制服务器', '9.0–10', 9.5, 'lock_open'], ['高危', 'HIGH', '能读别人的数据', '7.0–8.9', 8, 'bug'],
             ['中危', 'MEDIUM', '要一定条件', '4.0–6.9', 5.5, 'key'], ['低危', 'LOW', '影响有限', '0.1–3.9', 2, 'lock_closed']];
  R.forEach(([lv, en, desc, val, sc, pic], i) => {
    const hot = i === 1, x = hot ? 600 : 640, y = 136 + i * 180, w = 1216 + (hot ? 40 : 0), h = 160;
    const row = box('paper', x, y, w, h, hot ? 'box-shadow:0 30px 60px rgba(90,40,10,.22),0 0 0 3px var(--orange)' : '');
    const band = add('div', 'a', 'left:0;top:0;width:176px;height:' + h + 'px;border-radius:28px 0 0 28px;background:' + (hot ? 'var(--orange)' : 'var(--char)'), '', row);
    img('cards/images/samples/bmz_' + pic + '.png', 18, 10, 140, 140, band);
    add('div', 't', 'position:absolute;left:208px;top:22px;font-size:60px;color:var(--char)', lv, row);
    add('div', 'en', 'position:absolute;left:' + (208 + lv.length * 62 + 18) + 'px;top:48px;color:var(--char)', en, row).dataset.role = 'decor';
    add('div', 't dim', 'position:absolute;left:208px;top:94px;font-size:52px;color:var(--char)', desc, row);
    add('div', 'n', 'position:absolute;right:48px;top:22px;font-size:72px;color:var(--char)', val, row);
    // 刻度条：10 格，按分数填充（装饰图形）
    const bar = add('div', 'a', 'right:48px;top:116px;width:300px;height:14px;display:flex;gap:4px', '', row);
    for (let k = 0; k < 10; k++) add('i', '', 'flex:1;border-radius:3px;background:' + (k < Math.round(sc) ? (hot ? 'var(--orange)' : 'var(--char)') : 'rgba(22,19,15,.12)'), '', bar);
    add('div', 'en', 'position:absolute;right:360px;top:113px;color:var(--char)', 'CVSS', row).dataset.role = 'decor';
  });
  sub('提交之前，先看它值<em>几级</em>');`,

/* ---------------- K02 圆环定义 ---------------- */
'K02': `
  const cx = 660, cy = 500, Ro = 280, Ri = 170;
  BGLIB.mount(fr, 'BG3', 'libs/backgrounds/', { focus: [cx, cy, 1.1] });
  const S = [['水平越权', 'HORIZONTAL', 40], ['垂直越权', 'VERTICAL', 25], ['未授权', 'UNAUTH', 20], ['越权下载', 'FILE ACCESS', 15]];
  let a0 = -90; const g = ov();
  S.forEach(([nm, en, pct], i) => {
    const a1 = a0 + pct * 3.6, hot = i === 0, mid = (a0 + a1) / 2 * Math.PI / 180, off = hot ? 18 : 0;
    const ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
    const arc = (r, a) => [cx + ox + r * Math.cos(a * Math.PI / 180), cy + oy + r * Math.sin(a * Math.PI / 180)];
    const s0 = a0 + 1.2, s1 = a1 - 1.2, big = s1 - s0 > 180 ? 1 : 0;
    const [x1, y1] = arc(Ro, s0), [x2, y2] = arc(Ro, s1), [x3, y3] = arc(Ri, s1), [x4, y4] = arc(Ri, s0);
    sv(g, 'path', { d: 'M' + x1 + ' ' + y1 + ' A' + Ro + ' ' + Ro + ' 0 ' + big + ' 1 ' + x2 + ' ' + y2 + ' L' + x3 + ' ' + y3 + ' A' + Ri + ' ' + Ri + ' 0 ' + big + ' 0 ' + x4 + ' ' + y4 + 'Z',
      fill: hot ? 'var(--orange)' : 'var(--slate)', stroke: hot ? 'none' : 'rgba(245,238,223,.12)', 'stroke-width': 1.5 });
    const [px, py] = arc((Ro + Ri) / 2, (a0 + a1) / 2);
    T('n', px - 60, py - 26, pct + '%', 'font-size:52px;width:120px;text-align:center;color:' + (hot ? 'var(--char)' : 'var(--cream)'));
    // 引线 + 外侧标签
    const right = Math.cos(mid) >= 0, [lx, ly] = arc(Ro + 14, (a0 + a1) / 2), [ex, ey] = arc(Ro + 70, (a0 + a1) / 2), hx = ex + (right ? 40 : -40);
    sv(g, 'polyline', { points: lx + ',' + ly + ' ' + ex + ',' + ey + ' ' + hx + ',' + ey, fill: 'none', stroke: hot ? 'var(--orange)' : 'rgba(245,238,223,.4)', 'stroke-width': 2 });
    sv(g, 'circle', { cx: lx, cy: ly, r: 5, fill: hot ? 'var(--orange)' : 'var(--cream)' });
    const tx = right ? hx + 14 : hx - 14;
    T('t', tx, ey - 40, nm, 'font-size:52px;' + (right ? '' : 'transform:translateX(-100%)'));
    T('en', tx, ey + 22, en, right ? '' : 'transform:translateX(-100%)');
    a0 = a1;
  });
  T('t', cx - 100, cy - 52, '越权', 'font-size:72px;width:200px;text-align:center');
  T('en', cx - 100, cy + 34, 'IDOR', 'width:200px;text-align:center');
  T('kick', 1320, 170, 'ACCESS CONTROL · 越权分类');
  T('d', 1320, 210, '越权，<br>分四种', 'font-size:104px');
  const c = box('card', 1320, 500, 536, 330);
  add('div', 'en', 'position:absolute;left:40px;top:36px', 'THIS EPISODE · 本期', c).dataset.role = 'decor';
  add('div', 't', 'position:absolute;left:40px;top:80px;font-size:64px', '水平越权', c);
  add('div', 't dim', 'position:absolute;left:40px;top:168px;font-size:52px', '看到同级别人的数据', c);
  add('div', 'm', 'position:absolute;left:36px;top:246px;font-size:52px;letter-spacing:-.04em;color:var(--cream);opacity:.85', 'GET /orders/1003', c);
  sub('越权分四种，本期讲<em>水平越权</em>');`,

/* ---------------- K04 徽章关系 ---------------- */
'K04': `
  BGLIB.mount(fr, 'BG3', 'libs/backgrounds/');
  T('d', 64, 104, '漏洞从发现到奖励', 'font-size:104px');
  T('kick', 68, 236, 'FLOW · 赏金流转');
  const B = [[400, '白帽', 'WHITE HAT', 'user-round'], [960, '平台', 'PLATFORM', 'shield-check'], [1520, '厂商', 'VENDOR', 'building-2']], cy = 590, r = 150;
  const g = ov();
  B.forEach(([x, nm, en, ic], i) => {
    sv(g, 'circle', { cx: x, cy, r: r + 26, fill: 'none', stroke: 'rgba(245,238,223,.18)', 'stroke-width': 1.5, 'stroke-dasharray': '3 9' });
    const c = box('card' + (i === 0 ? ' hot' : ''), x - r, cy - r, 2 * r, 2 * r, 'border-radius:50%');
    icon(ic, x - 36, cy - r + 40, 72, i === 0 ? 'var(--char)' : 'var(--cream)');
    T('t', x - r, cy + 2, nm, 'font-size:64px;width:' + 2 * r + 'px;text-align:center;' + (i === 0 ? 'color:var(--char)' : ''));
    T('en', x - r, cy + 84, en, 'width:' + 2 * r + 'px;text-align:center;' + (i === 0 ? 'color:var(--char);opacity:.6' : ''));
  });
  const arrow = (x1, y1, x2, y2, qx, qy, dash) => {
    sv(g, 'path', { d: 'M' + x1 + ' ' + y1 + ' Q' + qx + ' ' + qy + ' ' + x2 + ' ' + y2, fill: 'none', stroke: 'rgba(245,238,223,.55)', 'stroke-width': 2.5, 'stroke-dasharray': dash || 'none' });
    const ang = Math.atan2(y2 - qy, x2 - qx), L = 16;
    sv(g, 'path', { d: 'M' + x2 + ' ' + y2 + ' L' + (x2 - L * Math.cos(ang - .45)) + ' ' + (y2 - L * Math.sin(ang - .45)) + ' M' + x2 + ' ' + y2 + ' L' + (x2 - L * Math.cos(ang + .45)) + ' ' + (y2 - L * Math.sin(ang + .45)), stroke: 'rgba(245,238,223,.75)', 'stroke-width': 2.5, fill: 'none' });
  };
  arrow(530, 470, 830, 470, 680, 360); arrow(1090, 470, 1390, 470, 1240, 360);
  arrow(1390, 710, 1090, 710, 1240, 820, '8 8'); arrow(830, 710, 530, 710, 680, 820, '8 8');
  const P = [[680, 360, '提交报告', 'REPORT'], [1240, 360, '转交厂商', 'FORWARD'], [1240, 820, '确认修复', 'FIXED'], [680, 820, '发放奖励', 'BOUNTY']];
  P.forEach(([x, y, t, en], i) => { const p = box('pill', x - 130, y - 52, 260, 104); add('div', 't', 'font-size:52px;line-height:1', t, p); add('div', 'en', 'margin-top:8px', en, p).dataset.role = 'decor'; });
  img('cards/images/samples/bmz_coin.png', 820, 770, 110, 110, null, 'stk');
  sub('你交报告，平台核实，厂商修复，<em>奖励</em>回到你手里');`,

/* ---------------- K08 编号网格 ---------------- */
'K08': `
  BGLIB.mount(fr, 'BG3', 'libs/backgrounds/');
  T('d', 64, 104, 'AI 挖洞，按顺序来', 'font-size:112px');
  T('kick', 68, 238, 'WORKFLOW · 06 STEPS');
  const S = [['确认授权', 'AUTHORIZE', 'file-check'], ['信息收集', 'RECON', 'radar'], ['AI 扫描', 'AI SCAN', 'cpu'], ['人工复核', 'VERIFY', 'search-check'], ['写报告', 'REPORT', 'file-text'], ['等审核', 'TRIAGE', 'hourglass']];
  S.forEach(([nm, en, ic], i) => {
    const x = 64 + (i % 3) * 448, y = 290 + Math.floor(i / 3) * 300, hot = i === 2;
    const c = box('card' + (hot ? ' hot' : ''), x, y, 416, 272);
    add('div', 'en', 'position:absolute;left:34px;top:34px;' + (hot ? 'color:var(--char);opacity:.65' : ''), 'STEP 0' + (i + 1) + ' / 06', c).dataset.role = 'decor';
    icon(ic, x + 416 - 34 - 76, y + 28, 76, hot ? 'var(--char)' : 'var(--cream)', .9);
    add('div', 't', 'position:absolute;left:34px;top:150px;font-size:60px;' + (hot ? 'color:var(--char)' : ''), nm, c);
    add('div', 'en', 'position:absolute;left:36px;top:226px;' + (hot ? 'color:var(--char);opacity:.65' : ''), en, c).dataset.role = 'decor';
  });
  // 右侧竖向进度
  const X = 1440, g = ov(); T('en', X, 300, 'PROGRESS · 03 / 06');
  S.forEach(([nm], i) => {
    const y = 370 + i * 88, st = i < 2 ? 'done' : i === 2 ? 'now' : 'next';
    if (i < 5) sv(g, 'line', { x1: X + 12, y1: y + 12, x2: X + 12, y2: y + 100, stroke: i < 2 ? 'rgba(245,238,223,.7)' : 'rgba(245,238,223,.18)', 'stroke-width': 2.5 });
    sv(g, 'circle', st === 'now' ? { cx: X + 12, cy: y + 12, r: 14, fill: 'var(--orange)' } : st === 'done' ? { cx: X + 12, cy: y + 12, r: 8, fill: 'var(--cream)' } : { cx: X + 12, cy: y + 12, r: 8, fill: 'var(--char)', stroke: 'rgba(245,238,223,.45)', 'stroke-width': 2 });
    if (st === 'now') sv(g, 'circle', { cx: X + 12, cy: y + 12, r: 26, fill: 'rgba(255,90,31,.15)' });
    T('t' + (st === 'now' ? '' : ' dim'), X + 50, y - 16, nm, 'font-size:52px;' + (st === 'now' ? 'color:var(--orange)' : ''));
  });
  sub('六步，<em>按顺序</em>一步一步来');`,

/* ---------------- K09 证据墙 ---------------- */
'K09': `
  BGLIB.mount(fr, 'BG3', 'libs/backgrounds/', { focus: [1240, 500, 1.6] });
  T('kick', 64, 240, 'EVIDENCE · 证据墙');
  T('d', 64, 280, '一个发现，<br>一张截图', 'font-size:104px');
  T('t dim', 64, 560, '每个发现立刻截图，<br>按编号归档', 'font-size:52px;line-height:1.4');
  T('en', 64, 720, '05 FILES · ARCHIVED');
  const W = [[660, 132, -4, 'EV-01 · ORDER 1002'], [1290, 118, 3, 'EV-02 · ORDER 1003'], [690, 520, 3, 'EV-03 · NETWORK'], [1300, 500, -3, 'EV-04 · RESPONSE']];
  W.forEach(([x, y, r, t]) => win(x, y, 540, 330, r, t));
  const w = win(960, 300, 620, 380, 0, 'EV-05 · OWNER = USER_B');
  // 标注：框住 owner 那一行 + 引线到标签
  const g = ov(1);
  sv(g, 'rect', { x: 960 + 620 * .585, y: 300 + 44 + 336 * .41, width: 620 * .2, height: 30, rx: 8, fill: 'none', stroke: 'var(--orange)', 'stroke-width': 4 });
  sv(g, 'polyline', { points: (960 + 620 * .785) + ',' + (300 + 44 + 336 * .41 + 15) + ' 1650,' + (300 + 44 + 336 * .41 + 15) + ' 1650,770', fill: 'none', stroke: 'var(--orange)', 'stroke-width': 3 });
  sv(g, 'circle', { cx: 1650, cy: 770, r: 7, fill: 'var(--orange)' });
  const p = box('pill hot', 1500, 790, 300, 84, 'z-index:30'); add('div', 't', 'font-size:52px;color:var(--char)', '别人的订单', p);
  sub('每个发现，立刻截图，<em>按编号</em>归档');`,

/* ---------------- K24 嵌套归属 ---------------- */
'K24': `
  BGLIB.mount(fr, 'BG3', 'libs/backgrounds/');
  T('kick', 64, 240, 'OWNERSHIP · 归属');
  T('d', 64, 280, 'A 的钥匙，<br>开了 B 的门', 'font-size:104px');
  T('t dim', 64, 560, '箭头 = 动作<br>方框 = 归属', 'font-size:52px;line-height:1.4');
  const st = box('pill', 64, 720, 360, 96); st.style.flexDirection = 'row'; st.style.gap = '16px';
  add('div', 'ic', 'width:44px;height:44px', ICONS['circle-x'], st); add('div', 't', 'font-size:52px', '越权成立', st);
  const g = ov();
  sv(g, 'rect', { x: 680, y: 120, width: 1176, height: 740, rx: 40, fill: 'rgba(245,238,223,.02)', stroke: 'rgba(245,238,223,.3)', 'stroke-width': 2, 'stroke-dasharray': '10 10' });
  T('t', 724, 148, '平台', 'font-size:52px'); T('en', 844, 168, 'PLATFORM');
  const zone = (x, who, en, order) => {
    const b = box('card', x, 240, 500, 580);
    add('div', 't', 'position:absolute;left:36px;top:34px;font-size:52px', '用户 ' + who + ' 的空间', b);
    add('div', 'en', 'position:absolute;left:38px;top:104px', en, b).dataset.role = 'decor';
    const o = add('div', 'a', 'left:36px;top:410px;width:428px;height:128px;border-radius:22px;background:var(--char-hi);box-shadow:inset 0 0 0 1.5px rgba(245,238,223,.1);display:flex;align-items:center;gap:22px;padding:0 28px', '', b);
    add('div', 'ic', 'width:56px;height:56px;opacity:.85', ICONS['file'], o); add('div', 't', 'font-size:52px', '订单 ' + order, o);
    return b;
  };
  zone(724, 'A', 'TENANT A', 1002); zone(1312, 'B', 'TENANT B', 1003);
  const s = box('pill', 760, 400, 300, 96); s.style.flexDirection = 'row'; s.style.gap = '14px';
  add('div', 'ic', 'width:44px;height:44px', ICONS['key-round'], s); add('div', 't', 'font-size:52px', '会话 A', s);
  // 越界箭头：会话 A → 订单 1003（朱橙，唯一焦点）
  const g2 = ov(1);
  sv(g2, 'path', { d: 'M1060 448 C1200 448 1220 714 1340 714', fill: 'none', stroke: 'var(--orange)', 'stroke-width': 5 });
  sv(g2, 'path', { d: 'M1340 714 l-20 -12 M1340 714 l-20 12', stroke: 'var(--orange)', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' });
  sv(g2, 'rect', { x: 1340, y: 650, width: 428, height: 128, rx: 22, fill: 'none', stroke: 'var(--orange)', 'stroke-width': 4 });
  sv(g2, 'circle', { cx: 1268, cy: 600, r: 26, fill: 'var(--orange)' });
  sv(g2, 'path', { d: 'M1258 590 l20 20 M1278 590 l-20 20', stroke: 'var(--char)', 'stroke-width': 4.5, 'stroke-linecap': 'round' });
  T('en', 1290, 540, 'BOUNDARY');
  const p = box('pill', 1380, 400, 380, 84, 'z-index:30'); add('div', 't', 'font-size:52px', '改单号 · 越界', p);
  sub('A 的会话，伸手拿了 <em>B 空间</em>里的订单');`
};

const page = (id) => `<!doctype html><html><head>${HEAD}</head><body><section class="frame" id="fr"></section><script>
const fr = document.getElementById('fr'), ICONS = ${JSON.stringify(ICONS)}, NS = 'http://www.w3.org/2000/svg';
const add = (tag, cls, css, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; (parent || fr).appendChild(e); return e; };
const T = (cls, x, y, html, css) => { const e = add('div', 'a ' + cls, 'left:' + x + 'px;top:' + y + 'px;' + (css || ''), html); if (/\\b(en|kick)\\b/.test(cls)) e.dataset.role = 'decor'; return e; };
const box = (cls, x, y, w, h, css) => add('div', 'a ' + cls, 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (css || ''));
const img = (src, x, y, w, h, parent, cls) => { const e = add('img', 'a ' + (cls || ''), 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;object-fit:contain', null, parent); e.src = src; return e; };
const icon = (n, x, y, s, color, op) => add('div', 'a ic', 'left:' + x + 'px;top:' + y + 'px;width:' + s + 'px;height:' + s + 'px;color:' + color + ';opacity:' + (op || 1), ICONS[n]);
const ov = (top) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'ov'); s.setAttribute('width', 1920); s.setAttribute('height', 1080); if (top) s.style.zIndex = 20; fr.appendChild(s); return s; };
const sv = (g, tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); g.appendChild(e); return e; };
const win = (x, y, w, h, r, title) => { const e = box('win', x, y, w, h, 'transform:rotate(' + r + 'deg)'); e.innerHTML = '<div class="bar"><i></i><i></i><i></i><span data-role="decor">' + title + '</span></div><img src="cards/images/samples/evidence/shop_order_教学示例.jpg">'; return e; };
const sub = h => { const s = add('div', 'sub', '', h); };
${FRAMES[id]}
add('div', 'chapter-zone', '');
window.DECOR = document.querySelectorAll('[data-role="decor"]').length;
window.SMALL = [...document.querySelectorAll('.t,.n,.m,.d')].filter(e => !e.closest('[data-role="decor"]') && parseFloat(getComputedStyle(e).fontSize) < 52).map(e => e.textContent.slice(0, 10) + ' ' + getComputedStyle(e).fontSize);
</script></body></html>`;

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const id of Object.keys(FRAMES)) {
    const f = path.join(TMP, id + '.html'); fs.writeFileSync(f, page(id));
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + f);
    await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))])); await p.waitForTimeout(200);
    const [decor, small] = await p.evaluate(() => [window.DECOR, window.SMALL || []]);
    console.log(id, '装饰小字', decor, small.length ? '小于 52px：' + small.join('；') : '', errs.join('；'));
    await p.screenshot({ path: path.join(OUT, 'R-' + id + '.jpg'), type: 'jpeg', quality: 88 });
  }
  // 前后对比板
  const ids = Object.keys(FRAMES);
  for (let g = 0; g < 2; g++) {
    const rows = ids.slice(g * 3, g * 3 + 3).map(id => `<div class="r"><img src="file://${ROOT}/docs/previews/cards/L-${id}.jpg"><img src="file://${OUT}/R-${id}.jpg"></div><b>L-${id}　左：现版　右：丰富度改版（候选）</b>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>html,body{width:2000px;height:auto;overflow:visible;background:#E9E3D6}body{padding:40px;font-family:var(--f-cn);color:var(--char)}.r{display:flex;gap:40px}.r img{width:940px;border-radius:14px;display:block}b{display:block;font-size:26px;margin:12px 0 34px}</style></head><body>${rows}</body></html>`;
    const hf = path.join(TMP, `compare_${g + 1}.html`); fs.writeFileSync(hf, html);
    const sp = await b.newPage({ viewport: { width: 2000, height: 800 } }); await sp.goto('file://' + hf); await sp.waitForTimeout(300);
    await sp.screenshot({ path: path.join(OUT, `compare_${g + 1}.jpg`), fullPage: true, type: 'jpeg', quality: 82 }); await sp.close();
  }
  await b.close();
})();
