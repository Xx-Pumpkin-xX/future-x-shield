/* Test bản build và nội dung, không cần thư viện ngoài. Mỗi bộ kiểm có một đối chứng âm:
   chứng minh bộ kiểm BẮT ĐƯỢC lỗi, không chỉ im lặng. Chạy: node tests/test_build.js */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { build, scanSecrets, SECRET_PATTERNS } = require('../build.js');
const I18N = require('../src/i18n.js');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  cond ? pass++ : fail++;
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra && !cond ? '  -> ' + extra : ''));
}

/* ---------- 1. i18n: hai ngôn ngữ cùng bộ khoá, mọi khoá được dùng đều có ---------- */
function missingKeys(used) { return used.filter(k => !(k in I18N.vi) || !(k in I18N.en)); }
const vi = Object.keys(I18N.vi).sort(), en = Object.keys(I18N.en).sort();
ok('i18n: vi và en cùng số khoá (' + vi.length + ')', vi.length === en.length && vi.length > 100, vi.length + ' vs ' + en.length);
ok('i18n: vi và en cùng tên khoá', JSON.stringify(vi) === JSON.stringify(en),
  vi.filter(k => !en.includes(k)).concat(en.filter(k => !vi.includes(k))).join(', '));
ok('i18n: không giá trị rỗng', vi.every(k => I18N.vi[k].trim() && I18N.en[k].trim()));
const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
const usedHtml = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1])
  .concat([...html.matchAll(/data-i18n-attr="[a-z-]+:([^"]+)"/g)].map(m => m[1]));
const usedApp = [...app.matchAll(/\bt\('([a-z0-9.]+)'\s*[,)]/g)].map(m => m[1])
  .concat(['green', 'yellow', 'red', 'violated'].map(k => 'tone.' + k)) /* t('tone.' + level) ghép động */
  .concat(['unit.ct1', 'unit.ctn', 'unit.deal1', 'unit.dealn']); /* plural(key, n) ghép động */
/* tên ô: app.js ánh xạ khoá engine sang 'cell.<x>' (tên) và 'cellg.<x>' (nghĩa tiếng Việt) */
const cellMap = (app.match(/var CELL = \{([^}]*)\}/) || ['', ''])[1];
const cellKeys = [...cellMap.matchAll(/:\s*'([a-z]+)'/g)].flatMap(m => ['cell.' + m[1], 'cellg.' + m[1]]);
ok('i18n: index.html dùng ' + usedHtml.length + ' khoá, đều có', usedHtml.length > 80 && missingKeys(usedHtml).length === 0, missingKeys(usedHtml).join(', '));
ok('i18n: app.js dùng ' + usedApp.length + ' khoá, đều có', usedApp.length > 40 && missingKeys(usedApp).length === 0, missingKeys(usedApp).join(', '));
ok('i18n: 8 tên ô ma trận và nghĩa tiếng Việt đều có', cellKeys.length === 16 && missingKeys(cellKeys).length === 0, cellKeys.length + ' ' + missingKeys(cellKeys).join(', '));
/* R3_11 phần C: từ cũ không được quay lại (chỉ quét chữ hiển thị, không quét tên biến trong code) */
const BANNED = { en: [/liquidat/i, /margin outside the Deals/i, /shared pool/i, /reserve money/i, /automatic (Deal )?top-up/i, /Demo book/, /room left/i,
    /two-way bar\b/i, /Background alarm/, /calculator/i, /Customer [AB]\b/, /\(s\)/, /\d ct\b/, /\bL10[bc]\b/, /\bL8b\b/, /brief 4\./, /\bBomb\b/, /Bystander/, /Main culprit/, /Next threat/],
  vi: [/ăn đệm/, /tựa vào/, /túi chung/, /túi cọc/, /Báo thức nền/, /thanh hai chiều/, /\bL10[bc]\b/, /\bL8b\b/, /brief 4\./, /Quả bom/, /Thủ phạm/, /Két sắt/] };
function bannedIn(lang, vals) { return BANNED[lang].filter(re => vals.some(v => re.test(v))).map(String); }
ok('R3_11 phần C: bản en không còn từ cũ', bannedIn('en', Object.values(I18N.en)).length === 0, bannedIn('en', Object.values(I18N.en)).join(', '));
ok('R3_11 phần C: bản vi không còn từ cũ', bannedIn('vi', Object.values(I18N.vi)).length === 0, bannedIn('vi', Object.values(I18N.vi)).join(', '));
ok('đối chứng âm: bộ dò từ cũ bắt được "liquidated" và "túi chung"', bannedIn('en', ['Deal #2 liquidated']).length === 1 && bannedIn('vi', ['túi chung']).length === 1);
ok('đối chứng âm: bộ kiểm khoá báo thiếu khi khoá không tồn tại', missingKeys(['zz.khong-co']).length === 1);
const EN_VIET = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;
const enLeak = en.filter(k => EN_VIET.test(I18N.en[k]));
ok('i18n: bản en không còn chữ tiếng Việt', enLeak.length === 0, enLeak.join(', '));
ok('đối chứng âm: bộ dò chữ Việt bắt được chữ Việt', EN_VIET.test(I18N.vi['tab.problem']));

/* ---------- 2. Build với dấu cố định ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fxs-'));
const STAMP = { commit: 'abc123def456', branch: 'main', time: '2026-10-16T00:00:00Z', dirty: false, inGit: true };
const res = build({ out: tmp, quiet: true, stamp: STAMP });
const out = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
ok('build: ghi được file (' + Math.round(out.length / 1024) + ' KB)', out.length > 100000);
ok('build: dấu commit nằm trong window.__BUILD__', out.includes('window.__BUILD__ = {"commit":"abc123def456"'));
ok('build: dấu commit nằm trong <meta name="build">', /<meta name="build" content="\{&quot;commit&quot;:&quot;abc123def456&quot;/.test(out));
const scriptInFile = out.match(/<script>([\s\S]*?)<\/script>/)[1];
const csp = out.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const hashOf = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
ok('CSP: hash trong CSP khớp đúng đoạn script trong file', csp.includes(hashOf(scriptInFile)));
ok('đối chứng âm: sửa 1 ký tự trong script thì hash không còn khớp', !csp.includes(hashOf(scriptInFile + ' ')));
ok('CSP: default-src none, không cho script ngoài', csp.startsWith("default-src 'none'") && !/script-src[^;]*(https?:|'unsafe-inline'|\*)/.test(csp));
ok('build: biểu tượng tab là logo khiên, nhúng sẵn (data:image/png)', /<link rel="icon" type="image\/png" sizes="64x64" href="data:image\/png;base64,iVBOR/.test(out) && /img-src data:/.test(csp));
ok('build: chỉ 1 thẻ <script>', (out.match(/<script/g) || []).length === 1);
ok('build: không còn chỗ chèn', !/\/\*__[A-Z]+__\*\//.test(out.replace(scriptInFile, '')) && !out.includes('__CSP__'));

const hdr = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
ok('_headers: có frame-ancestors none và nosniff', /frame-ancestors 'none'/.test(hdr) && /nosniff/.test(hdr));
let threw = '';
try { build({ out: path.join(tmp, 'x'), quiet: true, requireClean: true, stamp: Object.assign({}, STAMP, { dirty: true }) }); } catch (e) { threw = e.message; }
ok('--require-clean: từ chối bản +dirty', /require-clean/.test(threw), threw);
threw = '';
try { build({ out: path.join(tmp, 'y'), quiet: true, requireClean: true, stamp: Object.assign({}, STAMP, { commit: 'no-git' }) }); } catch (e) { threw = e.message; }
ok('--require-clean: từ chối bản không có commit', /require-clean/.test(threw), threw);
threw = 'chưa chạy';
try { build({ out: path.join(tmp, 'z'), quiet: true, requireClean: true, stamp: STAMP }); threw = ''; } catch (e) { threw = e.message; }
ok('đối chứng: --require-clean cho qua bản sạch', threw === '', threw);

/* ---------- 3. Không có secret; bộ dò bắt được từng mẫu ---------- */
ok('secret: file xuất ra sạch', scanSecrets(out).length === 0, scanSecrets(out).join(', '));
const PLANTED = {
  'GitHub token': 'ghp_' + 'A'.repeat(36), 'GitHub fine-grained token': 'github_pat_' + 'B'.repeat(50),
  'Anthropic/OpenAI key': 'sk-ant-' + 'c'.repeat(30), 'AWS access key': 'AKIA' + 'D'.repeat(16),
  'Google API key': 'AIza' + 'e'.repeat(35), 'Private key block': '-----BEGIN RSA PRIVATE KEY-----',
  'Slack token': 'xoxb-' + '1'.repeat(20), 'Assignment of password/secret': 'password = "hunter2hunter2"'
};
SECRET_PATTERNS.forEach(p => ok('đối chứng âm: bộ dò bắt được ' + p.name, scanSecrets('x ' + PLANTED[p.name] + ' y').includes(p.name)));
ok('mỗi mẫu secret có một chuỗi cài thử', SECRET_PATTERNS.every(p => PLANTED[p.name]));

/* Build thật phải TỪ CHỐI và không ghi file khi nguồn có secret (chạy trên bản sao). */
function copyRepo(dest) {
  for (const p of ['build.js', 'src', 'engine', 'fonts', 'assets', 'data']) fs.cpSync(path.join(ROOT, p), path.join(dest, p), { recursive: true });
}
const sand = fs.mkdtempSync(path.join(os.tmpdir(), 'fxs-sand-'));
const repoCopy = path.join(sand, 'future-x-shield');
copyRepo(repoCopy);
fs.appendFileSync(path.join(repoCopy, 'src/app.js'), '\n// ' + PLANTED['GitHub token'] + '\n');
let r = spawnSync(process.execPath, ['build.js'], { cwd: repoCopy, encoding: 'utf8' });
ok('build từ chối nguồn có secret (exit ≠ 0)', r.status !== 0, 'exit ' + r.status);
ok('build báo rõ lý do từ chối', /TỪ CHỐI/.test(r.stderr), r.stderr);
ok('build không ghi dist khi từ chối', !fs.existsSync(path.join(repoCopy, 'dist/index.html')));

/* Engine lệch bản gốc ../prototype_engine thì build phải dừng; khớp thì chạy. */
const sand2 = fs.mkdtempSync(path.join(os.tmpdir(), 'fxs-sand-'));
const repo2 = path.join(sand2, 'future-x-shield');
copyRepo(repo2);
fs.mkdirSync(path.join(sand2, 'prototype_engine'));
fs.writeFileSync(path.join(sand2, 'prototype_engine/engine.js'), fs.readFileSync(path.join(ROOT, 'engine/engine.js'), 'utf8') + '\n// khác\n');
r = spawnSync(process.execPath, ['build.js'], { cwd: repo2, encoding: 'utf8' });
ok('build dừng khi engine.js lệch bản gốc', r.status !== 0 && /khác/.test(r.stderr), r.stderr);
fs.copyFileSync(path.join(ROOT, 'engine/engine.js'), path.join(sand2, 'prototype_engine/engine.js'));
r = spawnSync(process.execPath, ['build.js'], { cwd: repo2, encoding: 'utf8' });
ok('đối chứng: engine khớp thì build chạy và báo đã so khớp', r.status === 0 && /khớp/.test(r.stdout), r.stdout + r.stderr);
/* Trên Cloudflare (không có GITHUB_*), commit lấy từ CF_PAGES_COMMIT_SHA */
const cfEnv = Object.assign({}, process.env, { CF_PAGES_COMMIT_SHA: 'cfcfcfcfcfcf0123456789', CF_PAGES_BRANCH: 'main' });
delete cfEnv.GITHUB_SHA; delete cfEnv.GITHUB_REF_NAME;
r = spawnSync(process.execPath, ['build.js', '--require-clean'], { cwd: repo2, encoding: 'utf8', env: cfEnv });
const cfOut = fs.existsSync(path.join(repo2, 'dist/index.html')) ? fs.readFileSync(path.join(repo2, 'dist/index.html'), 'utf8') : '';
ok('Cloudflare: dấu commit lấy từ CF_PAGES_COMMIT_SHA', r.status === 0 && cfOut.includes('"commit":"cfcfcfcfcfcf","branch":"main"'), r.stdout + r.stderr);
const wkEnv = Object.assign({}, process.env, { WORKERS_CI_COMMIT_SHA: 'abababababab9876543210', WORKERS_CI_BRANCH: 'main' });
['GITHUB_SHA', 'GITHUB_REF_NAME', 'CF_PAGES_COMMIT_SHA', 'CF_PAGES_BRANCH'].forEach(k => delete wkEnv[k]);
r = spawnSync(process.execPath, ['build.js', '--require-clean'], { cwd: repo2, encoding: 'utf8', env: wkEnv });
const wkOut = fs.existsSync(path.join(repo2, 'dist/index.html')) ? fs.readFileSync(path.join(repo2, 'dist/index.html'), 'utf8') : '';
ok('Cloudflare Workers: dấu commit lấy từ WORKERS_CI_COMMIT_SHA', r.status === 0 && wkOut.includes('"commit":"abababababab","branch":"main"'), r.stdout + r.stderr);

/* ---------- 4. Không còn số cũ, không gọi ra mạng ---------- */
const STALE = ['47 vs 0', '47 so với 0', '21,1%', '25,6%', '1,9%', '8,3%', 'Khiên', 'không giới hạn', 'unlimited', '72/79', 'Đệm ÷ Tốc độ'];
function staleIn(s) { return STALE.filter(x => s.includes(x)); }
ok('nội dung: không còn số/chữ đã bị thay thế', staleIn(out).length === 0, staleIn(out).join(', '));
ok('đối chứng âm: bộ dò số cũ bắt được "Khiên"', staleIn('ô Khiên').length === 1);
const NET = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts)\s*\(|new\s+(WebSocket|EventSource|XMLHttpRequest)\b|(src|href)\s*=\s*["']https?:|url\(\s*["']?https?:|@import/;
function netIn(s) { return NET.test(s); }
ok('mạng: file không gọi ra ngoài, không tải tài nguyên ngoài', !netIn(out));
ok('đối chứng âm: bộ dò mạng bắt được fetch(', netIn('x = fetch("/a")') && netIn('<img src="https://a">'));
ok('quyền riêng tư: không cookie', !/document\.cookie/.test(out));

/* ---------- 5. Kiểm cấu hình: mọi biến môi trường code đọc đều có trong .env.example ---------- */
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    if (['node_modules', 'dist', '.git', 'fonts'].includes(d.name)) return [];
    const p = path.join(dir, d.name);
    return d.isDirectory() ? filesUnder(p) : [p];
  });
}
const used = new Set();
for (const f of filesUnder(ROOT)) {
  if (!/\.(js|mjs|cjs|sh|ps1|yml|yaml|json)$/.test(f) || f.includes(path.join('tests', 'test_build.js'))) continue;
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/process\.env\.([A-Z0-9_]+)|process\.env\[['"]([A-Z0-9_]+)['"]\]|\benv\.([A-Z0-9_]+)|\$\{\{\s*env\.([A-Z0-9_]+)|\$env:([A-Z0-9_]+)/g)) used.add(m[1] || m[2] || m[3] || m[4] || m[5]);
  for (const m of s.matchAll(/const\s*\{([^}]+)\}\s*=\s*process\.env/g)) m[1].split(',').forEach(x => used.add(x.trim().split(':')[0]));
}
const documented = new Set([...fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8').matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1]));
ok('env: tìm thấy biến code đọc (' + [...used].join(', ') + ')', used.size >= 2);
ok('env: mọi biến code đọc đều có trong .env.example', [...used].every(v => documented.has(v)), [...used].filter(v => !documented.has(v)).join(', '));
ok('env: .env.example không liệt kê biến không ai đọc', [...documented].every(v => used.has(v)), [...documented].filter(v => !used.has(v)).join(', '));

/* ---------- 6. .gitignore chặn đủ ---------- */
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
for (const pat of ['node_modules/', 'dist/', '.env', '*.log', '*.zip', '*.tar.gz', '*.db', '__pycache__/']) ok('.gitignore có ' + pat, gi.split(/\r?\n/).includes(pat));
ok('.gitignore vẫn cho commit .env.example', gi.split(/\r?\n/).includes('!.env.example'));

fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(sand, { recursive: true, force: true }); fs.rmSync(sand2, { recursive: true, force: true });
const MIN = 57;
console.log('\n' + pass + ' pass, ' + fail + ' fail');
if (pass + fail < MIN) { console.log('FAIL: chỉ chạy ' + (pass + fail) + ' kiểm, cần ít nhất ' + MIN + ' (có đoạn bị bỏ qua?)'); process.exit(1); }
process.exit(fail ? 1 : 0);
