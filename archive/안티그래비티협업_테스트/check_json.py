import json
import re

with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
try:
    data = json.loads(match.group(2))
    print("JSON is valid!")
except Exception as e:
    print("JSON Error:", e)
