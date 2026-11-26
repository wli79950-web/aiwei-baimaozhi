
/* ===== runtime (ES3 only: var / function / for-loops; every property re-fetched before use) ===== */
(function () {
    var FPS = 60, W = 1920, H = 1080;
    var scriptFile = new File($.fileName);
    var ROOT = scriptFile.parent.fsName + "/assets/";
    var CACHE = {};

    function hex(c) {
        c = c.replace("#", "");
        return [parseInt(c.substr(0, 2), 16) / 255, parseInt(c.substr(2, 2), 16) / 255, parseInt(c.substr(4, 2), 16) / 255];
    }
    function importFile(rel, seq) {
        var key = rel + (seq ? "#seq" : "");
        if (CACHE[key]) { return CACHE[key]; }
        var f = new File(ROOT + rel);
        if (!f.exists) { throw new Error("缺少素材: " + ROOT + rel); }
        var io = new ImportOptions(f);
        if (seq) { io.sequence = true; io.forceAlphabetical = true; }
        var item = app.project.importFile(io);
        if (seq) { item.mainSource.conformFrameRate = 30; }
        item.parentFolder = FOLDER;
        CACHE[key] = item;
        return item;
    }
    /* --- property accessors: always walk from the layer, never keep references --- */
    function tr(layer, name) { return layer.property("ADBE Transform Group").property(name); }
    function contents(layer) { return layer.property("ADBE Root Vectors Group"); }
    function grpVecs(layer, gi) { return contents(layer).property(gi).property("ADBE Vectors Group"); }
    function effects(layer) { return layer.property("ADBE Effect Parade"); }
    /* try several names (matchName first, then display names), then a 1-based index; never return null silently */
    function pick(group, names, idx) {
        var i, r = null;
        for (i = 0; i < names.length && !r; i++) { try { r = group.property(names[i]); } catch (e0) { r = null; } }
        if (!r && idx) { try { r = group.property(idx); } catch (e1) { r = null; } }
        if (!r) { throw new Error("找不到属性: " + names.join(" / ")); }
        return r;
    }
    var STEP = "";

    function easeAll(getProp) {
        var p = getProp(), n = p.numKeys, i, k, dims, eIn, eOut;
        for (i = 1; i <= n; i++) {
            p = getProp();
            dims = 1;
            if (p.propertyValueType === PropertyValueType.TwoD) { dims = 2; }
            if (p.propertyValueType === PropertyValueType.ThreeD) { dims = 3; }
            eIn = []; eOut = [];
            for (k = 0; k < dims; k++) { eIn.push(new KeyframeEase(0, 70)); eOut.push(new KeyframeEase(0, 70)); }
            p.setTemporalEaseAtKey(i, eIn, eOut);
        }
    }
    function keys(getProp, list, mapFn) {
        var i, v;
        for (i = 0; i < list.length; i++) {
            v = mapFn ? mapFn(list[i][1]) : list[i][1];
            getProp().setValueAtTime(list[i][0], v);
        }
        easeAll(getProp);
    }
    function applyKF(layer, o, base) {
        var kf = o.kf || {}, ex = o.expr || {};
        if (kf.o) { keys(function () { return tr(layer, "ADBE Opacity"); }, kf.o); }
        if (kf.dp) { keys(function () { return tr(layer, "ADBE Position"); }, kf.dp, function (d) { return [base[0] + d[0], base[1] + d[1]]; }); }
        if (kf.s) { keys(function () { return tr(layer, "ADBE Scale"); }, kf.s, function (s) { return [s, s]; }); }
        if (kf.sx) { keys(function () { return tr(layer, "ADBE Scale"); }, kf.sx, function (s) { return [s, 100]; }); }
        if (kf.w) { var wmax = o.wmax || o.w; keys(function () { return tr(layer, "ADBE Scale"); }, kf.w, function (w) { return [w / wmax * 100, 100]; }); }
        if (kf.h) { var hmax = o.hmax || o.h; keys(function () { return tr(layer, "ADBE Scale"); }, kf.h, function (h) { return [100, h / hmax * 100]; }); }
        if (ex.r) { tr(layer, "ADBE Rotate Z").expression = ex.r; }
        if (ex.p) { tr(layer, "ADBE Position").expression = ex.p; }
        if (ex.text) { layer.property("ADBE Text Properties").property("ADBE Text Document").expression = ex.text; }
    }

    function shapeBox(comp, o, kind) {
        var L = comp.layers.addShape(), gi, vecs, q;
        if (o.kf && o.kf.w) {
            o.wmax = 1;
            for (q = 0; q < o.kf.w.length; q++) { if (o.kf.w[q][1] > o.wmax) { o.wmax = o.kf.w[q][1]; } }
            o.w = o.wmax;
        }
        if (o.kf && o.kf.h) {
            o.hmax = 1;
            for (q = 0; q < o.kf.h.length; q++) { if (o.kf.h[q][1] > o.hmax) { o.hmax = o.kf.h[q][1]; } }
            o.h = o.hmax;
        }
        L.name = o.name;
        contents(L).addProperty("ADBE Vector Group");
        gi = contents(L).numProperties;
        contents(L).property(gi).name = o.name;
        grpVecs(L, gi).addProperty(kind === "ell" ? "ADBE Vector Shape - Ellipse" : "ADBE Vector Shape - Rect");
        if (o.fill) { grpVecs(L, gi).addProperty("ADBE Vector Graphic - Fill"); }
        if (o.stroke) { grpVecs(L, gi).addProperty("ADBE Vector Graphic - Stroke"); }
        if (kind === "ell") {
            grpVecs(L, gi).property("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([o.w, o.h]);
        } else {
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([o.w, o.h]);
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Roundness").setValue(o.r || 0);
        }
        if (o.fill) { grpVecs(L, gi).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(o.fill)); }
        if (o.stroke) {
            grpVecs(L, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue(hex(o.stroke));
            grpVecs(L, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(o.sw || 1);
        }
        var base;
        if (kind === "ell") {
            base = [o.x, o.y];
            tr(L, "ADBE Anchor Point").setValue([0, 0]);
        } else if (o.kf && o.kf.w) {
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Position").setValue([o.w / 2, o.h / 2]);
            tr(L, "ADBE Anchor Point").setValue([0, o.h / 2]);
            base = [o.x, o.y + o.h / 2];
        } else if (o.kf && o.kf.h) {
            /* grow downward from the top edge */
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Position").setValue([o.w / 2, o.h / 2]);
            tr(L, "ADBE Anchor Point").setValue([o.w / 2, 0]);
            base = [o.x + o.w / 2, o.y];
        } else {
            tr(L, "ADBE Anchor Point").setValue([0, 0]);
            base = [o.x + o.w / 2, o.y + o.h / 2];
        }
        tr(L, "ADBE Position").setValue(base);
        tr(L, "ADBE Opacity").setValue(o.op === undefined ? 100 : o.op);
        if (o.rot) { tr(L, "ADBE Rotate Z").setValue(o.rot); }
        applyKF(L, o, base);
        return L;
    }

    function textLayer(comp, o) {
        var L = comp.layers.addText(o.text);
        L.name = o.name;
        var td = L.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle();
        td.font = o.font;
        td.fontSize = o.size;
        td.applyFill = true;
        td.fillColor = hex(o.color);
        td.tracking = o.track || 0;
        if (o.lead) { try { td.autoLeading = false; td.leading = o.lead; } catch (eLead) { } }
        td.justification = ParagraphJustification.LEFT_JUSTIFY;
        /* per-character font fallback (AE 24.3+ CharacterRange): CJK inside mono / numeral fonts → Noto Sans SC */
        if (o.runs) {
            var ri;
            for (ri = 0; ri < o.runs.length; ri++) {
                try { td.characterRange(o.runs[ri][0], o.runs[ri][1]).font = o.runs[ri][2]; } catch (eRun) { }
            }
        }
        L.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        var base = [o.x, o.y];
        if (o.kf && o.kf.s) {
            var rc = L.sourceRectAtTime(0, false);
            var an = [rc.left + rc.width / 2, rc.top + rc.height / 2];
            tr(L, "ADBE Anchor Point").setValue(an);
            base = [o.x + an[0], o.y + an[1]];
        }
        tr(L, "ADBE Position").setValue(base);
        if (o.rot) { tr(L, "ADBE Rotate Z").setValue(o.rot); }
        applyKF(L, o, base);
        return L;
    }

    function imageLayer(comp, o, item) {
        var L = comp.layers.add(item);
        L.name = o.name;
        var s = o.w / item.width * 100, h = item.height * s / 100;
        var base = [o.x + o.w / 2, o.y + h / 2];
        tr(L, "ADBE Scale").setValue([s, s]);
        tr(L, "ADBE Position").setValue(base);
        if (o.rot) { tr(L, "ADBE Rotate Z").setValue(o.rot); }
        // 混合模式：黑白雕塑（纯黑底）用「变亮」融进深色背景
        if (o.blend === "lighten") { L.blendingMode = BlendingMode.LIGHTEN; }
        if (o.kf && o.kf.s) {
            var ks = o.kf.s, i, k2 = [];
            for (i = 0; i < ks.length; i++) { k2.push([ks[i][0], ks[i][1] * s / 100]); }
            o.kf.s = k2;
        }
        applyKF(L, o, base);
        return L;
    }

    /* HTML 文字块 → AE 原生文字层（可改字、换字体）。t: {text, align, x, y, rot, pivot, op, lead, runs:[{s,e,font,color,size,track}]} */
    function htmlText(comp, t, nm) {
        var L = comp.layers.addText(t.text), r0 = t.runs[0], ri, td, cr;
        L.name = nm;
        td = L.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle(); td.font = r0.font; td.fontSize = r0.size; td.applyFill = true; td.fillColor = hex(r0.color); td.tracking = r0.track || 0;
        try { td.autoLeading = false; td.leading = t.lead; } catch (eLd) { }
        td.justification = t.align === "center" ? ParagraphJustification.CENTER_JUSTIFY : (t.align === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
        L.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        if (t.runs.length > 1) {
            td = L.property("ADBE Text Properties").property("ADBE Text Document").value;
            for (ri = 0; ri < t.runs.length; ri++) {
                try {
                    cr = td.characterRange(t.runs[ri].s, t.runs[ri].e);
                    cr.font = t.runs[ri].font; cr.fontSize = t.runs[ri].size; cr.fillColor = hex(t.runs[ri].color); cr.tracking = t.runs[ri].track || 0;
                } catch (eRun) { }
            }
            L.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        }
        var px = t.x, py = t.y;
        if (t.rot && t.pivot) {
            var a = t.rot * Math.PI / 180, dx = t.x - t.pivot[0], dy = t.y - t.pivot[1];
            px = t.pivot[0] + dx * Math.cos(a) - dy * Math.sin(a); py = t.pivot[1] + dx * Math.sin(a) + dy * Math.cos(a);
            tr(L, "ADBE Rotate Z").setValue(t.rot);
        }
        tr(L, "ADBE Position").setValue([px, py]);
        tr(L, "ADBE Opacity").setValue(Math.round((t.op === undefined ? 1 : t.op) * 100));
        return L;
    }
    /* 底板图片 + 文字层：先建静止底板，文字层挂上父层，最后再给底板加关键帧（父层在 0 秒有位移时不会把文字带偏）；透明度动画复制给文字层 */
    function groupLayer(comp, o) {
        var item = importFile(o.file, false), P = comp.layers.add(item), k, kids = [], ti, sc, base, ks, i2, k2;
        P.name = o.name;
        sc = o.w / item.width * 100; base = [o.x + o.w / 2, o.y + item.height * sc / 100 / 2];
        tr(P, "ADBE Scale").setValue([sc, sc]); tr(P, "ADBE Position").setValue(base);
        for (ti = 0; ti < o.texts.length; ti++) { kids.push(htmlText(comp, o.texts[ti], o.name + "_字" + (ti + 1) + "：" + o.texts[ti].text.replace(/\r/g, " ").substr(0, 12))); }
        for (ti = 0; ti < kids.length; ti++) { kids[ti].parent = P; }
        if (o.kf && o.kf.s) { ks = o.kf.s; k2 = []; for (i2 = 0; i2 < ks.length; i2++) { k2.push([ks[i2][0], ks[i2][1] * sc / 100]); } o.kf.s = k2; }
        applyKF(P, o, base);
        if (o.kf && o.kf.o) {
            for (ti = 0; ti < kids.length; ti++) {
                (function (K, op) { keys(function () { return tr(K, "ADBE Opacity"); }, o.kf.o, function (v) { return v * op; }); })(kids[ti], (o.texts[ti].op === undefined ? 1 : o.texts[ti].op));
            }
        }
        return P;
    }

    /* 线性关键帧（采样得到的密集数据用，不加缓动） */
    function linKeys(getProp, list, mapFn) {
        var i, n;
        if (!list || !list.length) { return; }
        for (i = 0; i < list.length; i++) { getProp().setValueAtTime(list[i][0], mapFn ? mapFn(list[i][1]) : list[i][1]); }
        n = getProp().numKeys;
        for (i = 1; i <= n; i++) { getProp().setInterpolationTypeAtKey(i, KeyframeInterpolationType.LINEAR); }
    }
    /* 录屏窗口预合成：原始录屏 + 时间重映射（换页时机）+ 缩放位置关键帧（推镜）+ 形状层（红框 / 荧光笔 / 脱敏条）。同一段录屏的子镜头共用 */
    var WINCACHE = {};
    function windowComp(w) {
        if (WINCACHE[w.name]) { return WINCACHE[w.name]; }
        var c = app.project.items.addComp(w.name, w.vw || 1120, w.vh || 630, 1, w.dur, FPS), F, k, ov, L;
        c.parentFolder = FOLDER_COMPS;
        F = c.layers.add(importFile(w.file, false));
        F.name = "录屏素材_" + w.file;
        if (!w.still) {
            F.timeRemapEnabled = true;
            if (F.property("ADBE Time Remapping").numKeys >= 2) { F.property("ADBE Time Remapping").removeKey(F.property("ADBE Time Remapping").numKeys); }
            linKeys(function () { return pick(F, ["ADBE Time Remapping", "Time Remap"]); }, w.remap);
            F.outPoint = w.dur;
        }
        if (w.anchor) { tr(F, "ADBE Anchor Point").setValue(w.anchor); }
        linKeys(function () { return tr(F, "ADBE Scale"); }, w.sc, function (v) { return [v, v]; });
        linKeys(function () { return tr(F, "ADBE Position"); }, w.pos);
        for (k = 0; k < w.ov.length; k++) {
            ov = w.ov[k];
            L = c.layers.addShape(); L.name = ov.name;
            contents(L).addProperty("ADBE Vector Group");
            grpVecs(L, 1).addProperty("ADBE Vector Shape - Rect");
            if (ov.fill) { grpVecs(L, 1).addProperty("ADBE Vector Graphic - Fill"); }
            if (ov.stroke) { grpVecs(L, 1).addProperty("ADBE Vector Graphic - Stroke"); }
            grpVecs(L, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Roundness").setValue(ov.r || 0);
            if (ov.fill) {
                grpVecs(L, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(ov.fill));
                grpVecs(L, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Opacity").setValue(ov.fillOp);
            }
            if (ov.stroke) {
                grpVecs(L, 1).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue(hex(ov.stroke));
                grpVecs(L, 1).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(ov.sw);
            }
            tr(L, "ADBE Anchor Point").setValue([0, 0]);
            linKeys(function () { return grpVecs(L, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size"); }, ov.size);
            linKeys(function () { return tr(L, "ADBE Position"); }, ov.pos);
            linKeys(function () { return tr(L, "ADBE Opacity"); }, ov.o);
        }
        WINCACHE[w.name] = c;
        return c;
    }

    /* ===== 2.5D（真 3D）：录屏窗口预合成作为 3D 图层 + 摄像机 =====
       所有平面互相平行（不转图层），倾斜 / 推拉 / 摆动全部来自摄像机的「位置」关键帧；目标点固定在窗口平面上。
       坐标：x 右、y 下、z 远离镜头；摄像机缩放 = 网页预览的透视距离（2600）。 */
    var WARN = [];
    function pre3dLayer(comp, o) {
        var png = importFile(o.chrome.file, false), sc = o.chrome.w / png.width, cw = Math.round(o.chrome.w), chh = Math.round(png.height * sc);
        var c = app.project.items.addComp(o.name, cw, chh, 1, comp.duration, FPS), B, V, L, base;
        c.parentFolder = FOLDER_COMPS;
        B = c.layers.add(png); B.name = "窗口边框_" + o.chrome.file;
        tr(B, "ADBE Scale").setValue([sc * 100, sc * 100]); tr(B, "ADBE Position").setValue([cw / 2, chh / 2]);
        if (o.view) {
            V = c.layers.add(windowComp(o.view)); V.name = "录屏视口_" + o.view.name;
            tr(V, "ADBE Position").setValue([o.view.x + o.view.vw / 2, o.view.y + o.view.vh / 2]);
        }
        L = comp.layers.add(c); L.name = o.name;
        L.threeDLayer = true;
        base = [o.chrome.x + cw / 2, o.chrome.y + chh / 2, 0];
        tr(L, "ADBE Position").setValue(base);
        if (o.p3) { keys(function () { return tr(L, "ADBE Position"); }, o.p3, function (d) { return [base[0] + d[0], base[1] + d[1], d[2]]; }); }
        if (o.kf && o.kf.o) { keys(function () { return tr(L, "ADBE Opacity"); }, o.kf.o); }
        if (o.kf && o.kf.s) { keys(function () { return tr(L, "ADBE Scale"); }, o.kf.s, function (v) { return [v, v, 100]; }); }
        return L;
    }
    function cameraLayer(comp, o) {
        var C = null;
        try {
            C = comp.layers.addCamera(o.name, [o.poi[0], o.poi[1]]);
            C.name = o.name;
        } catch (eCam) { WARN.push(comp.name + "：摄像机没建成（" + eCam.toString() + "），3D 图层已建好，可手动新建摄像机"); return null; }
        try { pick(pick(C, ["ADBE Camera Options Group", "Camera Options", "摄像机选项"], 0), ["ADBE Camera Zoom", "Zoom", "缩放"], 1).setValue(o.zoom); }
        catch (eZoom) { WARN.push(comp.name + "：摄像机「缩放」没设上，请手动设为 " + o.zoom + " 像素"); }
        try { pick(C.property("ADBE Transform Group"), ["ADBE Anchor Point", "Point of Interest", "目标点"], 0).setValue([o.poi[0], o.poi[1], 0]); }
        catch (ePoi) { WARN.push(comp.name + "：摄像机「目标点」没设上，请手动设为 " + o.poi[0] + ", " + o.poi[1] + ", 0"); }
        try {
            keys(function () { return C.property("ADBE Transform Group").property("ADBE Position"); }, o.pos);
            if (o.wob) {
                C.property("ADBE Transform Group").property("ADBE Position").expression =
                    "value + [Math.sin((time+" + o.t0 + ")*0.9)*" + o.wob[0] + ", Math.cos((time+" + o.t0 + ")*0.7)*" + o.wob[1] + ", 0];";
            }
        } catch (ePos) { WARN.push(comp.name + "：摄像机「位置」关键帧没写完（" + ePos.toString() + "）"); }
        return C;
    }

    function background(comp, dark) {
        var L = comp.layers.addShape(), gi;
        L.name = dark ? "背景_岩层" : "背景_纸";
        contents(L).addProperty("ADBE Vector Group");
        gi = contents(L).numProperties;
        grpVecs(L, gi).addProperty("ADBE Vector Shape - Rect");
        grpVecs(L, gi).addProperty("ADBE Vector Graphic - Fill");
        grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([W, H]);
        grpVecs(L, gi).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(dark ? "#0E0F11" : "#EDEAE4"));
        tr(L, "ADBE Anchor Point").setValue([0, 0]);
        tr(L, "ADBE Position").setValue([W / 2, H / 2]);
        effects(L).addProperty("ADBE Ramp");
        pick(effects(L).property(1), ["ADBE Ramp-0001", "Start of Ramp"], 1).setValue([W / 2, 0]);
        pick(effects(L).property(1), ["ADBE Ramp-0002", "Start Color"], 2).setValue(hex(dark ? "#121316" : "#EFECE6"));
        pick(effects(L).property(1), ["ADBE Ramp-0003", "End of Ramp"], 3).setValue([W / 2, H]);
        pick(effects(L).property(1), ["ADBE Ramp-0004", "End Color"], 4).setValue(hex(dark ? "#0B0C0E" : "#E8E4DD"));
        L.moveToEnd();
        return L;
    }

    function grid(comp, dark) {
        var L = comp.layers.addShape(), gi, d, rep;
        L.name = "网格";
        for (d = 0; d < 2; d++) {
            contents(L).addProperty("ADBE Vector Group");
            gi = contents(L).numProperties;
            contents(L).property(gi).name = d === 0 ? "竖线" : "横线";
            grpVecs(L, gi).addProperty("ADBE Vector Shape - Rect");
            grpVecs(L, gi).addProperty("ADBE Vector Graphic - Fill");
            grpVecs(L, gi).addProperty("ADBE Vector Filter - Repeater");
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue(d === 0 ? [1, H] : [W, 1]);
            grpVecs(L, gi).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Position").setValue(d === 0 ? [0, H / 2] : [W / 2, 12]);
            grpVecs(L, gi).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(dark ? "#EDEAE4" : "#141414"));
            grpVecs(L, gi).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Opacity").setValue(dark ? 7 : 6);
            grpVecs(L, gi).property("ADBE Vector Filter - Repeater").property("ADBE Vector Repeater Copies").setValue(d === 0 ? 41 : 23);
            pick(grpVecs(L, gi).property("ADBE Vector Filter - Repeater").property("ADBE Vector Repeater Transform"), ["ADBE Vector Repeater Position", "Position"], 2).setValue(d === 0 ? [48, 0] : [0, 48]);
        }
        tr(L, "ADBE Anchor Point").setValue([0, 0]);
        tr(L, "ADBE Position").setValue([0, 0]);
        return L;
    }

    function contour(comp, o) {
        var L = comp.layers.addShape(), i, k, gi, r, verts, t, p, m, sh;
        L.name = "等高线";
        for (i = 0; i < o.n; i++) {
            r = o.r0 * 0.18 + i * (o.r0 * 0.085 + 14);
            verts = [];
            for (k = 0; k < 72; k++) {
                t = k / 72 * Math.PI * 2; p = i * 0.17;
                m = 1 + 0.1 * Math.sin(3 * t + p) + 0.06 * Math.sin(5 * t - 1.3 * p + 1) + 0.035 * Math.sin(9 * t + p * 2.1);
                verts.push([o.cx + Math.cos(t) * r * m * 1.35, o.cy + Math.sin(t) * r * m]);
            }
            contents(L).addProperty("ADBE Vector Group");
            gi = contents(L).numProperties;
            grpVecs(L, gi).addProperty("ADBE Vector Shape - Group");
            grpVecs(L, gi).addProperty("ADBE Vector Graphic - Stroke");
            sh = new Shape(); sh.vertices = verts; sh.closed = true;
            grpVecs(L, gi).property("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            grpVecs(L, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue(hex(o.dark ? "#EDEAE4" : "#141414"));
            grpVecs(L, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(i % 5 ? 1 : 1.6);
            grpVecs(L, gi).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Opacity").setValue(o.dark ? (i % 5 ? 5 : 10) : (i % 5 ? 7 : 14));
        }
        tr(L, "ADBE Anchor Point").setValue([0, 0]);
        tr(L, "ADBE Position").setValue([0, 0]);
        return L;
    }

    function buildShot(sh) {
        var comp = app.project.items.addComp(sh.name, W, H, 1, sh.dur, FPS), i, o, L, item;
        comp.parentFolder = FOLDER_COMPS;
        for (i = 0; i < sh.layers.length; i++) {
            o = sh.layers[i];
            STEP = sh.name + " / " + (o.name || o.k);
            if (o.k === "bg") { background(comp, o.dark); }
            else if (o.k === "grid") { grid(comp, o.dark); }
            else if (o.k === "contour") { contour(comp, o); }
            else if (o.k === "rect") { shapeBox(comp, o, "rect"); }
            else if (o.k === "ell") { shapeBox(comp, o, "ell"); }
            else if (o.k === "txt") { textLayer(comp, o); }
            else if (o.k === "img") { imageLayer(comp, o, importFile(o.file, false)); }
            else if (o.k === "grp") { groupLayer(comp, o); }
            else if (o.k === "pre3d") { pre3dLayer(comp, o); }
            else if (o.k === "cam") { cameraLayer(comp, o); }
            else if (o.k === "win") {
                L = comp.layers.add(windowComp(o.w)); L.name = o.name; L.startTime = o.start;
                tr(L, "ADBE Position").setValue([1100, 565]);
                applyKF(L, o, [1100, 565]);
            }
            else if (o.k === "seq") {
                item = importFile(o.folder + "/" + o.folder + "_0001.png", true);
                L = imageLayer(comp, o, item);
                L.startTime = o.start;
            } else if (o.k === "vid") {
                /* 录屏：已按 HTML 时间轴烘焙好换帧与推镜的窗口视频（无音轨），startTime 让多个子镜头接着同一条视频播 */
                L = imageLayer(comp, o, importFile(o.file, false));
                L.startTime = o.start;
            } else if (o.k === "aroll") {
                L = comp.layers.add(importFile(o.file || "aroll.mp4", false));
                L.name = o.name; L.startTime = o.start; L.audioEnabled = false;
                keys(function () { return tr(L, "ADBE Scale"); }, o.kf.s, function (s) { return [s, s]; });
                L.moveToEnd();
            }
        }
        return comp;
    }

    function circleShape(cx, cy, r) {
        var s = new Shape(), k = 0.5523 * r;
        s.vertices = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
        s.inTangents = [[-k, 0], [0, -k], [k, 0], [0, k]];
        s.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
        s.closed = true;
        return s;
    }

    /* font preflight (AE 24.0+ has app.fonts.getFontsByPostScriptName) */
    var NEED_FONTS = ["NotoSansSC-Black", "NotoSansSC-Bold", "NotoSansSC-Medium", "NotoSansSC-Regular", "NotoSerifSC-Black", "NotoSerifSC-Bold", "JetBrainsMono-Bold", "JetBrainsMono-Medium", "JetBrainsMono-Regular", "SpaceGrotesk-Bold", "SpaceGrotesk-Medium"];
    /* 2.2：再把本期文字层 / HTML 文字块里实际用到的其他字体加进检查清单（没用到的新字体不提示） */
    function addNeedFont(f) { var q; if (!f) { return; } for (q = 0; q < NEED_FONTS.length; q++) { if (NEED_FONTS[q] === f) { return; } } NEED_FONTS.push(f); }
    (function () {
        var si, li, o, r, t;
        for (si = 0; si < SPEC.shots.length; si++) {
            for (li = 0; li < SPEC.shots[si].layers.length; li++) {
                o = SPEC.shots[si].layers[li];
                if (o.k === "txt") { addNeedFont(o.font); if (o.runs) { for (r = 0; r < o.runs.length; r++) { addNeedFont(o.runs[r][2]); } } }
                if (o.k === "grp" && o.texts) { for (t = 0; t < o.texts.length; t++) { for (r = 0; r < o.texts[t].runs.length; r++) { addNeedFont(o.texts[t].runs[r].font); } } }
            }
        }
    })();
    var missingFonts = [], fi;
    try {
        if (app.fonts && app.fonts.getFontsByPostScriptName) {
            for (fi = 0; fi < NEED_FONTS.length; fi++) {
                if (app.fonts.getFontsByPostScriptName(NEED_FONTS[fi]).length === 0) { missingFonts.push(NEED_FONTS[fi]); }
            }
        }
    } catch (eFont) { }
    if (missingFonts.length > 0) {
        if (!confirm("缺少以下字体，文字会被 AE 自动替换成其他字体：\n\n" + missingFonts.join("\n") +
                     "\n\n字体文件在本包的 fonts 文件夹里：选中 .ttf > 右键 > 为所有用户安装，然后重启 AE 再运行。" +
                     "\n（优设标题黑 YouSheBiaoTiHei 不随包附带，请到优设网官方下载安装。）" +
                     "\n\n点「是」仍然继续，点「否」先去装字体。")) { return; }
    }

    app.beginUndoGroup(SPEC.title + " 重建");
    try {
    var FOLDER = app.project.items.addFolder(SPEC.prefix + "_素材");
    var FOLDER_COMPS = app.project.items.addFolder(SPEC.prefix + "_镜头");
    var MAIN = app.project.items.addComp(SPEC.mainName, W, H, 1, SPEC.dur, FPS);
    var i, j, sh, comp, L;

    for (i = 0; i < SPEC.shots.length; i++) {
        sh = SPEC.shots[i];
        /* 撤销记录按镜头分段：整片几十个镜头放在一个撤销组里会占用大量内存 */
        if (i > 0) { app.endUndoGroup(); app.beginUndoGroup(SPEC.title + " 重建 · " + sh.name); }
        STEP = sh.name;
        comp = buildShot(sh);
        STEP = "主合成 / 放置镜头 " + sh.name;
        L = MAIN.layers.add(comp);
        L.startTime = sh.start;
        L.moveToBeginning();
        if (sh.tr === "iris") {
            L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
            L.property("ADBE Mask Parade").property(1).property("ADBE Mask Shape").setValue(circleShape(sh.org[0], sh.org[1], 4));
            L.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset").setValueAtTime(sh.start, 0);
            L.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset").setValueAtTime(sh.start + SPEC.tr, 2300);
            easeAll(function () { return L.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset"); });
        } else if (sh.tr === "push") {
            tr(L, "ADBE Position").setValueAtTime(sh.start, [W / 2, H / 2 + H]);
            tr(L, "ADBE Position").setValueAtTime(sh.start + SPEC.tr, [W / 2, H / 2]);
            easeAll(function () { return tr(L, "ADBE Position"); });
        }
    }

    if (SPEC.pip) {
        /* 人物圆形 PiP：素材层 + 圆形遮罩（替换素材时保留遮罩），按镜头开关（HOLD 关键帧） */
        STEP = "主合成 / 人物 PiP";
        var PV = MAIN.layers.add(importFile(SPEC.pip.file, false)), pk;
        PV.name = "人物占位_请替换_PiP（圆形遮罩）";
        tr(PV, "ADBE Scale").setValue([SPEC.pip.s, SPEC.pip.s]);
        tr(PV, "ADBE Position").setValue(SPEC.pip.pos);
        PV.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        PV.property("ADBE Mask Parade").property(1).property("ADBE Mask Shape").setValue(circleShape(SPEC.pip.mc[0], SPEC.pip.mc[1], SPEC.pip.mr));
        for (pk = 0; pk < SPEC.pip.vis.length; pk++) { tr(PV, "ADBE Opacity").setValueAtTime(SPEC.pip.vis[pk][0], SPEC.pip.vis[pk][1]); }
        for (pk = 1; pk <= tr(PV, "ADBE Opacity").numKeys; pk++) { tr(PV, "ADBE Opacity").setInterpolationTypeAtKey(pk, KeyframeInterpolationType.HOLD); }
        var PR = shapeBox(MAIN, { name: "人物PiP_描边", x: SPEC.pip.c[0], y: SPEC.pip.c[1], w: SPEC.pip.d, h: SPEC.pip.d, stroke: "#EDEAE4", sw: 4, kf: {} }, "ell");
        tr(PR, "ADBE Opacity").expression = "thisComp.layer(\"人物占位_请替换_PiP（圆形遮罩）\").transform.opacity";
    }

    app.endUndoGroup(); app.beginUndoGroup(SPEC.title + " 重建 · 字幕与音效");
    STEP = "主合成 / 字幕";
    /* subtitles: text + plate sized by expression */
    for (j = 0; j < SPEC.subs.length; j++) {
        var s = SPEC.subs[j], nm = "字幕_" + (j < 9 ? "0" : "") + (j + 1);
        var T = MAIN.layers.addText(s.text);
        T.name = nm;
        var td = T.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle(); td.font = SPEC.fonts.sansB; td.fontSize = 50; td.applyFill = true;
        td.fillColor = s.dark ? [0.957, 0.949, 0.929] : [0.078, 0.078, 0.078];
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        T.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        tr(T, "ADBE Position").setValue([W / 2, H - 104 - 22]);
        if (s.em) {
            T.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Animator Properties").property("ADBE Text Fill Color").setValue(hex(s.dark ? "#FF4D58" : "#F2333F"));
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").addProperty("ADBE Text Selector");
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").property(1).property("ADBE Text Range Advanced").property("ADBE Text Range Units").setValue(2);
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").property(1).property("ADBE Text Index Start").setValue(s.em[0]);
            T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").property(1).property("ADBE Text Index End").setValue(s.em[1]);
        }
        T.inPoint = s["in"]; T.outPoint = s.out;
        tr(T, "ADBE Opacity").setValueAtTime(s["in"], 0);
        tr(T, "ADBE Opacity").setValueAtTime(s["in"] + 0.14, 100);
        easeAll(function () { return tr(T, "ADBE Opacity"); });

        var P = MAIN.layers.addShape();
        P.name = nm + "_底板";
        contents(P).addProperty("ADBE Vector Group");
        grpVecs(P, 1).addProperty("ADBE Vector Shape - Rect");
        grpVecs(P, 1).addProperty("ADBE Vector Graphic - Fill");
        grpVecs(P, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Roundness").setValue(4);
        grpVecs(P, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").expression =
            "var r = thisComp.layer(\"" + nm + "\").sourceRectAtTime(time, false); [r.width + 60, r.height + 30];";
        grpVecs(P, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Position").expression =
            "var r = thisComp.layer(\"" + nm + "\").sourceRectAtTime(time, false); [r.left + r.width / 2, r.top + r.height / 2];";
        grpVecs(P, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(s.dark ? hex("#0E0F11") : hex("#EDEAE4"));
        grpVecs(P, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Opacity").setValue(s.dark ? 84 : 95);
        tr(P, "ADBE Anchor Point").setValue([0, 0]);
        tr(P, "ADBE Position").expression = "thisComp.layer(\"" + nm + "\").transform.position";
        tr(P, "ADBE Opacity").expression = "thisComp.layer(\"" + nm + "\").transform.opacity";
        P.inPoint = s["in"]; P.outPoint = s.out;
        P.moveAfter(T);
        T.moveToBeginning(); P.moveAfter(T);
    }

    /* HUD (top-left 440x240 kept empty for the IP badge): light + dark sets, switched with HOLD keys */
    // 时间码偏移：单镜头包从 0 秒开始，但 LOG 显示成片里的原时间（SPEC.tcOffset 秒）
    var TC = "function p(n){return (n<10?\"0\":\"\")+n;} var T=time+" + (SPEC.tcOffset || 0) + "; var f=Math.floor((T%1)*60), s=Math.floor(T)%60, m=Math.floor(T/60); \"LOG 00:\"+p(m)+\":\"+p(s)+\":\"+p(f);";
    var hudDefs = [["栏目", "艾唯说挖洞 · CASE " + (SPEC.caseNo || "001"), W - 84, 68, ""], ["时间码", "LOG", W - 84, H - 50, TC]];
    var tone, isDark, hT, htd, kk;
    for (tone = 0; tone < 2; tone++) {
        for (j = 0; j < hudDefs.length; j++) {
            hT = MAIN.layers.addText(hudDefs[j][1]);
            hT.name = "HUD_" + hudDefs[j][0] + (tone ? "_浅字" : "_深字");
            htd = hT.property("ADBE Text Properties").property("ADBE Text Document").value;
            htd.resetCharStyle(); htd.font = SPEC.fonts.mono; htd.fontSize = 18; htd.tracking = 140; htd.applyFill = true;
            htd.fillColor = tone ? [0.93, 0.92, 0.89] : [0.31, 0.3, 0.28];
            htd.justification = ParagraphJustification.RIGHT_JUSTIFY;
            hT.property("ADBE Text Properties").property("ADBE Text Document").setValue(htd);
            tr(hT, "ADBE Position").setValue([hudDefs[j][2], hudDefs[j][3]]);
            if (hudDefs[j][4]) { hT.property("ADBE Text Properties").property("ADBE Text Document").expression = hudDefs[j][4]; }
            for (i = 0; i < SPEC.shots.length; i++) {
                isDark = (SPEC.shots[i].mode === "n" || SPEC.shots[i].mode === "f");
                tr(hT, "ADBE Opacity").setValueAtTime(SPEC.shots[i].start + (i ? SPEC.tr / 2 : 0), (isDark === (tone === 1)) ? 100 : 0);
            }
            for (kk = 1; kk <= tr(hT, "ADBE Opacity").numKeys; kk++) {
                tr(hT, "ADBE Opacity").setInterpolationTypeAtKey(kk, KeyframeInterpolationType.HOLD);
            }
            hT.moveToBeginning();
        }
    }

    STEP = "主合成 / 音轨与音效";
    /* audio: A-roll voice + SFX layers */
    var V = MAIN.layers.add(importFile(SPEC.voice, false));
    V.name = "口播音轨"; V.enabled = false; V.audioEnabled = true; V.moveToEnd();
    for (j = 0; j < SPEC.sfx.length; j++) {
        var A = MAIN.layers.add(importFile("sfx/" + SPEC.sfx[j].k + ".wav", false));
        A.name = "音效_" + SPEC.sfx[j].k + "_" + SPEC.sfx[j].t;
        A.startTime = SPEC.sfx[j].t;
        A.moveToEnd();
    }
    MAIN.openInViewer();
    } catch (err) {
        app.endUndoGroup();
        alert(SPEC.title + " 重建中断\n步骤：" + STEP + "\n错误：" + err.toString() + (err.line ? "\n行号：" + err.line : "") + "\n请把这个弹窗截图发给我。");
        return;
    }
    app.endUndoGroup();
    alert(SPEC.title + " 重建完成：" + SPEC.shots.length + " 个镜头，" + SPEC.subs.length + " 条字幕，" + SPEC.sfx.length + " 个音效。" + (WARN.length ? "\n\n需要留意：\n" + WARN.join("\n") : ""));
})();
