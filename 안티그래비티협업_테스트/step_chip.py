import json
import re
import os
import glob

# 1. Update Field4.dc.html text size
with open('Field4.dc.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Bump label size
content = content.replace('font-size: 13px;', 'font-size: 15px;')
# Bump input size
content = content.replace('font-size: 16px;', 'font-size: 18px; font-weight: 500;') # added weight for robustness

with open('Field4.dc.html', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Inject and change launch page to page-chip
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
    canvas_data['launch']['page'] = 'page-chip'
    files_dict['canvas.json'] = json.dumps(canvas_data, indent=2, ensure_ascii=False)

new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Field 4 text updated and launch page set to page-chip.")
