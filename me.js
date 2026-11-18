/* me.js — "ผลการประเมินของฉัน" (บุคลากร) และ "อีเมลและการแจ้งเตือน" (ทุกคน) */
VIEWS.mine = {
  title: 'ผลการประเมินของฉัน',
  render: function (box) {
    var me = S.ds.meIdx;
    if (me === undefined || me < 0) { section(box, '<div class="empty">ยังไม่มีผลประเมินของคุณในระบบ</div>'); return; }
    if (!S.user.verified) section(box, '<div class="note info">ตั้งอีเมลเพื่อรับแจ้งเมื่อผลประเมินรอบใหม่เข้าระบบ และเตือนเมื่อแผนพัฒนาใกล้ครบกำหนด <button class="btn xs" type="button" id="go-prof">ตั้งอีเมล</button></div>', 'flat');
    var gp = $('#go-prof', box); if (gp) gp.addEventListener('click', function () { route('profile'); });
    var holder = document.createElement('div'); box.appendChild(holder);
    showPerson(holder, me, { self: true });
    var mine = (S.idp || []).slice().sort(function (a, b) { return String(a['กำหนดเสร็จ'] || '9').localeCompare(String(b['กำหนดเสร็จ'] || '9')); });
    var s = section(box, cardH('แผนพัฒนาของฉัน (IDP)', mine.length ? fmtInt(mine.length) + ' แผน · หัวหน้าหอเป็นผู้บันทึกและปรับสถานะ' : '') + '<div class="idp-list"></div>');
    var l = $('.idp-list', s);
    if (!mine.length) { l.innerHTML = '<div class="empty">ยังไม่มีแผนพัฒนา' + (S.ds.rows.some(function (r) { return lv(r[R_SC]) === 'R'; }) ? ' — หัวหน้าหอจะร่วมวางแผนในหัวข้อที่ต่ำกว่าเกณฑ์' : '') + '</div>'; return; }
    l.style.display = 'grid'; l.style.gap = '10px';
    l.innerHTML = mine.map(function (x) {
      var st = x['สถานะ'], due = String(x['กำหนดเสร็จ'] || '').slice(0, 10);
      return '<div class="idp-card"><div class="row1"><div><b>' + esc(x['Competency']) + '</b><div class="muted sm">' + esc(x['หมวด']) + ' · รอบ ' + esc(x.round_id) + ' · คะแนน ' + (x['คะแนน'] !== '' ? lvCell(Number(x['คะแนน'])) : '–') + '</div></div><span class="chip ' + (st === 'เสร็จแล้ว' || st === 'ประเมินซ้ำแล้ว' ? 'ok' : 'info') + '">' + esc(st) + '</span></div>' +
        (x['แผนพัฒนา'] ? '<div><span class="muted sm">แผน:</span> ' + esc(x['แผนพัฒนา']) + '</div>' : '') + (x['สาเหตุ'] ? '<div class="sm"><span class="muted">สาเหตุ:</span> ' + esc(x['สาเหตุ']) + '</div>' : '') +
        '<div class="sm">' + (x['ผู้รับผิดชอบ'] ? '<span class="muted">ผู้รับผิดชอบ:</span> ' + esc(x['ผู้รับผิดชอบ']) + ' · ' : '') + '<span class="muted">กำหนดเสร็จ:</span> ' + dueChip(due, st) + '</div></div>';
    }).join('');
  }
};

VIEWS.profile = {
  title: 'อีเมลและการแจ้งเตือน',
  noFilters: true, noData: true,
  sub: 'ตั้งอีเมลสำหรับรับข้อมูลและการแจ้งเตือนจากระบบ',
  render: function (box) {
    var u = S.user, T = S.notifyTypes || {};
    var desc = {
      ROUND: 'เมื่อ HR นำเข้าผลประเมินรอบใหม่ ' + (u.role === 'STAFF' ? '(สรุปผลของคุณ)' : '(สรุปหน่วยงานที่ดูแล)'),
      IDP: u.role === 'STAFF' ? 'เมื่อแผนพัฒนาของคุณใกล้ครบกำหนดหรือเลยกำหนด' : 'เมื่อแผนพัฒนาของบุคลากรในความดูแลใกล้ครบ/เลยกำหนด',
      MONTHLY: 'สรุปภาพรวมสมรรถนะและความคืบหน้า IDP ทุกเดือน (ผู้บริหาร/HR Admin)',
      NOPLAN: 'สรุปหัวข้อที่ต่ำกว่าเกณฑ์แต่ยังไม่มีแผน รายสัปดาห์ (หัวหน้า)'
    };
    var applies = { ROUND: true, IDP: true, MONTHLY: u.role === 'ADMIN' || u.role === 'EXEC', NOPLAN: u.role === 'ADMIN' || u.role === 'WARD_HEAD' || u.role === 'DIV_HEAD' };
    var g = div(box, 'grid2');
    var s1 = section(g, cardH('ข้อมูลบัญชี', '') +
      '<dl class="kv"><dt>ชื่อ</dt><dd>' + esc(u.name) + '</dd><dt>รหัสเจ้าหน้าที่</dt><dd>' + esc(u.emp) + '</dd><dt>บทบาท</dt><dd>' + esc(u.roleName) + '</dd>' + (u.scope && u.scope.length ? '<dt>ขอบเขต</dt><dd>' + esc(u.scope.join(', ')) + '</dd>' : '') +
      '<dt>อีเมล</dt><dd id="pf-mail">' + (u.email ? esc(u.email) + ' ' + (u.verified ? '<span class="chip ok">ยืนยันแล้ว</span>' : '<span class="chip warn">ยังไม่ยืนยัน</span>') : '<span class="muted">ยังไม่ได้ตั้ง</span>') + '</dd></dl>' +
      '<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">' +
      '<form class="form" id="pf-form"><label>' + (u.email ? 'เปลี่ยนอีเมล' : 'อีเมลสำหรับรับการแจ้งเตือน') + '<input type="email" id="pf-email" placeholder="name@example.com" autocomplete="email" value="' + esc(u.verified ? '' : u.email || '') + '" required></label>' +
      '<div class="form-act" style="justify-content:flex-start"><button class="btn" type="submit" id="pf-send">ส่งรหัสยืนยัน</button>' + (u.email ? '<button class="btn ghost" type="button" id="pf-remove">ลบอีเมล</button>' : '') + '</div></form>' +
      '<form class="form" id="pf-verify" hidden style="margin-top:12px"><p class="sm" id="pf-sent"></p><label>รหัสยืนยัน 6 หลัก<input id="pf-code" class="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label><div class="form-act" style="justify-content:flex-start"><button class="btn" type="submit">ยืนยันอีเมล</button></div></form>' +
      '<p class="muted sm" style="margin-top:12px">ใช้อีเมลใดก็ได้ (Gmail, Hotmail, อีเมลองค์กร) ระบบใช้เพื่อแจ้งเตือนเท่านั้น</p>');
    var s2 = section(g, cardH('เลือกการแจ้งเตือนที่ต้องการรับ', u.verified ? 'ส่งไปที่ ' + esc(u.email) : 'ยืนยันอีเมลก่อนจึงจะได้รับ') +
      Object.keys(T).map(function (k) {
        return '<div class="switch"' + (applies[k] ? '' : ' style="opacity:.5"') + '><span class="t"><b>' + esc(T[k]) + '</b><small>' + esc(desc[k]) + (applies[k] ? '' : ' · ไม่เกี่ยวกับบทบาทของคุณ') + '</small></span><label class="tog"><input type="checkbox" data-k="' + k + '"' + (u.prefs[k] !== false ? ' checked' : '') + (applies[k] ? '' : ' disabled') + ' aria-label="' + esc(T[k]) + '"><span></span></label></div>';
      }).join('') +
      '<div class="form-act" style="justify-content:flex-start;margin-top:12px"><button class="btn ghost sm" type="button" id="pf-test"' + (u.verified ? '' : ' disabled') + '>ส่งอีเมลทดสอบ</button></div>');
    var s3 = section(box, cardH('ความปลอดภัย', '') + '<p class="sm">เข้าสู่ระบบด้วยรหัสผ่าน HIS ระบบนี้ไม่เก็บรหัสผ่าน · ถ้าเคยติ๊ก "จดจำการเข้าระบบ" บนเครื่องสาธารณะ กดปุ่มนี้เพื่อออกจากระบบทุกเครื่อง</p><button class="btn danger sm" type="button" id="pf-all">ออกจากระบบทุกอุปกรณ์</button>');
    function refresh(me) { S.user.email = me.email; S.user.verified = me.verified; S.user.prefs = me.prefs; render(); }
    $('#pf-form', s1).addEventListener('submit', function (e) {
      e.preventDefault(); var b = $('#pf-send', s1); b.disabled = true; b.textContent = 'กำลังส่ง...';
      api('profileEmail', { email: $('#pf-email', s1).value }).then(function (r) { $('#pf-verify', s1).hidden = false; $('#pf-sent', s1).textContent = r.message; $('#pf-code', s1).focus(); toast(r.message); })
        .catch(function (er) { toast(er.message, 'err'); }).then(function () { b.disabled = false; b.textContent = 'ส่งรหัสยืนยัน'; });
    });
    $('#pf-verify', s1).addEventListener('submit', function (e) {
      e.preventDefault();
      api('profileVerify', { code: $('#pf-code', s1).value }).then(function (r) { toast('ยืนยันอีเมลเรียบร้อย'); refresh(r.me); }).catch(function (er) { toast(er.message, 'err'); });
    });
    $('#pf-code', s1).addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); });
    var rm = $('#pf-remove', s1); if (rm) rm.addEventListener('click', function () { confirmBox('ลบอีเมลและหยุดรับการแจ้งเตือนทั้งหมด?', function () { api('emailRemove').then(function (r) { toast('ลบอีเมลแล้ว'); refresh(r.me); }).catch(function (er) { toast(er.message, 'err'); }); }); });
    $$('input[data-k]', s2).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var p = {}; $$('input[data-k]', s2).forEach(function (x) { p[x.dataset.k] = x.checked; });
        api('prefsSave', { prefs: p }).then(function (r) { S.user.prefs = r.me.prefs; toast('บันทึกการแจ้งเตือนแล้ว'); }).catch(function (er) { toast(er.message, 'err'); cb.checked = !cb.checked; });
      });
    });
    $('#pf-test', s2).addEventListener('click', function () { var b = this; b.disabled = true; api('testMyEmail').then(function (r) { toast(r.message); }).catch(function (er) { toast(er.message, 'err'); }).then(function () { b.disabled = false; }); });
    $('#pf-all', s3).addEventListener('click', function () { confirmBox('ออกจากระบบทุกอุปกรณ์ (รวมเครื่องนี้)?', function () { api('logoutAll').then(function () { logoutLocal('ออกจากระบบทุกอุปกรณ์แล้ว'); }).catch(function (er) { toast(er.message, 'err'); }); }); });
  }
};
