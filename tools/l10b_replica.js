/* Thử tái tạo l10b_ket_qua.csv bằng engine/timeline.js trên giá VN30F1M thật, chưa có l10b_sim.py.
   Luật trader theo KQ_L4 phần 14–15. Những chỗ file đó chưa nói rõ được thử theo nhiều biến thể;
   biến thể nào khớp CSV nhiều dòng nhất thì gần với script gốc nhất.
   Chạy: node tools/l10b_replica.js <đường dẫn l10b_ket_qua.csv> */
'use strict';
const fs = require('fs'), path = require('path');
global.SE = require('../engine/engine.js');
const TL = require('../engine/timeline.js');
const bars = fs.readFileSync(path.join(__dirname, '../data/vn30f1m.csv'), 'utf8').trim().split('\n').slice(1)
  .map(l => { const [ngay, mo, cao, thap, dong] = l.split(','); return { ngay, mo: +mo, cao: +cao, thap: +thap, dong: +dong }; });
const csv = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1).map(l => l.split(','));

function idxOfMonth(ym) { return bars.findIndex(b => b.ngay.startsWith(ym)); }
function addMonths(ym, k) { let [y, m] = ym.split('-').map(Number); m += k; while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); }

function runCase(trader, loai, auto, start, V) {
  const s0 = idxOfMonth(start), endYm = addMonths(start, 6);
  let e = bars.findIndex(b => b.ngay >= endYm); e = (e < 0 ? bars.length : e) - 1;
  const hold = V.hold;
  let dealSessions = 0;
  const res = TL.run(bars, {
    F0: 120, auto: !!auto, start: s0, end: e,
    onOpen(acc, t) {
      if (t === 0) return [];
      const p = bars[t - 1];
      const prevUp = V.sig === 'co' ? p.dong > p.mo : p.dong > (bars[t - 2] ? bars[t - 2].dong : p.mo);
      const prevDn = V.sig === 'co' ? p.dong < p.mo : p.dong < (bars[t - 2] ? bars[t - 2].dong : p.mo);
      if (!prevUp && !prevDn) return [];
      let s = prevUp ? 1 : -1; if (trader === 'bat_day') s = -s;
      const opp = acc.deals.filter(d => d.s === -s);
      if (opp.length) { const old = opp.sort((a, b) => a.tOpen - b.tOpen || a.id - b.id)[0]; return [{ type: 'close', id: old.id }]; }
      const n = acc.deals.length;
      if (loai === 'nhieu' ? n < 3 : n === 0) {
        if (V.needPositiveF && acc.F <= 0) return [];
        return [{ type: 'open', code: 'VN30F1M', s, n: 1 }];
      }
      return [];
    },
    onClose(acc, t) {
      const out = acc.deals.filter(d => t - d.tOpen + 1 >= hold).map(d => ({ type: 'close', id: d.id }));
      dealSessions += V.dpAfterClose ? acc.deals.length - out.length : acc.deals.length;
      return out;
    }
  });
  return { xu_ly: res.liquidated.length, deal_phien: dealSessions };
}

const variants = [];
for (const sig of ['co', 'cc']) for (const hold of [5, 6]) for (const dpAfterClose of [false, true]) for (const needPositiveF of [false, true])
  variants.push({ sig, hold, dpAfterClose, needPositiveF });
const scores = variants.map(V => {
  let xu = 0, dp = 0, both = 0;
  csv.forEach(([trader, loai, auto, start, xu_ly, deal_phien]) => {
    const r = runCase(trader, loai, +auto, start, V);
    if (r.xu_ly === +xu_ly) xu++; if (r.deal_phien === +deal_phien) dp++; if (r.xu_ly === +xu_ly && r.deal_phien === +deal_phien) both++;
  });
  return { V, xu, dp, both };
}).sort((a, b) => b.both - a.both || b.xu - a.xu);
scores.slice(0, 6).forEach(s => console.log(JSON.stringify(s.V), 'xu_ly khớp', s.xu + '/' + csv.length, 'deal_phien khớp', s.dp, 'cả hai', s.both));
