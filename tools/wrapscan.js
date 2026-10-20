/* Dò chỗ xuống dòng xấu: khối chữ ≥ 2 dòng mà dòng cuối quá ngắn (một hai chữ lẻ loi).
   Dùng trong tests/e2e.js và chạy riêng: node tools/wrapscan.js [url] */
function scanInPage(opts) {
  var RATIO = opts && opts.ratio || 0.3, out = [];
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.closest('svg, script, style, .c3-tip, .c3-toast, [hidden], .sr-only')) continue;
    var cs = getComputedStyle(el);
    if (!/^(block|list-item|table-cell|flex|grid|inline-block)$/.test(cs.display)) continue;
    var own = false;
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.textContent.trim().length > 2) { own = true; break; }
    if (!own) continue;
    var r0 = el.getBoundingClientRect(); if (!r0.width || !r0.height || cs.visibility === 'hidden') continue;
    var rg = document.createRange(); rg.selectNodeContents(el);
    var rects = [].slice.call(rg.getClientRects()).filter(function (r) { return r.width > 0.5 && r.height > 4; });
    var lines = [];
    rects.forEach(function (r) {
      var mid = r.top + r.height / 2, L = null;
      for (var k = 0; k < lines.length; k++) if (Math.abs(lines[k].mid - mid) < r.height * 0.45) { L = lines[k]; break; }
      if (!L) lines.push(L = { mid: mid, l: r.left, r: r.right }); else { L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); }
    });
    if (lines.length < 2) continue;
    lines.sort(function (a, b) { return a.mid - b.mid; });
    var widest = Math.max.apply(null, lines.map(function (x) { return x.r - x.l; })), last = lines[lines.length - 1], lw = last.r - last.l;
    var words = el.innerText.trim().split(/\s+/), lastText = '';
    /* chữ ở dòng cuối: đi ngược từng chữ tới khi ra khỏi dòng cuối */
    var txt = el.innerText.trim();
    /* 2–6 dòng: dòng cuối dưới 30% là xấu. Đoạn dài hơn thì dòng cuối ngắn là chuyện thường, chỉ bắt khi dưới 20% */
    if (lw / widest < (lines.length > 6 ? 0.2 : RATIO)) {
      var cls = (el.className && el.className.baseVal === undefined ? el.className : '') || '';
      out.push({ sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + String(cls).trim().split(/\s+/).join('.') : ''),
        lines: lines.length, ratio: +(lw / widest).toFixed(2), text: txt.length > 90 ? txt.slice(0, 40) + ' … ' + txt.slice(-40) : txt });
    }
  }
  return out;
}
module.exports = { scanInPage };
if (require.main === module) {
  const { chromium } = require('playwright');
  const BASE = process.argv[2] || 'file://' + require('path').resolve(__dirname, '../dist/index.html');
  const ROUTES = ['#/', '#/demo/atl', '#/demo/shield', '#/demo/vien-canh', '#/demo/danh-muc'];
  (async () => {
    const b = await chromium.launch(); let total = 0;
    for (const lang of ['vi', 'en']) for (const w of [1903, 1440, 1280, 1024, 768, 390]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await ctx.addInitScript(l => localStorage.setItem('fxs-lang', l), lang);
      const p = await ctx.newPage();
      for (const r of ROUTES) {
        await p.goto(BASE + r); await p.waitForSelector('body[data-ready="1"]'); await p.waitForTimeout(400);
        const res = await p.evaluate(scanInPage);
        for (const x of res) { total++; console.log([lang, w, r, x.sel, x.lines + 'L', x.ratio, JSON.stringify(x.text)].join(' | ')); }
      }
      await ctx.close();
    }
    console.log('tổng', total); await b.close();
  })();
}
