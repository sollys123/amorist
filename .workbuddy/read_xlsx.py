import openpyxl, json
from collections import OrderedDict

xlsx = r'C:\Users\yang.shen\Desktop\游戏游玩记录-2023.10.01.xlsx'
wb = openpyxl.load_workbook(xlsx, data_only=True)
ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))
records = rows[1:]
names = OrderedDict()
total = 0
dup_same_day = 0
for r in records:
    if not r or not r[0]: continue
    name = str(r[0]).strip()
    date = r[1]
    total += 1
    if name not in names:
        names[name] = {'count':0, 'dates':[], 'dup_days':0}
        seen_days = set()
    names[name]['count'] += 1
    ds = str(date)[:10] if date else ''
    if ds:
        if ds in seen_days: names[name]['dup_days'] += 1
        seen_days.add(ds)
        names[name]['dates'].append(ds)

out = []
out.append(f'TOTAL RECORDS: {total}')
out.append(f'UNIQUE GAMES: {len(names)}')
out.append('')
out.append('=== UNIQUE GAME NAMES (name | count | dup_same_day | first~last) ===')
for name, info in names.items():
    dates = sorted(set(info['dates']))
    out.append(f'{name}\t{info["count"]}\t{info["dup_days"]}\t{dates[0] if dates else "?"}~{dates[-1] if dates else "?"}')

data_path = r'C:\Users\yang.shen\Desktop\amorist\data\amorist-data.json'
d = json.load(open(data_path, encoding='utf-8'))
ls = d.get('localStorage', {})
g_raw = ls.get('amorist-game-library-v1', '[]')
g = json.loads(g_raw) if isinstance(g_raw, str) else g_raw
out.append('')
out.append(f'=== GAMES IN LIBRARY ({len(g)}) ===')
for gm in g:
    out.append(f'{gm.get("id","")}\t{gm.get("name","")}')

open(r'C:\Users\yang.shen\Desktop\amorist\.workbuddy\_tmp_xlsx_names.txt','w',encoding='utf-8').write('\n'.join(out))
print('done', total, 'records', len(names), 'unique')
