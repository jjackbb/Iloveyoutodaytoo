import json
import re

with open('Button4.dc.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace font-size: 16px with 17px in the buttons
content = content.replace('font-size: 16px;', 'font-size: 17px;')

with open('Button4.dc.html', 'w', encoding='utf-8') as f:
    f.write(content)

# Inject into component-drafts
with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files_dict = data.get('content', {}).get('files', {})

files_dict['Button4.dc.html'] = content

new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Font size enlarged.")
