# Runbook: GitHub (private) → Cloudflare Pages

Chạy trên **Windows** (PowerShell), trong thư mục `FBA\future-x-shield`. Không chạy git trong VM. Mỗi bước có dòng "phải thấy"; không thấy thì dừng lại, đừng làm tiếp.

**Cách trang chạy.** Không có máy chủ của mình, không có tiến trình nào phải chạy hay khởi động lại. Cloudflare Pages lấy code từ GitHub, chạy test, build ra một file tĩnh và phát file đó từ mạng của Cloudflare. Máy Phong tắt thì trang vẫn chạy.

**Hai nơi, hai việc:**
- **GitHub (repo private):** giữ code. GitHub Actions chạy test và e2e ở mỗi lần push. Biến `DEPLOY_PAGES` **không đặt**, nên GitHub Pages không đưa lên gì.
- **Cloudflare Pages:** build và phát trang công khai. Cloudflare đọc được repo private, nên code không cần public.

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
Phải thấy `47 pass, 0 fail`, rồi `54 pass, 0 fail`.

Kiểm cả trình duyệt (nên làm trước lần công khai đầu tiên):
```powershell
npx playwright install chromium
npm run e2e
```
Phải thấy `92 pass, 0 fail`.

## 2. Làm được ngay: tạo repo PRIVATE và đẩy lên

File workflow nằm ở `ci\pages.yml`, vì công cụ từ xa không được ghi vào `.github\`. Chuyển nó vào đúng chỗ trước commit đầu tiên:
```powershell
New-Item -ItemType Directory -Force .github\workflows | Out-Null
Move-Item ci\pages.yml .github\workflows\pages.yml
git init -b main
git status --short
```
Phải thấy `.github/` trong danh sách và thư mục `ci\` đã trống. **Không được** có `dist/`, `node_modules/`, file `.env` nào (trừ `.env.example`), file nén hay log. Nếu có, sửa `.gitignore` trước.

```powershell
git add .
git commit -m "Trang đề xuất Future X Shield"
```
Trên github.com: New repository → tên `future-x-shield` → **Private** → không tick README, .gitignore hay license.
```powershell
git remote add origin https://github.com/<tài-khoản>/future-x-shield.git
git push -u origin main
```
Phải thấy: tab Actions chạy workflow "Kiem va dua len Pages". Job `test-build` xanh; `deploy` và `verify-live` **bị bỏ qua** (skipped). Đúng như vậy.

## 3. Nối Cloudflare: CHỈ sau khi Leader xác nhận (A-06)

**Vì sao phải đợi:** ngay lúc bấm "Save and Deploy", Cloudflare đưa trang lên một địa chỉ `*.pages.dev` mà ai có link cũng mở được. Đừng nối trước khi Leader đồng ý.

Đọc lại lịch sử trước khi nối:
```powershell
git log --stat
```
Nếu một secret đã từng được commit, **đổi secret đó trước** (thu hồi token, tạo khoá mới). Viết lại lịch sử chỉ là việc phụ, vì nó không xoá được thứ đã lộ.

Trên dash.cloudflare.com:
1. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Chọn **GitHub**, đăng nhập, cho phép Cloudflare đọc **chỉ** repo `future-x-shield` (Only select repositories), rồi **Install & Authorize** → **Begin setup**.
3. **Set up builds and deployments:**
   - Project name: `future-x-shield` (thành địa chỉ `future-x-shield.pages.dev`; nếu tên đã có người dùng, Cloudflare thêm hậu tố)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm test && node build.js --require-clean`
   - Build output directory: `dist`
   - Root directory: để trống
4. **Environment variables** (Production và Preview đều đặt):
   - `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1` (test trên Cloudflare không cần trình duyệt; e2e đã chạy ở GitHub Actions)
5. **Save and Deploy.**

Phải thấy trong log build của Cloudflare:
- `47 pass, 0 fail` và `54 pass, 0 fail`
- `bản build: <12 ký tự commit> main …`, **không** có `+dirty`
- `Success: Your site was deployed!`

Nếu build dừng với `--require-clean: … +dirty`: bước cài thư viện đã sửa một file đang được git theo dõi (thường là `package-lock.json`). Chạy `npm install` trên máy, commit `package-lock.json` mới, rồi push lại. Đừng bỏ `--require-clean` để chữa.

**Bản xem trước:** mỗi nhánh khác `main` có một địa chỉ xem trước riêng, cũng công khai. Chỉ push nhánh mà bạn không ngại người khác xem.

## 4. Kiểm địa chỉ thật, không phải localhost

Từ máy (kiểm đúng commit đang chạy):
```powershell
$env:E2E_URL = "https://future-x-shield.pages.dev/"
$env:EXPECT_COMMIT = (git rev-parse HEAD)
node tests/e2e.js
Remove-Item Env:E2E_URL; Remove-Item Env:EXPECT_COMMIT
```
Phải thấy `PASS bản build: đúng commit vừa đẩy (…)` và `93 pass, 0 fail`.

Trên điện thoại:
1. Mở địa chỉ `.pages.dev`.
2. So chân trang ("Bản build …") với `git rev-parse --short=12 HEAD`. Phải giống nhau.
3. Demo → Lúc đặt lệnh: phải thấy trước lệnh 25,4%, sau lệnh 2,3% và 10,1%.
4. Bấm EN: cả trang chuyển sang tiếng Anh. Tải lại: vẫn tiếng Anh. Bấm VI.
5. Mở thẳng `…pages.dev/#/demo/vien-canh`: phải vào đúng tab.
6. Trên iPhone (Safari): khối 3D ở tab Viễn cảnh phải xoay được.

## 5. Cập nhật

Sửa trong `src/` hoặc `engine/`. Không bao giờ sửa `dist/`: script bị sửa tay sẽ bị CSP chặn.
```powershell
npm test
git add -A
git commit -m "<sửa gì>"
git push
```
GitHub Actions chạy test và e2e. Cloudflare build và đưa lên. **Nếu test trên Cloudflare đỏ, bản cũ vẫn chạy.** Sau khi Cloudflare xong, chạy lại bước 4 để chắc bản mới đang chạy.

Sửa bộ tính: sửa `FBA\prototype_engine\engine.js`, chép sang `future-x-shield\engine\engine.js`, rồi chạy test ở cả hai chỗ. Build trên máy sẽ dừng nếu hai file khác nhau.

## 6. Quay lại bản trước

Nhanh nhất: Cloudflare → project → **Deployments** → chọn bản trước → **Rollback to this deployment**. Sau đó sửa cho đúng trong git:
```powershell
git log --oneline
git revert <commit-lỗi>
git push
```
Không tải file lên Cloudflare bằng tay. Mỗi bản đang chạy phải đến từ một commit, để chân trang nói đúng.

## 7. Gỡ xuống

Cloudflare → project → **Settings** → **Delete project**. Địa chỉ `.pages.dev` ngừng chạy. Repo GitHub vẫn private, không cần đổi gì.

## 8. Ghi nhớ để trang luôn online

- **Không đổi** tên project Cloudflare sau khi đã gửi link cho BTC, vì địa chỉ đổi theo.
- **Không gỡ** quyền của Cloudflare trên repo GitHub, vì các lần push sau sẽ không được đưa lên. Bản đang chạy vẫn chạy.
- **Đính kèm** `dist/index.html` vào bài nộp làm bản dự phòng. File tự chứa, mở thẳng từ ổ đĩa được, không cần mạng.
