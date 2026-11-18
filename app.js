/* app.js — แกนหน้าเว็บ: เรียก API · เข้าสู่ระบบ · เมนู · ตัวกรอง · ตาราง · หน้าต่าง · ส่งออก Excel */
var VIEWS = {};
S.charts = [];

/* ---------- storage ---------- */
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }

/* ---------- API ---------- */
function api(action, payload, opts) {
  opts = opts || {};
  var body = { action: action, token: S.token, payload: payload || {} };
  var p;
  if (window.DEMO_RPC) p = new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(window.DEMO_RPC(action, S.token, payload || {})))); }, 120); });
  else {
    if (!window.API_URL || /ใส่รหัส/.test(window.API_URL)) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js'));
    p = fetch(window.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (HTTP ' + r.status + ')'); return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่'); } }, function (e) {
        if (e && /HTTP/.test(e.message)) throw e;
        throw new Error('เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
      });
  }
  return p.then(function (res) {
    if (res && res.auth === false) { logoutLocal(res.error); throw new Error(res.error); }
    if (res && res.ok === false) throw new Error(res.error || 'เกิดข้อผิดพลาด');
    return res;
  });
}

/* ---------- DOM helpers ---------- */
function $(s, root) { return (root || document).querySelector(s); }
function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n, d) { if (n === null || n === undefined || !isFinite(n)) return '–'; return Number(n).toLocaleString('th-TH', { minimumFractionDigits: d === undefined ? 1 : d, maximumFractionDigits: d === undefined ? 1 : d }); }
function fmtInt(n) { return n === null || n === undefined ? '–' : Number(n).toLocaleString('th-TH'); }
function pct(a, b, d) { return b ? fmt(a / b * 100, d === undefined ? 1 : d) + '%' : '–'; }
function signed(n, d) { if (n === null || n === undefined || !isFinite(n)) return '–'; return (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), d); }
function toast(msg, kind) {
  var t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, kind === 'err' ? 6500 : 3500);
}
function busy(on, msg) { var b = $('#busy'); b.hidden = !on; if (msg) $('#busy-msg').textContent = msg; }
function pill(l) { return '<span class="pill lv-' + l + '">' + LV_LABEL[l] + '</span>'; }
function lvCell(score) { if (score === null || score === undefined) return '<span class="muted">–</span>'; var l = lv(score); return '<span class="sc lv-' + l + '" title="' + LV_LABEL[l] + '">' + fmt(score, 2) + '</span>'; }
function deltaHtml(d) {
  if (d === null || d === undefined || !isFinite(d)) return '<span class="muted">–</span>';
  var band = S.settings.SAME_BAND || 0.5, cls = d > band ? 'up' : d < -band ? 'down' : 'same';
  return '<span class="delta ' + cls + '">' + (cls === 'up' ? '▲ ' : cls === 'down' ? '▼ ' : '● ') + signed(d, 2) + '</span>';
}
function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
function section(box, html, cls) { var d = document.createElement('section'); d.className = 'card ' + (cls || ''); d.innerHTML = html; box.appendChild(d); return d; }
function div(box, cls, html) { var d = document.createElement('div'); d.className = cls || ''; d.innerHTML = html || ''; box.appendChild(d); return d; }
function stat(label, v, sub, lvk, icon) { return '<div class="stat' + (lvk ? ' s-' + lvk : '') + '"><span class="k">' + label + '</span><span class="v">' + v + '</span><span class="d">' + (sub || '') + '</span>' + (icon ? '<span class="ic">' + icon + '</span>' : '') + '</div>'; }
function initials(name) { var s = String(name || '').replace(/^(นาย|นางสาว|นาง|น\.ส\.|ว่าที่ร้อยตรี|พว\.)\s*/, '').trim(); return s ? s.charAt(0) : '?'; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function idxOfRow(b) { var tr = b.closest('tr'); return Array.prototype.indexOf.call(tr.parentNode.children, tr); }

/* ---------- login ---------- */
function showLogin(msg) {
  $('#app').hidden = true; $('#login').hidden = false; busy(false);
  $('#login-msg').textContent = msg || '';
  var last = store('cd2_emp'); if (last) $('#login-emp').value = last;
  $('#login-ver').textContent = 'รุ่น ' + (window.APP_BUILD || '');
  setTimeout(function () { ($('#login-emp').value ? $('#login-pass') : $('#login-emp')).focus(); }, 50);
}
function logoutLocal(msg) { S.token = null; store('cd2_token', null); sstore('cd2_token', null); S.ds = null; S.F = null; destroyCharts(); showLogin(msg || 'กรุณาเข้าสู่ระบบ'); }
function initLogin() {
  $('#pw-eye').addEventListener('click', function () { var i = $('#login-pass'); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; this.textContent = show ? 'ซ่อน' : 'แสดง'; });
  $('#login-emp').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 8); });
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var emp = $('#login-emp').value.trim(), pass = $('#login-pass').value, remember = $('#login-remember').checked;
    if (!/^\d{7,8}$/.test(emp)) { $('#login-msg').textContent = 'กรุณากรอกรหัสเจ้าหน้าที่ 7 หลัก'; return; }
    var btn = $('#login-btn'); btn.disabled = true; btn.textContent = 'กำลังตรวจสอบกับ HIS...'; $('#login-msg').textContent = '';
    api('login', { emp: emp, pass: pass, remember: remember, ua: navigator.userAgent }).then(function (res) {
      S.token = res.token; store('cd2_emp', emp);
      if (remember) store('cd2_token', res.token); else sstore('cd2_token', res.token);
      $('#login-pass').value = '';
      $('#login').hidden = true; startApp(res.boot);
    }).catch(function (err) { $('#login-msg').textContent = err.message; $('#login-pass').select(); })
      .then(function () { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; });
  });
  $('#login-theme').addEventListener('click', toggleTheme);
}

/* ---------- boot ---------- */
function boot() {
  busy(true, 'กำลังโหลด...');
  api('bootstrap').then(startApp).catch(function (err) { busy(false); if (S.token) { toast(err.message, 'err'); showLogin(err.message); } });
}
function startApp(b) {
  S.user = b.user; S.settings = b.settings; S.rounds = b.rounds; S.posOrder = b.posOrder; S.notifyTypes = b.notifyTypes; S.roles = b.roles; S.build = b.build;
  $('#user-name').textContent = b.user.name; $('#user-role').textContent = b.user.roleName + (b.user.scope && b.user.scope.length ? ' · ' + b.user.scope.join(', ') : '');
  $('#me-avatar').textContent = initials(b.user.name);
  $('#app-ver').textContent = 'รุ่น ' + b.build;
  busy(true, 'กำลังโหลดข้อมูลคะแนน...');
  return loadDataset().then(function () {
    $('#app').hidden = false; $('#login').hidden = true;
    buildNav(); buildFilters();
    var want = location.hash.replace('#', '') || sstore('cd2_view') || defaultView();
    route(want);
    loadIdp();
    if (S.user.role !== 'STAFF' && !S.user.verified && !sstore('cd2_mailhint')) { sstore('cd2_mailhint', '1'); setTimeout(function () { toast('ตั้งอีเมลรับการแจ้งเตือนได้ที่ "ข้อมูลของฉัน"'); }, 1200); }
  }).catch(function (err) { toast(err.message, 'err'); }).then(function () { busy(false); });
}
function defaultView() { return S.user.role === 'STAFF' ? 'mine' : 'overview'; }
function loadDataset() {
  return api('dataset').then(function (res) { var keep = S.F; prepDataset(res.data); if (keep) S.F = keep; prepDataset(S.ds); });
}
function loadIdp() { return api('idpList').then(function (r) { S.idp = r.rows || []; if (['idp', 'gap', 'person', 'mine'].indexOf(S.view) >= 0) render(); updateBadges(); }).catch(function () { }); }

/* ---------- nav & routing ---------- */
var ICONS = {
  overview: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  groups: 'M4 20h4V10H4zm6 0h4V4h-4zm6 0h4v-7h-4z',
  gap: 'M12 2 1 21h22zm0 5 7.5 12h-15zM11 10v4h2v-4zm0 5v2h2v-2z',
  items: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
  sone: 'M12 21s-7-4.4-9.3-9C1 8.4 3.3 4 7.2 4c2 0 3.4 1 4.8 2.6C13.4 5 14.8 4 16.8 4 20.7 4 23 8.4 21.3 12 19 16.6 12 21 12 21z',
  compare: 'M7 7h10l-3-3 1.4-1.4L21 8l-5.6 5.4L14 12l3-3H7zm10 10H7l3 3-1.4 1.4L3 16l5.6-5.4L10 12l-3 3h10z',
  person: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-9 2-9 5v3h18v-3c0-3-5-5-9-5z',
  quality: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  idp: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z',
  mine: 'M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9z',
  profile: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z',
  admin: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z'
};
function navItems() {
  var r = S.user.role;
  if (r === 'STAFF') return [['', 'ของฉัน'], ['mine', 'ผลการประเมินของฉัน'], ['profile', 'อีเมลและการแจ้งเตือน']];
  var list = [['', 'วิเคราะห์'], ['overview', 'ภาพรวม'], ['groups', 'จำแนกกลุ่ม'], ['gap', 'วิเคราะห์ Gap'], ['items', 'รายหัวข้อ'], ['sone', 'SONE รายโรค'], ['compare', 'เปรียบเทียบรอบ'],
    ['', 'บุคลากร'], ['person', 'รายบุคคล'], ['idp', 'แผนพัฒนา (IDP)'], ['quality', 'คุณภาพข้อมูล'], ['', 'ส่วนตัว'], ['profile', 'อีเมลและการแจ้งเตือน']];
  if (r === 'ADMIN') list.push(['admin', 'จัดการระบบ']);
  return list;
}
function buildNav() {
  $('#nav').innerHTML = navItems().map(function (n) {
    if (!n[0]) return '<div class="nav-sec">' + n[1] + '</div>';
    return '<button class="nav-btn" data-view="' + n[0] + '" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n[0]] + '"/></svg><span>' + n[1] + '</span></button>';
  }).join('');
  $$('#nav .nav-btn').forEach(function (b) { b.addEventListener('click', function () { route(b.dataset.view); document.body.classList.remove('nav-open'); }); });
}
function allowed(v) { return navItems().some(function (n) { return n[0] === v; }) && VIEWS[v]; }
function route(v) {
  if (!allowed(v)) v = defaultView();
  S.view = v; sstore('cd2_view', v);
  try { history.replaceState(null, '', '#' + v); } catch (e) { }
  $$('#nav .nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
  render();
  window.scrollTo(0, 0);
}
function destroyCharts() { (S.charts || []).forEach(function (c) { try { c.dispose(); } catch (e) { } }); S.charts = []; }
function render() {
  destroyCharts();
  var v = VIEWS[S.view];
  $('#view-title').textContent = v.title;
  var noF = v.noFilters === true || S.user.role === 'STAFF';
  $('#filters').hidden = noF; $('#btn-filter').hidden = noF;
  $('#view-sub').textContent = S.user.role === 'STAFF' ? S.user.name + ' · ' + S.user.emp : v.noFilters ? (v.sub || '') : filterSummary();
  var box = $('#view');
  box.innerHTML = '';
  if (!S.ds.rows.length && !v.noData) {
    box.innerHTML = '<div class="card empty">' + (S.user.role === 'STAFF' ? 'ยังไม่มีผลประเมินของคุณในระบบ' : 'ยังไม่มีข้อมูลในขอบเขตที่คุณดูแล' + (S.user.role === 'ADMIN' ? ' — ไปที่ "จัดการระบบ" เพื่อย้ายข้อมูลจากระบบเดิมหรือนำเข้าไฟล์ใหม่' : '')) + '</div>';
    return;
  }
  try { v.render(box); } catch (e) { console.error(e); box.innerHTML = '<div class="card empty">แสดงผลไม่สำเร็จ: ' + esc(e.message) + '</div>'; }
}
function updateBadges() { }

/* ---------- filters ---------- */
function presentSet(idx) { var o = {}; S.ds.rows.forEach(function (r) { o[r[idx]] = 1; }); return o; }
function buildFilters() {
  if (S.user.role === 'STAFF') { $('#filters').innerHTML = ''; return; }
  var ds = S.ds, F = S.F, pres, h = '';
  var sel = function (id, label, on, opts) { return '<label>' + label + '<select id="' + id + '"' + (on ? ' class="on"' : '') + '>' + opts + '</select></label>'; };
  h += sel('f-round', 'รอบประเมิน', false, ds.roundIdx.slice().reverse().map(function (i) { return opt(i, ds.rounds[i].label, F.round); }).join(''));
  h += sel('f-cat', 'หมวด', F.cat !== 'ALL', opt('ALL', 'รวมทุกหมวด', F.cat) + CAT_NAMES.map(function (c) { return opt(c, c, F.cat); }).join(''));
  pres = presentSet(R_DIV);
  var divs = ds.divs.map(function (d, i) { return [i, d]; }).filter(function (x) { return pres[x[0]]; }).sort(function (a, b) { return a[1].order - b[1].order; });
  if (divs.length > 1) h += sel('f-div', 'ส่วนงาน/ฝ่าย', F.div >= 0, opt(-1, 'ทุกส่วนงาน', F.div) + divs.map(function (x) { return opt(x[0], x[1].name, F.div); }).join(''));
  var wardRows = F.div >= 0 ? ds.rows.filter(function (r) { return r[R_DIV] === F.div; }) : ds.rows;
  pres = {}; wardRows.forEach(function (r) { pres[r[R_WARD]] = 1; });
  var wards = ds.wards.map(function (w, i) { return [i, w]; }).filter(function (x) { return pres[x[0]]; }).sort(function (a, b) { return a[1].code.localeCompare(b[1].code, 'th', { numeric: true }); });
  if (wards.length > 1) h += sel('f-ward', 'หอผู้ป่วย', F.ward >= 0, opt(-1, 'ทุกหอ', F.ward) + wards.map(function (x) { return opt(x[0], wardName(x[0]), F.ward); }).join(''));
  pres = presentSet(R_PM);
  var pms = ds.posMain.map(function (p, i) { return [i, p]; }).filter(function (x) { return pres[x[0]]; }).sort(function (a, b) { return posOrderIdx(a[1]) - posOrderIdx(b[1]); });
  h += sel('f-pm', 'ตำแหน่ง', F.pm >= 0, opt(-1, 'ทุกตำแหน่ง', F.pm) + pms.map(function (x) { return opt(x[0], x[1], F.pm); }).join(''));
  if (F.pm >= 0) {
    pres = presentSet(R_PS);
    var pss = ds.posSub.map(function (p, i) { return [i, p]; }).filter(function (x) { return pres[x[0]] && x[1].main === ds.posMain[F.pm]; });
    if (pss.length > 1) h += sel('f-ps', 'ตำแหน่งย่อย', F.ps >= 0, opt(-1, 'ทั้งหมด', F.ps) + pss.map(function (x) { return opt(x[0], x[1].sub || x[1].main, F.ps); }).join(''));
  }
  if (F.cat !== 'SONE') {
    var doms = ds.domains.map(function (d, i) { return [i, d]; }).filter(function (x) { return F.cat === 'ALL' || ds.comps.some(function (c, j) { return c.cat === F.cat && ds.compDom[j] === x[0]; }); });
    h += sel('f-dom', 'ด้านสมรรถนะ', F.dom >= 0, opt(-1, 'ทุกด้าน', F.dom) + doms.map(function (x) { return opt(x[0], x[1], F.dom); }).join(''));
  }
  if (F.cat === 'SONE' || F.cat === 'ALL') {
    h += sel('f-grp', 'กลุ่มโรค', F.grp >= 0, opt(-1, 'ทุกกลุ่มโรค', F.grp) + ds.groups.map(function (g, i) { return opt(i, g, F.grp); }).join(''));
    var dis = ds.diseases.map(function (d, i) { return [i, d]; }).filter(function (x) { return F.grp < 0 || ds.disGrp[x[0]] === F.grp; }).sort(function (a, b) { return a[1].name.localeCompare(b[1].name); });
    h += sel('f-dis', 'โรค', F.dis >= 0, opt(-1, 'ทุกโรค', F.dis) + dis.map(function (x) { return opt(x[0], x[1].name, F.dis); }).join(''));
  }
  h += '<label class="chk" title="รายงานเดิมนับผู้ประเมินไม่ครบเป็นสีแดง ติ๊กเพื่อดูแบบเดิม"><input type="checkbox" id="f-inc"' + (F.incInc ? ' checked' : '') + '> รวมผู้ประเมินไม่ครบ</label>';
  h += '<button class="btn ghost sm" id="f-reset" type="button">ล้างตัวกรอง</button>';
  $('#filters').innerHTML = h;
  var bind = function (id, key, reset) {
    var el = $('#' + id); if (!el) return;
    el.addEventListener('change', function () {
      S.F[key] = key === 'cat' ? el.value : Number(el.value);
      (reset || []).forEach(function (k) { S.F[k] = -1; });
      buildFilters(); render();
    });
  };
  bind('f-round', 'round'); bind('f-cat', 'cat', ['dom', 'grp', 'dis']); bind('f-div', 'div', ['ward']); bind('f-ward', 'ward');
  bind('f-pm', 'pm', ['ps']); bind('f-ps', 'ps'); bind('f-dom', 'dom'); bind('f-grp', 'grp', ['dis']); bind('f-dis', 'dis');
  $('#f-inc').addEventListener('change', function () { S.F.incInc = this.checked; render(); });
  $('#f-reset').addEventListener('click', function () { var r = S.F.round; S.F = null; prepDataset(S.ds); S.F.round = r; buildFilters(); render(); });
}
function filterSummary() {
  if (!S.F || !S.ds) return '';
  var F = S.F, ds = S.ds, p = [roundLabel(F.round), F.cat === 'ALL' ? 'รวมทุกหมวด' : F.cat];
  if (F.div >= 0) p.push(divName(F.div)); if (F.ward >= 0) p.push('หอ ' + wardName(F.ward));
  if (F.pm >= 0) p.push(ds.posMain[F.pm]); if (F.ps >= 0) p.push(posSub(F.ps));
  if (F.dom >= 0) p.push('ด้าน' + ds.domains[F.dom]); if (F.grp >= 0) p.push(ds.groups[F.grp]); if (F.dis >= 0) p.push(disName(F.dis));
  if (F.incInc) p.push('รวมผู้ประเมินไม่ครบ');
  if (S.user && S.user.role !== 'ADMIN' && S.user.role !== 'EXEC' && S.user.scope && S.user.scope.length) p.push('ขอบเขต ' + S.user.scope.join(', '));
  return p.join(' · ');
}

/* ---------- table ---------- */
/** cfg: {title, sub, rows, cols:[{k,label,num,d,html(row),val(row),xval(row),cls}], search, sort, dir, limit, onRow(row), after(wrap, shown), exportName, cards} */
function table(container, cfg) {
  var st = { sort: cfg.sort === undefined ? null : cfg.sort, dir: cfg.dir || -1, limit: cfg.limit || 50, q: '' };
  var wrap = document.createElement('div'); wrap.className = 'tcard';
  wrap.innerHTML = '<div class="tbar"><div class="tt">' + (cfg.title ? '<h3>' + esc(cfg.title) + '</h3>' : '') + (cfg.sub ? '<div class="muted sm">' + cfg.sub + '</div>' : '') + '</div><div class="tact">' +
    (cfg.search ? '<input type="search" class="tsearch" placeholder="ค้นหา..." aria-label="ค้นหาในตาราง">' : '') +
    (cfg.noExport ? '' : '<button class="btn ghost sm texp" type="button">Excel</button>') + '</div></div><div class="tscroll"><table><thead></thead><tbody></tbody></table></div><div class="tfoot"></div>';
  container.appendChild(wrap);
  function val(c, r) { return c.val ? c.val(r) : r[c.k]; }
  function draw() {
    var rows = cfg.rows.slice();
    if (st.q) { var q = st.q.toLowerCase(); rows = rows.filter(function (r) { return cfg.cols.some(function (c) { var v = c.sval ? c.sval(r) : val(c, r); return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q) >= 0; }); }); }
    if (st.sort !== null) {
      var c = cfg.cols.filter(function (x) { return x.k === st.sort; })[0];
      if (c) rows.sort(function (a, b) { var x = val(c, a), y = val(c, b); if (x === y) return 0; if (x === null || x === undefined || x === '') return 1; if (y === null || y === undefined || y === '') return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'th', { numeric: true })) * st.dir; });
    }
    $('thead', wrap).innerHTML = '<tr>' + cfg.cols.map(function (c) { return '<th class="' + (c.num ? 'num ' : '') + (st.sort === c.k ? 'sorted' : '') + '" data-k="' + c.k + '">' + esc(c.label) + (st.sort === c.k ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr>';
    var show = rows.slice(0, st.limit);
    $('tbody', wrap).innerHTML = show.length ? show.map(function (r, i) {
      return '<tr' + (cfg.onRow ? ' class="clickable" data-i="' + i + '"' : '') + '>' + cfg.cols.map(function (c) { var v = c.html ? c.html(r) : esc(c.num && typeof val(c, r) === 'number' ? fmt(val(c, r), c.d) : val(c, r)); return '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + (v === undefined ? '' : v) + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + cfg.cols.length + '" class="muted center">ไม่มีข้อมูล</td></tr>';
    $('.tfoot', wrap).innerHTML = rows.length > st.limit ? '<span class="muted sm">แสดง ' + fmtInt(st.limit) + ' จาก ' + fmtInt(rows.length) + ' แถว</span> <button class="btn ghost sm tmore" type="button">แสดงเพิ่ม</button>' : (rows.length > 10 ? '<span class="muted sm">' + fmtInt(rows.length) + ' แถว</span>' : '');
    var more = $('.tmore', wrap); if (more) more.addEventListener('click', function () { st.limit += 100; draw(); });
    $$('th', wrap).forEach(function (th) { th.addEventListener('click', function () { var k = th.dataset.k; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = -1; } draw(); }); });
    if (cfg.onRow) $$('tbody tr.clickable', wrap).forEach(function (tr) { tr.addEventListener('click', function (e) { if (e.target.closest('button,a,input,select')) return; cfg.onRow(show[Number(tr.dataset.i)], tr); }); });
    if (cfg.after) cfg.after(wrap, show);
  }
  var s = $('.tsearch', wrap); if (s) s.addEventListener('input', function () { st.q = s.value.trim(); st.limit = cfg.limit || 50; draw(); });
  var ex = $('.texp', wrap);
  if (ex) ex.addEventListener('click', function () {
    exportXlsx(cfg.exportName || cfg.title || 'export', [cfg.cols.filter(function (c) { return c.label; }).map(function (c) { return c.label; })].concat(cfg.rows.map(function (r) { return cfg.cols.filter(function (c) { return c.label; }).map(function (c) { var v = c.xval ? c.xval(r) : val(c, r); return v === null || v === undefined ? '' : v; }); })));
  });
  draw();
  return { redraw: draw, el: wrap };
}

var _xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (_xlsxLoading) return _xlsxLoading;
  _xlsxLoading = new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = res; s.onerror = function () { _xlsxLoading = null; rej(new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}
function exportXlsx(name, aoa) {
  loadXLSX().then(function () {
    var wb = XLSX.utils.book_new();
    var meta = [['ตัวกรอง', filterSummary()], ['ส่งออกโดย', S.user.name + ' (' + S.user.emp + ')'], ['ส่งออกเมื่อ', new Date().toLocaleString('th-TH')], []];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta.concat(aoa)), 'data');
    XLSX.writeFile(wb, (name + '').replace(/[\\/:*?"<>|]/g, '_') + '.xlsx');
  }).catch(function (e) { toast(e.message, 'err'); });
}

/* ---------- modal ---------- */
function modal(title, html, onReady, wide) {
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = html; $('#modal').hidden = false;
  $('.modal-box').classList.toggle('wide', !!wide);
  if (onReady) onReady($('#modal-body'));
}
function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
function confirmBox(msg, yes, opts) {
  opts = opts || {};
  modal(opts.title || 'ยืนยัน', '<p>' + esc(msg) + '</p>' + (opts.typeWord ? '<label class="form"><span class="sm muted">พิมพ์ "' + esc(opts.typeWord) + '" เพื่อยืนยัน</span><input id="cf-word"></label>' : '') +
    '<div class="form-act"><button class="btn ghost" id="cf-no" type="button">ยกเลิก</button><button class="btn ' + (opts.safe ? '' : 'danger') + '" id="cf-yes" type="button">' + esc(opts.yes || 'ยืนยัน') + '</button></div>', function (b) {
    $('#cf-no', b).addEventListener('click', closeModal);
    $('#cf-yes', b).addEventListener('click', function () { var w = $('#cf-word', b); var v = w ? w.value.trim() : ''; if (opts.typeWord && v !== opts.typeWord) { toast('พิมพ์คำยืนยันไม่ถูกต้อง', 'err'); return; } closeModal(); yes(v); });
  });
}

/* ---------- theme ---------- */
function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : false; }
function toggleTheme() {
  var next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next); store('cd2_theme', next);
  $('#btn-theme').textContent = next === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด';
  if (S.ds && !$('#app').hidden) render();
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', function () {
  initLogin();
  $('#btn-theme').textContent = isDark() ? 'โหมดสว่าง' : 'โหมดมืด';
  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#btn-logout').addEventListener('click', function () { logoutLocal('ออกจากระบบแล้ว'); });
  $('#me-chip').addEventListener('click', function () { route('profile'); document.body.classList.remove('nav-open'); });
  $('#btn-menu').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
  $('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
  $('#btn-filter').addEventListener('click', function () { var o = document.body.classList.toggle('filters-open'); this.setAttribute('aria-expanded', o); });
  $('#btn-print').addEventListener('click', function () { $('#print-summary').textContent = $('#view-title').textContent + ' · ' + filterSummary() + ' · พิมพ์เมื่อ ' + new Date().toLocaleString('th-TH'); window.print(); });
  $('#btn-reload').addEventListener('click', function () {
    busy(true, 'กำลังโหลดข้อมูลล่าสุด...');
    loadDataset().then(function () { buildFilters(); render(); loadIdp(); toast('โหลดข้อมูลล่าสุดแล้ว'); }).catch(function (e) { toast(e.message, 'err'); }).then(function () { busy(false); });
  });
  window.addEventListener('hashchange', function () { var v = location.hash.replace('#', ''); if (S.ds && v && v !== S.view) route(v); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { (S.charts || []).forEach(function (c) { try { c.resize(); } catch (e) { } }); }, 150); });
  S.token = store('cd2_token') || sstore('cd2_token');
  if (S.token) boot(); else showLogin();
});
