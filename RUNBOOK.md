# Runbook: GitHub (private) → Cloudflare Workers

Chạy trên **Windows** (PowerShell), trong thư mục `FBA\future-x-shield`. Không chạy git trong VM. Mỗi bước có dòng "phải thấy"; không thấy thì dừng lại, đừng làm tiếp.

**Cách trang chạy.** Không có máy chủ của mình, không có tiến trình nào phải chạy hay khởi động lại. Cloudflare Workers Builds lấy code từ GitHub, chạy test, build ra một file tĩnh trong `dist/` và phát file đó từ mạng của Cloudflare (`wrangler.jsonc` chỉ phát file tĩnh, không có code chạy phía máy chủ). Máy Phong tắt thì trang vẫn chạy.

**Địa chỉ:** https://future-x-shield.luckynoob410.workers.dev/

**Hai nơi, hai việc:**
- **GitHub (repo private `Xx-Pumpkin-xX/future-x-shield`):** giữ code. GitHub Actions chạy test và e2e ở mỗi lần push. Biến `DEPLOY_PAGES` **không đặt**, nên GitHub Pages không đưa lên gì.
- **Cloudflare Worker `future-x-shield`:** build và phát trang. Chỉ tự build lại khi Worker **đã nối với repo GitHub** (bước 3).

## 0. Một lần trên máy

- Node 20: `node -v` (Cloudflare cũng dùng 20, theo file `.nvmrc`)
- Git for Windows: `git --version`
- Đã đăng nhập git: `git config user.name`, `git config user.email`

## 1. Kiểm trước khi commit

```powershell
cd "$HOME\OneDrive\Documents\FBA\future-x-shield"
npm ci
npm test
```
Phải thấy `51 pass, 0 fail`, `17 pass, 0 fail`, `18 pass, 0 fail`, rồi `59 pass, 0 fail`.

Kiểm cả trình duyệt. Máy này không tải được Chromium của Playwright nên dùng Edge có sẵn:
```powershell
node build.js
$env:E2E_CHANNEL = "msedge"
node tests/e2e.js
Remove-Item Env:E2E_CHANNEL
```
Phải thấy `159 pass, 0 fail`.

## 2. Đẩy lên GitHub

```powershell
git status --short
```
**Không được** có `dist/`, `node_modules/`, file `.env` nào (trừ `.env.example`), file nén, log.

```powershell
git add -A
git commit -m "<sửa gì>"
git pull --no-rebase
git push
```
`git pull` trước khi `push` vì người khác trong team cũng có thể đã đẩy commit lên. Nếu pull báo xung đột: dừng lại, mở file bị xung đột, giữ phần đúng, rồi `git add` + `git commit`.

Phải thấy: tab Actions trên GitHub chạy workflow "Kiem va dua len Pages". Job `test-build` xanh; `deploy` và `verify-live` **bị bỏ qua** (skipped). Đúng như vậy.

## 3. Nối Worker với GitHub (một lần)

Nếu push lên mà trang không đổi, Worker chưa được nối với repo. Lần đầu trang được đưa lên bằng tay nên không tự cập nhật.

Trên dash.cloudflare.com → **Workers & Pages** → Worker **future-x-shield** → **Settings** → **Build**:
1. **Git repository** → **Connect** → GitHub → cho phép Cloudflare đọc **chỉ** repo `future-x-shield` → chọn repo, nhánh `main`.
2. **Build command:** `npm test && node build.js --require-clean`
3. **Deploy command:** `npx wrangler deploy` (đọc `wrangler.jsonc`, phát thư mục `dist`)
4. **Root directory:** để trống.
5. **Build variables:** `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1` (test trên Cloudflare không cần trình duyệt; e2e đã chạy ở GitHub Actions).
6. Lưu. Vào tab **Deployments**, bấm build lại commit mới nhất, hoặc push một commit mới.

Phải thấy trong log build:
- `51 pass, 0 fail`, `17 pass, 0 fail`, `18 pass, 0 fail`, `59 pass, 0 fail`;
- `bản build: <12 ký tự commit> main …`, **không** có `+dirty`;
- dòng báo deploy thành công của `wrangler`.

Nếu build dừng với `--require-clean: … +dirty`: bước cài thư viện đã sửa một file đang được git theo dõi (thường là `package-lock.json`). Chạy `npm install` trên máy, commit file lock mới, rồi push lại. Đừng bỏ `--require-clean` để chữa.

## 4. Kiểm địa chỉ thật, không phải localhost

```powershell
$env:E2E_CHANNEL = "msedge"
$env:E2E_URL = "https://future-x-shield.luckynoob410.workers.dev/"
$env:EXPECT_COMMIT = (git rev-parse HEAD)
node tests/e2e.js
Remove-Item Env:E2E_CHANNEL, Env:E2E_URL, Env:EXPECT_COMMIT
```
Phải thấy `PASS bản build: đúng commit vừa đẩy (…)` và `160 pass, 0 fail`. Nếu commit không khớp: Cloudflare chưa build xong, hoặc Worker chưa nối Git (bước 3).

Trên điện thoại:
1. Mở địa chỉ trên.
2. So chân trang ("Bản build …") với `git rev-parse --short=12 HEAD`. Phải giống nhau.
3. Demo → Lúc đặt lệnh: trước lệnh 25,4%, sau lệnh 2,3% và 10,1%.
4. Demo → Danh mục thật: mở ở phiên 02/03/2026, Shield đỏ; bấm "Đóng Deal #2" thì câu tóm tắt đổi.
   Demo → Viễn cảnh: bấm "Mở 1 HĐ long VN30F1M" một lần, khối phải tự xoay sang mặt A × C (hàng trên Past drain / Primary driver).
5. Kéo khối 3D ở tab Viễn cảnh và Danh mục thật; trên iPhone (Safari) cũng phải xoay được.
6. Bấm cờ ngôn ngữ, chọn English: cả trang chuyển sang tiếng Anh. Tải lại: vẫn tiếng Anh.

## 5. Sửa bộ tính hoặc dữ liệu giá

- **Bộ tính:** sửa `FBA\prototype_engine\engine.js`, chép sang `future-x-shield\engine\engine.js`, chạy test ở cả hai chỗ. Build trên máy dừng nếu hai file khác nhau.
- **Giá VN30F1M:** có file giá mới thì chạy `python tools/vn30f_xlsx_to_csv.py "<đường dẫn VN30F.xlsx>"` để ghi lại `data/vn30f1m.csv`, rồi chạy test. Các mốc của khách mẫu trong `tests/test_timeline.js` và kết quả mô phỏng trong `tests/test_sim.js` sẽ báo nếu số đổi. Nếu team chạy lại mô phỏng với giá mới, chép 3 file kết quả của họ vào `data/sim/`.
- Không bao giờ sửa `dist/`: script bị sửa tay sẽ bị CSP chặn.

## 6. Quay lại bản trước

Nhanh nhất: Cloudflare → Worker → **Deployments** → chọn bản trước → **Rollback**. Sau đó sửa cho đúng trong git:
```powershell
git log --oneline
git revert <commit-lỗi>
git push
```
Không tải file lên Cloudflare bằng tay. Mỗi bản đang chạy phải đến từ một commit, để chân trang nói đúng.

## 7. Gỡ xuống

Cloudflare → Worker → **Settings** → **Domains & Routes** → tắt `workers.dev`: địa chỉ ngừng chạy, Worker vẫn còn. Xoá hẳn: **Settings** → **Delete**. Repo GitHub vẫn private, không cần đổi gì.

## 8. Ghi nhớ để trang luôn online

- **Không đổi** tên Worker sau khi đã gửi link cho BTC, vì địa chỉ đổi theo.
- **Không gỡ** quyền của Cloudflare trên repo GitHub, vì các lần push sau sẽ không được đưa lên. Bản đang chạy vẫn chạy.
- **Đính kèm** `dist/index.html` vào bài nộp làm bản dự phòng. File tự chứa, mở thẳng từ ổ đĩa được, không cần mạng.
