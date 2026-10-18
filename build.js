#!/usr/bin/env node
/* Dựng dist/index.html: một file HTML tự chạy, không gọi ra mạng.
   - Ghép src/ + engine/engine.js + font vào một file.
   - Đóng dấu bản build: commit, nhánh, giờ build, có thay đổi chưa commit hay không.
   - Tính CSP theo sha256 của đoạn script nội tuyến.
   - TỪ CHỐI xuất file nếu thấy chuỗi giống secret, nếu thiếu/thừa chỗ chèn,
     hoặc nếu engine.js lệch với bản gốc ../prototype_engine/engine.js (khi bản gốc có mặt).
   Chạy: node build.js                  (ra dist/index.html và dist/_headers)
         node build.js --require-clean  (dừng nếu không có commit hoặc còn thay đổi chưa commit; dùng trên Cloudflare)
         node build.js --out=x          (ra thư mục khác, dùng trong test) */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = __dirname;
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* Mẫu chuỗi bị cấm trong file xuất ra. Thêm mẫu ở đây, đừng bớt. */
const SECRET_PATTERNS = [
  { name: 'GitHub token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: 'Anthropic/OpenAI key', re: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Slack token', re: /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Assignment of password/secret', re: /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i }
];
function scanSecrets(text) {
  return SECRET_PATTERNS.filter(p => p.re.test(text)).map(p => p.name);
}

function sha256b64(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('base64'); }
function cspFor(scriptBody) {
  return [
    "default-src 'none'",
    "script-src 'sha256-" + sha256b64(scriptBody) + "'",
    "style-src 'unsafe-inline'",
    'font-src data:',
    'img-src data:',
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ');
}

function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch (e) { return null; }
}
function stamp() {
  const env = process.env;
  const inGit = sh('git rev-parse --is-inside-work-tree') === 'true';
  /* GitHub Actions đặt GITHUB_*, Cloudflare Pages đặt CF_PAGES_*, Cloudflare Workers Builds đặt WORKERS_CI_*;
     chạy trên máy thì hỏi git. */
  const ciSha = env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA || env.WORKERS_CI_COMMIT_SHA;
  const commit = ciSha ? ciSha.slice(0, 12) : (inGit ? sh('git rev-parse --short=12 HEAD') : null);
  const branch = env.GITHUB_REF_NAME || env.CF_PAGES_BRANCH || env.WORKERS_CI_BRANCH || (inGit ? sh('git rev-parse --abbrev-ref HEAD') : null);
  const porcelain = inGit ? sh('git status --porcelain') : null;
  const dirty = !!(porcelain && porcelain.length);
  return { commit: commit || 'no-git', branch: branch || 'no-git', time: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), dirty, inGit };
}

function fontsCSS() {
  const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const VIET = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
  let css = '';
  for (const [subset, range] of [['vietnamese', VIET], ['latin', LATIN]]) {
    for (const w of [400, 600, 800]) {
      const f = path.join(ROOT, 'fonts', `be-vietnam-pro-${subset}-${w}-normal.woff2`);
      const b64 = fs.readFileSync(f).toString('base64');
      css += `@font-face{font-family:'Be Vietnam Pro';font-style:normal;font-weight:${w};font-display:swap;` +
        `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}\n`;
    }
  }
  return css;
}

/* Giá VN30F1M theo ngày (data/vn30f1m.csv, do tools/vn30f_xlsx_to_csv.py tạo). Dừng nếu file hỏng. */
function priceData() {
  const lines = rd('data/vn30f1m.csv').trim().split(/\r?\n/);
  if (lines[0].trim() !== 'ngay,mo,cao,thap,dong') throw new Error('data/vn30f1m.csv: sai dòng tiêu đề');
  const rows = lines.slice(1).map((l, i) => {
    const c = l.split(','), v = c.slice(1).map(Number);
    if (c.length !== 5 || !/^\d{4}-\d{2}-\d{2}$/.test(c[0]) || v.some(x => !isFinite(x)) || !(v[2] <= Math.min(v[0], v[3]) && Math.max(v[0], v[3]) <= v[1]))
      throw new Error('data/vn30f1m.csv: dòng ' + (i + 2) + ' sai: ' + l);
    return [c[0]].concat(v);
  });
  if (rows.length < 300) throw new Error('data/vn30f1m.csv: chỉ có ' + rows.length + ' phiên');
  return 'var VN30F1M = ' + JSON.stringify(rows) + ';';
}

function put(html, marker, value) {
  const n = html.split(marker).length - 1;
  if (n !== 1) throw new Error(`chỗ chèn ${marker} xuất hiện ${n} lần trong src/index.html, cần đúng 1`);
  return html.split(marker).join(value);
}

function checkEngineSync() {
  const origin = path.join(ROOT, '..', 'prototype_engine', 'engine.js');
  if (!fs.existsSync(origin)) return 'không thấy ../prototype_engine/engine.js, bỏ qua so khớp';
  const a = fs.readFileSync(origin), b = fs.readFileSync(path.join(ROOT, 'engine', 'engine.js'));
  if (!a.equals(b)) throw new Error('engine/engine.js khác ../prototype_engine/engine.js. Hai bản phải giống hệt; chép bản đúng sang rồi chạy lại test.');
  return 'engine.js khớp ../prototype_engine/engine.js';
}

function build(opts) {
  opts = opts || {};
  const outDir = path.resolve(ROOT, opts.out || 'dist');
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  log('nguồn:', ROOT);
  const engineMsg = checkEngineSync();
  log('engine:', engineMsg);
  const st = opts.stamp || stamp();
  if (!st.inGit && !process.env.GITHUB_SHA && !process.env.CF_PAGES_COMMIT_SHA && !process.env.WORKERS_CI_COMMIT_SHA) log('CẢNH BÁO: không chạy trong git, bản build ghi commit = no-git');
  if (opts.requireClean && (st.dirty || st.commit === 'no-git')) throw new Error('--require-clean: bản build phải đến từ đúng một commit sạch (đang là ' + st.commit + (st.dirty ? '+dirty' : '') + ')');
  if (st.dirty) {
    console.warn('\n!!! CẢNH BÁO: có thay đổi CHƯA COMMIT. Bản build này không khớp với commit ' + st.commit + '.');
    console.warn('!!! Đừng đưa bản này lên. Commit trước rồi build lại.\n');
  }
  const buildInfo = { commit: st.commit, branch: st.branch, time: st.time, dirty: st.dirty };
  const script = '\nwindow.__BUILD__ = ' + JSON.stringify(buildInfo) + ';\n' +
    rd('engine/engine.js') + '\n' + rd('engine/timeline.js') + '\n' + priceData() + '\n' +
    rd('src/i18n.js') + '\n' + rd('src/cube3d.js') + '\n' + rd('src/app.js') + '\n';
  let html = rd('src/index.html');
  /* Đoạn script trong mẫu chỉ được chứa 4 chỗ chèn; mọi thứ khác phải nằm trong file nguồn. */
  const tpl = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!tpl || tpl[1].replace(/\s+/g, '') !== '/*__BUILD__*//*__ENGINE__*//*__TIMELINE__*//*__DATA__*//*__I18N__*//*__CUBE__*//*__APP__*/') throw new Error('khối <script> trong src/index.html phải chỉ chứa 7 chỗ chèn, đúng thứ tự');
  if ((html.match(/<script/g) || []).length !== 1) throw new Error('src/index.html chỉ được có 1 thẻ <script>');
  if (/\son[a-z]+\s*=/.test(html)) throw new Error('src/index.html có thuộc tính onXxx=: CSP sẽ chặn, chuyển sang app.js');
  html = html.replace(/<script>[\s\S]*?<\/script>/, () => '<script>' + script + '</script>');
  html = put(html, '/*__FONTS__*/', fontsCSS());
  html = put(html, '/*__STYLE__*/', rd('src/style.css'));
  html = put(html, '__LOGO__', 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'logo-icon.png')).toString('base64'));
  html = put(html, '__FAVICON__', 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'favicon.png')).toString('base64'));
  html = put(html, '__CSP__', cspFor(script));
  html = put(html, '__BUILD_JSON__', JSON.stringify(buildInfo).replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
  /* Kiểm phần ngoài script (trong script, app.js dùng window.__BUILD__ là hợp lệ). */
  const leftover = html.replace(/<script>[\s\S]*?<\/script>/, '').match(/\/\*__[A-Z0-9]+__\*\/|__[A-Z_]+__/g);
  if (leftover) throw new Error('còn chỗ chèn chưa thay: ' + leftover.join(', '));

  const hits = scanSecrets(html);
  if (hits.length) throw new Error('TỪ CHỐI: file xuất ra chứa chuỗi giống secret (' + hits.join(', ') + '). Không ghi gì.');

  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'index.html');
  fs.writeFileSync(out, html);
  /* Header HTTP cho Cloudflare Pages (GitHub Pages bỏ qua file này). CSP chính nằm trong <meta>;
     frame-ancestors chỉ có hiệu lực qua header nên đặt ở đây. */
  fs.writeFileSync(path.join(outDir, '_headers'), [
    '/*',
    "  Content-Security-Policy: frame-ancestors 'none'",
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
    '  X-Robots-Tag: noindex',
    ''
  ].join('\n'));
  const digest = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
  log('đã ghi:', out, '(' + (html.length / 1024).toFixed(0) + ' KB, sha256 ' + digest + ')');
  log('bản build:', buildInfo.commit + (buildInfo.dirty ? '+dirty' : ''), buildInfo.branch, buildInfo.time);
  return { out, html, buildInfo, script };
}

module.exports = { build, scanSecrets, cspFor, SECRET_PATTERNS };

if (require.main === module) {
  const outArg = process.argv.find(a => a.startsWith('--out='));
  try { build({ out: outArg ? outArg.slice(6) : 'dist', requireClean: process.argv.includes('--require-clean') }); }
  catch (e) { console.error('BUILD LỖI: ' + e.message); process.exit(1); }
}
