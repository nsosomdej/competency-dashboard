/* engine.js — สูตรคำนวณทั้งหมดของ Dashboard (ชุดเดียวกับรุ่น 1.0.1 · ตรวจตัวเลขกับไฟล์ QC แล้ว)
 * ใช้ตัวแปรกลาง S (state) · โหลดใน Node ได้สำหรับชุดทดสอบ */
var S = (typeof S !== 'undefined' && S) || { token: null, user: null, settings: {}, ds: null, F: null, view: 'overview', idp: [], rounds: [] };
var R_ROUND = 0, R_CAT = 1, R_EMP = 2, R_WARD = 3, R_DIV = 4, R_PM = 5, R_PS = 6, R_COMP = 7, R_DIS = 8, R_SC = 9, R_GAP = 10, R_DUP = 11;
var CAT_NAMES = ['CFC', 'SFC', 'SONE'];
var LV_LABEL = { R: 'ต่ำกว่าเกณฑ์', Y: 'เท่ากับเกณฑ์', G: 'สูงกว่าเกณฑ์', INC: 'ประเมินไม่ครบ', ERR: 'ข้อมูลผิดพลาด' };
var LV_SHORT = { R: 'แดง', Y: 'เหลือง', G: 'เขียว', INC: 'ไม่ครบ', ERR: 'ผิดพลาด' };

function prepDataset(ds) {
  S.ds = ds;
  ds.compDom = ds.comps.map(function (c) { return typeof c.dom === 'number' ? c.dom : ds.domains.indexOf(c.dom); });
  ds.disGrp = ds.diseases.map(function (d) { return typeof d.grp === 'number' ? d.grp : ds.groups.indexOf(d.grp); });
  var has = {}; ds.rows.forEach(function (r) { has[r[R_ROUND]] = 1; });
  ds.roundIdx = ds.rounds.map(function (r, i) { return i; }).filter(function (i) { return has[i]; });
  var last = ds.roundIdx.length ? ds.roundIdx[ds.roundIdx.length - 1] : 0;
  if (!S.F) S.F = { round: last, cat: 'ALL', div: -1, ward: -1, pm: -1, ps: -1, dom: -1, grp: -1, dis: -1, incInc: false };
  if (ds.roundIdx.indexOf(S.F.round) < 0) S.F.round = last;
}
function lv(score) {
  var st = S.settings;
  if (score > 100) return 'ERR';
  if (score < st.INC_MAX) return 'INC';
  if (score < st.RED_MAX) return 'R';
  if (score <= st.YELLOW_MAX) return 'Y';
  return 'G';
}
function catIdx(c) { return c === 'ALL' ? -1 : CAT_NAMES.indexOf(c); }

/** กรองแถวตามฟิลเตอร์ (override ได้ เช่น {round: 1, cat: 'SONE'}) */
function rowsWhere(o) {
  var F = Object.assign({}, S.F, o || {}), ds = S.ds, ci = catIdx(F.cat);
  var rounds = F.rounds || (F.round === -1 ? null : [F.round]);
  var rset = null; if (rounds) { rset = {}; rounds.forEach(function (r) { rset[r] = 1; }); }
  return ds.rows.filter(function (r) {
    if (rset && !rset[r[R_ROUND]]) return false;
    if (ci >= 0 && r[R_CAT] !== ci) return false;
    if (F.div >= 0 && r[R_DIV] !== F.div) return false;
    if (F.ward >= 0 && r[R_WARD] !== F.ward) return false;
    if (F.pm >= 0 && r[R_PM] !== F.pm) return false;
    if (F.ps >= 0 && r[R_PS] !== F.ps) return false;
    if (F.dom >= 0 && ds.compDom[r[R_COMP]] !== F.dom) return false;
    if (F.grp >= 0 && (r[R_DIS] < 0 || ds.disGrp[r[R_DIS]] !== F.grp)) return false;
    if (F.dis >= 0 && r[R_DIS] !== F.dis) return false;
    if (F.comp >= 0 && F.comp !== undefined && r[R_COMP] !== F.comp) return false;
    return true;
  });
}
/** คะแนนรายคน → {emp: {e, s, lv, cats, w, d, pm, ps, inc, err, items}} */
function personScores(rows, catMode, incInc) {
  if (incInc === undefined) incInc = S.F ? S.F.incInc : false;
  var st = S.settings, W = [st.W_CFC || 1, st.W_SFC || 1, st.W_SONE || 1], P = {};
  rows.forEach(function (r) {
    var p = P[r[R_EMP]];
    if (!p) p = P[r[R_EMP]] = { e: r[R_EMP], sum: [0, 0, 0], n: [0, 0, 0], inc: 0, err: 0, items: 0, w: r[R_WARD], d: r[R_DIV], pm: r[R_PM], ps: r[R_PS], rd: r[R_ROUND] };
    if (r[R_ROUND] >= p.rd) { p.rd = r[R_ROUND]; p.w = r[R_WARD]; p.d = r[R_DIV]; p.pm = r[R_PM]; p.ps = r[R_PS]; }
    var l = lv(r[R_SC]); p.items++;
    if (l === 'ERR') { p.err++; return; }
    if (l === 'INC') { p.inc++; if (!incInc) return; }
    p.sum[r[R_CAT]] += r[R_SC]; p.n[r[R_CAT]]++;
  });
  Object.keys(P).forEach(function (k) {
    var p = P[k], tot = 0, wt = 0; p.cats = {};
    for (var c = 0; c < 3; c++) if (p.n[c]) { var m = p.sum[c] / p.n[c]; p.cats[CAT_NAMES[c]] = m; tot += m * W[c]; wt += W[c]; }
    p.s = wt ? Math.round(tot / wt * 100) / 100 : null;
    if (p.s === null) p.lv = p.inc ? 'INC' : 'ERR';
    else { p.lv = lv(p.s); if (p.lv === 'INC') p.lv = 'R'; }
  });
  return P;
}
function dist(P) {
  var d = { N: 0, R: 0, Y: 0, G: 0, INC: 0, ERR: 0, sum: 0, avg: null, total: 0, scores: [] };
  Object.keys(P).forEach(function (k) {
    var p = P[k]; d.total++; d[p.lv]++;
    if (p.s !== null) { d.N++; d.sum += p.s; d.scores.push(p.s); }
  });
  d.avg = d.N ? d.sum / d.N : null;
  return d;
}
function prevRound(r) { var i = S.ds.roundIdx.indexOf(r); return i > 0 ? S.ds.roundIdx[i - 1] : -1; }
function roundLabel(i) { return i >= 0 && S.ds.rounds[i] ? S.ds.rounds[i].label : '–'; }
function wardName(i) { var w = S.ds.wards[i]; return w ? w.code + (w.name && w.name !== w.code ? ' · ' + w.name : '') : '–'; }
function wardShort(i) { var w = S.ds.wards[i]; return w ? w.code : '–'; }
function divName(i) { var d = S.ds.divs[i]; return d ? d.name : '–'; }
function divShort(i) { var d = S.ds.divs[i]; return d ? d.code : '–'; }
function empName(i) { var e = S.ds.emps[i]; return e ? e.name : '–'; }
function empId(i) { var e = S.ds.emps[i]; return e ? e.id : ''; }
function posMain(i) { return S.ds.posMain[i] || '–'; }
function posSub(i) { var p = S.ds.posSub[i]; return p ? (p.sub || p.main) : '–'; }
function compName(i) { var c = S.ds.comps[i]; return c ? c.name : '–'; }
function compCat(i) { var c = S.ds.comps[i]; return c ? c.cat : ''; }
function disName(i) { return i >= 0 && S.ds.diseases[i] ? S.ds.diseases[i].name : ''; }
function groupBy(arr, keyFn) { var o = {}; arr.forEach(function (x) { var k = keyFn(x); (o[k] = o[k] || []).push(x); }); return o; }
function posOrderIdx(name) { var i = (S.posOrder || []).indexOf(name); return i < 0 ? 99 : i; }

function groupKeyFn(by) {
  return {
    pm: { key: function (p) { return p.pm; }, name: posMain, sort: function (a, b) { return posOrderIdx(posMain(a)) - posOrderIdx(posMain(b)); }, label: 'ตำแหน่งหลัก' },
    ps: { key: function (p) { return p.ps; }, name: function (i) { var x = S.ds.posSub[i]; return x ? x.main + (x.sub && x.sub !== x.main ? ' › ' + x.sub : '') : '–'; }, sort: function (a, b) { var x = S.ds.posSub[a], y = S.ds.posSub[b]; return posOrderIdx(x.main) - posOrderIdx(y.main) || String(x.sub).localeCompare(String(y.sub), 'th'); }, label: 'ตำแหน่งย่อย' },
    div: { key: function (p) { return p.d; }, name: divName, sort: function (a, b) { return (S.ds.divs[a].order || 99) - (S.ds.divs[b].order || 99); }, label: 'ส่วนงาน/ฝ่าย' },
    ward: { key: function (p) { return p.w; }, name: wardName, sort: function (a, b) { return wardShort(a).localeCompare(wardShort(b), 'th', { numeric: true }); }, label: 'หอผู้ป่วย' }
  }[by];
}
function groupStats(P, by) {
  var g = groupKeyFn(by), groups = {};
  Object.keys(P).forEach(function (k) { var p = P[k], key = g.key(p); (groups[key] = groups[key] || {})[k] = p; });
  return Object.keys(groups).map(Number).sort(g.sort).map(function (key) {
    var d = dist(groups[key]); d.key = key; d.name = g.name(key); d.members = groups[key]; return d;
  });
}
/** สถิติรายหัวข้อ/รายกลุ่มจากแถวคะแนน (ไม่รวมคน) */
function itemStats(rows, keyFn) {
  var g = {};
  rows.forEach(function (r) {
    var k = keyFn(r), l = lv(r[R_SC]);
    var o = g[k] = g[k] || { key: k, N: 0, sum: 0, R: 0, Y: 0, G: 0, INC: 0, ERR: 0, vals: [] };
    if (l === 'INC' || l === 'ERR') { o[l]++; if (!(l === 'INC' && S.F.incInc)) return; }
    o.N++; o.sum += r[R_SC]; o[l === 'INC' ? 'R' : l]++; o.vals.push(r[R_SC]);
  });
  return Object.keys(g).map(function (k) { var o = g[k]; o.avg = o.N ? o.sum / o.N : null; o.pR = o.N ? o.R / o.N * 100 : null; return o; });
}
/** ควอไทล์สำหรับ box plot */
function quantiles(arr) {
  if (!arr.length) return null;
  var a = arr.slice().sort(function (x, y) { return x - y; });
  var q = function (p) { var pos = (a.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return a[lo] + (a[hi] - a[lo]) * (pos - lo); };
  return [a[0], q(0.25), q(0.5), q(0.75), a[a.length - 1]].map(function (v) { return Math.round(v * 100) / 100; });
}
function histogram(vals, from, to, step) {
  var bins = []; for (var x = from; x < to; x += step) bins.push({ lo: x, hi: x + step, n: 0 });
  vals.forEach(function (v) { var i = Math.min(bins.length - 1, Math.max(0, Math.floor((v - from) / step))); bins[i].n++; });
  return bins;
}
if (typeof module !== 'undefined') module.exports = { S: S };
