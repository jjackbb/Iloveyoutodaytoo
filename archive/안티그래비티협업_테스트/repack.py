import json
import re
import os

with open('../design/canvas/components/component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
if not match:
    print("Not found")
    exit(1)

data = json.loads(match.group(2))
files = data.get('content', {}).get('files', {})

for filename in files.keys():
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            files[filename] = f.read()

# Crucial: escape '/' in '</script>' or escape '<'
new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')

new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Repacked successfully.")
