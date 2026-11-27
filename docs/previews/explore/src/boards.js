// 对比板：现版 vs 质感版，和手机竖屏模拟。node docs/previews/explore/src/boards.js
const { chromium } = require('playwright'), path = require('path');
const DIR = path.resolve(__dirname, '..'), PREV = path.resolve(DIR, '..');
const U = p => 'file://' + p;
const css = `<style>@import url("${U(path.resolve(PREV, '../../node_modules/misans/lib/Normal/MiSans-Bold.min.css'))}");
body{margin:0;background:#E9E3D6;font-family:MiSans,sans-serif;color:#16130F}
.row{display:flex;gap:40px;padding:0 48px}.cap{font-size:34px;font-weight:700;margin:40px 48px 18px}
.cell img{display:block;border-radius:18px}.cell b{display:block;font-size:30px;margin:16px 4px 0}
.ph{width:380px;height:822px;border-radius:64px;background:#0b0b0b;padding:16px;box-sizing:border-box;box-shadow:0 20px 40px rgba(0,0,0,.18)}
.sc{width:100%;height:100%;border-radius:50px;background:#000;overflow:hidden;display:flex;align-items:center}
.sc img{width:100%;display:block}.phs{display:flex;gap:44px;padding:40px 48px 24px}.phs b{display:block;text-align:center;font-size:28px;margin-top:18px}</style>`;
const pair = (id, cur) => `<html><head>${css}</head><body style="width:2088px;padding-bottom:48px">
  <div class="row" style="padding-top:48px">
   <div class="cell"><img width="976" src="${U(path.join(PREV, 'infocards', cur))}"><b>现版（视觉系统 1.3）</b></div>
   <div class="cell"><img width="976" src="${U(path.join(DIR, 'texture_' + id + 'h.jpg'))}"><b>质感版（候选）</b></div></div>
  <div class="row" style="margin-top:40px;align-items:flex-start">
   <div class="cell"><img width="540" src="${U(path.join(DIR, 'texture_' + id + 'v.jpg'))}"><b>质感版 · 竖屏 1080×1920</b></div>
   <div class="cell" style="font-size:30px;line-height:1.6;max-width:1300px;padding-top:8px">${NOTES[id]}</div></div></body></html>`;
const NOTES = {
  D1: '<b>改了什么</b>· 六张实心卡 → 一条流程轨道，「按顺序」直接画成线<br>· 贴纸只留一个主角（AI 扫描），做大，配雷达刻度环 + 朱橙光晕<br>· 朱橙只出现在「当前这一步」：节点 + 字 + 光晕，标题去掉色块<br>· 80% 改成奶油白大字，不再用克莱因蓝<br>· 背景：点阵 + 十字标 + 构造线；等宽小字 4 处（低对比，不承载信息）',
  D6: '<b>改了什么</b>· 两张终端卡 → 一个抓包窗口（请求 / 响应上下两栏，带行号）<br>· 不重要的行压暗到 64%，焦点行整行朱橙淡底 + 左侧色条<br>· 放大镜圆 → 朱橙引线连到右边的大字 admin<br>· 「普通用户 ≠ admin」两颗胶囊 → 一句「自己改的，服务器照收」<br>· 背景同上；窗口标题、栏名、行号都是装饰小字' };
const phones = list => `<html><head>${css}</head><body style="width:${48 + list.length * 424}px">
  <div class="phs">${list.map(([f, l]) => `<div><div class="ph"><div class="sc"><img src="${U(f)}"></div></div><b>${l}</b></div>`).join('')}</div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const fs = require('fs'), TMP = path.resolve(DIR, '../../../out/explore'); fs.mkdirSync(TMP, { recursive: true });
  const shot = async (html, out) => { const f = path.join(TMP, out + '.html'); fs.writeFileSync(f, html); const p = await b.newPage({ viewport: { width: 800, height: 600 } }); await p.goto('file://' + f, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200); await p.screenshot({ path: path.join(DIR, out), fullPage: true, type: 'jpeg', quality: 86 }); await p.close(); };
  await shot(pair('D1', 'demo_D1.jpg'), 'compare_D1.jpg');
  await shot(pair('D6', 'demo_D6.jpg'), 'compare_D6.jpg');
  await shot(phones([[path.join(PREV, 'infocards/demo_D1.jpg'), '现版 · 横屏'], [path.join(DIR, 'texture_D1h.jpg'), '质感版 · 横屏'], [path.join(DIR, 'texture_D1v.jpg'), '质感版 · 竖屏'],
    [path.join(DIR, 'texture_D6h.jpg'), '质感版 · 横屏'], [path.join(DIR, 'texture_D6v.jpg'), '质感版 · 竖屏']]), 'phone_texture.jpg');
  await b.close();
})();
