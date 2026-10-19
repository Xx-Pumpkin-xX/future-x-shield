// Test vàng: so bản port JS với đầu ra demo_calc.py / shield_engine.py (chạy 16/10 trên máy Phong).
const SE = require('../engine/engine.js');
let fail = 0, pass = 0;
function eq(label, got, want, tol = 1e-9) {
  const ok = (got === null && want === null) || (got !== null && want !== null && Math.abs(got - want) <= tol);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + ' got=' + got + ' want=' + want);
}
const d1 = () => SE.deal({ id: 0, code: 'VN30F1M', s: 1, n: 1, Pref: 2000 });
const base = n => Array.from({ length: n }, d1);
// shield_engine.py __main__
eq('4 long F=11 giam', SE.firstHit(base(4), 11, 2000, 1), 0.024899999999999905);
eq('4 long F=11 tang', SE.firstHit(base(4), 11, 2000, -1), 0.11150000000000217);
eq('2 long F=80 giam', SE.firstHit(base(2), 80, 2000, 1), 0.25409999999998834);
eq('2 long F=80 tang', SE.firstHit(base(2), 80, 2000, -1), null);
eq('4 long F=6.08 giam', SE.firstHit(base(4), 80 - 2 * 36.96, 2000, 1), 0.022699999999999918);
eq('4 long F=6.08 tang', SE.firstHit(base(4), 80 - 2 * 36.96, 2000, -1), 0.10140000000000188);
eq('3 long F=43.04 giam', SE.firstHit(base(3), 80 - 36.96, 2000, 1), 0.09640000000000173);
eq('3 long F=43.04 tang', SE.firstHit(base(3), 80 - 36.96, 2000, -1), null);
eq('1 long F=0 tang', SE.firstHit(base(1), 0, 2000, -1), 0.06520000000000084);
eq('1 long F=0 giam', SE.firstHit(base(1), 0, 2000, 1), 0.013699999999999973);
// demo_calc.py: ATL qua API của prototype
const atl = SE.atlAccount();
const s0 = SE.score(atl); eq('ATL truoc giam', s0.down, 0.25409999999998834); eq('ATL truoc tang', s0.up, null);
const after = SE.order(atl, 1, 2, 'VN30F1M');
eq('ATL sau lenh ok', after.ok ? 1 : 0, 1); eq('ATL sau so Deal', after.acc.deals.length, 4);
const s1 = SE.score(after.acc); eq('ATL sau giam', s1.down, 0.022699999999999918); eq('ATL sau tang', s1.up, 0.10140000000000188);
const c = SE.conditions(atl, 1, 2, 'VN30F1M', 5);
eq('(a) nap', c.deposit.amount, 18.1); eq('(a) giam', c.deposit.score.down, 0.05020000000000041); eq('(a) tang', c.deposit.score.up, 0.21039999999999315);
eq('(b) giam', c.closeOne.score.down, 0.09640000000000173);
eq('(c) so HD', c.maxQty.n, 1); eq('(c) giam', c.maxQty.score.down, 0.09640000000000173);
// demo_calc.py: danh mục ma trận
const demo = SE.demoAccount();
const sd = SE.score(demo);
eq('demo giam %', Math.round(sd.down * 10000) / 100, 9.60); eq('demo tang %', Math.round(sd.up * 10000) / 100, 13.47);
const ax = SE.axes(demo, 1);
const r2 = (x) => Math.round(x * 1000) / 1000;
[[1.653, 0.614], [-0.694, -0.258], [-0.347, -0.129]].forEach(([k, A], i) => {
  eq('demo #' + (i + 1) + ' k', r2(ax[i].k), k); eq('demo #' + (i + 1) + ' A', Math.round(ax[i].A * 1000) / 1000, A);
});
const axU = SE.axes(demo, -1);
[0.,0,0].forEach((_, i) => {});
[-0.361, 0.217, 0.422].forEach((A, i) => eq('demo #' + (i + 1) + ' A tang', Math.round(axU[i].A * 1000) / 1000, A));
[0.252, 0.496, 0.252].forEach((w, i) => eq('demo #' + (i + 1) + ' w', Math.round(ax[i].w * 1000) / 1000, w));
[-0.0080, 0.0213, 0.0053].forEach((B, i) => eq('demo #' + (i + 1) + ' B', Math.round(ax[i].B * 10000) / 10000, B));
[0.81, 0.13, 0.06].forEach((C, i) => eq('demo #' + (i + 1) + ' C', Math.round(ax[i].C * 100) / 100, C));
[1.04, 3.78, 2.44].forEach((h, i) => eq('demo #' + (i + 1) + ' h', Math.round(ax[i].h * 100) / 100, h));
eq('demo #1 o A×C', SE.cell(ax[0], 'AC', 3) === 'Thủ phạm chính' ? 1 : 0, 1);
// Ranh giới 1/n (R3_11 A7): số và ô khớp ví dụ của leader
const cellsOf = (acc, pair) => { const a = SE.axes(acc, 1); return a.map(r => SE.cell(r, pair, a.length)).join('|'); };
eq('demo: ô A×B (#1 Exposed loss, #2 #3 Contained gain)', cellsOf(demo, 'AB') === 'Quả bom|Két sắt|Két sắt' ? 1 : 0, 1);
eq('demo + 1 long: ô A×C (#1 Primary, #2 #3 Low, #4 Emerging)', cellsOf(SE.order(demo, 1, 1, 'VN30F1M').acc, 'AC') === 'Thủ phạm chính|Đứng ngoài|Đứng ngoài|Mối nguy kế tiếp' ? 1 : 0, 1);
eq('ranh giới 1/n: A 20% với 3 Deal là thấp (luật cũ A > 0 sẽ ra cao)', SE.cell({ A: 0.2, B: -0.01, C: 0.2 }, 'AB', 3) === 'Món chết' ? 1 : 0, 1);
eq('ranh giới 1/n: A đúng bằng 1/n (lệch dấu phẩy động) vẫn là thấp', SE.cell({ A: 1 / 3 + 1e-15, B: 0.01, C: null }, 'AB', 3) === 'Két sắt' ? 1 : 0, 1);
// Negative control: một lỗi cố ý phải làm test trượt (chứng minh test không pass vì không chạy)
const broken = SE.firstHit(base(2), 79, 2000, 1);
const nc = Math.abs(broken - 0.25409999999998834) > 1e-9;
nc ? pass++ : fail++; console.log((nc ? 'PASS ' : 'FAIL ') + 'negative control: F=79 phải khác F=80 got=' + broken);
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
