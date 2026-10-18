"""Chuyển file giá của team mô phỏng (VN30F.xlsx, sheet "VN30F1M Data") thành data/vn30f1m.csv.
Chạy lại khi có file giá mới: python tools/vn30f_xlsx_to_csv.py "<đường dẫn VN30F.xlsx>"
In ra số phiên, ngày đầu/cuối; dừng nếu thấy dòng giá sai (cao < thấp, mở/đóng ngoài khoảng)."""
import sys, csv, datetime, pathlib
import openpyxl

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'vn30f1m.csv'
ws = openpyxl.load_workbook(src, read_only=True)['VN30F1M Data']
rows = list(ws.iter_rows(values_only=True))
meta = {r[0]: r[1] for r in rows[:6] if r and r[0]}
hdr = [i for i, r in enumerate(rows) if r and r[0] == 'Ngày'][0]
data = []
for r in rows[hdr + 1:]:
    if not r or not isinstance(r[0], datetime.datetime):
        continue
    d, o, h, l, c = r[0].date(), float(r[1]), float(r[2]), float(r[3]), float(r[4])
    if not (l <= min(o, c) <= max(o, c) <= h):
        sys.exit(f'dòng giá sai: {d} {o} {h} {l} {c}')
    data.append((d.isoformat(), o, h, l, c))
data.sort()
if len({d[0] for d in data}) != len(data):
    sys.exit('có ngày trùng')
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['ngay', 'mo', 'cao', 'thap', 'dong'])
    w.writerows(data)
print('nguồn:', src, '| tải lúc:', meta.get('Thời điểm tải'))
print('ghi:', out, '|', len(data), 'phiên', data[0][0], '→', data[-1][0])
