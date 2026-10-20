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
  /* trong câu: "> 30%" (thanh đệm đã ghi chú "vượt phạm vi dò 30%") */
  function pctIn(x) { return x == null ? '&gt; 30%' : pct(x); }
  function big(x) { return x == null ? '<b>&gt; 30%</b><small>' + t('score.out') + '</small>' : '<b>' + pct(x) + '</b>'; }
  function toneOf(sc) { var lv = SE.level(sc.min, YELLOW, RED); return lv === 'violated' ? 'red' : lv; }
  function toneLabel(sc) { return t('tone.' + SE.level(sc.min, YELLOW, RED)); }
  /* số ít / số nhiều: "1 contract", "2 contracts"; tiếng Việt không đổi */
  function plural(key, n) { return t(key + (n === 1 ? '1' : 'n'), { n: n }); }
  function ct(n) { return plural('unit.ct', n); }
  function nDeals(n) { return plural('unit.deal', n); }
  function signed(x, d) { return (x < 0 ? '−' : '') + fmt(Math.abs(x), d); }
  /* Engine trả khoá ô (tên cũ, giữ cho prototype canvas); tên hiển thị theo R3_11 A6 nằm ở i18n */
  var CELL = { 'Két sắt': 'safe', 'Dao hai lưỡi': 'double', 'Món chết': 'dead', 'Quả bom': 'bomb',
    'Đứng ngoài': 'out', 'Mối nguy kế tiếp': 'next', 'Vết thương cũ': 'old', 'Thủ phạm chính': 'main' };
  function cellName(vn) { return t('cell.' + CELL[vn]); }
  /* nghĩa tiếng Việt in nhỏ dưới tên ô; bản EN trùng tên nên không in */
  function cellGloss(vn) { var g = t('cellg.' + CELL[vn]); return g === cellName(vn) ? '' : g; }
  /* "cao" trên trục A/C: lớn hơn phần chia đều 1/n (cùng luật với SE.cell) */
  function hiOf(x, n) { return x != null && x > 1 / Math.max(1, n) + 1e-9; }
  /* Toạ độ vẽ: đặt vạch 1/n ở giữa khung để bốn ô bằng nhau.
     A ∈ [−1, 1/n] → [0, 0.5]; A ∈ [1/n, 1] → [0.5, 1]. C ∈ [0, 1/n] → [0, 0.5]; C ∈ [1/n, 1] → [0.5, 1]. */
  function posA(A, n) { var e = 1 / Math.max(1, n), a = A == null ? 0 : Math.max(-1, Math.min(1, A)); return a <= e ? (a + 1) / (e + 1) * 0.5 : 0.5 + (a - e) / (1 - e) * 0.5; }
  function posC(C, n) { var e = 1 / Math.max(1, n), c = C == null ? 0 : Math.max(0, Math.min(1, C)); return c <= e ? c / e * 0.5 : 0.5 + (c - e) / (1 - e) * 0.5; }
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
    $('#atl-qty').textContent = ct(atl.qty);
    $('[data-step="-1"]').disabled = atl.qty <= 1; $('[data-step="1"]').disabled = atl.qty >= 6;
    $('#atl-note').textContent = t('atl.note', { dep: fmt(SE.depositFor(1, 2000), 2) });
    var c = atlCalc([atl.side, atl.qty, atl.code].join('|')), r = c.r, a = r.acc;
    var h = '<h2>' + t('atl.card') + '</h2>' + scoreRow(t('atl.before'), c.before, 'before');
    if (!r.ok) {
      h += '<p class="fail">' + t('atl.fail', { need: fmt(r.need || 0, 2) }) + '</p>';
    } else {
      h += scoreRow(t('atl.after'), c.after, 'after');
      var closed = r.closed.length ? t('atl.closed', { ids: r.closed.join(', #') }) : '';
      h += '<p class="explain">' + closed + t('atl.explain', { n: nDeals(a.deals.length),
        dir: t(c.after.dir === -1 ? 'atl.dir.up' : 'atl.dir.down'), x: pct(c.after.min) }) + '</p>';
      var sorted = a.deals.slice().sort(function (x, y) { return SE.head(x, a.P) - SE.head(y, a.P); });
      h += '<h3>' + t('atl.deals') + '</h3><ul class="deal-list">' + sorted.map(function (d) {
        return '<li><b>#' + d.id + '</b><span>' + d.code + ' ' + (d.s === 1 ? 'long' : 'short') + ' ' + ct(d.n) +
          (d.fresh ? ' <em>' + t('atl.deal.new') + '</em>' : '') + '</span><span>' + t('atl.deal.ratio') + ' ' + fmt(SE.ratio(d, a.P) * 100, 2) + '%</span>' +
          '<span>' + t('atl.deal.head') + ' ' + fmt(SE.head(d, a.P), 2) + ' ' + t('unit.m') + '</span></li>';
      }).join('') + '</ul>';
      if (c.green) h += '<p class="ok">' + t('atl.green') + '</p>';
      if (c.conds) {
        var k = c.conds, rows = [];
        if (k.deposit) rows.push([t('atl.c.dep', { amt: fmt(Math.round(k.deposit.amount), 0) }), k.deposit.score]);
        if (k.closeOne) rows.push([t('atl.c.close', { id: k.closeOne.id }), k.closeOne.score]);
        if (k.maxQty) rows.push([k.maxQty.n === 0 ? t('atl.c.none') : t('atl.c.max', { q: ct(k.maxQty.n) }), k.maxQty.score]);
        h += '<h3>' + t('atl.conds') + '</h3><ul class="conds">' + rows.map(function (rw) {
          return '<li><p>' + rw[0] + '</p><p>' + t('atl.c.res', { d: '<b>' + pctIn(rw[1].down) + '</b>', u: '<b>' + pctIn(rw[1].up) + '</b>' }) + '</p></li>';
        }).join('') + '</ul><p class="note">' + t('atl.c.foot') + '</p>';
      }
    }
    h += '<p class="disclaim">' + t('demo.notadvice') + '</p>';
    var card = $('#atl-card');
    card.innerHTML = h;
    card.setAttribute('data-after-down', c.after && c.after.down != null ? c.after.down.toFixed(4) : 'null');
  }

  /* ---------- Ma trận 2D dùng chung (R3_11 A7) ----------
     Trục ngang luôn là A (trái thấp, phải cao); trục dọc B (A × B) hoặc C (A × C), dưới thấp, trên cao.
     Vạch nét đứt: A = 1/n, B = 0 (hòa vốn), C = 1/n. Hai ô bên phải (A cao) nền hồng, hai ô bên trái nền trắng;
     không tô xanh/đỏ theo B hay C. Chấm ghi "#id", cỡ chấm theo tỷ trọng cọc. */
  function matrixHTML(ax, pair) {
    /* Kiểu ma trận BCG (R3_11 A7, bản 11:10): hai trục đen cắt nhau ở giữa (tại A = 1/n và B = 0 hoặc C = 1/n),
       không tô màu ô; tên ô là nhãn viền màu ở 4 góc (màu chỉ theo A: phải = A cao); mỗi Deal là một thẻ chữ cùng cỡ. */
    var n = ax.length;
    var bMax = Math.max(0.02, Math.max.apply(null, ax.map(function (r) { return Math.abs(r.B); }).concat([0])) * 1.3);
    var names = pair === 'AB' ? [['Két sắt', 'Dao hai lưỡi'], ['Món chết', 'Quả bom']] : [['Vết thương cũ', 'Thủ phạm chính'], ['Đứng ngoài', 'Mối nguy kế tiếp']];
    /* tên trục và nhãn ranh giới nằm ngoài khung, để trong khung chỉ có nhãn ô và thẻ Deal (không chồng nhau ở bề ngang điện thoại) */
    var h = '<p class="mx-ty"><span>' + t(pair === 'AB' ? 'mx.ax.b' : 'mx.ax.c') + '</span></p><div class="mx-plot">';
    [0, 1].forEach(function (row) { [0, 1].forEach(function (col) {
      var nm = names[row][col], g = cellGloss(nm);
      h += '<div class="m-corner' + (col ? ' right' : '') + (row ? ' bottom' : '') + '"><span class="m-tag">' + cellName(nm) + '</span>' +
        (g ? '<span class="m-gloss">' + g + '</span>' : '') + '</div>';
    }); });
    h += '<span class="mx-axis h"></span><span class="mx-axis v"></span>' +
      '<span class="m-lab h">' + (pair === 'AB' ? t('mx.be') : t('mx.eq', { n: n })) + '</span>';
    /* vị trí theo %: chừa góc cho nhãn ô và đầu trục cho tên trục; thẻ trùng chỗ thì xếp lệch xuống (hoặc lên) */
    var placed = [];
    ax.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (r) {
      var nm = SE.cell(r, pair, n);
      var x = 13 + posA(r.A, n) * 74, y = pair === 'AB' ? 50 - Math.max(-1, Math.min(1, r.B / bMax)) * 30 : 80 - posC(r.C, n) * 60;
      /* Thẻ luôn nằm trong đúng ô của nó: Deal đúng bằng ranh giới (vd. A = 1/n) là "thấp" nên đặt lệch vào phía thấp,
         và khi tránh chồng thẻ chỉ dịch trong nửa của ô đó, không bao giờ vượt trục. */
      var right = hiOf(r.A, n), top = pair === 'AB' ? r.B >= 0 : hiOf(r.C, n);
      x = right ? Math.max(x, 57) : Math.min(x, 43);
      var lo = top ? 14 : 57, hi = top ? 43 : 86;
      y = Math.max(lo, Math.min(hi, y));
      /* Tránh chồng thẻ: thẻ ~36 × 22 px, khung nhỏ nhất (trong khối 3D trên điện thoại) ~270 × 150 px, nên coi là chồng
         khi lệch < 14% ngang và < 16% dọc. Chọn chỗ trống gần vị trí thật nhất, trong đúng ô (không vượt trục). */
      var xlo = right ? 57 : 10, xhi = right ? 90 : 43, x0 = x, y0 = y;
      /* ô đông (vd. 5 Deal cùng một ô): nới khoảng cách dần về đúng cỡ thẻ trên khung 286 × 200 px */
      [[14, 16], [13, 13], [12.6, 11.5]].some(function (gap) {
        var free = function (xx, yy) { return !placed.some(function (q) { return Math.abs(q[0] - xx) < gap[0] && Math.abs(q[1] - yy) < gap[1]; }); };
        if (free(x, y)) return true;
        var best = null;
        for (var gx = xlo; gx <= xhi + 0.01; gx += 1.5) for (var gy = lo; gy <= hi + 0.01; gy += 1.5) {
          if (!free(gx, gy)) continue;
          var dist = Math.pow(gx - x0, 2) + Math.pow(gy - y0, 2) * 1.5;
          if (!best || dist < best[2]) best = [gx, gy, dist];
        }
        if (best) { x = best[0]; y = best[1]; return true; }
        return false;
      });
      placed.push([x, y]);
      h += '<span class="dot' + (hiOf(r.A, n) ? ' hi' : '') + '" data-id="' + r.id + '" data-cell="' + CELL[nm] + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%"' +
        ' title="Deal #' + r.id + ' · ' + cellName(nm) + '">#' + r.id + '</span>';
    });
    return h + '</div><div class="mx-foot"><span class="m-lab v">' + t('mx.eq', { n: n }) + '</span><span class="mx-title x">' + t('mx.ax.a') + '</span></div>';
  }
  function drawMatrix(host, ax, pair) {
    var old = {};
    $$('.dot', host).forEach(function (d) { var r = d.getBoundingClientRect(); old[d.dataset.id] = [r.left, r.top]; });
    host.innerHTML = matrixHTML(ax, pair); host.setAttribute('data-pair', pair);
    if (reducedMotion()) return;
    $$('.dot', host).forEach(function (d) {
      var o = old[d.dataset.id]; if (!o) { d.classList.add('dot-in'); return; }
      var r = d.getBoundingClientRect(), dx = o[0] - r.left, dy = o[1] - r.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      d.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; d.style.transition = 'none';
      requestAnimationFrame(function () { requestAnimationFrame(function () { d.style.transition = ''; d.style.transform = ''; }); });
    });
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
    drawMatrix($('#sh-matrix'), ax, pair);
    var tb = '<thead><tr><th>' + t('sh.tbl.deal') + '</th><th>' + t('sh.tbl.a') + '</th><th>' + t('sh.tbl.b') + '</th><th>' + t('sh.tbl.c') + '</th><th>' + t('sh.tbl.cell') + '</th></tr></thead><tbody>';
    ax.forEach(function (r) {
      var d = c.acc.deals.filter(function (x) { return x.id === r.id; })[0];
      tb += '<tr><td><b>#' + r.id + '</b> ' + d.code + ' ' + (d.s === 1 ? 'long' : 'short') + ' ' + ct(d.n) + '</td>' +
        '<td>' + (r.A == null ? '—' : fmt(r.A * 100, 1) + '%') + '</td>' +
        '<td>' + (r.B >= 0 ? '+' : '−') + fmt(Math.abs(r.B) * 100, 2) + '%</td>' +
        '<td>' + (r.C == null ? t('sh.c.none') : fmt(r.C * 100, 0) + '%') + '</td>' +
        '<td>' + cellName(SE.cell(r, pair, n)) + '</td></tr>';
    });
    $('#sh-table').innerHTML = tb + '</tbody>';
  }

  /* ---------- Tổng quan: số trong hình lấy từ engine (R3_11 A3, A5, A6, A7) ---------- */
  var PERSON = '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true"><circle cx="12" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M2.5 30v-5.5a9.5 9.5 0 0 1 19 0V30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ovCalc = memo(function () {
    var atlA = SE.atlAccount(), atlR = SE.order(atlA, 1, 2, 'VN30F1M').acc, demo = SE.demoAccount(), demo1 = SE.order(demo, 1, 1, 'VN30F1M').acc;
    var sDemo = SE.score(demo), sDemo1 = SE.score(demo1);
    return { atlA: atlA, atlR: atlR, s0: SE.score(atlA), s1: SE.score(atlR), demo: demo, sDemo: sDemo,
      axNow: SE.axes(demo, sDemo.dir || 1), axAfter: SE.axes(demo1, sDemo1.dir || 1) };
  });
  function bar(label, w0, w1) {
    return '<div class="hbar"><p>' + label + '</p><div class="hb-track" style="--w0:' + (w0 * 100).toFixed(1) + '%;--w1:' + (w1 * 100).toFixed(1) + '%">' +
      '<span class="hb0"></span><span class="hb1"></span></div></div>';
  }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } }
  /* Khoảnh khắc chính của trang: lần đầu phần Vấn đề vào khung nhìn, vệt đỏ (sau lệnh) rút từ mức trước lệnh
     về mức sau lệnh: cọc chung 80 → 6 triệu. Chỉ chạy một lần; giảm chuyển động hoặc trình duyệt cũ thì hiện ngay kết quả. */
  var barsPlayed = false;
  function armBars() {
    var el = $('#pb-bars');
    if (barsPlayed || reducedMotion() || !('IntersectionObserver' in window)) return;
    el.classList.add('pending');
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect(); barsPlayed = true;
      requestAnimationFrame(function () { el.classList.remove('pending'); });
    }, { threshold: 0.6 });
    io.observe(el);
  }
  function renderOverview() {
    var c = ovCalc('x'), dep = SE.depositFor(1, 2000);
    $('#pb-see').innerHTML = c.atlR.deals.map(function (d) {
      return '<li>' + t('pb.see.row', { id: d.id, r: fmt(SE.ratio(d, c.atlR.P) * 100, 2) + '%' }) + (d.fresh ? ' <em>' + t('pb.see.new') + '</em>' : '') + '</li>';
    }).join('');
    $('#pb-bars').innerHTML =
      bar(t('pb.bar.f', { a: fmt(c.atlA.F, 0), b: fmt(c.atlR.F, 0) }), 1, c.atlR.F / c.atlA.F) +
      bar(t('pb.bar.x', { a: pct(c.s0.down), b: pct(c.s1.down) }), c.s0.down / SCALE, c.s1.down / SCALE);
    armBars();
    $('#pb-real-cap').textContent = t('pb.real.cap', { dep: fmt(dep, 2) });
    updateRuler($('[data-ruler="ov"]'), c.sDemo);
    var d1 = c.axNow[0];
    $('#ex-a').textContent = fmt(d1.A * 100, 0) + '%';
    $('#ex-b').textContent = signed(d1.B * 100, 1) + '%';
    $('#ex-c').textContent = fmt(d1.C * 100, 0) + '%';
    drawMatrix($('#ov-mx-ab'), c.axNow, 'AB');
    drawMatrix($('#ov-mx-ac'), c.axAfter, 'AC');
    $$('[data-people]').forEach(function (el) { var h = ''; for (var i = 0; i < +el.dataset.people; i++) h += PERSON; el.innerHTML = h; });
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
    $('#sc-state').textContent = t('sc.state', { p: fmt(a.P, 1), f: fmt(a.F, 2), n: nDeals(a.deals.length) });
    $('#sc-try').textContent = t('sc.try', { s: shortTxt(runChain(JSON.stringify([{ type: 'long' }])).list[1].sc) });
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
    scCube.update(cd.pts, { bMax: cd.bMax, n: cd.n, cMid: 0.5, face: scn.face, tone: tone, labels: cubeLabels(), flat: cd.flat,
      key: JSON.stringify(scn.steps) });
  }

  /* ---------- khối 3D dùng chung ---------- */
  function cubeLabels() {
    return { a: t('cube.a'), b: t('cube.b'), c: t('cube.c'), hint: t('cube.hint'), hintTouch: t('cube.hinttouch'), flatHint: t('cube.flathint'),
      zin: t('cube.zin'), zout: t('cube.zout'), reset: t('cube.reset'), full: t('cube.full'), exitFull: t('cube.exitfull'), wheel: t('cube.wheel'), chips: t('cube.chips'),
      cells: ['Két sắt', 'Dao hai lưỡi', 'Món chết', 'Quả bom'].map(cellName),
      cellsAC: ['Vết thương cũ', 'Thủ phạm chính', 'Đứng ngoài', 'Mối nguy kế tiếp'].map(cellName) };
  }
  /* A và C đưa về toạ độ có vạch 1/n ở giữa khối (như ma trận 2D); B giữ nguyên (vạch hòa vốn ở giữa) */
  function cubePoints(acc, dir) {
    var ax = SE.axes(acc, dir || 1), n = ax.length;
    var bMax = Math.max(0.02, Math.max.apply(null, ax.map(function (r) { return Math.abs(r.B); }).concat([0])) * 1.3);
    /* hai mặt phẳng 2D (cùng hình vẽ với ma trận ở Tổng quan và Shield hai chiều) */
    return { n: n, bMax: bMax, flat: { AB: matrixHTML(ax, 'AB'), AC: matrixHTML(ax, 'AC') }, pts: ax.map(function (r, i) {
      /* số hiển thị trong thẻ thông tin và trên vạch dóng của khối 3D */
      var d = acc.deals[i], va = r.A == null ? '—' : fmt(r.A * 100, 1) + '%', vb = (r.B >= 0 ? '+' : '−') + fmt(Math.abs(r.B) * 100, 2) + '%',
        vc = r.C == null ? t('sh.c.none') : fmt(r.C * 100, 0) + '%';
      return { id: r.id, A: posA(r.A, n) * 2 - 1, B: r.B, C: posC(r.C, n), w: r.w, heat: hiOf(r.A, n) ? 'hot' : 'cool',
        label: '#' + r.id + ' · ' + d.code + ' ' + sideTxt(d.s) + ' · ' + ct(d.n), vals: 'A ' + va + ' · B ' + vb + ' · C ' + vc,
        va: 'A ' + va, vb: 'B ' + vb, vc: 'C ' + vc, cellAB: cellName(SE.cell(r, 'AB', n)), cellAC: cellName(SE.cell(r, 'AC', n)),
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
    var lvWord = t('tone.' + (lvPrev === 'none' ? 'green' : lvPrev)).toLowerCase();
    if (isRed(prev)) {
      var j = i - 1; while (j - 1 >= 0 && isRed(res.scores[j - 1])) j--;
      var k = i - j, sj = res.scores[j];
      out = t('pt.i.warn', { d1: fmtDate(s0 + j), xd: pctIn(sj.down), xu: pctIn(sj.up), dL: fmtDate(first.t), id: first.id, p: fmt(first.price, 1),
        k: k === 1 ? t('pt.i.k1') : t('pt.i.kn', { n: k }) });
    } else if (Math.abs(first.price - b.mo) < 1e-9) {
      out = t('pt.i.gap', { dL: fmtDate(first.t), g: signedPct(b.mo / BARS[first.t - 1].dong - 1), id: first.id, lv: lvWord, x: xPrev });
    } else {
      out = t('pt.i.late', { dL: fmtDate(first.t), id: first.id, p: fmt(first.price, 1), lv: lvWord, x: xPrev });
    }
    if (L.length > 1) out += ' ' + t('pt.i.more', { n: nDeals(L.length) });
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
        var yy = y(BARS[e.t].mo), xx = x(e.t), rj = e.type === 'reject';
        h += '<text x="' + xx.toFixed(1) + '" y="' + (e.s === 1 ? yy + 14 : yy - 6).toFixed(1) + '" class="pc-ord' + (rj ? ' rej' : '') + '" text-anchor="middle">' +
          (rj ? (e.s === 1 ? '△' : '▽') : (e.s === 1 ? '▲' : '▼')) + (rj ? '<title>' + ptEventText(e) + '</title>' : '') + '</text>';
      } else if (e.type === 'liquidated') {
        h += '<g class="pc-liqg"><text x="' + x(e.t).toFixed(1) + '" y="' + (y(e.price) + 5).toFixed(1) + '" class="pc-liq" text-anchor="middle">×</text>' +
          '<text x="' + (x(e.t) + 7).toFixed(1) + '" y="' + (y(e.price) + 16).toFixed(1) + '" class="pc-liqid">#' + e.id + '</text><title>' + ptEventText(e) + '</title></g>';
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
    /* lệnh của khách mẫu bị từ chối vì thiếu cọc ngoài Deal (không tính quyết định của người xem) */
    var preT = PRESETS[pt.preset].orders.map(function (o) { return ix(o[0]); });
    var rej = res.events.filter(function (e) { return e.type === 'reject' && preT.indexOf(e.t) >= 0; }).length;
    $('#pt-desc').textContent = t('pt.desc.' + pt.preset, { skip: rej ? t('pt.skip', { n: rej }) : '' });
    var sl = $('#pt-slider'); sl.min = s0; sl.max = s1; sl.value = pt.t;
    $('#pt-prev').disabled = pt.t <= s0; $('#pt-next').disabled = pt.t >= s1;
    ptChart(res);
    $('#pt-insight').textContent = ptInsight(res);
    var k = pt.t - s0, sn = res.snaps[k], sc = res.scores[k] || { down: null, up: null, min: null, dir: null }, b = BARS[pt.t];
    $('#pt-date').textContent = fmtDate(pt.t);
    $('#pt-state').textContent = t('pt.state', { p: fmt(b.dong, 1), chg: signedPct(b.dong / BARS[pt.t - 1].dong - 1, 2), f: signed(sn.F, 1),
      neg: sn.F < 0 ? t('pt.neg') : '', n: nDeals(sn.deals.length) }) + ' ' + t(sn.auto ? 'pt.auto.on' : 'pt.auto.off');
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
    ptCube.update(cd.pts, { bMax: cd.bMax, n: cd.n, cMid: 0.5, face: pt.face, tone: toneOf(sc), labels: cubeLabels(), flat: cd.flat,
      key: pt.preset + '|' + pt.t + '|' + JSON.stringify(pt.mine) });
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
  var RENDER = { 'overview': renderOverview, 'demo/atl': renderATL, 'demo/shield': renderShield, 'demo/scen': renderScenario, 'demo/port': renderPortfolio };

    function setTab(tab) {
    $$('[data-tab]').forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
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
      var smooth = focus === true && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (r.anchor) $('#' + r.anchor).scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      else window.scrollTo({ top: 0, behavior: smooth && r.view === 'overview' ? 'smooth' : 'auto' });
      if (focus === true) $('#main').focus({ preventScroll: true });
    }
    onScroll();
  }

  /* thanh trên: trong suốt ở đầu trang Tổng quan; tab tự đổi theo phần đang xem */
  function measureBar() { document.documentElement.style.setProperty('--bar-h', $('.bar').offsetHeight + 'px'); }
  function onScroll() {
    var onOverview = document.body.getAttribute('data-route') === 'overview';
    $('.bar').classList.toggle('clear', onOverview && window.scrollY < 8);
    $('.bar').classList.toggle('scrolled', window.scrollY >= 8);
    if (!onOverview) return;
    var line = window.innerHeight * 0.35, cur = 'overview';
    $$('[data-section]').forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s.dataset.section; });
    setTab(cur);
  }
  var scrollT = 0;
  window.addEventListener('scroll', function () {
    if (!scrollT) scrollT = requestAnimationFrame(function () { scrollT = 0; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', function () { measureBar(); onScroll(); scheduleWrap(); });

  /* Xuống dòng: CSS chia đều dòng (text-wrap: balance), nhưng trình duyệt chỉ làm vậy với đoạn ≤ 6 dòng.
     Đoạn dài hơn: giữ vài chữ cuối đi liền nhau (span không ngắt dòng) để dòng cuối không còn một hai chữ lẻ loi.
     Chữ và khoảng trắng giữ nguyên, chỉ thêm một thẻ span bọc ngoài. */
  var wrapT = 0;
  function scheduleWrap() { cancelAnimationFrame(wrapT); wrapT = requestAnimationFrame(fixWrap); }
  function fixWrap() {
    $$('span.nw').forEach(function (sp) { var par = sp.parentNode; if (!par) return; while (sp.firstChild) par.insertBefore(sp.firstChild, sp); par.removeChild(sp); par.normalize(); });
    var long = $$('p, li, dd').filter(function (e) {
      if (!e.offsetParent) return false;
      var lh = parseFloat(getComputedStyle(e).lineHeight); return lh > 0 && e.clientHeight / lh > 6.5;
    });
    long.forEach(function (e) {
      var tn = e.lastChild; if (!tn || tn.nodeType !== 3) return;
      var n = lang === 'vi' ? 5 : 3; /* tiếng Việt mỗi âm tiết một chữ nên cần giữ nhiều chữ hơn */
      var m = tn.textContent.match(new RegExp('((?:\\S+\\s+){' + (n - 1) + '}\\S+\\s*)$')); if (!m) return;
      var tail = tn.splitText(tn.textContent.length - m[1].length), sp = document.createElement('span');
      sp.className = 'nw'; e.insertBefore(sp, tail); sp.appendChild(tail);
    });
  }

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
    else if (ds.lang) { setLangMenu(false); lang = ds.lang; try { localStorage.setItem('fxs-lang', lang); } catch (err) { /* bỏ qua */ } applyLang(); show(false); scheduleWrap(); }
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
    else if (ds.face) { scn.face = ds.face; if (scCube) scCube.reset(); renderScenario(); }
    else if (ds.preset) { pt.preset = ds.preset; pt.mine = []; pt.t = null; pt.sel = null; renderPortfolio(); }
    else if (ds.pface) { pt.face = ds.pface; if (ptCube) ptCube.reset(); renderPortfolio(); }
    else if (ds.ptact) { ptAddAction(ds.ptact, +ds.id); }
    else if (ds.rm != null) { pt.mine = pt.mine.filter(function (x, i) { return i !== +ds.rm; }); renderPortfolio(); }
    else if (b.id === 'pt-prev') { pt.t--; renderPortfolio(); }
    else if (b.id === 'pt-next') { pt.t++; renderPortfolio(); }
    else if (b.id === 'pt-reset') { pt.mine = []; renderPortfolio(); }
    else if (b.id === 'sc-undo') { scn.steps = scn.steps.slice(0, -1); renderScenario(); }
    else if (b.id === 'sc-reset') { scn.steps = []; renderScenario(); }
  });
  window.addEventListener('hashchange', function () { show(true); scheduleWrap(); });

  /* ---------- bản build ---------- */
  var B = window.__BUILD__ || {};
  $('#build-id').textContent = (B.commit || '?') + (B.dirty ? '+dirty' : '') + ' · ' + (B.branch || '?') + ' · ' + (B.time || '?');
  $('#foot-mark').src = $('.bar .mark').src;
  console.info('[fxs] build', JSON.stringify(B));

  applyLang();
  show('init');
  scheduleWrap();
  document.body.setAttribute('data-ready', '1');
})();
