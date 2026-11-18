var ImportCore = (function () {
  var ANALYSIS_SHEET = /(>|<|กราฟ|แยกตำแหน่ง|ภาพรวม|pivot|สรุป|80-90)/i;
  var CFC_ITEMS = /(CPR|ฟื้นคืนชีพ|ติดเชื้อ)/i;

  function clean(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    s = s.replace(/[​-‍﻿ ]/g, ' ');
    s = s.replace(/^[ัิ-ฺ็-๎]+/, '');      // stray leading Thai marks
    s = s.replace(/ูู/g, 'ู').replace(/ุุ/g, 'ุ'); // ูู -> ู
    s = s.replace(/\s+/g, ' ').trim();
    if (s.toLowerCase() === 'nan') return '';
    return s;
  }

  function findHeader(rows) {
    for (var r = 0; r < Math.min(rows.length, 15); r++) {
      var row = rows[r] || [];
      for (var c = 0; c < row.length; c++) {
        if (clean(row[c]) === 'รหัสพนักงาน') return r;
      }
    }
    return -1;
  }

  function mapColumns(header) {
    var h = header.map(function (x) { return clean(x); });
    function exact(names) {
      for (var i = 0; i < names.length; i++) { var k = h.indexOf(names[i]); if (k >= 0) return k; }
      return -1;
    }
    function starts(prefix) {
      for (var i = 0; i < h.length; i++) if (h[i].indexOf(prefix) === 0) return i;
      return -1;
    }
    return {
      emp: exact(['รหัสพนักงาน']),
      name: exact(['ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ชื่อ นามสกุล', 'ชื่อ']),
      pos: exact(['ตำแหน่งงาน', 'ตำแหน่ง']),
      ward: exact(['แผนก/หอผู้ป่วย', 'หอผู้ป่วย', 'แผนก', 'หน่วยงาน']),
      div: exact(['ฝ่าย', 'ส่วนงาน']),
      comp: exact(['Competency', 'competency', 'สมรรถนะ']),
      disease: exact(['โรค']),
      sone: exact(['SONE', 'S-ONE']),
      gap: exact(['Gap', 'GAP']),
      score: starts('คะแนนเฉลี่ย')
    };
  }

  function required(cols) {
    var miss = [];
    if (cols.emp < 0) miss.push('รหัสพนักงาน');
    if (cols.pos < 0) miss.push('ตำแหน่งงาน');
    if (cols.ward < 0) miss.push('แผนก/หอผู้ป่วย');
    if (cols.score < 0) miss.push('คะแนนเฉลี่ย (%)');
    if (cols.comp < 0 && cols.sone < 0) miss.push('Competency หรือ SONE');
    return miss;
  }

  function guessCat(sheetName, fileName, cols, items) {
    if (cols.sone >= 0 && cols.disease >= 0) return 'SONE';
    var t = (sheetName + ' ' + fileName).toUpperCase();
    if (/SONE|S-ONE/.test(t)) return 'SONE';
    if (/CFC/.test(t)) return 'CFC';
    if (/SFC/.test(t)) return 'SFC';
    var all = items.length > 0 && items.every(function (x) { return CFC_ITEMS.test(x); });
    return all && items.length <= 3 ? 'CFC' : 'SFC';
  }

  /* rows: array of arrays (sheet_to_json header:1). returns {ok, cat, rows, miss, stats} */
  function parseSheet(rows, sheetName, fileName) {
    var hr = findHeader(rows);
    if (hr < 0) return { ok: false, reason: 'ไม่พบหัวคอลัมน์ "รหัสพนักงาน"' };
    var cols = mapColumns(rows[hr]);
    var miss = required(cols);
    if (miss.length) return { ok: false, reason: 'คอลัมน์ไม่ครบ: ' + miss.join(', '), miss: miss };
    var out = [], skipped = [], itemSet = {};
    for (var r = hr + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var empRaw = clean(row[cols.emp]);
      if (!empRaw) continue;
      var empNum = Number(empRaw);
      if (!isFinite(empNum)) { skipped.push({ row: r + 1, reason: 'รหัสพนักงานไม่ใช่ตัวเลข', value: empRaw }); continue; }
      var comp = cols.sone >= 0 ? clean(row[cols.sone]) : clean(row[cols.comp]);
      var sc = row[cols.score];
      var score = (sc === '' || sc === null || sc === undefined) ? NaN : Number(String(sc).replace(/[%,\s]/g, ''));
      if (!isFinite(score)) { skipped.push({ row: r + 1, reason: 'ไม่มีคะแนน', value: String(sc) }); continue; }
      if (!comp) { skipped.push({ row: r + 1, reason: 'ไม่มีชื่อหัวข้อประเมิน', value: '' }); continue; }
      itemSet[comp] = 1;
      out.push({
        emp: String(Math.round(empNum)),
        name: cols.name >= 0 ? clean(row[cols.name]) : '',
        pos: clean(row[cols.pos]),
        ward: clean(row[cols.ward]),
        div: cols.div >= 0 ? clean(row[cols.div]) : '',
        comp: comp,
        disease: cols.disease >= 0 ? clean(row[cols.disease]) : '',
        gap: cols.gap >= 0 && row[cols.gap] !== '' && row[cols.gap] !== null && row[cols.gap] !== undefined ? Number(row[cols.gap]) : '',
        score: Math.round(score * 100) / 100
      });
    }
    var cat = guessCat(sheetName, fileName || '', cols, Object.keys(itemSet));
    return { ok: true, cat: cat, rows: out, skipped: skipped, analysisLike: ANALYSIS_SHEET.test(sheetName) };
  }

  /* Pick one candidate sheet per category from a workbook's parsed sheets */
  function pickSheets(parsed) {
    var best = {};
    parsed.forEach(function (p) {
      if (!p.ok) return;
      var cur = best[p.cat];
      var score = (p.analysisLike ? 0 : 1e7) + p.rows.length;
      if (!cur || score > cur._score) { p._score = score; best[p.cat] = p; }
    });
    return best;
  }

  /* QC: merge duplicates (average), count statuses. settings: {incMax, redMax, yellowMax} */
  function qc(rows, cat, st) {
    var map = {}, order = [], dupCount = 0;
    rows.forEach(function (r) {
      var k = r.emp + '|' + r.disease + '|' + r.comp;
      if (map[k]) { map[k]._n++; map[k]._sum += r.score; dupCount++; }
      else { var c = Object.assign({}, r); c._n = 1; c._sum = r.score; c.qc = ''; map[k] = c; order.push(k); }
    });
    var out = [], stats = { rows: 0, persons: 0, items: 0, INC: 0, ERR: 0, R: 0, Y: 0, G: 0, DUP: dupCount }, emp = {}, it = {};
    var issues = [];
    order.forEach(function (k) {
      var c = map[k];
      if (c._n > 1) { c.score = Math.round(c._sum / c._n * 100) / 100; c.qc = 'DUP'; issues.push({ type: 'DUP', emp: c.emp, name: c.name, comp: c.comp, score: c.score, note: 'ซ้ำ ' + c._n + ' แถว ใช้ค่าเฉลี่ย' }); }
      delete c._n; delete c._sum;
      var s = statusOf(c.score, st);
      stats[s]++;
      if (s === 'INC') issues.push({ type: 'INC', emp: c.emp, name: c.name, comp: c.comp, score: c.score, note: 'ประเมินไม่ครบ ไม่นำมาเฉลี่ย' });
      if (s === 'ERR') issues.push({ type: 'ERR', emp: c.emp, name: c.name, comp: c.comp, score: c.score, note: 'คะแนนเกิน 100 ตัดออกจากการคำนวณ' });
      emp[c.emp] = 1; it[c.disease + '|' + c.comp] = 1;
      out.push(c);
    });
    stats.rows = out.length; stats.persons = Object.keys(emp).length; stats.items = Object.keys(it).length;
    return { rows: out, stats: stats, issues: issues };
  }

  function statusOf(score, st) {
    if (score > 100) return 'ERR';
    if (score < st.incMax) return 'INC';
    if (score < st.redMax) return 'R';
    if (score <= st.yellowMax) return 'Y';
    return 'G';
  }

  return { clean: clean, parseSheet: parseSheet, pickSheets: pickSheets, qc: qc, statusOf: statusOf, mapColumns: mapColumns };
})();
if (typeof module !== 'undefined') module.exports = ImportCore;
