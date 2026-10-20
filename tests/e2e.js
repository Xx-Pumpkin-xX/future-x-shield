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
   
  /* 2. Tổng quan: một trang, bấm tab thì cuộn tới phần tương ứng */
  let d;
  let pg = await openPage(1280, '#/');
  ok('Tổng quan: thanh trên trong suốt ở đầu trang', await pg.$eval('.bar', b => b.classList.contains('clear')));
  ok('Tổng quan: 8 phần sau hero, đúng thứ tự R3_11', (await pg.$$eval('[data-section]', e => e.map(x => x.id).join(','))) === 'van-de,bang-chung,san-pham,buoc-2,buoc-3,ai-dung,luat,du-lieu');
  const bgs = await pg.$$eval('.band', e => e.map(x => getComputedStyle(x).backgroundColor));
  ok('Tổng quan: nền đỏ nhạt / trắng xen kẽ (bắt đầu bằng đỏ nhạt ở Vấn đề)', bgs.every((c, i) => c === (i % 2 === 0 ? 'rgb(253, 240, 240)' : 'rgb(255, 255, 255)')), bgs.join(' | '));
  ok('Tổng quan: phần nào cũng mở đầu bằng nhãn hoặc tiêu đề Bước', (await pg.$$eval('.band', e => e.filter(x => !x.querySelector(':scope > .kicker, :scope > .sec-title, :scope > .step-t')).length)) === 0);
  ok('Tổng quan: chú giải [F] [A] [M] nằm ở hero, khối "Ba nhãn" đã xoá', /\[F\][\s\S]*\[A\][\s\S]*\[M\]/.test(await text(pg, '.hero-note')) && (await pg.$$('.chips')).length === 0);
  const pbBars = await text(pg, '#pb-bars');
  ok('Vấn đề: hai thanh lấy số từ engine (80 → 6 triệu; 25,4% → 2,3%)', pbBars.includes('80 → 6 triệu') && pbBars.includes('25,4% → 2,3%'), pbBars);
  ok('Vấn đề: 4 Deal cùng tỷ lệ 18,48%, Deal #3 #4 là mới', (await pg.$$eval('#pb-see li', e => e.filter(x => x.innerText.includes('18,48%')).length)) === 4 && (await pg.$$('#pb-see li em')).length === 2);
  ok('Bước 1: thanh tĩnh của danh mục demo 9,60% / 13,47%', (await pg.$eval('[data-ruler="ov"]', e => e.dataset.down + '/' + e.dataset.up)) === '0.0960/0.1347');
  const cellsOf = async sel => pg.$$eval(sel + ' .dot', e => e.map(x => x.dataset.id + ':' + x.dataset.cell).sort().join(','));
  ok('Bước 2: ma trận A × B (#1 Exposed loss, #2 #3 Contained gain)', (await cellsOf('#ov-mx-ab')) === '1:bomb,2:safe,3:safe', await cellsOf('#ov-mx-ab'));
  ok('Bước 2: ma trận A × C sau lệnh (#1 Primary, #4 Emerging, #2 #3 Low)', (await cellsOf('#ov-mx-ac')) === '1:main,2:out,3:out,4:next', await cellsOf('#ov-mx-ac'));
  ok('Bước 2: vạch ranh giới ghi 1/3 và 1/4', /1\/3/.test(await text(pg, '#ov-mx-ab')) && /1\/4/.test(await text(pg, '#ov-mx-ac')));
  ok('Bước 2: ví dụ Deal #1 là 61% / −0,8% / 81%', (await text(pg, '#ex-a')) === '61%' && (await text(pg, '#ex-b')) === '−0,8%' && (await text(pg, '#ex-c')) === '81%');
  ok('Dành cho ai: 1, 2, 3 icon người', (await pg.$$eval('[data-people]', e => e.map(x => x.querySelectorAll('svg').length).join(''))) === '123');
  ok('Tổng quan: không còn trang Điểm yếu', (await pg.$$('[data-view="limits"], [data-tab="limits"]')).length === 0);
  for (const [hash, id, tab] of [['#/van-de', 'van-de', 'problem'], ['#/san-pham', 'san-pham', 'product'], ['#/luat', 'luat', 'rules']]) {
    await pg.click(`.tabs a[href="${hash}"]`); await pg.waitForTimeout(1200);
    const top = await pg.$eval('#' + id, e => Math.round(e.getBoundingClientRect().top));
    const barH = await pg.$eval('.bar', b => b.offsetHeight);
    ok(`${hash}: cuộn tới phần ${id}`, top >= barH - 2 && top <= barH + 40, 'top ' + top + ', bar ' + barH);
    ok(`${hash}: tab ${tab} được đánh dấu`, (await pg.$eval('.tabs [aria-current="page"]', a => a.dataset.tab)) === tab);
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
  pg = await openPage(1280, '#/demo/vien-canh');
  const faceNow = () => pg.$eval('#sc-cube', c => c.dataset.face);
  const waitFace = f => pg.waitForFunction(x => document.querySelector('#sc-cube').dataset.face === x, f, { timeout: 3000 }).catch(() => {});
  ok('Viễn cảnh: gợi ý "Thử" ghi đúng điểm sau 1 lệnh long', (await text(pg, '#sc-try')).includes('↓1,6% ↑2,8%'));
  await pg.click('[data-add="long"]'); await waitFace('AC');
  ok('Viễn cảnh (lỗi B3): "Theo màu", 1 lệnh long → đỏ → khối sang mặt A × C', (await faceNow()) === 'AC' && /Nguy hiểm/.test(await text(pg, '#sc-chain li:last-child .chip')));
  await pg.waitForFunction(() => document.querySelector('#sc-cube').dataset.mode === 'flat', null, { timeout: 3000 }).catch(() => {});
  ok('Viễn cảnh: mặt A × C trải phẳng, hiện tên ô mới', /Primary driver/.test(await pg.$eval('#sc-cube', h => h.textContent)));
  /* kéo lên: pitch tăng từ −80° về gần −10°, tức nhìn lại mặt A × B */
  const cb = await pg.$eval('#sc-cube svg', s => { s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + 40, y: r.bottom - 20 }; });
  await pg.mouse.move(cb.x, cb.y); await pg.mouse.down(); await pg.mouse.move(cb.x + 10, cb.y - 150, { steps: 8 }); await pg.mouse.up();
  const dragged = await faceNow();
  await pg.click('[data-add="short"]'); await waitFace('AC');
  ok('Viễn cảnh (lỗi B3): kéo lệch về A × B rồi thêm bước vẫn đỏ → khối tự về A × C (sau kéo: ' + dragged + ')', dragged === 'AB' && (await faceNow()) === 'AC');
  await pg.click('#sc-undo'); await pg.click('#sc-undo'); await waitFace('AB');
  ok('Viễn cảnh: bỏ hết bước → xanh → khối về mặt A × B', (await faceNow()) === 'AB');
  await pg.context().close();

  /* Khối 3D xoay kiểu bàn xoay; hai mặt A × B, A × C là ma trận 2D phẳng */
  pg = await openPage(1280, '#/demo/vien-canh');
  const modeNow = () => pg.$eval('#sc-cube', c => c.dataset.mode);
  await pg.waitForFunction(() => document.querySelector('#sc-cube').dataset.mode === 'flat', null, { timeout: 3000 }).catch(() => {});
  ok('Khối: mặt A × B là ma trận 2D phẳng, đủ 3 chấm, có tên ô mới', (await modeNow()) === 'flat' && (await pg.$$('#sc-cube .c3-flat .dot')).length === 3 && /Contained gain/.test(await text(pg, '#sc-cube .c3-flat')));
  const c0 = await pg.$eval('#sc-cube', h => { h.scrollIntoView({ block: 'center' }); const b = h.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const centreOf = () => pg.$eval('#sc-cube svg', s => { const q = [...s.querySelectorAll('.c3-plane.pa, .c3-plane.pb')].flatMap(p => p.getAttribute('points').split(' ').map(v => v.split(',').map(Number)));
    return [q.reduce((a, v) => a + v[0], 0) / q.length, q.reduce((a, v) => a + v[1], 0) / q.length]; });
  await pg.mouse.move(c0.x, c0.y); await pg.mouse.down(); const cs = [];
  for (let i = 1; i <= 5; i++) { await pg.mouse.move(c0.x + i * 30, c0.y - i * 12, { steps: 3 }); cs.push(await centreOf()); }
  ok('Khối: kéo trên ma trận 2D thì nổi thành 3D', (await modeNow()) === '3d');
  const drift = Math.max(...cs.map(c => Math.hypot(c[0] - cs[0][0], c[1] - cs[0][1])));
  ok('Khối: tâm xoay cố định khi kéo (lệch tối đa ' + drift.toFixed(1) + ' px)', drift < 6);
  await pg.mouse.up(); const yA = +(await pg.$eval('#sc-cube svg', s => s.dataset.yaw)); await pg.waitForTimeout(300);
  const yB = +(await pg.$eval('#sc-cube svg', s => s.dataset.yaw));
  ok('Khối: thả tay khi đang kéo thì còn trôi theo quán tính (' + yA + '° → ' + yB + '°)', yB !== yA);
  await pg.click('[data-face="3d"]'); await pg.waitForTimeout(900);
  ok('Khối: nút Xoay 3D giữ khối ở dạng 3D', (await modeNow()) === '3d');
  await pg.click('[data-add="long"]'); await pg.waitForTimeout(900);
  ok('Khối: ở chế độ Xoay 3D, thêm bước không tự trải phẳng', (await modeNow()) === '3d');
  await pg.click('[data-face="AC"]'); await pg.waitForFunction(() => document.querySelector('#sc-cube').dataset.mode === 'flat', null, { timeout: 3000 }).catch(() => {});
  ok('Khối: nút Mặt A × C trải phẳng ma trận A × C', (await modeNow()) === 'flat' && (await faceNow()) === 'AC' && /Primary driver/.test(await text(pg, '#sc-cube .c3-flat')));
  await pg.context().close();

  /* Khối kiểu mô hình Bohr: phóng to, rê để xem số, chọn Deal bằng hàng nút, tự xoay khi để yên */
  pg = await openPage(1280, '#/demo/danh-muc');
  await pg.click('[data-pface="3d"]'); await pg.waitForTimeout(900);
  await pg.$eval('#pt-cube', h => h.scrollIntoView({ block: 'center' }));
  const zoomNow = () => pg.$eval('#pt-cube', h => +h.dataset.zoom);
  const ballAt = id => pg.$eval('#pt-cube .c3-pt[data-id="' + id + '"] circle', c => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width }; });
  ok('Khối Bohr: có hàng nút chọn Deal, đủ 5 Deal', (await pg.$$('#pt-cube .c3-chip')).length === 5);
  const d0 = (await ballAt(1)).d;
  await pg.click('#pt-cube [data-c3="in"]'); await pg.click('#pt-cube [data-c3="in"]'); await pg.mouse.move(5, 5); await pg.waitForTimeout(200);
  const z2 = await zoomNow(), d2 = (await ballAt(1)).d;
  ok('Khối Bohr: nút + phóng to (' + z2 + '×), hình cầu to lên chậm hơn khối (' + d0.toFixed(0) + ' → ' + d2.toFixed(0) + ' px)', z2 > 1.4 && d2 > d0 && d2 / d0 < z2);
  const waitHome = () => pg.waitForFunction(() => document.querySelector('#pt-cube').dataset.zoom === '1.00', null, { timeout: 3000 }).then(() => pg.waitForTimeout(150)).catch(() => {});
  await pg.click('#pt-cube [data-c3="reset"]'); await pg.mouse.move(5, 5); await waitHome();
  ok('Khối Bohr: nút về góc nhìn ban đầu đưa độ phóng về 1×', (await zoomNow()) === 1);
  const mid = await pg.$eval('#pt-cube svg', s => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.move(mid.x, mid.y); const sy0 = await pg.evaluate(() => scrollY);
  await pg.mouse.wheel(0, 200); await pg.waitForTimeout(250);
  const toastTxt = await pg.$eval('#pt-cube .c3-toast', t => t.hidden ? '' : t.textContent);
  ok('Khối Bohr: cuộn thường không phóng, trang vẫn cuộn, có nhắc giữ Ctrl', (await zoomNow()) === 1 && (await pg.evaluate(() => scrollY)) > sy0 && /Ctrl/.test(toastTxt), toastTxt);
  await pg.$eval('#pt-cube', h => h.scrollIntoView({ block: 'center' }));
  const m2 = await pg.$eval('#pt-cube svg', s => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.move(m2.x, m2.y); await pg.keyboard.down('Control'); await pg.mouse.wheel(0, -300); await pg.keyboard.up('Control'); await pg.waitForTimeout(150);
  ok('Khối Bohr: Ctrl + cuộn thì phóng to (' + (await zoomNow()) + '×)', (await zoomNow()) > 1.3);
  await pg.click('#pt-cube [data-c3="reset"]'); await waitHome();
  const b4 = await ballAt(4); await pg.mouse.move(b4.x, b4.y); await pg.waitForTimeout(200);
  const tip = await pg.$eval('#pt-cube .c3-tip', t => t.hidden ? '' : t.innerText);
  ok('Khối Bohr: rê vào Deal #4 hiện thẻ số A, B, C và tên ô', /#4/.test(tip) && /A \d/.test(tip) && /B [+−-]/.test(tip) && /C \d/.test(tip) && /Exposed gain/.test(tip), tip.replace(/\n/g, ' | '));
  ok('Khối Bohr: rê vào thì có đường dóng về 3 trục', (await pg.$$('#pt-cube .c3-dash')).length >= 3);
  await pg.mouse.move(5, 5);
  await pg.click('#pt-cube .c3-chip[data-id="2"]'); await pg.waitForTimeout(150);
  ok('Khối Bohr: bấm nút #2 thì chọn Deal #2 ở cả khối và bảng', (await pg.$eval('#pt-cube .c3-chip[data-id="2"]', b => b.getAttribute('aria-pressed'))) === 'true' && (await pg.$eval('#pt-table tr.sel', r => r.dataset.deal).catch(() => '')) === '2');
  await pg.click('#pt-cube .c3-chip[data-id="2"]'); await pg.mouse.move(5, 5);
  await pg.click('#pt-cube [data-c3="reset"]'); await pg.mouse.move(5, 5);
  const ya = +(await pg.$eval('#pt-cube svg', s => s.dataset.yaw)); await pg.waitForTimeout(4200);
  const yb = +(await pg.$eval('#pt-cube svg', s => s.dataset.yaw));
  ok('Khối Bohr: để yên vài giây thì tự xoay chậm (' + ya + '° → ' + yb + '°)', yb !== ya);
  ok('Khối Bohr: máy có chuột thì gợi ý nói Ctrl + cuộn', /Ctrl/.test(await text(pg, '#pt-cube .c3-hint')));
  await pg.context().close();
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const p3 = await ctx.newPage(); p3.on('pageerror', e => errors.push('reduce pageerror: ' + e.message));
    await p3.goto(BASE + '#/demo/danh-muc'); await p3.waitForSelector('body[data-ready="1"]');
    await p3.click('[data-pface="3d"]'); await p3.waitForTimeout(900); await p3.mouse.move(5, 5);
    const r0 = await p3.$eval('#pt-cube svg', s => s.dataset.yaw); await p3.waitForTimeout(4200);
    ok('Khối Bohr: người dùng tắt hiệu ứng chuyển động thì không tự xoay', r0 === (await p3.$eval('#pt-cube svg', s => s.dataset.yaw)));
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true, isMobile: true });
    const p4 = await ctx2.newPage(); await p4.goto(BASE + '#/demo/danh-muc'); await p4.waitForSelector('body[data-ready="1"]');
    await p4.click('[data-pface="3d"]'); await p4.waitForTimeout(600);
    ok('Khối Bohr: điện thoại thì gợi ý nói chụm hai ngón, không nói Ctrl', /chụm|pinch/.test(await p4.$eval('#pt-cube .c3-hint', h => h.textContent)) && !/Ctrl/.test(await p4.$eval('#pt-cube .c3-hint', h => h.textContent)));
    await ctx2.close();
  }

  /* 5b. Danh mục thật: khách mẫu trên giá VN30F1M thật */
  pg = await openPage(1280, '#/demo/danh-muc');
  const sec = () => pg.$eval('.view[data-view="demo/port"]', s => Object.assign({}, s.dataset));
  let ds = await sec();
  ok('Danh mục: mở ở phiên 02/03/2026 với 5 Deal', ds.t === '2026-03-02' && ds.deals === '5', JSON.stringify(ds));
  ok('Danh mục: Deal đầu tiên bị xử lý 03/03/2026, tổng 2 Deal', ds.firstLiq === '2026-03-03' && ds.liq === '2', JSON.stringify(ds));
  ok('Danh mục: thanh Shield đỏ lúc đóng cửa 02/03', /Nguy hiểm/.test(await text(pg, '[data-ruler="port"] .chip')));
  ok('Danh mục: câu tóm tắt nói xử lý một phiên sau khi Shield báo', /một phiên sau khi Shield báo/.test(await text(pg, '#pt-insight')));
  /* lỗi R3_11 B4: số dấu × trên biểu đồ phải khớp số Deal bị xử lý; lệnh thứ 6 bị từ chối phải được nói ra */
  ok('Danh mục: biểu đồ có đúng 2 dấu ×, ghi #2 và #5', (await pg.$$eval('#pt-chart .pc-liqid', e => e.map(x => x.textContent).join(','))) === '#2,#5');
  ok('Danh mục: lệnh bị từ chối có dấu riêng và được ghi trong mô tả', (await pg.$$('#pt-chart .pc-ord.rej')).length === 1 && /1 lệnh bị bỏ qua vì không đủ cọc ngoài Deal/.test(await text(pg, '#pt-desc')));
  ok('Danh mục: cọc ngoài Deal âm có giải thích', /−0,8 triệu \(âm:/.test(await text(pg, '#pt-state')));
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

  /* 5c. Ma trận kiểu BCG: mỗi thẻ Deal nằm đúng góc phần tư của ô nó thuộc (đo trên màn hình so với 2 trục), không thẻ nào chồng thẻ nào */
  const QUAD = { safe: 'TL', double: 'TR', dead: 'BL', bomb: 'BR', old: 'TL', main: 'TR', out: 'BL', next: 'BR' };
  /* chờ thẻ trượt xong (hiệu ứng 0,5 s) rồi mới đo */
  const checkMx = async (root) => { await pg.waitForTimeout(700); return checkMxNow(root); };
  const checkMxNow = (root) => pg.$$eval(root + ' .mx-plot', (plots, Q) => plots.filter(p => p.offsetParent).map(p => {
    const v = p.querySelector('.mx-axis.v').getBoundingClientRect(), h = p.querySelector('.mx-axis.h').getBoundingClientRect();
    const ax = v.left + v.width / 2, ay = h.top + h.height / 2, ds = [...p.querySelectorAll('.dot')].map(d => ({ id: d.dataset.id, cell: d.dataset.cell, r: d.getBoundingClientRect() }));
    const wrong = ds.filter(d => { const cx = d.r.left + d.r.width / 2, cy = d.r.top + d.r.height / 2; return (cx > ax ? 'R' : 'L') !== Q[d.cell][1] || (cy < ay ? 'T' : 'B') !== Q[d.cell][0]; }).map(d => '#' + d.id + ' ' + d.cell);
    let overlap = 0; for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) { const a = ds[i].r, b = ds[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++; }
    return { n: ds.length, wrong, overlap };
  }), QUAD);
  const mxRes = [];
  for (const width of [1280, 390]) {
    pg = await openPage(width, '#/'); mxRes.push(...(await checkMx('#buoc-2'))); await pg.context().close();
    pg = await openPage(width, '#/demo/shield'); mxRes.push(...(await checkMx('#sh-matrix'))); await pg.click('[data-shview="order"]'); mxRes.push(...(await checkMx('#sh-matrix'))); await pg.context().close();
    pg = await openPage(width, '#/demo/danh-muc');
    for (const preset of ['A', 'B']) {
      await pg.click('[data-preset="' + preset + '"]');
      for (const off of [0, 3, 6, 12]) {
        await pg.$eval('#pt-slider', (el, o) => { el.value = Math.min(+el.max, +el.value + o); el.dispatchEvent(new Event('input', { bubbles: true })); }, off);
        await pg.waitForFunction(() => document.querySelector('#pt-cube').dataset.mode === 'flat', null, { timeout: 3000 }).catch(() => {});
        mxRes.push(...(await checkMx('#pt-cube')));
      }
    }
    await pg.context().close();
  }
  const mxWrong = mxRes.flatMap(r => r.wrong), mxOver = mxRes.reduce((a, r) => a + r.overlap, 0), mxTags = mxRes.reduce((a, r) => a + r.n, 0);
  ok('Ma trận: ' + mxTags + ' thẻ Deal trên ' + mxRes.length + ' hình, thẻ nào cũng nằm đúng góc của ô mình', mxRes.length >= 20 && mxWrong.length === 0, mxWrong.slice(0, 5).join(', '));
  ok('Ma trận: không thẻ Deal nào chồng lên thẻ khác', mxOver === 0, mxOver + ' cặp chồng');
  ok('Ma trận: không còn dòng "Cỡ chấm"', !(await (async () => { pg = await openPage(1280, '#/'); const t = await pg.evaluate(() => document.body.innerText); await pg.context().close(); return /Cỡ chấm|Dot size/.test(t); })()));

  /* 5d. Đi qua mọi tab liên tiếp như người xem thật (lỗi 19/10: mở Viễn cảnh rồi sang Danh mục thật thì hình cầu mất màu
     vì 2 khối dùng chung id gradient): không id nào trùng, hình cầu nào cũng tô bằng gradient nằm trong chính khối của nó */
  pg = await openPage(1280, '#/');
  for (const [hash] of ROUTES) { await pg.evaluate(h => { location.hash = h; }, hash); await pg.waitForTimeout(250); }
  await pg.evaluate(() => { location.hash = '#/demo/vien-canh'; }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { location.hash = '#/demo/danh-muc'; }); await pg.waitForTimeout(300);
  await pg.click('[data-pface="3d"]'); await pg.waitForTimeout(1000);
  const dupIds = await pg.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter(k => c[k] > 1); });
  ok('đi hết các tab: không id nào trùng trong trang', dupIds.length === 0, dupIds.join(', '));
  const ballFill = await pg.evaluate(() => [...document.querySelectorAll('#pt-cube .c3-ball')].map(b => { const m = (b.getAttribute('fill') || '').match(/url\(#(.+)\)/); const g = m && document.getElementById(m[1]); return !!g && b.ownerSVGElement.contains(g); })); /* đọc trong cùng một lượt: khối tự xoay vẽ lại mỗi khung */
  ok('Danh mục thật sau Viễn cảnh: ' + ballFill.length + ' hình cầu đều tô bằng gradient trong chính khối đó', ballFill.length === 5 && ballFill.every(Boolean), JSON.stringify(ballFill));
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
  await pg.evaluate(() => { location.hash = '#/demo/danh-muc'; }); await pg.waitForTimeout(300);
  ok('EN: kết luận Trader A khớp nguyên văn R3_11 B4', (await text(pg, '#pt-insight')) === 'Shield turned red at the close of 2 Mar 2026 (headroom: VN30F could fall 3.1% or rise 2.7%). On 3 Mar 2026, Deal #2 was force-closed at 1,951.9, one session after the warning. In total, 2 Deals were force-closed in this period.', await text(pg, '#pt-insight'));
  await pg.evaluate(() => { location.hash = '#/demo/atl'; }); await pg.waitForTimeout(150);
  ok('EN: khối lượng ghi "2 contracts"', (await text(pg, '#atl-qty')) === '2 contracts');
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
  const MIN = 100;
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  if (pass + fail < MIN) { console.log('FAIL: chỉ chạy ' + (pass + fail) + ' kiểm, cần ít nhất ' + MIN); process.exit(1); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E LỖI:', e); process.exit(1); });
