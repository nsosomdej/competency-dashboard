/* charts.js — ชุดกราฟ (Apache ECharts) ใช้สี/ตัวอักษรจากธีมกลาง รองรับโหมดมืด · ทุกกราฟมี tooltip เมื่อชี้/แตะ
 * สีระดับ (แดง/เหลือง/เขียว) = สีสถานะ ใช้คู่กับป้ายข้อความเสมอ · สีหมวด CFC/SFC/SONE/รวม = ชุดสีหมวดหมู่ลำดับคงที่ */
var CH = {
  col: function (k) { return cssVar('--' + k); },
  lv: function (k) { return cssVar('--' + k); },
  cat: function (c) { return cssVar('--' + (c === 'รวม' ? 'ALL' : c)); },
  ink: function () { return cssVar('--ink'); }, ink2: function () { return cssVar('--ink-2'); }, muted: function () { return cssVar('--muted'); },
  font: "'IBM Plex Sans Thai', system-ui, sans-serif"
};
function ecBase() {
  return {
    animationDuration: 500,
    textStyle: { fontFamily: CH.font, color: CH.ink2(), fontSize: 12 },
    tooltip: { confine: true, backgroundColor: cssVar('--surface'), borderColor: cssVar('--line-2'), borderWidth: 1, textStyle: { color: CH.ink(), fontFamily: CH.font, fontSize: 12.5 }, extraCssText: 'border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.14);padding:8px 12px;' },
    legend: { type: 'scroll', bottom: 0, icon: 'roundRect', pageIconSize: 10, pageTextStyle: { color: CH.muted() }, itemWidth: 12, itemHeight: 12, textStyle: { color: CH.ink2(), fontFamily: CH.font } },
    grid: { left: 8, right: 16, top: 16, bottom: 36, containLabel: true }
  };
}
function axisStyle(o) {
  return Object.assign({ axisLine: { lineStyle: { color: cssVar('--axis') } }, axisTick: { show: false }, axisLabel: { color: CH.muted(), fontFamily: CH.font }, splitLine: { lineStyle: { color: cssVar('--grid'), type: [3, 3] } } }, o || {});
}
function merge(a, b) { Object.keys(b || {}).forEach(function (k) { a[k] = (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) ? merge(a[k], b[k]) : b[k]; }); return a; }
/** สร้างกราฟใน holder (element) · คืน instance */
function ec(holder, option, height) {
  if (typeof echarts === 'undefined') { holder.innerHTML = '<div class="empty">โหลดตัวแสดงกราฟไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วกด "โหลดข้อมูลใหม่"</div>'; return null; }
  holder.classList.add('chart'); holder.style.height = (height || 300) + 'px';
  var c = echarts.init(holder, null, { renderer: 'svg' });
  c.setOption(merge(ecBase(), option));
  S.charts.push(c);
  return c;
}
function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function tipRow(color, label, val) { return '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + color + ';margin-right:6px"></span>' + esc(label) + '</span><b style="font-variant-numeric:tabular-nums">' + val + '</b></div>'; }
var LV_KEYS = ['R', 'Y', 'G', 'INC'];

/** แท่งซ้อน 100% แนวนอน แดง/เหลือง/เขียว/ไม่ครบ · data: [{label, R, Y, G, INC}] */
function chartLevels(holder, data, opts) {
  opts = opts || {};
  var keys = opts.inc === false ? ['R', 'Y', 'G'] : LV_KEYS, asPct = opts.pct !== false;
  var tot = data.map(function (d) { return keys.reduce(function (s, k) { return s + (d[k] || 0); }, 0); });
  var narrow = (holder.clientWidth || 600) < 520, lw = Math.min(opts.labelWidth || 170, Math.round((holder.clientWidth || 600) * 0.36));
  var c = ec(holder, {
    grid: { left: 8, right: 22, top: 6, bottom: narrow ? 64 : 34 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) {
      var i = ps[0].dataIndex; return '<b>' + esc(data[i].label) + '</b>' + keys.map(function (k) { return tipRow(CH.lv(k), LV_LABEL[k], fmtInt(data[i][k] || 0) + ' คน · ' + pct(data[i][k] || 0, tot[i])); }).join('');
    } },
    xAxis: axisStyle({ type: 'value', max: asPct ? 100 : null, axisLabel: { formatter: asPct ? '{value}%' : '{value}', color: CH.muted() } }),
    yAxis: axisStyle({ type: 'category', inverse: true, data: data.map(function (d) { return d.label; }), axisLabel: { color: CH.ink2(), width: lw, overflow: 'truncate' }, splitLine: { show: false } }),
    series: keys.map(function (k) {
      return { name: LV_LABEL[k], type: 'bar', stack: 'a', barMaxWidth: 22, itemStyle: { color: CH.lv(k), borderColor: cssVar('--surface'), borderWidth: 1, borderRadius: 2 },
        label: { show: k !== 'INC', formatter: function (p) { return p.value >= 9 ? Math.round(p.value) + '%' : ''; }, color: k === 'Y' ? '#0b0b0b' : '#fff', fontSize: 11 },
        data: data.map(function (d, i) { return asPct ? (tot[i] ? (d[k] || 0) / tot[i] * 100 : 0) : (d[k] || 0); }) };
    })
  }, opts.height || Math.max(150, data.length * 36 + (narrow ? 90 : 60)));
  if (c && opts.onClick) c.on('click', function (p) { opts.onClick(p.dataIndex); });
  return c;
}
/** แท่งเดี่ยว (แนวนอนเป็นค่าเริ่มต้น) · items: [{name, value, color?, tip?}] */
function chartBar(holder, items, opts) {
  opts = opts || {};
  var horiz = opts.vertical !== true;
  var cat = axisStyle({ type: 'category', data: items.map(function (x) { return x.short || x.name; }), splitLine: { show: false }, axisLabel: { color: CH.ink2(), width: horiz ? (opts.labelWidth || 210) : 80, overflow: 'truncate', interval: 0, rotate: !horiz && items.length > 8 ? 35 : 0 } });
  var val = axisStyle({ type: 'value', min: opts.min, max: opts.max, axisLabel: { formatter: opts.unit === '%' ? '{value}%' : '{value}', color: CH.muted() } });
  if (horiz) cat.inverse = true;
  var marks = opts.thresholds ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1.5 }, label: { formatter: '{b}', color: CH.muted(), fontSize: 11 },
    data: opts.thresholds.map(function (t) { return horiz ? { xAxis: t.v, name: t.label, lineStyle: { color: t.color } } : { yAxis: t.v, name: t.label, lineStyle: { color: t.color } }; }) } : null;
  var c = ec(holder, {
    grid: { left: 8, right: horiz ? 46 : 16, top: opts.thresholds ? 24 : 8, bottom: horiz ? 8 : 10 },
    tooltip: { trigger: 'item', formatter: function (p) { var x = items[p.dataIndex]; return x.tip ? x.tip : '<b>' + esc(x.name) + '</b><br>' + (opts.fmt ? opts.fmt(x.value) : fmt(x.value, 2)); } },
    xAxis: horiz ? val : cat, yAxis: horiz ? cat : val,
    series: [{ type: 'bar', barMaxWidth: horiz ? 20 : 34, data: items.map(function (x) { return { value: x.value, itemStyle: { color: x.color || opts.color || CH.col('brand'), borderRadius: horiz ? [0, 4, 4, 0] : [4, 4, 0, 0] } }; }),
      label: { show: true, position: horiz ? 'right' : 'top', color: CH.ink2(), fontSize: 11, formatter: function (p) { return opts.fmt ? opts.fmt(p.value) : fmt(p.value, opts.d === undefined ? 1 : opts.d); } },
      markLine: marks }]
  }, opts.height || (horiz ? Math.max(170, items.length * 28 + 30) : 300));
  if (c && opts.onClick) c.on('click', function (p) { opts.onClick(p.dataIndex); });
  return c;
}
/** เส้นแนวโน้ม · series: [{name, data, color}] · ป้ายท้ายเส้น */
function chartLine(holder, labels, series, opts) {
  opts = opts || {};
  var c = ec(holder, {
    grid: { left: 8, right: series.length > 1 ? 64 : 24, top: 20, bottom: series.length > 1 ? 36 : 10 },
    tooltip: { trigger: 'axis', valueFormatter: function (v) { return v === null || v === undefined ? '–' : fmt(v, 2); } },
    legend: { show: series.length > 1 },
    xAxis: axisStyle({ type: 'category', data: labels, boundaryGap: false, splitLine: { show: false } }),
    yAxis: axisStyle({ type: 'value', min: opts.min === undefined ? function (v) { return Math.max(0, Math.floor(v.min - 3)); } : opts.min, max: opts.max === undefined ? function (v) { return Math.min(100, Math.ceil(v.max + 2)); } : opts.max, axisLabel: { color: CH.muted() } }),
    series: series.map(function (s, si) {
      return { name: s.name, type: 'line', data: s.data, connectNulls: true, smooth: 0.15, symbol: 'circle', symbolSize: 8, lineStyle: { width: s.bold ? 3 : 2, color: s.color, type: s.dashed ? 'dashed' : 'solid' }, itemStyle: { color: s.color, borderColor: cssVar('--surface'), borderWidth: 2 },
        areaStyle: series.length === 1 ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: s.color + '33' }, { offset: 1, color: s.color + '00' }] } } : null,
        endLabel: { show: series.length > 1, formatter: function (p) { return s.name; }, color: CH.ink2(), fontSize: 11 },
        label: { show: series.length === 1, position: 'top', formatter: function (p) { return fmt(p.value, 2); }, color: CH.ink2(), fontSize: 11 },
        markArea: opts.bands && si === 0 ? { silent: true, data: bandAreas() } : null };
    })
  }, opts.height || 300);
  return c;
}
function bandAreas() {
  var st = S.settings, a = isDark() ? 0.1 : 0.08;
  return [[{ yAxis: 0, itemStyle: { color: hexA(CH.lv('R'), a) } }, { yAxis: st.RED_MAX }], [{ yAxis: st.RED_MAX, itemStyle: { color: hexA(CH.lv('Y'), a) } }, { yAxis: st.YELLOW_MAX }], [{ yAxis: st.YELLOW_MAX, itemStyle: { color: hexA(CH.lv('G'), a) } }, { yAxis: 100 }]];
}
function hexA(hex, a) { hex = String(hex).trim(); if (hex[0] !== '#') return hex; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
/** โดนัท · items: [{name, value, color}] · center: ข้อความกลาง */
function chartDonut(holder, items, center, opts) {
  opts = opts || {};
  var total = items.reduce(function (s, x) { return s + x.value; }, 0);
  var c = ec(holder, {
    tooltip: { trigger: 'item', formatter: function (p) { return '<b>' + esc(p.name) + '</b><br>' + fmtInt(p.value) + ' (' + pct(p.value, total) + ')'; } },
    legend: { bottom: 0, formatter: function (n) { var x = items.filter(function (i) { return i.name === n; })[0]; return n + '  ' + fmtInt(x.value); } },
    title: center ? { text: center[0], subtext: center[1], left: 'center', top: '36%', textStyle: { fontSize: 24, fontWeight: 700, color: CH.ink(), fontFamily: CH.font }, subtextStyle: { color: CH.muted(), fontSize: 12, fontFamily: CH.font } } : null,
    series: [{ type: 'pie', radius: ['56%', '78%'], center: ['50%', '44%'], avoidLabelOverlap: true, padAngle: 1.5, itemStyle: { borderRadius: 5, borderColor: cssVar('--surface'), borderWidth: 2 },
      label: { show: false }, emphasis: { scaleSize: 4 }, data: items.filter(function (x) { return x.value > 0; }).map(function (x) { return { name: x.name, value: x.value, itemStyle: { color: x.color } }; }) }]
  }, opts.height || 280);
  if (c && opts.onClick) c.on('click', function (p) { opts.onClick(p.name); });
  return c;
}
/** สีตามเกณฑ์สำหรับแผนที่ความร้อน (ไล่ระดับในแต่ละช่วงสถานะ) */
function heatPieces() {
  var st = S.settings;
  return [
    { lt: st.RED_MAX - 5, color: hexA(CH.lv('R'), 0.92), label: '< ' + (st.RED_MAX - 5) },
    { gte: st.RED_MAX - 5, lt: st.RED_MAX, color: hexA(CH.lv('R'), 0.55), label: (st.RED_MAX - 5) + '–' + st.RED_MAX },
    { gte: st.RED_MAX, lt: (st.RED_MAX + st.YELLOW_MAX) / 2, color: hexA(CH.lv('Y'), 0.75), label: st.RED_MAX + '–' + ((st.RED_MAX + st.YELLOW_MAX) / 2) },
    { gte: (st.RED_MAX + st.YELLOW_MAX) / 2, lte: st.YELLOW_MAX, color: hexA(CH.lv('Y'), 0.4), label: ((st.RED_MAX + st.YELLOW_MAX) / 2) + '–' + st.YELLOW_MAX },
    { gt: st.YELLOW_MAX, lte: 95, color: hexA(CH.lv('G'), 0.5), label: st.YELLOW_MAX + '–95' },
    { gt: 95, color: hexA(CH.lv('G'), 0.9), label: '> 95' }
  ];
}
/** แผนที่ความร้อน · cells: [[xi, yi, value, tipHtml]] */
function chartHeat(holder, xs, ys, cells, opts) {
  opts = opts || {};
  var c = ec(holder, {
    grid: { left: 8, right: 10, top: 8, bottom: 56, containLabel: true },
    tooltip: { trigger: 'item', formatter: function (p) { var d = cells[p.dataIndex]; return d[3] || ('<b>' + esc(ys[d[1]]) + ' · ' + esc(xs[d[0]]) + '</b><br>' + fmt(d[2], 2)); } },
    xAxis: { type: 'category', data: xs, axisLabel: { color: CH.ink2(), interval: 0, rotate: xs.length > 6 ? 35 : 0, width: 110, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false } },
    yAxis: { type: 'category', data: ys, inverse: true, axisLabel: { color: CH.ink2(), width: opts.labelWidth || 160, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { type: 'piecewise', pieces: opts.pieces || heatPieces(), orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { color: CH.muted(), fontSize: 11 }, dimension: 2 },
    series: [{ type: 'heatmap', data: cells.map(function (d) { return [d[0], d[1], d[2] === null ? '-' : Math.round(d[2] * 10) / 10]; }), itemStyle: { borderColor: cssVar('--surface'), borderWidth: 2, borderRadius: 4 },
      label: { show: xs.length * ys.length <= 260, color: CH.ink(), fontSize: 11, formatter: function (p) { return p.value[2] === '-' ? '' : fmt(p.value[2], opts.d === undefined ? 1 : opts.d) + (opts.suffix || ''); } }, emphasis: { itemStyle: { borderColor: CH.ink(), borderWidth: 1 } } }]
  }, opts.height || Math.max(220, ys.length * 30 + 90));
  if (c && opts.onClick) c.on('click', function (p) { opts.onClick(cells[p.dataIndex]); });
  return c;
}
/** Treemap: ขนาด = จำนวนคน สี = คะแนนเฉลี่ยตามเกณฑ์ · nodes: [{name, value, score, children}] */
function chartTreemap(holder, nodes, opts) {
  opts = opts || {};
  var color = function (s) { if (s === null || s === undefined) return CH.lv('INC'); var l = lv(s); return hexA(CH.lv(l === 'INC' || l === 'ERR' ? 'INC' : l), l === 'Y' ? 0.75 : 0.82); };
  var map = function (n) { return { name: n.name, value: n.value, score: n.score, red: n.red, itemStyle: { color: color(n.score), borderColor: cssVar('--surface') }, children: n.children ? n.children.map(map) : undefined }; };
  var c = ec(holder, {
    tooltip: { formatter: function (p) { var d = p.data; return '<b>' + esc(d.name) + '</b><br>' + fmtInt(d.value) + ' คน · เฉลี่ย ' + fmt(d.score, 2) + (d.red !== undefined ? '<br>ต่ำกว่าเกณฑ์ ' + fmtInt(d.red) + ' คน' : ''); } },
    series: [{ type: 'treemap', name: opts.rootName || 'ทั้งหมด', roam: false, nodeClick: opts.drill === false ? false : 'zoomToNode', width: '100%', height: '88%', top: 0, breadcrumb: { show: true, bottom: 0, height: 24, emptyItemWidth: 40, itemStyle: { color: cssVar('--surface-2'), borderColor: cssVar('--line-2'), textStyle: { color: CH.ink(), fontFamily: CH.font } } },
      label: { show: true, formatter: function (p) { return p.data.name + '\n' + fmt(p.data.score, 1); }, color: '#0b0b0b', fontSize: 12, fontFamily: CH.font, lineHeight: 16 },
      upperLabel: { show: true, height: 22, color: CH.ink(), fontFamily: CH.font, backgroundColor: 'transparent' },
      itemStyle: { borderColor: cssVar('--surface'), borderWidth: 2, gapWidth: 2, borderRadius: 4 },
      levels: [{ itemStyle: { borderWidth: 3, gapWidth: 3, borderColor: cssVar('--surface-2') } }, { itemStyle: { gapWidth: 2 } }],
      data: nodes.map(map) }]
  }, opts.height || 380);
  return c;
}
/** Box plot การกระจายคะแนนรายคน · groups: [{name, q:[min,q1,med,q3,max], n}] */
function chartBox(holder, groups, opts) {
  opts = opts || {};
  var st = S.settings;
  var c = ec(holder, {
    grid: { left: 8, right: 60, top: 26, bottom: 10 },
    tooltip: { trigger: 'item', formatter: function (p) { var g = groups[p.dataIndex]; return '<b>' + esc(g.name) + '</b> (' + fmtInt(g.n) + ' คน)<br>สูงสุด ' + fmt(g.q[4], 2) + '<br>ควอไทล์ 3: ' + fmt(g.q[3], 2) + '<br><b>มัธยฐาน ' + fmt(g.q[2], 2) + '</b><br>ควอไทล์ 1: ' + fmt(g.q[1], 2) + '<br>ต่ำสุด ' + fmt(g.q[0], 2); } },
    xAxis: axisStyle({ type: 'category', data: groups.map(function (g) { return g.name; }), splitLine: { show: false }, axisLabel: { color: CH.ink2(), interval: 0, rotate: groups.length > 6 ? 30 : 0, width: 100, overflow: 'truncate' } }),
    yAxis: axisStyle({ type: 'value', min: opts.min || 50, max: 100 }),
    series: [{ type: 'boxplot', data: groups.map(function (g) { return g.q; }), boxWidth: [8, 34], itemStyle: { color: hexA(CH.col('brand'), 0.18), borderColor: CH.col('brand'), borderWidth: 1.5 },
      markLine: { silent: true, symbol: 'none', label: { formatter: '{b}', color: CH.muted(), fontSize: 11 }, data: [{ yAxis: st.RED_MAX, name: 'เกณฑ์ ' + st.RED_MAX, lineStyle: { color: CH.lv('R'), type: 'dashed' } }, { yAxis: st.YELLOW_MAX, name: st.YELLOW_MAX, lineStyle: { color: CH.lv('G'), type: 'dashed' } }] } }]
  }, opts.height || 320);
  return c;
}
/** Scatter/Bubble · points: [{name, x, y, size, color}] */
function chartScatter(holder, points, opts) {
  opts = opts || {};
  var maxS = points.reduce(function (m, p) { return Math.max(m, p.size || 1); }, 1);
  var c = ec(holder, {
    grid: { left: 8, right: 24, top: 24, bottom: 34 },
    tooltip: { trigger: 'item', formatter: function (p) { var d = points[p.dataIndex]; return d.tip || ('<b>' + esc(d.name) + '</b><br>' + opts.xName + ': ' + fmt(d.x, 2) + '<br>' + opts.yName + ': ' + fmt(d.y, 1)); } },
    xAxis: axisStyle({ type: 'value', name: opts.xName, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: CH.muted() }, min: opts.xMin, max: opts.xMax, scale: true }),
    yAxis: axisStyle({ type: 'value', name: opts.yName, nameTextStyle: { color: CH.muted(), align: 'left' }, min: opts.yMin, max: opts.yMax, scale: true, axisLabel: { formatter: opts.yUnit === '%' ? '{value}%' : '{value}', color: CH.muted() } }),
    series: [{ type: 'scatter', data: points.map(function (p) { return { value: [p.x, p.y], name: p.name, itemStyle: { color: p.color || CH.col('brand'), opacity: 0.85, borderColor: cssVar('--surface'), borderWidth: 1.5 } }; }),
      symbolSize: function (v, p) { var s = points[p.dataIndex].size || 1; return 10 + Math.sqrt(s / maxS) * 30; },
      label: { show: points.length <= 40, position: 'right', formatter: function (p) { return points[p.dataIndex].short || ''; }, color: CH.ink2(), fontSize: 11 },
      markLine: opts.lines ? { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: CH.muted() }, label: { formatter: '{b}', color: CH.muted(), fontSize: 11 }, data: opts.lines } : null }]
  }, opts.height || 360);
  if (c && opts.onClick) c.on('click', function (p) { opts.onClick(points[p.dataIndex]); });
  return c;
}
/** Radar · axes: [names] · series: [{name, values, color, dashed}] */
function chartRadar(holder, axes, series, opts) {
  opts = opts || {};
  var c = ec(holder, {
    tooltip: { trigger: 'item', formatter: function (p) { return '<b>' + esc(p.name) + '</b>' + axes.map(function (a, i) { return tipRow(series[p.dataIndex] ? series[p.dataIndex].color : '#999', a, p.value[i] === null || p.value[i] === undefined ? '–' : fmt(p.value[i], 2)); }).join(''); } },
    legend: { show: series.length > 1 },
    radar: { indicator: axes.map(function (a) { return { name: trunc(a, 18), max: 100, min: opts.min || 50 }; }), radius: '64%', center: ['50%', '48%'], splitNumber: 5, axisName: { color: CH.ink2(), fontFamily: CH.font, fontSize: 11.5 },
      splitLine: { lineStyle: { color: cssVar('--grid') } }, splitArea: { areaStyle: { color: ['transparent'] } }, axisLine: { lineStyle: { color: cssVar('--grid') } } },
    series: [{ type: 'radar', symbolSize: 6, data: series.map(function (s) { return { name: s.name, value: s.values, lineStyle: { color: s.color, width: 2, type: s.dashed ? 'dashed' : 'solid' }, itemStyle: { color: s.color }, areaStyle: s.dashed ? null : { color: hexA(s.color, 0.16) } }; }) }]
  }, opts.height || 340);
  return c;
}
/** Sankey: การย้ายระดับระหว่างรอบ · flows: {R:{R:n,Y:n,G:n}, ...} */
function chartSankey(holder, A, B, flows, opts) {
  opts = opts || {};
  var L = ['R', 'Y', 'G'], nodes = [], links = [];
  L.forEach(function (k) { nodes.push({ name: A + ' · ' + LV_LABEL[k], itemStyle: { color: CH.lv(k) } }); });
  L.forEach(function (k) { nodes.push({ name: B + ' · ' + LV_LABEL[k] + ' ', itemStyle: { color: CH.lv(k) } }); });
  L.forEach(function (a) { L.forEach(function (b) { if (flows[a][b]) links.push({ source: A + ' · ' + LV_LABEL[a], target: B + ' · ' + LV_LABEL[b] + ' ', value: flows[a][b], lineStyle: { color: L.indexOf(b) > L.indexOf(a) ? CH.lv('G') : L.indexOf(b) < L.indexOf(a) ? CH.lv('R') : cssVar('--line-2'), opacity: 0.38 } }); }); });
  return ec(holder, {
    tooltip: { trigger: 'item', formatter: function (p) { return p.dataType === 'edge' ? esc(p.data.source) + ' → ' + esc(p.data.target.trim()) + '<br><b>' + fmtInt(p.data.value) + ' คน</b>' : '<b>' + esc(p.name.trim()) + '</b><br>' + fmtInt(p.value) + ' คน'; } },
    series: [{ type: 'sankey', left: 8, right: 175, top: 10, bottom: 10, nodeWidth: 16, nodeGap: 14, draggable: false, data: nodes, links: links, emphasis: { focus: 'adjacency' },
      label: { color: CH.ink(), fontFamily: CH.font, fontSize: 12, formatter: function (p) { return p.name.trim() + '  ' + fmtInt(p.value); } }, lineStyle: { curveness: 0.5 } }]
  }, opts.height || 320);
}
/** Histogram · bins: [{lo, hi, n}] */
function chartHist(holder, bins, opts) {
  opts = opts || {};
  var c = ec(holder, {
    grid: { left: 8, right: 16, top: 22, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) { var b = bins[ps[0].dataIndex]; return (opts.rangeLabel ? opts.rangeLabel(b) : fmt(b.lo, 0) + '–' + fmt(b.hi, 0)) + '<br><b>' + fmtInt(b.n) + ' ' + (opts.unit || 'คน') + '</b>'; } },
    xAxis: axisStyle({ type: 'category', data: bins.map(function (b) { return opts.rangeLabel ? opts.rangeLabel(b) : String(b.lo); }), splitLine: { show: false }, axisLabel: { color: CH.muted(), interval: opts.interval === undefined ? 'auto' : opts.interval } }),
    yAxis: axisStyle({ type: 'value', minInterval: 1 }),
    series: [{ type: 'bar', barCategoryGap: '8%', data: bins.map(function (b) { return { value: b.n, itemStyle: { color: opts.colorOf ? opts.colorOf(b) : CH.col('brand'), borderRadius: [3, 3, 0, 0] } }; }) }]
  }, opts.height || 260);
  return c;
}
/** Slope chart: เทียบ 2 รอบรายกลุ่ม · rows: [{name, a, b}] */
function chartSlope(holder, rows, A, B, opts) {
  opts = opts || {};
  var band = S.settings.SAME_BAND || 0.5;
  var all = []; rows.forEach(function (r) { all.push(r.a, r.b); });
  var mn = Math.floor(Math.min.apply(null, all) - 1), mx = Math.ceil(Math.max.apply(null, all) + 1);
  return ec(holder, {
    grid: { left: 70, right: 170, top: 26, bottom: 16 },
    tooltip: { trigger: 'item', formatter: function (p) { var r = rows[p.seriesIndex]; return '<b>' + esc(r.name) + '</b><br>' + esc(A) + ': ' + fmt(r.a, 2) + '<br>' + esc(B) + ': ' + fmt(r.b, 2) + '<br>เปลี่ยน ' + signed(r.b - r.a, 2); } },
    xAxis: { type: 'category', data: [A, B], boundaryGap: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: CH.ink(), fontWeight: 600, fontFamily: CH.font }, position: 'top', splitLine: { show: true, lineStyle: { color: cssVar('--axis') } } },
    yAxis: axisStyle({ type: 'value', min: mn, max: mx, splitLine: { show: false }, axisLine: { show: false } }),
    series: rows.map(function (r) {
      var d = r.b - r.a, col = d > band ? cssVar('--up') : d < -band ? cssVar('--down') : CH.muted();
      return { type: 'line', data: [r.a, r.b], symbol: 'circle', symbolSize: 8, lineStyle: { color: col, width: 2 }, itemStyle: { color: col }, emphasis: { focus: 'series' },
        endLabel: { show: true, formatter: trunc(r.name, 18) + '  ' + signed(d, 1), color: CH.ink2(), fontSize: 11, fontFamily: CH.font } };
    })
  }, opts.height || Math.max(260, rows.length * 22 + 60));
}
/** เส้นเล็กในการ์ด (sparkline) */
function chartSpark(holder, values, color) {
  return ec(holder, {
    grid: { left: 2, right: 2, top: 4, bottom: 2 }, tooltip: { show: false }, legend: { show: false },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map(function (v, i) { return i; }) }, yAxis: { type: 'value', show: false, min: function (v) { return v.min - 1; }, max: function (v) { return v.max + 1; } },
    series: [{ type: 'line', data: values, smooth: 0.3, symbol: 'circle', symbolSize: function (v, p) { return p.dataIndex === values.length - 1 ? 7 : 0; }, lineStyle: { color: color, width: 2 }, itemStyle: { color: color }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: hexA(color, 0.25) }, { offset: 1, color: hexA(color, 0) }] } }, silent: true }]
  }, 38);
}
/** เกจครึ่งวง (คะแนนเทียบเกณฑ์) */
function chartGauge(holder, value, label, opts) {
  opts = opts || {};
  var st = S.settings, lo = 50;
  var seg = function (v) { return (v - lo) / (100 - lo); };
  return ec(holder, {
    series: [{ type: 'gauge', min: lo, max: 100, startAngle: 200, endAngle: -20, radius: '96%', center: ['50%', '62%'], splitNumber: 5,
      axisLine: { lineStyle: { width: 12, color: [[seg(st.RED_MAX), CH.lv('R')], [seg(st.YELLOW_MAX), CH.lv('Y')], [1, CH.lv('G')]] } },
      pointer: { width: 5, length: '58%', itemStyle: { color: CH.ink() } }, anchor: { show: true, size: 10, itemStyle: { color: CH.ink() } },
      axisTick: { show: false }, splitLine: { length: 10, lineStyle: { color: cssVar('--surface'), width: 2 } }, axisLabel: { color: CH.muted(), distance: 16, fontSize: 10 },
      title: { offsetCenter: [0, '38%'], color: CH.muted(), fontSize: 12, fontFamily: CH.font },
      detail: { valueAnimation: true, offsetCenter: [0, '12%'], fontSize: 22, fontWeight: 700, color: CH.ink(), fontFamily: CH.font, formatter: function (v) { return value === null ? '–' : fmt(v, 2); } },
      data: [{ value: value === null ? lo : value, name: label }] }]
  }, opts.height || 190);
}
