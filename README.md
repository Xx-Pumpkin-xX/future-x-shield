# Future X Shield: trang đề xuất

Trang web giới thiệu Future X Shield, [concept của đội thi FBA 2026](https://future-x-shield.luckynoob410.workers.dev/?fbclid=IwY2xjawVAK0BleHRuA2FlbQIxMQBwZG9mA3NydGMGYXBwX2lkATAAAR5Oc1HYnkfv9BTGis-p-Jg2DEAAjK5zBf0rWIjMXBt64_mVpHKtTbhsyQrWWQ_aem_zauc48n8JLVswJ5GgWzBSA#/). Không phải sản phẩm hay giao diện chính thức của DNSE.

Trang Tổng quan là một trang dài 9 phần (hero, Vấn đề, Bằng chứng, Giải pháp và 3 bước, Dành cho ai, Nguyên tắc, Dữ liệu), nền trắng và đỏ nhạt xen kẽ, theo hướng dẫn DNSE_R3_11 của leader (19/10/2026). Các tab Vấn đề, Sản phẩm, Luật và dữ liệu cuộn tới phần tương ứng. Tab Demo có 4 tab con: lúc đặt lệnh, Shield hai chiều, viễn cảnh, danh mục thật (khách mẫu chạy trên giá VN30F1M theo ngày). Mỗi tab có đường dẫn riêng, ví dụ `#/demo/atl`. Có hai ngôn ngữ, VI và EN.

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `engine/engine.js` | Bộ tính Shield, port 1-1 của `shield_engine.py` (bàn giao Team Product 16/10/2026). Mọi con số trên trang đều do file này tính. |
| `engine/timeline.js` | Mô phỏng tài khoản qua nhiều phiên trên giá thật (bù trong phiên, xử lý, thanh toán cuối ngày, lệnh của khách) và hai khách mẫu. Bước giá trong phiên trùng `SE.move` từng số. |
| `data/vn30f1m.csv` | Giá VN30F1M theo ngày, 411 phiên (02/01/2025–28/08/2026), từ `VN30F.xlsx` của team mô phỏng; tạo lại bằng `tools/vn30f_xlsx_to_csv.py`. |
| `src/index.html` | Khung trang, có 7 chỗ chèn script, 2 chỗ chèn CSS. |
| `src/app.js` | Hiển thị: định tuyến tab, ngôn ngữ, 4 demo. Không tự tính số. |
| `src/cube3d.js` | Khối A × B × C 3D vẽ bằng SVG: kéo để xoay, mỗi Deal là một hình cầu theo tỷ lệ cọc. |
| `assets/logo-icon.png` | Logo khiên ở đầu trang. |
| `assets/favicon.png` | Cùng logo, cắt vuông 64×64, làm biểu tượng tab trình duyệt. Cả hai được nhúng thẳng vào file build. |
| `src/i18n.js` | Toàn bộ chữ trên trang, mỗi khoá có cả `vi` và `en`. |
| `src/style.css` | Giao diện. |
| `fonts/` | Font Be Vietnam Pro (OFL, xem `fonts/OFL.txt`), nhúng vào file build để không phải tải từ Google. |
| `build.js` | Ghép tất cả thành `dist/index.html`. |
| `tests/` | `test_engine.js` (51 kiểm: số vàng và ranh giới ô 1/n), `test_timeline.js` (mô phỏng nhiều phiên, 17 kiểm), `test_build.js` (build, nội dung, cấu hình), `e2e.js` (trình duyệt thật). |
| `tools/l10b_replica.js` | Thử chạy lại L10b không cần script gốc. Hiện khớp xu hướng, chưa khớp số (xem "Chưa làm"). |
| `wrangler.jsonc` | Cấu hình Cloudflare Workers: chỉ phát thư mục `dist`. |
| `.github/workflows/pages.yml` | Chạy test và e2e ở mỗi lần push (phần đưa lên GitHub Pages bị tắt khi dùng Cloudflare). Trên máy Phong, file đang chờ ở `ci/pages.yml`: RUNBOOK bước 2 chuyển nó vào đúng chỗ. |
| `.nvmrc` | Node 20, cho Cloudflare và máy dev dùng cùng phiên bản. |
| `RUNBOOK.md` | Các bước đưa lên, cập nhật, gỡ xuống. |

## Bộ tính chỉ có một bản

`engine/engine.js` phải giống hệt `FBA\prototype_engine\engine.js`, bản đang chạy trong prototype trên canvas. Khi repo nằm cạnh thư mục đó, `build.js` so hai file và **dừng** nếu chúng khác nhau. Muốn sửa bộ tính thì sửa ở một chỗ, chép sang chỗ kia, rồi chạy lại cả hai bộ test.

## Chạy trên máy

Cần Node 18 trở lên.

```
npm ci                          # cài playwright (chỉ để chạy e2e)
npm test                        # "51 pass", "17 pass", rồi "59 pass", đều 0 fail
node build.js                   # ra dist/index.html và dist/_headers, in commit đã đóng dấu
npx playwright install chromium # lần đầu; không tải được thì đặt E2E_CHANNEL=msedge
npm run e2e                     # "134 pass, 0 fail"
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

**Cloudflare Workers** (Worker `future-x-shield`, địa chỉ `future-x-shield.luckynoob410.workers.dev`) build từ repo GitHub **private** và phát trang công khai, khi Worker đã được nối Git (RUNBOOK bước 3). GitHub Actions chỉ chạy test và e2e; biến repo `DEPLOY_PAGES` để trống nên GitHub Pages không đưa lên gì. Trên Cloudflare, lệnh build là `npm test && node build.js --require-clean`: test đỏ hoặc bản build không đến từ một commit sạch thì Cloudflare giữ nguyên bản cũ. `dist/_headers` đặt header bảo mật mà thẻ `<meta>` không làm được (`frame-ancestors`, `nosniff`). Các bước cụ thể nằm trong `RUNBOOK.md`.

## Chưa làm, kèm lý do

- **Chưa công khai.** Leader phải xác nhận luật thi cho đăng trước hạn nộp (A-06). Chỉ nối Cloudflare sau khi Leader xác nhận, vì Cloudflare đưa trang lên ngay khi nối.
- **Chưa có trạng thái “quy mô đỉnh 5 phiên”** (FR-23), vì tài khoản demo chưa có dữ liệu cho nó. Tab Điểm yếu đã bỏ (18/10), nên trang hiện không còn ghi điều này.
- **Ranh giới ô ma trận** đã chốt 19/10: A và C “cao” khi lớn hơn phần chia đều 1/n (R3_11 A7). `SE.cell` ở cả hai bản engine đã đổi theo; `shield_engine.py` của Team Product không có hàm chia ô nên không cần đổi.
- **Tên ô** theo deck (Contained gain … Primary driver), bản VN giữ tên tiếng Anh, nghĩa tiếng Việt in nhỏ bên dưới. Engine vẫn trả khoá tên cũ (Két sắt …) để prototype trên canvas không phải sửa; `app.js` đổi sang tên hiển thị.
- **Tên “Future X Shield”** là mặc định đang chờ team chốt; xem hồ sơ BA v2 mục 7.
- **Chưa thử trên Safari iOS thật.** e2e chạy Chromium và Edge. Khối 3D là SVG, kéo bằng pointer events; cần mở thử trên iPhone trước khi gửi link.
- **Chưa chạy lại được đúng L10b.** Bộ dữ liệu mô phỏng mới có giá nhưng chưa có `l10b_sim.py`, `l10c_sim.py`. `tools/l10b_replica.js` dựng lại theo luật ở KQ_L4 phần 15: ra đúng xu hướng (1 Deal bật tự tăng: 0 Deal bị xử lý; tắt tự tăng: hàng trăm), nhưng nhóm nhiều Deal bật tự tăng ra 12 và 5, so với 24 và 14 của CSV. Cần script gốc để biết khác ở luật nào.
- **Tab Danh mục thật** dùng luật L10b trên giá thật cho hai khách mẫu tự đặt [M]; không phải một case của L10b.
- **Khách mẫu có lúc cọc ngoài Deal âm** (ví dụ khách B sau 03/04/2025). Mô phỏng chưa có bước gọi ký quỹ khi cọc ngoài Deal âm.
- **Ngưỡng 18,48% / 17,71% / 17,35%** lấy từ ví dụ FAQ, cần DNSE xác nhận [A].
