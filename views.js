/* views.js — หน้าวิเคราะห์สำหรับ HR Admin · ผู้บริหาร · หัวหน้าส่วนงาน · หัวหน้าหอ */
var CATS4 = ['CFC', 'SFC', 'SONE', 'ALL'];
function catLabel(c) { return c === 'ALL' ? 'รวมทุกหมวด' : c; }
function catRows(cat, round) { return rowsWhere({ cat: cat, round: round }); }
function levelBar(d) {
  var t = d.R + d.Y + d.G; if (!t) return '<div class="lvbar"></div><div class="lvnums"><span class="muted">ไม่มีข้อมูล</span></div>';
  return '<div class="lvbar" role="img" aria-label="ต่ำกว่าเกณฑ์ ' + d.R + ' เท่ากับเกณฑ์ ' + d.Y + ' สูงกว่าเกณฑ์ ' + d.G + ' คน">' + ['R', 'Y', 'G'].map(function (k) { return d[k] ? '<i class="lv-' + k + '" style="width:' + (d[k] / t * 100) + '%" title="' + LV_LABEL[k] + ' ' + d[k] + ' คน (' + pct(d[k], t) + ')"></i>' : ''; }).join('') + '</div>' +
    '<div class="lvnums"><span class="t-R">แดง ' + fmtInt(d.R) + ' · ' + pct(d.R, t, 0) + '</span><span class="t-Y">เหลือง ' + fmtInt(d.Y) + '</span><span class="t-G">เขียว ' + fmtInt(d.G) + ' · ' + pct(d.G, t, 0) + '</span></div>';
}
function levelsCols() {
  return [
    { k: 'N', label: 'คน', num: true, d: 0 },
    { k: 'avg', label: 'คะแนนเฉลี่ย', num: true, html: function (r) { return lvCell(r.avg); }, xval: function (r) { return r.avg === null ? '' : Math.round(r.avg * 100) / 100; } },
    { k: 'R', label: 'แดง', num: true, d: 0, html: function (r) { return fmtInt(r.R) + ' <span class="muted sm">' + pct(r.R, r.N, 0) + '</span>'; } },
    { k: 'Y', label: 'เหลือง', num: true, d: 0, html: function (r) { return fmtInt(r.Y) + ' <span class="muted sm">' + pct(r.Y, r.N, 0) + '</span>'; } },
    { k: 'G', label: 'เขียว', num: true, d: 0, html: function (r) { return fmtInt(r.G) + ' <span class="muted sm">' + pct(r.G, r.N, 0) + '</span>'; } },
    { k: 'pR', label: '% แดง', num: true, val: function (r) { return r.N ? r.R / r.N * 100 : null; } },
    { k: 'INC', label: 'ประเมินไม่ครบ', num: true, d: 0 }
  ];
}
function cardH(title, sub, tools) { return '<div class="card-h"><h3>' + title + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + (tools || '') + '</div>'; }
function holderIn(sec, cls) { return $('.' + cls, sec); }
function legendNote() { var st = S.settings; return 'แดง &lt; ' + st.RED_MAX + ' · เหลือง ' + st.RED_MAX + '–' + st.YELLOW_MAX + ' · เขียว &gt; ' + st.YELLOW_MAX + ' · คะแนนต่ำกว่า ' + st.INC_MAX + ' = ประเมินไม่ครบ (ไม่นำมาเฉลี่ย)'; }

/* ================= ภาพรวม ================= */
VIEWS.overview = {
  title: 'ภาพรวมผู้บริหาร',
  render: function (box) {
    var F = S.F, pr = prevRound(F.round), ri = S.ds.roundIdx;
    var kp = div(box, 'kpis');
    CATS4.forEach(function (c) {
      var d = dist(personScores(catRows(c, F.round)));
      var dp = pr >= 0 ? dist(personScores(catRows(c, pr))) : null;
      var dAvg = dp && dp.avg !== null && d.avg !== null ? d.avg - dp.avg : null;
      var k = document.createElement('div'); k.className = 'kpi' + (F.cat === c ? ' sel' : ''); k.style.setProperty('--c', 'var(--' + c + ')'); k.tabIndex = 0;
      k.innerHTML = '<div class="kpi-h"><span>' + catLabel(c) + '</span><span class="dot"></span></div>' +
        '<div class="kpi-v">' + (d.avg === null ? '–' : fmt(d.avg, 2)) + '<small>คะแนนเฉลี่ย</small></div>' +
        '<div class="kpi-d">' + (dp ? deltaHtml(dAvg) + ' <span class="muted">เทียบ ' + esc(roundLabel(pr)) + '</span>' : '<span class="muted">ไม่มีรอบก่อนหน้า</span>') + '</div>' +
        '<div class="kpi-spark"></div>' + levelBar(d) +
        '<div class="kpi-f"><span>ผู้ถูกประเมิน ' + fmtInt(d.N) + ' คน</span>' + (d.INC ? '<span class="t-INC">ประเมินไม่ครบ ' + fmtInt(d.INC) + '</span>' : '') + '</div>';
      kp.appendChild(k);
      var sp = ri.map(function (r) { var x = dist(personScores(catRows(c, r))); return x.avg === null ? null : Math.round(x.avg * 100) / 100; });
      if (sp.filter(function (v) { return v !== null; }).length > 1) chartSpark($('.kpi-spark', k), sp, CH.cat(c)); else $('.kpi-spark', k).style.height = '6px';
      var pick = function () { S.F.cat = c; S.F.dom = S.F.grp = S.F.dis = -1; buildFilters(); render(); };
      k.addEventListener('click', pick); k.addEventListener('keydown', function (e) { if (e.key === 'Enter') pick(); });
    });
    div(box, 'muted sm', 'คลิกการ์ดเพื่อเลือกหมวด · สีคำนวณจากคะแนนภาพรวมรายคน: ' + legendNote()).style.margin = '0 0 16px';

    var P = personScores(rowsWhere()), dAll = dist(P);
    var g1 = div(box, 'grid-6-4');
    var gs = groupStats(P, 'pm').filter(function (g) { return g.N + g.INC > 0; });
    var s1 = section(g1, cardH('ระดับผลประเมินตามตำแหน่ง', 'คลิกแท่งเพื่อเจาะดูตำแหน่งนั้น') + '<div class="c1"></div>');
    chartLevels(holderIn(s1, 'c1'), gs.map(function (g) { return { label: g.name + ' (' + g.N + ')', R: g.R, Y: g.Y, G: g.G, INC: g.INC }; }), { onClick: function (i) { S.F.pm = gs[i].key; S.groupBy = 'ps'; buildFilters(); route('groups'); } });
    var s2 = section(g1, cardH('สัดส่วนระดับ ' + esc(catLabel(F.cat)), fmtInt(dAll.N + dAll.INC) + ' คน') + '<div class="c2"></div>');
    chartDonut(holderIn(s2, 'c2'), [{ name: LV_LABEL.R, value: dAll.R, color: CH.lv('R') }, { name: LV_LABEL.Y, value: dAll.Y, color: CH.lv('Y') }, { name: LV_LABEL.G, value: dAll.G, color: CH.lv('G') }, { name: LV_LABEL.INC, value: dAll.INC, color: CH.lv('INC') }],
      [dAll.avg === null ? '–' : fmt(dAll.avg, 2), 'คะแนนเฉลี่ย'], { height: Math.max(260, gs.length * 36 + 60) });

    var g2 = div(box, 'grid2');
    // heatmap ส่วนงาน × หมวด
    var divRows = {};
    CATS4.forEach(function (c) { groupStats(personScores(rowsWhere({ cat: c })), 'div').forEach(function (g) { (divRows[g.key] = divRows[g.key] || { key: g.key, name: g.name })[c] = g; }); });
    var hm = Object.keys(divRows).map(function (k) { return divRows[k]; }).sort(function (a, b) { return (S.ds.divs[a.key].order || 99) - (S.ds.divs[b.key].order || 99); });
    if (hm.length < 2) { g2.className = ''; }
    var s3 = hm.length < 2 ? null : section(g2, cardH('คะแนนเฉลี่ยรายส่วนงาน × หมวด', 'คลิกช่องเพื่อกรองส่วนงาน') + '<div class="c3"></div>');
    var cells = [];
    hm.forEach(function (r, y) { CATS4.forEach(function (c, x) { var g = r[c]; cells.push([x, y, g && g.avg !== null ? g.avg : null, '<b>' + esc(r.name) + '</b> · ' + catLabel(c) + (g ? '<br>เฉลี่ย ' + fmt(g.avg, 2) + '<br>' + fmtInt(g.N) + ' คน · แดง ' + fmtInt(g.R) + ' (' + pct(g.R, g.N) + ')' : '<br>ไม่มีข้อมูล'), r.key]); }); });
    if (s3) chartHeat(holderIn(s3, 'c3'), CATS4.map(function (c) { return c === 'ALL' ? 'รวม' : c; }), hm.map(function (r) { return S.ds.divs[r.key].code; }), cells, { labelWidth: 90, onClick: function (cl) { S.F.div = cl[4]; S.F.ward = -1; buildFilters(); render(); } });
    // แนวโน้ม
    var s4 = section(g2, cardH('แนวโน้มคะแนนเฉลี่ยทุกรอบ', 'ตามตัวกรอง (ยกเว้นรอบ) · แถบสีพื้น = ช่วงเกณฑ์') + '<div class="c4"></div>');
    chartLine(holderIn(s4, 'c4'), ri.map(roundLabel), CATS4.map(function (c) {
      return { name: c === 'ALL' ? 'รวม' : c, color: CH.cat(c), bold: c === 'ALL', data: ri.map(function (r) { var d = dist(personScores(catRows(c, r))); return d.avg === null ? null : Math.round(d.avg * 100) / 100; }) };
    }), { height: Math.max(300, hm.length * 30 + 90), bands: true });

    // treemap ส่วนงาน → หอ
    var tmDivs = groupStats(P, 'div');
    var tm = tmDivs.length < 2 ? groupStats(P, 'ward').map(function (w) { return { name: wardShort(w.key), value: w.N + w.INC, score: w.avg, red: w.R }; }) : tmDivs.map(function (g) {
      var wards = groupStats(g.members, 'ward');
      return { name: S.ds.divs[g.key].code, value: g.N + g.INC, score: g.avg, red: g.R, children: wards.map(function (w) { return { name: wardShort(w.key), value: w.N + w.INC, score: w.avg, red: w.R }; }) };
    });
    var s5 = section(box, cardH('แผนผังหน่วยงาน (Treemap)', 'ขนาด = จำนวนคน · สี = คะแนนเฉลี่ยตามเกณฑ์ · คลิกส่วนงานเพื่อซูมดูรายหอ') + '<div class="c5"></div>');
    chartTreemap(holderIn(s5, 'c5'), tm, { height: 420 });
    // box plot
    var bxBy = tmDivs.length < 2 ? 'ward' : 'div';
    var bx = groupStats(P, bxBy).filter(function (g) { return g.N >= 3; }).map(function (g) { return { name: bxBy === 'ward' ? wardShort(g.key) : S.ds.divs[g.key].code, q: quantiles(g.scores), n: g.N }; });
    if (bx.length) {
      var s6 = section(box, cardH('การกระจายคะแนนรายคนใน' + (bxBy === 'ward' ? 'แต่ละหอ' : 'แต่ละส่วนงาน') + ' (Box plot)', 'กล่อง = ครึ่งกลางของคน · เส้นกลาง = มัธยฐาน · หนวด = ต่ำสุด/สูงสุด') + '<div class="c6"></div>');
      chartBox(holderIn(s6, 'c6'), bx, { min: 40 });
    }
  }
};

/* ================= จำแนกกลุ่ม ================= */
VIEWS.groups = {
  title: 'จำแนกตามตำแหน่ง / หน่วยงาน',
  render: function (box) {
    var by = S.groupBy || (S.F.pm >= 0 ? 'ps' : 'pm');
    var bar = section(box, '<div class="seg" role="tablist">' + [['pm', 'ตำแหน่งหลัก'], ['ps', 'ตำแหน่งย่อย'], ['div', 'ส่วนงาน'], ['ward', 'หอผู้ป่วย']].map(function (x) { return '<button class="' + (by === x[0] ? 'on' : '') + '" data-by="' + x[0] + '" type="button">' + x[1] + '</button>'; }).join('') + '</div>', 'flat');
    $$('.seg button', bar).forEach(function (b) { b.addEventListener('click', function () { S.groupBy = b.dataset.by; render(); }); });
    var rows = rowsWhere(), P = personScores(rows), gs = groupStats(P, by).filter(function (g) { return g.N + g.INC > 0; }), gk = groupKeyFn(by);
    var redRows = rows.filter(function (r) { return lv(r[R_SC]) === 'R'; });
    gs.forEach(function (g) {
      var wc = {}; Object.keys(g.members).forEach(function (k) { var p = g.members[k]; if (p.lv === 'R') wc[p.w] = (wc[p.w] || 0) + 1; });
      g.topWards = Object.keys(wc).sort(function (a, b) { return wc[b] - wc[a]; }).slice(0, 3).map(function (w) { return wardShort(Number(w)) + ' (' + wc[w] + ')'; }).join(', ');
      var cc = {}; redRows.forEach(function (r) { var p = P[r[R_EMP]]; if (p && gk.key(p) === g.key) cc[r[R_COMP]] = (cc[r[R_COMP]] || 0) + 1; });
      g.topComps = Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; }).slice(0, 3).map(function (c) { return compName(Number(c)) + ' (' + cc[c] + ')'; }).join(' · ');
      g.redItems = Object.keys(cc).reduce(function (s, k) { return s + cc[k]; }, 0);
    });
    var shortName = function (g) { return by === 'ward' ? wardShort(g.key) : by === 'div' ? S.ds.divs[g.key].code : g.name; };
    var g2 = div(box, 'grid2');
    var s = section(g2, cardH('สัดส่วนระดับตาม' + gk.label, fmtInt(gs.length) + ' กลุ่ม') + '<div class="c1"></div>');
    chartLevels(holderIn(s, 'c1'), gs.map(function (g) { return { label: shortName(g) + ' (' + g.N + ')', R: g.R, Y: g.Y, G: g.G, INC: g.INC }; }), { labelWidth: by === 'ps' ? 210 : 150 });
    var bx = gs.filter(function (g) { return g.N >= 3; }).map(function (g) { return { name: shortName(g), q: quantiles(g.scores), n: g.N }; });
    var s2 = section(g2, cardH('การกระจายคะแนนรายคน', 'Box plot · กลุ่มที่มีอย่างน้อย 3 คน') + '<div class="c2"></div>');
    if (bx.length) chartBox(holderIn(s2, 'c2'), bx, { height: Math.max(300, gs.length * 36 + 60), min: 40 }); else holderIn(s2, 'c2').innerHTML = '<div class="empty">ข้อมูลน้อยเกินไป</div>';
    var s3 = section(box, cardH('คะแนนเฉลี่ยเทียบเกณฑ์', 'เส้นประ = เกณฑ์ ' + S.settings.RED_MAX + ' และ ' + S.settings.YELLOW_MAX) + '<div class="c3"></div>');
    chartBar(holderIn(s3, 'c3'), gs.filter(function (g) { return g.avg !== null; }).map(function (g) { return { name: g.name, short: shortName(g), value: Math.round(g.avg * 100) / 100, color: CH.lv(lv(g.avg)), tip: '<b>' + esc(g.name) + '</b><br>เฉลี่ย ' + fmt(g.avg, 2) + ' · ' + fmtInt(g.N) + ' คน<br>แดง ' + fmtInt(g.R) + ' · เขียว ' + fmtInt(g.G) }; }),
      { vertical: gs.length > 12, min: function (v) { return Math.max(0, Math.floor(v.min - 4)); }, max: 100, d: 2, thresholds: [{ v: S.settings.RED_MAX, label: String(S.settings.RED_MAX), color: CH.lv('R') }, { v: S.settings.YELLOW_MAX, label: String(S.settings.YELLOW_MAX), color: CH.lv('G') }] });
    var cols = [{ k: 'name', label: gk.label }].concat(levelsCols()).concat([
      { k: 'redItems', label: 'หัวข้อติด Gap', num: true, d: 0 },
      { k: 'topWards', label: 'หน่วยงานติด Gap สูงสุด 3 อันดับ', cls: 'wrap' },
      { k: 'topComps', label: 'หัวข้อติด Gap มากสุด', cls: 'wrap' }]);
    table(box, { title: 'ตารางสรุปตาม' + gk.label, rows: gs, cols: by === 'ward' ? cols.filter(function (c) { return c.k !== 'topWards'; }) : cols, exportName: 'สรุปตาม' + gk.label,
      sub: 'คลิกแถวเพื่อเจาะลึก · "ติด Gap" = หัวข้อที่คะแนนต่ำกว่า ' + S.settings.RED_MAX,
      onRow: function (g) {
        if (by === 'pm') { S.F.pm = g.key; S.F.ps = -1; S.groupBy = 'ps'; }
        else if (by === 'ps') { S.F.ps = g.key; S.F.pm = S.ds.posMain.indexOf(S.ds.posSub[g.key].main); S.groupBy = 'ward'; }
        else if (by === 'div') { S.F.div = g.key; S.F.ward = -1; S.groupBy = 'ward'; }
        else { S.F.ward = g.key; S.groupBy = 'pm'; }
        buildFilters(); render();
      } });
  }
};

/* ================= Gap ================= */
function idpFor(round, emp, comp) {
  var rid = S.ds.rounds[round] && S.ds.rounds[round].id, eid = empId(emp), cn = compName(comp);
  return S.idp.filter(function (x) { return String(x.round_id) === String(rid) && String(x['รหัสพนักงาน']) === String(eid) && x['Competency'] === cn; })[0];
}
function canEditIdp(r) {
  var u = S.user; if (u.role === 'ADMIN') return true; if (u.role === 'EXEC' || u.role === 'STAFF') return false;
  if (u.role === 'DIV_HEAD') return u.scope.indexOf(divShort(r[R_DIV])) >= 0;
  return u.scope.indexOf(wardShort(r[R_WARD])) >= 0;
}
VIEWS.gap = {
  title: 'วิเคราะห์ Gap: ใคร · อะไร · ที่ไหน',
  render: function (box) {
    var rows = rowsWhere(), P = personScores(rows), d = dist(P);
    var red = rows.filter(function (r) { return lv(r[R_SC]) === 'R'; });
    var valid = rows.filter(function (r) { var l = lv(r[R_SC]); return l === 'R' || l === 'Y' || l === 'G'; });
    var empRed = {}; red.forEach(function (r) { empRed[r[R_EMP]] = 1; });
    var nPlan = red.filter(function (r) { return idpFor(r[R_ROUND], r[R_EMP], r[R_COMP]); }).length;
    section(box, '<div class="stats">' +
      stat('คนที่ภาพรวมต่ำกว่าเกณฑ์', fmtInt(d.R), pct(d.R, d.N) + ' ของ ' + fmtInt(d.N) + ' คน', 'R') +
      stat('คนที่ติด Gap อย่างน้อย 1 หัวข้อ', fmtInt(Object.keys(empRed).length), pct(Object.keys(empRed).length, d.N) + ' ของผู้ถูกประเมิน') +
      stat('จำนวนหัวข้อที่ติด Gap', fmtInt(red.length), pct(red.length, valid.length) + ' ของหัวข้อที่ประเมินครบ') +
      stat('มีแผนพัฒนา (IDP) แล้ว', fmtInt(nPlan), pct(nPlan, red.length) + ' ของหัวข้อที่ติด Gap', nPlan === red.length ? 'G' : 'Y') +
      stat('ประเมินไม่ครบ', fmtInt(d.INC), 'คน (ไม่นับรวมในสี)', 'INC') + '</div>', 'flat');
    var g2 = div(box, 'grid2');
    var cc = {}, tot = {}; red.forEach(function (r) { cc[r[R_COMP]] = (cc[r[R_COMP]] || 0) + 1; }); valid.forEach(function (r) { tot[r[R_COMP]] = (tot[r[R_COMP]] || 0) + 1; });
    var topC = Object.keys(cc).map(Number).sort(function (a, b) { return cc[b] - cc[a]; }).slice(0, 15);
    var s1 = section(g2, cardH('อะไร: หัวข้อที่ติด Gap มากที่สุด', 'จำนวนคนที่ต่ำกว่าเกณฑ์ (15 อันดับ)') + '<div class="c1"></div>');
    if (topC.length) chartBar(holderIn(s1, 'c1'), topC.map(function (c) { return { name: compName(c), short: trunc(compName(c), 34), value: cc[c], color: CH.lv('R'), tip: '<b>' + esc(compName(c)) + '</b> (' + compCat(c) + ')<br>ติด Gap ' + cc[c] + ' จาก ' + tot[c] + ' คน (' + pct(cc[c], tot[c]) + ')' }; }), { d: 0, labelWidth: 200 });
    else holderIn(s1, 'c1').innerHTML = '<div class="empty">ไม่มีหัวข้อที่ติด Gap</div>';
    var dc = {}, dt = {}; red.forEach(function (r) { var k = S.ds.compDom[r[R_COMP]]; dc[k] = (dc[k] || 0) + 1; }); valid.forEach(function (r) { var k = S.ds.compDom[r[R_COMP]]; dt[k] = (dt[k] || 0) + 1; });
    var doms = Object.keys(dt).map(Number).sort(function (a, b) { return (dc[b] || 0) / dt[b] - (dc[a] || 0) / dt[a]; });
    var s2 = section(g2, cardH('ทำไม: ด้านที่ติด Gap', '% ของหัวข้อในด้านนั้นที่ต่ำกว่าเกณฑ์') + '<div class="c2"></div>');
    chartBar(holderIn(s2, 'c2'), doms.map(function (k) { return { name: S.ds.domains[k], value: Math.round((dc[k] || 0) / dt[k] * 1000) / 10, color: CH.col('brand'), tip: '<b>' + esc(S.ds.domains[k]) + '</b><br>' + fmt((dc[k] || 0) / dt[k] * 100, 1) + '% (' + (dc[k] || 0) + ' จาก ' + dt[k] + ' หัวข้อ-คน)' }; }), { unit: '%', fmt: function (v) { return fmt(v, 1) + '%'; }, labelWidth: 190, height: Math.max(220, Math.min(topC.length, 15) * 28 + 30) });
    // ที่ไหน: หอ × ด้าน (% Gap)
    var ws = groupStats(P, 'ward');
    ws.forEach(function (g) { var c = {}; red.forEach(function (r) { if (r[R_WARD] === g.key) c[r[R_COMP]] = (c[r[R_COMP]] || 0) + 1; }); var t = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0]; g.topComp = t ? compName(Number(t)) + ' (' + c[t] + ')' : ''; g.redItems = Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0); g.pR = g.N ? g.R / g.N * 100 : 0; });
    var g3 = div(box, 'grid2');
    var s4 = section(g3, cardH('ที่ไหน: หอผู้ป่วย (Bubble)', 'แกนนอน = คะแนนเฉลี่ย · แกนตั้ง = % คนแดง · ขนาด = จำนวนคน · คลิกเพื่อกรองหอ') + '<div class="c4"></div>');
    chartScatter(holderIn(s4, 'c4'), ws.filter(function (g) { return g.avg !== null; }).map(function (g) { return { name: wardName(g.key), short: wardShort(g.key), key: g.key, x: Math.round(g.avg * 100) / 100, y: Math.round(g.pR * 10) / 10, size: g.N, color: CH.lv(lv(g.avg)), tip: '<b>' + esc(wardName(g.key)) + '</b><br>เฉลี่ย ' + fmt(g.avg, 2) + '<br>คนแดง ' + g.R + '/' + g.N + ' (' + fmt(g.pR, 1) + '%)' + (g.topComp ? '<br>ติดมากสุด: ' + esc(g.topComp) : '') }; }),
      { xName: 'คะแนนเฉลี่ย', yName: '% คนแดง', yUnit: '%', yMin: 0, lines: [{ xAxis: S.settings.RED_MAX, name: 'เกณฑ์ ' + S.settings.RED_MAX }], onClick: function (p) { S.F.ward = p.key; buildFilters(); render(); } });
    var wl = ws.filter(function (g) { return g.N > 0; }).sort(function (a, b) { return b.pR - a.pR; }).slice(0, 14);
    var dl = doms.slice(0, 8), hc = [];
    wl.forEach(function (g, y) { dl.forEach(function (k, x) { var n = 0, t = 0; rows.forEach(function (r) { if (r[R_WARD] !== g.key || S.ds.compDom[r[R_COMP]] !== k) return; var l = lv(r[R_SC]); if (l === 'R' || l === 'Y' || l === 'G') { t++; if (l === 'R') n++; } }); hc.push([x, y, t ? n / t * 100 : null, '<b>' + esc(wardName(g.key)) + '</b><br>' + esc(S.ds.domains[k]) + '<br>' + (t ? fmt(n / t * 100, 1) + '% ติด Gap (' + n + '/' + t + ')' : 'ไม่มีข้อมูล')]); }); });
    var s5 = section(g3, cardH('หอ × ด้าน: % หัวข้อที่ติด Gap', '14 หอที่ % คนแดงสูงสุด') + '<div class="c5"></div>');
    var pieces = [{ lt: 5, color: hexA(CH.lv('G'), 0.25), label: '< 5%' }, { gte: 5, lt: 15, color: hexA(CH.lv('R'), 0.25), label: '5–15%' }, { gte: 15, lt: 30, color: hexA(CH.lv('R'), 0.5), label: '15–30%' }, { gte: 30, color: hexA(CH.lv('R'), 0.88), label: '≥ 30%' }];
    chartHeat(holderIn(s5, 'c5'), dl.map(function (k) { return trunc(S.ds.domains[k], 16); }), wl.map(function (g) { return wardShort(g.key); }), hc, { pieces: pieces, d: 0, suffix: '%', labelWidth: 70 });
    table(box, { title: 'ที่ไหน: หน่วยงานที่มีสัดส่วนคนต่ำกว่าเกณฑ์สูง', rows: ws, sort: 'pR', limit: 15, exportName: 'Gap รายหอ',
      cols: [{ k: 'name', label: 'หอผู้ป่วย' }, { k: 'N', label: 'คน', num: true, d: 0 }, { k: 'R', label: 'คนแดง', num: true, d: 0 }, { k: 'pR', label: '% แดง', num: true }, { k: 'redItems', label: 'หัวข้อติด Gap', num: true, d: 0 }, { k: 'avg', label: 'คะแนนเฉลี่ย', num: true, html: function (r) { return lvCell(r.avg); } }, { k: 'topComp', label: 'หัวข้อติด Gap มากสุด', cls: 'wrap' }] });
    var list = red.map(function (r) { var i = idpFor(r[R_ROUND], r[R_EMP], r[R_COMP]); return { r: r, emp: empId(r[R_EMP]), name: empName(r[R_EMP]), pos: posSub(r[R_PS]), ward: wardShort(r[R_WARD]), cat: CAT_NAMES[r[R_CAT]], dis: disName(r[R_DIS]), comp: compName(r[R_COMP]), score: r[R_SC], idp: i ? i['สถานะ'] : '' }; });
    table(box, { title: 'ใคร: รายชื่อหัวข้อที่ต่ำกว่าเกณฑ์', sub: 'กด "แผน" เพื่อบันทึกสาเหตุและแผนพัฒนา (IDP)', rows: list, search: true, sort: 'score', dir: 1, exportName: 'รายชื่อติด Gap',
      cols: [{ k: 'name', label: 'บุคลากร', html: function (x) { return '<span class="who">' + esc(x.name) + '<small>' + esc(x.emp) + ' · ' + esc(x.pos) + '</small></span>'; }, sval: function (x) { return x.name + ' ' + x.emp; } }, { k: 'emp', label: '', html: function () { return ''; }, xval: function (x) { return x.emp; } },
        { k: 'ward', label: 'หอ' }, { k: 'cat', label: 'หมวด' }, { k: 'comp', label: 'หัวข้อ', cls: 'wrap', html: function (x) { return esc(x.comp) + (x.dis ? '<br><small class="muted">' + esc(x.dis) + '</small>' : ''); } }, { k: 'score', label: 'คะแนน', num: true, html: function (x) { return lvCell(x.score); } },
        { k: 'idp', label: 'IDP', html: function (x) { return (x.idp ? '<span class="chip info">' + esc(x.idp) + '</span> ' : '<span class="chip warn">ยังไม่มีแผน</span> ') + (canEditIdp(x.r) ? '<button class="btn xs ghost idp-btn" type="button">แผน</button>' : ''); } }],
      after: function (wrap, shown) { $$('.idp-btn', wrap).forEach(function (b) { b.addEventListener('click', function () { openIdp(shown[idxOfRow(b)].r); }); }); } });
  }
};

/* ================= รายหัวข้อ ================= */
VIEWS.items = {
  title: 'วิเคราะห์รายหัวข้อ (รายข้อ)',
  render: function (box) {
    var rows = rowsWhere();
    var st = itemStats(rows, function (r) { return r[R_COMP]; });
    st.forEach(function (o) { o.key = Number(o.key); o.name = compName(o.key); o.cat = compCat(o.key); o.dom = S.ds.domains[S.ds.compDom[o.key]]; });
    var detail = document.createElement('div');
    var g2 = div(box, 'grid-6-4');
    var s1 = section(g2, cardH('แผนภาพหัวข้อ: คะแนนเฉลี่ย × % ต่ำกว่าเกณฑ์', 'ขนาด = จำนวนคน · สี = หมวด · คลิกจุดเพื่อดูรายละเอียด') + '<div class="c1"></div>');
    chartScatter(holderIn(s1, 'c1'), st.filter(function (o) { return o.avg !== null; }).map(function (o) { return { name: o.name, key: o.key, x: Math.round(o.avg * 100) / 100, y: Math.round(o.pR * 10) / 10, size: o.N, color: CH.cat(o.cat), tip: '<b>' + esc(o.name) + '</b><br>' + o.cat + ' · ' + esc(o.dom) + '<br>เฉลี่ย ' + fmt(o.avg, 2) + ' · ' + o.N + ' คน<br>ต่ำกว่าเกณฑ์ ' + fmt(o.pR, 1) + '%' }; }),
      { xName: 'คะแนนเฉลี่ย', yName: '% ต่ำกว่าเกณฑ์', yUnit: '%', yMin: 0, height: 380, lines: [{ xAxis: S.settings.RED_MAX, name: String(S.settings.RED_MAX) }, { xAxis: S.settings.YELLOW_MAX, name: String(S.settings.YELLOW_MAX) }], onClick: function (p) { showItem(detail, p.key); detail.scrollIntoView({ behavior: 'smooth' }); } });
    var bins = histogram(st.filter(function (o) { return o.avg !== null; }).map(function (o) { return o.avg; }), 60, 100, 2.5);
    var s2 = section(g2, cardH('การกระจายคะแนนเฉลี่ยของหัวข้อ', 'จำนวนหัวข้อในแต่ละช่วงคะแนน') + '<div class="c2"></div>');
    chartHist(holderIn(s2, 'c2'), bins, { unit: 'หัวข้อ', height: 380, rangeLabel: function (b) { return fmt(b.lo, 1) + '–' + fmt(b.hi, 1); }, interval: 1, colorOf: function (b) { return CH.lv(lv(b.lo + 0.01)); } });
    table(box, { title: 'หัวข้อประเมินทั้งหมด (' + st.length + ')', sub: 'คลิกแถวเพื่อเปรียบเทียบหัวข้อนั้นระหว่างหอและตำแหน่ง', rows: st, search: true, sort: 'R', exportName: 'รายหัวข้อ',
      cols: [{ k: 'cat', label: 'หมวด' }, { k: 'dom', label: 'ด้าน', cls: 'sm' }, { k: 'name', label: 'หัวข้อ', cls: 'wrap' }].concat(levelsCols()),
      onRow: function (o) { showItem(detail, o.key); detail.scrollIntoView({ behavior: 'smooth' }); } });
    box.appendChild(detail);
  }
};
function showItem(holder, comp) {
  destroyChartsIn(holder); holder.innerHTML = '';
  var rows = rowsWhere({ comp: comp });
  var ws = itemStats(rows, function (r) { return r[R_WARD]; }).map(function (o) { o.key = Number(o.key); o.name = wardName(o.key); return o; }).sort(function (a, b) { return (b.avg || 0) - (a.avg || 0); });
  var s = section(holder, cardH(esc(compName(comp)), compCat(comp) + ' · คะแนนเฉลี่ยรายหอ เรียงจากมากไปน้อย') + '<div class="c1"></div>');
  chartBar(holderIn(s, 'c1'), ws.filter(function (o) { return o.avg !== null; }).map(function (o) { return { name: o.name, short: wardShort(o.key), value: Math.round(o.avg * 100) / 100, color: CH.lv(lv(o.avg)), tip: '<b>' + esc(o.name) + '</b><br>เฉลี่ย ' + fmt(o.avg, 2) + ' · ' + o.N + ' คน · แดง ' + o.R }; }),
    { vertical: true, min: function (v) { return Math.max(0, Math.floor(v.min - 5)); }, max: 100, d: 1, thresholds: [{ v: S.settings.RED_MAX, label: String(S.settings.RED_MAX), color: CH.lv('R') }] });
  table(holder, { title: 'เปรียบเทียบระหว่างหอ', rows: ws, cols: [{ k: 'name', label: 'หอผู้ป่วย' }].concat(levelsCols()), exportName: 'หัวข้อ-รายหอ', sort: 'avg' });
  var ps = itemStats(rows, function (r) { return r[R_PS]; }).map(function (o) { o.key = Number(o.key); o.name = groupKeyFn('ps').name(o.key); return o; });
  table(holder, { title: 'เปรียบเทียบระหว่างตำแหน่ง', rows: ps, cols: [{ k: 'name', label: 'ตำแหน่ง' }].concat(levelsCols()), exportName: 'หัวข้อ-รายตำแหน่ง', sort: 'avg' });
}
function destroyChartsIn(el) {
  S.charts = S.charts.filter(function (c) { var d = c.getDom(); if (el.contains(d)) { c.dispose(); return false; } return true; });
}

/* ================= SONE ================= */
VIEWS.sone = {
  title: 'SONE รายโรค และเปรียบเทียบระหว่างตึก',
  render: function (box) {
    var rows = rowsWhere({ cat: 'SONE' });
    if (!rows.length) { section(box, '<div class="empty">ไม่มีข้อมูล SONE ตามตัวกรองนี้</div>'); return; }
    var byDis = groupBy(rows, function (r) { return r[R_DIS]; });
    var list = Object.keys(byDis).map(Number).map(function (k) {
      var d = dist(personScores(byDis[k], 'SONE')), w = {}; byDis[k].forEach(function (r) { w[r[R_WARD]] = 1; });
      d.key = k; d.name = disName(k); d.grp = S.ds.groups[S.ds.disGrp[k]]; d.wards = Object.keys(w).map(function (x) { return wardShort(Number(x)); }).join(', '); d.nW = Object.keys(w).length; return d;
    }).sort(function (a, b) { return String(a.grp).localeCompare(String(b.grp), 'th') || b.N - a.N; });
    var detail = document.createElement('div');
    // heatmap กลุ่มโรค × กลุ่มโรคย่อย: โรค (แถว) × หอ (คอลัมน์) เฉพาะโรคที่ประเมินมากกว่า 1 ตึก
    var multi = list.filter(function (d) { return d.nW > 1 && d.N >= 5; }).slice(0, 18);
    var g2 = div(box, 'grid-6-4');
    var s0 = section(g2, cardH('คะแนนเฉลี่ยรายโรค', 'แท่งสีตามเกณฑ์ · คลิกเพื่อเทียบระหว่างตึก') + '<div class="c0"></div>');
    var srt = list.filter(function (d) { return d.avg !== null; }).sort(function (a, b) { return a.avg - b.avg; });
    chartBar(holderIn(s0, 'c0'), srt.map(function (d) { return { name: d.name, short: trunc(d.name, 30), key: d.key, value: Math.round(d.avg * 100) / 100, color: CH.lv(lv(d.avg)), tip: '<b>' + esc(d.name) + '</b><br>' + esc(d.grp) + '<br>เฉลี่ย ' + fmt(d.avg, 2) + ' · N ' + d.N + ' · แดง ' + d.R }; }),
      { min: function (v) { return Math.max(0, Math.floor(v.min - 5)); }, max: 100, d: 1, labelWidth: 190, onClick: function (i) { S.soneDis = srt[i].key; showDisease(detail, srt[i].key); detail.scrollIntoView({ behavior: 'smooth' }); } });
    var gcount = {}; list.forEach(function (d) { gcount[d.grp] = (gcount[d.grp] || 0) + d.N; });
    var s1 = section(g2, cardH('ผู้ถูกประเมินตามกลุ่มโรค', 'จำนวนคน-โรค') + '<div class="c1"></div>');
    var pal = ['--CFC', '--SFC', '--SONE', '--ALL', '--brand', '--muted'];
    chartDonut(holderIn(s1, 'c1'), Object.keys(gcount).sort(function (a, b) { return gcount[b] - gcount[a]; }).map(function (g, i) { return { name: g, value: gcount[g], color: cssVar(pal[Math.min(i, pal.length - 1)]) }; }), [fmtInt(list.length), 'โรค'], { height: Math.max(300, srt.length * 28 + 40) });
    if (multi.length) {
      var wset = {}; multi.forEach(function (d) { byDis[d.key].forEach(function (r) { wset[r[R_WARD]] = 1; }); });
      var wl = Object.keys(wset).map(Number).sort(function (a, b) { return wardShort(a).localeCompare(wardShort(b), 'th', { numeric: true }); }).slice(0, 24), cells = [];
      multi.forEach(function (d, y) { var byW = groupBy(byDis[d.key], function (r) { return r[R_WARD]; }); wl.forEach(function (w, x) { if (!byW[w]) return; var dd = dist(personScores(byW[w], 'SONE')); if (dd.avg !== null) cells.push([x, y, dd.avg, '<b>' + esc(d.name) + '</b> · ' + wardShort(w) + '<br>เฉลี่ย ' + fmt(dd.avg, 2) + ' · N ' + dd.N + ' · แดง ' + dd.R]); }); });
      var s2 = section(box, cardH('โรค × ตึก: คะแนนเฉลี่ย', 'เฉพาะโรคที่ประเมินมากกว่า 1 ตึก') + '<div class="c2"></div>');
      chartHeat(holderIn(s2, 'c2'), wl.map(wardShort), multi.map(function (d) { return trunc(d.name, 26); }), cells, { labelWidth: 170 });
    }
    table(box, { title: 'ผลประเมิน SONE รายโรค', sub: 'N = จำนวนคนที่ประเมินโรคนั้น · คลิกแถวเพื่อเทียบระหว่างตึก', rows: list, search: true, sort: null, exportName: 'SONE รายโรค',
      cols: [{ k: 'grp', label: 'กลุ่มโรค' }, { k: 'name', label: 'โรค', cls: 'wrap' }].concat(levelsCols()).concat([{ k: 'nW', label: 'ตึก', num: true, d: 0 }, { k: 'wards', label: 'หน่วยงาน', cls: 'wrap sm' }]),
      onRow: function (d) { S.soneDis = d.key; showDisease(detail, d.key); detail.scrollIntoView({ behavior: 'smooth' }); } });
    box.appendChild(detail);
    if (S.soneDis !== undefined && byDis[S.soneDis]) showDisease(detail, S.soneDis);
  }
};
function showDisease(holder, dis) {
  destroyChartsIn(holder); holder.innerHTML = '';
  var rows = rowsWhere({ cat: 'SONE', dis: dis }), byW = groupBy(rows, function (r) { return r[R_WARD]; });
  var ws = Object.keys(byW).map(Number).map(function (w) { var d = dist(personScores(byW[w], 'SONE')); d.key = w; d.name = wardName(w); return d; }).sort(function (a, b) { return (b.avg || 0) - (a.avg || 0); });
  var s = section(holder, cardH(esc(disName(dis)) + ': เปรียบเทียบระหว่างตึก', esc(roundLabel(S.F.round))) + '<div class="grid2"><div class="c1"></div><div class="c2"></div></div>');
  chartBar(holderIn(s, 'c1'), ws.filter(function (o) { return o.avg !== null; }).map(function (o) { return { name: o.name, short: wardShort(o.key), value: Math.round(o.avg * 100) / 100, color: CH.lv(lv(o.avg)), tip: '<b>' + esc(o.name) + '</b><br>เฉลี่ย ' + fmt(o.avg, 2) + ' · N ' + o.N }; }), { vertical: true, min: function (v) { return Math.max(0, Math.floor(v.min - 5)); }, max: 100, height: 280 });
  chartLevels(holderIn(s, 'c2'), ws.map(function (o) { return { label: wardShort(o.key) + ' (' + o.N + ')', R: o.R, Y: o.Y, G: o.G, INC: o.INC }; }), { height: 280, labelWidth: 90 });
  table(holder, { title: 'ตารางเปรียบเทียบระหว่างตึก', rows: ws, cols: [{ k: 'name', label: 'หอผู้ป่วย' }].concat(levelsCols()), exportName: 'SONE ' + disName(dis) + ' รายตึก', sort: 'avg' });
  var sk = itemStats(rows, function (r) { return r[R_COMP]; }).map(function (o) { o.key = Number(o.key); o.name = compName(o.key); return o; });
  table(holder, { title: 'ทักษะย่อยในโรคนี้', rows: sk, cols: [{ k: 'name', label: 'ทักษะ', cls: 'wrap' }].concat(levelsCols()), exportName: 'SONE ' + disName(dis) + ' ทักษะ', sort: 'pR' });
}

/* ================= เปรียบเทียบรอบ ================= */
VIEWS.compare = {
  title: 'เปรียบเทียบระหว่างรอบ: ใครเก่งขึ้น เก่งขึ้นเท่าไร เรื่องอะไร',
  render: function (box) {
    var ri = S.ds.roundIdx;
    if (ri.length < 2) { section(box, '<div class="empty">ต้องมีข้อมูลอย่างน้อย 2 รอบจึงจะเปรียบเทียบได้</div>'); return; }
    var B = S.cmpB !== undefined && ri.indexOf(S.cmpB) >= 0 ? S.cmpB : S.F.round;
    var A = S.cmpA !== undefined && ri.indexOf(S.cmpA) >= 0 ? S.cmpA : prevRound(B);
    if (A < 0) A = ri[0];
    var by = S.cmpBy || 'pm';
    var bar = section(box, '<div class="row-ctl"><label>รอบตั้งต้น (A)<select id="c-a">' + ri.map(function (i) { return opt(i, roundLabel(i), A); }).join('') + '</select></label>' +
      '<label>รอบเปรียบเทียบ (B)<select id="c-b">' + ri.map(function (i) { return opt(i, roundLabel(i), B); }).join('') + '</select></label>' +
      '<label>จำแนกตาม<select id="c-by">' + [['pm', 'ตำแหน่งหลัก'], ['ps', 'ตำแหน่งย่อย'], ['div', 'ส่วนงาน'], ['ward', 'หอผู้ป่วย']].map(function (x) { return opt(x[0], x[1], by); }).join('') + '</select></label>' +
      '<span class="muted sm">ใช้ตัวกรองด้านบนทั้งหมด ยกเว้น "รอบ" · จับคู่คนด้วยรหัสพนักงาน</span></div>', 'flat');
    $('#c-a', bar).addEventListener('change', function () { S.cmpA = Number(this.value); render(); });
    $('#c-b', bar).addEventListener('change', function () { S.cmpB = Number(this.value); render(); });
    $('#c-by', bar).addEventListener('change', function () { S.cmpBy = this.value; render(); });
    var rA = rowsWhere({ round: A }), rB = rowsWhere({ round: B });
    var PA = personScores(rA), PB = personScores(rB), band = S.settings.SAME_BAND;
    var m = []; Object.keys(PB).forEach(function (k) { var a = PA[k], b = PB[k]; if (a && b && a.s !== null && b.s !== null) m.push({ e: Number(k), a: a, b: b, d: b.s - a.s }); });
    if (!m.length) { section(box, '<div class="empty">ไม่มีบุคลากรที่มีผลทั้ง 2 รอบตามตัวกรองนี้</div>'); return; }
    var up = m.filter(function (x) { return x.d > band; }).length, down = m.filter(function (x) { return x.d < -band; }).length, same = m.length - up - down;
    var avgD = m.reduce(function (s, x) { return s + x.d; }, 0) / m.length;
    var outR = m.filter(function (x) { return x.a.lv === 'R' && x.b.lv !== 'R'; }).length, inR = m.filter(function (x) { return x.a.lv !== 'R' && x.b.lv === 'R'; }).length, wasR = m.filter(function (x) { return x.a.lv === 'R'; }).length;
    section(box, '<div class="stats">' +
      stat('คนที่เทียบได้ (มีทั้ง 2 รอบ)', fmtInt(m.length), esc(roundLabel(A)) + ' → ' + esc(roundLabel(B))) +
      stat('เก่งขึ้น', pct(up, m.length), fmtInt(up) + ' คน (เพิ่มเกิน ' + band + ' คะแนน)', 'G', '▲') +
      stat('คงที่', pct(same, m.length), fmtInt(same) + ' คน', 'Y', '●') +
      stat('ลดลง', pct(down, m.length), fmtInt(down) + ' คน', 'R', '▼') +
      stat('คะแนนเปลี่ยนเฉลี่ย', signed(avgD, 2), 'คะแนน') +
      stat('พ้นจากแดง', fmtInt(outR) + ' / ' + fmtInt(wasR), 'คนที่เคยแดงในรอบ A', 'G') +
      stat('ตกลงเป็นแดง', fmtInt(inR), 'คน', 'R') + '</div>', 'flat');
    var L = ['R', 'Y', 'G'], M = {}; L.forEach(function (a) { M[a] = { R: 0, Y: 0, G: 0 }; }); m.forEach(function (x) { M[x.a.lv][x.b.lv]++; });
    var g2 = div(box, 'grid2');
    var s1 = section(g2, cardH('การย้ายระดับ (Sankey)', 'เส้นเขียว = ขึ้นระดับ · เส้นแดง = ลงระดับ · ความหนา = จำนวนคน') + '<div class="c1"></div>');
    chartSankey(holderIn(s1, 'c1'), roundLabel(A), roundLabel(B), M, { height: 320 });
    var hb = histogram(m.map(function (x) { return x.d; }), -15, 15, 1.5);
    var s2 = section(g2, cardH('การกระจายคะแนนที่เปลี่ยนรายคน', 'ซ้าย = ลดลง · ขวา = เพิ่มขึ้น') + '<div class="c2"></div>');
    chartHist(holderIn(s2, 'c2'), hb, { height: 320, rangeLabel: function (b) { return signed(b.lo + 0.75, 1); }, interval: 3, colorOf: function (b) { return b.hi <= -band ? CH.lv('R') : b.lo >= band ? CH.lv('G') : CH.lv('INC'); } });
    var gk = groupKeyFn(by), G = {};
    m.forEach(function (x) { var k = gk.key(x.b); var o = G[k] = G[k] || { key: k, N: 0, sa: 0, sb: 0, up: 0, down: 0 }; o.N++; o.sa += x.a.s; o.sb += x.b.s; if (x.d > band) o.up++; else if (x.d < -band) o.down++; });
    var gl = Object.keys(G).map(Number).sort(gk.sort).map(function (k) { var o = G[k]; o.name = gk.name(k); o.short = by === 'ward' ? wardShort(k) : by === 'div' ? S.ds.divs[k].code : o.name; o.avgA = o.sa / o.N; o.avgB = o.sb / o.N; o.d = o.avgB - o.avgA; o.pUp = o.up / o.N * 100; o.pDown = o.down / o.N * 100; return o; });
    var g3 = div(box, 'grid2');
    var s3 = section(g3, cardH('Slope chart: ' + gk.label, 'เส้นเขียว = เพิ่มขึ้น · แดง = ลดลง') + '<div class="c3"></div>');
    chartSlope(holderIn(s3, 'c3'), gl.filter(function (o) { return o.N >= 3; }).slice(0, 24).map(function (o) { return { name: o.short, a: Math.round(o.avgA * 100) / 100, b: Math.round(o.avgB * 100) / 100 }; }), roundLabel(A), roundLabel(B));
    var s4 = section(g3, cardH('แนวโน้มทุกรอบ', 'คะแนนเฉลี่ยตามตัวกรอง') + '<div class="c4"></div>');
    chartLine(holderIn(s4, 'c4'), ri.map(roundLabel), CATS4.map(function (c) { return { name: c === 'ALL' ? 'รวม' : c, color: CH.cat(c), bold: c === 'ALL', data: ri.map(function (r) { var d = dist(personScores(rowsWhere({ round: r, cat: c }))); return d.avg === null ? null : Math.round(d.avg * 100) / 100; }) }; }), { height: Math.max(260, Math.min(gl.length, 24) * 22 + 60), bands: true });
    table(box, { title: 'การเปลี่ยนแปลงตาม' + gk.label, rows: gl, exportName: 'เปรียบเทียบรอบตาม' + gk.label, sort: 'd',
      cols: [{ k: 'name', label: gk.label }, { k: 'N', label: 'คนที่เทียบได้', num: true, d: 0 }, { k: 'avgA', label: 'เฉลี่ย ' + roundLabel(A), num: true, d: 2 }, { k: 'avgB', label: 'เฉลี่ย ' + roundLabel(B), num: true, d: 2 }, { k: 'd', label: 'เปลี่ยนแปลง', num: true, html: function (o) { return deltaHtml(o.d); }, xval: function (o) { return Math.round(o.d * 100) / 100; } }, { k: 'pUp', label: '% เก่งขึ้น', num: true }, { k: 'pDown', label: '% ลดลง', num: true }] });
    var ia = {}, ib = {};
    rA.forEach(function (r) { var l = lv(r[R_SC]); if (l === 'R' || l === 'Y' || l === 'G') ia[r[R_EMP] + '|' + r[R_COMP]] = r[R_SC]; });
    rB.forEach(function (r) { var l = lv(r[R_SC]); if (l === 'R' || l === 'Y' || l === 'G') ib[r[R_EMP] + '|' + r[R_COMP]] = r[R_SC]; });
    var ic = {}; Object.keys(ib).forEach(function (k) { if (!(k in ia)) return; var c = k.split('|')[1]; var o = ic[c] = ic[c] || { key: Number(c), N: 0, s: 0, up: 0, down: 0 }; var d = ib[k] - ia[k]; o.N++; o.s += d; if (d > band) o.up++; else if (d < -band) o.down++; });
    var il = Object.keys(ic).map(function (k) { var o = ic[k]; o.name = compName(o.key); o.cat = compCat(o.key); o.d = o.s / o.N; o.pUp = o.up / o.N * 100; return o; }).filter(function (o) { return o.N >= 5; });
    table(box, { title: 'เก่งขึ้นเรื่องอะไร: การเปลี่ยนแปลงรายหัวข้อ', sub: 'เฉพาะหัวข้อที่มีคนประเมินทั้ง 2 รอบอย่างน้อย 5 คน', rows: il, search: true, sort: 'd', exportName: 'เปรียบเทียบรายหัวข้อ',
      cols: [{ k: 'cat', label: 'หมวด' }, { k: 'name', label: 'หัวข้อ', cls: 'wrap' }, { k: 'N', label: 'คน', num: true, d: 0 }, { k: 'd', label: 'เปลี่ยนแปลงเฉลี่ย', num: true, html: function (o) { return deltaHtml(o.d); }, xval: function (o) { return Math.round(o.d * 100) / 100; } }, { k: 'pUp', label: '% เก่งขึ้น', num: true }] });
    var pl = m.map(function (x) { return { emp: empId(x.e), name: empName(x.e), pos: posSub(x.b.ps), ward: wardShort(x.b.w), a: x.a.s, b: x.b.s, d: x.d, la: x.a.lv, lb: x.b.lv, e: x.e }; });
    table(box, { title: 'รายบุคคล: คะแนนเปลี่ยนแปลง', rows: pl, search: true, sort: 'd', limit: 20, exportName: 'เปรียบเทียบรายบุคคล', sub: 'คลิกแถวเพื่อดูโปรไฟล์',
      cols: [{ k: 'emp', label: 'รหัส' }, { k: 'name', label: 'ชื่อ-นามสกุล' }, { k: 'pos', label: 'ตำแหน่ง' }, { k: 'ward', label: 'หอ' }, { k: 'a', label: roundLabel(A), num: true, html: function (o) { return lvCell(o.a); } }, { k: 'b', label: roundLabel(B), num: true, html: function (o) { return lvCell(o.b); } }, { k: 'd', label: 'เปลี่ยนแปลง', num: true, html: function (o) { return deltaHtml(o.d); }, xval: function (o) { return Math.round(o.d * 100) / 100; } }],
      onRow: function (o) { S.personEmp = o.e; route('person'); } });
  }
};

/* ================= รายบุคคล ================= */
VIEWS.person = {
  title: 'โปรไฟล์รายบุคคล',
  render: function (box) {
    var s = section(box, '<div class="row-ctl"><label class="grow">ค้นหาชื่อหรือรหัสพนักงาน<input type="search" id="p-q" placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร" autocomplete="off"></label></div><div id="p-res" class="res-list"></div>', 'flat');
    var holder = document.createElement('div'); box.appendChild(holder);
    var inScope = {}; S.ds.rows.forEach(function (r) { inScope[r[R_EMP]] = 1; });
    var idx = Object.keys(inScope).map(Number);
    $('#p-q', s).addEventListener('input', function () {
      var q = this.value.trim().toLowerCase(), res = $('#p-res', s);
      if (q.length < 2) { res.innerHTML = ''; return; }
      var hit = idx.filter(function (e) { var x = S.ds.emps[e]; return x && (String(x.name).toLowerCase().indexOf(q) >= 0 || String(x.id).indexOf(q) >= 0); }).slice(0, 20);
      res.innerHTML = hit.length ? hit.map(function (e) { return '<button class="res" type="button" data-e="' + e + '">' + esc(empName(e)) + ' <span class="muted sm">' + esc(empId(e)) + ' · ' + esc(S.ds.emps[e].pos) + '</span></button>'; }).join('') : '<span class="muted sm">ไม่พบ</span>';
      $$('.res', res).forEach(function (b) { b.addEventListener('click', function () { S.personEmp = Number(b.dataset.e); res.innerHTML = ''; showPerson(holder, S.personEmp); }); });
    });
    if (S.personEmp !== undefined && inScope[S.personEmp]) showPerson(holder, S.personEmp);
    else holder.innerHTML = '<div class="card empty">ค้นหาบุคลากรเพื่อดูผลประเมินทุกหมวดทุกรอบ</div>';
  }
};
/** โปรไฟล์บุคคล (ใช้ร่วมกับหน้า "ผลของฉัน") · opts.self = มุมมองบุคลากร */
function showPerson(holder, e, opts) {
  opts = opts || {};
  destroyChartsIn(holder); holder.innerHTML = '';
  var rows = S.ds.rows.filter(function (r) { return r[R_EMP] === e; });
  if (!rows.length) { holder.innerHTML = '<div class="card empty">ไม่มีข้อมูล</div>'; return; }
  var ri = S.ds.roundIdx.filter(function (r) { return rows.some(function (x) { return x[R_ROUND] === r; }); });
  var last = rows.reduce(function (a, r) { return !a || r[R_ROUND] >= a[R_ROUND] ? r : a; }, null);
  var moved = {}; rows.forEach(function (r) { moved[r[R_WARD]] = 1; });
  var per = ri.map(function (r) { var rr = rows.filter(function (x) { return x[R_ROUND] === r; }); return { r: r, p: personScores(rr, 'ALL', false)[e], ward: wardShort(rr[0][R_WARD]) }; });
  var rsel = S.personRound !== undefined && ri.indexOf(S.personRound) >= 0 ? S.personRound : ri[ri.length - 1];
  var cur = per.filter(function (x) { return x.r === rsel; })[0], pc = cur.p;
  var head = '<div class="phead"><span class="avatar">' + esc(initials(empName(e))) + '</span><div style="flex:1;min-width:220px"><h2>' + esc(empName(e)) + '</h2><div class="muted">' + esc(empId(e)) + ' · ' + esc(S.ds.emps[e].pos) + '</div><div class="muted">' + esc(wardName(last[R_WARD])) + ' · ' + esc(divName(last[R_DIV])) + '</div>' +
    (Object.keys(moved).length > 1 ? '<span class="chip warn">ย้ายหน่วยงานระหว่างรอบ</span>' : '') + '</div>' +
    '<label class="sm muted" style="display:grid;gap:4px">ดูรอบ<select id="pp-round">' + ri.map(function (r) { return opt(r, roundLabel(r), rsel); }).join('') + '</select></label></div>';
  var s = section(holder, head + '<div class="ring-row" style="margin-top:14px">' + CAT_NAMES.concat(['ALL']).map(function (c) { return '<div class="g-' + c + '"></div>'; }).join('') + '</div>');
  $('#pp-round', s).addEventListener('change', function () { S.personRound = Number(this.value); showPerson(holder, e, opts); });
  CAT_NAMES.concat(['ALL']).forEach(function (c) {
    var v = c === 'ALL' ? (pc ? pc.s : null) : (pc && pc.cats[c] !== undefined ? Math.round(pc.cats[c] * 100) / 100 : null);
    var has = c === 'ALL' || rows.some(function (x) { return x[R_ROUND] === rsel && x[R_CAT] === CAT_NAMES.indexOf(c); });
    if (!has) { $('.g-' + c, s).innerHTML = '<div class="empty sm">' + c + '<br>ไม่ได้ประเมิน</div>'; return; }
    chartGauge($('.g-' + c, s), v, (c === 'ALL' ? 'รวม' : c) + (v === null ? ' · ไม่ครบ' : ' · ' + LV_LABEL[lv(v)]), { height: 170 });
  });
  // เทียบค่าเฉลี่ยหอ (หัวหน้า: คำนวณจากชุดข้อมูล · บุคลากร: ใช้ค่า bench จากเซิร์ฟเวอร์)
  var bench = {};
  if (S.ds.bench) S.ds.bench.forEach(function (b) { bench[b[0] + '|' + b[1]] = { ward: b[2], all: b[4] }; });
  else {
    var acc = {}; S.ds.rows.forEach(function (r) { if (r[R_ROUND] !== rsel || r[R_WARD] !== cur.p.w) return; var l = lv(r[R_SC]); if (l === 'INC' || l === 'ERR') return; var k = r[R_ROUND] + '|' + r[R_COMP]; var o = acc[k] = acc[k] || [0, 0]; o[0] += r[R_SC]; o[1]++; });
    Object.keys(acc).forEach(function (k) { bench[k] = { ward: acc[k][0] / acc[k][1], all: null }; });
  }
  var mine = rows.filter(function (r) { return r[R_ROUND] === rsel; });
  var byDom = {}; mine.forEach(function (r) { var l = lv(r[R_SC]); if (l === 'INC' || l === 'ERR') return; var dn = r[R_CAT] === 2 ? 'SONE · ' + (disName(r[R_DIS]) || 'โรค') : S.ds.domains[S.ds.compDom[r[R_COMP]]]; var o = byDom[dn] = byDom[dn] || { s: 0, n: 0, w: 0, wn: 0, a: 0, an: 0 }; o.s += r[R_SC]; o.n++; var b = bench[r[R_ROUND] + '|' + r[R_COMP]]; if (b && b.ward !== null) { o.w += b.ward; o.wn++; } if (b && b.all !== null) { o.a += b.all; o.an++; } });
  var axes = Object.keys(byDom);
  var g2 = div(holder, 'grid2');
  var s1 = section(g2, cardH('สมรรถนะรายด้าน (Radar)', esc(roundLabel(rsel)) + ' · เส้นประ = ค่าเฉลี่ยหอ' + (S.ds.bench ? ' / ทั้งฝ่าย' : '')) + '<div class="c1"></div>');
  if (axes.length >= 3) {
    var series = [{ name: opts.self ? 'ของฉัน' : 'บุคคลนี้', color: CH.col('brand'), values: axes.map(function (a) { return Math.round(byDom[a].s / byDom[a].n * 100) / 100; }) },
      { name: 'เฉลี่ยหอ', color: CH.cat('SFC'), dashed: true, values: axes.map(function (a) { return byDom[a].wn ? Math.round(byDom[a].w / byDom[a].wn * 100) / 100 : null; }) }];
    if (S.ds.bench) series.push({ name: 'เฉลี่ยทั้งฝ่าย', color: CH.cat('ALL'), dashed: true, values: axes.map(function (a) { return byDom[a].an ? Math.round(byDom[a].a / byDom[a].an * 100) / 100 : null; }) });
    chartRadar(holderIn(s1, 'c1'), axes, series, { min: 50 });
  } else holderIn(s1, 'c1').innerHTML = '<div class="empty">ต้องมีอย่างน้อย 3 ด้านจึงจะแสดงกราฟเรดาร์</div>';
  var s2 = section(g2, cardH('คะแนนทุกรอบ', 'แถบสีพื้น = ช่วงเกณฑ์') + '<div class="c2"></div>');
  chartLine(holderIn(s2, 'c2'), per.map(function (x) { return roundLabel(x.r); }), CAT_NAMES.concat(['ALL']).map(function (c) { return { name: c === 'ALL' ? 'รวม' : c, color: CH.cat(c), bold: c === 'ALL', data: per.map(function (x) { if (!x.p) return null; var v = c === 'ALL' ? x.p.s : x.p.cats[c]; return v === undefined || v === null ? null : Math.round(v * 100) / 100; }) }; }), { height: 340, bands: true });
  var prev = ri.indexOf(rsel) > 0 ? ri[ri.indexOf(rsel) - 1] : -1;
  var prevMap = {}; rows.forEach(function (r) { if (r[R_ROUND] === prev) prevMap[r[R_COMP]] = r[R_SC]; });
  var items = mine.map(function (r) {
    var i = idpFor(r[R_ROUND], e, r[R_COMP]), b = bench[r[R_ROUND] + '|' + r[R_COMP]];
    return { r: r, cat: CAT_NAMES[r[R_CAT]], dis: disName(r[R_DIS]), comp: compName(r[R_COMP]), score: r[R_SC], lvk: lv(r[R_SC]), gap: r[R_GAP], prev: prevMap[r[R_COMP]], d: prevMap[r[R_COMP]] !== undefined ? r[R_SC] - prevMap[r[R_COMP]] : null, dup: r[R_DUP], idp: i ? i['สถานะ'] : '', wavg: b ? b.ward : null };
  });
  var bars = items.filter(function (x) { return x.lvk !== 'ERR'; }).sort(function (a, b) { return a.score - b.score; });
  var s3 = section(holder, cardH('คะแนนรายหัวข้อ ' + esc(roundLabel(rsel)), 'เรียงจากต่ำไปสูง · เส้นประ = เกณฑ์') + '<div class="c3"></div>');
  chartBar(holderIn(s3, 'c3'), bars.map(function (x) { return { name: x.comp, short: trunc((x.dis ? x.dis + ' · ' : '') + x.comp, 40), value: x.score, color: CH.lv(x.lvk === 'INC' ? 'INC' : x.lvk), tip: '<b>' + esc(x.comp) + '</b><br>' + x.cat + (x.dis ? ' · ' + esc(x.dis) : '') + '<br>คะแนน ' + fmt(x.score, 2) + ' (' + LV_LABEL[x.lvk] + ')' + (x.wavg !== null ? '<br>เฉลี่ยหอ ' + fmt(x.wavg, 2) : '') + (x.prev !== undefined ? '<br>รอบก่อน ' + fmt(x.prev, 2) : '') }; }),
    { min: 0, max: 100, d: 1, labelWidth: 230, thresholds: [{ v: S.settings.RED_MAX, label: String(S.settings.RED_MAX), color: CH.lv('R') }, { v: S.settings.YELLOW_MAX, label: String(S.settings.YELLOW_MAX), color: CH.lv('G') }] });
  table(holder, { title: 'รายละเอียดรายหัวข้อ ' + roundLabel(rsel), rows: items, sort: 'score', dir: 1, limit: 100, exportName: 'ผลรายบุคคล ' + empId(e),
    cols: [{ k: 'cat', label: 'หมวด' }, { k: 'comp', label: 'หัวข้อ', cls: 'wrap', html: function (x) { return esc(x.comp) + (x.dis ? '<br><small class="muted">' + esc(x.dis) + '</small>' : ''); } },
      { k: 'score', label: 'คะแนน', num: true, html: function (x) { return lvCell(x.score) + (x.lvk === 'INC' || x.lvk === 'ERR' ? ' ' + pill(x.lvk) : '') + (x.dup ? ' <span class="chip">แถวซ้ำ</span>' : ''); } },
      { k: 'wavg', label: 'เฉลี่ยหอ', num: true, d: 2 },
      { k: 'prev', label: 'รอบก่อน', num: true, html: function (x) { return x.prev === undefined ? '<span class="muted">–</span>' : fmt(x.prev, 2); } }, { k: 'd', label: 'เปลี่ยนแปลง', num: true, html: function (x) { return deltaHtml(x.d); } },
      { k: 'idp', label: 'IDP', html: function (x) { return (x.idp ? '<span class="chip info">' + esc(x.idp) + '</span> ' : '') + (x.lvk === 'R' && canEditIdp(x.r) ? '<button class="btn xs ghost idp-btn" type="button">แผน</button>' : ''); } }],
    after: function (wrap, shown) { $$('.idp-btn', wrap).forEach(function (b) { b.addEventListener('click', function () { openIdp(shown[idxOfRow(b)].r); }); }); } });
}

/* ================= คุณภาพข้อมูล ================= */
VIEWS.quality = {
  title: 'คุณภาพข้อมูล: ประเมินไม่ครบ · คะแนนผิดพลาด · แถวซ้ำ',
  render: function (box) {
    var sum = S.ds.roundIdx.map(function (ri) {
      var rows = rowsWhere({ round: ri }), o = { r: roundLabel(ri), rows: rows.length, INC: 0, ERR: 0, DUP: 0 }, pi = {}, pe = {};
      rows.forEach(function (r) { var l = lv(r[R_SC]); if (l === 'INC') { o.INC++; pi[r[R_EMP]] = 1; } if (l === 'ERR') { o.ERR++; pe[r[R_EMP]] = 1; } if (r[R_DUP]) o.DUP++; });
      o.pINC = Object.keys(pi).length; o.pERR = Object.keys(pe).length; o.ok = o.rows - o.INC - o.ERR; return o;
    });
    var s = section(box, cardH('ภาพรวมคุณภาพข้อมูลทุกรอบ', 'จำนวนแถวที่มีปัญหา (ตามตัวกรอง ยกเว้นรอบ)') + '<div class="c1"></div>');
    ec(holderIn(s, 'c1'), {
      grid: { left: 8, right: 16, top: 16, bottom: 36 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: axisStyle({ type: 'category', data: sum.map(function (o) { return o.r; }), splitLine: { show: false } }),
      yAxis: axisStyle({ type: 'value' }),
      series: [['INC', 'ประเมินไม่ครบ', CH.lv('INC')], ['ERR', 'คะแนนเกิน 100', CH.lv('ERR')], ['DUP', 'แถวซ้ำ (เฉลี่ยแล้ว)', CH.lv('Y')]].map(function (x) {
        return { name: x[1], type: 'bar', barMaxWidth: 36, itemStyle: { color: x[2], borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: CH.ink2(), fontSize: 11 }, data: sum.map(function (o) { return o[x[0]]; }) };
      })
    }, 280);
    table(box, { title: 'สรุปทุกรอบ', rows: sum, exportName: 'คุณภาพข้อมูลทุกรอบ', cols: [{ k: 'r', label: 'รอบ' }, { k: 'rows', label: 'แถวทั้งหมด', num: true, d: 0 }, { k: 'INC', label: 'แถวประเมินไม่ครบ', num: true, d: 0 }, { k: 'pINC', label: 'คน (ไม่ครบ)', num: true, d: 0 }, { k: 'ERR', label: 'แถวคะแนนผิดพลาด', num: true, d: 0 }, { k: 'pERR', label: 'คน (ผิดพลาด)', num: true, d: 0 }, { k: 'DUP', label: 'แถวซ้ำ', num: true, d: 0 }] });
    var rows = rowsWhere();
    var inc = {}; rows.forEach(function (r) { var l = lv(r[R_SC]), k = r[R_EMP] + '|' + r[R_CAT]; var o = inc[k] = inc[k] || { e: r[R_EMP], cat: CAT_NAMES[r[R_CAT]], w: r[R_WARD], ps: r[R_PS], n: 0, i: 0 }; o.n++; if (l === 'INC') o.i++; });
    var incL = Object.keys(inc).map(function (k) { return inc[k]; }).filter(function (o) { return o.i; }).map(function (o) { return { emp: empId(o.e), name: empName(o.e), pos: posSub(o.ps), ward: wardName(o.w), cat: o.cat, i: o.i, n: o.n, all: o.i === o.n ? 'ทุกหัวข้อ' : 'บางหัวข้อ' }; });
    table(box, { title: 'รายชื่อผู้ประเมินไม่ครบ (' + roundLabel(S.F.round) + ')', sub: 'คะแนนต่ำกว่า ' + S.settings.INC_MAX + '% ไม่นำมาเฉลี่ย · ใช้ติดตามให้ประเมินให้ครบ', rows: incL, search: true, sort: 'ward', dir: 1, exportName: 'ผู้ประเมินไม่ครบ',
      cols: [{ k: 'emp', label: 'รหัส' }, { k: 'name', label: 'ชื่อ-นามสกุล' }, { k: 'pos', label: 'ตำแหน่ง' }, { k: 'ward', label: 'หอ' }, { k: 'cat', label: 'หมวด' }, { k: 'i', label: 'หัวข้อที่ไม่ครบ', num: true, d: 0 }, { k: 'n', label: 'หัวข้อทั้งหมด', num: true, d: 0 }, { k: 'all', label: 'สถานะ' }] });
    var errL = rows.filter(function (r) { return lv(r[R_SC]) === 'ERR'; }).map(function (r) { return { emp: empId(r[R_EMP]), name: empName(r[R_EMP]), ward: wardShort(r[R_WARD]), cat: CAT_NAMES[r[R_CAT]], dis: disName(r[R_DIS]), comp: compName(r[R_COMP]), score: r[R_SC], gap: r[R_GAP] }; });
    table(box, { title: 'คะแนนผิดพลาด (เกิน 100%) สำหรับส่ง Vendor ตรวจสอบ', sub: 'ตัดออกจากการคำนวณทั้งหมด', rows: errL, search: true, sort: 'score', exportName: 'คะแนนผิดพลาด ส่ง Vendor',
      cols: [{ k: 'emp', label: 'รหัส' }, { k: 'name', label: 'ชื่อ-นามสกุล' }, { k: 'ward', label: 'หอ' }, { k: 'cat', label: 'หมวด' }, { k: 'dis', label: 'โรค' }, { k: 'comp', label: 'หัวข้อ', cls: 'wrap' }, { k: 'score', label: 'คะแนน', num: true, d: 2 }, { k: 'gap', label: 'Gap (Vendor)', num: true, d: 0 }] });
  }
};

/* ================= IDP ================= */
var IDP_STATUS = ['ยังไม่เริ่ม', 'กำลังพัฒนา', 'เสร็จแล้ว', 'ประเมินซ้ำแล้ว'];
var IDP_COLOR = { 'ยังไม่มีแผน': '--R', 'ยังไม่เริ่ม': '--SFC', 'กำลังพัฒนา': '--CFC', 'เสร็จแล้ว': '--SONE', 'ประเมินซ้ำแล้ว': '--G' };
function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function dueChip(due, st) {
  if (!due) return '<span class="muted">–</span>';
  var done = st === 'เสร็จแล้ว' || st === 'ประเมินซ้ำแล้ว', t = todayISO();
  var left = Math.round((new Date(due + 'T00:00:00') - new Date(t + 'T00:00:00')) / 86400000);
  var cls = done ? 'chip' : left < 0 ? 'chip bad' : left <= (S.settings.N_IDP_DAYS || 7) ? 'chip warn' : 'chip';
  return '<span class="' + cls + '">' + esc(due) + (done ? '' : left < 0 ? ' · เลย ' + (-left) + ' วัน' : left === 0 ? ' · วันนี้' : left <= 14 ? ' · อีก ' + left + ' วัน' : '') + '</span>';
}
function openIdp(r, existing) {
  var cur = existing || idpFor(r[R_ROUND], r[R_EMP], r[R_COMP]) || {};
  modal('แผนพัฒนารายบุคคล (IDP)', '<div class="note info"><b>' + esc(empName(r[R_EMP])) + '</b> <span class="muted">' + esc(empId(r[R_EMP])) + ' · หอ ' + esc(wardShort(r[R_WARD])) + ' · ' + esc(roundLabel(r[R_ROUND])) + '</span><div>' + esc(CAT_NAMES[r[R_CAT]]) + (disName(r[R_DIS]) ? ' · ' + esc(disName(r[R_DIS])) : '') + ' · ' + esc(compName(r[R_COMP])) + ' · ' + lvCell(r[R_SC]) + '</div></div>' +
    '<form id="idp-form" class="form"><label>สาเหตุ (ทำไมจึงติด Gap)<textarea id="i-cause" rows="3">' + esc(cur['สาเหตุ'] || '') + '</textarea></label>' +
    '<label>แผนพัฒนา<textarea id="i-plan" rows="3" placeholder="เช่น อบรม, Coaching, ฝึกปฏิบัติกับพี่เลี้ยง">' + esc(cur['แผนพัฒนา'] || '') + '</textarea></label>' +
    '<div class="form-row"><label>ผู้รับผิดชอบ<input id="i-owner" value="' + esc(cur['ผู้รับผิดชอบ'] || '') + '"></label><label>กำหนดเสร็จ<input type="date" id="i-due" value="' + esc(String(cur['กำหนดเสร็จ'] || '').slice(0, 10)) + '"></label>' +
    '<label>สถานะ<select id="i-status">' + IDP_STATUS.map(function (s) { return opt(s, s, cur['สถานะ'] || IDP_STATUS[0]); }).join('') + '</select></label></div>' +
    '<p class="muted sm">เมื่อใกล้ครบกำหนด ระบบจะแจ้งเตือนทางอีเมลถึงหัวหน้าและเจ้าของแผน (ถ้าตั้งอีเมลไว้)</p>' +
    '<div class="form-act">' + (cur.id ? '<button type="button" class="btn danger" id="i-del">ลบแผน</button>' : '') + '<button type="button" class="btn ghost" id="i-cancel">ยกเลิก</button><button class="btn" type="submit">บันทึกแผน</button></div></form>',
    function (b) {
      $('#i-cancel', b).addEventListener('click', closeModal);
      if ($('#i-del', b)) $('#i-del', b).addEventListener('click', function () { confirmBox('ลบแผนพัฒนานี้?', function () { busy(true, 'กำลังลบ...'); api('idpDelete', { id: cur.id }).then(function (res) { S.idp = res.rows; toast('ลบแผนแล้ว'); render(); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); }); }); });
      $('#idp-form', b).addEventListener('submit', function (ev) {
        ev.preventDefault();
        var btn = $('button[type=submit]', b); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
        api('idpSave', { id: cur.id, round: S.ds.rounds[r[R_ROUND]].id, emp: empId(r[R_EMP]), name: empName(r[R_EMP]), ward: wardShort(r[R_WARD]), div: divShort(r[R_DIV]), cat: CAT_NAMES[r[R_CAT]], comp: compName(r[R_COMP]), score: r[R_SC],
          cause: $('#i-cause', b).value, plan: $('#i-plan', b).value, owner: $('#i-owner', b).value, due: $('#i-due', b).value, status: $('#i-status', b).value })
          .then(function (res) { S.idp = res.rows; closeModal(); toast('บันทึกแผนแล้ว'); render(); })
          .catch(function (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'บันทึกแผน'; });
      });
    });
}
VIEWS.idp = {
  title: 'แผนพัฒนารายบุคคล (IDP) และติดตามการพัฒนา',
  render: function (box) {
    var rows = rowsWhere().filter(function (r) { return lv(r[R_SC]) === 'R'; });
    var list = rows.map(function (r) { var i = idpFor(r[R_ROUND], r[R_EMP], r[R_COMP]); return { r: r, emp: empId(r[R_EMP]), name: empName(r[R_EMP]), pos: posSub(r[R_PS]), ward: wardShort(r[R_WARD]), cat: CAT_NAMES[r[R_CAT]], comp: compName(r[R_COMP]), dis: disName(r[R_DIS]), score: r[R_SC], st: i ? i['สถานะ'] : 'ยังไม่มีแผน', plan: i ? i['แผนพัฒนา'] : '', cause: i ? i['สาเหตุ'] : '', owner: i ? i['ผู้รับผิดชอบ'] : '', due: i ? String(i['กำหนดเสร็จ'] || '').slice(0, 10) : '' }; });
    var cnt = {}; list.forEach(function (x) { cnt[x.st] = (cnt[x.st] || 0) + 1; });
    var t = todayISO(), over = list.filter(function (x) { return x.due && x.due < t && x.st !== 'เสร็จแล้ว' && x.st !== 'ประเมินซ้ำแล้ว'; }).length;
    var f = S.idpFilter || 'ทั้งหมด';
    var keys = ['ยังไม่มีแผน'].concat(IDP_STATUS);
    section(box, '<div class="stats">' + keys.map(function (k) { return stat(k, fmtInt(cnt[k] || 0), pct(cnt[k] || 0, list.length) + ' ของหัวข้อที่ติด Gap', k === 'ยังไม่มีแผน' ? 'R' : k === 'เสร็จแล้ว' || k === 'ประเมินซ้ำแล้ว' ? 'G' : 'Y'); }).join('') + stat('เลยกำหนด', fmtInt(over), 'ยังไม่เสร็จและเลยวันกำหนด', over ? 'R' : 'G') + '</div>', 'flat');
    var g2 = div(box, 'grid-6-4');
    var byW = groupBy(list, function (x) { return x.ward; }), wk = Object.keys(byW).sort(function (a, b) { return byW[b].length - byW[a].length; }).slice(0, 20);
    var s1 = section(g2, cardH('ความคืบหน้า IDP รายหอ', 'จำนวนหัวข้อที่ติด Gap แยกตามสถานะแผน (20 หอที่มากสุด)') + '<div class="c1"></div>');
    ec(holderIn(s1, 'c1'), {
      grid: { left: 8, right: 16, top: 8, bottom: 36 }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: axisStyle({ type: 'value', minInterval: 1 }), yAxis: axisStyle({ type: 'category', inverse: true, data: wk, splitLine: { show: false } }),
      series: keys.map(function (k) { return { name: k, type: 'bar', stack: 's', barMaxWidth: 20, itemStyle: { color: cssVar(IDP_COLOR[k]), borderColor: cssVar('--surface'), borderWidth: 1 }, data: wk.map(function (w) { return byW[w].filter(function (x) { return x.st === k; }).length; }) }; })
    }, Math.max(220, wk.length * 28 + 60));
    var s2 = section(g2, cardH('สถานะแผนทั้งหมด', fmtInt(list.length) + ' หัวข้อ') + '<div class="c2"></div>');
    chartDonut(holderIn(s2, 'c2'), keys.map(function (k) { return { name: k, value: cnt[k] || 0, color: cssVar(IDP_COLOR[k]) }; }), [pct(list.length - (cnt['ยังไม่มีแผน'] || 0), list.length, 0), 'มีแผนแล้ว'], { height: Math.max(220, wk.length * 28 + 60), onClick: function (n) { S.idpFilter = n; render(); } });
    var segS = section(box, '<div class="seg">' + ['ทั้งหมด'].concat(keys).concat(['เลยกำหนด']).map(function (k) { return '<button class="' + (f === k ? 'on' : '') + '" data-f="' + k + '" type="button">' + k + '</button>'; }).join('') + '</div>', 'flat');
    $$('.seg button', segS).forEach(function (b) { b.addEventListener('click', function () { S.idpFilter = b.dataset.f; render(); }); });
    var shown = f === 'ทั้งหมด' ? list : f === 'เลยกำหนด' ? list.filter(function (x) { return x.due && x.due < t && x.st !== 'เสร็จแล้ว' && x.st !== 'ประเมินซ้ำแล้ว'; }) : list.filter(function (x) { return x.st === f; });
    table(box, { title: 'หัวข้อที่ต่ำกว่าเกณฑ์ ' + roundLabel(S.F.round), sub: S.user.role === 'EXEC' ? 'ผู้บริหารดูได้อย่างเดียว' : 'กด "แผน" เพื่อบันทึกหรือแก้ไข · ส่งออก Excel ได้ครบทุกคอลัมน์', rows: shown, search: true, sort: 'ward', dir: 1, exportName: 'IDP',
      cols: [{ k: 'name', label: 'บุคลากร', html: function (x) { return '<span class="who">' + esc(x.name) + '<small>' + esc(x.emp) + ' · หอ ' + esc(x.ward) + '</small></span>'; }, sval: function (x) { return x.name + ' ' + x.emp + ' ' + x.ward; }, xval: function (x) { return x.name; } },
        { k: 'emp', label: 'รหัส', html: function () { return ''; }, cls: 'no-col' }, { k: 'ward', label: 'หอ', html: function () { return ''; }, cls: 'no-col' },
        { k: 'comp', label: 'หัวข้อ', cls: 'wrap', html: function (x) { return '<b>' + esc(x.cat) + '</b> · ' + esc(x.comp) + (x.dis ? '<br><small class="muted">' + esc(x.dis) + '</small>' : ''); }, xval: function (x) { return x.comp; } },
        { k: 'score', label: 'คะแนน', num: true, html: function (x) { return lvCell(x.score); } },
        { k: 'plan', label: 'แผนพัฒนา', cls: 'wrap sm', html: function (x) { return x.plan ? esc(x.plan) + (x.cause ? '<br><small class="muted">สาเหตุ: ' + esc(x.cause) + '</small>' : '') + (x.owner ? '<br><small class="muted">ผู้รับผิดชอบ: ' + esc(x.owner) + '</small>' : '') : '<span class="muted">–</span>'; } },
        { k: 'cause', label: 'สาเหตุ', html: function () { return ''; }, cls: 'no-col' }, { k: 'owner', label: 'ผู้รับผิดชอบ', html: function () { return ''; }, cls: 'no-col' },
        { k: 'due', label: 'กำหนดเสร็จ', html: function (x) { return dueChip(x.due, x.st); } },
        { k: 'st', label: 'สถานะ', html: function (x) { return '<span class="chip' + (x.st === 'ยังไม่มีแผน' ? ' warn' : x.st === 'เสร็จแล้ว' || x.st === 'ประเมินซ้ำแล้ว' ? ' ok' : ' info') + '">' + esc(x.st) + '</span>' + (canEditIdp(x.r) ? '<div style="margin-top:4px"><button class="btn xs ghost idp-btn" type="button">แผน</button></div>' : ''); } }],
      after: function (wrap, sh) {
        $$('th', wrap).forEach(function (th, i) { if (['emp', 'ward', 'cause', 'owner'].indexOf(th.dataset.k) >= 0) th.style.display = 'none'; });
        $$('td.no-col', wrap).forEach(function (td) { td.style.display = 'none'; });
        $$('.idp-btn', wrap).forEach(function (b) { b.addEventListener('click', function () { openIdp(sh[idxOfRow(b)].r); }); });
      } });
  }
};
