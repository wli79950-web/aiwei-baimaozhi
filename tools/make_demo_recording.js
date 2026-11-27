// 生成一段「示意录屏」给录屏组件做演示和自检（不是真实网站；页面上标「教学示例」）
// 用法：node tools/make_demo_recording.js          → out/screencast/demo_rec/00001.jpg… + rects.json（关键区域在原片里的坐标）
// 1920×1080，30fps，5 秒：1.0–1.6s 地址栏把 1001 改成 1002，2.0s 响应变成别人的订单。正片一律用用户提供的录屏。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'out/screencast/demo_rec');
const FPS = 30, DUR = 5;
fs.mkdirSync(OUT, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${ROOT}/engine/tokens.css"><link rel="stylesheet" href="file://${ROOT}/engine/base.css">
<style>
html,body{width:1920px;height:1080px;margin:0;background:#e8eaed;font-family:var(--f-cn);font-weight:500;color:#202124;overflow:hidden}
.abs{position:absolute}
#tabs{left:0;top:0;width:1920px;height:56px;background:#dee1e6}
#tab{left:80px;top:10px;width:420px;height:46px;background:#fff;border-radius:12px 12px 0 0;font-size:22px;line-height:46px;padding-left:24px}
#addr{left:0;top:56px;width:1920px;height:64px;background:#fff;border-bottom:1px solid #dadce0}
#url{left:140px;top:68px;width:1000px;height:40px;background:#f1f3f4;border-radius:20px;font:500 24px/40px var(--f-mono);padding-left:28px;color:#202124}
#page{left:0;top:121px;width:1100px;height:959px;background:#fff}
#nav{left:0;top:121px;width:1100px;height:72px;background:#fafafa;border-bottom:1px solid #eee;font-size:26px;line-height:72px;padding-left:48px;font-weight:700}
#demo{left:860px;top:140px;font-size:20px;color:#fff;background:#d93025;padding:4px 12px;border-radius:6px}
#card{left:48px;top:230px;width:1000px;height:520px;border:1px solid #e0e0e0;border-radius:14px}
.row{position:absolute;left:84px;width:930px;height:72px;border-bottom:1px solid #f0f0f0;font-size:30px;line-height:72px}
.row b{display:inline-block;width:180px;color:#5f6368;font-weight:500}
#dev{left:1100px;top:121px;width:820px;height:959px;background:#202124;color:#e8eaed;font:500 22px/1.5 var(--f-mono)}
#devtabs{left:1100px;top:121px;width:820px;height:48px;background:#292a2d;border-bottom:1px solid #3c4043;font:500 20px/48px var(--f-mono);color:#9aa0a6;padding-left:24px}
#req{left:1124px;top:190px;width:780px;font:500 24px/1.6 var(--f-mono);color:#8ab4f8}
.jl{position:absolute;left:1124px;width:780px;font:500 26px/40px var(--f-mono);white-space:pre;color:#e8eaed}
.k{color:#9cdcfe}.s{color:#ce9178}.n{color:#b5cea8}
</style></head><body>
<div class="abs" id="tabs"></div><div class="abs" id="tab">示意商城 · 我的订单</div>
<div class="abs" id="addr"></div><div class="abs" id="url" data-rect="url">https://shop.test/orders/<span id="oid">1001</span></div>
<div class="abs" id="page"></div><div class="abs" id="nav">示意商城 · 订单详情</div><div class="abs" id="demo">教学示例</div>
<div class="abs" id="card" data-rect="card"></div>
<div class="row" style="top:260px" data-rect="row_id"><b>订单号</b><span id="v_id">1001</span></div>
<div class="row" style="top:332px" data-rect="row_name"><b>收货人</b><span id="v_name">张**（我）</span></div>
<div class="row" style="top:404px" data-rect="row_phone"><b>手机号</b><span id="v_phone">139****5521</span></div>
<div class="row" style="top:476px" data-rect="row_addr"><b>地址</b><span id="v_addr">示例市示例路 1 号</span></div>
<div class="row" style="top:548px" data-rect="row_amt"><b>金额</b>¥ 268.00</div>
<div class="abs" id="dev"></div><div class="abs" id="devtabs">Elements   Console   Network   Application</div>
<div class="abs" id="req" data-rect="req">GET /api/orders/<span id="rid">1001</span><br><span style="color:#9aa0a6">Status 200 OK · 0.4 KB</span></div>
<div class="jl" style="top:300px;color:#9aa0a6" data-rect="auth">Authorization: Bearer eyJhbGciOi.J9x</div>
<div class="jl" style="top:380px">{</div>
<div class="jl" style="top:420px" data-rect="j_id">  <span class="k">"order_id"</span>: <span class="n" id="j_id">1001</span>,</div>
<div class="jl" style="top:460px" data-rect="j_owner">  <span class="k">"owner"</span>: <span class="s" id="j_owner">"user_a"</span>,</div>
<div class="jl" style="top:500px" data-rect="j_phone">  <span class="k">"phone"</span>: <span class="s" id="j_phone">"139****5521"</span>,</div>
<div class="jl" style="top:540px">  <span class="k">"amount"</span>: <span class="n">268.00</span></div>
<div class="jl" style="top:580px">}</div>
<script>
window.setT = function (t) {
  const typed = t >= 1.0 && t < 1.6 ? '100' : (t >= 1.6 ? '1002' : '1001');
  document.getElementById('oid').textContent = typed;
  const b = t >= 2.0;
  document.getElementById('rid').textContent = b ? '1002' : '1001';
  document.getElementById('v_id').textContent = b ? '1002' : '1001';
  document.getElementById('v_name').textContent = b ? '李**' : '张**（我）';
  document.getElementById('v_phone').textContent = b ? '138****0012' : '139****5521';
  document.getElementById('v_addr').textContent = b ? '示例市另一条路 9 号' : '示例市示例路 1 号';
  document.getElementById('j_id').textContent = b ? '1002' : '1001';
  document.getElementById('j_owner').textContent = b ? '"user_b"' : '"user_a"';
  document.getElementById('j_phone').textContent = b ? '"138****0012"' : '"139****5521"';
};
</script></body></html>`;

(async () => {
  const f = path.join(OUT, '_rec.html'); fs.writeFileSync(f, html);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const rects = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-rect]')].map(e => { const r = e.getBoundingClientRect(); return [e.dataset.rect, [r.left, r.top, r.width, r.height].map(Math.round)]; })));
  fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify({ w: 1920, h: 1080, fps: FPS, count: FPS * DUR, rects }, null, 1));
  for (let i = 0; i < FPS * DUR; i++) {
    await p.evaluate(t => setT(t), i / FPS);
    await p.screenshot({ path: path.join(OUT, String(i + 1).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 88 });
  }
  fs.unlinkSync(f); await b.close();
  console.log(`out/screencast/demo_rec：${FPS * DUR} 帧 + rects.json`);
})();
