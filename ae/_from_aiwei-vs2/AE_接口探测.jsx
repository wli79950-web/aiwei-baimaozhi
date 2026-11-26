// 艾唯说挖洞 · AE 接口探测脚本（只读，ES3）
// 用途：导出你这台 After Effects 的真实属性内部名（matchName）、属性类型、方法可用性和字体安装情况，
//       供重建脚本按你的 AE 版本逐项核对。
// 安全：只在一个临时合成里建测试图层，导出完成后自动删除该合成；不修改、不保存你的工程。
// 用法：文件 > 脚本 > 运行脚本文件 > 选本文件。完成后桌面会出现 AE_接口探测_版本号.txt，把它发给我。
(function () {
    var OUT = [];
    var ERR = [];
    function log(s) { OUT.push(s); }
    function err(where, e) { ERR.push(where + " -> " + e.toString() + (e.line ? " (line " + e.line + ")" : "")); }
    function pad(n) { var s = ""; var i; for (i = 0; i < n; i++) { s += "  "; } return s; }
    function ptype(t) {
        if (t === PropertyType.PROPERTY) { return "PROPERTY"; }
        if (t === PropertyType.INDEXED_GROUP) { return "INDEXED_GROUP"; }
        if (t === PropertyType.NAMED_GROUP) { return "NAMED_GROUP"; }
        return String(t);
    }
    function vtype(t) {
        var names = ["NO_VALUE", "ThreeD_SPATIAL", "ThreeD", "TwoD_SPATIAL", "TwoD", "OneD", "COLOR", "CUSTOM_VALUE", "MARKER", "LAYER_INDEX", "MASK_INDEX", "SHAPE", "TEXT_DOCUMENT"];
        var i;
        for (i = 0; i < names.length; i++) {
            try { if (t === PropertyValueType[names[i]]) { return names[i]; } } catch (e) { }
        }
        return String(t);
    }
    /* recursive dump: read-only, no properties are added while walking */
    function dump(group, depth, path) {
        var n = 0, i, p, line;
        try { n = group.numProperties; } catch (e0) { err("numProperties " + path, e0); return; }
        for (i = 1; i <= n; i++) {
            try {
                p = group.property(i);
                if (!p) { continue; }
                line = pad(depth) + "[" + i + "] " + p.matchName + " | " + p.name + " | " + ptype(p.propertyType);
                if (p.propertyType === PropertyType.PROPERTY) {
                    line += " | " + vtype(p.propertyValueType);
                    try { line += p.canVaryOverTime ? " | 可K帧" : " | 不可K帧"; } catch (e1) { }
                    try { line += p.canSetExpression ? " | 可表达式" : ""; } catch (e2) { }
                    try { line += p.isSpatial ? " | 空间" : ""; } catch (e3) { }
                    log(line);
                } else {
                    log(line);
                    dump(p, depth + 1, path + "/" + p.matchName);
                }
            } catch (e4) { err("dump " + path + " #" + i, e4); }
        }
    }
    function has(obj, name) {
        try { return (typeof obj[name] !== "undefined") ? "有" : "无"; } catch (e) { return "无(" + e.toString() + ")"; }
    }

    log("==== 艾唯说挖洞 · AE 接口探测报告 ====");
    try { log("AE 版本: " + app.version + "  build " + app.buildNumber); } catch (e) { err("version", e); }
    try { log("界面语言: " + app.isoLanguage); } catch (e) { err("isoLanguage", e); }
    try { log("系统: " + $.os); } catch (e) { err("os", e); }
    try { log("表达式引擎: " + app.project.expressionEngine); } catch (e) { err("expressionEngine", e); }
    log("");

    app.beginUndoGroup("AE 接口探测（临时）");
    var comp = null;
    try {
        comp = app.project.items.addComp("__AE_PROBE_TEMP__", 1920, 1080, 1, 5, 60);

        /* ---------- shape layer with every vector item the rebuild uses ---------- */
        var S = comp.layers.addShape();
        S.name = "probe_shape";
        var items = ["ADBE Vector Shape - Rect", "ADBE Vector Shape - Ellipse", "ADBE Vector Shape - Group",
                     "ADBE Vector Graphic - Fill", "ADBE Vector Graphic - Stroke", "ADBE Vector Filter - Repeater"];
        var k;
        try { S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); } catch (e) { err("add Vector Group", e); }
        for (k = 0; k < items.length; k++) {
            try { S.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").addProperty(items[k]); }
            catch (e) { err("add " + items[k], e); }
        }
        try { S.property("ADBE Effect Parade").addProperty("ADBE Ramp"); } catch (e) { err("add ADBE Ramp", e); }
        try { S.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"); } catch (e) { err("add Mask Atom", e); }

        /* ---------- text layer with animator + fill color + range selector ---------- */
        var T = comp.layers.addText("探测 PROBE");
        T.name = "probe_text";
        try { T.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator"); } catch (e) { err("add Text Animator", e); }
        try { T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color"); } catch (e) { err("add Text Fill Color", e); }
        try { T.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").addProperty("ADBE Text Selector"); } catch (e) { err("add Text Selector", e); }

        /* ---------- full property trees ---------- */
        log("==== 形状图层属性树 ====");
        dump(S, 0, "shape");
        log("");
        log("==== 文字图层属性树 ====");
        dump(T, 0, "text");
        log("");

        /* ---------- keyframe ease dimension test ---------- */
        log("==== 关键帧缓动维度测试 ====");
        var props = [["ADBE Scale", 3], ["ADBE Position", 1], ["ADBE Opacity", 1], ["ADBE Rotate Z", 1]];
        var d, tries, ok, q, ei, eo, j;
        for (k = 0; k < props.length; k++) {
            S.property("ADBE Transform Group").property(props[k][0]).setValueAtTime(0, S.property("ADBE Transform Group").property(props[k][0]).value);
            S.property("ADBE Transform Group").property(props[k][0]).setValueAtTime(1, S.property("ADBE Transform Group").property(props[k][0]).value);
            tries = [1, 2, 3]; ok = [];
            for (d = 0; d < tries.length; d++) {
                ei = []; eo = [];
                for (j = 0; j < tries[d]; j++) { ei.push(new KeyframeEase(0, 70)); eo.push(new KeyframeEase(0, 70)); }
                try { S.property("ADBE Transform Group").property(props[k][0]).setTemporalEaseAtKey(1, ei, eo); ok.push(tries[d]); } catch (e) { }
            }
            log(props[k][0] + " : 可用的缓动数组长度 = [" + ok.join(",") + "]");
        }
        try {
            S.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset").setValueAtTime(0, 0);
            S.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset").setValueAtTime(1, 2300);
            log("ADBE Mask Offset 设值 2300 : 成功，读回 " + S.property("ADBE Mask Parade").property(1).property("ADBE Mask Offset").valueAtTime(1, false));
        } catch (e) { err("Mask Offset 2300", e); }
        log("");

        /* ---------- method / attribute availability ---------- */
        log("==== 方法与属性可用性 ====");
        var P = S.property("ADBE Transform Group").property("ADBE Opacity");
        var mlist = ["setValue", "setValueAtTime", "setTemporalEaseAtKey", "setInterpolationTypeAtKey", "keyTime", "numKeys", "expression", "valueAtTime"];
        for (k = 0; k < mlist.length; k++) { log("Property." + mlist[k] + " : " + has(P, mlist[k])); }
        var llist = ["moveToEnd", "moveToBeginning", "moveAfter", "sourceRectAtTime", "audioEnabled", "startTime", "inPoint", "outPoint"];
        for (k = 0; k < llist.length; k++) { log("Layer." + llist[k] + " : " + has(T, llist[k])); }
        var td = T.property("ADBE Text Properties").property("ADBE Text Document").value;
        var tlist = ["resetCharStyle", "font", "fontSize", "applyFill", "fillColor", "tracking", "autoLeading", "leading", "justification"];
        for (k = 0; k < tlist.length; k++) { log("TextDocument." + tlist[k] + " : " + has(td, tlist[k])); }
        try { var rc = T.sourceRectAtTime(0, false); log("sourceRectAtTime 返回: left=" + rc.left + " top=" + rc.top + " w=" + rc.width + " h=" + rc.height); } catch (e) { err("sourceRectAtTime", e); }
        try { td.autoLeading = false; td.leading = 45; T.property("ADBE Text Properties").property("ADBE Text Document").setValue(td); log("行距设置 autoLeading/leading : 成功"); } catch (e) { err("leading", e); }
        log("");

        /* ---------- fonts used by the rebuild ---------- */
        log("==== 字体检查（PostScript 名）====");
        var fonts = ["NotoSansSC-Black", "NotoSansSC-Bold", "NotoSansSC-Medium", "NotoSerifSC-Black", "JetBrainsMono-Bold", "JetBrainsMono-Medium", "SpaceGrotesk-Bold"];
        for (k = 0; k < fonts.length; k++) {
            var found = "未知";
            try {
                if (app.fonts && app.fonts.getFontsByPostScriptName) {
                    found = app.fonts.getFontsByPostScriptName(fonts[k]).length > 0 ? "已安装" : "未安装";
                } else {
                    var td2 = T.property("ADBE Text Properties").property("ADBE Text Document").value;
                    td2.font = fonts[k];
                    T.property("ADBE Text Properties").property("ADBE Text Document").setValue(td2);
                    found = (T.property("ADBE Text Properties").property("ADBE Text Document").value.font === fonts[k]) ? "已安装(读回一致)" : "未安装(被替换)";
                }
            } catch (e) { found = "检查出错: " + e.toString(); }
            log(fonts[k] + " : " + found);
        }
    } catch (eMain) {
        err("主流程", eMain);
    }
    /* ---------- cleanup: remove the temp comp ---------- */
    try { if (comp) { comp.remove(); } } catch (e) { err("删除临时合成", e); }
    app.endUndoGroup();

    log("");
    log("==== 错误 / 不可用项 (" + ERR.length + ") ====");
    var i;
    for (i = 0; i < ERR.length; i++) { log(ERR[i]); }

    var ver = "unknown";
    try { ver = app.version.replace(/[^0-9.]/g, "_"); } catch (e) { }
    var f = new File(Folder.desktop.fsName + "/AE_接口探测_" + ver + ".txt");
    f.encoding = "UTF-8";
    var opened = false;
    try { opened = f.open("w"); } catch (eOpen) { opened = false; }
    if (opened) {
        f.write(OUT.join("\n"));
        f.close();
        alert("探测完成。\n报告已保存到桌面：\n" + f.fsName + "\n\n临时合成已删除，你的工程未被改动。\n请把这个 txt 文件发给我。");
    } else {
        alert("无法写入桌面文件。请在 AE 首选项 > 脚本和表达式 中勾选「允许脚本写入文件和访问网络」，然后再运行一次。");
    }
})();
