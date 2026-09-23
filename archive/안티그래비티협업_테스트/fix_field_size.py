import json
import re
import os
import glob

with open('Field4.dc.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix label size to 14px (Standard secondary)
content = content.replace('font-size: 15px;', 'font-size: 14px;')
# Fix input size to 17px (Match button)
content = content.replace('font-size: 18px;', 'font-size: 17px;')

with open('Field4.dc.html', 'w', encoding='utf-8') as f:
    f.write(content)

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

print("Field 4 unified to 17px.")
