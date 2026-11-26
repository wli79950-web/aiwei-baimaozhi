# 新会话环境安装

适用于 claude.ai 云端会话。HuggingFace 被网络策略拦截，模型一律从 GitHub releases 下载。

```bash
cd /home/user/aiwei-baimaozhi
# 1. Python 依赖：抠图 / 语音识别 / 字体处理 / 图像处理
pip install -q "rembg[cpu]" sherpa-onnx fonttools brotli scipy pillow numpy
# 2. 网页字体（得意黑、MiSans、Archivo、IBM Plex Mono）
npm i --silent
# 3. 生成 CSS 变量并检查配色（改过 tokens/brand.json 后都要跑）
python3 tools/gen_tokens.py && python3 tools/contrast_check.py
# 4. 语音识别模型（Paraformer 中文，约 1GB，用时再下）
mkdir -p models && curl -sSL -o /tmp/p.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2024-03-09.tar.bz2 && tar xjf /tmp/p.tar.bz2 -C models && rm /tmp/p.tar.bz2
# 5. 抠图模型：rembg 首次运行时自动从 GitHub 下载 isnet-general-use / u2net_human_seg
```

- Chromium 和 Playwright 已预装，`require('playwright')` 可以直接用，不要重装。
- 生图接口 `apihub.agnes-ai.com` 的密钥由云环境的网络代理注入，脚本里不写真密钥；如果报 `Invalid token`，在环境设置里给这个域名配置密钥。
- AE 端需要安装的字体：`fonts/` 里的全部 TTF（得意黑、Archivo Black、IBM Plex Mono Medium / SemiBold、MiSans Medium / Bold / Heavy）。

## 常用命令
| 做什么 | 命令 |
|---|---|
| 改配色后重新生成 | `python3 tools/gen_tokens.py && python3 tools/contrast_check.py && node tools/make_backgrounds.js && node tools/build_previews.js` |
| 生图 | `python3 tools/genimg.py jobs.json 输出目录`（preset 用 `sticker`） |
| 抠图 | `python3 -I tools/cutout.py object 原图.png 透明.png`；实心物件加 `--fill-holes` |
| 口播转时间轴 | `ffmpeg -i voice.mp3 -ac 1 -ar 16000 a16.wav && python3 -I tools/asr_segments.py a16.wav segs.json` |
| 口播抠像 | `ffmpeg -i aroll.mp4 -q:v 2 footage/frames/a_%05d.jpg`，然后 `python3 -I tools/matte_footage.py footage/frames footage/cut 起 止 x0 y0 x1 y1` |
| 分镜关键帧 | `node engine/shots_v2.js episodes/X/index.html 2.0,7.3,... 输出目录`（页面需提供 `window.renderAt(t)`） |
| 合成音效 | 在期目录下运行 `python3 ../../engine/sfx.py cues.json 时长` |
| 成片渲染 | `node engine/render_mb.js episodes/X/index.html 0 时长 out/sub 5 0 3`（开 3 个 worker，第 6 个参数分别填 0 / 1 / 2），再 `engine/mb_encode.sh out/sub 5 out/video.mp4`，最后用 ffmpeg 混入口播和音效 |
| AE 重建包 | P6 建好后：`python3 ae/build_ae.py episodes/X` |
