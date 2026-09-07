import os

files_to_modify = ['CardF1.dc.html', 'Main.dc.html']

for filename in files_to_modify:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 1. Change dot position
        content = content.replace('top: 6px; right: 6px;', 'top: 6px; left: 6px;')
        
        # 2. Change border radius
        content = content.replace('border-top-right-radius: 10px;', 'border-top-right-radius: 16px;')
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)

print("Modification done.")
