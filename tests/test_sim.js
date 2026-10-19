/* Bộ mô phỏng của team (l10b_sim.py, l10c_sim.py, check_ma_tran_1n.py) chạy lại bằng tools/l10_sim.js
   trên data/vn30f1m.csv, so TỪNG DÒNG với kết quả gốc team gửi (data/sim/, chạy bằng Python ngày 19/10/2026).
   Mọi con số ở phần Bằng chứng trên trang đều phải ra từ đây. */
'use strict';
const fs = require('fs'), path = require('path');
const S = require('../tools/l10_sim.js');
let pass = 0, fail = 0;
function ok(label, cond, extra) { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && extra !== undefined ? '  -> ' + extra : '')); }
function csv(name) {
  const [h, ...rows] = fs.readFileSync(path.join(__dirname, '../data/sim', name), 'utf8').trim().split('\n').map(l => l.split(','));
  return rows.map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const bars = S.loadBars();
const { out, b, c } = S.summary(bars);

/* 1. Mô phỏng 1 (L10b): 96 dòng, khớp từng dòng */
const gb = csv('l10b_ket_qua.csv');
const key = r => [r.trader, r.loai, r.auto, r.start].join('|');
const mb = new Map(b.map(r => [key(r), r]));
const badB = gb.filter(g => { const r = mb.get(key(g)); return !r || r.xu_ly !== +g.xu_ly || r.deal_phien !== +g.deal_phien || r.v1 !== +g.v1; });
ok('L10b: ' + gb.length + ' dòng khớp kết quả gốc (xử lý, Deal-phiên, V1)', gb.length === 96 && b.length === 96 && badB.length === 0, badB.slice(0, 3).map(key).join('; '));
ok('L10b: bật tự tăng, nhóm nhiều Deal bị xử lý 24 + 14 = 38, nhóm 1 Deal 0 ("38 so với 0")', out.l10b.bat_day.nhieuOn === 24 && out.l10b.theo_da.nhieuOn === 14 && out.l10b.bat_day.motOn + out.l10b.theo_da.motOn === 0);
ok('L10b: tắt tự tăng, tỷ số 1,08 và 0,96 ("0,96–1,08×")', out.l10b.bat_day.ratioOff.toFixed(2) === '1.08' && out.l10b.theo_da.ratioOff.toFixed(2) === '0.96');
ok('L10b: chỉ tính lúc đóng cửa, báo đỏ trước 6/38 = 16% số lần bị xử lý', out.l10b.v1 === 6 && out.l10b.handledOn === 38 && Math.round(100 * 6 / 38) === 16);

/* 2. Mô phỏng 2 (L10c) */
const gc = csv('l10c_ket_qua.csv');
const kc = r => [r.trader, r.mode, r.start].join('|');
const mc = new Map(c.res.map(r => [kc(r), r]));
const badC = gc.filter(g => { const r = mc.get(kc(g)); return !r || r.hd_xu_ly !== +g.hd_xu_ly || r.hd_phien !== +g.hd_phien; });
ok('L10c: ' + gc.length + ' dòng khớp kết quả gốc', gc.length === 72 && badC.length === 0, badC.slice(0, 3).map(kc).join('; '));
ok('L10c: gộp vào 1 Deal 35 hợp đồng, chia nhiều Deal 38 ("35 so với 38"), Q1 = 1,10', out.l10c.mot3 === 35 && out.l10c.nhieu === 38 && out.l10c.Q1.toFixed(2) === '1.10');
const gt = csv('l10c_truc.csv');
const num = x => (x === '' || x === 'nan' || x === undefined) ? NaN : +x;
let worst = 0, sameKeys = gt.length === c.ax.length;
gt.forEach((g, i) => {
  const r = c.ax[i];
  if (!r || +g.t !== r.t || g.start !== r.start || g.trader !== r.trader || +g.deal !== r.deal) { sameKeys = false; return; }
  ['A', 'w', 'B', 'C'].forEach(k => { const a = num(g[k]), v = r[k]; if (isNaN(a) !== isNaN(v)) worst = Infinity; else if (!isNaN(a)) worst = Math.max(worst, Math.abs(a - v)); });
});
ok('L10c: ' + gt.length + ' dòng trục A, w, B, C khớp kết quả gốc (lệch lớn nhất ' + worst.toExponential(1) + ')', sameKeys && gt.length === 1082 && worst < 1e-12);
ok('L10c: 479 phiên có từ 2 Deal trở lên', out.l10c.snapshots === 479);

/* 3. Tách ô với ranh giới 1/n (câu A8 trên trang) */
const sp = out.split;
ok('Tách ô A × B: 140/479 = 29%', sp.ab === 140 && sp.N === 479 && Math.round(100 * sp.ab / sp.N) === 29);
ok('Tách ô A × C: 451/479 = 94% (trên cả 479 phiên)', sp.ac === 451 && Math.round(100 * sp.ac / sp.N) === 94);
ok('Tách ô A × C, bỏ 25 phiên chưa Deal nào hút dự phòng: 451/454 = 99%', sp.c0 === 25 && sp.acNoC0 === 451 && Math.round(100 * 451 / 454) === 99);

/* 4. Chữ trên trang phải trích đúng các số này (cả vi và en) */
const I18N = require('../src/i18n.js');
const pct = (a, n) => Math.round(100 * a / n) + '%';
const en = I18N.en, vi = I18N.vi;
const n38 = out.l10b.handledOn, lo = Math.min(out.l10b.bat_day.ratioOff, out.l10b.theo_da.ratioOff), hi = Math.max(out.l10b.bat_day.ratioOff, out.l10b.theo_da.ratioOff);
ok('trang: Q1 "38 vs 0" / "38 so với 0"', en['ev.n1'] === n38 + ' vs 0' && vi['ev.n1'] === n38 + ' so với 0');
ok('trang: Q2 "' + lo.toFixed(2) + '–' + hi.toFixed(2) + '×"', en['ev.n2'] === lo.toFixed(2) + '–' + hi.toFixed(2) + '×' && vi['ev.n2'] === lo.toFixed(2).replace('.', ',') + '–' + hi.toFixed(2).replace('.', ',') + '×');
ok('trang: Q3 "35 vs 38"', en['ev.n3'] === out.l10c.mot3 + ' vs ' + out.l10c.nhieu && vi['ev.n3'] === out.l10c.mot3 + ' so với ' + out.l10c.nhieu);
const v1 = pct(out.l10b.v1, out.l10b.handledOn);
ok('trang: "chỉ ' + v1 + ' số lần bị xử lý" ở Bước 3 và Cảnh báo nền', [en['where.2.b'], vi['where.2.b'], en['btl.body'], vi['btl.body']].every(x => x.includes(v1)));
const sAB = pct(sp.ab, sp.N), sAC = pct(sp.ac, sp.N);
ok('trang: câu A8 ghi ' + sp.N + ' phiên, ' + sAB + ' và ' + sAC, [en['st2.sep'], vi['st2.sep']].every(x => x.includes(String(sp.N)) && x.includes(sAB) && x.includes(sAC)) && !/99%/.test(en['st2.sep'] + vi['st2.sep']));

/* 5. Đối chứng âm: đổi một luật thì số phải đổi (chứng minh phép so không pass vì trùng hợp) */
const bad = bars.map(x => Object.assign({}, x, { l: x.l * 0.99 })); /* mọi phiên có đáy thấp hơn 1% */
const bBad = S.l10b(bad), mBad = new Map(bBad.map(r => [key(r), r]));
const diffRows = gb.filter(g => mBad.get(key(g)).xu_ly !== +g.xu_ly).length;
ok('đối chứng âm: hạ đáy mọi phiên 1% thì ' + diffRows + ' dòng L10b không còn khớp', diffRows > 0);
const csvOut = fs.readFileSync(path.join(__dirname, '../data/sim/l10b_ket_qua.csv'), 'utf8');
ok('đối chứng âm: bộ so dòng bắt được một dòng sai', (() => { const g = csv('l10b_ket_qua.csv'); g[0].xu_ly = String(+g[0].xu_ly + 1); return g.some(x => { const r = mb.get(key(x)); return r.xu_ly !== +x.xu_ly; }); })() && csvOut.length > 0);

console.log(`\n${pass} pass, ${fail} fail`);
const MIN = 18;
if (pass + fail < MIN) { console.log('FAIL: chỉ chạy ' + (pass + fail) + ' kiểm, cần ít nhất ' + MIN); process.exit(1); }
process.exit(fail ? 1 : 0);
