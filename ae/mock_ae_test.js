// 模拟 After Effects 对象模型 + 测试：把一期的 AE 重建脚本完整跑一遍（白帽志 P6；由「艾唯说挖洞」的自有测试工具改造，不含 lieflat 代码）。
// 用法：node ae/mock_ae_test.js <脚本.jsx> [探测报告.txt]      （python3 ae/build_ae.py 会自动调用）
// 对象模型用用户 AE 24.6.2 的探测报告（ae/probe/）；探测报告没覆盖的少数属性（修剪路径、滑块控制）按官方文档副本（ae/aedocs）补。
// 检查：ES3 语法 · matchName 都在官方文档里 · 每次添加属性后旧引用失效（与 AE 一致）· 值类型 / 关键帧 / 缓动参数 · 表达式逐条求值
//      · 父层在挂子层时不能已有变换关键帧 · 位置拆维以后不能再写整体位置 · 章节进度条区（顶部 76px）没有文字 · 每个镜头有背景板 · 字体随包
const fs = require('fs'), path = require('path'), vm = require('vm');
const acorn = require(path.resolve(__dirname, 'node_modules/acorn'));
const file = path.resolve(process.argv[2]);
const src = fs.readFileSync(file, 'utf8');
const errors = [], notes = [];
function fail(m) { errors.push(m); }

// ---------- 1. ES3 syntax check ----------
try { acorn.parse(src, { ecmaVersion: 3, allowReserved: false }); notes.push('ES3 语法解析通过'); }
catch (e) { fail('ES3 语法错误: ' + e.message); }
for (const re of [/\blet\s/, /\bconst\s/, /=>/, /`/, /\.forEach\(/, /\.map\(/, /\.filter\(/, /\.trim\(/, /JSON\./]) {
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
  const rt = src.slice(src.indexOf('\n', src.indexOf('var SPEC = ')));
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
// 探测报告没覆盖、按官方文档补的（matchName 已在 1b 里和文档核对）
const DOC_ONLY = {
  'ADBE Slider Control': () => grp('ADBE Slider Control', [leaf('ADBE Slider Control-0001', PVT.OneD, 0)]),
  'ADBE Vector Filter - Trim': () => grp('ADBE Vector Filter - Trim', [leaf('ADBE Vector Trim Start', PVT.OneD, 0), leaf('ADBE Vector Trim End', PVT.OneD, 100), leaf('ADBE Vector Trim Offset', PVT.OneD, 0)]),
};
const EFFECTS = {
  'ADBE Slider Control': DOC_ONLY['ADBE Slider Control'],
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
    if (n.mn === 'ADBE Vectors Group' || n.mn === 'ADBE Root Vectors Group') addable['ADBE Vector Filter - Trim'] = DOC_ONLY['ADBE Vector Filter - Trim'];
    if (n.mn === 'ADBE Effect Parade') addable['ADBE Slider Control'] = DOC_ONLY['ADBE Slider Control'];
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
    if (t === PVT.SHAPE) { if (!(v instanceof Shape) || !v.vertices.length) throw new Error('setValue 需要 Shape: ' + this.matchName); [...v.vertices, ...v.inTangents, ...v.outTangents].forEach(p => { if (!isFinite(p[0]) || !isFinite(p[1])) throw new Error('Shape 顶点 / 切线非数字'); });
      if ((v.inTangents.length && v.inTangents.length !== v.vertices.length) || (v.outTangents.length && v.outTangents.length !== v.vertices.length)) throw new Error('Shape 切线数量和顶点数量不一致'); return; }
    if (n === 1) { if (typeof v !== 'number' || !isFinite(v)) throw new Error(`值类型错误 ${this.matchName}: ${JSON.stringify(v)}`); return; }
    if (!Array.isArray(v)) throw new Error(`应为数组 ${this.matchName}: ${JSON.stringify(v)}`);
    const okLen = t === PVT.COLOR ? [3, 4] : (n === 3 ? [2, 3] : [n]);
    if (okLen.indexOf(v.length) < 0) throw new Error(`数组长度 ${v.length} 不符合 ${this.matchName}`);
    v.forEach(x => { if (typeof x !== 'number' || !isFinite(x)) throw new Error(`数组含非数字 ${this.matchName}: ${JSON.stringify(v)}`); });
    if (t === PVT.COLOR) v.forEach(x => { if (x < 0 || x > 1) throw new Error('颜色超出 0–1: ' + this.matchName); });
  }
  _sepChk() { const sep = !!this._layer._sep, mn = this.matchName;
    if (mn === 'ADBE Position' && sep && this.parentProperty && this.parentProperty.matchName === 'ADBE Transform Group') throw new Error('位置已拆成 X / Y 两个维度，不能再写整体「位置」: ' + this._layer.name);
    if (/^ADBE Position_\d$/.test(mn) && !sep) throw new Error('位置还没拆维度，不能写 ' + mn + ': ' + this._layer.name); }
  setValue(v) { this._chk(); this._sepChk(); this._validate(v); if (this._keys.length) throw new Error('有关键帧时不能 setValue: ' + this.matchName); this._v = v; stats.props++; }
  setValueAtTime(t, v) { this._chk(); this._sepChk(); this._validate(v); if (!isFinite(t)) throw new Error('时间非法'); const i = this._keys.findIndex(k => Math.abs(k.t - t) < 1e-6); if (i >= 0) this._keys[i].v = v; else this._keys.push({ t, v }); this._keys.sort((a, b) => a.t - b.t); stats.keys++; }
  get numKeys() { this._chk(); return this._keys.length; }
  keyTime(i) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('keyTime 索引越界'); return this._keys[i - 1].t; }
  setTemporalEaseAtKey(i, a, b) {
    this._chk();
    if (!Number.isInteger(i) || i < 1 || i > this._keys.length) throw new Error(`setTemporalEaseAtKey 关键帧索引非法 (${i}) ${this.matchName}`);
    const t = this.propertyValueType, need = (t === PVT.TwoD_SPATIAL || t === PVT.ThreeD_SPATIAL || t === PVT.OneD || t === PVT.COLOR || t === PVT.SHAPE) ? 1 : dims[t];
    if (a.length !== need || b.length !== need) throw new Error(`缓动数组长度应为 ${need}，实际 ${a.length}/${b.length}: ${this.matchName}`);
    [...a, ...b].forEach(e => { if (!(e instanceof KeyframeEase)) throw new Error('缓动需要 KeyframeEase'); if (!(e.influence >= 0.1 && e.influence <= 100)) throw new Error('influence 越界 ' + e.influence + ': ' + this.matchName); if (!isFinite(e.speed)) throw new Error('缓动速度不是数字: ' + this.matchName); });
  }
  setInterpolationTypeAtKey(i, a, b) { this._chk(); if (!Number.isInteger(i) || i < 1 || i > this._keys.length) throw new Error('插值索引越界 ' + this.matchName); if (a === undefined) throw new Error('插值类型缺失'); this._keys[i - 1].ii = a; this._keys[i - 1].io = b === undefined ? a : b; this._interp[i] = a; }
  keyInInterpolationType(i) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('索引越界'); return this._keys[i - 1].ii || 6613; }
  keyOutInterpolationType(i) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('索引越界'); return this._keys[i - 1].io || 6613; }
  _easeN() { const t = this.propertyValueType; return (t === PVT.TwoD_SPATIAL || t === PVT.ThreeD_SPATIAL || t === PVT.OneD || t === PVT.COLOR || t === PVT.SHAPE) ? 1 : dims[t]; }
  keyInTemporalEase(i) { this._chk(); if (i < 1 || i > this._keys.length) throw new Error('索引越界'); return Array.from({ length: this._easeN() }, () => new KeyframeEase(0, 16.666667)); }
  keyOutTemporalEase(i) { return this.keyInTemporalEase(i); }
  nearestKeyIndex(t) { this._chk(); if (!this._keys.length) throw new Error('没有关键帧: ' + this.matchName); let b = 0; this._keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(this._keys[b].t - t)) b = i; }); return b + 1; }
  removeKey(i) { this._chk(); if (!Number.isInteger(i) || i < 1 || i > this._keys.length) throw new Error('removeKey 索引越界 ' + i); this._keys.splice(i - 1, 1); }
  get dimensionsSeparated() { return this.matchName === 'ADBE Position' ? !!this._layer._sep : false; }
  set dimensionsSeparated(v) { this._chk(); if (this.matchName !== 'ADBE Position') throw new Error('只有位置能拆维度');
    if (v && !this._layer._sep) { const g = this.parentProperty; ['ADBE Position_0', 'ADBE Position_1', 'ADBE Position_2'].forEach((mn, d) => { const q = g._kids.find(c => c.matchName === mn); if (q) q._v = (this._v || [0, 0, 0])[d] || 0; });
      if (this._keys.length) throw new Error('位置已有关键帧时拆维度（AE 会把关键帧拆开，网页曲线对不上）'); this._layer._sep = true; this._layer.version++; } }
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
    let r = typeof k === 'number' ? this._kids[k - 1] : this._kids.find(c => c.matchName === k || c._dn === k || (c instanceof Group && c._name === k));
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
const chkRun = (k, v) => { if (k === 'fontSize' && !(v > 0)) throw new Error('字号非法 ' + v); if (k === 'fillColor' && !(Array.isArray(v) && v.length === 3 && v.every(x => x >= 0 && x <= 1))) throw new Error('颜色非法 ' + v); if (k === 'tracking' && !isFinite(v)) throw new Error('字距非法'); };
class CharacterRange { constructor(td, a, b) { if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > String(td.text).length || a >= b) { runErr++; throw new Error(`characterRange(${a},${b}) 越界，文字长度 ${String(td.text).length}`); } this.td = td; this.a = a; this.b = b; }
  set font(f) { FONTS_USED.add(f); RUNS.push({ text: String(this.td.text).slice(this.a, this.b), font: f }); } get font() { return undefined; }
  set fontSize(v) { chkRun('fontSize', v); } set fillColor(v) { chkRun('fillColor', v); } set tracking(v) { chkRun('tracking', v); } set applyFill(v) { } set fauxBold(v) { } }
class TextDocument { set font(f) { this._font = f; FONTS_USED.add(f); } get font() { return this._font; }
  set fillColor(v) { chkRun('fillColor', v); this._fill = v; } get fillColor() { return this._fill; } set fontSize(v) { chkRun('fontSize', v); this._size = v; } get fontSize() { return this._size; }
  characterRange(a, b) { return new CharacterRange(this, a, b === undefined ? a + 1 : b); }
  constructor(t) { this.text = t; this._font = ''; this._size = 36; this._fill = [1, 1, 1]; this.fauxBold = false; this.tracking = 0; this.justification = 0; this.applyFill = true; this.leading = 0; this.autoLeading = true; } resetCharStyle() { } }
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
    if (v && !this._tr) { const lf = leaf('ADBE Time Remapping', PVT.OneD, 0); lf.dn = 'Time Remap'; const P = new Prop(this, lf, this._root); this._root._kids.push(P); this.version++; stats.timeRemap = (stats.timeRemap || 0) + 1;
      const d = this.source.duration || this.comp.duration; P._keys = [{ t: 0, v: 0 }, { t: d, v: d }]; }   // AE 开启时间重映射会自带首尾两个关键帧
    this._tr = !!v; }
  get parent() { return this._parent || null; }
  set parent(p) { if (p && p.comp !== this.comp) throw new Error('父层必须在同一个合成里');
    if (p) { for (let q = p; q; q = q._parent) if (q === this) throw new Error('父子关系成环: ' + this.name);
      const T = p._root._kids.find(k => k.matchName === 'ADBE Transform Group'), keyed = T ? T._kids.filter(k => k._keys && k._keys.length && /Position|Scale|Rotate Z|Anchor/.test(k.matchName)) : [];
      if (keyed.length) throw new Error(`父层「${p.name}」已有变换关键帧（${keyed.map(k => k.matchName).join('、')}）时挂子层「${this.name}」：子层会按当前时间的位置被带偏`); }
    this._parent = p; stats.parents = (stats.parents || 0) + 1; }
  setTrackMatte(m, type) { if (!(m instanceof Layer) || m.comp !== this.comp) throw new Error('轨道遮罩必须是同一个合成里的图层'); if (type === undefined) throw new Error('缺遮罩类型'); this._matte = m; stats.mattes = (stats.mattes || 0) + 1; }
  get Masks() { return this.property('ADBE Mask Parade'); }
  sourceRectAtTime(t, ext) {
    if (this.kind === 'footage') return { left: 0, top: 0, width: this.source.width, height: this.source.height };
    if (this.kind === 'precomp') return { left: 0, top: 0, width: this.source.width, height: this.source.height };
    if (this.kind === 'null') return { left: 0, top: 0, width: 100, height: 100 };
    if (this.kind === 'shape') { const g = this._root._kids.find(k => k.matchName === 'ADBE Root Vectors Group'), vg = g && g._kids[0], vs = vg && vg._kids.find(k => k.matchName === 'ADBE Vectors Group'), r = vs && vs._kids.find(k => k.matchName === 'ADBE Vector Shape - Rect');
      const sz = r ? r._kids.find(k => k.matchName === 'ADBE Vector Rect Size')._v : [100, 100]; return { left: -sz[0] / 2, top: -sz[1] / 2, width: sz[0], height: sz[1] }; }
    if (this.kind !== 'text') throw new Error('sourceRectAtTime 不支持的图层'); const td = this.property('ADBE Text Properties').property('ADBE Text Document').value; const lines = String(td.text).split('\r'); const w = Math.max(...lines.map(l => l.length)) * td.fontSize * 0.95; return { left: 0, top: -td.fontSize * 0.88, width: w, height: td.fontSize * lines.length }; }
  moveToEnd() { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.push(this); }
  moveToBeginning() { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.unshift(this); }
  moveAfter(o) { const L = this.comp.layers._l; L.splice(L.indexOf(this), 1); L.splice(L.indexOf(o) + 1, 0, this); }
}
class LayerCollection {
  constructor(c) { this.comp = c; this._l = []; }
  _push(l) { this._l.unshift(l); return l; }
  addShape() { return this._push(new Layer(this.comp, 'shape')); }
  addNull() { const l = this._push(new Layer(this.comp, 'shape')); l.kind = 'null'; l.name = '空 1'; return l; }
  addCamera(name, center) { if (typeof name !== 'string' || !Array.isArray(center) || center.length !== 2) throw new Error('addCamera(name, [x, y]) 参数错误'); const l = this._push(new Layer(this.comp, 'camera')); l.name = name; l.property('ADBE Transform Group').property('ADBE Anchor Point')._v = [center[0], center[1], 0]; stats.cameras = (stats.cameras || 0) + 1; return l; }
  addText(t) { if (typeof t !== 'string') throw new Error('addText 需要字符串'); return this._push(new Layer(this.comp, 'text', t)); }
  add(item) { if (!item || !(item instanceof FootageItem || item instanceof CompItem)) throw new Error('layers.add 需要素材或合成'); const l = this._push(new Layer(this.comp, item instanceof CompItem ? 'precomp' : 'footage', item)); l.name = item.name; return l; }   // AE：新图层默认用素材 / 合成的名字
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
    this.duration = 0;
    if (/\.png$/i.test(f)) [this.width, this.height] = pngSize(f); else if (/\.jpe?g$/i.test(f)) [this.width, this.height] = jpgSize(f); else if (/\.(mp4|mov)$/i.test(f)) { try { const o = require('child_process').execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'csv=p=0', f]).toString().trim().split(','); [this.width, this.height, this.duration] = o.map(Number); } catch (e) { [this.width, this.height, this.duration] = [1920, 1080, 10]; } }
    else if (/\.wav$/i.test(f)) { [this.width, this.height] = [0, 0]; } else [this.width, this.height] = [0, 0];
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
  KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 }, TrackMatteType: { ALPHA: 5013, ALPHA_INVERTED: 5014, LUMA: 5015, LUMA_INVERTED: 5016, NO_TRACK_MATTE: 5012 }, BlendingMode: { NORMAL: 5212, LIGHTEN: 5220, MULTIPLY: 5216, SCREEN: 5222 }, Math, parseInt, Error,
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
      time: t, value: prop._v instanceof TextDocument ? prop._v.text : prop._keys.length ? prop.valueAtTime(t) : prop._v, Math,
      effect: n => { const fx = layer._root._kids.find(k => k.matchName === 'ADBE Effect Parade'), e = fx && fx._kids.find(k => k.name === n); if (!e) throw new Error('表达式引用了不存在的效果: ' + n); return m => { const q = e._kids.find(k => k.matchName === m || k.name === m); if (!q) throw new Error('效果里没有属性 ' + m); return q.valueAtTime(t); }; },
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

// ---------- 5. 结构检查 ----------
if (MISSING.length) notes.push('按名称查找未命中（已由备用路径处理）: ' + [...new Set(MISSING)].join('; '));
const spec = sandbox.SPEC || vm.runInNewContext(src.slice(0, src.indexOf('\n', src.indexOf('var SPEC = '))) + ';SPEC');
const BAR = 76;
const main = comps.find(c => c.name === spec.mainName);
if (!main) fail('缺少主合成'); else {
  if (Math.abs(main.duration - spec.dur) > 1e-6) fail('主合成时长不等于本期时长 ' + spec.dur + 's');
  if (main.width !== 1920 || main.height !== 1080) fail('主合成尺寸错误');
}
let keyTotal = 0, layerTotal = 0, textTotal = 0;
const rootPos = (L, t) => { const T = L.property('ADBE Transform Group'); if (L._sep) return [T.property('ADBE Position_0').valueAtTime(t), T.property('ADBE Position_1').valueAtTime(t)]; return T.property('ADBE Position').valueAtTime(t); };
for (const sh of spec.shots) {
  const c = comps.find(x => x.name === sh.name); if (!c) { fail('缺少镜头合成 ' + sh.name); continue; }
  if (Math.abs(c.duration - sh.dur) > 1e-6) fail('镜头时长不符 ' + sh.name);
  const ml = main && main.layers._l.find(l => l.source === c); if (!ml) fail('镜头没放进主合成 ' + sh.name); else if (Math.abs(ml.startTime - sh.start) > 1e-6) fail('镜头在主合成里的起点不对 ' + sh.name);
  const bottom = c.layers._l[c.layers._l.length - 1];
  if (!bottom || !/^背景板_/.test(bottom.name)) fail(`${sh.name}：最底层应是「背景板_」图层，实际是 ${bottom && bottom.name}`);
  // 这个镜头用到的所有合成（镜头本身 + 部件预合成 + 录屏预合成）
  const tree = [c]; for (let k = 0; k < tree.length; k++) tree[k].layers._l.forEach(l => { if (l.kind === 'precomp' && tree.indexOf(l.source) < 0) tree.push(l.source); });
  for (const cc of tree) {
    layerTotal += cc.layers.length;
    for (const L of cc.layers._l) {
      const walk = g => g._kids.forEach(k => { if (k instanceof Group) walk(k); else { keyTotal += k._keys.length; k._keys.forEach(kk => { if (kk.t < -0.001 || kk.t > cc.duration + 0.001) fail(`关键帧超出合成时长 ${cc.name}/${L.name}/${k.matchName} t=${kk.t}`); }); } });
      walk(L._root);
      if (L.kind === 'precomp') { if (L.startTime > 1e-6 || L.startTime + L.source.duration < cc.duration - 1e-6) fail(`预合成没有覆盖整个镜头 ${cc.name}/${L.name}`); }
      if (L.kind === 'footage' && /\.(mp4|mov)$/i.test(L.source.file) && L.source.width >= 1920 && cc.width === 1920 && !/^背景动态_/.test(L.name)) fail(`${cc.name}/${L.name}：镜头合成里出现整帧视频层（背景和窗口必须分层）`);
      // 章节进度条区：1920 画面里，没有父层的文字层，静止时字顶不能进顶部 76px
      if (L.kind === 'text') { textTotal++;
        if (cc.width === 1920 && cc.height === 1080 && !L.parent) { const td = L.property('ADBE Text Properties').property('ADBE Text Document').value, p = rootPos(L, cc.duration - 0.01);
          if (p[1] - td.fontSize * 0.95 < BAR - 1) fail(`文字压到章节进度条区：${cc.name}/${L.name}（基线 y=${p[1].toFixed(1)}，字号 ${td.fontSize}）`); } }
    }
  }
}
const textLayers = comps.flatMap(c => c.layers._l.filter(l => l.kind === 'text'));
textLayers.forEach(l => { const td = l.property('ADBE Text Properties').property('ADBE Text Document').value; if (!td.font) fail('文字层未设字体 ' + l.name);
  if (/\\[rnt]/.test(String(td.text))) fail('文字层含字面转义符（会在 AE 里原样显示成 \\r / \\n）: ' + l.name + ' → ' + String(td.text).slice(0, 40)); });
// 同一个合成里图层不重名（表达式按名字找主层）
comps.forEach(c => { const seen = new Set(); c.layers._l.forEach(l => { if (seen.has(l.name)) fail(`同一个合成里图层重名：${c.name}/${l.name}`); seen.add(l.name); }); });

// 模拟器自检：添加属性后旧引用会报错；父层有关键帧时挂子层会报错
(() => { const c = new CompItem('t', 100, 100, 1, 1, 60); const L = c.layers.addShape(); const root = L.property('ADBE Root Vectors Group'); root.addProperty('ADBE Vector Group'); let threw = false; try { root.numProperties; } catch (e) { threw = true; } if (!threw) fail('模拟器自检失败：失效引用未报错'); else notes.push('模拟器自检：添加属性后旧引用会报错（与 AE 一致）'); })();
(() => { const c = new CompItem('t', 100, 100, 1, 1, 60); const P = c.layers.addShape(), K = c.layers.addShape(); P.property('ADBE Transform Group').property('ADBE Scale').setValueAtTime(0, [50, 50]); let threw = false; try { K.parent = P; } catch (e) { threw = true; } if (!threw) fail('模拟器自检失败：父层有关键帧时挂子层未报错'); })();

console.log('==== ' + spec.title + ' · AE 重建脚本 · 模拟测试报告 ====');
console.log(PROBE.loaded ? `· 对象模型：你的 AE 实测属性树（AE ${PROBE.version}，中文界面）；修剪路径、滑块控制按官方文档补` : '· 对象模型：手写（未加载探测报告）');
const shippedF = path.join(path.dirname(file), 'fonts', 'fonts.txt'); const shipped = fs.existsSync(shippedF) ? fs.readFileSync(shippedF, 'utf8').split(/\s+/).filter(Boolean) : [];
const notShipped = [...FONTS_USED].filter(f => f && shipped.indexOf(f) < 0 && !(PROBE.fonts[f]));
if (notShipped.length) fail('脚本用了包里没附带、你电脑上也没装的字体: ' + notShipped.join(', '));
else notes.push(`脚本用到的字体 ${FONTS_USED.size} 个（${[...FONTS_USED].join('、')}），全部随包附带在 fonts/`);
notes.forEach(n => console.log('· ' + n));
console.log(`· 合成 ${comps.length} 个（1 主合成 + ${spec.shots.length} 镜头 + 部件 / 录屏预合成），镜头内图层 ${layerTotal}（文字层 ${textTotal}），父子关系 ${stats.parents || 0} 处，轨道遮罩 ${stats.mattes || 0} 处，时间重映射 ${stats.timeRemap || 0} 处`);
console.log(`· 关键帧 ${stats.keys} 个（镜头内 ${keyTotal}），表达式 ${stats.exprs} 条（逐条在 5 个时间点求值通过 ${exprOK - (errors.filter(e => e.startsWith('表达式')).length)} 条）`);
console.log(`· 逐段字体：${RUNS.length} 段（如「${RUNS.slice(0, 3).map(r => r.text).join('」「')}」）${runErr ? '，越界 ' + runErr + ' 处' : ''}`);
if (runErr) fail('characterRange 索引越界 ' + runErr + ' 处');
console.log(`· 素材导入 ${project.items._all.filter(x => x instanceof FootageItem).length} 个`);
if (errors.length) { console.log(`\n✗ 失败 ${errors.length} 项:`); errors.slice(0, 40).forEach(e => console.log('  - ' + e)); process.exit(1); }
console.log('\n✓ 全部通过（模拟环境；没有在真 AE 里运行过）');
