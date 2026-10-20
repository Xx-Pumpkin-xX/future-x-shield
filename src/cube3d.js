/* Khối A × B × C vẽ bằng SVG, tự chiếu phối cảnh (không thư viện, hợp CSP).
   Cách xem và tương tác học theo mô hình nguyên tử Bohr 3D (Signal Garden) trên Google:
   - "bàn xoay": tâm và trục B cố định; kéo ngang quay quanh trục đứng, kéo dọc nghiêng (có giới hạn); thả tay thì trôi
     rồi chậm dần; để yên vài giây ở chế độ 3D thì khối tự xoay chậm (dừng ngay khi rê chuột, chạm, chọn Deal);
   - phóng to: nút + / − / về ban đầu / toàn màn hình; Ctrl (⌘) + cuộn hoặc chụm 2 ngón, phóng về đúng chỗ con trỏ.
     Cỡ hình cầu tăng chậm hơn khoảng cách (cỡ × zoom^0,4) nên phóng to là tách được cụm Deal chồng nhau;
   - chọn Deal: rê gần hình cầu là bắt (không cần trúng từng điểm ảnh), các Deal khác mờ đi, hiện thẻ thông tin;
     hàng nút #1 #2 … dưới khối để chọn cả khi các Deal trùng chỗ; Deal đang chọn có vạch dóng xuống 3 trục kèm giá trị;
   - độ sâu: Deal ở xa nhạt hơn; thân dọc chỉ vẽ cho Deal đang rê/chọn để khối không rối khi nhiều Deal.
   Hai mặt A × B và A × C là ma trận 2D phẳng thật (app.js đưa HTML vào o.flat): khi khối quay tới đúng mặt,
   hình 3D nhường chỗ cho ma trận 2D; kéo trên ma trận 2D thì khối nổi lại thành 3D.
   Trục: x = A (đã đổi toạ độ, vạch 1/n ở giữa), y = B (chuẩn hóa theo bMax), z = C (0..1, C cao ở phía trước,
   nên nhìn từ trên xuống thì C cao ở hàng trên: Past drain / Primary driver, như R3_11 A7). */
var Cube3D = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var FACES = { AB: { yaw: 0, pitch: 0 }, AC: { yaw: 0, pitch: -90 } };
  var FREE = { yaw: -32, pitch: -22 };
  var PITCH_MIN = -90, PITCH_MAX = 35, DEG_PER_PX = 0.45, FRICTION = 0.93;
  var ZMIN = 0.7, ZMAX = 4, AUTO_DEG = 0.09, AUTO_AFTER = 2500;
  var seq = 0; /* mỗi khối một tiền tố id riêng (trang có 2 khối): id trùng thì gradient của khối đang ẩn bị lấy nhầm */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent, tag) { var e = document.createElement(tag || 'div'); e.className = cls; if (parent) parent.appendChild(e); return e; }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function clampPitch(p) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, p)); }
  function clampZoom(z) { return Math.max(ZMIN, Math.min(ZMAX, z)); }

  function mount(host, opts) {
    opts = opts || {};
    var uid = 'c3g' + (++seq) + '-';
    var W = 420, H = 380, CAM = 6;
    /* Cỡ và tâm cố định: với CAM = 6, mọi góc trong giới hạn nghiêng thì 8 đỉnh khối nằm trong ±1,70 × ±1,81 đơn vị */
    var S0 = 91, CX = W / 2, CY = H / 2;
    var st = { yaw: FREE.yaw, pitch: FREE.pitch, zoom: 1, ox: 0, oy: 0, face: null, flat: null, pts: [], sel: null, hov: null,
      cMid: 0.5, labels: {}, anim: null, spin: null, flatHTML: {}, lastInput: 0, auto: null, visible: true, inside: false };
    host.innerHTML = '';
    host.classList.add('c3-host');

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cube3d', role: 'img', tabindex: '0', 'aria-roledescription': '3D' }, host);
    var defs = el('defs', {}, svg);
    [['hot', '#F6C3C6', '#9E2A31'], ['cool', '#E3EAF4', '#5C7393'], ['sel', '#BCD0F7', '#1F4FB8']].forEach(function (g) {
      var rg = el('radialGradient', { id: uid + g[0], cx: '35%', cy: '30%', r: '72%' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#FFFFFF' }, rg);
      el('stop', { offset: '38%', 'stop-color': g[1] }, rg);
      el('stop', { offset: '100%', 'stop-color': g[2] }, rg);
    });
    var gPlanes = el('g', { class: 'c3-planes' }, svg), gEdges = el('g', { class: 'c3-edges' }, svg);
    var gLabels = el('g', { class: 'c3-labels' }, svg), gShadow = el('g', { class: 'c3-shadow' }, svg);
    var gGuide = el('g', { class: 'c3-guide' }, svg), gPts = el('g', { class: 'c3-pts' }, svg);

    /* lớp điều khiển (HTML trên SVG) */
    var ctl = div('c3-ctl', host);
    function btn(cls, glyph, act) { var b = div('c3-btn ' + cls, ctl, 'button'); b.type = 'button'; b.innerHTML = glyph; b.setAttribute('data-c3', act); return b; }
    var bIn = btn('zin', '+', 'in'), bOut = btn('zout', '−', 'out'), bReset = btn('zreset', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'reset');
    var canFull = !!(document.fullscreenEnabled && host.requestFullscreen);
    var bFull = canFull ? btn('zfull', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'full') : null;
    var tip = div('c3-tip', host); tip.hidden = true;
    var toast = div('c3-toast', host); toast.hidden = true;
    var hint = div('c3-hint', host);
    var chips = div('c3-chips', host); chips.setAttribute('role', 'group');
    var flat = div('c3-flat matrix', host); flat.hidden = true;
    var flatHint = document.createElement('p'); flatHint.className = 'c3-flat-hint';

    function S() { return S0 * st.zoom; }
    function rot(p) {
      var y = st.yaw * Math.PI / 180, x = st.pitch * Math.PI / 180;
      var X = p[0] * Math.cos(y) + p[2] * Math.sin(y), Z = -p[0] * Math.sin(y) + p[2] * Math.cos(y);
      var Y2 = p[1] * Math.cos(x) - Z * Math.sin(x), Z2 = p[1] * Math.sin(x) + Z * Math.cos(x);
      return [X, Y2, Z2];
    }
    function proj(p) { var r = rot(p), k = CAM / (CAM - r[2]), s = S(); return { x: CX + st.ox + r[0] * s * k, y: CY + st.oy - r[1] * s * k, z: r[2], k: k }; }

    var CORNERS = [];
    [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { CORNERS.push([x, y, z]); }); }); });
    var EDGES = [];
    for (var i = 0; i < 8; i++) for (var j = i + 1; j < 8; j++) {
      var d = 0; for (var a = 0; a < 3; a++) if (CORNERS[i][a] !== CORNERS[j][a]) d++;
      if (d === 1) EDGES.push([i, j]);
    }
    function plane(axis, v) {
      var q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      return q.map(function (c) { var p = [0, 0, 0], o = [0, 1, 2].filter(function (k) { return k !== axis; }); p[axis] = v; p[o[0]] = c[0]; p[o[1]] = c[1]; return p; });
    }
    function currentFace() { return st.pitch < -45 ? 'AC' : 'AB'; }
    function ptById(id) { for (var k = 0; k < st.pts.length; k++) if (st.pts[k].id === id) return st.pts[k]; return null; }
    function focusId() { return st.hov != null ? st.hov : st.sel; }

    var items = [];
    function draw() {
      gPlanes.textContent = ''; gEdges.textContent = ''; gLabels.textContent = ''; gShadow.textContent = ''; gGuide.textContent = ''; gPts.textContent = '';
      var zc = st.cMid * 2 - 1;
      [[0, 0, 'pa'], [1, 0, 'pb'], [2, zc, 'pc']].forEach(function (pl) {
        var pts = plane(pl[0], pl[1]).map(proj);
        el('polygon', { points: pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '), class: 'c3-plane ' + pl[2] }, gPlanes);
      });
      var cp = CORNERS.map(proj);
      EDGES.forEach(function (e) {
        var a = cp[e[0]], b = cp[e[1]], back = (a.z + b.z) / 2 < -0.15;
        el('line', { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), class: 'c3-edge' + (back ? ' back' : '') }, gEdges);
      });
      var L = st.labels || {};
      function lab(p, text, cls, anchor) {
        var q = proj(p), t = el('text', { x: q.x.toFixed(1), y: q.y.toFixed(1), class: 'c3-lab ' + (cls || ''), 'text-anchor': anchor || 'middle' }, gLabels);
        t.textContent = text; return q;
      }
      lab([1.06, -1.1, 1.16], L.a || 'A →', 'axis', 'end');
      lab([-1, 1.14, 1], L.b || 'B ↑', 'axis');
      lab([-1.02, -1.12, 1.18], L.c || 'C', 'axis', 'start');
      var yw = ((st.yaw % 360) + 540) % 360 - 180, nearAB = Math.abs(yw) < 30 && st.pitch > -30, nearAC = st.pitch < -62;
      if (L.cells && (nearAB || nearAC)) {
        var face = currentFace();
        var spots = face === 'AC' ? [[-0.5, -1, 0.5], [0.5, -1, 0.5], [-0.5, -1, -0.5], [0.5, -1, -0.5]] : [[-0.5, 0.5, 1], [0.5, 0.5, 1], [-0.5, -0.5, 1], [0.5, -0.5, 1]];
        var names = face === 'AC' ? L.cellsAC : L.cells;
        spots.forEach(function (sp, i) { lab(sp, names[i], 'cell'); });
      }
      /* hình cầu: bán kính theo √w, giảm khi nhiều Deal, tăng chậm hơn khoảng cách khi phóng to */
      var many = st.pts.length > 4 ? 0.82 : 1, zr = Math.pow(st.zoom, 0.4);
      var zs = st.pts.map(function (p) { return rot([p.x, p.y, p.z])[2]; }), zlo = Math.min.apply(null, zs.concat([0])), zhi = Math.max.apply(null, zs.concat([0]));
      items = st.pts.map(function (p) {
        var q = proj([p.x, p.y, p.z]), f = proj([p.x, -1, p.z]);
        var depth = zhi > zlo ? (q.z - zlo) / (zhi - zlo) : 1;
        return { p: p, q: q, f: f, r: (8 + Math.sqrt(Math.max(0, p.w || 0)) * 19) * many * q.k * zr, depth: depth };
      }).sort(function (a, b) { return a.q.z - b.q.z; });
      var fid = focusId();
      items.forEach(function (it) {
        el('ellipse', { cx: it.f.x.toFixed(1), cy: it.f.y.toFixed(1), rx: (it.r * 0.55).toFixed(1), ry: (it.r * 0.2).toFixed(1), class: 'c3-floor' + (it.p.id === fid ? ' on' : '') }, gShadow);
        if (it.p.id === fid) el('line', { x1: it.q.x.toFixed(1), y1: it.q.y.toFixed(1), x2: it.f.x.toFixed(1), y2: it.f.y.toFixed(1), class: 'c3-stem' }, gShadow);
      });
      /* vạch dóng cho Deal đang chọn/rê: từ chân Deal tới cạnh trục A (trước, dưới), cạnh C (trái, dưới) và cạnh B (trái, trước) */
      var fp = fid != null ? ptById(fid) : null;
      if (fp) {
        var base = proj([fp.x, -1, fp.z]), top = proj([fp.x, fp.y, fp.z]);
        var tA = proj([fp.x, -1, 1]), tC = proj([-1, -1, fp.z]), tB = proj([-1, fp.y, 1]), bB = proj([fp.x, fp.y, 1]);
        [[base, tA], [base, tC], [top, bB], [bB, tB]].forEach(function (s) {
          el('line', { x1: s[0].x.toFixed(1), y1: s[0].y.toFixed(1), x2: s[1].x.toFixed(1), y2: s[1].y.toFixed(1), class: 'c3-dash' }, gGuide);
        });
        [[tA, fp.va, 'a'], [tB, fp.vb, 'b'], [tC, fp.vc, 'c']].forEach(function (m) {
          el('circle', { cx: m[0].x.toFixed(1), cy: m[0].y.toFixed(1), r: 3.2, class: 'c3-tick' }, gGuide);
          if (m[1]) { var t = el('text', { x: (m[0].x + (m[2] === 'a' ? 0 : -6)).toFixed(1), y: (m[0].y + (m[2] === 'a' ? 15 : 4)).toFixed(1), 'text-anchor': m[2] === 'a' ? 'middle' : 'end', class: 'c3-val' }, gGuide); t.textContent = m[1]; }
        });
      }
      items.forEach(function (it) {
        var on = it.p.id === fid, dim = fid != null && !on;
        var g = el('g', { class: 'c3-pt' + (st.sel === it.p.id ? ' sel' : '') + (on ? ' focus' : '') + (dim ? ' dim' : ''), 'data-id': it.p.id,
          style: 'opacity:' + (dim ? 0.28 : (0.62 + 0.38 * it.depth)).toFixed(2) }, gPts);
        el('circle', { cx: it.q.x.toFixed(1), cy: it.q.y.toFixed(1), r: it.r.toFixed(1), fill: 'url(#' + uid + (st.sel === it.p.id ? 'sel' : it.p.heat) + ')', class: 'c3-ball' }, g);
        var tx = el('text', { x: it.q.x.toFixed(1), y: (it.q.y + 3.8).toFixed(1), 'text-anchor': 'middle', class: 'c3-id' }, g);
        tx.textContent = it.p.id;
        var ti = el('title', {}, g); ti.textContent = it.p.title || ('#' + it.p.id);
      });
      svg.setAttribute('data-yaw', Math.round(st.yaw));
      svg.setAttribute('data-pitch', Math.round(st.pitch));
      svg.setAttribute('data-face', currentFace());
      host.setAttribute('data-face', st.flat || currentFace());
      host.setAttribute('data-mode', st.flat ? 'flat' : '3d');
      host.setAttribute('data-zoom', st.zoom.toFixed(2));
      bIn.disabled = st.zoom >= ZMAX - 1e-6; bOut.disabled = st.zoom <= ZMIN + 1e-6;
      drawTip();
      chips.querySelectorAll('.c3-chip').forEach(function (c) {
        var id = +c.getAttribute('data-id');
        c.setAttribute('aria-pressed', String(st.sel === id)); c.classList.toggle('focus', id === fid);
      });
    }

    /* thẻ thông tin cạnh Deal đang rê/chọn (chỉ ở chế độ 3D) */
    function drawTip() {
      var fid = focusId(), it = null;
      for (var k = 0; k < items.length; k++) if (items[k].p.id === fid) it = items[k];
      host.classList.toggle('has-focus', !!it && !st.flat);
      if (!it || st.flat) { tip.hidden = true; return; }
      var p = it.p, face = currentFace();
      tip.innerHTML = '<b>' + (p.label || '#' + p.id) + '</b><span>' + (p.vals || '') + '</span>' +
        '<em class="' + p.heat + '">' + ((face === 'AC' ? p.cellAC : p.cellAB) || '') + '</em>';
      tip.hidden = false;
      var bw = svg.getBoundingClientRect(), hw = host.getBoundingClientRect(), sx = bw.width / W, sy = bw.height / H;
      var x = bw.left - hw.left + it.q.x * sx, y = bw.top - hw.top + it.q.y * sy, r = it.r * sx;
      var tw = tip.offsetWidth, th = tip.offsetHeight, left = x + r + 10, topY = y - th / 2;
      var cr = ctl.getBoundingClientRect(), edge = hw.width - 6, ty = Math.max(6, Math.min(hw.height - th - 44, topY));
      var below = cr.bottom - hw.top + 8;
      if (ty < below - 12 && left + tw > cr.left - hw.left - 8) { /* bên phải đụng cột nút phóng to: hạ thẻ xuống dưới cột nút nếu còn chỗ */
        if (below + th < hw.height - 50 && below - (y + r) < 40) ty = below; else edge = cr.left - hw.left - 8;
      }
      if (left + tw > edge) left = x - r - 10 - tw;
      if (hw.width < 520) { left = 8; ty = hw.height - th - 50; } /* điện thoại: thẻ nằm dưới khối, không che hình cầu */
      tip.style.left = Math.max(6, left) + 'px'; tip.style.top = ty + 'px';
    }

    function renderChips() {
      var fid = focusId();
      chips.innerHTML = st.pts.slice().sort(function (a, b) { return a.id - b.id; }).map(function (p) {
        return '<button type="button" class="c3-chip ' + p.heat + (p.id === fid ? ' focus' : '') + '" data-id="' + p.id + '" aria-pressed="' + (st.sel === p.id) + '" title="' +
          (p.label || '#' + p.id).replace(/"/g, '&quot;') + '">#' + p.id + '</button>';
      }).join('');
      chips.setAttribute('aria-label', (st.labels && st.labels.chips) || 'Deals');
    }

    /* ---- 2D phẳng ---- */
    function renderFlat() {
      flat.innerHTML = st.flatHTML[st.flat] || '';
      flat.appendChild(flatHint);
      flatHint.textContent = (st.labels && st.labels.flatHint) || '';
      if (st.sel != null) { var d0 = flat.querySelector('.dot[data-id="' + st.sel + '"]'); if (d0) d0.classList.add('sel'); }
    }
    function setFlat(name) {
      st.flat = name || null;
      flat.hidden = !st.flat;
      host.classList.toggle('is-flat', !!st.flat);
      svg.classList.toggle('c3-gone', !!st.flat);
      if (st.flat) renderFlat();
      draw();
    }

    /* ---- chuyển động ---- */
    function stopMotion() {
      if (st.anim) { cancelAnimationFrame(st.anim); st.anim = null; }
      if (st.spin) { cancelAnimationFrame(st.spin); st.spin = null; }
    }
    function touched() { st.lastInput = performance.now(); }
    function animateTo(target, done) {
      stopMotion();
      var yaw = target.yaw, pitch = target.pitch, zoom = target.zoom != null ? target.zoom : st.zoom, ox = target.ox != null ? target.ox : st.ox, oy = target.oy != null ? target.oy : st.oy;
      var dy = ((yaw - st.yaw) % 360 + 540) % 360 - 180; /* quay đường ngắn nhất quanh trục đứng */
      yaw = st.yaw + dy;
      if (reducedMotion()) { st.yaw = yaw; st.pitch = pitch; st.zoom = zoom; st.ox = ox; st.oy = oy; draw(); if (done) done(); return; }
      var s0 = { yaw: st.yaw, pitch: st.pitch, zoom: st.zoom, ox: st.ox, oy: st.oy }, t0 = null, dur = 700;
      function tick(ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        st.yaw = s0.yaw + (yaw - s0.yaw) * e; st.pitch = s0.pitch + (pitch - s0.pitch) * e;
        st.zoom = s0.zoom + (zoom - s0.zoom) * e; st.ox = s0.ox + (ox - s0.ox) * e; st.oy = s0.oy + (oy - s0.oy) * e; draw();
        if (k < 1) st.anim = requestAnimationFrame(tick); else { st.anim = null; if (done) done(); }
      }
      st.anim = requestAnimationFrame(tick);
    }
    function goFace(name) {
      st.face = name;
      if (st.flat === name) { renderFlat(); return; }
      var wasFlat = st.flat;
      setFlat(null);
      if (wasFlat) { var f0 = FACES[wasFlat]; st.yaw = f0.yaw; st.pitch = f0.pitch; draw(); }
      var f = FACES[name];
      animateTo({ yaw: f.yaw, pitch: f.pitch, zoom: 1, ox: 0, oy: 0 }, function () { if (st.face === name) setFlat(name); });
    }
    function inertia(vy, vp) {
      if (reducedMotion() || Math.abs(vy) + Math.abs(vp) < 0.15) return;
      var MAXV = 6; vy = Math.max(-MAXV, Math.min(MAXV, vy)); vp = Math.max(-MAXV, Math.min(MAXV, vp));
      function tick() {
        st.yaw += vy; st.pitch = clampPitch(st.pitch + vp); vy *= FRICTION; vp *= FRICTION; draw();
        if (Math.abs(vy) + Math.abs(vp) > 0.05) st.spin = requestAnimationFrame(tick); else st.spin = null;
      }
      st.spin = requestAnimationFrame(tick);
    }
    /* tự xoay chậm khi để yên ở chế độ 3D (như mô hình Bohr); dừng khi rê chuột/chạm/chọn, khi khối ngoài màn hình hay tab ẩn */
    function autoTick() {
      st.auto = null;
      var blocked = opts.autoRotate === false || reducedMotion() || st.flat || st.anim || st.spin || drag || pinch || st.inside || st.sel != null || !st.visible || document.hidden;
      if (blocked || performance.now() - st.lastInput < AUTO_AFTER) { st.auto = setTimeout(autoTick, 400); return; } /* chờ, không vẽ khung nào */
      st.yaw += AUTO_DEG; draw();
      st.auto = requestAnimationFrame(autoTick);
    }
    function scheduleAuto() { if (!st.auto) st.auto = setTimeout(autoTick, 400); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { st.visible = es.some(function (e) { return e.isIntersecting; }); }, { threshold: 0.2 }).observe(host);
    }
    scheduleAuto();

    /* ---- phóng to ---- */
    function zoomAt(px, py, factor) {
      var z1 = clampZoom(st.zoom * factor), f = z1 / st.zoom;
      if (Math.abs(f - 1) < 1e-4) return;
      /* giữ nguyên điểm dưới con trỏ: tâm mới = con trỏ − (con trỏ − tâm cũ) × f; khi về 1× thì tâm về giữa */
      var cx = CX + st.ox, cy = CY + st.oy;
      st.ox = px - (px - cx) * f - CX; st.oy = py - (py - cy) * f - CY;
      st.zoom = z1;
      if (z1 <= 1.0001) { st.ox = 0; st.oy = 0; } /* về 1× hay nhỏ hơn thì khối về giữa khung */
      if (st.flat) setFlat(null);
      st.face = null;
      draw();
    }
    function toSvg(clientX, clientY) { var r = svg.getBoundingClientRect(); return [(clientX - r.left) / r.width * W, (clientY - r.top) / r.height * H]; }
    function showToast(text) {
      if (!text) return;
      toast.textContent = text; toast.hidden = false; clearTimeout(showToast.t);
      showToast.t = setTimeout(function () { toast.hidden = true; }, 1400);
    }
    host.addEventListener('wheel', function (e) {
      var full = document.fullscreenElement === host;
      if (!(e.ctrlKey || e.metaKey || full)) { showToast(st.labels.wheel); return; } /* cuộn thường: để trang cuộn */
      e.preventDefault(); touched(); stopMotion();
      var p = toSvg(e.clientX, e.clientY);
      zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)));
    }, { passive: false });

    /* ---- chọn Deal: rê gần là bắt ---- */
    function pick(clientX, clientY, pad) {
      if (st.flat) return null;
      var p = toSvg(clientX, clientY), best = null;
      for (var k = items.length - 1; k >= 0; k--) { /* phía trước được ưu tiên */
        var it = items[k], dx = p[0] - it.q.x, dy = p[1] - it.q.y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd <= it.r + pad && (!best || dd - it.r < best[1] - 2)) best = [it.p.id, dd - it.r];
      }
      return best ? best[0] : null;
    }
    function setHover(id) { if (id === st.hov) return; st.hov = id; draw(); host.classList.toggle('over-pt', id != null); }
    function selectId(id) {
      st.sel = st.sel === id ? null : id;
      if (st.flat) renderFlat();
      draw();
      if (opts.onSelect) opts.onSelect(st.sel);
    }

    /* ---- kéo để xoay, chụm 2 ngón để phóng ---- */
    var drag = null, pointers = {}, pinch = null;
    function down(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && (e.target.closest('.c3-ctl') || e.target.closest('.c3-chips'))) return;
      pointers[e.pointerId] = [e.clientX, e.clientY];
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
      touched();
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.zoom }; drag = null; return;
      }
      var g = e.target.closest && e.target.closest('.dot');
      var id = g ? +g.getAttribute('data-id') : pick(e.clientX, e.clientY, e.pointerType === 'touch' ? 14 : 6);
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vy: 0, vp: 0, moved: false, id: id };
    }
    function move(e) {
      if (pointers[e.pointerId]) pointers[e.pointerId] = [e.clientX, e.clientY];
      if (pinch) {
        var ids = Object.keys(pointers); if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]], d2 = Math.hypot(a[0] - b[0], a[1] - b[1]);
        var m = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        touched(); zoomAt(m[0], m[1], pinch.z * d2 / pinch.d / st.zoom); e.preventDefault(); return;
      }
      if (!drag) { if (e.pointerType !== 'touch') setHover(pick(e.clientX, e.clientY, 6)); return; }
      var dx = e.clientX - drag.lx, dyy = e.clientY - drag.ly;
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 5) return;
        drag.moved = true; stopMotion(); st.face = null; setHover(null);
        if (st.flat) setFlat(null); /* ma trận 2D nổi lại thành khối 3D, ở đúng góc mặt đó */
        if (opts.onRotate) opts.onRotate();
      }
      touched();
      var dt = Math.max(1, e.timeStamp - drag.lt);
      st.yaw += dx * DEG_PER_PX;
      st.pitch = clampPitch(st.pitch - dyy * DEG_PER_PX);
      drag.vy = drag.vy * 0.5 + (dx * DEG_PER_PX / dt * 16) * 0.5;
      drag.vp = drag.vp * 0.5 + (-dyy * DEG_PER_PX / dt * 16) * 0.5;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp;
      draw(); e.preventDefault();
    }
    function up(e) {
      delete pointers[e.pointerId];
      if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; return; }
      if (!drag) return;
      var d0 = drag; drag = null; touched();
      if (!d0.moved) { if (d0.id != null) selectId(d0.id); else if (st.sel != null && !st.flat) selectId(st.sel); return; }
      if (e && e.timeStamp - d0.lt > 80) return; /* dừng tay rồi mới thả thì không trôi */
      inertia(d0.vy, d0.vp);
    }
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; drag = null; pinch = null; });
    host.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') st.inside = true; });
    host.addEventListener('pointerleave', function () { st.inside = false; setHover(null); });
    function resetView() { touched(); stopMotion(); setFlat(null); st.face = null; if (opts.onRotate) opts.onRotate(); animateTo({ yaw: FREE.yaw, pitch: FREE.pitch, zoom: 1, ox: 0, oy: 0 }); }
    host.addEventListener('dblclick', function (e) { if (e.target.closest('.c3-ctl, .c3-chips')) return; resetView(); });
    host.addEventListener('keydown', function (e) {
      var k = e.key, step = 8;
      if (k === '+' || k === '=') { touched(); zoomAt(CX, CY, 1.25); e.preventDefault(); return; }
      if (k === '-' || k === '_') { touched(); zoomAt(CX, CY, 0.8); e.preventDefault(); return; }
      if (k === 'Escape' && st.sel != null) { selectId(st.sel); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(k) < 0 || !e.target.closest('svg, .c3-flat')) return;
      touched(); stopMotion(); st.face = null; if (st.flat) setFlat(null); if (opts.onRotate) opts.onRotate();
      if (k === 'ArrowLeft') st.yaw -= step; else if (k === 'ArrowRight') st.yaw += step;
      else if (k === 'ArrowUp') st.pitch = clampPitch(st.pitch - step); else st.pitch = clampPitch(st.pitch + step);
      e.preventDefault(); draw();
    });
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c3]'); if (!b) return;
      var a = b.getAttribute('data-c3'); touched();
      if (a === 'in') zoomAt(CX, CY, 1.4); else if (a === 'out') zoomAt(CX, CY, 1 / 1.4);
      else if (a === 'reset') resetView();
      else if (a === 'full') { if (document.fullscreenElement === host) document.exitFullscreen(); else host.requestFullscreen().catch(function () {}); }
    });
    chips.addEventListener('click', function (e) { var c = e.target.closest('.c3-chip'); if (c) { touched(); selectId(+c.getAttribute('data-id')); } });
    chips.addEventListener('pointerover', function (e) { var c = e.target.closest('.c3-chip'); if (c) setHover(+c.getAttribute('data-id')); });
    chips.addEventListener('pointerout', function (e) { if (!e.relatedTarget || !chips.contains(e.relatedTarget)) setHover(null); });
    chips.addEventListener('focusin', function (e) { var c = e.target.closest('.c3-chip'); if (c) setHover(+c.getAttribute('data-id')); });
    chips.addEventListener('focusout', function () { setHover(null); });
    document.addEventListener('fullscreenchange', function () { host.classList.toggle('is-full', document.fullscreenElement === host); setLabels(); draw(); });

    function setLabels() {
      var L = st.labels || {};
      bIn.setAttribute('aria-label', L.zin || '+'); bIn.title = L.zin || '';
      bOut.setAttribute('aria-label', L.zout || '−'); bOut.title = L.zout || '';
      bReset.setAttribute('aria-label', L.reset || 'reset'); bReset.title = L.reset || '';
      if (bFull) { var f = document.fullscreenElement === host; bFull.setAttribute('aria-label', f ? L.exitFull : L.full); bFull.title = (f ? L.exitFull : L.full) || ''; }
      var coarse = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
      hint.textContent = (coarse && L.hintTouch) || L.hint || '';
    }

    /* points: [{id, A, B, C, w, heat, title, label, vals, va, vb, vc, cellAB, cellAC}]
       o: {bMax, n, cMid, face:'auto'|'AB'|'AC'|'3d', tone, labels, flat:{AB: html, AC: html}, key}
       face 'auto' = theo màu (đỏ → A × C, còn lại → A × B), luôn đưa về đúng mặt 2D; '3d' = để người xem tự xoay. */
    function update(points, o) {
      o = o || {};
      st.labels = o.labels || st.labels || {};
      st.flatHTML = o.flat || {};
      st.cMid = o.cMid != null ? o.cMid : 1 / Math.max(1, o.n || points.length || 1);
      var bMax = o.bMax || 0.02;
      st.pts = points.map(function (p) {
        return { id: p.id, heat: p.heat, title: p.title, label: p.label, vals: p.vals, va: p.va, vb: p.vb, vc: p.vc, cellAB: p.cellAB, cellAC: p.cellAC,
          x: 0.88 * Math.max(-1, Math.min(1, p.A == null ? 0 : p.A)),
          y: 0.88 * Math.max(-1, Math.min(1, p.B / bMax)),
          z: 0.88 * ((p.C == null ? 0 : p.C) * 2 - 1), w: p.w };
      });
      if (st.sel != null && !points.some(function (p) { return p.id === st.sel; })) st.sel = null;
      if (st.hov != null && !points.some(function (p) { return p.id === st.hov; })) st.hov = null;
      setLabels(); renderChips();
      var want = o.face === 'auto' ? (o.tone === 'red' ? 'AC' : 'AB') : (o.face === 'AB' || o.face === 'AC' ? o.face : null);
      /* Người xem đã kéo/phóng khối ra khỏi mặt: chỉ đưa về mặt khi có thay đổi thật (thêm bước, đổi phiên, đổi màu, bấm nút mặt),
         không đưa về khi chỉ chọn Deal, đổi ngôn ngữ hay đổi cỡ cửa sổ. */
      var changed = o.key !== st.key || want !== st.want || st.forced;
      st.key = o.key; st.want = want; st.forced = false;
      if (want && !drag && (changed || st.face === want)) {
        if (st.flat === want || (st.anim && st.face === want)) { if (st.flat) renderFlat(); draw(); }
        else goFace(want);
      } else {
        if (!want && st.flat) setFlat(null);
        if (!want && st.face) { st.face = null; animateTo({ yaw: FREE.yaw, pitch: FREE.pitch, zoom: 1, ox: 0, oy: 0 }); }
        else draw();
      }
    }
    function select(id) { st.sel = id; if (st.flat) renderFlat(); draw(); }
    function face(name) { if (name === '3d') { st.face = null; setFlat(null); animateTo({ yaw: FREE.yaw, pitch: FREE.pitch }); } else goFace(name); }
    function reset() { st.forced = true; }
    setLabels(); draw();
    return { update: update, select: select, face: face, reset: reset, svg: svg, state: st };
  }
  return { mount: mount, FACES: FACES };
})();
