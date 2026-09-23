import json
import re

with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'<script type="application/json" id="appifact-doc">(.*?)</script>', html_content, re.DOTALL)
data = json.loads(match.group(1))
files = data.get('content', {}).get('files', {})

for filename, f_content in files.items():
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(f_content)

print(f"Extracted {len(files)} files.")
