/* ===== runtime：艾唯白帽志 AE 重建运行库（ES3：只用 var / function / for 循环；属性每次从图层重新获取）=====
 * 由 ae/build_ae.py 拼进每一期的 .jsx：SPEC（本期数据）+ motion_data.jsx + motion_ae.jsx（BMAE 动效库）+ 本文件。
 * 全新编写（白帽志自有代码），不含 lieflat code video 的代码。
 *
 * 一个镜头 = 一个 1920×1080 合成：
 *   背景板_BG3（库里的 PNG）→ 背景动态_点阵 / 十字标 / 焦点光晕 / 焦点刻度环 / 焦点刻度（每秒转 4°）
 *   → 每个画面元素：透明 PNG 图层（底卡、描边、图标、贴纸）+ AE 文字层（可改字）+ 入场关键帧（BMAE，和网页同一条曲线）
 *     卡片这类有多个部件的元素放进预合成（倾斜在预合成图层上转）；部件 = PNG 为主层，文字层挂在主层下（父子 + 透明度跟随表达式）
 *   → 录屏窗口：窗口边框 PNG + 录屏预合成（原片素材 + 时间重映射 + 推镜关键帧 + 标注 / 打码形状层）
 * 画面顶部 76px 是章节进度条区：这里只有背景层（build_ae.py 会查）。 */
(function () {
    var FPS = SPEC.fps, W = 1920, H = 1080;
    var ROOT = new File($.fileName).parent.fsName + "/assets/";
    var CACHE = {}, WARN = [], STEP = "", FOLDER = null, FOLDER_SHOTS = null, FOLDER_PARTS = null;

    function hex(c) {
        c = c.replace("#", "");
        return [parseInt(c.substr(0, 2), 16) / 255, parseInt(c.substr(2, 2), 16) / 255, parseInt(c.substr(4, 2), 16) / 255];
    }
    function importFile(rel) {
        if (CACHE[rel]) { return CACHE[rel]; }
        var f = new File(ROOT + rel);
        if (!f.exists) { throw new Error("缺少素材: " + ROOT + rel); }
        var item = app.project.importFile(new ImportOptions(f));
        item.parentFolder = FOLDER;
        CACHE[rel] = item;
        return item;
    }
    function tr(layer, mn) { return layer.property("ADBE Transform Group").property(mn); }
    function contents(layer) { return layer.property("ADBE Root Vectors Group"); }
    function grpVecs(layer, gi) { return contents(layer).property(gi).property("ADBE Vectors Group"); }
    function textDoc(layer) { return layer.property("ADBE Text Properties").property("ADBE Text Document"); }

    /* ---------- 图层 ---------- */
    // 图片：o = {file, x, y, w, h}（画面坐标，w / h 是显示尺寸；PNG 是 2 倍像素，缩放自动算）
    function imageLayer(comp, o, name) {
        var item = importFile(o.file), L = comp.layers.add(item), s = o.w / item.width * 100;
        L.name = name;
        tr(L, "ADBE Scale").setValue([s, s]);
        tr(L, "ADBE Position").setValue([o.x + o.w / 2, o.y + o.h / 2]);
        return L;
    }
    // 形状矩形（遮罩 / 打码 / 标注框）：r = [x, y, w, h]
    function rectLayer(comp, r, name, fill, stroke, sw, radius) {
        var L = comp.layers.addShape();
        L.name = name;
        contents(L).addProperty("ADBE Vector Group");
        grpVecs(L, 1).addProperty("ADBE Vector Shape - Rect");
        if (fill) { grpVecs(L, 1).addProperty("ADBE Vector Graphic - Fill"); }
        if (stroke) { grpVecs(L, 1).addProperty("ADBE Vector Graphic - Stroke"); }
        grpVecs(L, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([r[2], r[3]]);
        grpVecs(L, 1).property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Roundness").setValue(radius || 0);
        if (fill) { grpVecs(L, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(fill)); }
        if (stroke) {
            grpVecs(L, 1).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").setValue(hex(stroke));
            grpVecs(L, 1).property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(sw || 4);
        }
        tr(L, "ADBE Anchor Point").setValue([0, 0]);
        tr(L, "ADBE Position").setValue([r[0] + r[2] / 2, r[1] + r[3] / 2]);
        return L;
    }
    // 文字：t = {text, align, x, y（第一行基线）, lead, op, runs: [{s, e, font, size, color, track, faux}]}
    function styleRange(r, run) {
        r.font = run.font; r.fontSize = run.size; r.applyFill = true; r.fillColor = hex(run.color); r.tracking = run.track;
        if (run.faux) { try { r.fauxBold = true; } catch (eF) { WARN.push(STEP + "：仿粗体没设上（" + run.font + "）"); } }
    }
    function textLayer(comp, t, name) {
        var L = comp.layers.addText(t.text), td, i, r0 = t.runs[0];
        L.name = name;
        td = textDoc(L).value;
        td.resetCharStyle();
        styleRange(td, r0);
        if (t.lead) { td.autoLeading = false; td.leading = t.lead; }
        td.justification = t.align === "center" ? ParagraphJustification.CENTER_JUSTIFY : (t.align === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
        textDoc(L).setValue(td);
        if (t.runs.length > 1) {
            /* 逐段设字体（AE 24.3+ CharacterRange）：中英混排、数字 + 中文单位、回退字 */
            td = textDoc(L).value;
            try {
                for (i = 1; i < t.runs.length; i++) { styleRange(td.characterRange(t.runs[i].s, t.runs[i].e), t.runs[i]); }
                textDoc(L).setValue(td);
            } catch (eR) { WARN.push(STEP + "：「" + t.text.substr(0, 12) + "」逐字字体没设上（AE 24.3 以上才支持），整段用了 " + r0.font); }
        }
        tr(L, "ADBE Position").setValue([t.x, t.y]);
        tr(L, "ADBE Opacity").setValue(Math.round(t.op * 100));
        return L;
    }

    /* ---------- 入场动效（BMAE，和网页同一份入场时间表） ---------- */
    var OPA_FX = { rise: 1, drop: 1, unfold: 1, maskUp: 0, underline: 0, blockSweep: 0, countUp: 0 };
    // 锚点挪到 (ax, ay)（图层自身坐标），位置同步补偿，画面不动
    function setAnchor(L, ax, ay) {
        var a = tr(L, "ADBE Anchor Point").value, p = tr(L, "ADBE Position").value, s = tr(L, "ADBE Scale").value;
        tr(L, "ADBE Anchor Point").setValue([ax, ay]);
        tr(L, "ADBE Position").setValue([p[0] + (ax - a[0]) * s[0] / 100, p[1] + (ay - a[1]) * s[1] / 100]);
    }
    function anchorFor(L, fx) {
        var rc = L.sourceRectAtTime(0, false);
        if (fx === "unfold") { setAnchor(L, rc.left + rc.width / 2, rc.top); }
        else if (fx === "underline" || fx === "blockSweep") { setAnchor(L, rc.left, rc.top + rc.height / 2); }
        else if (fx === "drop") { setAnchor(L, rc.left + rc.width / 2, rc.top + rc.height / 2); }
    }
    // 数字滚动：滑块控制做关键帧，源文本用表达式取整（原数字带千分位就保留千分位）
    function countUp(L, at, to) {
        var v = parseInt(to.replace(/,/g, ""), 10), fx;
        L.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        fx = L.property("ADBE Effect Parade");
        fx.property(fx.numProperties).name = "BM 计数";
        BMAE.key(L.property("ADBE Effect Parade").property("BM 计数").property("ADBE Slider Control-0001"), at, 0, at + BMAE.dur(BMAE.data.preset.countUp.dur), v, BMAE.data.preset.countUp.ease);
        textDoc(L).expression = 'var n = Math.round(effect("BM 计数")("ADBE Slider Control-0001")).toString();' +
            (/,/.test(to) ? ' n.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");' : ' n;');
    }
    // keepAnchor：预合成图层的锚点已经放在倾斜中心，不能再挪
    function applyFx(comp, L, fx, at, o, i, node, keepAnchor) {
        if (!fx) { return; }
        STEP = comp.name + " / " + L.name + " / " + fx;
        if (fx === "countUp") { if (node && node.to && /^[\d,]+$/.test(node.to)) { countUp(L, at, node.to); } return; }
        if (!keepAnchor) { anchorFor(L, fx); }
        if (fx === "maskUp") {
            var m = rectLayer(comp, node.matte, L.name + "_遮罩", "#FFFFFF");
            BMAE.maskUp(L, m, at, i || 0);
            m.enabled = false;
            return;
        }
        BMAE[fx](L, at, o || undefined);
    }
    // 子层透明度跟随主层（AE 的父子关系只带位置 / 缩放 / 旋转，不带透明度）
    function followOpacity(child, lead, rest) {
        tr(child, "ADBE Opacity").expression = 'value * thisComp.layer("' + lead.name + '").transform.opacity / ' + rest + ';';
    }

    /* ---------- 一个画面元素：若干 node，每个 node = PNG 主层 + 文字层 ---------- */
    function buildNodes(comp, u, rootAnim, shot) {
        var map = {}, i, j, n, Ls, L, lead, P, k;
        for (i = 0; i < u.nodes.length; i++) {
            n = u.nodes[i]; STEP = comp.name + " / " + n.name; Ls = [];
            if (n.png) { Ls.push(imageLayer(comp, n.png, n.layer)); }
            for (j = 0; j < n.texts.length; j++) { Ls.push(textLayer(comp, n.texts[j], n.texts[j].layer)); }
            if (!Ls.length) { L = comp.layers.addNull(); L.name = n.layer; tr(L, "ADBE Position").setValue([n.box[0] + n.box[2] / 2, n.box[1] + n.box[3] / 2]); Ls.push(L); }
            lead = Ls[0];
            for (j = 1; j < Ls.length; j++) { Ls[j].parent = lead; }
            if (n.parent && map[n.parent]) { lead.parent = map[n.parent].lead; }
            map[n.id] = { lead: lead, all: Ls, rest: n.rest, node: n };
        }
        /* 父子关系全部挂好以后再加关键帧（父层在 0 秒有位移时，挂上去的子层不会被带偏） */
        for (i = 0; i < u.nodes.length; i++) {
            n = u.nodes[i]; P = map[n.id];
            if (i === 0 && !n.sibling) {
                if (rootAnim) { applyFx(comp, P.lead, u.fx, u.at, u.o, 0, n); if (shot.out !== null) { BMAE.sink(P.lead, shot.out); } }
            } else {
                applyFx(comp, P.lead, n.fx, n.at, n.o, n.i, n);
                if (n.sibling && rootAnim && shot.out !== null) { BMAE.sink(P.lead, shot.out); }
            }
        }
        /* 透明度跟随：node 内其他层跟主层；子 node 的主层跟父 node 的主层（表达式能串起来） */
        for (i = 0; i < u.nodes.length; i++) {
            n = u.nodes[i]; P = map[n.id];
            if (!n.fade) { continue; }
            for (k = 1; k < P.all.length; k++) { followOpacity(P.all[k], P.lead, P.rest); }
            if (n.parent && map[n.parent] && map[n.parent].node.fade) { followOpacity(P.lead, map[n.parent].lead, map[n.parent].rest); }
        }
        return map;
    }

    /* ---------- 录屏窗口（libs/screencast → AE） ----------
     * 「录屏窗口_边框」PNG +「录屏画面」预合成（视口大小）：
     *   录屏原片（锚点在左上角；缩放 / 位置关键帧 = 推镜，和网页 SC.camAt 同一组数；视频开时间重映射）
     *   打码（实色块）和标注框挂在原片层下面，跟着推镜一起动；聚光（压暗四周）和标签在视口坐标里
     * 换录屏：项目面板里对「录屏原片」右键 → 替换素材（分辨率保持和原来一样，推镜和打码位置才对得上）。 */
    function rrectShape(x, y, w, h, r) {
        var s = new Shape(), k;
        r = Math.min(r, w / 2, h / 2); k = 0.5523 * r;
        s.vertices = [[x + r, y], [x + w - r, y], [x + w, y + r], [x + w, y + h - r], [x + w - r, y + h], [x + r, y + h], [x, y + h - r], [x, y + r]];
        s.inTangents = [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]];
        s.outTangents = [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]];
        s.closed = true;
        return s;
    }
    function addMask(L, shape, inverted) {
        L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        var m = L.property("ADBE Mask Parade").property(L.property("ADBE Mask Parade").numProperties);
        m.property("ADBE Mask Shape").setValue(shape);
        if (inverted) { m.inverted = true; }
        return m;
    }
    // 挂到原片层下面，坐标用原片像素（父层的锚点在原片左上角）
    function pinTo(L, F, r) {
        L.parent = F;
        tr(L, "ADBE Position").setValue([r[0] + r[2] / 2, r[1] + r[3] / 2]);
        tr(L, "ADBE Scale").setValue([100, 100]);
    }
    function fadeInOut(L, at, out) {
        BMAE.key(tr(L, "ADBE Opacity"), at, 0, at + 0.3, 100, "out");
        if (out !== null) { BMAE.key(tr(L, "ADBE Opacity"), out, 100, out + 0.3, 0, "in"); }
    }
    function windowComp(shot, s) {
        var c = app.project.items.addComp(s.name, Math.round(s.vw), Math.round(s.vh), 1, shot.dur, FPS), F, i, k, a, L, R, T, j;
        c.parentFolder = FOLDER_PARTS;
        STEP = s.name + " / 原片";
        F = c.layers.add(importFile(s.src.file));
        F.name = "录屏原片";
        if (s.src.video) {
            F.timeRemapEnabled = true;
            k = F.property("ADBE Time Remapping").numKeys;
            for (i = k; i >= 2; i--) { F.property("ADBE Time Remapping").removeKey(i); }   // 开启时自带首尾两帧，留第一帧被覆盖
            for (i = 0; i < s.remap.length; i++) { F.property("ADBE Time Remapping").setValueAtTime(s.remap[i][0], s.remap[i][1]); }
            for (i = 1; i <= F.property("ADBE Time Remapping").numKeys; i++) {
                if (!keyIn(s.remap, F.property("ADBE Time Remapping").keyTime(i))) { F.property("ADBE Time Remapping").removeKey(i); i--; }
            }
            for (i = 1; i <= F.property("ADBE Time Remapping").numKeys; i++) { F.property("ADBE Time Remapping").setInterpolationTypeAtKey(i, KeyframeInterpolationType.LINEAR); }
            F.outPoint = shot.dur;
        }
        tr(F, "ADBE Anchor Point").setValue([0, 0]);
        tr(F, "ADBE Scale").setValue([s.cam0[0] * 100, s.cam0[0] * 100]);
        tr(F, "ADBE Position").setValue([s.cam0[1], s.cam0[2]]);
        /* 打码 / 标注框先挂到原片层，再给原片加推镜关键帧（挂的时候父层不能在动） */
        for (i = 0; i < s.mask.length; i++) {
            STEP = s.name + " / 打码 " + (i + 1);
            L = rectLayer(c, s.mask[i].r, "打码_" + (i + 1) + "（实色块）", s.mask[i].fill);
            pinTo(L, F, s.mask[i].r);
        }
        for (i = 0; i < s.ann.length; i++) {
            a = s.ann[i]; STEP = s.name + " / 标注 " + (i + 1);
            if (a.type === "spot") {
                /* 聚光：整块压暗，区域挖空（反转蒙版），视口坐标 */
                L = rectLayer(c, [0, 0, s.vw, s.vh], "标注_" + (i + 1) + "_聚光压暗", a.fill);
                grpVecs(L, 1).property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Opacity").setValue(a.op);
                addMask(L, rrectShape(a.vr[0], a.vr[1], a.vr[2], a.vr[3], a.radius), true);
                fadeInOut(L, a.at, a.out);
            } else if (a.type === "underline") {
                L = rectLayer(c, a.r, "标注_" + (i + 1) + "_下划线", a.fill);
                pinTo(L, F, a.r);
                anchorFor(L, "underline");
                BMAE.underline(L, a.at);
                if (a.out !== null) { BMAE.key(tr(L, "ADBE Opacity"), a.out, 100, a.out + 0.3, 0, "in"); }
            } else {
                L = rectLayer(c, a.r, "标注_" + (i + 1) + "_框", null, a.stroke, a.sw, a.radius);
                pinTo(L, F, a.r);
                BMAE.ringDraw(L, a.at, 0);
                if (a.out !== null) { BMAE.key(tr(L, "ADBE Opacity"), a.out, 100, a.out + 0.3, 0, "in"); }
            }
        }
        for (i = 0; i < s.labels.length; i++) {
            a = s.labels[i]; STEP = s.name + " / 标签 " + (i + 1);
            R = a.png ? imageLayer(c, a.png, a.layer) : null;
            for (j = 0; j < a.texts.length; j++) {
                T = textLayer(c, a.texts[j], a.texts[j].layer);
                if (R) { T.parent = R; followOpacity(T, R, 100); } else { R = T; }
            }
            BMAE.rise(R, a.at, { dy: 24 });
            if (a.out !== null) { BMAE.sink(R, a.out); }
        }
        for (i = 0; i < s.push.length; i++) {
            k = s.push[i]; STEP = s.name + " / 推镜 " + (i + 1);
            BMAE.key(tr(F, "ADBE Scale"), k[0], [k[2] * 100, k[2] * 100, 100], k[1], [k[5] * 100, k[5] * 100, 100], k[8]);
            if (!tr(F, "ADBE Position").dimensionsSeparated) { tr(F, "ADBE Position").dimensionsSeparated = true; }
            BMAE.key(tr(F, "ADBE Position_0"), k[0], k[3], k[1], k[6], k[8]);
            BMAE.key(tr(F, "ADBE Position_1"), k[0], k[4], k[1], k[7], k[8]);
        }
        return c;
    }
    function keyIn(list, t) { var i; for (i = 0; i < list.length; i++) { if (Math.abs(list[i][0] - t) < 0.0005) { return true; } } return false; }
    function screencast(comp, shot, s) {
        var B, V;
        STEP = comp.name + " / 录屏窗口";
        B = imageLayer(comp, s.chrome, "录屏窗口_边框");
        V = comp.layers.add(windowComp(shot, s));
        V.name = "录屏窗口_画面（预合成）";
        tr(V, "ADBE Position").setValue([s.vx + s.vw / 2, s.vy + s.vh / 2]);
        addMask(V, rrectShape(0, 0, s.vw, s.vh, s.radius), false);
        V.parent = B;
        if (s.enter !== null || shot.out !== null) { followOpacity(V, B, 100); }
        if (s.enter !== null) { BMAE.rise(B, s.enter); }
        if (shot.out !== null) { BMAE.sink(B, shot.out); }
    }

    /* ---------- 镜头 ---------- */
    function buildShot(sh) {
        var comp = app.project.items.addComp(sh.name, W, H, 1, sh.dur, FPS), i, u, L, c, b;
        comp.parentFolder = FOLDER_SHOTS;
        for (i = 0; i < sh.bg.length; i++) {
            b = sh.bg[i]; STEP = sh.name + " / " + b.name;
            L = imageLayer(comp, b, b.name);
            if (b.spin) { BMAE.sweepSpin(L, 0, sh.dur, { deg_per_s: b.spin }); }
        }
        for (i = 0; i < sh.units.length; i++) {
            u = sh.units[i]; STEP = sh.name + " / " + u.name;
            if (u.kind === "sc") { screencast(comp, sh, u.sc); continue; }
            if (!u.pre) { buildNodes(comp, u, true, sh); continue; }
            c = app.project.items.addComp(sh.name + "·" + u.name, W, H, 1, sh.dur, FPS);
            c.parentFolder = FOLDER_PARTS;
            buildNodes(c, u, false, sh);
            L = comp.layers.add(c);
            L.name = u.name;
            tr(L, "ADBE Anchor Point").setValue([u.pivot[0], u.pivot[1]]);
            tr(L, "ADBE Position").setValue([u.pivot[0], u.pivot[1]]);
            if (u.tilt) { tr(L, "ADBE Rotate Z").setValue(u.tilt); }
            applyFx(comp, L, u.fx, u.at, u.o, 0, null, true);
            if (sh.out !== null) { BMAE.sink(L, sh.out); }
        }
        return comp;
    }

    /* ---------- 字体预检（AE 24.0+：app.fonts.getFontsByPostScriptName） ---------- */
    var missing = [], fi;
    try {
        if (app.fonts && app.fonts.getFontsByPostScriptName) {
            for (fi = 0; fi < SPEC.fonts.length; fi++) {
                if (app.fonts.getFontsByPostScriptName(SPEC.fonts[fi]).length === 0) { missing.push(SPEC.fonts[fi]); }
            }
        }
    } catch (eFont) { }
    if (missing.length > 0) {
        if (!confirm("缺少以下字体，文字会被 AE 换成别的字体：\n\n" + missing.join("\n") +
                     "\n\n字体在本包的 fonts 文件夹里：选中全部 .ttf → 右键 → 为所有用户安装，重启 AE 再运行本脚本。" +
                     "\n\n点「是」仍然继续，点「否」先去装字体。")) { return; }
    }

    app.beginUndoGroup(SPEC.title + " 重建");
    try {
        FOLDER = app.project.items.addFolder(SPEC.prefix + "_素材");
        FOLDER_SHOTS = app.project.items.addFolder(SPEC.prefix + "_镜头");
        FOLDER_PARTS = app.project.items.addFolder(SPEC.prefix + "_部件预合成");
        var MAIN = app.project.items.addComp(SPEC.mainName, W, H, 1, SPEC.dur, FPS), i, sh, L;
        for (i = 0; i < SPEC.shots.length; i++) {
            sh = SPEC.shots[i];
            /* 撤销记录按镜头分段：几十个镜头放在一个撤销组里很占内存 */
            if (i > 0) { app.endUndoGroup(); app.beginUndoGroup(SPEC.title + " 重建 · " + sh.name); }
            STEP = sh.name;
            L = MAIN.layers.add(buildShot(sh));
            L.startTime = sh.start;
            L.moveToBeginning();
        }
        if (SPEC.voice) {
            STEP = "主合成 / 口播音轨";
            L = MAIN.layers.add(importFile(SPEC.voice));
            L.name = "口播音轨"; L.moveToEnd();
        }
        for (i = 0; i < SPEC.sfx.length; i++) {
            STEP = "主合成 / 音效 " + SPEC.sfx[i].file;
            L = MAIN.layers.add(importFile(SPEC.sfx[i].file));
            L.name = "音效_" + SPEC.sfx[i].name; L.startTime = SPEC.sfx[i].t; L.moveToEnd();
        }
        MAIN.openInViewer();
    } catch (err) {
        app.endUndoGroup();
        alert(SPEC.title + " 重建中断\n步骤：" + STEP + "\n错误：" + err.toString() + (err.line ? "\n行号：" + err.line : "") + "\n请把这个弹窗截图发给我。");
        return;
    }
    app.endUndoGroup();
    alert(SPEC.title + " 重建完成：" + SPEC.shots.length + " 个镜头。" + (WARN.length ? "\n\n需要留意：\n" + WARN.join("\n") : ""));
})();
