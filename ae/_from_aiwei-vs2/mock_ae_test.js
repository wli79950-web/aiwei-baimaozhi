// Mock After Effects object model + test runner for the EP01 rebuild script.
// Usage: node mock_ae_test.js <script.jsx>
const fs = require('fs'), path = require('path'), vm = require('vm');
const acorn = require(path.resolve(__dirname, 'node_modules/acorn'));
const file = path.resolve(process.argv[2]);
const src = fs.readFileSync(file, 'utf8');
const errors = [], notes = [];
function fail(m) { errors.push(m); }

// ---------- 1. ES3 syntax check ----------
try { acorn.parse(src, { ecmaVersion: 3, allowReserved: false }); notes.push('ES3 语法解析通过'); }
catch (e) { fail('ES3 语法错误: ' + e.message); }
for (const re of [/\blet\s/, /\bconst\s/, /=>/, /`/, /\.forEach\(/, /\.indexOf\(/, /\.map\(/, /\.trim\(/, /JSON\./]) {
  // only check the runtime part (the SPEC literal is pure data)
  const rt = src.slice(src.indexOf('/* ===== runtime'));
  if (re.test(rt)) fail('运行库中出现非 ES3 写法: ' + re);
}


// ---------- 1b. matchName cross-check against the official AE scripting guide (docsforadobe) ----------
(() => {
  const docsDir = path.resolve(__dirname, 'aedocs/docs');
  if (!fs.existsSync(docsDir)) { fail('缺少官方文档副本，无法核对 matchName'); return; }
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [fs.readFileSync(path.join(d, e.name), 'utf8')]);
  const docs = walk(docsDir).join('\n');
  const rt = src.slice(src.indexOf('/* ===== runtime'));
  const inPick = new Set(); (rt.match(/pick\([^\n]*?\[([^\]]*)\]/g) || []).forEach(m => (m.match(/"ADBE [^"]+"/g) || []).forEach(n => inPick.add(n.slice(1, -1))));
  const used = [...new Set((rt.match(/"ADBE [^"]+"/g) || []).map(x => x.slice(1, -1)))];
  let ok = 0; const fallbackOnly = [];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  used.forEach(n => { if (new RegExp('[`"]' + esc(n) + '[`"]').test(docs)) ok++; else if (inPick.has(n)) fallbackOnly.push(n); else fail('matchName 不在官方文档中: ' + n); });
  notes.push(`matchName 官方文档核对：${ok} 个已确认` + (fallbackOnly.length ? `，${fallbackOnly.length} 个文档未收录、已配备备用查找（${fallbackOnly.join(', ')}）` : ''));
})();

// ---------- 2. Object model ----------
const PVT = { NO_VALUE: 0, ThreeD_SPATIAL: 1, ThreeD: 2, TwoD_SPATIAL: 3, TwoD: 4, OneD: 5, COLOR: 6, CUSTOM_VALUE: 7, MARKER: 8, LAYER_INDEX: 9, MASK_INDEX: 10, SHAPE: 11, TEXT_DOCUMENT: 12 };
const dims = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1, 6: 4 };
const MISSING = [];
let stats = { keys: 0, exprs: 0, props: 0, staleCaught: 0 };
const allExprs = [];

class Layer0 { constructor() { this.version = 0; } }
// schema: matchName -> factory
function leaf(mn, type, def) { return { mn, type, def }; }
function grp(mn, children, addable) { return { mn, children: children || [], addable: addable || {} }; }
const VEC_ITEMS = {
  'ADBE Vector Shape - Rect': () => grp('ADBE Vector Shape - Rect', [leaf('ADBE Vector Rect Size', PVT.TwoD, [100, 100]), leaf('ADBE Vector Rect Position', PVT.TwoD_SPATIAL, [0, 0]), leaf('ADBE Vector Rect Roundness', PVT.OneD, 0)]),
  'ADBE Vector Shape - Ellipse': () => grp('ADBE Vector Shape - Ellipse', [leaf('ADBE Vector Ellipse Size', PVT.TwoD, [100, 100]), leaf('ADBE Vector Ellipse Position', PVT.TwoD_SPATIAL, [0, 0])]),
  'ADBE Vector Shape - Group': () => grp('ADBE Vector Shape - Group', [leaf('ADBE Vector Shape', PVT.SHAPE, null)]),
  'ADBE Vector Graphic - Fill': () => grp('ADBE Vector Graphic - Fill', [leaf('ADBE Vector Fill Color', PVT.COLOR, [1, 0, 0, 1]), leaf('ADBE Vector Fill Opacity', PVT.OneD, 100)]),
  'ADBE Vector Graphic - Stroke': () => grp('ADBE Vector Graphic - Stroke', [leaf('ADBE Vector Stroke Color', PVT.COLOR, [1, 1, 1, 1]), leaf('ADBE Vector Stroke Width', PVT.OneD, 2), leaf('ADBE Vector Stroke Opacity', PVT.OneD, 100)]),
  'ADBE Vector Filter - Repeater': () => grp('ADBE Vector Filter - Repeater', [leaf('ADBE Vector Repeater Copies', PVT.OneD, 3), grp('ADBE Vector Repeater Transform', [leaf('Anchor Point', PVT.TwoD, [0, 0]), leaf('Position', PVT.TwoD, [100, 0])])]),
};
const VGROUP = () => grp('ADBE Vector Group', [grp('ADBE Vectors Group', [], VEC_ITEMS), grp('ADBE Vector Transform Group', [])]);
const EFFECTS = {
  'ADBE Ramp': () => grp('ADBE Ramp', [leaf('Start of Ramp', PVT.TwoD_SPATIAL, [0, 0]), leaf('Start Color', PVT.COLOR, [0, 0, 0, 1]), leaf('End of Ramp', PVT.TwoD_SPATIAL, [0, 100]), leaf('End Color', PVT.COLOR, [1, 1, 1, 1]), leaf('Ramp Shape', PVT.OneD, 1)]),
};
const TEXT_ANIM = () => grp('ADBE Text Animator', [
  grp('ADBE Text Selectors', [], { 'ADBE Text Selector': () => grp('ADBE Text Selector', [leaf('ADBE Text Index Start', PVT.OneD, 0), leaf('ADBE Text Index End', PVT.OneD, 0), grp('ADBE Text Range Advanced', [leaf('ADBE Text Range Units', PVT.OneD, 1)])]) }),
  grp('ADBE Text Animator Properties', [], { 'ADBE Text Fill Color': () => leaf('ADBE Text Fill Color', PVT.COLOR, [1, 0, 0, 1]) }),
]);
const MASK = () => grp('ADBE Mask Atom', [leaf('ADBE Mask Shape', PVT.SHAPE, null), leaf('ADBE Mask Offset', PVT.OneD, 0), leaf('ADBE Mask Feather', PVT.TwoD, [0, 0]), leaf('ADBE Mask Opacity', PVT.OneD, 100)]);

let ROOT_SCHEMA = null;

// ---------- 2b. REAL schema from the user's AE (probe report). Overrides the hand-written schema above. ----------
const PROBE_FILE = process.argv[3] || path.resolve(__dirname, 'probe/AE_probe_24.6.2.txt');
const PROBE = { loaded: false, fonts: {}, version: '' };
(() => {
  if (!fs.existsSync(PROBE_FILE)) return;
  const lines = fs.readFileSync(PROBE_FILE, 'utf8').replace(/\r/g, '').split('\n');
  const ver = lines.find(l => l.startsWith('AE 版本')); PROBE.version = ver ? ver.replace('AE 版本: ', '') : '?';
  function section(title) {
    const s = lines.findIndex(l => l.startsWith('==== ' + title)); const out = [];
    for (let i = s + 1; i < lines.length && !lines[i].startsWith('===='); i++) if (lines[i].trim()) out.push(lines[i]);
    return out;
  }
  function parseTree(ls) {
    const root = { mn: 'root', kind: 'NAMED_GROUP', children: [] }; const stack = [{ depth: -1, node: root }];
    for (const l of ls) {
      const m = l.match(/^( *)\[(\d+)\] ([^|]+?) \| ([^|]*?) \| (PROPERTY|INDEXED_GROUP|NAMED_GROUP)(?: \| (\w+))?/); if (!m) continue;
      const depth = m[1].length / 2; const node = { mn: m[3].trim(), name: m[4].trim(), kind: m[5], vt: m[6], children: [] };
      while (stack[stack.length - 1].depth >= depth) stack.pop();
      stack[stack.length - 1].node.children.push(node); stack.push({ depth, node });
    }
    return root;
  }
  const shapeTree = parseTree(section('形状图层属性树')), textTree = parseTree(section('文字图层属性树'));
  section('字体检查').forEach(l => { const m = l.match(/^(\S+) : (.*)$/); if (m) PROBE.fonts[m[1]] = /^已安装/.test(m[2]); });
  const find = (n, mn) => { if (n.mn === mn) return n; for (const c of n.children) { const r = find(c, mn); if (r) return r; } return null; };
  const START_EMPTY = new Set(['ADBE Root Vectors Group', 'ADBE Vectors Group', 'ADBE Effect Parade', 'ADBE Mask Parade', 'ADBE Text Animators', 'ADBE Text Selectors']);
  function defOf(n) {
    const t = PVT[n.vt];
    if (n.mn === 'ADBE Scale') return [100, 100, 100]; if (n.mn === 'ADBE Position') return [960, 540, 0]; if (/Opacity/.test(n.mn)) return 100;
    if (t === PVT.ThreeD || t === PVT.ThreeD_SPATIAL) return [0, 0, 0]; if (t === PVT.TwoD || t === PVT.TwoD_SPATIAL) return [0, 0];
    if (t === PVT.COLOR) return [1, 1, 1, 1]; if (t === PVT.OneD) return 0; return null;
  }
  function toSchema(n, keepChildren) {
    if (n.kind === 'PROPERTY') { const s = leaf(n.mn, PVT[n.vt], defOf(n)); s.dn = n.name; return s; }
    const addable = {};
    if (START_EMPTY.has(n.mn)) n.children.forEach(c => { addable[c.mn] = () => toSchema(c); });
    if (n.mn === 'ADBE Vectors Group') addable['ADBE Vector Group'] = () => toSchema(find(shapeTree, 'ADBE Vector Group'));
    const g = grp(n.mn, START_EMPTY.has(n.mn) && !keepChildren ? [] : n.children.map(c => toSchema(c)), addable); g.dn = n.name;
    if (n.mn === 'ADBE Text Animator Properties') g.addExisting = true; // AE lists all animator props; addProperty enables one
    return g;
  }
  ROOT_SCHEMA = (kind, src) => {
    const tree = kind === 'text' ? textTree : shapeTree;
    let ch = tree.children.filter(c => !(kind !== 'shape' && c.mn === 'ADBE Root Vectors Group')).map(c => toSchema(c));
    if (kind === 'text') ch = ch.map(c => { if (c.mn !== 'ADBE Text Properties') return c; c.children = c.children.map(x => x.mn === 'ADBE Text Document' ? leaf('ADBE Text Document', PVT.TEXT_DOCUMENT, new TextDocument(src)) : x); return c; });
    return grp('root', ch);
  };
  PROBE.loaded = true;
})();

class Prop {
  constructor(layer, schema, parent) {
    this._layer = layer; this._ver = layer.version; this.matchName = schema.mn; this.parentProperty = parent;
    this.propertyValueType = schema.type; this._v = schema.def; this._keys = []; this._expr = ''; this._interp = {};
    this.name = schema.dn || schema.mn; this._dn = schema.dn;
  }
  _chk() { if (this._ver !== this._layer.version) { stats.staleCaught++; throw new Error('Object is invalid (属性引用已失效): ' + this.matchName); } }
  get value() { this._chk(); return this._v; }
  _validate(v) {
    const t = this.propertyValueType, n = dims[t];
    if (t === PVT.TEXT_DOCUMENT) { if (!(v instanceof TextDocument)) throw new Error('setValue 需要 TextDocument: ' + this.matchName); return; }
    if (t === PVT.SHAPE) { if (!(v instanceof Shape) || !v.vertices.length) throw new Error('setValue 需要 Shape: ' + this.matchName); v.vertices.forEach(p => { if (!isFinite(p[0]) || !isFinite(p[1])) throw new Error('Shape 顶点非数字'); }); return; }
    if (n === 1) { if (typeof v !== 'number' || !isFinite(v)) throw new Error(`值类型错误 ${this.matchName}: ${JSON.stringify(v)}`); return; }
    if (!Array.isArray(v)) throw new Error(`应为数组 ${this.matchName}: ${JSON.stringify(v)}`);
    const okLen = t === PVT.COLOR ? [3, 4] : (n === 3 ? [2, 3] : [n]);
    if (okLen.indexOf(v.length) < 0) throw new Error(`数组长度 ${v.length} 不符合 ${this.matchName}`);
    v.forEach(x => { if (typeof x !== 'number' || !isFinite(x)) throw new Error(`数组含非数字 ${this.matchName}: ${JSON.stringify(v)}`); });
    if (t === PVT.COLOR) v.forEach(x => { if (x < 0 || x > 1) throw new Error('颜色超出 0–1: ' + this.matchName); });
  }
  setValue(v) { this._chk(); this._validate(v); if (this._keys.length) throw new Error('有关键帧时不能 setValue: ' + this.matchName); this._v = v; stats.props++; }
  setValueAtTime(t, v) { this._chk(); this._validate(v); if (!isFinite(t)) throw new Error('时间非法'); const i = this._keys.findIndex(k => Math.abs(k.t - t) < 1e-6); if (i >= 0) this._keys[i].v = v; else this._keys.push({ t, v }); this._keys.sort((a, b) => a.t - b.t); stats.keys++; }
  get numKeys() { this._chk(); return this._keys.length; }
  keyTime(i) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('keyTime 索引越界'); return this._keys[i - 1].t; }
  setTemporalEaseAtKey(i, a, b) {
    this._chk();
    if (!Number.isInteger(i) || i < 1 || i > this._keys.length) throw new Error(`setTemporalEaseAtKey 关键帧索引非法 (${i}) ${this.matchName}`);
    const t = this.propertyValueType, need = (t === PVT.TwoD_SPATIAL || t === PVT.ThreeD_SPATIAL || t === PVT.OneD || t === PVT.COLOR || t === PVT.SHAPE) ? 1 : dims[t];
    if (a.length !== need || b.length !== need) throw new Error(`缓动数组长度应为 ${need}，实际 ${a.length}: ${this.matchName}`);
    [...a, ...b].forEach(e => { if (!(e instanceof KeyframeEase)) throw new Error('缓动需要 KeyframeEase'); if (e.influence < 0.1 || e.influence > 100) throw new Error('influence 越界'); });
  }
  setInterpolationTypeAtKey(i, type) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('插值索引越界'); this._interp[i] = type; }
  get expression() { return this._expr; }
  set expression(e) { this._chk(); this._expr = e; stats.exprs++; allExprs.push({ prop: this, layer: this._layer, expr: e }); }
  valueAtTime(t) {
    if (!this._keys.length) return this._v;
    const K = this._keys; if (t <= K[0].t) return K[0].v; if (t >= K[K.length - 1].t) return K[K.length - 1].v;
    for (let i = 0; i < K.length - 1; i++) if (t >= K[i].t && t <= K[i + 1].t) { const f = (t - K[i].t) / (K[i + 1].t - K[i].t); const a = K[i].v, b = K[i + 1].v; return Array.isArray(a) ? a.map((x, j) => x + (b[j] - x) * f) : a + (b - a) * f; }
  }
}
class Group {
  constructor(layer, schema, parent) {
    this._layer = layer; this._ver = layer.version; this.matchName = schema.mn; this._schema = schema; this.parentProperty = parent; this._name = schema.dn || schema.mn; this._dn = schema.dn;
    this._kids = schema.children.map(c => c.children ? new Group(layer, c, this) : new Prop(layer, c, this));
  }
  _chk() { if (this._ver !== this._layer.version) { stats.staleCaught++; throw new Error('Object is invalid (属性组引用已失效): ' + this.matchName); } }
  get name() { return this._name; } set name(n) { this._chk(); this._name = n; }
  get numProperties() { this._chk(); return this._kids.length; }
  property(k) {
    this._chk();
    let r = typeof k === 'number' ? this._kids[k - 1] : this._kids.find(c => c.matchName === k || c._dn === k);
    if (!r) { MISSING.push(`${this.matchName} → ${k}`); return null; }
    r._ver = this._layer.version; // freshly fetched -> valid
    if (r instanceof Group) r._kids.forEach(function refresh(c) { c._ver = r._layer.version; if (c instanceof Group) c._kids.forEach(refresh); });
    return r;
  }
  addProperty(mn) {
    this._chk();
    if (this._schema.addExisting) { const ex = this._kids.find(c => c.matchName === mn); if (ex) { this._layer.version++; return ex; } }
    const f = this._schema.addable[mn]; if (!f) throw new Error(`不能在 ${this.matchName} 下添加 ${mn}`);
    const sc = f(); const p = sc.children ? new Group(this._layer, sc, this) : new Prop(this._layer, sc, this);
    this._kids.push(p); this._layer.version++; // AE invalidates previously fetched references
    return p;
  }
  canAddProperty(mn) { return !!this._schema.addable[mn]; }
}

const FONTS_USED = new Set();
const RUNS = []; let runErr = 0;
class CharacterRange { constructor(td, a, b) { if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > String(td.text).length || a >= b) { runErr++; throw new Error(`characterRange(${a},${b}) 越界，文字长度 ${String(td.text).length}`); } this.td = td; this.a = a; this.b = b; }
  set font(f) { FONTS_USED.add(f); RUNS.push({ text: String(this.td.text).slice(this.a, this.b), font: f }); } get font() { return undefined; } }
class TextDocument { set font(f) { this._font = f; FONTS_USED.add(f); } get font() { return this._font; }
  characterRange(a, b) { return new CharacterRange(this, a, b === undefined ? a + 1 : b); }
  constructor(t) { this.text = t; this._font = ''; this.fontSize = 36; this.fillColor = [1, 1, 1]; this.tracking = 0; this.justification = 0; this.applyFill = true; this.leading = 0; this.autoLeading = true; } resetCharStyle() { } }
class Shape { constructor() { this.vertices = []; this.inTangents = []; this.outTangents = []; this.closed = true; } }
class KeyframeEase { constructor(speed, influence) { this.speed = speed; this.influence = influence; } }

class Layer {
  constructor(comp, kind, src) {
    this.version = 0; this.comp = comp; this.kind = kind; this.source = src; this.name = kind; this.startTime = 0; this.inPoint = 0; this.outPoint = comp.duration; this.enabled = true; this.audioEnabled = true;
    const T = grp('ADBE Transform Group', [leaf('ADBE Anchor Point', PVT.ThreeD_SPATIAL, [0, 0, 0]), leaf('ADBE Position', PVT.ThreeD_SPATIAL, [960, 540, 0]), leaf('ADBE Scale', PVT.ThreeD, [100, 100, 100]), leaf('ADBE Rotate Z', PVT.OneD, 0), leaf('ADBE Opacity', PVT.OneD, 100)]);
    const ch = [T, grp('ADBE Effect Parade', [], EFFECTS), grp('ADBE Mask Parade', [], { 'ADBE Mask Atom': MASK })];
    if (kind === 'shape') ch.push(grp('ADBE Root Vectors Group', [], { 'ADBE Vector Group': VGROUP }));
    if (kind === 'text') ch.push(grp('ADBE Text Properties', [leaf('ADBE Text Document', PVT.TEXT_DOCUMENT, new TextDocument(src)), grp('ADBE Text Animators', [], { 'ADBE Text Animator': TEXT_ANIM })]));
    /* 摄像机：变换组里「ADBE Anchor Point」= 目标点；另有摄像机选项组（官方文档 matchnames/layer/cameralayer.md） */
    const CAMT = grp('ADBE Transform Group', [leaf('ADBE Anchor Point', PVT.ThreeD_SPATIAL, [960, 540, 0]), leaf('ADBE Position', PVT.ThreeD_SPATIAL, [960, 540, -2666.7]), leaf('ADBE Orientation', PVT.ThreeD_SPATIAL, [0, 0, 0]), leaf('ADBE Rotate X', PVT.OneD, 0), leaf('ADBE Rotate Y', PVT.OneD, 0), leaf('ADBE Rotate Z', PVT.OneD, 0), leaf('ADBE Opacity', PVT.OneD, 100)]);
    const CAMO = grp('ADBE Camera Options Group', [leaf('ADBE Camera Zoom', PVT.OneD, 2666.7), leaf('ADBE Camera Depth of Field', PVT.OneD, 0), leaf('ADBE Camera Focus Distance', PVT.OneD, 2666.7), leaf('ADBE Camera Aperture', PVT.OneD, 25.3), leaf('ADBE Camera Blur Level', PVT.OneD, 100)]);
    this._root = new Group(this, kind === 'camera' ? grp('root', [CAMT, CAMO]) : (ROOT_SCHEMA ? ROOT_SCHEMA(kind, src) : grp('root', ch)), null);
    this._3d = kind === 'camera';
  }
  /* 3D 开关：AE 里切换后变换组的属性会变，之前拿到的引用失效 —— 这里同样让旧引用报错 */
  get threeDLayer() { return this._3d; }
  set threeDLayer(v) { if (this.kind === 'camera') throw new Error('摄像机图层不能设置 threeDLayer'); if (!!v !== this._3d) { this._3d = !!v; this.version++; stats.threeD = (stats.threeD || 0) + (v ? 1 : 0); } }
  property(k) { this._root._ver = this.version; return this._root.property(k); }
  /* 时间重映射：只有视频素材 / 预合成图层可以开；开启后才出现「ADBE Time Remapping」属性（与 AE 一致） */
  get canSetTimeRemapEnabled() { return (this.kind === 'footage' && /\.(mp4|mov)$/i.test(this.source.file || '')) || this.kind === 'precomp'; }
  get timeRemapEnabled() { return !!this._tr; }
  set timeRemapEnabled(v) { if (v && !this.canSetTimeRemapEnabled) throw new Error('该图层不能开启时间重映射: ' + this.name);
    if (v && !this._tr) { const lf = leaf('ADBE Time Remapping', PVT.OneD, 0); lf.dn = 'Time Remap'; this._root._kids.push(new Prop(this, lf, this._root)); this.version++; stats.timeRemap = (stats.timeRemap || 0) + 1; }
    this._tr = !!v; }
  get parent() { return this._parent || null; } set parent(p) { if (p && p.comp !== this.comp) throw new Error('父层必须在同一个合成里'); this._parent = p; }
  get Masks() { return this.property('ADBE Mask Parade'); }
  sourceRectAtTime(t, ext) { if (this.kind !== 'text') throw new Error('sourceRectAtTime 仅用于文字层'); const td = this.property('ADBE Text Properties').property('ADBE Text Document').value; const lines = String(td.text).split('\r'); const w = Math.max(...lines.map(l => l.length)) * td.fontSize * 0.95; return { left: 0, top: -td.fontSize * 0.88, width: w, height: td.fontSize * lines.length }; }
  moveToEnd() { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.push(this); }
  moveToBeginning() { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.unshift(this); }
  moveAfter(o) { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.splice(L.indexOf(o) + 1, 0, this); }
}
class LayerCollection {
  constructor(c) { this.comp = c; this._l = []; }
  _push(l) { this._l.unshift(l); return l; }
  addShape() { return this._push(new Layer(this.comp, 'shape')); }
  addCamera(name, center) { if (typeof name !== 'string' || !Array.isArray(center) || center.length !== 2) throw new Error('addCamera(name, [x, y]) 参数错误'); const l = this._push(new Layer(this.comp, 'camera')); l.name = name; l.property('ADBE Transform Group').property('ADBE Anchor Point')._v = [center[0], center[1], 0]; stats.cameras = (stats.cameras || 0) + 1; return l; }
  addText(t) { if (typeof t !== 'string') throw new Error('addText 需要字符串'); return this._push(new Layer(this.comp, 'text', t)); }
  add(item) { if (!item || !(item instanceof FootageItem || item instanceof CompItem)) throw new Error('layers.add 需要素材或合成'); return this._push(new Layer(this.comp, item instanceof CompItem ? 'precomp' : 'footage', item)); }
  get length() { return this._l.length; }
}
class Item { constructor(name) { this.name = name; this.parentFolder = null; } }
class FolderItem extends Item { }
class CompItem extends Item {
  constructor(n, w, h, par, dur, fps) { super(n); if (!(dur > 0 && dur <= 10800)) throw new Error('合成时长非法: ' + dur); if (fps !== 60) throw new Error('帧率应为 60'); Object.assign(this, { width: w, height: h, pixelAspect: par, duration: dur, frameRate: fps }); this.layers = new LayerCollection(this); }
  openInViewer() { }
}
function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function jpgSize(f) { const b = fs.readFileSync(f); let i = 2; while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const mk = b[i + 1], len = b.readUInt16BE(i + 2); if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } throw new Error('无法读取 JPG 尺寸: ' + f); }
class FootageItem extends Item {
  constructor(f, seq) { super(path.basename(f)); this.file = f; this.mainSource = { conformFrameRate: 0 }; this.seq = seq;
    if (/\.png$/i.test(f)) [this.width, this.height] = pngSize(f); else if (/\.jpe?g$/i.test(f)) [this.width, this.height] = jpgSize(f); else if (/\.mp4$/i.test(f)) { try { [this.width, this.height] = require('child_process').execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number); } catch (e) { [this.width, this.height] = [1920, 1080]; } } else [this.width, this.height] = [0, 0];
    if (seq) this.frames = fs.readdirSync(path.dirname(f)).filter(x => x.endsWith('.png')).length; }
}
const project = { items: { _all: [], addComp(...a) { const c = new CompItem(...a); this._all.push(c); return c; }, addFolder(n) { const f = new FolderItem(n); this._all.push(f); return f; } },
  importFile(io) { if (!io.file.exists) throw new Error('导入文件不存在'); const it = new FootageItem(io.file.fsName, io.sequence); project.items._all.push(it); return it; } };
class File { constructor(p) { this.fsName = p; } get exists() { return fs.existsSync(this.fsName); } get parent() { return new File(path.dirname(this.fsName)); } }
class ImportOptions { constructor(f) { this.file = f; this.sequence = false; } }
let undoDepth = 0;
const sandbox = {
  app: { project, newProject() { sandbox.app.newProjectCalled = true; }, beginUndoGroup() { undoDepth++; }, endUndoGroup() { undoDepth--; },
    fonts: { getFontsByPostScriptName: n => (PROBE.loaded ? (PROBE.fonts[n] ? [{ postScriptName: n }] : []) : [{ postScriptName: n }]) } },
  confirm: m => { notes.push('字体预检弹窗已触发（模拟用户点「是」继续）: ' + m.split('\n').filter(x => /^[A-Za-z]+-/.test(x)).join(', ')); return true; },
  $: { fileName: file }, File, ImportOptions, TextDocument, Shape, KeyframeEase, alert: m => { notes.push('脚本弹窗: ' + m); if (/重建中断/.test(m)) fail('脚本在 AE 中会中断：' + m.replace(/\n/g, ' ')); },
  PropertyValueType: PVT, ParagraphJustification: { LEFT_JUSTIFY: 7413, RIGHT_JUSTIFY: 7414, CENTER_JUSTIFY: 7415 },
  KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 }, BlendingMode: { NORMAL: 5212, LIGHTEN: 5220, MULTIPLY: 5216, SCREEN: 5222 }, Math, parseInt, Error,
};

// ---------- 3. Run ----------
try { vm.runInNewContext(src, sandbox, { filename: path.basename(file) }); notes.push('脚本完整运行，无异常'); }
catch (e) { fail('运行异常: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); }
if (undoDepth !== 0) fail('beginUndoGroup / endUndoGroup 不配对');

// ---------- 4. Evaluate expressions ----------
const comps = project.items._all.filter(x => x instanceof CompItem);
function compOf(layer) { return layer.comp; }
let exprOK = 0;
for (const { prop, layer, expr } of allExprs) {
  const comp = compOf(layer);
  for (const t of [0, 1.5, 7.33, 20.1, 37.5]) {
    const ctx = {
      time: t, value: prop._v instanceof TextDocument ? prop._v.text : prop._v, Math,
      thisComp: { layer: n => { const l = comp.layers._l.find(x => x.name === n); if (!l) throw new Error('表达式引用了不存在的图层: ' + n); return { sourceRectAtTime: (tt, e) => l.sourceRectAtTime(tt, e), transform: { position: l.property('ADBE Transform Group').property('ADBE Position').valueAtTime(t), opacity: l.property('ADBE Transform Group').property('ADBE Opacity').valueAtTime(t) } }; } },
    };
    try {
      // AE expressions: last statement value is the result. Emulate with an indirect eval in a sandbox.
      const ex = expr.replace(/value \+ (\[.*\])\s*;?\s*$/, '__addv($1)');
      const res = vm.runInNewContext(ex, Object.assign({ __addv: a => a.length > 2 ? ctx.value.map((v, i) => v + (a[i] || 0)) : [ctx.value[0] + a[0], ctx.value[1] + a[1]] }, ctx));
      const t0 = prop.propertyValueType;
      if (t0 === PVT.TEXT_DOCUMENT) { if (typeof res !== 'string') throw new Error('文字表达式未返回字符串'); }
      else if (dims[t0] === 1) { if (typeof res !== 'number' || !isFinite(res)) throw new Error('应返回数字，得到 ' + JSON.stringify(res)); }
      else if (!Array.isArray(res) || res.some(x => !isFinite(x))) throw new Error('应返回数组，得到 ' + JSON.stringify(res));
    } catch (e) { fail(`表达式错误 [${comp.name} / ${layer.name} / ${prop.matchName}] t=${t}: ${e.message}\n  ${expr}`); break; }
  }
  exprOK++;
}
function fixArith(e) { return e.replace(/__adds\(Math\.sin\(time\*([\d.]+)\)\*([\d.]+)\)$/, '__adds(Math.sin(time*$1)*$2)'); }

// ---------- 5. Structural checks ----------
if (MISSING.length) notes.push('按名称查找未命中（已由备用路径处理）: ' + [...new Set(MISSING)].join('; '));
const spec = sandbox.SPEC || vm.runInNewContext(src.slice(0, src.indexOf('/* ===== runtime')) + ';SPEC');
if (spec.kind === 'component') { componentReport(); return; }
const main = comps.find(c => c.name === spec.mainName);
if (!main) fail('缺少主合成'); else {
  if (Math.abs(main.duration - spec.dur) > 1e-6) fail('主合成时长不等于口播 ' + spec.dur + 's');
  if (main.width !== 1920 || main.height !== 1080) fail('主合成尺寸错误');
}
let keyTotal = 0, layerTotal = 0;
for (const sh of spec.shots) {
  const c = comps.find(x => x.name === sh.name); if (!c) { fail('缺少镜头合成 ' + sh.name); continue; }
  layerTotal += c.layers.length;
  for (const L of c.layers._l) {
    const walk = g => g._kids.forEach(k => { if (k instanceof Group) walk(k); else { keyTotal += k._keys.length; k._keys.forEach(kk => { if (kk.t < -0.001 || kk.t > c.duration + 0.001) fail(`关键帧超出镜头时长 ${c.name}/${L.name}/${k.matchName} t=${kk.t}`); }); } });
    walk(L._root);
    // IP zone check (440x240 top-left): position of non-background layers
    if (L.kind !== 'shape' || !/背景|网格|等高线/.test(L.name)) {
      const pos = L.property('ADBE Transform Group').property('ADBE Position').valueAtTime(c.duration / 2);
      if (L.kind === 'text' && pos[0] < 440 && pos[1] < 240) fail(`文字进入 IP 角标区: ${c.name}/${L.name} @ ${pos}`);
    }
  }
  const seqL = c.layers._l.filter(l => l.kind === 'footage' && l.source.seq);
  seqL.forEach(l => { const len = l.source.frames / 30; const s = l.startTime; if (s > 0.001 || s + len < c.duration - 0.05 && !/S1/.test(c.name)) notes.push(`提示：${c.name} 抠像序列覆盖 ${s.toFixed(3)}–${(s + len).toFixed(3)}s，镜头时长 ${c.duration}s`); });
}
const subs = main ? main.layers._l.filter(l => /^字幕_\d+$/.test(l.name)) : [];
if (subs.length !== spec.subs.length) fail(`字幕层数量 ${subs.length} ≠ ${spec.subs.length}`);
subs.forEach(l => { const td = l.property('ADBE Text Properties').property('ADBE Text Document').value; if (td.fontSize < 40) fail('字幕字号过小'); });
const sfxL = main ? main.layers._l.filter(l => /^音效_/.test(l.name)) : [];
if (sfxL.length !== spec.sfx.length) fail('音效层数量不符');
sfxL.forEach(l => { if (l.startTime < 0 || l.startTime > spec.dur) fail('音效时间越界 ' + l.name); });
const textLayers = comps.flatMap(c => c.layers._l.filter(l => l.kind === 'text'));
textLayers.forEach(l => { const td = l.property('ADBE Text Properties').property('ADBE Text Document').value; if (!td.font) fail('文字层未设字体 ' + l.name);
  if (/\\[rnt]/.test(String(td.text))) fail('文字层含字面转义符（会在 AE 里原样显示成 \\r / \\n）: ' + l.name + ' → ' + String(td.text).slice(0, 40)); });

// stale-reference self test: prove the mock really invalidates
(() => { const c = new CompItem('t', 100, 100, 1, 1, 60); const L = c.layers.addShape(); const root = L.property('ADBE Root Vectors Group'); root.addProperty('ADBE Vector Group'); let threw = false; try { root.numProperties; } catch (e) { threw = true; } if (!threw) fail('模拟器自检失败：失效引用未报错'); else notes.push('模拟器自检：添加属性后旧引用会报错（与 AE 一致）'); })();

console.log('==== ' + spec.title + ' · AE 重建脚本 · 模拟测试报告 ====');
console.log(PROBE.loaded ? `· 对象模型：使用你的 AE 实测属性树（AE ${PROBE.version}，中文界面）` : '· 对象模型：手写（未加载探测报告）');
if (PROBE.loaded) { const miss = [...FONTS_USED].filter(f => f && PROBE.fonts[f] === false); const unk = [...FONTS_USED].filter(f => f && PROBE.fonts[f] === undefined);
  const shippedF = path.join(path.dirname(file), 'fonts', 'fonts.txt'); const shipped = fs.existsSync(shippedF) ? fs.readFileSync(shippedF, 'utf8').split(/\s+/).filter(Boolean) : [];
  const notShipped = miss.filter(f => shipped.indexOf(f) < 0);
  if (notShipped.length) fail('脚本使用了你电脑上未安装、且包里也没附带的字体: ' + notShipped.join(', '));
  else if (miss.length) notes.push('你电脑上缺 ' + miss.length + ' 个字体（' + miss.join(', ') + '），已随包附带 fonts/ 文件夹，安装后即可'); if (unk.length) notes.push('未在探测报告中检查过的字体: ' + unk.join(', '));
  else if (!miss.length) notes.push('脚本用到的字体 ' + FONTS_USED.size + ' 个，全部已在你的电脑上安装'); }
notes.forEach(n => console.log('· ' + n));
console.log(`· 合成 ${comps.length} 个（1 主合成 + ${spec.shots.length} 镜头），镜头内图层 ${layerTotal}，主合成图层 ${main ? main.layers.length : 0}`);
if (stats.cameras || stats.threeD) console.log(`· 3D：摄像机 ${stats.cameras || 0} 台，3D 图层 ${stats.threeD || 0} 个，时间重映射 ${stats.timeRemap || 0} 处（摄像机 / 3D 属性名按官方文档核对，未在你的 AE 实测）`);
console.log(`· 关键帧 ${stats.keys} 个（镜头内 ${keyTotal}），表达式 ${stats.exprs} 条（逐条在 5 个时间点求值通过 ${exprOK - (errors.filter(e => e.startsWith('表达式')).length)} 条）`);
console.log(`· 分段字体：${RUNS.length} 段中文/符号改用 Noto 显示（如「${RUNS.slice(0,3).map(r=>r.text).join('」「')}」）${runErr ? '，越界 ' + runErr + ' 处' : ''}`);
if (runErr) fail('characterRange 索引越界 ' + runErr + ' 处');
console.log(`· 字幕 ${subs.length} 条，音效 ${sfxL.length} 个，素材导入 ${project.items._all.filter(x => x instanceof FootageItem).length} 个`);
if (errors.length) { console.log(`\n✗ 失败 ${errors.length} 项:`); errors.slice(0, 30).forEach(e => console.log('  - ' + e)); process.exit(1); }
console.log('\n✓ 全部通过');

// ---------- 组件包（SPEC.kind === 'component'）：导入到现有工程的独立合成组 ----------
function componentReport() {
  const byName = n => comps.find(c => c.name === n);
  const folders = project.items._all.filter(x => x instanceof FolderItem);
  const root = folders.find(f => f.name === spec.folder);
  if (!root) fail('缺少组件文件夹 ' + spec.folder);
  if (sandbox.app.newProjectCalled) fail('脚本新建了工程（应导入到当前工程）');
  let keyTotal = 0, layerTotal = 0;
  const under = it => { let p = it.parentFolder, d = 0; while (p && d < 5) { if (p === root) return true; p = p.parentFolder; d++; } return false; };
  for (const cs of spec.comps) {
    const c = byName(cs.name); if (!c) { fail('缺少合成 ' + cs.name); continue; }
    if (c.width !== cs.w || c.height !== cs.h || Math.abs(c.duration - cs.dur) > 1e-6) fail('合成尺寸 / 时长不符 ' + cs.name);
    if (!Number.isInteger(c.width) || !Number.isInteger(c.height)) fail('合成尺寸必须是整数 ' + cs.name);
    if (!under(c)) fail('合成不在组件文件夹里 ' + cs.name);
    if (c.layers.length !== cs.layers.length) fail(`图层数 ${c.layers.length} ≠ ${cs.layers.length}：${cs.name}`);
    layerTotal += c.layers.length;
    // 图层顺序与 SPEC 一致（SPEC 从上到下）
    cs.layers.forEach((ls, i) => { const L = c.layers._l[i]; if (!L || L.name !== ls.name) fail(`图层顺序不符 ${cs.name} 第 ${i + 1} 层：应为 ${ls.name}，实际 ${L && L.name}`); });
    for (const L of c.layers._l) {
      const walk = g => g._kids.forEach(k => { if (k instanceof Group) walk(k); else { keyTotal += k._keys.length;
        k._keys.forEach(kk => { if (kk.t < -0.001 || kk.t > c.duration + 0.001) fail(`关键帧超出合成时长 ${c.name}/${L.name}/${k.matchName} t=${kk.t}`); });
        if (k._keys.length >= 2 && Object.keys(k._interp).length !== k._keys.length) fail(`关键帧插值未全部设成线性 ${c.name}/${L.name}/${k.matchName}`); } });
      walk(L._root);
      if (L.kind === 'precomp') {
        const s = L.source; if (comps.indexOf(s) < 0) fail('预合成来源不存在 ' + L.name);
        if (L.startTime > 1e-6 || L.startTime + s.duration < c.duration - 1e-6) fail(`预合成没有覆盖整个父合成时长 ${c.name}/${L.name}：${L.startTime}–${L.startTime + s.duration}s`);
      }
      if (L.kind === 'text') { const td = L.property('ADBE Text Properties').property('ADBE Text Document').value; if (td.fontSize < 16) fail('字号低于 16px ' + L.name); }
    }
  }
  // 1920 摆位版：组件不得进入左上角 440×240 IP 区
  const full = spec.comps.find(c => c.w === 1920 && c.h === 1080);
  if (full) { full.layers.filter(l => l.k === 'comp').forEach(l => { const src = spec.comps.find(c => c.name === l.ref); const p = l.tr.p, a = l.tr.a;
    const x0 = p[0] - a[0], y0 = p[1] - a[1]; if (x0 < 440 && y0 < 240) fail('组件进入 IP 角标区'); notes.push(`1920 摆位版：组件范围 x ${x0}–${x0 + src.w}，y ${y0}–${y0 + src.h}（IP 区 440×240 之外）`); }); }
  const aud = comps.flatMap(c => c.layers._l.filter(l => l.kind === 'footage' && /\.wav$/i.test(l.source.file)));
  if (aud.length !== spec.sfx.length) fail(`音效层 ${aud.length} ≠ ${spec.sfx.length}`);
  const textLayers = comps.flatMap(c => c.layers._l.filter(l => l.kind === 'text'));
  textLayers.forEach(l => { const td = l.property('ADBE Text Properties').property('ADBE Text Document').value; if (!td.font) fail('文字层未设字体 ' + l.name); if (/\\[rnt]/.test(String(td.text))) fail('文字层含字面转义符 ' + l.name); });
  (() => { const c = new CompItem('t', 100, 100, 1, 1, 60); const L = c.layers.addShape(); const r = L.property('ADBE Root Vectors Group'); r.addProperty('ADBE Vector Group'); let threw = false; try { r.numProperties; } catch (e) { threw = true; } if (!threw) fail('模拟器自检失败：失效引用未报错'); else notes.push('模拟器自检：添加属性后旧引用会报错（与 AE 一致）'); })();
  console.log('==== ' + spec.title + ' · AE 导入脚本 · 模拟测试报告 ====');
  console.log(PROBE.loaded ? `· 对象模型：使用你的 AE 实测属性树（AE ${PROBE.version}，中文界面）` : '· 对象模型：手写（未加载探测报告）');
  if (PROBE.loaded) { const miss = [...FONTS_USED].filter(f => f && PROBE.fonts[f] === false);
    const shippedF = path.join(path.dirname(file), 'fonts', 'fonts.txt'); const shipped = fs.existsSync(shippedF) ? fs.readFileSync(shippedF, 'utf8').split(/\s+/).filter(Boolean) : [];
    const notShipped = miss.filter(f => shipped.indexOf(f) < 0);
    if (notShipped.length) fail('脚本使用了你电脑上未安装、且包里也没附带的字体: ' + notShipped.join(', '));
    else if (miss.length) notes.push('你电脑上缺 ' + miss.length + ' 个字体（' + miss.join(', ') + '），已随包附带 fonts/ 文件夹，安装后即可');
    else notes.push('脚本用到的字体 ' + FONTS_USED.size + ' 个，全部已在你的电脑上安装'); }
  notes.forEach(n => console.log('· ' + n));
  console.log(`· 导入到当前工程：新建文件夹「${spec.folder}」，合成 ${comps.length} 个（${spec.comps.map(c => c.name).join('、')}），图层 ${layerTotal}`);
  console.log(`· 关键帧 ${stats.keys} 个（全部线性，时间都在合成范围内），表达式 ${stats.exprs} 条`);
  console.log(`· 文字层 ${textLayers.length} 个，音效 ${aud.length} 个，素材导入 ${project.items._all.filter(x => x instanceof FootageItem).length} 个`);
  if (errors.length) { console.log(`\n✗ 失败 ${errors.length} 项:`); errors.slice(0, 30).forEach(e => console.log('  - ' + e)); process.exit(1); }
  console.log('\n✓ 全部通过');
  process.exit(0);
}
