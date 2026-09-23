import json
import re

# 1. Create the 4 authentic Toss design HTML files
files_content = {
    "Button4.dc.html": """<!doctype html>
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
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #191f28;">버튼 ④</span>
      <span style="font-size: 13px; font-weight: 600; color: #3182f6;">찐 토스식 — 맥스 플랫</span>
    </div>
    <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #8b95a1;">그라데이션이나 그림자 없이 완전히 납작합니다. 메인은 쨍한 블루(#3182F6), 보조는 옅은 회색(#F2F4F6) 면으로 기능에만 극도로 집중합니다.</p>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <button style="width: 100%; height: 56px; background: #3182f6; color: #ffffff; font-size: 16px; font-weight: 600; border: none; border-radius: 16px; cursor: pointer;">확인</button>
    <button style="width: 100%; height: 56px; background: #f2f4f6; color: #4e5968; font-size: 16px; font-weight: 600; border: none; border-radius: 16px; cursor: pointer;">취소</button>
  </div>
</div>
</x-dc>
</body>
</html>""",

    "Field4.dc.html": """<!doctype html>
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
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #191f28;">입력칸 ④</span>
      <span style="font-size: 13px; font-weight: 600; color: #3182f6;">찐 토스식 — 회색 블록</span>
    </div>
    <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #8b95a1;">선(Border)을 아예 그리지 않습니다. 연한 회색 배경(#F2F4F6)에 16px의 부드러운 모서리만 주어, 시각적 피로도 없이 입력에 집중하게 합니다.</p>
  </div>
  <div style="display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label style="font-size: 13px; font-weight: 600; color: #4e5968;">이름</label>
      <input type="text" placeholder="이름을 입력하세요" style="width: 100%; height: 56px; background: #f2f4f6; color: #191f28; font-size: 16px; border: none; border-radius: 16px; padding: 0 16px; box-sizing: border-box; outline: none;">
    </div>
  </div>
</div>
</x-dc>
</body>
</html>""",

    "Chip4.dc.html": """<!doctype html>
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
      <span style="font-size: 13px; font-weight: 600; color: #3182f6;">찐 토스식 — 다크 솔리드</span>
    </div>
    <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #8b95a1;">선택된 상태를 명확하게 보여주기 위해 진한 먹색(#333D4B) 면을 씁니다. 미선택 상태는 옅은 회색 면입니다. 형태는 둥근 사각형(8px)입니다.</p>
  </div>
  <div style="display: flex; gap: 8px;">
    <div style="padding: 10px 16px; background: #333d4b; color: #ffffff; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">선택됨</div>
    <div style="padding: 10px 16px; background: #f2f4f6; color: #4e5968; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">기본 상태</div>
    <div style="padding: 10px 16px; background: #f2f4f6; color: #4e5968; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">필터</div>
  </div>
</div>
</x-dc>
</body>
</html>""",

    "Inner4.dc.html": """<!doctype html>
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
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #191f28;">안쪽 면 ④</span>
      <span style="font-size: 13px; font-weight: 600; color: #3182f6;">찐 토스식 — 인포 박스</span>
    </div>
    <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #8b95a1;">아이콘과 텍스트를 조합해 정보를 묶습니다. 여백이 넉넉한 회색 면(#F2F4F6, 16px)을 사용해, 테두리 없이도 본문과 완벽하게 분리됩니다.</p>
  </div>
  <div style="background: #ffffff; border: 1px solid #e5e8eb; border-radius: 16px; padding: 20px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #191f28;">안내사항</p>
    <div style="background: #f2f4f6; border-radius: 16px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
      <span style="font-size: 18px; line-height: 1.4;">💡</span>
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4e5968;">앨범방 카드의 이름은 나중에 언제든지 설정에서 다시 바꿀 수 있습니다.</p>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>"""
}

# 2. Save these files locally
for filename, content in files_content.items():
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

# 3. Read LOCAL component-drafts.html and inject these + modify canvas.json
with open('component-drafts.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

match = re.search(r'(<script type="application/json" id="appifact-doc">)(.*?)(</script>)', html_content, re.DOTALL)
data = json.loads(match.group(2))
files = data.get('content', {}).get('files', {})

# Ensure all files in the current folder are picked up
import os
import glob
for file_path in glob.glob('*.dc.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        files[file_path] = f.read()

# Modify canvas.json
canvas_str = files.get('canvas.json', '')
if canvas_str:
    canvas_data = json.loads(canvas_str)
    
    # Add new artboards if not already present
    new_artboards = [
        {"file": "Button4.dc.html", "x": 1410, "y": 0, "w": 390, "h": 330, "page": "page-button"},
        {"file": "Field4.dc.html", "x": 1410, "y": 0, "w": 390, "h": 330, "page": "page-field"},
        {"file": "Chip4.dc.html", "x": 1410, "y": 0, "w": 390, "h": 330, "page": "page-chip"},
        {"file": "Inner4.dc.html", "x": 1410, "y": 0, "w": 390, "h": 330, "page": "page-inner"}
    ]
    
    existing_files = [ab['file'] for ab in canvas_data.get('artboards', [])]
    for ab in new_artboards:
        if ab['file'] not in existing_files:
            canvas_data.get('artboards', []).append(ab)
            
    # Set launch page to Button to start over
    canvas_data['launch']['page'] = 'page-button'
    
    files['canvas.json'] = json.dumps(canvas_data, indent=2, ensure_ascii=False)

# Escape and build new JSON
new_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
new_json = new_json.replace('</script>', '<\\/script>').replace('<script', '\\u003cscript')
new_html = html_content[:match.start(2)] + new_json + html_content[match.end(2):]

with open('component-drafts.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Revamp completed.")
