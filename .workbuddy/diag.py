import urllib.request, json, os
out = []
f = r'C:\Users\yang.shen\Desktop\amorist\data\import-sessions.json'
out.append(f'file exists: {os.path.exists(f)}')
if os.path.exists(f):
    out.append(f'file size: {os.path.getsize(f)} bytes')
    try:
        d = json.load(open(f, encoding='utf-8'))
        out.append(f'json events: {len(d)}')
        out.append(f'first id: {d[0]["id"] if d else "none"}')
    except Exception as e:
        out.append(f'json parse error: {e}')
for url in ['http://127.0.0.1:8765/editor.html', 'http://127.0.0.1:8765/data/import-sessions.json']:
    try:
        r = urllib.request.urlopen(url, timeout=5)
        body = r.read()
        out.append(f'HTTP {url} -> {r.status}, {len(body)} bytes')
    except Exception as e:
        out.append(f'HTTP {url} -> ERR {e}')
open(r'C:\Users\yang.shen\Desktop\amorist\.workbuddy\_tmp_diag.txt', 'w', encoding='utf-8').write('\n'.join(out))
