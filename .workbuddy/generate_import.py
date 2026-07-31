import openpyxl, json, unicodedata
from collections import OrderedDict

MAPPING = {
  '璃夢泡影之世外浮城': 'game-bgm-410218',
  'Honey Vibes': 'game-bgm-481196',
  'OVER REQUIEMZ': 'game-bgm-454102',
  '終遠的威爾修 -ErroR:salvation-': 'game-bgm-320129',
  '9 R.I.P.': 'game-bgm-399659',
  'Piofiore no banshou -ricordo-': 'game-bgm-614295',
  'DYNAMIC CHORD 動態和弦 feat.[rêve parfait] Remaster edition': 'game-bgm-114220',
  '死神と少女': 'game-bgm-20936',
  '天獄亂鬥-strayside-': 'game-bgm-363422',
  'マツリカの炯-kEi- 天命華燭伝': 'game-bgm-508806',
  '毘盧遮那戦姫 ～源平飛花夢想～': 'game-bgm-246055',
  '時鐘機關默示錄': 'game-bgm-283667',
  '花之女王': 'game-bgm-75525',
  'OLYMPIASOIRE': 'game-bgm-259951',
  'Collar×Malice': 'game-bgm-144083',
  'VARIABLE BARRICADE 百密一疏少女心 NS': 'game-bgm-192495',
  '十三支演義 偃月三國傳1・2 for Nintendo Switch': 'game-bgm-28340',
  'even if TEMPEST 黃昏中魔女如是說': 'game-bgm-353760',
  'Blackish House sideA→ -Retour-': 'game-bgm-169077',
  '終遠的威爾修 -EpiC:lycoris-': 'game-bgm-399668',
  '囚われのパルマ': 'game-bgm-190099',
  'Cupid Parasite': 'game-bgm-283693',
  '茉莉花之炯 天命胤異傳': 'game-bgm-454097',
  '幸運之杖 R for Nintendo Switch': 'game-bgm-144085',
  '月影の鎖～錯乱パラノイア～': 'game-bgm-50756',
  '虔誠之花的晚鐘-Episodio1926-': 'game-bgm-283695',
  '毘盧遮那戦姫 ～一樹之風～': 'game-bgm-358103',
  'SWEET CLOWN ～午前三時のオカシな道化師～': 'game-bgm-122720',
  '第六妖守': 'game-bgm-283668',
  'Code: Realize ～創世的公主～': 'game-bgm-107473',
  "ときめきメモリアル Girl's Side 4th Heart": 'game-bgm-287683',
  'AMNESIA': 'game-bgm-21015',
  'UN:LOGICAL': 'game-bgm-505060',
}

# 游戏库名称（用于报告对照）
LIB = json.load(open(r'C:\Users\yang.shen\Desktop\amorist\data\amorist-data.json', encoding='utf-8'))
g_raw = LIB.get('localStorage', {}).get('amorist-game-library-v1', '[]')
g = json.loads(g_raw) if isinstance(g_raw, str) else g_raw
lib_name = {gm.get('id'): gm.get('name', '') for gm in g}

def norm(s): return unicodedata.normalize('NFKC', str(s)).strip()
norm_mapping = {norm(k): v for k, v in MAPPING.items()}

xlsx = r'C:\Users\yang.shen\Desktop\游戏游玩记录-2023.10.01.xlsx'
wb = openpyxl.load_workbook(xlsx, data_only=True)
ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))[1:]

events = []
unmatched = []
stats = OrderedDict()
seen = set()
for r in rows:
    if not r or not r[0]: continue
    name = str(r[0]).strip()
    date = r[1]
    key = norm(name)
    if key not in norm_mapping:
        unmatched.append(name); continue
    gameId = norm_mapping[key]
    ds = str(date)[:10] if date else ''
    if not ds: continue
    eid = f'session-import-{gameId}-{ds}'
    if eid in seen: continue
    seen.add(eid)
    events.append({
        'id': eid, 'gameId': gameId, 'type': 'session',
        'occurredAt': ds, 'datePrecision': 'day',
        'title': '游玩记录', 'note': '', 'source': 'import',
        'route': '', 'progress': None, 'playHours': None,
        'createdAt': 1753000000000, 'updatedAt': 1753000000000,
    })
    stats.setdefault(gameId, {'xlsx': name, 'lib': lib_name.get(gameId, '?'), 'count': 0})
    stats[gameId]['count'] += 1

out_json = r'C:\Users\yang.shen\Desktop\amorist\data\import-sessions.json'
json.dump(events, open(out_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

rep = []
rep.append(f'生成 session 事件: {len(events)} 条')
rep.append(f'未匹配游戏名: {len(set(unmatched))} 个 -> {list(set(unmatched))}')
rep.append('')
rep.append('=== 导入清单 (xlsx名 | 库游戏名 | gameId | 记录数) ===')
for gid, info in stats.items():
    rep.append(f'{info["xlsx"]} | {info["lib"]} | {gid} | {info["count"]}')
rep.append('')
rep.append(f'合计: {sum(i["count"] for i in stats.values())} 条 / {len(stats)} 部游戏')
open(r'C:\Users\yang.shen\Desktop\amorist\.workbuddy\_tmp_import_report.txt', 'w', encoding='utf-8').write('\n'.join(rep))
print(f'events={len(events)} unmatched={len(set(unmatched))} games={len(stats)}')
