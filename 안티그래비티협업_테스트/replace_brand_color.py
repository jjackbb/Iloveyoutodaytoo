import os

files = ['Button4.dc.html', 'Field4.dc.html', 'Chip4.dc.html', 'Inner4.dc.html']
for fn in files:
    with open(fn, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('#3182f6', '#bf3f0d').replace('#3182F6', '#bf3f0d')
    content = content.replace('쨍한 블루(#bf3f0d)', '서비스 메인 컬러(#BF3F0D)')
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(content)

