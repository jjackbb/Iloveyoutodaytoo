import json
import re
import os
import glob

# Modify Chip2.dc.html (Segment with real text)
chip2_html = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; }
    .sheet { font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif; -webkit-font-smoothing: antialiased; word-break: keep-all; }
  </style>
</helmet>
<div class="sheet" style="width: 390px; padding: 20px 20px 28px; background: #ffffff; color: #222222; box-sizing: border-box;">
  <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">
    <div style="display: flex; align-items: baseline; gap: 8px;">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #222222;">칩 ②</span>
      <span style="font-size: 13px; font-weight: 600; color: #6a6a6a;">세그먼트</span>
    </div>
  </div>
  <div style="display: flex; background: #e5e8eb; border-radius: 9px; padding: 2px;">
    <div style="flex: 1; text-align: center; padding: 8px 0; background: #ffffff; border-radius: 7px; font-size: 14px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">전체</div>
    <div style="flex: 1; text-align: center; padding: 8px 0; font-size: 14px; font-weight: 600; color: #6a6a6a;">좋아요</div>
    <div style="flex: 1; text-align: center; padding: 8px 0; font-size: 14px; font-weight: 600; color: #6a6a6a;">1:1</div>
    <div style="flex: 1; text-align: center; padding: 8px 0; font-size: 14px; font-weight: 600; color: #6a6a6a;">랜덤</div>
  </div>
</div>
</x-dc>
</body>
</html>"""

with open('Chip2.dc.html', 'w', encoding='utf-8') as f:
    f.write(chip2_html)

# Modify Chip4.dc.html (Point Color + real text)
chip4_html = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; }
    .sheet { font-family: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif; -webkit-font-smoothing: antialiased; word-break: keep-all; }
  </style>
</helmet>
<div class="sheet" style="width: 390px; padding: 20px 20px 28px; background: #ffffff; color: #191f28; box-sizing: border-box;">
  <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 24px;">
    <div style="display: flex; align-items: baseline; gap: 8px;">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #191f28;">칩 ④</span>
      <span style="font-size: 13px; font-weight: 600; color: #bf3f0d;">찐 토스식 — 브랜드 포인트 컬러</span>
    </div>
  </div>
  <div style="display: flex; gap: 8px;">
    <div style="padding: 10px 16px; background: #bf3f0d; color: #ffffff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">전체</div>
    <div style="padding: 10px 16px; background: #f2f4f6; color: #4e5968; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">좋아요</div>
    <div style="padding: 10px 16px; background: #f2f4f6; color: #4e5968; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">1:1</div>
    <div style="padding: 10px 16px; background: #f2f4f6; color: #4e5968; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer;">랜덤</div>
  </div>
</div>
</x-dc>
</body>
</html>"""

with open('Chip4.dc.html', 'w', encoding='utf-8') as f:
    f.write(chip4_html)

# Inject
with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files_dict = data.get('content', {}).get('files', {})

for file_path in glob.glob('*.dc.html'):
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            files_dict[file_path] = f.read()

new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Chips updated with real context and brand color.")
