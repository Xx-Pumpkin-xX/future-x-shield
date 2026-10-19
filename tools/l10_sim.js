/* Bản JS dòng-theo-dòng của bộ mô phỏng của team (gói GUI_TEAM_PRODUCT_mo_phong, 19/10/2026):
     l10b_sim.py  → l10b()   Mô phỏng 1: "38 so với 0", tỷ số 0,96–1,08 khi tắt tự tăng, V1 = 6/38 (16%)
     l10c_sim.py  → l10c()   Mô phỏng 2: "35 so với 38", 479 phiên có ≥ 2 Deal, ba trục A, B, C
     check_ma_tran_1n.py → split1n()   tách ô với ranh giới 1/n: 29,2% (A × B) và 94,2% (A × C)
     shield_engine.py first_hit → firstHit()
   Giá: data/vn30f1m.csv (cùng 411 phiên, cùng giá với VN30F.xlsx mà script Python đọc; đã so từng số).
   Giữ đúng thứ tự phép tính của Python để số thực ra giống hệt. tests/test_sim.js so với kết quả gốc trong data/sim/.
   Chạy: node tools/l10_sim.js */
'use strict';
const fs = require('fs'), path = require('path');

const INIT = 0.1848, WARN = 0.1771, HAND = 0.1735, M = 0.1, HOLD = 5, POOL0 = 120.0;

function loadBars(file) {
  return fs.readFileSync(file || path.join(__dirname, '../data/vn30f1m.csv'), 'utf8').trim().split('\n').slice(1)
    .map(l => { const [d, o, h, lo, c] = l.split(','); return { d, o: +o, h: +h, l: +lo, c: +c }; });
}

/* shield_engine.py: dò giá từng nấc, áp luật bù, trả % giá đi ngược tới Deal đầu tiên bị xử lý */
function ratioPy(d, P) { const pnl = d.s * d.n * (P - d.Pref) * M; return (d.D + Math.min(0.0, pnl)) / (d.n * P * M); }
function firstHit(deals, F, P0, direction, step, maxx) {
  step = step == null ? 0.0001 : step; maxx = maxx == null ? 0.30 : maxx;
  const ds = deals.map(d => Object.assign({}, d)); F = +F; let x = 0.0;
  while (x <= maxx) {
    const P = P0 * (1 - direction * x);
    const order = ds.map((d, i) => [ratioPy(d, P), i]).sort((a, b) => a[0] - b[0]).map(p => ds[p[1]]);
    for (const d of order) {
      const r = ratioPy(d, P);
      if (r < WARN && F > 0) {
        const N = d.n * P * M, need = INIT * N - (d.D + Math.min(0.0, d.s * d.n * (P - d.Pref) * M));
        const u = Math.min(F, need); d.D += u; F -= u;
      }
    }
    if (ds.some(d => ratioPy(d, P) <= HAND + 1e-12)) return x;
    x += step;
  }
  return null;
}

/* 12 mốc: tháng 2025-04 … 2026-03, mỗi mốc bắt đầu ở phiên đầu tháng, chạy 126 phiên */
function starts(bars) {
  const ms = [...new Set(bars.map(b => b.d.slice(0, 7)))].sort().filter(m => m >= '2025-04' && m <= '2026-03');
  return ms.map(m => ({ m, p0: bars.findIndex(b => b.d.startsWith(m)) }));
}
function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
function signal(bars, t, ttype) {
  const r = bars[t - 1].c / bars[t - 2].c - 1;
  return r === 0 ? 0 : (ttype === 'theo_da' ? sign(r) : -sign(r));
}
function pathOf(b) { return (b.c >= b.o ? [b.o, b.l, b.h, b.c] : [b.o, b.h, b.l, b.c]).slice(1); } /* không kiểm ở chính giá mở cửa */
/* Python dict giữ thứ tự chèn: dùng Map */
function E(d, P) { return d.D + Math.min(0.0, d.s * d.n * (P - d.S) * M); }
function R(d, P) { return E(d, P) / (d.n * P * M); }
function sortedByRatio(deals, P) { return [...deals.keys()].map((j, i) => [R(deals.get(j), P), i, j]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); }

/* ---------- l10b_sim.py ---------- */
function l10bOne(bars, ttype, start, K, auto) {
  const p0 = start.p0, end = Math.min(p0 + 126, bars.length);
  let F = POOL0, nid = 0, dd = 0; const deals = new Map(), handled = [], reds = new Set();
  function check(P, t) {
    for (const j of sortedByRatio(deals, P)) {
      const d = deals.get(j);
      if (auto && R(d, P) < WARN && F > 0) { const u = Math.min(F, INIT * d.n * P * M - E(d, P)); d.D += u; F -= u; }
    }
    for (const j of [...deals.keys()]) {
      const d = deals.get(j);
      if (R(d, P) <= HAND) { handled.push([t, j]); F += d.D + d.s * d.n * (P - d.S) * M; deals.delete(j); }
    }
  }
  for (let t = p0; t < end; t++) {
    const b = bars[t], sgn = signal(bars, t, ttype);
    if (sgn !== 0) {
      const opp = [...deals.keys()].filter(j => deals.get(j).s === -sgn);
      if (opp.length) { const j = Math.min(...opp), d = deals.get(j); deals.delete(j); F += d.D + d.s * d.n * (b.o - d.S) * M; }
      else {
        const can = K > 1 ? deals.size < K : deals.size === 0, Dn = INIT * b.o * M;
        if (can && F >= Dn) { nid++; deals.set(nid, { s: sgn, n: 1, S: b.o, D: Dn, age: 0 }); F -= Dn; }
      }
    }
    for (const P of pathOf(b)) check(P, t);
    dd += deals.size;
    for (const j of [...deals.keys()]) {
      const d = deals.get(j); F += d.s * d.n * (b.c - d.S) * M; d.S = b.c; d.age += 1;
      if (d.age >= HOLD) { F += d.D; deals.delete(j); }
    }
    if (deals.size) {
      const ds = [...deals.values()].map(d => ({ s: d.s, n: d.n, Pref: d.S, D: d.D }));
      const xs = [firstHit(ds, Math.max(F, 0), b.c, 1, 0.0005, 0.1), firstHit(ds, Math.max(F, 0), b.c, -1, 0.0005, 0.1)].filter(x => x != null);
      if (xs.length && Math.min(...xs) < 0.03) reds.add(t);
    }
  }
  const v1 = handled.filter(([t]) => reds.has(t - 1)).length;
  return { xu_ly: handled.length, deal_phien: dd, v1 };
}
function l10b(bars) {
  const rows = [];
  for (const tt of ['bat_day', 'theo_da']) for (const [lab, K] of [['nhieu', 3], ['mot', 1]]) for (const auto of [1, 0]) for (const st of starts(bars)) {
    const r = l10bOne(bars, tt, st, K, auto); rows.push({ trader: tt, loai: lab, auto, start: st.m, xu_ly: r.xu_ly, deal_phien: r.deal_phien, v1: r.v1 });
  }
  return rows;
}

/* ---------- l10c_sim.py ---------- */
function l10cOne(bars, ttype, start, mode, auto, axes) {
  const p0 = start.p0, end = Math.min(p0 + 126, bars.length);
  let F = POOL0, nid = 0, cd = 0; const deals = new Map(), hand = [], rows = [];
  const h = (d, P) => E(d, P) - HAND * d.n * P * M;
  function check(P) {
    for (const j of sortedByRatio(deals, P)) {
      const d = deals.get(j);
      if (auto && R(d, P) < WARN && F > 0) { const u = Math.min(F, INIT * d.n * P * M - E(d, P)); d.D += u; F -= u; d.T += u; }
    }
    for (const j of [...deals.keys()]) {
      const d = deals.get(j);
      if (R(d, P) <= HAND) { hand.push(d.n); F += d.D + d.s * d.n * (P - d.S) * M; deals.delete(j); }
    }
  }
  for (let t = p0; t < end; t++) {
    const b = bars[t], sgn = signal(bars, t, ttype);
    const ncon = [...deals.values()].reduce((a, d) => a + d.n, 0);
    if (sgn !== 0) {
      const opp = [...deals.keys()].filter(j => deals.get(j).s === -sgn);
      if (opp.length) {
        const j = Math.min(...opp), d = deals.get(j);
        if (mode === 'mot3' && d.n > 1) { const rel = d.D / d.n; F += rel + d.s * (b.o - d.S) * M; d.D -= rel; d.n -= 1; d.lots.shift(); }
        else { deals.delete(j); F += d.D + d.s * d.n * (b.o - d.S) * M; }
      } else {
        const Dn = INIT * b.o * M, cap = mode === 'mot' ? 1 : 3;
        if (ncon < cap && F >= Dn) {
          const same = [...deals.keys()].filter(j => deals.get(j).s === sgn);
          if (mode === 'mot3' && same.length) {
            const d = deals.get(same[0]); d.S = (d.S * d.n + b.o) / (d.n + 1); d.So = (d.So * d.n + b.o) / (d.n + 1);
            d.n += 1; d.D += Dn; d.lots.push(0);
          } else { nid++; deals.set(nid, { s: sgn, n: 1, S: b.o, So: b.o, D: Dn, T: 0.0, L: 0.0, lots: [0] }); }
          F -= Dn;
        }
      }
    }
    for (const P of pathOf(b)) check(P);
    cd += [...deals.values()].reduce((a, d) => a + d.n, 0);
    for (const j of [...deals.keys()]) {
      const d = deals.get(j), pnl = d.s * d.n * (b.c - d.S) * M; F += pnl; d.S = b.c;
      if (pnl < 0) d.L += -pnl;
      d.lots = d.lots.map(a => a + 1);
      while (d.lots.length && d.lots[0] >= HOLD) { const rel = d.D / d.n; F += rel; d.D -= rel; d.n -= 1; d.lots.shift(); }
      if (d.n === 0) deals.delete(j);
    }
    if (axes && deals.size >= 2) {
      const ds = [...deals.values()], eng = ds.map(d => ({ s: d.s, n: d.n, Pref: d.S, D: d.D }));
      const xd = firstHit(eng, Math.max(F, 0), b.c, 1, 0.0005, 0.1), xu = firstHit(eng, Math.max(F, 0), b.c, -1, 0.0005, 0.1);
      if (xd == null && xu == null) continue;
      const dirn = (xu == null || (xd != null && xd <= xu)) ? 1 : -1, Pd = b.c * (1 - dirn * 0.01);
      const k = ds.map(d => h(d, b.c) - h(d, Pd)), S = k.reduce((a, x) => a + Math.abs(x), 0);
      const SD = ds.reduce((a, d) => a + d.D, 0), KK = Math.max(F, 0) + SD, TL = ds.reduce((a, d) => a + d.T + d.L, 0);
      ds.forEach((d, i) => rows.push({ t, start: start.m, trader: ttype, deal: i, A: S ? k[i] / S : NaN, w: d.D / SD,
        B: d.s * d.n * (b.c - d.So) * M / KK, C: TL > 0 ? (d.T + d.L) / TL : NaN }));
    }
  }
  return { hd_xu_ly: hand.reduce((a, x) => a + x, 0), hd_phien: cd, rows };
}
function l10c(bars) {
  const res = [], ax = [];
  for (const tt of ['bat_day', 'theo_da']) for (const mode of ['nhieu', 'mot3', 'mot']) for (const st of starts(bars)) {
    const r = l10cOne(bars, tt, st, mode, 1, mode === 'nhieu');
    res.push({ trader: tt, mode, start: st.m, hd_xu_ly: r.hd_xu_ly, hd_phien: r.hd_phien }); ax.push(...r.rows);
  }
  return { res, ax };
}

/* ---------- check_ma_tran_1n.py ---------- */
function split1n(ax) {
  const EPS = 1e-9, g = new Map();
  ax.forEach(r => { const k = r.trader + '|' + r.start + '|' + r.t; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
  let N = 0, ab = 0, ac = 0, c0 = 0, acNoC0 = 0;
  for (const s of g.values()) {
    const n = s.length, hiA = s.map(r => r.A > 1 / n + EPS);
    const ABs = new Set(s.map((r, i) => hiA[i] + '' + (r.B > 0))), ACs = new Set(s.map((r, i) => hiA[i] + '' + (r.C > 1 / n + EPS)));
    const isC0 = s.reduce((a, r) => a + (isNaN(r.C) ? 0 : r.C), 0) === 0; /* pandas sum bỏ qua NaN */
    N++; if (ABs.size > 1) ab++; if (ACs.size > 1) { ac++; if (!isC0) acNoC0++; } if (isC0) c0++;
  }
  return { N, ab, ac, c0, acNoC0 };
}

function summary(bars) {
  const b = l10b(bars), c = l10c(bars), s = split1n(c.ax);
  const sum = (rows, f, key) => rows.filter(f).reduce((a, r) => a + r[key], 0);
  const per100 = (f) => 100 * sum(b, f, 'xu_ly') / sum(b, f, 'deal_phien');
  const out = { l10b: {}, l10c: {}, split: s };
  for (const tt of ['bat_day', 'theo_da']) {
    out.l10b[tt] = { nhieuOn: sum(b, r => r.trader === tt && r.loai === 'nhieu' && r.auto === 1, 'xu_ly'), motOn: sum(b, r => r.trader === tt && r.loai === 'mot' && r.auto === 1, 'xu_ly'),
      ratioOff: per100(r => r.trader === tt && r.loai === 'nhieu' && r.auto === 0) / per100(r => r.trader === tt && r.loai === 'mot' && r.auto === 0) };
  }
  out.l10b.v1 = sum(b, r => r.auto === 1, 'v1'); out.l10b.handledOn = sum(b, r => r.auto === 1, 'xu_ly');
  for (const mode of ['nhieu', 'mot3', 'mot']) out.l10c[mode] = sum(c.res, r => r.mode === mode, 'hd_xu_ly');
  const rate = mode => 100 * sum(c.res, r => r.mode === mode, 'hd_xu_ly') / sum(c.res, r => r.mode === mode, 'hd_phien');
  out.l10c.Q1 = rate('nhieu') / rate('mot3');
  out.l10c.snapshots = new Set(c.ax.map(r => r.trader + '|' + r.start + '|' + r.t)).size;
  return { out, b, c };
}

if (require.main === module) {
  const { out } = summary(loadBars());
  const p = x => (100 * x).toFixed(1) + '%';
  console.log('Mô phỏng 1 (L10b), bật tự tăng: bat_day nhieu ' + out.l10b.bat_day.nhieuOn + ', theo_da nhieu ' + out.l10b.theo_da.nhieuOn +
    ' (tổng ' + out.l10b.handledOn + '); nhóm mot ' + (out.l10b.bat_day.motOn + out.l10b.theo_da.motOn));
  console.log('  tắt tự tăng, tỷ số nhieu/mot: bat_day ' + out.l10b.bat_day.ratioOff.toFixed(2) + ', theo_da ' + out.l10b.theo_da.ratioOff.toFixed(2));
  console.log('  V1 (đỏ ở phiên trước khi bị xử lý) = ' + out.l10b.v1 + '/' + out.l10b.handledOn + ' = ' + p(out.l10b.v1 / out.l10b.handledOn));
  console.log('Mô phỏng 2 (L10c): mot3 ' + out.l10c.mot3 + ', nhieu ' + out.l10c.nhieu + ', mot ' + out.l10c.mot + ', Q1 = ' + out.l10c.Q1.toFixed(2) + ', ' + out.l10c.snapshots + ' phiên có ≥ 2 Deal');
  const s = out.split;
  console.log('Tách ô, ranh giới 1/n: A × B ' + p(s.ab / s.N) + ' (' + s.ab + '/' + s.N + '), A × C ' + p(s.ac / s.N) + ' (' + s.ac + '/' + s.N + '), bỏ ' + s.c0 + ' phiên C = 0: ' + p(s.acNoC0 / (s.N - s.c0)) + ' (' + s.acNoC0 + '/' + (s.N - s.c0) + ')');
}
module.exports = { loadBars, firstHit, l10b, l10c, split1n, summary, starts };
