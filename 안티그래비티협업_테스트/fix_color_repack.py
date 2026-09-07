import json
import re
import os
import glob

# 1. Modify the 4 files on disk
files = ['Button4.dc.html', 'Field4.dc.html', 'Chip4.dc.html', 'Inner4.dc.html']
for fn in files:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace('#3182f6', '#bf3f0d').replace('#3182F6', '#bf3f0d')
        content = content.replace('쨍한 블루(#bf3f0d)', '주황색(#bf3f0d)').replace('쨍한 블루(#3182F6)', '주황색(#bf3f0d)')
        with open(fn, 'w', encoding='utf-8') as f:
            f.write(content)

# 2. Read component-drafts.html and inject
with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files_dict = data.get('content', {}).get('files', {})

for file_path in glob.glob('*.dc.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        files_dict[file_path] = f.read()

new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Colors fixed and repacked.")
