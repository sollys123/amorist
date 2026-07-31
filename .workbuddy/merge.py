import json, shutil
p = r'C:\Users\yang.shen\Desktop\amorist\data\amorist-data.json'
shutil.copy(p, p + '.bak')
d = json.load(open(p, encoding='utf-8'))
ls = d['localStorage']
tl = json.loads(ls.get('amorist-timeline-events-v1', '{"version":2,"events":[]}'))
evs = tl['events'] if isinstance(tl, dict) else tl
existing_ids = {e.get('id') for e in evs}
sessions = json.load(open(r'C:\Users\yang.shen\Desktop\amorist\data\import-sessions.json', encoding='utf-8'))
add = [s for s in sessions if s['id'] not in existing_ids]
all_evs = evs + add
ls['amorist-timeline-events-v1'] = json.dumps({'version': 2, 'events': all_evs}, ensure_ascii=False)
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(r'C:\Users\yang.shen\Desktop\amorist\.workbuddy\_tmp_merge.txt', 'w', encoding='utf-8').write(f'merged {len(add)} sessions, total {len(all_evs)} events, backup=amorist-data.json.bak')
