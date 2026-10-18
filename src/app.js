/* Trang đề xuất Future X Shield. Mọi con số do SE (engine/engine.js) tính; file này chỉ hiển thị.
   Không gửi gì ra mạng, không cookie. localStorage chỉ nhớ ngôn ngữ, đọc/ghi trong try/catch. */
(function () {
  'use strict';
  var YELLOW = 5, RED = 3, SCALE = 0.30;
  var lang = 'vi';
  try { var saved = localStorage.getItem('fxs-lang'); if (saved === 'vi' || saved === 'en') lang = saved; } catch (e) { /* trình duyệt chặn: dùng mặc định */ }

  /* ---------- chữ và số ---------- */
  function t(key, vars) {
    var s = I18N[lang][key];
    if (s == null) { console.error('[fxs] thiếu khoá i18n: ' + lang + '.' + key); return key; }
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function fmt(x, d) {
    return Number(x).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(x) { return x == null ? t('score.out') : (x <= 0 ? t('score.breach') : fmt(x * 100, 1) + '%'); }
  /* trong câu: "> 30% (ngoài phạm vi mô phỏng)" */
  function pctIn(x) { return x == null ? '&gt; 30% (' + t('score.out') + ')' : pct(x); }
  function big(x) { return x == null ? '<b>&gt; 30%</b><small>' + t('score.out') + '</small>' : '<b>' + pct(x) + '</b>'; }
  function toneOf(sc) { var lv = SE.level(sc.min, YELLOW, RED); return lv === 'violated' ? 'red' : lv; }
  function toneLabel(sc) { return t('tone.' + SE.level(sc.min, YELLOW, RED)); }
  var CELL = { 'Két sắt': 'cell.safe', 'Dao hai lưỡi': 'cell.double', 'Món chết': 'cell.dead', 'Quả bom': 'cell.bomb',
    'Đứng ngoài': 'cell.out', 'Mối nguy kế tiếp': 'cell.next', 'Vết thương cũ': 'cell.old', 'Thủ phạm chính': 'cell.main' };
  function cellName(vn) { return t(CELL[vn]); }
  function cellHeat(vn) {
    if (vn === 'Thủ phạm chính' || vn === 'Quả bom') return 'hot';
    if (vn === 'Mối nguy kế tiếp' || vn === 'Dao hai lưỡi') return 'warm';
    return 'cool';
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function memo(fn) { var c = {}; return function (k) { return c.hasOwnProperty(k) ? c[k] : (c[k] = fn(k)); }; }

  /* ---------- thước giá hai chiều ---------- */
  function rulerHTML() {
    var ticks = '', scale = '';
    [-30, -20, -10, 10, 20, 30].forEach(function (p) {
      var edge = p === -30 ? ' edge-l' : (p === 30 ? ' edge-r' : '');
      scale += '<span class="r-scale' + edge + '" style="left:' + (50 + p / 30 * 50) + '%">' + (p > 0 ? '+' : '−') + Math.abs(p) + '%</span>';
    });
    [YELLOW, RED].forEach(function (m) {
      ['-', '+'].forEach(function (sg) {
        var x = 50 + (sg === '-' ? -1 : 1) * m / 100 / SCALE * 50;
        ticks += '<span class="r-tick t' + m + '" style="left:' + x + '%"></span>';
      });
    });
    return '<div class="ruler">' +
      '<div class="r-labels"><p class="r-down"><span class="r-k"></span><b class="r-v"></b><span class="r-sub"></span></p>' +
      '<p class="r-tone"><span class="chip"></span></p>' +
      '<p class="r-up"><span class="r-k"></span><b class="r-v"></b><span class="r-sub"></span></p></div>' +
      '<div class="r-track"><div class="r-seg r-segd"></div><div class="r-seg r-segu"></div>' + ticks +
      '<span class="r-ref"></span></div>' +
      '<div class="r-foot">' + scale + '<span class="r-price">2.000</span></div></div>';
  }
  function updateRuler(slot, sc, price) {
    if (!slot.firstChild) slot.innerHTML = rulerHTML();
    var tone = toneOf(sc);
    var dw = (sc.down == null ? SCALE : Math.min(sc.down, SCALE)) / SCALE * 50;
    var uw = (sc.up == null ? SCALE : Math.min(sc.up, SCALE)) / SCALE * 50;
    var d = $('.r-segd', slot), u = $('.r-segu', slot);
    d.style.width = dw + '%'; d.style.left = (50 - dw) + '%';
    u.style.width = uw + '%'; u.style.left = '50%';
    d.className = 'r-seg r-segd ' + (sc.dir === 1 ? 'near ' + tone : 'far') + (sc.down == null ? ' open' : '');
    u.className = 'r-seg r-segu ' + (sc.dir === -1 ? 'near ' + tone : 'far') + (sc.up == null ? ' open' : '');
    $('.r-down .r-k', slot).textContent = t('score.down');
    /* Dò quá 30% thì ghi "> 30%" và chú thích "ngoài phạm vi mô phỏng" (brief 4.1). */
    [['.r-down', sc.down], ['.r-up', sc.up]].forEach(function (q) {
      $(q[0] + ' .r-v', slot).textContent = q[1] == null ? '> 30%' : pct(q[1]);
      $(q[0] + ' .r-sub', slot).textContent = q[1] == null ? t('score.out') : '';
    });
    $('.r-up .r-k', slot).textContent = t('score.up');
    var chip = $('.chip', slot); chip.textContent = toneLabel(sc); chip.className = 'chip ' + tone;
    $('.r-price', slot).textContent = fmt(price == null ? 2000 : price, price == null ? 0 : 1);
    slot.setAttribute('data-down', sc.down == null ? 'null' : sc.down.toFixed(4));
    slot.setAttribute('data-up', sc.up == null ? 'null' : sc.up.toFixed(4));
  }

  /* ---------- Demo: lúc đặt lệnh ---------- */
  var atl = { code: 'VN30F1M', side: 1, qty: 2 };
  var atlCalc = memo(function (key) {
    var p = key.split('|'), side = +p[0], qty = +p[1], code = p[2];
    var base = SE.atlAccount(), before = SE.score(base), r = SE.order(base, side, qty, code);
    var after = r.ok ? SE.score(r.acc) : null;
    var green = after && (after.min == null || after.min * 100 >= YELLOW);
    return { base: base, before: before, r: r, after: after, green: green,
      conds: r.ok && !green ? SE.conditions(base, side, qty, code, YELLOW) : null };
  });
  function scoreRow(label, sc, cls) {
    var tone = toneOf(sc);
    return '<div class="sc-row ' + cls + '"><p class="sc-l">' + label + '</p>' +
      '<p class="sc-v"><span class="dir">↓</span><span>' + big(sc.down) + '</span></p>' +
      '<p class="sc-v"><span class="dir">↑</span><span>' + big(sc.up) + '</span></p>' +
      '<p><span class="chip ' + tone + '">' + toneLabel(sc) + '</span></p></div>';
  }
  function renderATL() {
    $$('[data-code]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.code === atl.code)); });
    $$('[data-side]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.side === atl.side)); });
    $('#atl-qty').textContent = atl.qty + ' ' + t('unit.hd');
    $('[data-step="-1"]').disabled = atl.qty <= 1; $('[data-step="1"]').disabled = atl.qty >= 6;
    $('#atl-note').textContent = t('atl.note', { dep: fmt(SE.depositFor(1, 2000), 2) });
    var c = atlCalc([atl.side, atl.qty, atl.code].join('|')), r = c.r, a = r.acc;
    var h = '<h2>' + t('atl.card') + '</h2>' + scoreRow(t('atl.before'), c.before, 'before');
    if (!r.ok) {
      h += '<p class="fail">' + t('atl.fail', { need: fmt(r.need || 0, 2) }) + '</p>';
    } else {
      h += scoreRow(t('atl.after'), c.after, 'after');
      var closed = r.closed.length ? t('atl.closed', { ids: r.closed.join(', #') }) : '';
      h += '<p class="explain">' + closed + t('atl.explain', { n: a.deals.length,
        dir: t(c.after.dir === -1 ? 'atl.dir.up' : 'atl.dir.down'), x: pct(c.after.min) }) + '</p>';
      var sorted = a.deals.slice().sort(function (x, y) { return SE.head(x, a.P) - SE.head(y, a.P); });
      h += '<h3>' + t('atl.deals') + '</h3><ul class="deal-list">' + sorted.map(function (d) {
        return '<li><b>#' + d.id + '</b><span>' + d.code + ' ' + (d.s === 1 ? 'long' : 'short') + ' ' + d.n + ' ' + t('unit.hd') +
          (d.fresh ? ' <em>' + t('atl.deal.new') + '</em>' : '') + '</span><span>' + t('atl.deal.ratio') + ' ' + fmt(SE.ratio(d, a.P) * 100, 2) + '%</span>' +
          '<span>' + t('atl.deal.head') + ' ' + fmt(SE.head(d, a.P), 2) + ' ' + t('unit.m') + '</span></li>';
      }).join('') + '</ul>';
      if (c.green) h += '<p class="ok">' + t('atl.green') + '</p>';
      if (c.conds) {
        var k = c.conds, rows = [];
        if (k.deposit) rows.push([t('atl.c.dep', { amt: fmt(Math.round(k.deposit.amount), 0) }), k.deposit.score]);
        if (k.closeOne) rows.push([t('atl.c.close', { id: k.closeOne.id }), k.closeOne.score]);
        if (k.maxQty) rows.push([k.maxQty.n === 0 ? t('atl.c.none') : t('atl.c.max', { n: k.maxQty.n }), k.maxQty.score]);
        h += '<h3>' + t('atl.conds') + '</h3><ul class="conds">' + rows.map(function (rw) {
          return '<li><p>' + rw[0] + '</p><p>' + t('atl.c.then') + ' ' + t('score.down') + ' <b>' + pctIn(rw[1].down) + '</b>, ' +
            t('score.up') + ' <b>' + pctIn(rw[1].up) + '</b></p></li>';
        }).join('') + '</ul><p class="note">' + t('atl.c.foot') + '</p>';
      }
    }
    h += '<p class="disclaim">' + t('demo.notadvice') + '</p>';
    var card = $('#atl-card');
    card.innerHTML = h;
    card.setAttribute('data-after-down', c.after && c.after.down != null ? c.after.down.toFixed(4) : 'null');
  }

  /* ---------- Demo: Shield hai chiều ---------- */
  var sh = { view: 'now' };
  var shCalc = memo(function (v) {
    var acc = SE.demoAccount();
    if (v === 'order') acc = SE.order(acc, 1, 1, 'VN30F1M').acc;
    var sc = SE.score(acc);
    return { acc: acc, sc: sc, ax: SE.axes(acc, sc.dir || 1) };
  });
  function renderShield() {
    $$('[data-shview]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.shview === sh.view)); });
    var c = shCalc(sh.view), sc = c.sc, ax = c.ax, n = ax.length;
    updateRuler($('[data-ruler="shield"]'), sc);
    var pair = toneOf(sc) === 'red' ? 'AC' : 'AB';
    $('#sh-pair').textContent = t(pair === 'AB' ? 'sh.pair.ab' : 'sh.pair.ac');
    $('#sh-why').textContent = t(pair === 'AB' ? 'sh.pair.why.ab' : 'sh.pair.why.ac');
    var bMax = Math.max(0.02, Math.max.apply(null, ax.map(function (r) { return Math.abs(r.B); })) * 1.3);
    function xPct(A) { return 6 + ((A == null ? 0 : A) + 1) / 2 * 88; }
    function yPct(r) { return pair === 'AB' ? 6 + (bMax - r.B) / (2 * bMax) * 88 : 6 + (1 - (r.C == null ? 0 : r.C)) * 88; }
    var my = pair === 'AB' ? 50 : 6 + (1 - 1 / Math.max(1, n)) * 88;
    var names = pair === 'AB' ? [['Két sắt', 'Dao hai lưỡi'], ['Món chết', 'Quả bom']] : [['Vết thương cũ', 'Thủ phạm chính'], ['Đứng ngoài', 'Mối nguy kế tiếp']];
    var h = '';
    [0, 1].forEach(function (row) { [0, 1].forEach(function (col) {
      var nm = names[row][col];
      h += '<div class="m-cell ' + cellHeat(nm) + (col ? ' right' : '') + (row ? ' bottom' : '') + '" style="left:' + (col ? 50 : 0) + '%;width:50%;top:' +
        (row ? my : 0) + '%;height:' + (row ? 100 - my : my) + '%"><span>' + cellName(nm) + '</span></div>';
    }); });
    ax.forEach(function (r) {
      var size = Math.round(24 + r.w * 34), nm = SE.cell(r, pair, n);
      h += '<span class="dot ' + cellHeat(nm) + '" style="left:' + xPct(r.A) + '%;top:' + yPct(r) + '%;width:' + size + 'px;height:' + size +
        'px;margin:' + (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px" title="Deal #' + r.id + '">' + r.id + '</span>';
    });
    h += '<span class="m-ax x">' + t('sh.axis.a') + '</span><span class="m-ax y">' + t(pair === 'AB' ? 'sh.axis.b' : 'sh.axis.c') + ' ↑</span>';
    $('#sh-matrix').innerHTML = h;
    var tb = '<thead><tr><th>' + t('sh.tbl.deal') + '</th><th>' + t('sh.tbl.a') + '</th><th>' + t('sh.tbl.b') + '</th><th>' + t('sh.tbl.c') + '</th><th>' + t('sh.tbl.cell') + '</th></tr></thead><tbody>';
    ax.forEach(function (r) {
      var d = c.acc.deals.filter(function (x) { return x.id === r.id; })[0];
      tb += '<tr><td><b>#' + r.id + '</b> ' + d.code + ' ' + (d.s === 1 ? 'long' : 'short') + ' ' + d.n + ' ' + t('unit.hd') + '</td>' +
        '<td>' + (r.A == null ? '—' : fmt(r.A * 100, 1) + '%') + '</td>' +
        '<td>' + (r.B >= 0 ? '+' : '−') + fmt(Math.abs(r.B) * 100, 2) + '%</td>' +
        '<td>' + (r.C == null ? t('sh.c.none') : fmt(r.C * 100, 0) + '%') + '</td>' +
        '<td>' + cellName(SE.cell(r, pair, n)) + '</td></tr>';
    });
    $('#sh-table').innerHTML = tb + '</tbody>';
  }

  /* ---------- Demo: viễn cảnh ---------- */
  var scn = { steps: [], face: 'auto' };
  function applyStep(a, s) {
    if (s.type === 'long') return SE.order(a, 1, 1, 'VN30F1M');
    if (s.type === 'short') return SE.order(a, -1, 1, 'VN30F2M');
    if (s.type === 'close') return { ok: true, acc: SE.close(a, s.id) };
    if (s.type === 'deposit') return { ok: true, acc: SE.deposit(a, s.amt) };
    return { ok: true, acc: SE.move(a, s.pct) };
  }
  function stepLabel(s) {
    if (s.type === 'long') return t('sc.s.long');
    if (s.type === 'short') return t('sc.s.short');
    if (s.type === 'close') return t('sc.s.close', { id: s.id });
    if (s.type === 'deposit') return t('sc.s.dep', { amt: s.amt });
    return t(s.pct < 0 ? 'sc.s.down' : 'sc.s.up', { p: Math.abs(s.pct) });
  }
  var runChain = memo(function (key) {
    var steps = JSON.parse(key), a = SE.demoAccount(), list = [{ step: null, sc: SE.score(a), ok: true }];
    steps.forEach(function (s) {
      var r = applyStep(a, s);
      if (r.ok) a = r.acc;
      list.push({ step: s, sc: SE.score(a), ok: r.ok });
    });
    return { acc: a, list: list };
  });
  function shortTxt(sc) {
    function one(x) { return x == null ? '>30%' : (x <= 0 ? '0' : fmt(x * 100, 1) + '%'); }
    return '↓' + one(sc.down) + ' ↑' + one(sc.up);
  }
  var scCube = null;
  function renderScenario() {
    var res = runChain(JSON.stringify(scn.steps)), a = res.acc, last = res.list[res.list.length - 1].sc;
    var tone = toneOf(last);
    $('#sc-chain').innerHTML = res.list.map(function (it) {
      var lbl = it.step ? stepLabel(it.step) + (it.ok ? '' : t('sc.s.skip')) : t('sc.start');
      return '<li class="' + (it.ok ? '' : 'skipped') + '"><span>' + lbl + '</span><span class="cs"><span class="chip ' + toneOf(it.sc) + '">' +
        toneLabel(it.sc) + '</span> <b>' + shortTxt(it.sc) + '</b></span></li>';
    }).join('');
    $('#sc-state').textContent = t('sc.state', { p: fmt(a.P, 1), f: fmt(a.F, 2), n: a.deals.length });
    var pr = $('#sc-processed');
    pr.hidden = !a.processed.length;
    if (a.processed.length) pr.textContent = t('sc.processed', { ids: a.processed.join(', #') });
    $('#sc-closers').innerHTML = a.deals.map(function (d) {
      return '<button type="button" data-close="' + d.id + '">' + t('sc.b.close', { id: d.id }) + '</button>';
    }).join('');
    $('#sc-undo').disabled = $('#sc-reset').disabled = scn.steps.length === 0;
    $$('[data-face]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.face === scn.face)); });
    if (!scCube) scCube = Cube3D.mount($('#sc-cube'), {});
    var cd = cubePoints(a, last.dir);
    scCube.update(cd.pts, { bMax: cd.bMax, n: cd.n, face: scn.face, tone: tone, labels: cubeLabels() });
  }

  /* ---------- khối 3D dùng chung ---------- */
  function cubeLabels() {
    return { a: t('cube.a'), b: t('cube.b'), c: t('cube.c'), hint: t('cube.hint'),
      cells: ['Két sắt', 'Dao hai lưỡi', 'Món chết', 'Quả bom'].map(cellName),
      cellsAC: ['Vết thương cũ', 'Thủ phạm chính', 'Đứng ngoài', 'Mối nguy kế tiếp'].map(cellName) };
  }
  function cubePoints(acc, dir) {
    var ax = SE.axes(acc, dir || 1), n = ax.length;
    var bMax = Math.max(0.02, Math.max.apply(null, ax.map(function (r) { return Math.abs(r.B); }).concat([0])) * 1.3);
    return { n: n, bMax: bMax, pts: ax.map(function (r) {
      return { id: r.id, A: r.A, B: r.B, C: r.C, w: r.w, heat: cellHeat(SE.cell(r, 'AC', n)),
        title: t('cube.title', { id: r.id, a: r.A == null ? '—' : fmt(r.A * 100, 1) + '%',
          b: (r.B >= 0 ? '+' : '−') + fmt(Math.abs(r.B) * 100, 2) + '%', c: r.C == null ? t('sh.c.none') : fmt(r.C * 100, 0) + '%' }) };
    }) };
  }

  /* ---------- Demo: danh mục thật trên giá VN30F1M theo ngày ---------- */
  var BARS = VN30F1M.map(function (r) { return { ngay: r[0], mo: r[1], cao: r[2], thap: r[3], dong: r[4] }; });
  function ix(d) { for (var i = 0; i < BARS.length; i++) if (BARS[i].ngay >= d) return i; return BARS.length - 1; }
  var PRESETS = TL.PRESETS;
  var pt = { preset: 'A', mine: [], t: null, face: 'auto', sel: null };
  var ptCube = null;
  function ptPlan() {
    var P = PRESETS[pt.preset];
    return { F0: P.F0, auto: true, start: ix(P.from), end: ix(P.to),
      actions: P.orders.map(function (o) { return { t: ix(o[0]), type: 'open', s: o[1], code: o[2], n: 1, src: 'preset' }; }).concat(pt.mine) };
  }
  var ptRun = memo(function (key) {
    var plan = JSON.parse(key), res = TL.run(BARS, plan);
    res.scores = res.snaps.map(function (sn) { return sn.deals.length ? SE.score({ P: sn.P, F: sn.F, deals: sn.deals }) : null; });
    res.plan = plan;
    return res;
  });
  function lvOf(sc) { return sc ? SE.level(sc.min, YELLOW, RED) : 'none'; }
  function isRed(sc) { var l = lvOf(sc); return l === 'red' || l === 'violated'; }
  function fmtDate(i, short) {
    var d = new Date(BARS[i].ngay + 'T00:00:00');
    if (short) { var p = BARS[i].ngay.split('-'); return p[2] + '/' + p[1]; }
    return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', lang === 'vi' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function signedPct(x, d) { return (x >= 0 ? '+' : '−') + fmt(Math.abs(x) * 100, d == null ? 1 : d) + '%'; }
  function sideTxt(s) { return s === 1 ? 'long' : 'short'; }

  function ptInsight(res) {
    var L = res.liquidated, s0 = res.plan.start;
    if (!L.length) return t('pt.i.none');
    var first = L[0], i = first.t - s0, prev = i > 0 ? res.scores[i - 1] : null, b = BARS[first.t];
    var lvPrev = lvOf(prev), xPrev = prev ? pct(prev.min) : t('score.out'), out;
    if (isRed(prev)) {
      var j = i - 1; while (j - 1 >= 0 && isRed(res.scores[j - 1])) j--;
      out = t('pt.i.warn', { d1: fmtDate(s0 + j), x: pct(res.scores[j].min), dL: fmtDate(first.t), id: first.id, p: fmt(first.price, 1), k: i - j });
    } else if (Math.abs(first.price - b.mo) < 1e-9) {
      out = t('pt.i.gap', { dL: fmtDate(first.t), g: signedPct(b.mo / BARS[first.t - 1].dong - 1), id: first.id, lv: '“' + t('tone.' + (lvPrev === 'none' ? 'green' : lvPrev)) + '”', x: xPrev });
    } else {
      out = t('pt.i.late', { dL: fmtDate(first.t), id: first.id, p: fmt(first.price, 1), lv: '“' + t('tone.' + (lvPrev === 'none' ? 'green' : lvPrev)) + '”', x: xPrev });
    }
    if (L.length > 1) out += ' ' + t('pt.i.more', { n: L.length });
    return out;
  }

  function ptChart(res) {
    var host = $('#pt-chart'), W = Math.max(320, host.clientWidth || 800), narrow = W < 560, H = narrow ? 210 : 240;
    var padL = narrow ? 38 : 50, padR = 10, padT = 14, bandH = 12, chartH = H - padT - bandH - 34;
    var s0 = res.plan.start, s1 = res.plan.end, N = s1 - s0 + 1, lo = Infinity, hi = -Infinity;
    for (var i = s0; i <= s1; i++) { lo = Math.min(lo, BARS[i].thap); hi = Math.max(hi, BARS[i].cao); }
    var padP = (hi - lo) * 0.06; lo -= padP; hi += padP;
    function x(i) { return padL + (i - s0 + 0.5) / N * (W - padL - padR); }
    function y(p) { return padT + (hi - p) / (hi - lo) * chartH; }
    var stepW = (W - padL - padR) / N, h = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + t('pt.chart') + '">';
    [0, 0.5, 1].forEach(function (f) {
      var p = lo + padP + (hi - lo - 2 * padP) * f, yy = y(p).toFixed(1);
      h += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" class="pc-grid"/><text x="' + (padL - 6) + '" y="' + (+yy + 4) + '" class="pc-ax" text-anchor="end">' + fmt(p, 0) + '</text>';
    });
    var lastMonth = '', lastX = -99;
    for (i = s0; i <= s1; i++) {
      var m = BARS[i].ngay.slice(0, 7);
      if (m !== lastMonth && x(i) - lastX > 44) { lastMonth = m; lastX = x(i); h += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 4) + '" class="pc-ax">' + BARS[i].ngay.slice(5, 7) + '/' + BARS[i].ngay.slice(2, 4) + '</text>'; }
    }
    var by = padT + chartH + 8;
    res.snaps.forEach(function (sn, k) {
      var l = lvOf(res.scores[k]);
      h += '<rect x="' + (x(sn.t) - stepW / 2).toFixed(1) + '" y="' + by + '" width="' + (stepW + 0.4).toFixed(1) + '" height="' + bandH + '" class="pc-band ' + (l === 'violated' ? 'red' : l) + '"/>';
    });
    h += '<polyline class="pc-line" points="' + res.snaps.map(function (sn) { return x(sn.t).toFixed(1) + ',' + y(BARS[sn.t].dong).toFixed(1); }).join(' ') + '"/>';
    res.events.forEach(function (e) {
      if (e.type === 'open' || e.type === 'reject') {
        var yy = y(BARS[e.t].mo), xx = x(e.t);
        h += '<text x="' + xx.toFixed(1) + '" y="' + (e.s === 1 ? yy + 14 : yy - 6).toFixed(1) + '" class="pc-ord' + (e.type === 'reject' ? ' rej' : '') + '" text-anchor="middle">' + (e.s === 1 ? '▲' : '▼') + '</text>';
      } else if (e.type === 'liquidated') {
        h += '<text x="' + x(e.t).toFixed(1) + '" y="' + (y(e.price) + 5).toFixed(1) + '" class="pc-liq" text-anchor="middle">×</text>';
      }
    });
    pt.mine.forEach(function (a) { h += '<text x="' + x(a.t).toFixed(1) + '" y="' + (padT + 2) + '" class="pc-you" text-anchor="middle">◆</text>'; });
    h += '<line x1="' + x(pt.t).toFixed(1) + '" x2="' + x(pt.t).toFixed(1) + '" y1="' + (padT - 6) + '" y2="' + (by + bandH + 2) + '" class="pc-cur"/>';
    h += '<rect x="' + padL + '" y="0" width="' + (W - padL - padR) + '" height="' + H + '" fill="transparent" class="pc-hit"/></svg>';
    host.innerHTML = h;
    host.dataset.s0 = s0; host.dataset.n = N; host.dataset.padl = padL; host.dataset.w = W - padL - padR;
  }

  function ptActionLabel(a) {
    var d = fmtDate(a.t - 1, true);
    if (a.type === 'close') return t('pt.a.close', { d: d, id: a.id });
    if (a.type === 'open') return t(a.s === 1 ? 'pt.a.long' : 'pt.a.short', { d: d });
    if (a.type === 'deposit') return t('pt.a.dep', { d: d, amt: a.amt });
    return t(a.on ? 'pt.a.autoOn' : 'pt.a.autoOff', { d: d });
  }
  function ptEventText(e) {
    if (e.type === 'open') return t('pt.e.open', { id: e.id, side: sideTxt(e.s), code: e.code, p: fmt(e.price, 1) });
    if (e.type === 'reject') return t('pt.e.reject', { side: sideTxt(e.s), code: e.code, need: fmt(e.need, 2) });
    if (e.type === 'close') return t('pt.e.close', { id: e.id, p: fmt(e.price, 1) });
    if (e.type === 'reduce') return t('pt.e.reduce', { id: e.id, p: fmt(e.price, 1) });
    if (e.type === 'topup') return t('pt.e.topup', { id: e.id, amt: fmt(e.amt, 2) });
    if (e.type === 'liquidated') return t('pt.e.liq', { id: e.id, p: fmt(e.price, 1), back: fmt(e.back, 2) });
    if (e.type === 'deposit') return t('pt.e.dep', { amt: e.amt });
    if (e.type === 'auto') return t(e.on ? 'pt.e.autoOn' : 'pt.e.autoOff');
    return t('pt.e.skip', { id: e.id });
  }

  function renderPortfolio() {
    var plan = ptPlan(), res = ptRun(JSON.stringify(plan)), s0 = plan.start, s1 = plan.end;
    if (pt.t == null || pt.t < s0 || pt.t > s1) pt.t = ix(PRESETS[pt.preset].view);
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.preset === pt.preset)); });
    $$('[data-pface]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pface === pt.face)); });
    $('#pt-desc').textContent = t('pt.desc.' + pt.preset);
    var sl = $('#pt-slider'); sl.min = s0; sl.max = s1; sl.value = pt.t;
    $('#pt-prev').disabled = pt.t <= s0; $('#pt-next').disabled = pt.t >= s1;
    ptChart(res);
    $('#pt-insight').textContent = ptInsight(res);
    var k = pt.t - s0, sn = res.snaps[k], sc = res.scores[k] || { down: null, up: null, min: null, dir: null }, b = BARS[pt.t];
    $('#pt-date').textContent = fmtDate(pt.t);
    $('#pt-state').textContent = t('pt.state', { p: fmt(b.dong, 1), chg: signedPct(b.dong / BARS[pt.t - 1].dong - 1, 2), f: fmt(sn.F, 1), n: sn.deals.length }) + ' ' + t(sn.auto ? 'pt.auto.on' : 'pt.auto.off');
    updateRuler($('[data-ruler="port"]'), sc, b.dong);
    var tb = '<thead><tr><th>' + t('pt.col.deal') + '</th><th>' + t('pt.col.open') + '</th><th>' + t('pt.col.ratio') + '</th><th>' + t('pt.col.head') + '</th><th>' + t('pt.col.topup') + '</th><th>' + t('pt.col.pnl') + '</th></tr></thead><tbody>';
    sn.deals.forEach(function (d) {
      var p = d.s * d.n * (sn.P - d.Popen) * SE.MUL;
      tb += '<tr data-deal="' + d.id + '"' + (pt.sel === d.id ? ' class="sel"' : '') + '><td><b>#' + d.id + '</b> ' + d.code + ' ' + sideTxt(d.s) + '</td><td>' + fmtDate(d.tOpen, true) + ' · ' + fmt(d.Popen, 1) + '</td>' +
        '<td>' + fmt(SE.ratio(d, sn.P) * 100, 2) + '%</td><td>' + fmt(SE.head(d, sn.P), 2) + '</td><td>' + fmt(d.T, 2) + '</td><td>' + (p >= 0 ? '+' : '−') + fmt(Math.abs(p), 2) + '</td></tr>';
    });
    if (!sn.deals.length) tb += '<tr><td colspan="6">' + t('pt.none') + '</td></tr>';
    $('#pt-table').innerHTML = tb + '</tbody>';
    var gone = res.liquidated.filter(function (x) { return x.t <= pt.t; });
    $('#pt-gone').hidden = !gone.length;
    if (gone.length) $('#pt-gone').textContent = t('pt.gone', { list: gone.map(function (x) { return '#' + x.id + ' (' + fmtDate(x.t, true) + ')'; }).join(', ') });
    var evs = res.events.filter(function (e) { return e.t === pt.t; });
    $('#pt-events').innerHTML = evs.length ? evs.map(function (e) { return '<li class="ev-' + e.type + '">' + ptEventText(e) + '</li>'; }).join('') : '<li>' + t('pt.events.none') + '</li>';
    if (!ptCube) ptCube = Cube3D.mount($('#pt-cube'), { onSelect: function (id) { pt.sel = id; renderPortfolio(); } });
    var cd = cubePoints({ P: sn.P, F: sn.F, deals: sn.deals, K0: sn.K0 }, sc.dir);
    ptCube.update(cd.pts, { bMax: cd.bMax, n: cd.n, face: pt.face, tone: toneOf(sc), labels: cubeLabels() });
    if (pt.sel != null) ptCube.select(pt.sel);
    var last = pt.t >= s1;
    $('#pt-decide').textContent = t('pt.decide', { d: fmtDate(pt.t) });
    $('#pt-decide-note').textContent = last ? t('pt.decide.last') : t('pt.decide.note', { d2: fmtDate(pt.t + 1) });
    var btn = '';
    if (!last) {
      btn += sn.deals.map(function (d) { return '<button type="button" data-ptact="close" data-id="' + d.id + '">' + t('pt.b.close', { id: d.id }) + '</button>'; }).join('');
      btn += '<button type="button" data-ptact="long">' + t('pt.b.long') + '</button><button type="button" data-ptact="short">' + t('pt.b.short') + '</button>' +
        '<button type="button" data-ptact="deposit">' + t('pt.b.dep') + '</button><button type="button" data-ptact="auto">' + t(sn.auto ? 'pt.b.autoOff' : 'pt.b.autoOn') + '</button>';
    }
    $('#pt-buttons').innerHTML = btn;
    $('#pt-mine').innerHTML = pt.mine.length ? pt.mine.map(function (a, i) {
      return '<li><span>' + ptActionLabel(a) + '</span> <button type="button" class="rm" data-rm="' + i + '" aria-label="' + t('pt.remove') + '">×</button></li>';
    }).join('') : '<li class="skipped">' + t('pt.mine.none') + '</li>';
    $('#pt-reset').disabled = !pt.mine.length;
    var sec = $('.view[data-view="demo/port"]');
    sec.dataset.liq = res.liquidated.length;
    sec.dataset.firstLiq = res.liquidated.length ? BARS[res.liquidated[0].t].ngay : '';
    sec.dataset.t = BARS[pt.t].ngay;
    sec.dataset.deals = sn.deals.length;
  }
  function ptAddAction(kind, id) {
    var plan = ptPlan(), res = ptRun(JSON.stringify(plan)), sn = res.snaps[pt.t - plan.start], tt = pt.t + 1;
    if (tt > plan.end) return;
    var a = kind === 'close' ? { t: tt, type: 'close', id: id } : kind === 'long' ? { t: tt, type: 'open', s: 1, code: 'VN30F1M', n: 1 } :
      kind === 'short' ? { t: tt, type: 'open', s: -1, code: 'VN30F2M', n: 1 } : kind === 'deposit' ? { t: tt, type: 'deposit', amt: 20 } : { t: tt, type: 'auto', on: !sn.auto };
    a.src = 'you';
    pt.mine = pt.mine.concat([a]).sort(function (x, y) { return x.t - y.t; });
    renderPortfolio();
  }
  $('#pt-slider').addEventListener('input', function (e) { pt.t = +e.target.value; renderPortfolio(); });
  $('#pt-chart').addEventListener('click', function (e) {
    var host = $('#pt-chart'), r = host.getBoundingClientRect(), xx = e.clientX - r.left - +host.dataset.padl;
    var i = Math.floor(xx / +host.dataset.w * +host.dataset.n);
    if (i >= 0 && i < +host.dataset.n) { pt.t = +host.dataset.s0 + i; renderPortfolio(); }
  });
  $('#pt-table').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-deal]'); if (!tr) return;
    pt.sel = +tr.dataset.deal; renderPortfolio();
  });
  var ptResizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(ptResizeT);
    ptResizeT = setTimeout(function () { if (document.body.getAttribute('data-route') === 'demo/port') renderPortfolio(); }, 150);
  });

  /* ---------- định tuyến ---------- */
  /* Vấn đề, Sản phẩm, Luật nằm chung trang Tổng quan: các route này mở trang Tổng quan rồi cuộn tới phần tương ứng (anchor). */
  var ROUTES = [
    { hash: '#/', view: 'overview', tab: 'overview', label: 'tab.overview' },
    { hash: '#/van-de', view: 'overview', tab: 'problem', anchor: 'van-de', label: 'tab.problem' },
    { hash: '#/san-pham', view: 'overview', tab: 'product', anchor: 'san-pham', label: 'tab.product' },
    { hash: '#/luat', view: 'overview', tab: 'rules', anchor: 'luat', label: 'tab.rules' },
    { hash: '#/demo/atl', view: 'demo/atl', tab: 'demo', sub: 'atl', label: 'sub.atl' },
    { hash: '#/demo/shield', view: 'demo/shield', tab: 'demo', sub: 'shield', label: 'sub.shield' },
    { hash: '#/demo/vien-canh', view: 'demo/scen', tab: 'demo', sub: 'scen', label: 'sub.scen' },
    { hash: '#/demo/danh-muc', view: 'demo/port', tab: 'demo', sub: 'port', label: 'sub.port' }
  ];
  var PAGES = ROUTES.filter(function (r) { return !r.anchor; });
  function current() {
    var h = location.hash || '#/';
    if (h === '#/demo') h = '#/demo/atl';
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].hash === h) return i;
    return 0;
  }
  function routeLabel(r) { return r.sub ? t('tab.demo') + ': ' + t(r.label) : t(r.label); }
  var RENDER = { 'demo/atl': renderATL, 'demo/shield': renderShield, 'demo/scen': renderScenario, 'demo/port': renderPortfolio };

  function setTab(tab) {
    $$('[data-tab]').forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  /* focus: true khi bấm link, 'init' lúc mới tải trang, false khi đổi ngôn ngữ */
  function show(focus) {
    var i = current(), r = ROUTES[i];
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== r.view; });
    setTab(r.tab);
    $('.subbar').hidden = r.tab !== 'demo';
    $$('[data-sub]').forEach(function (a) { if (a.dataset.sub === r.sub) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var pi = 0;
    for (var k = 0; k < PAGES.length; k++) if (PAGES[k].view === r.view) pi = k;
    var p = '';
    if (pi > 0) p += '<a class="btn prev" href="' + PAGES[pi - 1].hash + '"><small>' + t('pager.prev') + '</small>' + routeLabel(PAGES[pi - 1]) + '</a>';
    if (pi < PAGES.length - 1) p += '<a class="btn primary next" href="' + PAGES[pi + 1].hash + '"><small>' + t('pager.next') + '</small>' + routeLabel(PAGES[pi + 1]) + '</a>';
    $('#pager').innerHTML = p;
    document.title = (i === 0 ? '' : routeLabel(r) + ' | ') + t('doc.title');
    if (RENDER[r.view]) RENDER[r.view]();
    document.body.setAttribute('data-route', r.view);
    measureBar();
    if (focus) {
      if (r.anchor) $('#' + r.anchor).scrollIntoView();
      else window.scrollTo(0, 0);
      if (focus !== 'init') $('#main').focus({ preventScroll: true });
    }
    onScroll();
  }

  /* ---------- thanh trên trong suốt + tab theo vị trí cuộn ---------- */
  function measureBar() { document.documentElement.style.setProperty('--bar-h', $('.bar').offsetHeight + 'px'); }
  function onScroll() {
    var onOverview = document.body.getAttribute('data-route') === 'overview';
    $('.bar').classList.toggle('clear', onOverview && window.scrollY < 8);
    if (!onOverview) return;
    var line = window.innerHeight * 0.35, cur = 'overview';
    $$('[data-section]').forEach(function (sec) { if (sec.getBoundingClientRect().top <= line) cur = sec.dataset.section; });
    setTab(cur);
  }
  var scrollT = 0;
  window.addEventListener('scroll', function () {
    if (scrollT) return;
    scrollT = requestAnimationFrame(function () { scrollT = 0; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', function () { measureBar(); onScroll(); });

  /* ---------- ngôn ngữ ---------- */
  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.innerHTML = t(el.dataset.i18n); });
    $$('[data-i18n-attr]').forEach(function (el) {
      var p = el.dataset.i18nAttr.split(':'); el.setAttribute(p[0], t(p[1]));
    });
    $('meta[name="description"]').setAttribute('content', t('doc.desc'));
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }

   /* ---------- menu ngôn ngữ ---------- */
  function setLangMenu(open) {
    $('#lang-menu').hidden = !open;
    $('#lang-toggle').setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#lang-menu').hidden) { setLangMenu(false); $('#lang-toggle').focus(); }
  });

  /* ---------- sự kiện ---------- */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#lang')) setLangMenu(false);
    var link = e.target.closest('a[href^="#/"]');
    if (link && link.getAttribute('href') === (location.hash || '#/')) { e.preventDefault(); show(true); return; }
    var b = e.target.closest('button');
    if (!b) return;
    var ds = b.dataset;
    if (b.id === 'lang-toggle') { setLangMenu($('#lang-menu').hidden); }
    else if (ds.lang) { setLangMenu(false); lang = ds.lang; try { localStorage.setItem('fxs-lang', lang); } catch (err) { /* bỏ qua */ } applyLang(); show(false); }
    else if (ds.code) { atl.code = ds.code; renderATL(); }
    else if (ds.side) { atl.side = +ds.side; renderATL(); }
    else if (ds.step) { atl.qty = Math.max(1, Math.min(6, atl.qty + +ds.step)); renderATL(); }
    else if (ds.shview) { sh.view = ds.shview; renderShield(); }
    else if (ds.add) {
      var s = ds.add === 'deposit' ? { type: 'deposit', amt: 10 } : ds.add === 'down' ? { type: 'move', pct: -2 } :
        ds.add === 'up' ? { type: 'move', pct: 2 } : { type: ds.add };
      scn.steps = scn.steps.concat([s]); renderScenario();
    }
    else if (ds.close) { scn.steps = scn.steps.concat([{ type: 'close', id: +ds.close }]); renderScenario(); }
    else if (ds.face) { scn.face = ds.face; if (scCube) { if (ds.face === 'auto') scCube.state.face = null; else scCube.face(ds.face); } renderScenario(); }
    else if (ds.preset) { pt.preset = ds.preset; pt.mine = []; pt.t = null; pt.sel = null; renderPortfolio(); }
    else if (ds.pface) { pt.face = ds.pface; if (ptCube) { if (ds.pface === 'auto') ptCube.state.face = null; else ptCube.face(ds.pface); } renderPortfolio(); }
    else if (ds.ptact) { ptAddAction(ds.ptact, +ds.id); }
    else if (ds.rm != null) { pt.mine = pt.mine.filter(function (x, i) { return i !== +ds.rm; }); renderPortfolio(); }
    else if (b.id === 'pt-prev') { pt.t--; renderPortfolio(); }
    else if (b.id === 'pt-next') { pt.t++; renderPortfolio(); }
    else if (b.id === 'pt-reset') { pt.mine = []; renderPortfolio(); }
    else if (b.id === 'sc-undo') { scn.steps = scn.steps.slice(0, -1); renderScenario(); }
    else if (b.id === 'sc-reset') { scn.steps = []; renderScenario(); }
  });
  window.addEventListener('hashchange', function () { show(true); });

  /* ---------- bản build ---------- */
  var B = window.__BUILD__ || {};
  $('#build-id').textContent = (B.commit || '?') + (B.dirty ? '+dirty' : '') + ' · ' + (B.branch || '?') + ' · ' + (B.time || '?');
  console.info('[fxs] build', JSON.stringify(B));

  applyLang();
  show('init');
  document.body.setAttribute('data-ready', '1');
})();
