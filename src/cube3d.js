/* Khối A × B × C vẽ bằng SVG, tự chiếu phối cảnh (không thư viện, hợp CSP).
   Cách xoay học theo mô hình 3D kiểu "bàn xoay" (như mô hình nguyên tử Bohr của Google):
   - tâm xoay và cỡ khối cố định: khối không phình, không trôi khi xoay;
   - kéo ngang: quay quanh trục đứng (trục B luôn thẳng đứng); kéo dọc: nghiêng, giới hạn từ nhìn thẳng trên xuống tới hơi nhìn từ dưới;
   - thả tay khi đang kéo nhanh thì khối trôi tiếp rồi chậm dần (quán tính);
   - kéo được từ bất kỳ chỗ nào, kể cả trên hình cầu; bấm (không kéo) vào hình cầu thì chọn Deal.
   Hai mặt A × B và A × C là ma trận 2D phẳng thật (app.js đưa HTML vào o.flat): khi khối quay tới đúng mặt,
   hình 3D nhường chỗ cho ma trận 2D; kéo trên ma trận 2D thì khối nổi lại thành 3D.
   Trục: x = A (đã đổi toạ độ, vạch 1/n ở giữa), y = B (chuẩn hóa theo bMax), z = C (0..1, C cao ở phía trước,
   nên nhìn từ trên xuống thì C cao ở hàng trên: Past drain / Primary driver, như R3_11 A7). */
var Cube3D = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  /* Mặt nhìn thẳng (2D) và góc mặc định khi xoay tự do */
  var FACES = { AB: { yaw: 0, pitch: 0 }, AC: { yaw: 0, pitch: -90 } };
  var FREE = { yaw: -32, pitch: -22 };
  var PITCH_MIN = -90, PITCH_MAX = 35, DEG_PER_PX = 0.45, FRICTION = 0.93;
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function clampPitch(p) { return Math.max(PITCH_MIN, Math.min(PITCH_MAX, p)); }

  function mount(host, opts) {
    opts = opts || {};
    var W = 420, H = 380, CAM = 6;
    /* Cỡ và tâm cố định, tính một lần: với CAM = 6, mọi góc trong giới hạn nghiêng thì 8 đỉnh khối nằm trong
       ±1,70 (ngang) và ±1,81 (dọc) đơn vị, nên S = 91 vừa khung 420 × 380 còn chừa lề cho nhãn trục. */
    var S = 91, cx = W / 2, cy = H / 2;
    var st = { yaw: FREE.yaw, pitch: FREE.pitch, face: null, flat: null, pts: [], sel: null, cMid: 0.5, labels: null,
      anim: null, spin: null, flatHTML: {} };
    host.innerHTML = '';
    host.classList.add('c3-host');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cube3d', role: 'img', tabindex: '0', 'aria-roledescription': '3D' }, host);
    var flat = document.createElement('div');
    flat.className = 'c3-flat matrix';
    flat.hidden = true;
    host.appendChild(flat);
    var defs = el('defs', {}, svg);
    [['hot', '#F4B4B7', '#A3262C'], ['cool', '#DCE4F0', '#6A7F9E'], ['sel', '#9FB9F0', '#1F4FB8']].forEach(function (g) {
      var rg = el('radialGradient', { id: 'cg-' + g[0], cx: '35%', cy: '30%', r: '70%' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#FFFFFF' }, rg);
      el('stop', { offset: '35%', 'stop-color': g[1] }, rg);
      el('stop', { offset: '100%', 'stop-color': g[2] }, rg);
    });
    var gPlanes = el('g', { class: 'c3-planes' }, svg), gEdges = el('g', { class: 'c3-edges' }, svg);
    var gLabels = el('g', { class: 'c3-labels' }, svg), gShadow = el('g', { class: 'c3-shadow' }, svg), gPts = el('g', { class: 'c3-pts' }, svg);
    var hint = el('text', { x: W - 8, y: H - 8, 'text-anchor': 'end', class: 'c3-hint' }, svg);
    var flatHint = document.createElement('p');
    flatHint.className = 'c3-flat-hint';

    function rot(p) {
      var y = st.yaw * Math.PI / 180, x = st.pitch * Math.PI / 180;
      var X = p[0] * Math.cos(y) + p[2] * Math.sin(y), Z = -p[0] * Math.sin(y) + p[2] * Math.cos(y);
      var Y2 = p[1] * Math.cos(x) - Z * Math.sin(x), Z2 = p[1] * Math.sin(x) + Z * Math.cos(x);
      return [X, Y2, Z2];
    }
    function proj(p) { var r = rot(p), k = CAM / (CAM - r[2]); return { x: cx + r[0] * S * k, y: cy - r[1] * S * k, z: r[2], k: k }; }

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

    function draw() {
      gPlanes.textContent = ''; gEdges.textContent = ''; gLabels.textContent = ''; gShadow.textContent = ''; gPts.textContent = '';
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
      /* tên ô chỉ hiện khi đang nhìn gần thẳng một mặt (không chồng chữ lúc khối đang xoay xiên) */
      var yw = ((st.yaw % 360) + 540) % 360 - 180, nearAB = Math.abs(yw) < 30 && st.pitch > -30, nearAC = st.pitch < -62;
      if (L.cells && (nearAB || nearAC)) {
        /* tên ô ở mặt đang nhìn: AB = mặt trước (z = 1), AC = mặt đáy (y = −1) */
        var face = currentFace();
        var spots = face === 'AC' ? [[-0.5, -1, 0.5], [0.5, -1, 0.5], [-0.5, -1, -0.5], [0.5, -1, -0.5]] : [[-0.5, 0.5, 1], [0.5, 0.5, 1], [-0.5, -0.5, 1], [0.5, -0.5, 1]];
        var names = face === 'AC' ? L.cellsAC : L.cells;
        spots.forEach(function (sp, i) { lab(sp, names[i], 'cell'); });
      }
      var items = st.pts.map(function (p) {
        var pos = [p.x, p.y, p.z], q = proj(pos), f = proj([p.x, -1, p.z]);
        return { p: p, q: q, f: f };
      }).sort(function (a, b) { return a.q.z - b.q.z; });
      items.forEach(function (it) {
        el('line', { x1: it.q.x.toFixed(1), y1: it.q.y.toFixed(1), x2: it.f.x.toFixed(1), y2: it.f.y.toFixed(1), class: 'c3-stem' }, gShadow);
        el('ellipse', { cx: it.f.x.toFixed(1), cy: it.f.y.toFixed(1), rx: (it.p.r * it.f.k * 0.8).toFixed(1), ry: (it.p.r * it.f.k * 0.28).toFixed(1), class: 'c3-floor' }, gShadow);
      });
      items.forEach(function (it) {
        var r = it.p.r * it.q.k, g = el('g', { class: 'c3-pt' + (st.sel === it.p.id ? ' sel' : ''), 'data-id': it.p.id }, gPts);
        el('circle', { cx: it.q.x.toFixed(1), cy: it.q.y.toFixed(1), r: r.toFixed(1), fill: 'url(#cg-' + (st.sel === it.p.id ? 'sel' : it.p.heat) + ')', class: 'c3-ball' }, g);
        var tx = el('text', { x: it.q.x.toFixed(1), y: (it.q.y + 4).toFixed(1), 'text-anchor': 'middle', class: 'c3-id' }, g);
        tx.textContent = it.p.id;
        var ti = el('title', {}, g); ti.textContent = it.p.title || ('#' + it.p.id);
      });
      svg.setAttribute('data-yaw', Math.round(st.yaw));
      svg.setAttribute('data-pitch', Math.round(st.pitch));
      svg.setAttribute('data-face', currentFace());
      host.setAttribute('data-face', st.flat || currentFace());
      host.setAttribute('data-mode', st.flat ? 'flat' : '3d');
      hint.textContent = (st.labels && st.labels.hint) || '';
    }

    /* ---- 2D phẳng ---- */
    function renderFlat() {
      flat.innerHTML = st.flatHTML[st.flat] || '';
      flat.appendChild(flatHint);
      flatHint.textContent = (st.labels && st.labels.flatHint) || '';
      if (st.sel != null) { var d = flat.querySelector('.dot[data-id="' + st.sel + '"]'); if (d) d.classList.add('sel'); }
    }
    function setFlat(name) {
      st.flat = name || null;
      flat.hidden = !st.flat;
      svg.classList.toggle('c3-gone', !!st.flat);
      if (st.flat) renderFlat();
      draw();
    }

    /* ---- chuyển động ---- */
    function stopMotion() {
      if (st.anim) { cancelAnimationFrame(st.anim); st.anim = null; }
      if (st.spin) { cancelAnimationFrame(st.spin); st.spin = null; }
    }
    function animateTo(yaw, pitch, done) {
      stopMotion();
      /* quay đường ngắn nhất quanh trục đứng */
      var dy = ((yaw - st.yaw) % 360 + 540) % 360 - 180;
      yaw = st.yaw + dy;
      if (reducedMotion()) { st.yaw = yaw; st.pitch = pitch; draw(); if (done) done(); return; }
      var y0 = st.yaw, p0 = st.pitch, t0 = null, dur = 700;
      function tick(ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        st.yaw = y0 + (yaw - y0) * e; st.pitch = p0 + (pitch - p0) * e; draw();
        if (k < 1) st.anim = requestAnimationFrame(tick); else { st.anim = null; if (done) done(); }
      }
      st.anim = requestAnimationFrame(tick);
    }
    /* đưa khối tới một mặt rồi trải phẳng thành ma trận 2D */
    function goFace(name) {
      st.face = name;
      if (st.flat === name) { renderFlat(); return; }
      var wasFlat = st.flat;
      setFlat(null);
      if (wasFlat) { var f0 = FACES[wasFlat]; st.yaw = f0.yaw; st.pitch = f0.pitch; draw(); }
      var f = FACES[name];
      animateTo(f.yaw, f.pitch, function () { if (st.face === name) setFlat(name); });
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

    /* ---- kéo để xoay (chuột, bút, ngón tay) ---- */
    var drag = null;
    function down(e) {
      if (e.button != null && e.button !== 0) return;
      var g = e.target.closest && (e.target.closest('.c3-pt') || e.target.closest('.dot'));
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vy: 0, vp: 0, moved: false, id: g ? +g.getAttribute('data-id') : null };
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    }
    function move(e) {
      if (!drag) return;
      var dx = e.clientX - drag.lx, dyy = e.clientY - drag.ly;
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 5) return;
        drag.moved = true;
        stopMotion();
        st.face = null;
        if (st.flat) setFlat(null); /* ma trận 2D nổi lại thành khối 3D, ở đúng góc mặt đó */
        if (opts.onRotate) opts.onRotate();
      }
      var dt = Math.max(1, e.timeStamp - drag.lt);
      st.yaw += dx * DEG_PER_PX;
      st.pitch = clampPitch(st.pitch - dyy * DEG_PER_PX);
      /* vận tốc (độ mỗi khung 16 ms), làm mượt để thả tay không giật */
      drag.vy = drag.vy * 0.5 + (dx * DEG_PER_PX / dt * 16) * 0.5;
      drag.vp = drag.vp * 0.5 + (-dyy * DEG_PER_PX / dt * 16) * 0.5;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp;
      draw();
      e.preventDefault();
    }
    function up(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.moved) { if (d.id != null) { st.sel = d.id; if (st.flat) renderFlat(); draw(); if (opts.onSelect) opts.onSelect(d.id); } return; }
      /* vừa dừng tay rồi mới thả thì không trôi */
      if (e && e.timeStamp - d.lt > 80) return;
      inertia(d.vy, d.vp);
    }
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', function () { drag = null; });
    host.addEventListener('dblclick', function () { if (opts.onRotate) opts.onRotate(); stopMotion(); setFlat(null); st.face = null; animateTo(FREE.yaw, FREE.pitch); });
    host.addEventListener('keydown', function (e) {
      var k = e.key, step = 8;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(k) < 0) return;
      stopMotion(); st.face = null; if (st.flat) setFlat(null); if (opts.onRotate) opts.onRotate();
      if (k === 'ArrowLeft') st.yaw -= step; else if (k === 'ArrowRight') st.yaw += step;
      else if (k === 'ArrowUp') st.pitch = clampPitch(st.pitch - step); else st.pitch = clampPitch(st.pitch + step);
      e.preventDefault(); draw();
    });

    /* points: [{id, A, B, C, w, heat, title}]
       o: {bMax, n, cMid, face:'auto'|'AB'|'AC'|'3d', tone, labels, flat:{AB: html, AC: html}}
       face 'auto' = theo màu (đỏ → A × C, còn lại → A × B), luôn đưa về đúng mặt 2D; '3d' = để người xem tự xoay. */
    function update(points, o) {
      o = o || {};
      st.labels = o.labels || st.labels;
      st.flatHTML = o.flat || {};
      st.cMid = o.cMid != null ? o.cMid : 1 / Math.max(1, o.n || points.length || 1);
      var bMax = o.bMax || 0.02;
      st.pts = points.map(function (p) {
        return { id: p.id, heat: p.heat, title: p.title,
          x: 0.88 * Math.max(-1, Math.min(1, p.A == null ? 0 : p.A)),
          y: 0.88 * Math.max(-1, Math.min(1, p.B / bMax)),
          z: 0.88 * ((p.C == null ? 0 : p.C) * 2 - 1),
          r: 9 + Math.sqrt(Math.max(0, p.w || 0)) * 22 };
      });
      if (st.sel != null && !points.some(function (p) { return p.id === st.sel; })) st.sel = null;
      var want = o.face === 'auto' ? (o.tone === 'red' ? 'AC' : 'AB') : (o.face === 'AB' || o.face === 'AC' ? o.face : null);
      /* Người xem đã kéo khối ra khỏi mặt: chỉ đưa về mặt khi có thay đổi thật (thêm bước, đổi phiên, đổi màu, bấm nút mặt),
         không đưa về khi chỉ chọn Deal, đổi ngôn ngữ hay đổi cỡ cửa sổ. */
      var changed = o.key !== st.key || want !== st.want || st.forced;
      st.key = o.key; st.want = want; st.forced = false;
      if (want && !drag && (changed || st.face === want)) {
        if (st.flat === want || (st.anim && st.face === want)) { if (st.flat) renderFlat(); draw(); }
        else goFace(want);
      } else {
        if (!want && st.flat) setFlat(null);
        if (!want && st.face) { st.face = null; animateTo(FREE.yaw, FREE.pitch); }
        else draw();
      }
    }
    function select(id) { st.sel = id; if (st.flat) renderFlat(); draw(); }
    function face(name) { if (name === '3d') { st.face = null; setFlat(null); animateTo(FREE.yaw, FREE.pitch); } else goFace(name); }
    /* bấm nút chế độ: lần update kế tiếp luôn áp chế độ mới */
    function reset() { st.forced = true; }
    draw();
    return { update: update, select: select, face: face, reset: reset, svg: svg, state: st };
  }
  return { mount: mount, FACES: FACES };
})();
