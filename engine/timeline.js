/* Mô phỏng tài khoản Future X qua các phiên VN30F1M thật (giá ngày: mở, cao, thấp, đóng).
   Luật lấy theo L10b (KQ_L4 phần 15) và bộ tính SE (engine.js):
   - Mỗi Deal có cọc riêng D, ban đầu 18,48% giá trị hợp đồng (1 điểm = 0,1 triệu).
   - Trong phiên giá đi O→L→H→C (nến tăng) hoặc O→H→L→C (nến giảm) [A], từng nấc 0,01%.
     Ở mỗi nấc: nếu BẬT tự tăng, Deal có tỷ lệ < 17,71% được bù từ cọc ngoài Deal F về 18,48%,
     Deal tỷ lệ thấp nhất trước; sau đó Deal có tỷ lệ ≤ 17,35% bị xử lý ở giá đó, phần còn lại trả về F.
   - Giá mở cửa được xét một lần (khoảng trống qua đêm không có giao dịch).
   - Cuối phiên: lãi/lỗ thanh toán hết vào F, giá tham chiếu = giá đóng cửa.
   - Lệnh của khách khớp ở giá mở cửa. Mỗi mã một chiều: lệnh ngược chiều giảm vị thế cũ trước.
   - VN30F2M dùng cùng giá với VN30F1M [A].
   Không đổi engine.js: phần bù được viết lại ở đây và tests/test_timeline.js kiểm nó trùng SE.move. */
var TL = (function () {
  var INIT = SE.INIT, WARN = SE.WARN, M_ = SE.M_, MUL = SE.MUL, STEP = 0.0001;

  function pnl(d, P) { return d.s * d.n * (P - d.Pref) * MUL; }
  function ratio(d, P) { return SE.ratio(d, P); }

  /* Giống topUp trong engine.js: thứ tự tính một lần trước vòng bù. */
  function topUp(acc, P, ev, t) {
    var order = acc.deals.map(function (d) { return { d: d, r: ratio(d, P) }; })
      .sort(function (a, b) { return a.r - b.r; });
    order.forEach(function (o) {
      var d = o.d;
      if (ratio(d, P) < WARN && acc.F > 0) {
        var N = d.n * P * MUL, need = INIT * N - (d.D + Math.min(0, pnl(d, P))); /* cùng thứ tự phép tính với engine.js */
        var u = Math.min(acc.F, need);
        d.D += u; acc.F -= u; d.T += u;
        if (ev) ev.topup[d.id] = (ev.topup[d.id] || 0) + u;
      }
    });
  }
  function liquidate(acc, P, ev, t) {
    acc.deals = acc.deals.filter(function (d) {
      if (ratio(d, P) <= M_ + 1e-12) {
        var back = Math.max(0, d.D + pnl(d, P));
        acc.F += back;
        if (ev) ev.list.push({ t: t, type: 'liquidated', id: d.id, price: P, back: back, loss: d.D - back });
        acc.liquidated.push({ t: t, id: d.id, price: P });
        return false;
      }
      return true;
    });
  }
  function check(acc, P, ev, t) {
    if (acc.auto) topUp(acc, P, ev, t);
    liquidate(acc, P, ev, t);
  }
  /* Đi từng nấc 0,01% tính theo giá đầu đoạn, giống SE.move. */
  function walk(acc, target, ev, t) {
    var P0 = acc.P, pct = (target - P0) / P0, dir = pct < 0 ? 1 : -1;
    var steps = Math.round(Math.abs(pct) / STEP);
    for (var i = 1; i <= steps && acc.deals.length; i++) check(acc, P0 * (1 - dir * i * STEP), ev, t);
    acc.P = target;
  }
  function settle(acc) {
    acc.deals.forEach(function (d) {
      var p = pnl(d, acc.P);
      acc.F += p;
      if (p < 0) d.L += -p;
      d.Pref = acc.P;
    });
  }

  /* Lệnh khớp ở giá hiện tại (giá mở cửa). Trả về sự kiện để hiện cho người xem. */
  function act(acc, a, ev, t) {
    var P = acc.P;
    if (a.type === 'deposit') { acc.F += a.amt; ev.list.push({ t: t, type: 'deposit', amt: a.amt }); return; }
    if (a.type === 'auto') { acc.auto = !!a.on; ev.list.push({ t: t, type: 'auto', on: acc.auto }); return; }
    if (a.type === 'close') {
      var keep = [];
      acc.deals.forEach(function (d) {
        if (d.id === a.id) { var back = d.D + pnl(d, P); acc.F += back; ev.list.push({ t: t, type: 'close', id: d.id, price: P, back: back }); }
        else keep.push(d);
      });
      if (keep.length === acc.deals.length) ev.list.push({ t: t, type: 'skip', why: 'gone', id: a.id });
      acc.deals = keep;
      return;
    }
    if (a.type === 'open') {
      var left = a.n || 1;
      var opp = acc.deals.filter(function (d) { return d.code === a.code && d.s === -a.s; }).sort(function (x, y) { return x.id - y.id; });
      opp.forEach(function (d) {
        while (left > 0 && d.n > 0) {
          var part = d.D / d.n, realized = d.s * (P - d.Pref) * MUL;
          acc.F += part + realized; d.D -= part; d.n -= 1; left -= 1;
          ev.list.push({ t: t, type: 'reduce', id: d.id, price: P });
        }
      });
      acc.deals = acc.deals.filter(function (d) { return d.n > 0; });
      for (var i = 0; i < left; i++) {
        var dep = SE.depositFor(1, P);
        if (acc.F < dep - 1e-9) { ev.list.push({ t: t, type: 'reject', code: a.code, s: a.s, need: dep - acc.F }); break; }
        acc.F -= dep;
        var d = SE.deal({ id: acc.nextId++, code: a.code, s: a.s, n: 1, Pref: P, D: dep, label: a.label || null });
        d.Popen = P; d.tOpen = t;
        acc.deals.push(d);
        ev.list.push({ t: t, type: 'open', id: d.id, code: a.code, s: a.s, price: P });
      }
    }
  }

  function snap(acc, t) {
    return { t: t, P: acc.P, F: acc.F, auto: acc.auto, K0: acc.K0,
      deals: acc.deals.map(function (d) { return Object.assign({}, d); }) };
  }

  /* bars: [{ngay, mo, cao, thap, dong}], plan: {F0, auto, start, end, actions:[{t,…}]}
     Trả về {snaps:[trạng thái cuối mỗi phiên, sau thanh toán], events:[…], liquidated:[…]} */
  function run(bars, plan) {
    var acc = { P: bars[plan.start].mo, F: plan.F0, auto: plan.auto !== false, deals: [], nextId: 1, liquidated: [], K0: plan.F0 };
    var byT = {};
    (plan.actions || []).forEach(function (a) { (byT[a.t] = byT[a.t] || []).push(a); });
    var snaps = [], events = [];
    for (var t = plan.start; t <= plan.end; t++) {
      var b = bars[t], ev = { list: [], topup: {} };
      acc.P = b.mo;
      if (acc.deals.length) check(acc, b.mo, ev, t);
      acc.K0 = acc.F + acc.deals.reduce(function (s, d) { return s + d.D; }, 0);
      var opening = (byT[t] || []).concat(plan.onOpen ? plan.onOpen(acc, t) || [] : []);
      opening.forEach(function (a) { act(acc, a, ev, t); });
      var path = b.dong >= b.mo ? [b.thap, b.cao, b.dong] : [b.cao, b.thap, b.dong];
      path.forEach(function (p) { walk(acc, p, ev, t); });
      /* lệnh đóng ở giá đóng cửa (dùng cho trader mô phỏng, ví dụ giữ tối đa 5 phiên) */
      if (plan.onClose) (plan.onClose(acc, t) || []).forEach(function (a) { act(acc, a, ev, t); });
      settle(acc);
      Object.keys(ev.topup).forEach(function (id) { ev.list.push({ t: t, type: 'topup', id: +id, amt: ev.topup[id] }); });
      events = events.concat(ev.list);
      snaps.push(snap(acc, t));
    }
    return { snaps: snaps, events: events, liquidated: acc.liquidated };
  }

  /* Hai khách mẫu cho tab "Danh mục thật" [M]: lệnh mở ở giá mở cửa của ngày ghi bên cạnh.
     from/to: khoảng phiên hiện trên trang; view: phiên mở sẵn khi vào tab. */
  var PRESETS = {
    A: { F0: 200, from: '2026-01-26', to: '2026-05-29', view: '2026-03-02',
      orders: [['2026-02-02', 1, 'VN30F1M'], ['2026-02-05', 1, 'VN30F1M'], ['2026-02-10', 1, 'VN30F1M'], ['2026-02-12', -1, 'VN30F2M'], ['2026-02-24', 1, 'VN30F1M'], ['2026-02-27', 1, 'VN30F1M']] },
    B: { F0: 180, from: '2025-02-24', to: '2025-06-30', view: '2025-04-02',
      orders: [['2025-03-03', 1, 'VN30F1M'], ['2025-03-07', 1, 'VN30F1M'], ['2025-03-13', 1, 'VN30F1M'], ['2025-03-18', -1, 'VN30F2M'], ['2025-03-24', 1, 'VN30F1M'], ['2025-03-28', 1, 'VN30F1M']] }
  };

  return { run: run, walk: walk, settle: settle, act: act, check: check, STEP: STEP, PRESETS: PRESETS };
})();
if (typeof module !== 'undefined') module.exports = TL;
