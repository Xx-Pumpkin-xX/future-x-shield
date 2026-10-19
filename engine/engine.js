/* ShieldEngine — port 1-1 của R3_phan_tich/shield_engine.py (bàn giao Team Product 16/10/2026).
   Một nguồn duy nhất: build_boards.py chèn file này vào từng artboard. Sửa ở đây, không sửa trong artboard. */
var SE = (function () {
  var INIT = 0.1848, WARN = 0.1771, M_ = 0.1735, MUL = 0.1, MAXX = 0.30, STEP = 0.0001;

  function pnl(d, P) { return d.s * d.n * (P - d.Pref) * MUL; }
  function ratio(d, P) { return (d.D + Math.min(0, pnl(d, P))) / (d.n * P * MUL); }
  /* đệm riêng h = E − m·N (demo_calc.h) */
  function head(d, P) { return d.D + Math.min(0, pnl(d, P)) - M_ * d.n * P * MUL; }
  function deal(o) {
    var d = Object.assign({ n: 1, T: 0, L: 0 }, o);
    if (d.Popen == null) d.Popen = d.Pref;
    if (d.D == null) d.D = INIT * d.n * d.Pref * MUL;
    return d;
  }
  function copy(ds) { return ds.map(function (d) { return Object.assign({}, d); }); }

  /* Bù theo luật Future X: Deal có R < 17,71% được bù từ F về 18,48%, tỷ lệ thấp nhất trước.
     Thứ tự sắp xếp tính một lần trước vòng bù, giống sorted(...) trong Python. Trả về F còn lại. */
  function topUp(ds, F, P, onTop) {
    var order = ds.map(function (d) { return { d: d, r: ratio(d, P) }; })
      .sort(function (a, b) { return a.r - b.r; });
    order.forEach(function (o) {
      var d = o.d, r = ratio(d, P);
      if (r < WARN && F > 0) {
        var N = d.n * P * MUL, need = INIT * N - (d.D + Math.min(0, pnl(d, P)));
        var u = Math.min(F, need); d.D += u; F -= u;
        if (onTop) onTop(d, u);
      }
    });
    return F;
  }

  /* first_hit: direction = +1 giá giảm, −1 giá tăng. Trả về x (0,0227 = 2,27%) hoặc null = ngoài phạm vi 30%. */
  function firstHit(deals, F, P0, direction) {
    var ds = copy(deals), x = 0.0; F = +F;
    while (x <= MAXX) {
      var P = P0 * (1 - direction * x);
      F = topUp(ds, F, P);
      if (ds.some(function (d) { return ratio(d, P) <= M_ + 1e-12; })) return x;
      x += STEP;
    }
    return null;
  }

  /* Shield Score: 2 chiều; màu theo khoảng cách hợp lệ nhỏ hơn (null = ngoài phạm vi, bỏ qua). */
  function score(acc) {
    if (!acc.deals.length) return { down: null, up: null, min: null, dir: null };
    var down = firstHit(acc.deals, acc.F, acc.P, 1), up = firstHit(acc.deals, acc.F, acc.P, -1);
    var c = [down, up].filter(function (v) { return v != null; });
    var min = c.length ? Math.min.apply(null, c) : null;
    var dir = min == null ? null : (down != null && down === min ? 1 : -1);
    return { down: down, up: up, min: min, dir: dir };
  }
  function level(x, yellowAt, redAt) {
    if (x == null) return 'green';
    if (x <= 0) return 'violated';
    if (x * 100 >= yellowAt) return 'green';
    if (x * 100 >= redAt) return 'yellow';
    return 'red';
  }

  /* Ba trục (brief 4.3). dir = chiều nguy hiểm (+1 giảm, −1 tăng). K = F + ΣD đầu phiên. */
  function axes(acc, dir) {
    dir = dir || 1;
    var P = acc.P, Pd = P * (1 - dir * 0.01);
    var ks = acc.deals.map(function (d) { return head(d, P) - head(d, Pd); });
    var S = ks.reduce(function (s, k) { return s + Math.abs(k); }, 0);
    var SD = acc.deals.reduce(function (s, d) { return s + d.D; }, 0);
    var K = acc.K0 != null ? acc.K0 : acc.F + SD;
    var TL = acc.deals.reduce(function (s, d) { return s + d.T + d.L; }, 0);
    return acc.deals.map(function (d, i) {
      return {
        id: d.id, k: ks[i], A: S > 0 ? ks[i] / S : null, w: SD > 0 ? d.D / SD : 0,
        B: d.s * d.n * (P - d.Popen) * MUL / K, C: TL > 0 ? (d.T + d.L) / TL : null,
        h: head(d, P), R: ratio(d, P)
      };
    });
  }
  /* Ranh giới (leader chốt 19/10, R3_11 mục A7) [A]: A và C "cao" khi lớn hơn phần chia đều 1/n; B = 0 là hòa vốn.
     Sai số dấu phẩy động: A của các Deal cùng giá tham chiếu bằng đúng 1/n (lệch ~1e-15), nên so với 1/n + 1e-9.
     Khoá trả về giữ tên cũ để prototype trên canvas không phải đổi; tên hiển thị nằm ở i18n (cell.*). */
  function cell(ax, pair, n) {
    var eq = 1 / Math.max(1, n), EPS = 1e-9;
    var hiA = ax.A != null && ax.A > eq + EPS;
    if (pair === 'AB') return ax.B >= 0 ? (hiA ? 'Dao hai lưỡi' : 'Két sắt') : (hiA ? 'Quả bom' : 'Món chết');
    var hiC = ax.C != null && ax.C > eq + EPS;
    return hiC ? (hiA ? 'Thủ phạm chính' : 'Vết thương cũ') : (hiA ? 'Mối nguy kế tiếp' : 'Đứng ngoài');
  }

  function clone(acc) { return Object.assign({}, acc, { deals: copy(acc.deals), processed: (acc.processed || []).slice() }); }
  function depositFor(n, P) { return INIT * n * P * MUL; }

  /* Mở n hợp đồng ở chiều s trên mã code. Luật mỗi mã một chiều: phần ngược chiều trên cùng mã
     giảm/đóng vị thế cũ trước (đóng ở giá hiện tại; lỗ thực hiện trừ vào F), phần vượt quá mới mở mới.
     Mỗi hợp đồng mở mới là một Deal 1 HĐ (theo ví dụ brief 4.4: 2 Deal + 2 HĐ = 4 Deal) [A]. */
  function order(acc, s, n, code) {
    var a = clone(acc), left = n, closed = [];
    var opp = a.deals.filter(function (d) { return d.code === code && d.s === -s; })
      .sort(function (x, y) { return y.id - x.id; });
    opp.forEach(function (d) {
      while (left > 0 && d.n > 0) {
        var part = d.D / d.n, realized = d.s * (a.P - d.Pref) * MUL;
        a.F += part + realized; d.D -= part; d.n -= 1; left -= 1; closed.push(d.id);
      }
    });
    a.deals = a.deals.filter(function (d) { return d.n > 0; });
    for (var i = 0; i < left; i++) {
      var dep = depositFor(1, a.P);
      if (a.F < dep - 1e-9) return { ok: false, acc: a, need: dep - a.F, closed: closed };
      a.F -= dep;
      a.deals.push(deal({ id: a.nextId++, code: code, s: s, n: 1, Pref: a.P, D: dep, fresh: true }));
    }
    return { ok: true, acc: a, closed: closed };
  }
  function close(acc, id) {
    var a = clone(acc);
    a.deals = a.deals.filter(function (d) {
      if (d.id !== id) return true;
      a.F += d.D + pnl(d, a.P); return false;
    });
    return a;
  }
  function deposit(acc, amt) { var a = clone(acc); a.F += amt; return a; }
  /* Viễn cảnh giá trong phiên: giá đổi pct%, áp luật bù; Deal ≤ 17,35% sau bù thì bị xử lý.
     Tiền bù cộng vào T của Deal (trục C). Thứ tự giá trong phiên là giả định [A]. */
  function move(acc, pct) {
    var a = clone(acc), target = a.P * (1 + pct / 100), dir = pct < 0 ? 1 : -1, P0 = a.P;
    var steps = Math.round(Math.abs(pct) / 100 / STEP);
    for (var i = 1; i <= steps; i++) {
      var P = P0 * (1 - dir * i * STEP);
      a.F = topUp(a.deals, a.F, P, function (d, u) { d.T += u; });
      a.deals = a.deals.filter(function (d) {
        if (ratio(d, P) <= M_ + 1e-12) { a.processed.push(d.id); a.F += Math.max(0, d.D + pnl(d, P)); return false; }
        return true;
      });
    }
    a.P = target;
    return a;
  }

  /* 3 điều kiện ATL (brief 4.4): về lại xanh = mọi khoảng cách hợp lệ ≥ yellowAt%. */
  function okGreen(sc, yellowAt) { return sc.min == null || sc.min * 100 >= yellowAt - 1e-9; }
  function conditions(base, s, n, code, yellowAt) {
    var out = {};
    var after = order(base, s, n, code);
    if (after.ok) {
      for (var q = 0; q <= 400; q++) {
        var sc = score(deposit(after.acc, q / 10));
        if (okGreen(sc, yellowAt)) { out.deposit = { amount: q / 10, score: sc }; break; }
      }
    }
    /* (b) đóng Deal có tỷ lệ thấp nhất (đóng ở giá hiện tại) rồi mới đặt lệnh — chọn theo luật bù, không xếp hạng phương án */
    var worst = base.deals.slice().sort(function (x, y) { return ratio(x, base.P) - ratio(y, base.P); })[0];
    if (worst) {
      var rb = order(close(base, worst.id), s, n, code);
      if (rb.ok) out.closeOne = { id: worst.id, score: score(rb.acc), acc: rb.acc };
    }
    for (var k = n - 1; k >= 0; k--) {
      var r2 = k === 0 ? { ok: true, acc: clone(base) } : order(base, s, k, code);
      if (r2.ok) { var sc2 = score(r2.acc); if (okGreen(sc2, yellowAt)) { out.maxQty = { n: k, score: sc2 }; break; } }
    }
    return out;
  }

  /* Tài khoản demo — lấy nguyên từ brief 16/10. */
  function atlAccount() {
    return { P: 2000, F: 80, nextId: 3, processed: [], deals: [
      deal({ id: 1, code: 'VN30F1M', s: 1, n: 1, Pref: 2000 }),
      deal({ id: 2, code: 'VN30F1M', s: 1, n: 1, Pref: 2000 })
    ] };
  }
  function demoAccount() {
    var a = { P: 2000, F: 40, nextId: 4, processed: [], deals: [
      deal({ id: 1, code: 'VN30F1M', s: 1, n: 1, Pref: 2015, T: 3.3, L: 4.0 }),
      deal({ id: 2, code: 'VN30F1M', s: 1, n: 2, Pref: 1980, T: 0, L: 1.2 }),
      deal({ id: 3, code: 'VN30F2M', s: -1, n: 1, Pref: 2010, T: 0, L: 0.5 })
    ] };
    a.K0 = a.F + a.deals.reduce(function (s, d) { return s + d.D; }, 0);
    return a;
  }

  function nf(x, d) { return x.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pctTxt(x) { return x == null ? 'ngoài phạm vi mô phỏng' : (x <= 0 ? 'đã vi phạm' : nf(x * 100, 1) + '%'); }
  function toneOf(lv) {
    return {
      green: { key: 'green', label: 'Xanh', color: '#34C78A', ink: '#06261A' },
      yellow: { key: 'yellow', label: 'Chú ý', color: '#F5B942', ink: '#2B1D00' },
      red: { key: 'red', label: 'Nguy hiểm', color: '#FF6B6B', ink: '#2E0707' },
      violated: { key: 'red', label: 'Đã vi phạm', color: '#FF6B6B', ink: '#2E0707' }
    }[lv];
  }

  return { INIT: INIT, WARN: WARN, M_: M_, MUL: MUL, ratio: ratio, head: head, deal: deal, firstHit: firstHit,
    score: score, level: level, axes: axes, cell: cell, clone: clone, order: order, close: close,
    deposit: deposit, move: move, conditions: conditions, atlAccount: atlAccount, demoAccount: demoAccount,
    depositFor: depositFor, nf: nf, pctTxt: pctTxt, toneOf: toneOf };
})();
if (typeof module !== 'undefined') module.exports = SE;
