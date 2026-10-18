/* Kiểm dist/index.html trong Chromium thật, ở bề ngang laptop và điện thoại.
   Số mong đợi lấy từ HAI nơi: số vàng của demo_calc.py (viết tay) và engine.js chạy trong Node.
   Chạy: npm run e2e   (cần: npm ci && npx playwright install chromium)
   Không tải Chromium được: đặt E2E_CHANNEL=msedge (Edge có sẵn trên Windows) hoặc chrome.
   Mặc định mở file:// ; đặt E2E_URL để kiểm bản đã đưa lên (vd. https://<user>.github.io/future-x-shield/). */
'use strict';
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('E2E KHÔNG CHẠY: chưa cài playwright. Chạy: npm ci && npx playwright install chromium'); process.exit(2); }
const SE = require('../engine/engine.js');

const FILE = path.join(__dirname, '..', 'dist', 'index.html');
/* pathToFileURL: đúng cả trên Windows (ổ đĩa, dấu \\), không tự nối chuỗi file:// */
const BASE = process.env.E2E_URL || require('url').pathToFileURL(FILE).href;
if (!process.env.E2E_URL && !fs.existsSync(FILE)) { console.error('Chưa có dist/index.html. Chạy: node build.js'); process.exit(1); }
console.log('kiểm:', BASE);

let pass = 0, fail = 0;
function ok(label, cond, extra) { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && extra !== undefined ? '  -> ' + extra : '')); }
const VIET = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;
const nf = (lang, x, d) => Number(x).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const p1 = (lang, x) => nf(lang, x * 100, 1) + '%';

/* Số vàng (demo_calc.py, 16/10). Đây là nguồn thứ nhất; engine trong Node là nguồn thứ hai. */
const GOLD = { atlBefore: 0.2541, atlAfterDown: 0.0227, atlAfterUp: 0.1014, demoDown: 0.0960, demoUp: 0.1347 };
const atl = SE.atlAccount(), demo = SE.demoAccount();
const engAtlAfter = SE.score(SE.order(atl, 1, 2, 'VN30F1M').acc), engDemo = SE.score(demo);
ok('nguồn 2 khớp nguồn 1: ATL sau lệnh', Math.abs(engAtlAfter.down - GOLD.atlAfterDown) < 1e-9 && Math.abs(engAtlAfter.up - GOLD.atlAfterUp) < 1e-9);
ok('nguồn 2 khớp nguồn 1: danh mục demo', Math.abs(engDemo.down - GOLD.demoDown) < 1e-9 && Math.abs(engDemo.up - GOLD.demoUp) < 1e-9);

/* Vấn đề, Sản phẩm, Luật nằm chung trang Tổng quan (route cuộn tới phần tương ứng) */
const ROUTES = [['#/', 'overview'], ['#/van-de', 'overview'], ['#/san-pham', 'overview'], ['#/luat', 'overview'], ['#/demo/atl', 'demo/atl'],
  ['#/demo/shield', 'demo/shield'], ['#/demo/vien-canh', 'demo/scen'], ['#/demo/danh-muc', 'demo/port']];

(async () => {
  const channel = process.env.E2E_CHANNEL || undefined;
  const browser = await chromium.launch(channel ? { channel } : {});
  console.log('trình duyệt:', channel || 'chromium (Playwright)', browser.version());
  const errors = [];
  async function openPage(width, hash, lang) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    if (lang) await ctx.addInitScript(l => { try { localStorage.setItem('fxs-lang', l); } catch (e) {} }, lang);
    const pg = await ctx.newPage();
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(width + ' ' + hash + ': ' + m.text()); });
    pg.on('pageerror', e => errors.push(width + ' ' + hash + ' pageerror: ' + e.message));
    await pg.goto(BASE + hash);
    await pg.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
    return pg;
  }
  const visibleViews = pg => pg.$$eval('.view', vs => vs.filter(v => !v.hidden).map(v => v.dataset.view));
  const text = (pg, sel) => pg.$eval(sel, el => el.innerText);

  /* 1. Mọi tab, hai bề ngang: đúng 1 view hiện, không cuộn ngang, có tiêu đề */
  for (const width of [1280, 390]) {
    for (const [hash, view] of ROUTES) {
      const pg = await openPage(width, hash);
      const vis = await visibleViews(pg);
      ok(`${width}px ${hash}: chỉ hiện view ${view}`, vis.length === 1 && vis[0] === view, vis.join(','));
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
      ok(`${width}px ${hash}: không cuộn ngang`, sw <= width, 'scrollWidth ' + sw);
      const head = await pg.$eval(`.view[data-view="${view}"]`, v => (v.querySelector('h1, .quote') || {}).innerText || '');
      ok(`${width}px ${hash}: có tiêu đề`, head.trim().length > 5);
      await pg.context().close();
    }
  }

  /* 2. Tổng quan: các phần chung trang, thanh trên trong suốt ở đầu trang */
  let d;
  let pg = await openPage(1280, '#/');
  ok('Tổng quan: thanh trên trong suốt ở đầu trang', await pg.$eval('.bar', b => b.classList.contains('clear')));
  ok('Tổng quan: có đủ 3 phần Vấn đề, Sản phẩm, Luật', (await pg.$$eval('.view[data-view="overview"] [data-section]', e => e.map(x => x.id).join(','))) === 'van-de,san-pham,luat');
  ok('Tổng quan: không còn trang Điểm yếu', (await pg.$$('.view[data-view="limits"], [data-tab="limits"]')).length === 0);
  for (const [hash, id, tab] of [['#/van-de', 'van-de', 'problem'], ['#/san-pham', 'san-pham', 'product'], ['#/luat', 'luat', 'rules']]) {
    await pg.click(`.tabs a[href="${hash}"]`); await pg.waitForTimeout(250);
    const top = await pg.$eval('#' + id, e => Math.round(e.getBoundingClientRect().top));
    const barH = await pg.$eval('.bar', b => b.offsetHeight);
    ok(`${hash}: cuộn tới phần ${id} (đỉnh phần ngay dưới thanh trên)`, top >= barH - 2 && top <= barH + 40, 'top ' + top + ', bar ' + barH);
    ok(`${hash}: tab ${tab} được đánh dấu`, (await pg.$eval('.tabs [aria-current="page"]', a => a.dataset.tab)) === tab);
    ok(`${hash}: thanh trên hết trong suốt khi đã cuộn`, !(await pg.$eval('.bar', b => b.classList.contains('clear'))));
  }
  /* build stamp: chân trang khớp window.__BUILD__ và <meta> */
  const B = await pg.evaluate(() => window.__BUILD__);
  const meta = JSON.parse(await pg.$eval('meta[name="build"]', m => m.content));
  ok('bản build: window.__BUILD__ có commit', B && typeof B.commit === 'string' && B.commit.length >= 6, JSON.stringify(B));
  ok('bản build: <meta> khớp window.__BUILD__', JSON.stringify(meta) === JSON.stringify(B));
  ok('bản build: chân trang hiện commit', (await text(pg, '#build-id')).includes(B.commit));
  if (process.env.EXPECT_COMMIT) ok('bản build: đúng commit vừa đẩy (' + process.env.EXPECT_COMMIT + ')', B.commit.startsWith(process.env.EXPECT_COMMIT.slice(0, 12)) && !B.dirty, JSON.stringify(B));
  await pg.context().close();

  /* 3. Demo lúc đặt lệnh */
  pg = await openPage(1280, '#/demo/atl');
  let card = await text(pg, '#atl-card');
  ok('ATL: trước lệnh 25,4%', card.includes(p1('vi', GOLD.atlBefore)));
  ok('ATL: sau lệnh 2,3% và 10,1%', card.includes(p1('vi', GOLD.atlAfterDown)) && card.includes(p1('vi', GOLD.atlAfterUp)), card);
  ok('ATL: 4 Deal sau lệnh', /4 Deal/.test(card));
  const conds = SE.conditions(atl, 1, 2, 'VN30F1M', 5);
  ok('ATL: điều kiện nạp khoảng 18 triệu → 5,0%', card.includes('khoảng ' + Math.round(conds.deposit.amount) + ' triệu') && card.includes(p1('vi', conds.deposit.score.down)) && Math.round(conds.deposit.amount) === 18);
  ok('ATL: đóng Deal #1 → 9,6%', card.includes('Deal #' + conds.closeOne.id) && card.includes(p1('vi', conds.closeOne.score.down)) && p1('vi', conds.closeOne.score.down) === '9,6%');
  ok('ATL: có dòng "không phải khuyến nghị"', /không phải khuyến nghị/.test(card));
  await pg.click('[data-step="1"]');
  card = await text(pg, '#atl-card');
  const r3 = SE.order(atl, 1, 3, 'VN30F1M');
  ok('ATL: long 3 HĐ báo thiếu 30,88 triệu', !r3.ok && card.includes(nf('vi', r3.need, 2)) && nf('vi', r3.need, 2) === '30,88', card);
  await pg.click('[data-step="-1"]'); await pg.click('[data-step="-1"]');
  await pg.click('[data-code="VN30F2M"]'); await pg.click('[data-side="-1"]');
  card = await text(pg, '#atl-card');
  const s1 = SE.score(SE.order(atl, -1, 1, 'VN30F2M').acc);
  ok('ATL: short 1 F2M → 14,4% / 15,0%', card.includes(p1('vi', s1.down)) && card.includes(p1('vi', s1.up)) && p1('vi', s1.down) === '14,4%', card);
  await pg.context().close();

  /* 4. Demo Shield */
  pg = await openPage(1280, '#/demo/shield');
  d = await pg.$eval('[data-ruler="shield"]', e => [e.dataset.down, e.dataset.up]);
  ok('Shield: hiện tại 9,60% / 13,47%', d[0] === GOLD.demoDown.toFixed(4) && d[1] === GOLD.demoUp.toFixed(4), d);
  const tb = await text(pg, '#sh-table');
  ok('Shield: trục A 61,4 / −25,8 / −12,9', ['61,4%', '-25,8%', '-12,9%'].every(x => tb.replace(/−/g, '-').includes(x)), tb);
  ok('Shield: trục B −0,80 / +2,13 / +0,53', ['−0,80%', '+2,13%', '+0,53%'].every(x => tb.includes(x)), tb);
  ok('Shield: 3 chấm trên ma trận', (await pg.$$('#sh-matrix .dot')).length === 3);
  await pg.click('[data-shview="order"]');
  const so = SE.score(SE.order(demo, 1, 1, 'VN30F1M').acc);
  d = await pg.$eval('[data-ruler="shield"]', e => [e.dataset.down, e.dataset.up]);
  ok('Shield: sau lệnh +1 long khớp engine', d[0] === (so.down == null ? 'null' : so.down.toFixed(4)) && d[1] === (so.up == null ? 'null' : so.up.toFixed(4)), d);
  ok('Shield: sau lệnh có 4 chấm', (await pg.$$('#sh-matrix .dot')).length === 4);
  await pg.context().close();

  /* 5. Demo viễn cảnh */
  pg = await openPage(1280, '#/demo/vien-canh');
  ok('Viễn cảnh: bắt đầu với 1 dòng', (await pg.$$('#sc-chain li')).length === 1);
  await pg.click('[data-add="down"]');
  const mv = SE.score(SE.move(demo, -2));
  let chain = await text(pg, '#sc-chain');
  ok('Viễn cảnh: giảm 2% → ' + p1('vi', mv.down) + ' / ' + p1('vi', mv.up), chain.includes('↓' + p1('vi', mv.down)) && chain.includes('↑' + p1('vi', mv.up)), chain);
  await pg.click('[data-close="1"]');
  ok('Viễn cảnh: 3 dòng sau 2 bước', (await pg.$$('#sc-chain li')).length === 3);
  await pg.click('#sc-undo'); await pg.click('#sc-undo');
  ok('Viễn cảnh: bỏ 2 bước về 1 dòng, nút bỏ bị khoá', (await pg.$$('#sc-chain li')).length === 1 && await pg.$eval('#sc-undo', b => b.disabled));
  ok('Viễn cảnh: khối 3D có 3 hình cầu', (await pg.$$('#sc-cube .c3-pt')).length === 3);
  await pg.click('[data-face="AC"]');
  await pg.waitForFunction(() => document.querySelector('#sc-cube').dataset.face === 'AC', null, { timeout: 3000 }).catch(() => {});
  ok('Viễn cảnh: chọn mặt A × C xoay khối', (await pg.$eval('#sc-cube', c => c.dataset.face)) === 'AC');
  const yaw0 = +(await pg.$eval('#sc-cube svg', s => s.dataset.yaw));
  const box = await pg.$eval('#sc-cube svg', s => { const r = s.getBoundingClientRect(); return { x: r.left + 30, y: r.top + 30 }; });
  await pg.mouse.move(box.x, box.y); await pg.mouse.down(); await pg.mouse.move(box.x + 120, box.y + 10, { steps: 6 }); await pg.mouse.up();
  const yaw1 = +(await pg.$eval('#sc-cube svg', s => s.dataset.yaw));
  ok('Viễn cảnh: kéo chuột xoay khối (yaw ' + yaw0 + ' → ' + yaw1 + ')', Math.abs(yaw1 - yaw0) > 30);
  await pg.context().close();

  /* 5b. Danh mục thật: khách mẫu trên giá VN30F1M thật */
  pg = await openPage(1280, '#/demo/danh-muc');
  const sec = () => pg.$eval('.view[data-view="demo/port"]', s => Object.assign({}, s.dataset));
  let ds = await sec();
  ok('Danh mục: mở ở phiên 02/03/2026 với 5 Deal', ds.t === '2026-03-02' && ds.deals === '5', JSON.stringify(ds));
  ok('Danh mục: Deal đầu tiên bị xử lý 03/03/2026, tổng 2 Deal', ds.firstLiq === '2026-03-03' && ds.liq === '2', JSON.stringify(ds));
  ok('Danh mục: thanh Shield đỏ lúc đóng cửa 02/03', /Nguy hiểm/.test(await text(pg, '[data-ruler="port"] .chip')));
  ok('Danh mục: câu tóm tắt nói Shield báo trước 1 phiên', /báo trước 1 phiên/.test(await text(pg, '#pt-insight')));
  ok('Danh mục: bảng có 5 Deal', (await pg.$$('#pt-table tr[data-deal]')).length === 5);
  ok('Danh mục: khối 3D có 5 hình cầu', (await pg.$$('#pt-cube .c3-pt')).length === 5);
  await pg.click('[data-ptact="close"][data-id="2"]');
  ds = await sec();
  ok('Danh mục: đóng Deal #2 sau phiên 02/03 thì Deal đầu tiên bị xử lý dời tới 08/04/2026', ds.firstLiq === '2026-04-08' && ds.liq === '1', JSON.stringify(ds));
  ok('Danh mục: quyết định hiện trong danh sách', (await pg.$$('#pt-mine [data-rm]')).length === 1);
  await pg.click('#pt-mine [data-rm="0"]');
  ds = await sec();
  ok('Danh mục: bỏ quyết định thì về lại kết quả gốc', ds.firstLiq === '2026-03-03' && ds.liq === '2');
  await pg.click('#pt-next');
  ds = await sec();
  ok('Danh mục: nút phiên sau chuyển sang 03/03, còn 4 Deal', ds.t === '2026-03-03' && ds.deals === '4', JSON.stringify(ds));
  ok('Danh mục: sự kiện phiên 03/03 có Deal #2 bị xử lý', /Deal #2 bị xử lý/.test(await text(pg, '#pt-events')));
  await pg.$eval('#pt-slider', el => { el.value = el.min; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ds = await sec();
  ok('Danh mục: kéo thanh trượt về đầu khoảng (26/01/2026, chưa có Deal)', ds.t === '2026-01-26' && ds.deals === '0', JSON.stringify(ds));
  await pg.click('[data-preset="B"]');
  ds = await sec();
  ok('Danh mục: khách B, Deal đầu tiên bị xử lý 03/04/2025', ds.firstLiq === '2025-04-03', JSON.stringify(ds));
  ok('Danh mục: khách B, câu tóm tắt nói giá chạy trong phiên nhanh hơn', /trong phiên nhanh hơn/.test(await text(pg, '#pt-insight')));
  await pg.context().close();

  /* 6. Song ngữ */
  pg = await openPage(1280, '#/demo/atl');
  const viText = await pg.evaluate(() => document.body.innerText);
  ok('đối chứng âm: trang tiếng Việt bị bộ dò chữ Việt bắt', VIET.test(viText));
  await pg.click('#lang-toggle'); await pg.click('[data-lang="en"]');
  ok('EN: <html lang="en">', (await pg.$eval('html', h => h.lang)) === 'en');
  for (const [hash] of ROUTES) {
    await pg.evaluate(h => { location.hash = h; }, hash);
    await pg.waitForTimeout(150);
    const body = await pg.evaluate(() => document.body.innerText);
    const leak = (body.match(new RegExp(VIET.source, 'gi')) || []).length;
    ok('EN ' + hash + ': không còn chữ tiếng Việt', leak === 0, body.split('\n').filter(l => VIET.test(l)).slice(0, 3).join(' | '));
  }
  await pg.evaluate(() => { location.hash = '#/demo/atl'; }); await pg.waitForTimeout(150);
  card = await text(pg, '#atl-card');
  ok('EN: số theo kiểu en-US (25.4%, 2.3%)', card.includes(p1('en', GOLD.atlBefore)) && card.includes(p1('en', GOLD.atlAfterDown)), card);
  await pg.reload(); await pg.waitForSelector('body[data-ready="1"]');
  ok('EN: tải lại vẫn nhớ tiếng Anh', (await pg.$eval('html', h => h.lang)) === 'en');
  await pg.click('#lang-toggle'); await pg.click('[data-lang="vi"]');
  ok('VI: bấm VI trở lại tiếng Việt', VIET.test(await pg.evaluate(() => document.body.innerText)));
  const empty = await pg.$$eval('[data-i18n]', els => els.filter(e => !e.innerHTML.trim()).length);
  ok('VI: không phần tử data-i18n nào rỗng', empty === 0, empty);
  await pg.context().close();

  /* 7. Bàn phím: Tab tới được tab điều hướng, có viền focus */
  pg = await openPage(1280, '#/');
  await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
  const focus = await pg.evaluate(() => { const a = document.activeElement; return a && (a.className + '|' + getComputedStyle(a).outlineStyle); });
  ok('bàn phím: phần tử thứ 2 nhận focus có viền', /solid/.test(focus || ''), focus);
  await pg.context().close();

  ok('không lỗi/cảnh báo console, không CSP chặn', errors.length === 0, errors.slice(0, 5).join(' || '));
  await browser.close();
  const MIN = 75;
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  if (pass + fail < MIN) { console.log('FAIL: chỉ chạy ' + (pass + fail) + ' kiểm, cần ít nhất ' + MIN); process.exit(1); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E LỖI:', e); process.exit(1); });
