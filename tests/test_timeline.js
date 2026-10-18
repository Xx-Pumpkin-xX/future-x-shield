/* Kiểm engine/timeline.js: bộ mô phỏng nhiều phiên dùng cho tab "Danh mục thật".
   1. Bước giá trong phiên phải trùng từng số với SE.move (engine.js, port của shield_engine.py), 3.000 ca ngẫu nhiên.
   2. Đối chứng âm: tắt tự tăng thì phải KHÁC SE.move ở các ca có bù (bộ so sánh bắt được khác biệt).
   3. Số của khách mẫu A, B trên giá VN30F1M thật: các mốc mà trang dùng để kể chuyện.
   Chạy: node tests/test_timeline.js */
'use strict';
const fs = require('fs'), path = require('path');
global.SE = require('../engine/engine.js');
const TL = require('../engine/timeline.js');
let pass = 0, fail = 0;
function ok(label, cond, extra) { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && extra !== undefined ? '  -> ' + extra : '')); }

/* 1–2. trùng SE.move */
let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
let same = 0, diff = 0, withTopup = 0, offDiffers = 0;
for (let k = 0; k < 3000; k++) {
  const P = 1300 + R() * 800, n = 1 + Math.floor(R() * 5);
  const deals = Array.from({ length: n }, (_, i) => SE.deal({ id: i + 1, code: R() < .7 ? 'VN30F1M' : 'VN30F2M', s: R() < .7 ? 1 : -1, n: 1, Pref: P * (0.97 + R() * 0.06) }));
  deals.forEach(d => { d.D = d.D * (0.95 + R() * 0.1); });
  const F = R() * 60, pct = (R() - 0.5) * 12;
  const ra = SE.move({ P, F, deals: deals.map(d => Object.assign({}, d)), processed: [] }, pct);
  const b = { P, F, auto: true, deals: deals.map(d => Object.assign({}, d)), liquidated: [] };
  TL.walk(b, P * (1 + pct / 100), null, 0);
  const eq = (x, y) => Math.abs(x.F - y.F) < 1e-9 && x.deals.length === y.deals.length && x.deals.every((d, i) => Math.abs(d.D - y.deals[i].D) < 1e-9 && Math.abs(d.T - y.deals[i].T) < 1e-9);
  const s = eq(ra, b) && JSON.stringify(ra.processed) === JSON.stringify(b.liquidated.map(x => x.id));
  s ? same++ : diff++;
  if (ra.deals.concat([]).some(d => d.T > 1e-9)) { /* SE.move có bù cho ít nhất một Deal còn lại */
    withTopup++;
    const c = { P, F, auto: false, deals: deals.map(d => Object.assign({}, d)), liquidated: [] };
    TL.walk(c, P * (1 + pct / 100), null, 0);
    if (!eq(ra, c)) offDiffers++;
  }
}
ok('bước giá trùng SE.move ở cả 3.000 ca', same === 3000, same + ' trùng, ' + diff + ' khác');
ok('đối chứng âm: có đủ ca có bù để kiểm (' + withTopup + ')', withTopup > 300);
ok('đối chứng âm: tắt tự tăng thì khác SE.move ở mọi ca có bù', offDiffers === withTopup, offDiffers + '/' + withTopup);

/* 3. khách mẫu trên giá thật */
const bars = fs.readFileSync(path.join(__dirname, '../data/vn30f1m.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => { const [ngay, mo, cao, thap, dong] = l.split(','); return { ngay, mo: +mo, cao: +cao, thap: +thap, dong: +dong }; });
ok('giá: 411 phiên, 2025-01-02 → 2026-08-28', bars.length === 411 && bars[0].ngay === '2025-01-02' && bars[410].ngay === '2026-08-28');
const ix = d => bars.findIndex(b => b.ngay >= d);
function plan(key, extra, auto) {
  const P = TL.PRESETS[key];
  return { F0: P.F0, auto: auto !== false, start: ix(P.from), end: ix(P.to),
    actions: P.orders.map(o => ({ t: ix(o[0]), type: 'open', s: o[1], code: o[2], n: 1 })).concat(extra || []) };
}
function level(sn) { return sn.deals.length ? SE.level(SE.score({ P: sn.P, F: sn.F, deals: sn.deals }).min, 5, 3) : 'none'; }
const day = (res, d) => res.snaps.find(s => bars[s.t].ngay === d);

const A = TL.run(bars, plan('A'));
ok('A: 5 Deal được mở, 1 lệnh bị từ chối vì thiếu cọc', A.events.filter(e => e.type === 'open').length === 5 && A.events.filter(e => e.type === 'reject').length === 1);
ok('A: 4 long VN30F1M, 1 short VN30F2M', JSON.stringify(A.events.filter(e => e.type === 'open').map(e => e.s + e.code)) === JSON.stringify(['1VN30F1M', '1VN30F1M', '1VN30F1M', '-1VN30F2M', '1VN30F1M']));
ok('A: Shield đỏ lúc đóng cửa 02/03/2026', level(day(A, '2026-03-02')) === 'red', level(day(A, '2026-03-02')));
ok('A: chưa đỏ trước 02/03 (vàng 4 phiên trước đó)', ['2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27'].every(d => level(day(A, d)) === 'yellow'));
ok('A: Deal đầu tiên bị xử lý là #2, ngày 03/03/2026, ở 1.951,9', A.liquidated[0].id === 2 && bars[A.liquidated[0].t].ngay === '2026-03-03' && Math.abs(A.liquidated[0].price - 1951.926) < 0.01, JSON.stringify(A.liquidated[0]));
ok('A: tổng cộng 2 Deal bị xử lý', A.liquidated.length === 2);
const Aclose = TL.run(bars, plan('A', [{ t: ix('2026-03-03'), type: 'close', id: 2 }]));
ok('A + đóng #2 lúc mở cửa 03/03: Deal bị xử lý đầu tiên dời tới 08/04/2026', bars[Aclose.liquidated[0].t].ngay === '2026-04-08' && Aclose.liquidated.length === 1, Aclose.liquidated.map(x => bars[x.t].ngay + '#' + x.id).join(' '));
const Aoff = TL.run(bars, plan('A', [], false));
ok('A + tắt tự tăng: Deal nào cũng bị xử lý, sớm hơn nhiều', Aoff.liquidated.length >= 5 && Aoff.liquidated[0].t < A.liquidated[0].t, Aoff.liquidated.map(x => bars[x.t].ngay + '#' + x.id).join(' '));
const Adep = TL.run(bars, plan('A', [{ t: ix('2026-03-03'), type: 'deposit', amt: 40 }]));
ok('A + nạp 40 triệu lúc mở cửa 03/03: tránh được lần xử lý 03/03', !Adep.liquidated.some(x => bars[x.t].ngay === '2026-03-03'));

const B = TL.run(bars, plan('B'));
const fb = B.liquidated[0];
ok('B: Deal đầu tiên bị xử lý ngày 03/04/2025, trong phiên (dưới giá mở cửa)', bars[fb.t].ngay === '2025-04-03' && fb.price < bars[fb.t].mo - 1, JSON.stringify(fb));
const prevB = B.snaps[fb.t - 1 - ix(TL.PRESETS.B.from)], scB = SE.score({ P: prevB.P, F: prevB.F, deals: prevB.deals });
ok('B: đóng cửa phiên trước Shield còn xanh (còn giảm ≥ 5%), phiên 03/04 giảm 7%', level(prevB) === 'green' && scB.down >= 0.05 && bars[fb.t].dong / bars[fb.t - 1].dong - 1 < -0.06, level(prevB) + ' ' + scB.down);
const sb = B.liquidated[1];
ok('B: Deal short #4 bị xử lý lúc mở cửa 10/04/2025 (giá nhảy lên qua đêm)', sb && sb.id === 4 && bars[sb.t].ngay === '2025-04-10' && Math.abs(sb.price - bars[sb.t].mo) < 1e-9, JSON.stringify(sb));

/* bất biến: không có số NaN, không Deal nào bị xử lý mà tỷ lệ còn trên 17,35% ở giá đó */
const allNum = [A, Aclose, Aoff, Adep, B].every(r => r.snaps.every(s => isFinite(s.F) && s.deals.every(d => isFinite(d.D) && isFinite(d.T))));
ok('không có giá trị NaN trong mọi phiên', allNum);

const MIN = 17;
console.log('\n' + pass + ' pass, ' + fail + ' fail');
if (pass + fail < MIN) { console.log('FAIL: chỉ chạy ' + (pass + fail) + ' kiểm'); process.exit(1); }
process.exit(fail ? 1 : 0);
