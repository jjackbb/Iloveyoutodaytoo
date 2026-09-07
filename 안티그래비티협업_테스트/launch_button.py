import json
import re

with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files = data.get('content', {}).get('files', {})

canvas_str = files.get('canvas.json', '')
if canvas_str:
    canvas_data = json.loads(canvas_str)
    canvas_data['launch']['page'] = 'page-button'
    files['canvas.json'] = json.dumps(canvas_data, indent=2, ensure_ascii=False)
    
    new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
    new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]
    
    with open('component-drafts.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    print("Updated launch page to page-button")
else:
    print("canvas.json not found")
