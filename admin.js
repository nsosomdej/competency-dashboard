/* admin.js — จัดการระบบ (HR Admin): นำเข้า · รอบ · ผู้ใช้ · การแจ้งเตือน · ตั้งค่า · Mapping/ประวัติ · ย้ายข้อมูลจากระบบเดิม */
VIEWS.admin = {
  title: 'จัดการระบบ', noFilters: true, noData: true, sub: 'สำหรับ HR Admin',
  render: function (box) {
    var tab = S.adminTab || (S.ds.rows.length ? 'import' : 'migrate');
    var tabs = [['import', 'นำเข้าข้อมูล'], ['rounds', 'รอบประเมิน'], ['users', 'ผู้ใช้และสิทธิ์'], ['notify', 'การแจ้งเตือน'], ['settings', 'ตั้งค่าเกณฑ์'], ['system', 'Mapping และประวัติ'], ['migrate', 'ย้ายข้อมูลจากระบบเดิม']];
    var s = section(box, '<div class="seg">' + tabs.map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-t="' + t[0] + '" type="button">' + t[1] + '</button>'; }).join('') + '</div>', 'flat');
    $$('.seg button', s).forEach(function (b) { b.addEventListener('click', function () { S.adminTab = b.dataset.t; render(); }); });
    var holder = document.createElement('div'); box.appendChild(holder);
    ADMIN[tab](holder);
  }
};
var ADMIN = {};
function reloadAll(msg) {
  busy(true, 'กำลังโหลดข้อมูลใหม่...');
  return loadDataset().then(function () { buildFilters(); render(); if (msg) toast(msg); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
}

/* ---------- นำเข้าข้อมูล ---------- */
var IMP = null;
ADMIN.import = function (box) {
  var rounds = S.rounds || [];
  var s = section(box, '<ol class="steps" style="margin-bottom:14px"><li>เลือกรอบการประเมิน (หรือเพิ่มรอบใหม่ เช่น 2569)</li><li>ลากไฟล์ Excel จาก Vendor มาวาง ได้ทั้ง 3 ไฟล์ (CFC / SFC / SONE) พร้อมกัน</li><li>ตรวจการ์ดสรุป QC และค่าใหม่ใน Mapping แล้วกด "ยืนยันบันทึกข้อมูล"</li></ol>' +
    '<div class="row-ctl"><label>รอบประเมิน<select id="im-round">' + opt('', '— เลือกรอบ —', '') + rounds.slice().reverse().map(function (r) { return opt(r.id, r.label + ' (' + r.id + ')', ''); }).join('') + opt('__new', '+ เพิ่มรอบใหม่', rounds.length ? '' : '__new') + '</select></label>' +
    '<label id="im-new-id" hidden>รหัสรอบ<input id="im-rid" placeholder="เช่น 2569 หรือ 2569-1"></label><label id="im-new-label" hidden>ชื่อรอบ<input id="im-rlabel" placeholder="เช่น ปี 2569"></label></div>' +
    '<div id="im-drop" class="drop" tabindex="0"><input type="file" id="im-file" accept=".xlsx,.xls" multiple hidden><b>ลากไฟล์มาวางที่นี่</b> หรือ <button type="button" class="btn sm" id="im-pick">เลือกไฟล์</button><div class="muted sm" style="margin-top:6px">ระบบอ่านคอลัมน์จากชื่อหัวคอลัมน์ (รหัสพนักงาน · ตำแหน่งงาน · แผนก/หอผู้ป่วย · Competency/SONE · คะแนนเฉลี่ย) และข้ามชีตวิเคราะห์ให้อัตโนมัติ</div></div>' +
    '<div id="im-out"></div><div id="im-prog">' + (S.lastImport ? '<div class="note ok">' + S.lastImport.msg + '</div>' : '') + '</div>');
  var keepRound = S.lastImport ? S.lastImport.round : '';
  S.lastImport = null;
  var sel = $('#im-round', s);
  function toggleNew() { var n = sel.value === '__new'; $('#im-new-id', s).hidden = !n; $('#im-new-label', s).hidden = !n; }
  if (keepRound) sel.value = keepRound;
  sel.addEventListener('change', toggleNew); toggleNew();
  $('#im-pick', s).addEventListener('click', function () { $('#im-file', s).click(); });
  $('#im-file', s).addEventListener('change', function () { readFiles(this.files); this.value = ''; });
  var drop = $('#im-drop', s);
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { readFiles(e.dataTransfer.files); });
  function roundChoice() {
    if (!sel.value) return null;
    if (sel.value !== '__new') { var r = rounds.filter(function (x) { return x.id === sel.value; })[0]; return { id: r.id, label: r.label }; }
    var id = $('#im-rid', s).value.trim(); if (!id) return null;
    return { id: id, label: $('#im-rlabel', s).value.trim() || ('ปี ' + id) };
  }
  function readFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    $('#im-prog', s).innerHTML = '';
    busy(true, 'กำลังอ่านไฟล์...');
    loadXLSX().then(function () {
      return Promise.all(files.map(function (f) { return f.arrayBuffer().then(function (buf) { return parseWorkbook(buf, f.name); }); }));
    }).then(function (results) {
      IMP = { cats: {} };
      var notes = [];
      results.forEach(function (res) {
        res.notes.forEach(function (n) { notes.push(n); });
        Object.keys(res.best).forEach(function (cat) {
          if (IMP.cats[cat]) notes.push('พบหมวด ' + cat + ' มากกว่า 1 ไฟล์ ใช้ไฟล์ ' + res.file);
          IMP.cats[cat] = { cat: cat, file: res.file, sheet: res.best[cat].sheet, parsed: res.best[cat], all: res.parsed.filter(function (p) { return p.ok; }) };
        });
      });
      Object.keys(IMP.cats).forEach(runQc);
      showPreview(notes);
    }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
  }
  function parseWorkbook(buf, fileName) {
    var head = XLSX.read(buf, { type: 'array', sheetRows: 15 });
    var cand = head.SheetNames.filter(function (n) { var r = XLSX.utils.sheet_to_json(head.Sheets[n], { header: 1, defval: '' }); return r.some(function (row) { return row.some(function (c) { return String(c).trim() === 'รหัสพนักงาน'; }); }); });
    var re = /(>|<|กราฟ|แยกตำแหน่ง|ภาพรวม|pivot|สรุป|80-90)/i;
    var main = cand.filter(function (n) { return !re.test(n); }), use = main.length ? main : cand, notes = [];
    if (!cand.length) notes.push(fileName + ': ไม่พบชีตที่มีหัวคอลัมน์ "รหัสพนักงาน"');
    if (main.length && cand.length > main.length) notes.push(fileName + ': ข้ามชีตวิเคราะห์ ' + cand.filter(function (n) { return re.test(n); }).join(', '));
    var wb = XLSX.read(buf, { type: 'array', sheets: use });
    var parsed = use.map(function (n) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', blankrows: false });
      var p = ImportCore.parseSheet(rows, n, fileName); p.sheet = n; p.file = fileName;
      if (!p.ok) notes.push(fileName + ' › ' + n + ': ' + p.reason);
      return p;
    });
    return { file: fileName, parsed: parsed, best: ImportCore.pickSheets(parsed), notes: notes };
  }
  function runQc(cat) {
    var c = IMP.cats[cat], q = ImportCore.qc(c.parsed.rows, cat, { incMax: S.settings.INC_MAX, redMax: S.settings.RED_MAX, yellowMax: S.settings.YELLOW_MAX });
    c.rows = q.rows; c.stats = q.stats; c.issues = q.issues;
  }
  function qcLine(n, label) { return '<div class="' + (n ? '' : 'muted') + '"><span class="chip ' + (n ? 'warn' : '') + '">' + fmtInt(n) + '</span> ' + label + '</div>'; }
  function existsRound(cat) { var r = roundChoice(); if (!r || !S.ds) return false; var ri = -1; S.ds.rounds.forEach(function (x, i) { if (x.id === r.id) ri = i; }); var ci = CAT_NAMES.indexOf(cat); return ri >= 0 && S.ds.rows.some(function (x) { return x[R_ROUND] === ri && x[R_CAT] === ci; }); }
  function yearWarn(file) {
    var m = String(file).match(/(20\d\d|25\d\d)/), r = roundChoice();
    if (!m || !r) return '';
    var y = Number(m[1]), be = y < 2500 ? y + 543 : y;
    return String(r.id).indexOf(String(be)) === 0 ? '' : '<div class="note sm">ชื่อไฟล์ระบุปี ' + m[1] + ' (พ.ศ. ' + be + ') แต่เลือกรอบ ' + esc(r.id) + ' ตรวจสอบรอบให้ถูกต้องก่อนบันทึก</div>';
  }
  function showPreview(notes) {
    var out = $('#im-out', s);
    var cats = Object.keys(IMP.cats).sort(function (a, b) { return CAT_NAMES.indexOf(a) - CAT_NAMES.indexOf(b); });
    if (!cats.length) { out.innerHTML = '<div class="note">ไม่พบข้อมูลที่นำเข้าได้' + (notes.length ? '<ul><li>' + notes.map(esc).join('</li><li>') + '</li></ul>' : '') + '</div>'; return; }
    var html = '<h3 style="margin-top:16px">ตรวจสอบก่อนบันทึก</h3>' + (notes.length ? '<div class="note"><ul><li>' + notes.map(esc).join('</li><li>') + '</li></ul></div>' : '');
    html += '<div class="imp-grid">' + cats.map(function (cat) {
      var c = IMP.cats[cat], t = c.stats, alt = c.all.length > 1;
      return '<div class="imp-card"><div class="imp-h"><span class="dot" style="--c:var(--' + cat + ')"></span><select class="im-cat" data-cat="' + cat + '" aria-label="หมวด">' + CAT_NAMES.map(function (x) { return opt(x, x, cat); }).join('') + '</select>' +
        '<span class="muted sm">' + esc(c.file) + ' › ' + esc(c.sheet) + '</span></div>' +
        (alt ? '<label class="sm">ชีต<select class="im-sheet" data-cat="' + cat + '">' + c.all.map(function (p, i) { return opt(i, p.sheet + ' (' + p.rows.length + ' แถว)', c.all.indexOf(c.parsed)); }).join('') + '</select></label>' : '') +
        '<div class="imp-stats"><span><b>' + fmtInt(t.rows) + '</b> แถว</span><span><b>' + fmtInt(t.persons) + '</b> คน</span><span><b>' + fmtInt(t.items) + '</b> หัวข้อ</span></div>' +
        '<div class="imp-stats"><span class="t-R">แดง ' + fmtInt(t.R) + '</span><span class="t-Y">เหลือง ' + fmtInt(t.Y) + '</span><span class="t-G">เขียว ' + fmtInt(t.G) + '</span></div>' +
        '<div class="imp-qc">' + qcLine(t.INC, 'ประเมินไม่ครบ (ไม่นำมาเฉลี่ย)') + qcLine(t.ERR, 'คะแนนเกิน 100 (ตัดออก)') + qcLine(t.DUP, 'แถวซ้ำ (ใช้ค่าเฉลี่ย)') +
        (c.parsed.skipped.length ? qcLine(c.parsed.skipped.length, 'แถวที่ข้าม (ไม่มีรหัส/คะแนน)') : '') + '</div>' +
        (existsRound(cat) ? '<div class="note sm">รอบนี้มีข้อมูล ' + cat + ' อยู่แล้ว ระบบจะแทนที่ทั้งชุด</div>' : '') + yearWarn(c.file) + '</div>';
    }).join('') + '</div>';
    html += '<div id="im-map"></div><div id="im-issues"></div>' +
      '<div class="form-act"><button class="btn ghost" id="im-cancel" type="button">ยกเลิก</button><button class="btn" id="im-go" type="button">ยืนยันบันทึกข้อมูล</button></div><div id="im-run"></div>';
    out.innerHTML = html;
    $$('.im-cat', out).forEach(function (el) { el.addEventListener('change', function () {
      var from = el.dataset.cat, to = el.value; if (from === to) return;
      var tmp = IMP.cats[to]; IMP.cats[to] = IMP.cats[from]; IMP.cats[to].cat = to; if (tmp) { IMP.cats[from] = tmp; tmp.cat = from; } else delete IMP.cats[from];
      Object.keys(IMP.cats).forEach(runQc); showPreview(notes);
    }); });
    $$('.im-sheet', out).forEach(function (el) { el.addEventListener('change', function () { var c = IMP.cats[el.dataset.cat]; c.parsed = c.all[Number(el.value)]; c.sheet = c.parsed.sheet; runQc(el.dataset.cat); showPreview(notes); }); });
    $('#im-cancel', out).addEventListener('click', function () { IMP = null; out.innerHTML = ''; });
    $('#im-go', out).addEventListener('click', function () {
      var rc = roundChoice();
      if (!rc) { toast('กรุณาเลือกรอบการประเมินก่อน', 'err'); sel.focus(); return; }
      var msg = 'บันทึกลงรอบ "' + rc.label + '" (' + rc.id + '): ' + cats.map(function (c) { return c + ' ' + fmtInt(IMP.cats[c].rows.length) + ' แถว' + (existsRound(c) ? ' (แทนที่ข้อมูลเดิม)' : ''); }).join(' · ');
      confirmBox(msg, commit, { safe: true, yes: 'บันทึกข้อมูล' });
    });
    var issues = []; cats.forEach(function (cat) { IMP.cats[cat].issues.forEach(function (i) { issues.push(Object.assign({ cat: cat }, i)); }); });
    if (issues.length) table($('#im-issues', out), { title: 'รายการที่ระบบแก้ไขอัตโนมัติ (QC)', rows: issues, search: true, limit: 20, exportName: 'QC นำเข้า',
      cols: [{ k: 'cat', label: 'หมวด' }, { k: 'type', label: 'ประเภท', html: function (x) { return x.type === 'DUP' ? '<span class="chip">แถวซ้ำ</span>' : pill(x.type); } }, { k: 'emp', label: 'รหัส' }, { k: 'name', label: 'ชื่อ' }, { k: 'comp', label: 'หัวข้อ', cls: 'wrap' }, { k: 'score', label: 'คะแนน', num: true, d: 2 }, { k: 'note', label: 'การจัดการ' }] });
    var mp = $('#im-map', out); mp.innerHTML = '<div class="muted sm">กำลังตรวจ Mapping...</div>';
    Promise.all(cats.map(function (cat) {
      var rows = IMP.cats[cat].rows, u = function (k) { var o = {}; rows.forEach(function (r) { if (r[k]) o[r[k]] = 1; }); return Object.keys(o); };
      return api('mappingPreview', { cat: cat, wards: u('ward'), positions: u('pos'), comps: u('comp'), diseases: cat === 'SONE' ? u('disease') : [] }).then(function (r) { return { cat: cat, m: r.missing }; });
    })).then(function (list) {
      var rows = [];
      list.forEach(function (x) {
        x.m.ward.forEach(function (w) { rows.push({ t: 'หอผู้ป่วย', raw: w[0], v: w[1] + ' (' + w[2] + ')' }); });
        x.m.pos.forEach(function (p) { rows.push({ t: 'ตำแหน่ง', raw: p[0], v: p[1] + ' › ' + p[2] }); });
        x.m.comp.forEach(function (c) { rows.push({ t: 'หัวข้อ ' + x.cat, raw: c[0], v: c[1] + ' · ด้าน ' + c[2] }); });
        x.m.dis.forEach(function (d) { rows.push({ t: 'โรค', raw: d[0] || '(ว่าง)', v: d[1] + ' · ' + d[2] }); });
      });
      var seen = {}; rows = rows.filter(function (r) { var k = r.t + r.raw; if (seen[k]) return false; seen[k] = 1; return true; });
      mp.innerHTML = '';
      if (!rows.length) { mp.innerHTML = '<div class="note ok sm">ค่าทั้งหมดมีอยู่ใน Mapping แล้ว</div>'; return; }
      table(mp, { title: 'ค่าใหม่ที่ยังไม่มีใน Mapping (' + rows.length + ')', sub: 'ระบบจะเพิ่มลงชีต Map_* ให้อัตโนมัติด้วยค่าที่เดาไว้ HR แก้ไขในชีตได้ภายหลัง', rows: rows, search: true, limit: 15, exportName: 'Mapping ใหม่',
        cols: [{ k: 't', label: 'ประเภท' }, { k: 'raw', label: 'ค่าในไฟล์', cls: 'wrap' }, { k: 'v', label: 'ระบบจะจับคู่เป็น', cls: 'wrap' }] });
    }).catch(function (e) { mp.innerHTML = '<div class="note sm">ตรวจ Mapping ไม่สำเร็จ: ' + esc(e.message) + '</div>'; });
  }
  sel.addEventListener('change', function () { if (IMP && Object.keys(IMP.cats).length) showPreview([]); });
  function commit() {
    var rc = roundChoice();
    if (!rc) { toast('กรุณากรอกรหัสรอบใหม่', 'err'); return; }
    var cats = Object.keys(IMP.cats), prog = $('#im-run', s), go = $('#im-go', s), CHK = 1500, done = [], notifyRes = null, mode = '';
    go.disabled = true;
    var chain = Promise.resolve();
    cats.forEach(function (cat, ci) {
      chain = chain.then(function () {
        var c = IMP.cats[cat], job;
        prog.innerHTML = '<div class="prog"><div style="width:0%"></div></div><div class="muted sm">กำลังบันทึก ' + cat + '...</div>';
        return api('importBegin', { roundId: rc.id, label: rc.label, cat: cat, fileName: c.file }).then(function (r) {
          job = r.job;
          var parts = []; for (var i = 0; i < c.rows.length; i += CHK) parts.push(c.rows.slice(i, i + CHK));
          var p = Promise.resolve();
          parts.forEach(function (part, i) { p = p.then(function () { return api('importChunk', { job: job, rows: part }); }).then(function () { $('.prog div', prog).style.width = Math.round((i + 1) / parts.length * 90) + '%'; }); });
          return p;
        }).then(function () {
          $('.muted', prog).textContent = 'กำลังยืนยันและรวมข้อมูล ' + cat + '...';
          return api('importCommit', { job: job, stats: c.stats, issues: c.issues, last: ci === cats.length - 1 });
        }).then(function (r) { done.push(cat + ' ' + fmtInt(r.rows) + ' แถว' + (r.replaced ? ' (แทนที่ ' + fmtInt(r.replaced) + ')' : '') + (r.mappingAdded ? ', Mapping ใหม่ ' + r.mappingAdded : '')); S.rounds = r.rounds; if (r.notify) notifyRes = r.notify; mode = r.mode; })
          .catch(function (e) { if (job) api('importCancel', { job: job }).catch(function () { }); throw e; });
      });
    });
    chain.then(function () {
      IMP = null;
      var msg = 'นำเข้าสำเร็จ: ' + esc(done.join(' · '));
      if (notifyRes) msg += '<br>' + (notifyRes.ok ? 'ส่งอีเมลแจ้งผลรอบใหม่แล้ว ' + notifyRes.sent + ' ฉบับ' : 'ส่งแจ้งเตือนไม่สำเร็จ: ' + esc(notifyRes.error));
      else if (mode === 'manual') msg += '<br>ส่งอีเมลแจ้งผลรอบใหม่ได้ที่แท็บ "รอบประเมิน" › ปุ่ม "แจ้งผล"';
      return loadDataset().then(function () {
        S.F.round = S.ds.roundIdx[S.ds.roundIdx.length - 1]; buildFilters(); busy(false);
        S.lastImport = { msg: msg, round: rc.id }; render(); toast('นำเข้าข้อมูลเรียบร้อย');
      });
    }).catch(function (e) { busy(false); prog.innerHTML = '<div class="note">นำเข้าไม่สำเร็จ: ' + esc(e.message) + (done.length ? '<br>บันทึกแล้ว: ' + done.map(esc).join(' · ') : '') + '</div>'; go.disabled = false; });
  }
};

/* ---------- รอบประเมิน ---------- */
ADMIN.rounds = function (box) {
  var h = div(box, '', '<div class="skeleton"></div>');
  api('roundsList').then(function (res) {
    h.innerHTML = '';
    var cnt = {}; S.ds.rows.forEach(function (r) { var id = S.ds.rounds[r[R_ROUND]].id; cnt[id] = (cnt[id] || 0) + 1; });
    var rows = res.rounds.map(function (r) { return { id: r.id, label: r.label, order: r.order, note: r.note, notified: r.notified, n: cnt[r.id] || 0 }; });
    table(h, { title: 'รอบการประเมิน', sub: '"ลำดับ" ใช้เรียงรอบในกราฟแนวโน้มและการเปรียบเทียบ · ปุ่ม "แจ้งผล" ส่งอีเมลแจ้งผลรอบนั้นถึงผู้ที่ตั้งอีเมลไว้', rows: rows, sort: 'order', dir: 1, exportName: 'รอบประเมิน',
      cols: [{ k: 'id', label: 'รหัสรอบ' }, { k: 'label', label: 'ชื่อรอบ' }, { k: 'order', label: 'ลำดับ', num: true, d: 0 }, { k: 'n', label: 'แถวคะแนน', num: true, d: 0 }, { k: 'notified', label: 'แจ้งผลแล้ว', cls: 'sm' }, { k: 'note', label: 'หมายเหตุ', cls: 'sm' },
        { k: 'x', label: '', html: function (r) { return '<button class="btn xs ghost r-not" type="button"' + (r.n ? '' : ' disabled') + '>แจ้งผล</button> <button class="btn xs ghost r-edit" type="button">แก้ไข</button> <button class="btn xs danger r-del" type="button">ลบ</button>'; } }],
      after: function (wrap, shown) {
        $$('.r-not', wrap).forEach(function (b) { b.addEventListener('click', function () { notifyRoundDialog(shown[idxOfRow(b)]); }); });
        $$('.r-edit', wrap).forEach(function (b) { b.addEventListener('click', function () { roundForm(shown[idxOfRow(b)]); }); });
        $$('.r-del', wrap).forEach(function (b) { b.addEventListener('click', function () {
          var r = shown[idxOfRow(b)];
          confirmBox('ลบรอบ "' + r.label + '" และคะแนนทั้งหมด ' + fmtInt(r.n) + ' แถว? การลบย้อนกลับไม่ได้', function () {
            busy(true, 'กำลังลบรอบ...');
            api('roundDelete', { id: r.id }).then(function (x) { S.rounds = x.rounds; return reloadAll('ลบรอบแล้ว'); }).catch(function (e) { busy(false); toast(e.message, 'err'); });
          }, { typeWord: r.id });
        }); });
      } });
  }).catch(function (e) { h.innerHTML = ''; toast(e.message, 'err'); });
  function roundForm(r) {
    modal('แก้ไขรอบ ' + r.id, '<form class="form" id="rf"><label>ชื่อรอบ<input id="rf-l" value="' + esc(r.label) + '"></label><label>ลำดับ<input type="number" id="rf-o" value="' + esc(r.order) + '"></label><label>หมายเหตุ<input id="rf-n" value="' + esc(r.note || '') + '"></label><div class="form-act"><button class="btn" type="submit">บันทึก</button></div></form>', function (b) {
      $('#rf', b).addEventListener('submit', function (e) { e.preventDefault(); busy(true, 'กำลังบันทึก...'); api('roundSave', { id: r.id, label: $('#rf-l', b).value, order: $('#rf-o', b).value, note: $('#rf-n', b).value }).then(function (x) { S.rounds = x.rounds; closeModal(); return reloadAll('บันทึกแล้ว'); }).catch(function (e2) { busy(false); toast(e2.message, 'err'); }); });
    });
  }
};
function notifyRoundDialog(r) {
  busy(true, 'กำลังเตรียมตัวอย่างอีเมล...');
  api('notifyRun', { type: 'ROUND', roundId: r.id, dry: true }).then(function (res) {
    busy(false);
    modal('แจ้งผลรอบ "' + r.label + '"', (r.notified ? '<div class="note">รอบนี้แจ้งไปแล้ว: ' + esc(r.notified) + '</div>' : '') +
      '<p>จะส่งอีเมล <b>' + res.count + ' ฉบับ</b> ถึงผู้ที่ตั้งและยืนยันอีเมลไว้ และเปิดรับการแจ้งเตือนประเภทนี้</p>' + mailPreviewHtml(res.preview) +
      '<div class="form-act"><button class="btn ghost" id="nr-no" type="button">ยกเลิก</button><button class="btn" id="nr-yes" type="button"' + (res.count ? '' : ' disabled') + '>ส่ง ' + res.count + ' ฉบับ</button></div>', function (b) {
      bindMailPreview(b, res.preview);
      $('#nr-no', b).addEventListener('click', closeModal);
      $('#nr-yes', b).addEventListener('click', function () { this.disabled = true; this.textContent = 'กำลังส่ง...'; api('notifyRun', { type: 'ROUND', roundId: r.id }).then(function (x) { closeModal(); toast(x.message); render(); }).catch(function (e) { toast(e.message, 'err'); }); });
    }, true);
  }).catch(function (e) { busy(false); toast(e.message, 'err'); });
}
function mailPreviewHtml(list) {
  if (!list || !list.length) return '<div class="note">ยังไม่มีผู้รับ (ผู้ใช้ต้องตั้งอีเมลในหน้า "อีเมลและการแจ้งเตือน" ก่อน)</div>';
  return '<div class="row-ctl"><label>ดูตัวอย่างฉบับ<select id="mp-pick">' + list.map(function (m, i) { return opt(i, m.name + ' · ' + (S.roles[m.role] || m.role) + ' · ' + m.to, 0); }).join('') + '</select></label></div><div class="mail-prev"><iframe title="ตัวอย่างอีเมล" sandbox=""></iframe></div>';
}
function bindMailPreview(b, list) {
  if (!list || !list.length) return;
  var show = function (i) { $('iframe', b).srcdoc = '<meta charset="utf-8"><div style="font-size:12px;color:#666;padding:8px 12px;font-family:Tahoma">หัวข้อ: <b>' + esc(list[i].subject) + '</b></div>' + list[i].html; };
  $('#mp-pick', b).addEventListener('change', function () { show(Number(this.value)); }); show(0);
}

/* ---------- ผู้ใช้และสิทธิ์ ---------- */
ADMIN.users = function (box) {
  var top = section(box, '<div class="row-ctl" style="margin:0"><button class="btn" id="u-add" type="button">+ เพิ่มผู้บริหาร / หัวหน้า / HR Admin</button><span class="muted sm" style="flex:1">บุคลากรที่มีผลประเมินเข้าระบบได้เองด้วยรหัส HIS (บทบาท "บุคลากร" สร้างอัตโนมัติ) · หัวหน้าส่วนงานใส่รหัสฝ่าย เช่น MED2 · หัวหน้าหอใส่รหัสหอ เช่น 19A (หลายค่าคั่นด้วย ,)</span></div>', 'flat');
  var holder = div(box, '', '<div class="skeleton"></div>');
  var roleF = S.userRoleF || 'heads';
  function draw(rows) {
    destroyChartsIn(holder); holder.innerHTML = '';
    var cnt = {}; rows.forEach(function (u) { cnt[u.role] = (cnt[u.role] || 0) + 1; });
    var seg = div(holder, 'seg sm', [['heads', 'ผู้ดูแล/หัวหน้า'], ['STAFF', 'บุคลากร'], ['all', 'ทั้งหมด']].map(function (x) { return '<button class="' + (roleF === x[0] ? 'on' : '') + '" data-f="' + x[0] + '" type="button">' + x[1] + ' (' + (x[0] === 'all' ? rows.length : x[0] === 'STAFF' ? (cnt.STAFF || 0) : rows.length - (cnt.STAFF || 0)) + ')</button>'; }).join(''));
    $$('button', seg).forEach(function (b) { b.addEventListener('click', function () { roleF = S.userRoleF = b.dataset.f; draw(rows); }); });
    var shown = rows.filter(function (u) { return roleF === 'all' || (roleF === 'STAFF' ? u.role === 'STAFF' : u.role !== 'STAFF'); });
    table(holder, { title: 'ผู้ใช้งาน', rows: shown, search: true, exportName: 'ผู้ใช้', sort: 'role', dir: 1,
      cols: [{ k: 'emp', label: 'รหัส' }, { k: 'name', label: 'ชื่อ' }, { k: 'role', label: 'บทบาท', val: function (u) { return S.roles[u.role] || u.role; } }, { k: 'scope', label: 'ขอบเขต' },
        { k: 'email', label: 'อีเมล', html: function (u) { return u.email ? esc(u.email) + (u.verified ? ' <span class="chip ok">✓</span>' : ' <span class="chip warn">ยังไม่ยืนยัน</span>') : '<span class="muted">–</span>'; } },
        { k: 'last', label: 'เข้าระบบล่าสุด', cls: 'sm' }, { k: 'active', label: 'สถานะ', html: function (u) { return u.active ? '<span class="chip ok">ใช้งาน</span>' : '<span class="chip">ปิด</span>'; } },
        { k: 'x', label: '', html: function (u) { return '<button class="btn xs ghost u-edit" type="button">แก้ไข</button>' + (u.emp === S.user.emp ? '' : ' <button class="btn xs danger u-del" type="button">ลบ</button>'); } }],
      after: function (wrap, sh) {
        $$('.u-edit', wrap).forEach(function (b) { b.addEventListener('click', function () { form(sh[idxOfRow(b)]); }); });
        $$('.u-del', wrap).forEach(function (b) { b.addEventListener('click', function () {
          var u = sh[idxOfRow(b)];
          confirmBox('ลบผู้ใช้ ' + u.emp + ' ' + (u.name || '') + '?' + (u.role === 'STAFF' ? ' (บุคลากรยังเข้าระบบใหม่ได้ ถ้ามีผลประเมิน)' : ''), function () {
            b.closest('tr').style.opacity = .4; busy(true, 'กำลังลบ...');
            api('userDelete', { emp: u.emp }).then(function (r) { draw(r.rows); toast('ลบแล้ว'); }).catch(function (e) { toast(e.message, 'err'); b.closest('tr').style.opacity = 1; }).then(function () { busy(false); });
          });
        }); });
      } });
  }
  function form(u) {
    var isNew = !u; u = u || { active: true, role: 'WARD_HEAD' };
    var scopeHint = '<datalist id="scope-list">' + S.ds.divs.map(function (d) { return '<option value="' + esc(d.code) + '">' + esc(d.name) + '</option>'; }).join('') + S.ds.wards.map(function (w) { return '<option value="' + esc(w.code) + '">' + esc(w.name) + '</option>'; }).join('') + '</datalist>';
    modal(isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + u.emp, '<form class="form" id="uf"><div class="form-row"><label>รหัสเจ้าหน้าที่ (7 หลัก)<input id="uf-e" inputmode="numeric" maxlength="8" required value="' + esc(u.emp || '') + '"' + (isNew ? '' : ' readonly') + '></label><label>ชื่อที่แสดง<input id="uf-n" value="' + esc(u.name || '') + '" placeholder="ว่างได้ ระบบใช้ชื่อจาก HIS"></label></div>' +
      '<div class="form-row"><label>บทบาท<select id="uf-r">' + Object.keys(S.roles).map(function (k) { return opt(k, S.roles[k], u.role); }).join('') + '</select></label>' +
      '<label>ขอบเขต (รหัสฝ่ายหรือรหัสหอ)<input id="uf-s" list="scope-list" value="' + esc(u.scope || '') + '" placeholder="เช่น 19A หรือ MED2"></label></div>' + scopeHint +
      '<div class="form-row"><label>อีเมล (ไม่บังคับ)<input type="email" id="uf-m" value="' + esc(u.email || '') + '"></label><label class="chk" style="align-self:end"><input type="checkbox" id="uf-v"' + (u.verified ? ' checked' : '') + '> ยืนยันอีเมลแทนผู้ใช้</label></div>' +
      '<label class="chk"><input type="checkbox" id="uf-a"' + (u.active ? ' checked' : '') + '> เปิดใช้งาน</label><label>หมายเหตุ<input id="uf-x" value="' + esc(u.note || '') + '"></label>' +
      '<p class="muted sm">เปลี่ยนบทบาท/ขอบเขต/ปิดใช้งาน มีผลทันที (ผู้ใช้ต้องเข้าสู่ระบบใหม่)</p>' +
      '<div class="form-act"><button class="btn" type="submit">บันทึก</button></div></form>', function (b) {
      var sync = function () { var r = $('#uf-r', b).value; $('#uf-s', b).closest('label').style.opacity = r === 'DIV_HEAD' || r === 'WARD_HEAD' ? 1 : .45; };
      $('#uf-r', b).addEventListener('change', sync); sync();
      $('#uf', b).addEventListener('submit', function (e) {
        e.preventDefault(); var btn = $('button[type=submit]', b); btn.disabled = true;
        api('userSave', { emp: $('#uf-e', b).value, name: $('#uf-n', b).value, role: $('#uf-r', b).value, scope: $('#uf-s', b).value, email: $('#uf-m', b).value, verified: $('#uf-v', b).checked, active: $('#uf-a', b).checked, note: $('#uf-x', b).value })
          .then(function (r) { closeModal(); draw(r.rows); toast('บันทึกแล้ว'); }).catch(function (e2) { toast(e2.message, 'err'); btn.disabled = false; });
      });
    });
  }
  $('#u-add', top).addEventListener('click', function () { form(); });
  api('usersList').then(function (r) { draw(r.rows); }).catch(function (e) { holder.innerHTML = ''; toast(e.message, 'err'); });
};

/* ---------- การแจ้งเตือน ---------- */
ADMIN.notify = function (box) {
  var st = S.settings, holder = div(box, '', '<div class="skeleton"></div>');
  api('notifyStatus').then(function (ns) {
    holder.innerHTML = '';
    section(holder, '<div class="stats">' + stat('ตัวตั้งเวลา', ns.trigger ? 'ทำงาน' : 'ยังไม่ตั้ง', ns.lastRun ? 'ตรวจล่าสุด ' + esc(ns.lastRun) : 'ยังไม่เคยทำงาน', ns.trigger ? 'G' : 'R') +
      stat('ผู้ใช้ที่ยืนยันอีเมลแล้ว', fmtInt(ns.withMail), 'จากผู้ใช้ทั้งหมด ' + fmtInt(ns.users) + ' คน') + stat('ส่งวันนี้ (บัญชีหลัก)', fmtInt(ns.sentToday), 'จำกัด ' + st.MAIL_DAILY_LIMIT + '/วัน แล้วสลับบัญชีสำรอง') +
      stat('โควตาอีเมลคงเหลือ', ns.quota === null ? '–' : fmtInt(ns.quota), 'ของบัญชีที่ติดตั้งระบบ') + '</div>' + (ns.trigger ? '' : '<div class="note">ยังไม่ได้ตั้งตัวตั้งเวลา การแจ้งเตือนอัตโนมัติจะยังไม่ทำงาน <button class="btn xs" id="nt-trig" type="button">ตั้งตัวตั้งเวลา</button></div>'), 'flat');
    var tg = $('#nt-trig', holder); if (tg) tg.addEventListener('click', function () { api('installTriggers').then(function (r) { toast(r.message); render(); }).catch(function (e) { toast(e.message, 'err'); }); });
    var on = function (k) { return String(st[k]).toUpperCase() === 'TRUE'; };
    var days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    var toSel = function (id, v) { return '<select id="' + id + '">' + [['heads,staff', 'หัวหน้า/ผู้บริหาร และบุคลากร'], ['heads', 'เฉพาะหัวหน้า/ผู้บริหาร'], ['staff', 'เฉพาะบุคลากร']].map(function (x) { return opt(x[0], x[1], String(v).replace(/\s/g, '')); }).join('') + '</select>'; };
    var s = section(holder, cardH('ตั้งค่าการแจ้งเตือนทางอีเมล', 'เปิด/ปิด และกำหนดเวลาได้ทุกประเภท') +
      '<div class="switch"><span class="t"><b>1. ผลประเมินรอบใหม่เข้าระบบแล้ว</b><small>สรุปผลตามขอบเขตถึงหัวหน้า/ผู้บริหาร และผลรายคนถึงบุคลากร</small></span><span style="display:flex;gap:8px;flex-wrap:wrap"><select id="n-ROUND_MODE" style="width:auto">' + [['off', 'ปิด'], ['manual', 'กดส่งเอง (แนะนำ)'], ['auto', 'ส่งอัตโนมัติหลังนำเข้า']].map(function (x) { return opt(x[0], x[1], st.N_ROUND_MODE); }).join('') + '</select>' + toSel('n-ROUND_TO', st.N_ROUND_TO) + '</span></div>' +
      '<div class="switch"><span class="t"><b>2. IDP ใกล้ครบกำหนด / เลยกำหนด</b><small>ตรวจทุกวัน · แจ้งล่วงหน้า <input id="n-IDP_DAYS" type="number" min="1" max="60" value="' + esc(st.N_IDP_DAYS) + '" style="width:64px;padding:2px 6px;display:inline-block"> วัน · เลยกำหนดแจ้งซ้ำทุก <input id="n-IDP_REPEAT" type="number" min="1" max="60" value="' + esc(st.N_IDP_REPEAT) + '" style="width:64px;padding:2px 6px;display:inline-block"> วัน</small></span><span style="display:flex;gap:8px;align-items:center">' + toSel('n-IDP_TO', st.N_IDP_TO) + '<label class="tog"><input type="checkbox" id="n-IDP_ON"' + (on('N_IDP_ON') ? ' checked' : '') + '><span></span></label></span></div>' +
      '<div class="switch"><span class="t"><b>3. สรุปรายเดือนถึงผู้บริหารและ HR Admin</b><small>ส่งทุกวันที่ <input id="n-MONTHLY_DAY" type="number" min="1" max="28" value="' + esc(st.N_MONTHLY_DAY) + '" style="width:64px;padding:2px 6px;display:inline-block"> ของเดือน</small></span><label class="tog"><input type="checkbox" id="n-MONTHLY_ON"' + (on('N_MONTHLY_ON') ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="switch"><span class="t"><b>4. หัวข้อต่ำกว่าเกณฑ์ที่ยังไม่มีแผน (ถึงหัวหน้า)</b><small>ทุกสัปดาห์ วัน<select id="n-NOPLAN_WEEKDAY" style="width:auto;display:inline-block;padding:2px 26px 2px 6px">' + days.map(function (d, i) { return opt(i, d, st.N_NOPLAN_WEEKDAY); }).join('') + '</select></small></span><label class="tog"><input type="checkbox" id="n-NOPLAN_ON"' + (on('N_NOPLAN_ON') ? ' checked' : '') + '><span></span></label></div>' +
      '<div class="form-row" style="margin-top:12px"><label class="form">เวลาส่งแจ้งเตือนประจำวัน<select id="n-HOUR">' + Array.apply(null, Array(24)).map(function (x, h) { return opt(h, ('0' + h).slice(-2) + ':00 น.', st.N_HOUR); }).join('') + '</select></label>' +
      '<label class="form">ส่งจากบัญชีหลักไม่เกินต่อวัน<input id="n-MAIL_LIMIT" type="number" min="1" max="1500" value="' + esc(st.MAIL_DAILY_LIMIT) + '"></label>' +
      '<label class="form">ลิงก์หน้าเว็บ (ใส่ในอีเมล)<input id="n-APP_URL" value="' + esc(st.APP_URL || '') + '" placeholder="https://nsosomdej.github.io/competency-dashboard/"></label></div>' +
      '<div class="form-act"><button class="btn" id="n-save" type="button">บันทึกการตั้งค่า</button></div>');
    if (!st.APP_URL && /github\.io/.test(location.host)) $('#n-APP_URL', s).value = location.origin + location.pathname;
    $('#n-save', s).addEventListener('click', function () {
      var p = { N_ROUND_MODE: $('#n-ROUND_MODE', s).value, N_ROUND_TO: $('#n-ROUND_TO', s).value, N_IDP_ON: $('#n-IDP_ON', s).checked, N_IDP_DAYS: Number($('#n-IDP_DAYS', s).value), N_IDP_REPEAT: Number($('#n-IDP_REPEAT', s).value), N_IDP_TO: $('#n-IDP_TO', s).value,
        N_MONTHLY_ON: $('#n-MONTHLY_ON', s).checked, N_MONTHLY_DAY: Number($('#n-MONTHLY_DAY', s).value), N_NOPLAN_ON: $('#n-NOPLAN_ON', s).checked, N_NOPLAN_WEEKDAY: Number($('#n-NOPLAN_WEEKDAY', s).value), N_HOUR: Number($('#n-HOUR', s).value), MAIL_DAILY_LIMIT: Number($('#n-MAIL_LIMIT', s).value), APP_URL: $('#n-APP_URL', s).value.trim() };
      if (!(p.N_MONTHLY_DAY >= 1 && p.N_MONTHLY_DAY <= 28)) { toast('วันที่ส่งสรุปรายเดือนต้องอยู่ระหว่าง 1–28', 'err'); return; }
      api('settingsSave', p).then(function (r) { S.settings = r.settings; toast('บันทึกการตั้งค่าการแจ้งเตือนแล้ว'); }).catch(function (e) { toast(e.message, 'err'); });
    });
    var s2 = section(holder, cardH('ทดลองและส่งทันที', 'ดูตัวอย่างอีเมลก่อนส่งจริง · การกดส่งทันทีไม่รอตามตารางเวลา') +
      '<div class="row-ctl"><label>ประเภท<select id="nr-type"><option value="IDP">IDP ใกล้ครบ/เลยกำหนด</option><option value="MONTHLY">สรุปรายเดือน</option><option value="NOPLAN">ต่ำกว่าเกณฑ์ยังไม่มีแผน</option><option value="ROUND">ผลรอบใหม่ (รอบล่าสุด)</option></select></label><button class="btn ghost" id="nr-prev" type="button">ดูตัวอย่าง</button><button class="btn" id="nr-send" type="button">ส่งทันที</button></div><div id="nr-out"></div>');
    var lastRound = (S.rounds || []).slice(-1)[0];
    var payload = function (dry) { var t = $('#nr-type', s2).value; return { type: t, dry: dry, roundId: lastRound ? lastRound.id : '' }; };
    $('#nr-prev', s2).addEventListener('click', function () {
      busy(true, 'กำลังเตรียมตัวอย่าง...');
      api('notifyRun', payload(true)).then(function (r) { var o = $('#nr-out', s2); o.innerHTML = '<p>จะส่ง <b>' + r.count + '</b> ฉบับ</p>' + mailPreviewHtml(r.preview); bindMailPreview(o, r.preview); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
    });
    $('#nr-send', s2).addEventListener('click', function () {
      confirmBox('ส่งการแจ้งเตือนประเภทนี้ทันที?', function () {
        busy(true, 'กำลังส่ง...');
        api('notifyRun', payload(false)).then(function (r) { toast(r.message || ('ส่งแล้ว ' + (r.sent || 0) + ' ฉบับ')); render(); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
      }, { safe: true, yes: 'ส่งทันที' });
    });
    ADMIN.senders(holder);
    table(holder, { title: 'ประวัติการส่งอีเมล (40 รายการล่าสุด)', rows: ns.log.map(function (x) { return { t: x[0], ty: x[1], emp: x[2], to: x[3], sub: x[4], ok: x[5], d: x[6] }; }), limit: 15, exportName: 'ประวัติการส่งอีเมล',
      cols: [{ k: 't', label: 'เวลา', cls: 'sm' }, { k: 'ty', label: 'ประเภท' }, { k: 'to', label: 'ผู้รับ' }, { k: 'sub', label: 'หัวข้อ', cls: 'wrap sm' }, { k: 'ok', label: 'ผล', html: function (x) { return '<span class="chip ' + (x.ok === 'ส่งแล้ว' ? 'ok' : 'bad') + '">' + esc(x.ok) + '</span>'; } }, { k: 'd', label: 'ส่งผ่าน / ข้อผิดพลาด', cls: 'sm wrap' }] });
  }).catch(function (e) { holder.innerHTML = ''; toast(e.message, 'err'); });
};
ADMIN.senders = function (box) {
  var s = section(box, cardH('บัญชีผู้ส่งสำรอง', 'ใช้เมื่อบัญชีหลักส่งครบโควตาวันนั้น') + '<p class="muted sm">Gmail ทั่วไปส่งได้ประมาณ 100 ผู้รับต่อวัน · วิธีเพิ่มบัญชีสำรอง: เข้า Gmail สำรอง › script.google.com › โปรเจกต์ใหม่ › วางโค้ด <code>Relay.gs</code> › ตั้งรหัสลับ › Deploy เป็น Web app (Execute as: Me · Who has access: Anyone) › นำ URL และรหัสลับมากรอกที่นี่</p><div class="row-ctl"><button class="btn ghost sm" id="s-add" type="button">+ เพิ่มบัญชีผู้ส่ง</button></div><div class="s-list"></div>');
  var holder = $('.s-list', s);
  function draw(rows) {
    holder.innerHTML = '';
    if (!rows.length) { holder.innerHTML = '<div class="muted sm">ยังไม่มีบัญชีสำรอง</div>'; return; }
    table(holder, { rows: rows, sort: 'order', dir: 1, noExport: true,
      cols: [{ k: 'order', label: 'ลำดับ', num: true, d: 0 }, { k: 'name', label: 'ชื่อบัญชี' }, { k: 'url', label: 'URL', cls: 'wrap sm' }, { k: 'active', label: 'สถานะ', html: function (x) { return x.active ? '<span class="chip ok">ใช้งาน</span>' : '<span class="chip">ปิด</span>'; } },
        { k: 'x', label: '', html: function () { return '<button class="btn xs ghost s-test" type="button">ทดสอบ</button> <button class="btn xs ghost s-edit" type="button">แก้ไข</button> <button class="btn xs danger s-del" type="button">ลบ</button>'; } }],
      after: function (wrap, shown) {
        $$('.s-test', wrap).forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; api('senderTest', { _row: shown[idxOfRow(b)]._row }).then(function (r) { toast(r.message); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { b.disabled = false; }); }); });
        $$('.s-edit', wrap).forEach(function (b) { b.addEventListener('click', function () { form(shown[idxOfRow(b)]); }); });
        $$('.s-del', wrap).forEach(function (b) { b.addEventListener('click', function () { var x = shown[idxOfRow(b)]; confirmBox('ลบบัญชีผู้ส่ง ' + x.name + '?', function () { api('senderDelete', { _row: x._row }).then(function (r) { draw(r.rows); }).catch(function (e) { toast(e.message, 'err'); }); }); }); });
      } });
  }
  function form(x) {
    x = x || { active: true, order: 1 };
    modal(x._row ? 'แก้ไขบัญชีผู้ส่ง' : 'เพิ่มบัญชีผู้ส่ง', '<form class="form" id="sf"><div class="form-row"><label>ลำดับ<input type="number" id="sf-o" value="' + esc(x.order) + '"></label><label>ชื่อบัญชี<input id="sf-n" value="' + esc(x.name || '') + '" placeholder="เช่น อีเมล Gmail สำรอง"></label></div>' +
      '<label>Web app URL (ลงท้าย /exec)<input id="sf-u" required value="' + esc(x.url || '') + '"></label><label>รหัสลับ' + (x._row ? ' (เว้นว่าง = ใช้ค่าเดิม)' : '') + '<input id="sf-s" type="password" autocomplete="off"' + (x._row ? '' : ' required') + '></label>' +
      '<label class="chk"><input type="checkbox" id="sf-a"' + (x.active ? ' checked' : '') + '> เปิดใช้งาน</label><div class="form-act"><button class="btn" type="submit">บันทึก</button></div></form>', function (b) {
      $('#sf', b).addEventListener('submit', function (e) {
        e.preventDefault();
        api('senderSave', { _row: x._row, order: $('#sf-o', b).value, name: $('#sf-n', b).value, url: $('#sf-u', b).value, secret: $('#sf-s', b).value, active: $('#sf-a', b).checked }).then(function (r) { closeModal(); draw(r.rows); toast('บันทึกแล้ว'); }).catch(function (e2) { toast(e2.message, 'err'); });
      });
    });
  }
  $('#s-add', s).addEventListener('click', function () { form(); });
  api('sendersList').then(function (r) { draw(r.rows); }).catch(function () { });
};

/* ---------- ตั้งค่าเกณฑ์ ---------- */
ADMIN.settings = function (box) {
  var st = S.settings;
  var f = [['APP_NAME', 'ชื่อระบบ', 'text'], ['INC_MAX', 'ต่ำกว่าค่านี้ = ประเมินไม่ครบ', 'number'], ['RED_MAX', 'ต่ำกว่าค่านี้ = แดง (ต่ำกว่าเกณฑ์)', 'number'], ['YELLOW_MAX', 'ไม่เกินค่านี้ = เหลือง (เท่ากับเกณฑ์)', 'number'], ['SAME_BAND', 'ผลต่างไม่เกิน ± เท่านี้ = คงที่', 'number'],
    ['W_CFC', 'น้ำหนัก CFC ในคะแนนรวม', 'number'], ['W_SFC', 'น้ำหนัก SFC ในคะแนนรวม', 'number'], ['W_SONE', 'น้ำหนัก SONE ในคะแนนรวม', 'number'], ['SESSION_HOURS', 'อยู่ในระบบได้ (ชั่วโมง)', 'number']];
  var on = function (k) { return String(st[k]).toUpperCase() === 'TRUE'; };
  var s = section(box, cardH('เกณฑ์และการคำนวณ', 'มีผลกับทุกหน้าทันทีหลังบันทึก') + '<form class="form" id="stf"><div class="form-row">' + f.map(function (x) { return '<label>' + x[1] + '<input id="st-' + x[0] + '" type="' + x[2] + '" step="any" value="' + esc(st[x[0]]) + '"></label>'; }).join('') + '</div>' +
    '<h3 style="margin-top:8px">การเข้าใช้ของบุคลากร</h3>' +
    '<div class="switch"><span class="t"><b>บุคลากรเข้าดูผลของตนเองได้</b><small>ใช้รหัส HIS · เห็นเฉพาะผลและ IDP ของตนเอง พร้อมค่าเฉลี่ยหอ/ทั้งฝ่ายเพื่อเทียบ</small></span><label class="tog"><input type="checkbox" id="st-STAFF_LOGIN"' + (on('STAFF_LOGIN') ? ' checked' : '') + '><span></span></label></div>' +
    '<div class="switch"><span class="t"><b>บุคลากรเห็นเฉพาะรอบล่าสุด</b><small>ปิด = เห็นทุกรอบและแนวโน้มของตนเอง</small></span><label class="tog"><input type="checkbox" id="st-STAFF_SEE_LAST_ONLY"' + (on('STAFF_SEE_LAST_ONLY') ? ' checked' : '') + '><span></span></label></div>' +
    '<div class="form-act"><button class="btn" type="submit">บันทึกการตั้งค่า</button></div></form>');
  $('#stf', s).addEventListener('submit', function (e) {
    e.preventDefault(); var p = {}; f.forEach(function (x) { var v = $('#st-' + x[0], s).value; p[x[0]] = x[2] === 'number' ? Number(v) : v; });
    p.STAFF_LOGIN = $('#st-STAFF_LOGIN', s).checked; p.STAFF_SEE_LAST_ONLY = $('#st-STAFF_SEE_LAST_ONLY', s).checked;
    if (!(p.INC_MAX < p.RED_MAX && p.RED_MAX <= p.YELLOW_MAX && p.YELLOW_MAX <= 100)) { toast('เกณฑ์ต้องเรียง: ประเมินไม่ครบ < แดง ≤ เหลือง ≤ 100', 'err'); return; }
    api('settingsSave', p).then(function (r) { S.settings = r.settings; toast('บันทึกการตั้งค่าแล้ว'); }).catch(function (e2) { toast(e2.message, 'err'); });
  });
};

/* ---------- Mapping & ประวัติ ---------- */
ADMIN.system = function (box) {
  var s = section(box, cardH('Mapping', '') + '<p class="sm">ชื่อหอ ฝ่าย ตำแหน่ง หัวข้อ และโรค จับคู่ผ่านชีต <code>Map_Ward</code> <code>Wards</code> <code>Divs</code> <code>Map_Position</code> <code>Map_Competency</code> <code>Map_Disease</code> ในไฟล์ฐานข้อมูล แก้ไขในชีตได้โดยตรง แล้วกด "ล้าง Cache และโหลดใหม่"</p>' +
    '<div class="row-ctl"><button class="btn ghost" id="sy-open" type="button">ลิงก์ไฟล์ฐานข้อมูล</button><button class="btn ghost" id="sy-sync" type="button">เพิ่มค่าที่ขาดลง Mapping</button><button class="btn ghost" id="sy-cache" type="button">ล้าง Cache และโหลดใหม่</button></div><div id="sy-msg"></div>');
  var h1 = div(box), h2 = div(box);
  $('#sy-open', s).addEventListener('click', function () { api('sheetUrl').then(function (r) { $('#sy-msg', s).innerHTML = '<div class="note ok sm">ไฟล์ฐานข้อมูล: <a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a></div>'; }).catch(function (e) { toast(e.message, 'err'); }); });
  $('#sy-sync', s).addEventListener('click', function () { busy(true, 'กำลังตรวจ Mapping...'); api('syncMappings').then(function (r) { $('#sy-msg', s).innerHTML = '<div class="note ok sm">เพิ่มแล้ว ' + r.added + ' รายการ (' + esc(r.detail) + ')</div>'; }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); }); });
  $('#sy-cache', s).addEventListener('click', function () { busy(true, 'กำลังล้าง Cache...'); api('clearCache').then(function () { return reloadAll('โหลดข้อมูลใหม่แล้ว'); }).catch(function (e) { busy(false); toast(e.message, 'err'); }); });
  api('logs').then(function (r) {
    table(h1, { title: 'ประวัติการนำเข้า', rows: r.imports.map(function (x) { return { t: x[0], by: x[1], r: x[2], c: x[3], f: x[4], n: x[5], p: x[6], i: x[7], e: x[8], d: x[9] }; }), limit: 10, exportName: 'Import log',
      cols: [{ k: 't', label: 'วันที่', cls: 'sm' }, { k: 'by', label: 'ผู้นำเข้า' }, { k: 'r', label: 'รอบ' }, { k: 'c', label: 'หมวด' }, { k: 'f', label: 'ไฟล์', cls: 'wrap sm' }, { k: 'n', label: 'แถว' }, { k: 'p', label: 'คน' }, { k: 'i', label: 'ไม่ครบ' }, { k: 'e', label: 'ผิดพลาด' }, { k: 'd', label: 'ซ้ำ' }] });
    table(h2, { title: 'ประวัติการเข้าสู่ระบบ (60 รายการล่าสุด)', rows: r.auth.map(function (x) { return { t: x[0], e: x[1], ev: x[2], d: x[3], ua: x[4] }; }), limit: 15, search: true, exportName: 'Auth log',
      cols: [{ k: 't', label: 'วันที่', cls: 'sm' }, { k: 'e', label: 'รหัส' }, { k: 'ev', label: 'เหตุการณ์', html: function (x) { return '<span class="chip ' + (x.ev === 'เข้าระบบ' ? 'ok' : /ผิด|ไม่มีสิทธิ์|ปิด/.test(x.ev) ? 'bad' : '') + '">' + esc(x.ev) + '</span>'; } }, { k: 'd', label: 'รายละเอียด' }, { k: 'ua', label: 'อุปกรณ์', cls: 'sm' }] });
  }).catch(function () { });
};

/* ---------- ย้ายข้อมูลจากระบบเดิม ---------- */
ADMIN.migrate = function (box) {
  var s = section(box, cardH('ย้ายข้อมูลจากระบบเดิม (v1.0.1)', 'ทำครั้งเดียวหลังติดตั้ง · ทำซ้ำได้ (เขียนทับด้วยข้อมูลล่าสุดของระบบเดิม)') +
    '<ol class="steps"><li>เจ้าของไฟล์ <b>Competency_Database</b> เดิม แชร์ไฟล์ให้บัญชีที่ติดตั้งระบบใหม่ (สิทธิ์ "ผู้มีสิทธิ์อ่าน" ก็พอ)</li><li>วางลิงก์ไฟล์ด้านล่าง แล้วกด "ตรวจก่อนย้าย"</li><li>ตรวจจำนวนแถว แล้วกด "ย้ายข้อมูล" และพิมพ์คำยืนยัน</li></ol>' +
    '<div class="row-ctl" style="margin-top:14px"><label class="grow">ลิงก์ Google Sheet ระบบเดิม<input id="mg-url" placeholder="https://docs.google.com/spreadsheets/d/.../edit"></label><button class="btn ghost" id="mg-check" type="button">ตรวจก่อนย้าย</button></div><div id="mg-out"></div>' +
    '<p class="muted sm">ระบบตัดข้อมูลทดสอบให้อัตโนมัติ: รอบ DEMO/DEMO-QC · หอ/ฝ่าย "ทดสอบระบบ" · รหัส 99xxxxx · ผู้ใช้เดิม (อีเมล) ไม่ย้าย เพราะระบบใหม่ใช้รหัสเจ้าหน้าที่ ให้เพิ่มหัวหน้าในแท็บ "ผู้ใช้และสิทธิ์"</p>');
  $('#mg-check', s).addEventListener('click', function () {
    var url = $('#mg-url', s).value.trim(); if (!url) { toast('กรุณาวางลิงก์', 'err'); return; }
    busy(true, 'กำลังอ่านระบบเดิม...');
    api('migrateCheck', { url: url }).then(function (r) {
      var names = { Rounds: 'รอบประเมิน', Scores: 'คะแนน', Wards: 'หอผู้ป่วย', Divs: 'ส่วนงาน', Map_Ward: 'Mapping หอ', Map_Div: 'Mapping ฝ่าย', Map_Position: 'Mapping ตำแหน่ง', Map_Competency: 'Mapping หัวข้อ', Map_Disease: 'Mapping โรค', IDP: 'แผนพัฒนา IDP', QC_Log: 'บันทึก QC', Import_Log: 'ประวัตินำเข้า' };
      var rows = Object.keys(names).map(function (k) { return { n: names[k], k: k, from: r.counts[k], skip: r.skipped[k] || 0, cur: r.current[k] }; });
      var o = $('#mg-out', s); o.innerHTML = '<div class="note ok">พบไฟล์ "' + esc(r.name) + '" · เกณฑ์เดิม: ' + esc(Object.keys(r.settings).map(function (k) { return k + '=' + r.settings[k]; }).join(', ')) + '</div>';
      table(o, { title: 'สิ่งที่จะย้าย', rows: rows, noExport: true, cols: [{ k: 'n', label: 'ข้อมูล' }, { k: 'from', label: 'จะย้าย (แถว)', num: true, d: 0 }, { k: 'skip', label: 'ตัดข้อมูลทดสอบ', num: true, d: 0 }, { k: 'cur', label: 'มีในระบบใหม่ตอนนี้ (จะถูกแทนที่)', num: true, d: 0 }] });
      var b = div(o, 'form-act', '<button class="btn" id="mg-run" type="button">ย้ายข้อมูล</button>');
      $('#mg-run', b).addEventListener('click', function () {
        confirmBox('เขียนทับข้อมูลคะแนน รอบ Mapping และ IDP ในระบบใหม่ด้วยข้อมูลจากระบบเดิม', function (w) {
          busy(true, 'กำลังย้ายข้อมูล (อาจใช้เวลา 1–2 นาที)...');
          api('migrateRun', { url: url, confirm: w }).then(function (x) { S.F = null; return reloadAll(x.message); }).then(function () { S.adminTab = 'import'; }).catch(function (e) { busy(false); toast(e.message, 'err'); });
        }, { typeWord: 'ย้ายข้อมูล', yes: 'ย้ายข้อมูล' });
      });
    }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
  });
};
