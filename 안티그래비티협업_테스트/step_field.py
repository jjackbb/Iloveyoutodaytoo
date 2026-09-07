import json
import re
import os
import glob

# 1. Update Button2.dc.html
with open('Button2.dc.html', 'r', encoding='utf-8') as f:
    btn_content = f.read()

# Only change the background of the primary button
btn_content = btn_content.replace('background: #191f28;', 'background: #bf3f0d;')
# Also update the label to reflect the change
btn_content = btn_content.replace('color: #8b95a1;">토스식 — 플랫</span>', 'color: #bf3f0d;">토스식 — 주황 포인트</span>')

with open('Button2.dc.html', 'w', encoding='utf-8') as f:
    f.write(btn_content)

# 2. Inject and change launch page to page-field
with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files_dict = data.get('content', {}).get('files', {})

for file_path in glob.glob('*.dc.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        files_dict[file_path] = f.read()

canvas_str = files_dict.get('canvas.json', '')
if canvas_str:
    canvas_data = json.loads(canvas_str)
    canvas_data['launch']['page'] = 'page-field'
    files_dict['canvas.json'] = json.dumps(canvas_data, indent=2, ensure_ascii=False)

new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Button 2 updated and launch page set to page-field.")
