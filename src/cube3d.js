/* Khối A × B × C vẽ bằng SVG, tự chiếu phối cảnh (không thư viện, hợp CSP).
   - Kéo (chuột hoặc ngón tay) để xoay; phím mũi tên khi khối đang được chọn; nút đặt sẵn mặt A × B, A × C.
   - Mỗi Deal là một hình cầu: bán kính theo √w (diện tích chấm tỷ lệ với phần cọc), có bóng đổ xuống đáy để đọc độ cao B.
   - Bấm vào hình cầu để chọn Deal; khối gọi lại onSelect(id).
   Trục: x = A (−1..1), y = B (chuẩn hóa theo bMax, lên trên là lãi), z = C (0..1, C cao nằm phía sau khối). */
var Cube3D = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var FACES = { AB: { yaw: -28, pitch: -16 }, AC: { yaw: -22, pitch: -78 } };
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  function mount(host, opts) {
    opts = opts || {};
    var W = 420, H = 380, cx = W / 2, cy = H / 2 + 6, S = 106, CAM = 4.2;
    var st = { yaw: FACES.AB.yaw, pitch: FACES.AB.pitch, face: 'auto', pts: [], sel: null, cMid: 0.5, labels: null, anim: null };
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cube3d', role: 'img', tabindex: '0', 'aria-roledescription': '3D' }, host);
    var defs = el('defs', {}, svg);
    [['hot', '#F7A1A1', '#C93434'], ['warm', '#FBE08F', '#C98A00'], ['cool', '#D4E1F5', '#5F7FB2'], ['sel', '#9FB9F0', '#1F4FB8']].forEach(function (g) {
      var rg = el('radialGradient', { id: 'cg-' + g[0], cx: '35%', cy: '30%', r: '70%' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#FFFFFF' }, rg);
      el('stop', { offset: '35%', 'stop-color': g[1] }, rg);
      el('stop', { offset: '100%', 'stop-color': g[2] }, rg);
    });
    var gPlanes = el('g', { class: 'c3-planes' }, svg), gEdges = el('g', { class: 'c3-edges' }, svg);
    var gLabels = el('g', { class: 'c3-labels' }, svg), gShadow = el('g', { class: 'c3-shadow' }, svg), gPts = el('g', { class: 'c3-pts' }, svg);
    var hint = el('text', { x: W - 8, y: H - 8, 'text-anchor': 'end', class: 'c3-hint' }, svg);

    function rot(p) {
      var y = st.yaw * Math.PI / 180, x = st.pitch * Math.PI / 180;
      var X = p[0] * Math.cos(y) + p[2] * Math.sin(y), Z = -p[0] * Math.sin(y) + p[2] * Math.cos(y);
      var Y2 = p[1] * Math.cos(x) - Z * Math.sin(x), Z2 = p[1] * Math.sin(x) + Z * Math.cos(x);
      return [X, Y2, Z2];
    }
    function proj(p) { var r = rot(p), k = CAM / (CAM - r[2]); return { x: cx + r[0] * S * k, y: cy - r[1] * S * k, z: r[2], k: k }; }
    /* co giãn để cả khối (và nhãn trục) luôn nằm gọn trong khung, ở mọi góc xoay */
    function fit() {
      var xs = [], ys = [];
      CORNERS.concat([[1.18, -1, 1], [-1, 1.16, 1], [-1.12, -1, -1.12]]).forEach(function (p) {
        var r = rot(p), k = CAM / (CAM - r[2]); xs.push(r[0] * k); ys.push(-r[1] * k);
      });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      S = Math.min((W - 56) / (maxX - minX), (H - 64) / (maxY - minY));
      cx = W / 2 - (minX + maxX) / 2 * S; cy = (H - 14) / 2 - (minY + maxY) / 2 * S;
    }

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

    function draw() {
      fit();
      gPlanes.textContent = ''; gEdges.textContent = ''; gLabels.textContent = ''; gShadow.textContent = ''; gPts.textContent = '';
      var zc = 1 - st.cMid * 2; /* C cao nằm phía sau: nhìn từ trên xuống thì ở nửa trên */
      [[0, 0, 'pa'], [1, 0, 'pb'], [2, zc, 'pc']].forEach(function (pl) {
        var pts = plane(pl[0], pl[1]).map(proj);
        el('polygon', { points: pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '), class: 'c3-plane ' + pl[2] }, gPlanes);
      });
      var cp = CORNERS.map(proj), zMid = 0;
      EDGES.forEach(function (e) {
        var a = cp[e[0]], b = cp[e[1]], back = (a.z + b.z) / 2 < zMid - 0.15;
        el('line', { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), class: 'c3-edge' + (back ? ' back' : '') }, gEdges);
      });
      var L = st.labels || {};
      function lab(p, text, cls) { var q = proj(p); var t = el('text', { x: q.x.toFixed(1), y: q.y.toFixed(1), class: 'c3-lab ' + (cls || ''), 'text-anchor': 'middle' }, gLabels); t.textContent = text; return q; }
      lab([1.18, -1, 1], L.a || 'A →', 'axis');
      lab([-1, 1.16, 1], L.b || 'B ↑', 'axis');
      lab([-1.12, -1, -1.12], L.c || 'C', 'axis');
      if (L.cells) {
        /* tên ô ở mặt đang nhìn: AB = mặt trước (z = 1), AC = mặt đáy (y = −1) */
        var face = currentFace();
        var spots = face === 'AC' ? [[-0.5, -1, -0.5], [0.5, -1, -0.5], [-0.5, -1, 0.5], [0.5, -1, 0.5]] : [[-0.5, 0.5, 1], [0.5, 0.5, 1], [-0.5, -0.5, 1], [0.5, -0.5, 1]];
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
        var r = it.p.r * it.q.k, g = el('g', { class: 'c3-pt' + (st.sel === it.p.id ? ' sel' : ''), 'data-id': it.p.id, tabindex: '-1' }, gPts);
        el('circle', { cx: it.q.x.toFixed(1), cy: it.q.y.toFixed(1), r: r.toFixed(1), fill: 'url(#cg-' + (st.sel === it.p.id ? 'sel' : it.p.heat) + ')', class: 'c3-ball' }, g);
        var tx = el('text', { x: it.q.x.toFixed(1), y: (it.q.y + 4).toFixed(1), 'text-anchor': 'middle', class: 'c3-id' }, g);
        tx.textContent = it.p.id;
        var ti = el('title', {}, g); ti.textContent = it.p.title || ('#' + it.p.id);
      });
      svg.setAttribute('data-yaw', Math.round(st.yaw));
      svg.setAttribute('data-pitch', Math.round(st.pitch));
      svg.setAttribute('data-face', currentFace());
      host.setAttribute('data-face', currentFace());
      hint.textContent = (st.labels && st.labels.hint) || '';
    }
    function currentFace() { return st.pitch < -45 ? 'AC' : 'AB'; }

    function animateTo(yaw, pitch) {
      if (st.anim) cancelAnimationFrame(st.anim);
      if (reducedMotion()) { st.yaw = yaw; st.pitch = pitch; draw(); return; }
      var y0 = st.yaw, p0 = st.pitch, t0 = null, dur = 650;
      function tick(ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        st.yaw = y0 + (yaw - y0) * e; st.pitch = p0 + (pitch - p0) * e; draw();
        if (k < 1) st.anim = requestAnimationFrame(tick); else st.anim = null;
      }
      st.anim = requestAnimationFrame(tick);
    }

    /* kéo để xoay */
    var drag = null;
    svg.addEventListener('pointerdown', function (e) {
      var g = e.target.closest && e.target.closest('.c3-pt');
      if (g) { st.sel = +g.getAttribute('data-id'); draw(); if (opts.onSelect) opts.onSelect(st.sel); return; }
      drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      st.yaw = drag.yaw + dx * 0.5;
      st.pitch = Math.max(-89, Math.min(30, drag.pitch - dy * 0.5));
      if (st.anim) { cancelAnimationFrame(st.anim); st.anim = null; }
      draw();
    });
    function endDrag() { if (drag && drag.moved && opts.onRotate) opts.onRotate(); drag = null; }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('keydown', function (e) {
      var k = e.key, step = 8;
      if (k === 'ArrowLeft') st.yaw -= step; else if (k === 'ArrowRight') st.yaw += step;
      else if (k === 'ArrowUp') st.pitch = Math.max(-89, st.pitch - step); else if (k === 'ArrowDown') st.pitch = Math.min(30, st.pitch + step);
      else return;
      e.preventDefault(); draw();
    });

    /* points: [{id, A, B, C, w, heat, title}], o: {bMax, n, face:'auto'|'AB'|'AC', tone, labels} */
    function update(points, o) {
      o = o || {};
      st.labels = o.labels || st.labels;
      st.cMid = 1 / Math.max(1, o.n || points.length || 1);
      var bMax = o.bMax || 0.02;
      st.pts = points.map(function (p) {
        return { id: p.id, heat: p.heat, title: p.title,
          x: 0.88 * Math.max(-1, Math.min(1, p.A == null ? 0 : p.A)),
          y: 0.88 * Math.max(-1, Math.min(1, p.B / bMax)),
          z: 0.88 * (1 - (p.C == null ? 0 : p.C) * 2),
          r: 9 + Math.sqrt(Math.max(0, p.w || 0)) * 22 };
      });
      if (st.sel != null && !points.some(function (p) { return p.id === st.sel; })) st.sel = null;
      var want = o.face === 'auto' ? (o.tone === 'red' ? 'AC' : 'AB') : o.face;
      if (want && want !== st.face) { st.face = want; var f = FACES[want]; animateTo(f.yaw, f.pitch); }
      else draw();
    }
    function select(id) { st.sel = id; draw(); }
    function face(name) { st.face = name; var f = FACES[name]; animateTo(f.yaw, f.pitch); }
    draw();
    return { update: update, select: select, face: face, svg: svg, state: st };
  }
  return { mount: mount, FACES: FACES };
})();
