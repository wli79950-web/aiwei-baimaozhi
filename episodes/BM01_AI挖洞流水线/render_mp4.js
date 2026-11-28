// BM01 分镜头低内存两阶段 MP4 渲染与成片合成脚本（1920×1080，60fps，支持局部重渲与断点续渲）
// 阶段一：仅运行单页 Chrome 将每镜渲染为 JPEG 帧 + ffconcat 清单（静止尾段精确复用），完后关闭 Chrome 彻底释放内存；
// 阶段二：仅运行单线程低内存 ffmpeg 将每镜编码为精确帧数的 60fps MP4，拼接并混入口播与事件音效，自动清理临时帧。
// 用法：node episodes/BM01_AI挖洞流水线/render_mp4.js [--force] [--keep-frames] [S01 S05 ...]
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const EP = __dirname;
const ROOT = path.resolve(EP, '../..');
const shotPage = require(path.join(ROOT, 'tools/lib/shotpage.js'));
const EP_DATA = JSON.parse(fs.readFileSync(path.join(EP, 'episode.json'), 'utf8'));
const LAYOUT = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'cards/layouts', id + '.json'), 'utf8'));

const FPS = 60;
const OUT_DIR = path.join(EP, 'out');
const SHOTS_DIR = path.join(OUT_DIR, 'shots');
const FRAMES_ROOT = path.join(EP, 'build', 'render_frames');
const TMP_HTML = path.join(EP, 'build', 'render_html');
fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.mkdirSync(FRAMES_ROOT, { recursive: true });
fs.mkdirSync(TMP_HTML, { recursive: true });

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const KEEP_FRAMES = args.includes('--keep-frames');
const ONLY = args.filter(a => !a.startsWith('--'));

const CHROME = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = process.env.FFMPEG_PATH || 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v9.0.2.exe';

// 按全局绝对帧号切分，保证 39 镜拼完总帧数严格对齐口播零漂移
const tasks = EP_DATA.shots.map((s, idx) => {
  const f0 = Math.round(s.t0 * FPS);
  const f1 = Math.round((s.t0 + s.dur) * FPS);
  return { idx, spec: s, nFrames: Math.max(1, f1 - f0) };
});

function shotMp4Path(id) { return path.join(SHOTS_DIR, `${id}.mp4`); }
function shotFrameDir(id) { return path.join(FRAMES_ROOT, id); }
function shotDoneFlag(id) { return path.join(shotFrameDir(id), '.done'); }

function isMp4Ready(id) {
  const p = shotMp4Path(id);
  return !FORCE && fs.existsSync(p) && fs.statSync(p).size > 4096;
}

// 计算某一镜头在哪些时间区间内处于动态（其余完全静止的连续帧可用 ffconcat duration 精确合并）
function computeStaticRanges(meta, dur) {
  if (meta.hasSpin || meta.hasOut || !isFinite(meta.scDone)) return Infinity;
  return Math.max(meta.settled, meta.scDone) + 0.15;
}

async function captureShotFrames(browser, task) {
  const s = task.spec;
  const fdir = shotFrameDir(s.id);
  if (!FORCE && fs.existsSync(shotDoneFlag(s.id))) {
    console.log(`[跳过抽帧] ${s.id} 已有完整帧缓存`);
    return;
  }
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });

  const spec = Object.assign({}, s);
  if (spec.sc && spec.sc.spec && spec.sc.base == null) {
    spec.sc = Object.assign({}, spec.sc, { base: path.relative(ROOT, EP).replace(/\\/g, '/') + '/' });
  }
  let html = shotPage(ROOT, spec, LAYOUT(spec.layout), {});
  html = html.replace(/<base href="[^"]*">/, `<base href="${pathToFileURL(ROOT).href}/">`);
  const htmlPath = path.join(TMP_HTML, `${s.id}.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const pageErrs = [];
  page.on('pageerror', e => pageErrs.push(e.message));
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(() => window.ready());

  const meta = await page.evaluate(() => {
    const hasSpin = Boolean(H.focus || (H.bg && H.bg.id === 'BG1'));
    const hasOut = H.spec.out != null;
    let scDone = 0;
    if (H.sc && H.spec.sc && H.spec.sc.spec) {
      const sp = H.spec.sc.spec;
      if ((sp.cursor || []).length) scDone = Infinity;
      if (sp.src && sp.src.type === 'frames') {
        const R = sp.remap || [];
        if (!R.length) scDone = Infinity;
        else {
          let lastMoving = 0;
          for (let i = 1; i < R.length; i++) {
            if (Math.abs(R[i][1] - R[i - 1][1]) > 1e-4) lastMoving = Math.max(lastMoving, R[i][0]);
          }
          scDone = Math.max(scDone, lastMoving);
        }
      }
      (sp.push || []).forEach(p => { scDone = Math.max(scDone, (p.at || 0) + (p.dur || 0.7)); });
      (sp.ann || []).forEach(a => {
        scDone = Math.max(scDone, (a.at || 0) + 1.1);
        if (a.out != null) scDone = Math.max(scDone, a.out + 0.4);
      });
    }
    return { settled: window.SETTLED, hasSpin, hasOut, scDone };
  });

  const tStart = Date.now();
  const staticAfter = computeStaticRanges(meta, s.dur);
  const concatLines = ['ffconcat version 1.0'];
  let captured = 0;
  const frameDur = (1 / FPS).toFixed(8);

  for (let f = 0; f < task.nFrames; f++) {
    const t = f / FPS;
    await page.evaluate(async tt => { await window.renderAt(tt); }, t);
    const fname = `f_${String(captured).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(fdir, fname), type: 'jpeg', quality: 95 });
    captured++;

    if (t >= staticAfter && f < task.nFrames - 1) {
      const remain = task.nFrames - f;
      const durSec = (remain / FPS).toFixed(8);
      concatLines.push(`file '${fname}'`, `duration ${durSec}`);
      // ffconcat 规范：最后一张图需重复一行 file 以保证最后一帧持续时间生效
      concatLines.push(`file '${fname}'`);
      break;
    } else {
      concatLines.push(`file '${fname}'`, `duration ${frameDur}`);
      if (f === task.nFrames - 1) {
        concatLines.push(`file '${fname}'`);
      }
    }
  }

  await page.close();
  fs.writeFileSync(path.join(fdir, 'list.txt'), concatLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(shotDoneFlag(s.id), String(task.nFrames), 'utf8');

  const sec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`[抽帧完成] ${s.id} (实际截 ${captured}/${task.nFrames} 帧, ${s.dur}s) 用时 ${sec}s${pageErrs.length ? ' ⚠页错:' + pageErrs[0] : ''}`);
}

function encodeShot(task) {
  const s = task.spec;
  if (isMp4Ready(s.id)) return;
  const fdir = shotFrameDir(s.id);
  const tmpName = `${s.id}.tmp.mp4`;
  const finalMp4 = shotMp4Path(s.id);
  const tStart = Date.now();

  // 单线程极低内存参数编码，强制输出精确帧数与恒定 60fps
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', `fps=${FPS}`,
    '-frames:v', String(task.nFrames),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
    '-threads', '1', '-x264-params', 'rc-lookahead=5:threads=1',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.relative(fdir, path.join(SHOTS_DIR, tmpName)).replace(/\\/g, '/')
  ], { cwd: fdir, stdio: 'inherit' });

  const tmpAbs = path.join(SHOTS_DIR, tmpName);
  if (fs.existsSync(finalMp4)) fs.unlinkSync(finalMp4);
  fs.renameSync(tmpAbs, finalMp4);
  if (!KEEP_FRAMES) fs.rmSync(fdir, { recursive: true, force: true });

  const sec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`[编码完成] ${s.id} (${task.nFrames} 帧) 用时 ${sec}s`);
}

function concatAndMux() {
  const listPath = path.join(OUT_DIR, 'shots_concat.txt');
  fs.writeFileSync(listPath, tasks.map(t => `file 'shots/${t.spec.id}.mp4'`).join('\n') + '\n', 'utf8');

  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', 'shots_concat.txt',
    '-c', 'copy', '-movflags', '+faststart', 'BM01_silent.mp4'
  ], { cwd: OUT_DIR, stdio: 'inherit' });

  const voiceRel = EP_DATA.voice.replace(/\\/g, '/');
  const sfxAbs = path.join(EP, 'sfx', 'sfx_mix.wav');
  const outTemp = path.join(OUT_DIR, 'BM01_final.mp4');
  const finalMp4 = path.join(OUT_DIR, 'BM01_成片.mp4');

  if (fs.existsSync(sfxAbs)) {
    execFileSync(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-i', 'out/BM01_silent.mp4',
      '-i', voiceRel,
      '-i', 'sfx/sfx_mix.wav',
      '-filter_complex', '[1:a]volume=1.0[v];[2:a]volume=0.25[s];[v][s]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]',
      '-map', '0:v:0', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', 'out/BM01_final.mp4'
    ], { cwd: EP, stdio: 'inherit' });
  } else {
    execFileSync(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-i', 'out/BM01_silent.mp4',
      '-i', voiceRel,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', 'out/BM01_final.mp4'
    ], { cwd: EP, stdio: 'inherit' });
  }
  let saved = finalMp4;
  try {
    if (fs.existsSync(finalMp4)) fs.unlinkSync(finalMp4);
    fs.renameSync(outTemp, finalMp4);
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      saved = path.join(OUT_DIR, 'BM01_成片_v2.mp4');
      if (fs.existsSync(saved)) fs.unlinkSync(saved);
      fs.renameSync(outTemp, saved);
    } else throw e;
  }
  const mb = (fs.statSync(saved).size / 1e6).toFixed(1);
  console.log(`✓ 成片合成完成：${saved} (${mb} MB)`);
}

(async () => {
  const tAll = Date.now();
  const target = tasks.filter(t => (!ONLY.length || ONLY.includes(t.spec.id)) && !isMp4Ready(t.spec.id));
  const totalFrames = tasks.reduce((a, t) => a + t.nFrames, 0);
  console.log(`BM01 低内存两阶段渲染：共 ${tasks.length} 镜（${totalFrames} 帧 / ${(totalFrames / FPS).toFixed(2)}s），本次需处理 ${target.length} 镜`);

  // 逐批（每批 4 镜）交替执行：抽帧 → 关 Chrome 释内存 → 编码清临时帧，兼顾低内存与低磁盘占用
  const BATCH = 4;
  for (let i = 0; i < target.length; i += BATCH) {
    const batch = target.slice(i, i + BATCH);
    const needCap = batch.filter(t => FORCE || !fs.existsSync(shotDoneFlag(t.spec.id)));
    if (needCap.length) {
      const browser = await chromium.launch({
        executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
        args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--disable-extensions', '--renderer-process-limit=1']
      });
      try {
        for (const task of needCap) {
          await captureShotFrames(browser, task);
        }
      } finally {
        await browser.close();
      }
    }
    for (const task of batch) {
      encodeShot(task);
    }
  }

  const allReady = tasks.every(t => fs.existsSync(shotMp4Path(t.spec.id)) && fs.statSync(shotMp4Path(t.spec.id)).size > 4096);
  if (allReady && !ONLY.length) {
    concatAndMux();
  }
  console.log(`总耗时：${((Date.now() - tAll) / 1000).toFixed(1)}s`);
})();
