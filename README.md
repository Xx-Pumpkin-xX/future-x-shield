# Future X Shield: trang đề xuất

Trang web giới thiệu Future X Shield, concept của đội thi FBA 2026. Không phải sản phẩm hay giao diện chính thức của DNSE.

Trang là **một file HTML tĩnh** (`dist/index.html`): không backend, không đăng nhập, không cookie, không đo lượt xem, không gọi ra mạng. Mọi phép tính chạy trong trình duyệt của người xem.

Trang có 6 tab: Tổng quan, Vấn đề, Sản phẩm, Demo, Luật và dữ liệu, Điểm yếu. Tab Demo có 3 tab con: lúc đặt lệnh, Shield hai chiều, viễn cảnh. Mỗi tab có đường dẫn riêng, ví dụ `#/demo/atl`. Có hai ngôn ngữ, VI và EN.

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `engine/engine.js` | Bộ tính Shield, port 1-1 của `shield_engine.py` (bàn giao Team Product 16/10/2026). Mọi con số trên trang đều do file này tính. |
| `src/index.html` | Khung trang, có 4 chỗ chèn script, 2 chỗ chèn CSS. |
| `src/app.js` | Hiển thị: định tuyến tab, ngôn ngữ, 3 demo. Không tự tính số. |
| `src/i18n.js` | Toàn bộ chữ trên trang, mỗi khoá có cả `vi` và `en`. |
| `src/style.css` | Giao diện. |
| `fonts/` | Font Be Vietnam Pro (OFL, xem `fonts/OFL.txt`), nhúng vào file build để không phải tải từ Google. |
| `build.js` | Ghép tất cả thành `dist/index.html`. |
| `tests/` | `test_engine.js` (47 số vàng), `test_build.js` (build, nội dung, cấu hình), `e2e.js` (Chromium thật). |
| `.github/workflows/pages.yml` | Chạy test và e2e ở mỗi lần push (phần đưa lên GitHub Pages bị tắt khi dùng Cloudflare). Trên máy Phong, file đang chờ ở `ci/pages.yml`: RUNBOOK bước 2 chuyển nó vào đúng chỗ. |
| `.nvmrc` | Node 20, cho Cloudflare và máy dev dùng cùng phiên bản. |
| `RUNBOOK.md` | Các bước đưa lên, cập nhật, gỡ xuống. |

## Bộ tính chỉ có một bản

`engine/engine.js` phải giống hệt `FBA\prototype_engine\engine.js`, bản đang chạy trong prototype trên canvas. Khi repo nằm cạnh thư mục đó, `build.js` so hai file và **dừng** nếu chúng khác nhau. Muốn sửa bộ tính thì sửa ở một chỗ, chép sang chỗ kia, rồi chạy lại cả hai bộ test.

## Chạy trên máy

Cần Node 18 trở lên.

```
npm ci                          # cài playwright (chỉ để chạy e2e)
npm test                        # "47 pass, 0 fail" rồi "54 pass, 0 fail"
node build.js                   # ra dist/index.html và dist/_headers, in commit đã đóng dấu
npx playwright install chromium # lần đầu
npm run e2e                     # "92 pass, 0 fail"
```

Mở `dist/index.html` bằng trình duyệt là xem được, không cần máy chủ.

## Bản build tự biết mình là bản nào

`build.js` đóng dấu commit, nhánh và giờ build vào `window.__BUILD__` và vào `<meta name="build">`. Chân trang hiện các thông tin này. Nếu còn thay đổi chưa commit, build vẫn chạy nhưng in cảnh báo to và đóng dấu `+dirty`; GitHub Actions từ chối đưa bản `+dirty` lên.

Build **từ chối** ghi file khi:
- file xuất ra có chuỗi giống secret (token GitHub, khoá API, khoá riêng…);
- `engine.js` lệch bản gốc;
- `src/index.html` có thuộc tính `onclick=` hay thẻ `<script>` thứ hai, vì CSP sẽ chặn chúng.

## Bảo mật

- Content-Security-Policy chỉ cho chạy đúng đoạn script đã build (theo sha256). Script nào bị sửa tay trong `dist/` sẽ bị trình duyệt chặn và trang không chạy. Đây là cố ý: đừng sửa `dist/`, hãy sửa `src/` rồi build lại.
- Trang không có ô nhập nào gửi đi đâu và không có máy chủ, nên không có gì để tấn công phía server. Toàn bộ an toàn dựa vào việc trang chỉ là file tĩnh.
- `localStorage` chỉ nhớ ngôn ngữ đã chọn; đọc/ghi trong try/catch nên trình duyệt chặn lưu trữ thì trang vẫn chạy.

## Cấu hình

Không biến môi trường nào là bắt buộc. `.env.example` liệt kê mọi biến mà code đọc, kèm giải thích; `tests/test_build.js` kiểm danh sách đó khớp với code.

## Đưa lên ở đâu

**Cloudflare Pages** build từ repo GitHub **private** và phát trang công khai. GitHub Actions chỉ chạy test và e2e; biến repo `DEPLOY_PAGES` để trống nên GitHub Pages không đưa lên gì. Trên Cloudflare, lệnh build là `npm test && node build.js --require-clean`: test đỏ hoặc bản build không đến từ một commit sạch thì Cloudflare giữ nguyên bản cũ. `dist/_headers` đặt header bảo mật mà thẻ `<meta>` không làm được (`frame-ancestors`, `nosniff`). Các bước cụ thể nằm trong `RUNBOOK.md`.

## Chưa làm, kèm lý do

- **Chưa công khai.** Leader phải xác nhận luật thi cho đăng trước hạn nộp (A-06). Chỉ nối Cloudflare sau khi Leader xác nhận, vì Cloudflare đưa trang lên ngay khi nối.
- **Chưa có trạng thái “quy mô đỉnh 5 phiên”** (FR-23), vì tài khoản demo chưa có dữ liệu cho nó. Trang ghi rõ ở tab Điểm yếu.
- **Tên “Future X Shield”** và **ranh giới trục A = 0** là mặc định đang chờ team chốt; xem hồ sơ BA v2 mục 7.
- **Chưa thử trên Safari iOS thật.** e2e chạy Chromium. Khối 3D dùng CSS 3D, Safari hỗ trợ, nhưng cần mở thử trên iPhone trước khi gửi link.
- **Ngưỡng 18,48% / 17,71% / 17,35%** lấy từ ví dụ FAQ, cần DNSE xác nhận [A].
