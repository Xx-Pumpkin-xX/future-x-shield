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
  function updateRuler(slot, sc) {
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
    $('.r-price', slot).textContent = fmt(2000, 0);
    slot.setAttribute('data-down', sc.down == null ? 'null' : sc.down.toFixed(4));
    slot.setAttribute('data-up', sc.up == null ? 'null' : sc.up.toFixed(4));
  }

  /* ---------- Tổng quan: thước của ví dụ 4.4 ---------- */
  var hero = { view: 'now' };
  var heroScore = memo(function (v) {
    var a = SE.atlAccount();
    return SE.score(v === 'after' ? SE.order(a, 1, 2, 'VN30F1M').acc : a);
  });
  function renderHero() {
    $$('[data-hero]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.hero === hero.view)); });
    updateRuler($('[data-ruler="hero"]'), heroScore(hero.view));
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
  var scn = { steps: [], face: 'auto', yaw: -24 };
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
  function cubeFace(cls, extra, labels) {
    return '<div class="face ' + cls + '">' + (extra || '') + (labels ? labels.map(function (l, i) {
      return '<span class="fl f' + i + '">' + cellName(l) + '</span>';
    }).join('') : '') + '</div>';
  }
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
    // khối 3D
    var face = scn.face === 'auto' ? (tone === 'red' ? 'AC' : 'AB') : scn.face;
    var rx = face === 'AC' ? -80 : -14, ry = scn.yaw;
    var ax = SE.axes(a, last.dir || 1), n = ax.length;
    var bMax = Math.max(0.02, Math.max.apply(null, ax.map(function (r) { return Math.abs(r.B); }).concat([0])) * 1.3);
    var cMid = 0.06 + (1 - 1 / Math.max(1, n)) * 0.88;
    var cube = cubeFace('front', '<i class="v"></i><i class="h"></i>', ['Két sắt', 'Dao hai lưỡi', 'Món chết', 'Quả bom']) +
      cubeFace('top', '<i class="v"></i><i class="h" style="top:' + (cMid * 100).toFixed(2) + '%"></i>', ['Vết thương cũ', 'Thủ phạm chính', 'Đứng ngoài', 'Mối nguy kế tiếp']) +
      cubeFace('back') + cubeFace('right') + cubeFace('left') + cubeFace('bottom');
    ax.forEach(function (r) {
      var x = -100 + 200 * (0.06 + ((r.A == null ? 0 : r.A) + 1) / 2 * 0.88);
      var y = -100 + 200 * (0.06 + (bMax - r.B) / (2 * bMax) * 0.88);
      var z = 100 - 200 * (0.06 + (r.C == null ? 0 : r.C) * 0.88);
      var size = Math.round(20 + r.w * 30);
      cube += '<span class="pt ' + cellHeat(SE.cell(r, 'AC', n)) + '" style="width:' + size + 'px;height:' + size + 'px;margin:' + (-size / 2) + 'px 0 0 ' + (-size / 2) +
        'px;transform:translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + (-ry) + 'deg) rotateX(' + (-rx) + 'deg)">' + r.id + '</span>';
    });
    var el = $('#sc-cube');
    el.innerHTML = cube;
    el.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    el.setAttribute('data-face', face);
  }

  /* ---------- định tuyến ---------- */
  var ROUTES = [
    { hash: '#/', view: 'overview', tab: 'overview', label: 'tab.overview' },
    { hash: '#/van-de', view: 'problem', tab: 'problem', label: 'tab.problem' },
    { hash: '#/san-pham', view: 'product', tab: 'product', label: 'tab.product' },
    { hash: '#/demo/atl', view: 'demo/atl', tab: 'demo', sub: 'atl', label: 'sub.atl' },
    { hash: '#/demo/shield', view: 'demo/shield', tab: 'demo', sub: 'shield', label: 'sub.shield' },
    { hash: '#/demo/vien-canh', view: 'demo/scen', tab: 'demo', sub: 'scen', label: 'sub.scen' },
    { hash: '#/luat', view: 'rules', tab: 'rules', label: 'tab.rules' },
    { hash: '#/diem-yeu', view: 'limits', tab: 'limits', label: 'tab.limits' }
  ];
  function current() {
    var h = location.hash || '#/';
    if (h === '#/demo') h = '#/demo/atl';
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].hash === h) return i;
    return 0;
  }
  function routeLabel(r) { return r.sub ? t('tab.demo') + ': ' + t(r.label) : t(r.label); }
  var RENDER = { 'overview': renderHero, 'demo/atl': renderATL, 'demo/shield': renderShield, 'demo/scen': renderScenario };

  function show(focus) {
    var i = current(), r = ROUTES[i];
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== r.view; });
    $$('[data-tab]').forEach(function (a) { if (a.dataset.tab === r.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('.subbar').hidden = r.tab !== 'demo';
    $$('[data-sub]').forEach(function (a) { if (a.dataset.sub === r.sub) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var p = '';
    if (i > 0) p += '<a class="btn prev" href="' + ROUTES[i - 1].hash + '"><small>' + t('pager.prev') + '</small>' + routeLabel(ROUTES[i - 1]) + '</a>';
    if (i < ROUTES.length - 1) p += '<a class="btn primary next" href="' + ROUTES[i + 1].hash + '"><small>' + t('pager.next') + '</small>' + routeLabel(ROUTES[i + 1]) + '</a>';
    $('#pager').innerHTML = p;
    document.title = (i === 0 ? '' : routeLabel(r) + ' | ') + t('doc.title');
    if (RENDER[r.view]) RENDER[r.view]();
    document.body.setAttribute('data-route', r.view);
    if (focus) { window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); }
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
    var b = e.target.closest('button');
    if (!b) return;
    var ds = b.dataset;
    if (b.id === 'lang-toggle') { setLangMenu($('#lang-menu').hidden); }
    else if (ds.lang) { setLangMenu(false); lang = ds.lang; try { localStorage.setItem('fxs-lang', lang); } catch (err) { /* bỏ qua */ } applyLang(); show(false); }
    else if (ds.hero) { hero.view = ds.hero; renderHero(); }
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
    else if (ds.face) { scn.face = ds.face; renderScenario(); }
    else if (b.id === 'sc-undo') { scn.steps = scn.steps.slice(0, -1); renderScenario(); }
    else if (b.id === 'sc-reset') { scn.steps = []; renderScenario(); }
  });
  $('#sc-yaw').addEventListener('input', function (e) { scn.yaw = +e.target.value; renderScenario(); });
  window.addEventListener('hashchange', function () { show(true); });

  /* ---------- bản build ---------- */
  var B = window.__BUILD__ || {};
  $('#build-id').textContent = (B.commit || '?') + (B.dirty ? '+dirty' : '') + ' · ' + (B.branch || '?') + ' · ' + (B.time || '?');
  console.info('[fxs] build', JSON.stringify(B));

  applyLang();
  show(false);
  document.body.setAttribute('data-ready', '1');
})();
